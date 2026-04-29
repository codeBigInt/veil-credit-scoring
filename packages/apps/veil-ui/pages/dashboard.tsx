import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { syncNetworkId } from '@/utils/network-id';
import { PRIVATE_STATE_ID, makeFullCompiledContract } from '@/contract-api-utils';
import { createCircuitContext, toHex } from '@midnight-ntwrk/compact-runtime';
import { DynamicContractAPI } from 'nite-api';
import { Contract, ledger, VeilPrivateState, witness, Witnesses } from '@veil/veil-contract';
import { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { parseCoinPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import { filter, firstValueFrom } from 'rxjs';

const NETWORK_ID = 'preprod';
const PREPROD_ENV = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
};
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8081';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';
const PRIVATE_STATE_STORE_NAME = 'veil-private-state';

const backendApiUrl = (path: string): string => {
  const base = BACKEND_URL.replace(/\/+$/, '');
  const apiBase = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const readJsonResponse = async (res: Response): Promise<any> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  throw new Error(`Expected JSON from backend but received ${contentType || 'unknown content type'} from ${res.url}: ${text.slice(0, 120)}`);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForJob = async (jobId: string): Promise<any> => {
  const deadline = Date.now() + 5 * 60_000;

  while (Date.now() < deadline) {
    const res = await fetch(backendApiUrl(`/jobs/${jobId}`));
    const data = await readJsonResponse(res);
    if (!res.ok || data.success === false) {
      throw new Error(data.message ?? `Job lookup failed with HTTP ${res.status}`);
    }

    const job = data.job;
    if (job?.status === 'succeeded') return job.result;
    if (job?.status === 'failed') throw new Error(job.error ?? `Queued job ${jobId} failed`);

    await sleep(2_000);
  }

  throw new Error(`Queued job ${jobId} did not finish within 5 minutes`);
};

type VeilContrat = Contract<VeilPrivateState, Witnesses<VeilPrivateState>>;
type CircuitKeys = ProvableCircuitId<VeilContrat>;

type ScoreStatus = 'idle' | 'submitting' | 'pending' | 'done' | 'error';

function browserRandomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  window.crypto.getRandomValues(b);
  return b;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return out;
}
function serializeError(err: unknown, depth = 0): string {
  if (depth > 4) return '[max depth]';
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const parts = [`${err.name}: ${err.message || '(no message)'}`];
    const rec = err as unknown as Record<string, unknown>;
    for (const key of ['_tag', 'cause', 'reason', 'details', 'code']) {
      if (rec[key] != null) parts.push(`${key}: ${serializeError(rec[key], depth + 1)}`);
    }
    return parts.join(' | ');
  }
  if (typeof err === 'object') {
    try {
      const rec = err as Record<string, unknown>;
      const parts: string[] = [];
      for (const key of ['_tag', 'message', 'cause', 'reason', 'details', 'code']) {
        if (rec[key] != null) parts.push(`${key}: ${serializeError(rec[key], depth + 1)}`);
      }
      return parts.length > 0 ? parts.join(' | ') : JSON.stringify(err);
    } catch { return String(err); }
  }
  return String(err);
}
type StoredUserSecrets = {
  readonly secreteKey: string;
  readonly ownershipSecret: string;
};

const userSecretsStorageKey = (accountId: string, contractAddress: string): string =>
  `veil-user-secrets:v1:${accountId.toUpperCase()}:${contractAddress.toLowerCase()}`;

function getOrCreateUserSecrets(accountId: string, contractAddress: string): StoredUserSecrets {
  const key = userSecretsStorageKey(accountId, contractAddress);
  const existing = localStorage.getItem(key);
  if (existing) {
    const parsed = JSON.parse(existing) as Partial<StoredUserSecrets>;
    if (typeof parsed.secreteKey === 'string' && typeof parsed.ownershipSecret === 'string') {
      return {
        secreteKey: parsed.secreteKey,
        ownershipSecret: parsed.ownershipSecret,
      };
    }
  }

  const secrets = {
    secreteKey: bytesToHex(browserRandomBytes(32)),
    ownershipSecret: bytesToHex(browserRandomBytes(32)),
  };
  localStorage.setItem(key, JSON.stringify(secrets));
  return secrets;
}

function createInitialPrivateStateFromSecrets(secrets: StoredUserSecrets) {
  return {
    secreteKey: hexToBytes(secrets.secreteKey),
    scoreAmmulations: {},
    creditScores: {},
    ownershipSecret: hexToBytes(secrets.ownershipSecret),
  };
}
function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/* ── Skeleton shimmer ── */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#1a2535]/60 ${className ?? ''}`}
      style={{ backgroundImage: 'linear-gradient(90deg,#1a2535 25%,#243040 50%,#1a2535 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}
    />
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, shimmer }: { label: string; value?: string; sub?: string; shimmer?: boolean }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
      <p className="text-xs uppercase tracking-widest text-[#4a5568]">{label}</p>
      {shimmer ? (
        <Shimmer className="h-7 w-3/4" />
      ) : (
        <p className="text-lg font-bold text-white font-mono break-all leading-tight">{value ?? '—'}</p>
      )}
      {sub && !shimmer && <p className="text-xs text-[#4a5568] mt-0.5">{sub}</p>}
      {shimmer && <Shimmer className="h-3 w-1/2 mt-1" />}
    </div>
  );
}

/* ── Step row ── */
function StepRow({ n, label, done, active }: { n: string; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={done ? { background: '#00e5c0', color: '#062019' } : active ? { background: '#1c242f', border: '1px solid #00e5c0', color: '#00e5c0' } : { background: '#1a2535', color: '#4a5568' }}
      >
        {done ? '✓' : n}
      </span>
      <span className={`text-sm font-medium ${done ? 'text-[#00e5c0]' : active ? 'text-white' : 'text-[#4a5568]'}`}>{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected, isConnecting, walletApi, connect, walletAddress, disconnect } = useWallet();

  const [joinedAddress, setJoinedAddress] = useState<string | null>(null);
  const joinedRef = useRef<{ api: any; coinPublicKey: string; providers: any; accountId: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [userPk, setUserPk] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [hasMinted, setHasMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>('idle');
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [isSyncingScore, setIsSyncingScore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Auto-join once wallet connects, if we have a contract address */
  useEffect(() => {
    if (isConnected && walletApi && CONTRACT_ADDRESS && !joinedAddress && !isJoining) {
      void handleJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, walletApi]);

  const buildProviders = async (walletApi: any, zkBasePath: string) => {
     if (!process.env.NEXT_PUBLIC_PROVE_SERVER_URI) throw new Error('NEXT_PUBLIC_PROVE_SERVER_URI not set');
    const shielded = await walletApi.getShieldedAddresses();
    const account = await walletApi.getUnshieldedAddress();
    const accountId: string = account.unshieldedAddress;
    const zkConfigProvider = new FetchZkConfigProvider<CircuitKeys>(zkBasePath, fetch.bind(window));
    const passwordProvider = () => {
      const accountKey = accountId.toUpperCase();
      const k = `veil-private-state-password:${accountKey}`;
      const legacyKey = `veil-user-pw:${accountKey}`;
      const ex = localStorage.getItem(k) ?? localStorage.getItem(legacyKey);
      if (ex) {
        localStorage.setItem(k, ex);
        return ex;
      }
      const g = `${bytesToHex(browserRandomBytes(32))}!VeIl`;
      localStorage.setItem(k, g);
      return g;
    };
    return {
      providers: {
        proofProvider: httpClientProofProvider(process.env.NEXT_PUBLIC_PROVE_SERVER_URI, zkConfigProvider),
        walletProvider: {
          getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
          getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
          balanceTx: async (tx: any) => {
            const r = await walletApi.balanceUnsealedTransaction(bytesToHex(tx.serialize()));
            return Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(r.tx));
          },
        },
        midnightProvider: {
          submitTx: async (tx: any) => {
            await walletApi.submitTransaction(bytesToHex(tx.serialize()));
            return tx.identifiers()[0];
          },
        },
        publicDataProvider: indexerPublicDataProvider(PREPROD_ENV.indexer, PREPROD_ENV.indexerWS),
        privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: PRIVATE_STATE_STORE_NAME, accountId, privateStoragePasswordProvider: passwordProvider }),
        zkConfigProvider,
      },
      coinPublicKey: parseCoinPublicKeyToHex(shielded.shieldedCoinPublicKey as string, NETWORK_ID),
      accountId,
    };
  };

  const parseScoreAccumulators = (raw: Record<string, any>) => ({
    firstSeenEpoch: BigInt(raw.firstSeenEpoch ?? 0),
    lastEventEpoch: BigInt(raw.lastEventEpoch ?? 0),
    lastComputedEpoch: BigInt(raw.lastComputedEpoch ?? 0),
    onTimeCount: BigInt(raw.onTimeCount ?? 0),
    lateCount: BigInt(raw.lateCount ?? 0),
    weightedRepaymentVolume: BigInt(raw.weightedRepaymentVolume ?? 0),
    liquidationCount: BigInt(raw.liquidationCount ?? 0),
    liquidationPenaltyPoints: BigInt(raw.liquidationPenaltyPoints ?? 0),
    distinctProtocols: BigInt(raw.distinctProtocols ?? 0),
    activeDebtFlag: BigInt(raw.activeDebtFlag ?? 0),
    riskBand: BigInt(raw.riskBand ?? 0),
    mtIndex: BigInt(raw.mtIndex ?? 0),
  });

  const parseCreditScore = (raw: Record<string, any>) => ({
    score: BigInt(raw.score ?? 0),
    durationWeeks: BigInt(raw.durationWeeks ?? 0),
    lastComputedEpoch: BigInt(raw.lastComputedEpoch ?? 0),
    repaymentRatio: BigInt(raw.repaymentRatio ?? 0),
    liquidationCount: BigInt(raw.liquidationCount ?? 0),
    protocolsUsed: BigInt(raw.protocolsUsed ?? 0),
    activeDebt: Boolean(raw.activeDebt),
    mtIndex: BigInt(raw.mtIndex ?? 0),
  });

  const syncScoreFromBackend = async (userPkHex: string): Promise<boolean> => {
    const j = joinedRef.current;
    if (!j) return false;
    const secrets = getOrCreateUserSecrets(j.accountId, j.api.deployedContractAddress);
    setIsSyncingScore(true);
    try {
      const chalRes = await fetch(backendApiUrl('/challenges'), { method: 'POST' });
      const challengeData = await readJsonResponse(chalRes) as { challenge: string; message?: string };
      if (!chalRes.ok) throw new Error(challengeData.message ?? `Challenge request failed with HTTP ${chalRes.status}`);
      const { challenge } = challengeData;

      const queryRes = await fetch(backendApiUrl('/user-data/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPk: userPkHex, challenge, secreteKey: secrets.secreteKey }),
      });

      const data = await readJsonResponse(queryRes) as {
        success: boolean;
        message?: string;
        scoreAccumulators: Record<string, any> | null;
        creditScore: Record<string, any> | null;
      };
      if (!queryRes.ok || !data.success) throw new Error(data.message ?? `Score sync failed with HTTP ${queryRes.status}`);
      if (!data.scoreAccumulators) return false;

      const currentPs = await j.providers.privateStateProvider.get(PRIVATE_STATE_ID);
      if (!currentPs) throw new Error('No local private state available for score sync');
      const parsedAcc = parseScoreAccumulators(data.scoreAccumulators);
      const parsedScore = data.creditScore ? parseCreditScore(data.creditScore) : null;

      const mergedPs = {
        ...currentPs,
        scoreAmmulations: { ...currentPs.scoreAmmulations, [userPkHex]: parsedAcc },
        creditScores: { ...currentPs.creditScores, ...(parsedScore ? { [userPkHex]: parsedScore } : {}) },
      };

      await j.providers.privateStateProvider.set(PRIVATE_STATE_ID, mergedPs);

      if (parsedScore != null) setCreditScore(Number(parsedScore.score));
      setScoreStatus('done');
      console.log('Score synced from backend — accumulator present, credit score:', parsedScore?.score ?? 'not yet computed');
      return true;
    } catch (err) {
      console.warn('Score sync failed:', serializeError(err));
      throw err;
    } finally {
      setIsSyncingScore(false);
    }
  };

  const syncScoreInBackground = (userPkHex: string): void => {
    void syncScoreFromBackend(userPkHex).catch((err) => {
      console.warn('Background score sync failed:', serializeError(err));
    });
  };

  const readLocalCreditScore = async (userPkHex: string) => {
    const j = joinedRef.current;
    if (!j) return;
    try {
      const ps = await j.providers.privateStateProvider.get(PRIVATE_STATE_ID);
      const score = ps?.creditScores?.[userPkHex];
      if (score?.score != null) setCreditScore(Number(score.score));
    } catch { /* best-effort */ }
  };

  const deriveAndCheck = async (api: any, coinPublicKey: string, contractAddress: string) => {
    setIsDeriving(true);
    setError(null);
    console.log('Deriving Veil ID…');
    try {
      const [contractState, privateState] = await firstValueFrom(
        (api.contractState as any).pipe(
          filter(([, ps]: [any, any]) => ps != null && ps.secreteKey != null)
        )
      ) as [any, any];

      const ctx = createCircuitContext(api.deployedContractAddress, coinPublicKey, contractState.data, privateState);
      const contract = new Contract(witness as any);
      const { result: pkBytes } = contract.impureCircuits.Utils_generateUserPk(ctx, privateState.secreteKey);
      const pk = toHex(pkBytes);
      setUserPk(pk);
      console.log('Veil ID derived:', pk);

      const ledgerState = ledger(contractState.data);
      if (ledgerState.LedgerStates_nftRegistry.member(hexToBytes(pk))) {
        setHasMinted(true);
        console.log('PoT NFT active in registry');
        void readLocalCreditScore(pk);
      }

      syncScoreInBackground(pk);
    } catch (err) {
      const msg = serializeError(err);
      // SuperJSON can't deserialize Buffer (stored by the old fromHex call). Clear the stale
      // IndexedDB state, re-join with a fresh plain-Uint8Array private state, and retry once.
      if (msg.includes('unknown typed array')) {
        console.log('Stale private state (Buffer serialization issue) — clearing and re-joining…');
        try {
          await clearPrivateStore();
          await doJoin(contractAddress);
          const j = joinedRef.current!;
          const [cs, ps] = await firstValueFrom(
            (j.api.contractState as any).pipe(
              filter(([, p]: [any, any]) => p != null && p.secreteKey != null)
            )
          ) as [any, any];
          const ctx2 = createCircuitContext(j.api.deployedContractAddress, j.coinPublicKey, cs.data, ps);
          const { result: pkBytes2 } = new Contract(witness as any).impureCircuits.Utils_generateUserPk(ctx2, ps.secreteKey);
          const pk2 = toHex(pkBytes2);
          setUserPk(pk2);
          console.log('Veil ID derived after state reset:', pk2);
          if (ledger(cs.data).LedgerStates_nftRegistry.member(hexToBytes(pk2))) {
            setHasMinted(true);
            void readLocalCreditScore(pk2);
          }
          syncScoreInBackground(pk2);
        } catch (retryErr) {
          console.error('Veil ID derivation failed after state reset:', retryErr);
          setError(`Could not derive Veil ID: ${serializeError(retryErr)}`);
        }
      } else {
        console.error('Veil ID derivation error:', err);
        setError(`Could not derive Veil ID: ${msg}`);
      }
    } finally {
      setIsDeriving(false);
    }
  };

  /* Wipe the IndexedDB store + localStorage password so a fresh join can proceed */
  const clearPrivateStore = async () => {
    if (!walletApi) return;
    try {
      const account = await walletApi.getUnshieldedAddress();
      const pwKey = `veil-user-pw:${(account.unshieldedAddress as string).toUpperCase()}`;
      localStorage.removeItem(pwKey);
    } catch { /* best-effort */ }
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(PRIVATE_STATE_STORE_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  };

  const doJoin = async (addr: string) => {
    syncNetworkId(NETWORK_ID);
    const fullZkPath = new URL('/zk/full', window.location.origin).toString();
    const { providers, coinPublicKey, accountId } = await buildProviders(walletApi!, fullZkPath);
    console.log('Joining contract…');
    const api = await DynamicContractAPI.join({
      providers: providers as any,
      compiledContract: makeFullCompiledContract(fullZkPath),
      contractAddress: addr,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createInitialPrivateStateFromSecrets(getOrCreateUserSecrets(accountId, addr)),
    });
    joinedRef.current = { api, coinPublicKey, providers, accountId };
    setJoinedAddress(api.deployedContractAddress);
    console.log('Connected to', api.deployedContractAddress);
  };

  const handleJoin = async () => {
    const addr = CONTRACT_ADDRESS.trim();
    if (!addr) { setError('NEXT_PUBLIC_CONTRACT_ADDRESS is not set'); return; }
    if (!walletApi) { await connect(); return; }

    setIsJoining(true);
    setError(null);
    setUserPk(null);
    setHasMinted(false);
    setScoreStatus('idle');
    setCreditScore(null);
    joinedRef.current = null;
    setJoinedAddress(null);

    try {
      await doJoin(addr);
    } catch (err) {
      const msg = serializeError(err);
      const isAuthErr = msg.includes('authenticate data') || msg.includes('Unsupported state') || msg.includes('OperationError');
      if (isAuthErr) {
        console.log('Encrypted private state is stale — clearing and retrying…');
        try {
          await clearPrivateStore();
          await doJoin(addr);
        } catch (retryErr) {
          const retryMsg = serializeError(retryErr);
          console.error('Join failed after retry:', retryErr);
          setError(`Join failed: ${retryMsg}`);
        }
      } else {
        console.error('Join failed:', err);
        setError(`Join failed: ${msg}`);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleExportPrivateState = async () => {
    if (!joinedRef.current) return;
    try {
      const { firstValueFrom } = await import('rxjs');
      const { toHex: _toHex } = await import('@midnight-ntwrk/compact-runtime');
      const [, ps] = await firstValueFrom(joinedRef.current.api.contractState as any) as [any, any];
      if (!ps) { setError('No private state to export'); return; }

      const payload = JSON.stringify({
        secreteKey: _toHex(ps.secreteKey),
        ownershipSecret: _toHex(ps.ownershipSecret),
        creditScores: ps.creditScores,
        scoreAmmulations: ps.scoreAmmulations,
        contractAddress: joinedRef.current.api.deployedContractAddress,
        exportedAt: new Date().toISOString(),
      }, (_, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? _toHex(v) : v), 2);

      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veil-private-state-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('Private state exported');
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Export failed: ${serializeError(err)}`);
    }
  };

  const handleCreateScore = async () => {
    if (!userPk) return;
    setScoreStatus('submitting');
    setError(null);
    console.log('Requesting score entry from backend…');
    try {
      const res = await fetch(backendApiUrl('/score-entries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPk }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      if (data.job?.id) {
        setScoreStatus('pending');
        console.log('Score entry queued:', data.job.id);
        const result = await waitForJob(data.job.id);
        setScoreStatus('done');
        console.log('Score entry confirmed on-chain!', result);
        if (userPk) await syncScoreFromBackend(userPk);
        return;
      }
      setScoreStatus('done');
      console.log('Score entry confirmed on-chain!', data.result);
      if (userPk) await syncScoreFromBackend(userPk);
    } catch (err) {
      console.error('Score error:', err);
      setError(`Score entry: ${serializeError(err)}`);
      setScoreStatus('error');
    }
  };

  const handleMint = async () => {
    if (!joinedRef.current || !userPk) return;
    setIsMinting(true);
    setError(null);
    console.log('Minting PoT NFT — generating ZK proof…');
    try {
      const hasBackendScoreState = await syncScoreFromBackend(userPk);
      if (!hasBackendScoreState) {
        throw new Error('No backend score accumulator found for this Veil ID. Create a score entry before minting.');
      }
      await joinedRef.current.api.callTx('NFT_mintPoTNFT');
      setHasMinted(true);
      console.log('PoT NFT minted!');
      if (userPk) void readLocalCreditScore(userPk);
    } catch (err) {
      console.error('Mint failed:', err);
      setError(`Mint failed: ${serializeError(err)}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleRenew = async () => {
    if (!joinedRef.current || !userPk) return;
    setIsRenewing(true);
    setError(null);
    console.log('Reconstructing token for renewal…');
    try {
      const { api } = joinedRef.current;
      const { firstValueFrom } = await import('rxjs');
      const { rawTokenType, encodeRawTokenType } = await import('@midnight-ntwrk/compact-runtime');
      const { ledger: vl } = await import('@veil/veil-contract');

      const [cs] = await firstValueFrom(api.contractState as any) as [any, any];
      const ledger = vl(cs.data);
      const pkBytes = hexToBytes(userPk);
      if (!ledger.LedgerStates_nftRegistry.member(pkBytes)) throw new Error('No PoT NFT found — mint first');

      const meta = ledger.LedgerStates_nftRegistry.lookup(pkBytes);
      const domainSep = new Uint8Array(32);
      'veil:protocol:nft'.split('').forEach((c, i) => { domainSep[i] = c.charCodeAt(0); });

      console.log('Submitting renewal transaction…');
      await api.callTx('NFT_renewPoTNFT', {
        nonce: meta.nonce,
        color: encodeRawTokenType(rawTokenType(domainSep, api.deployedContractAddress)),
        value: BigInt(1),
      });
      console.log('PoT NFT renewed!');
    } catch (err) {
      console.error('Renewal failed:', err);
      setError(`Renewal failed: ${serializeError(err)}`);
    } finally {
      setIsRenewing(false);
    }
  };

  const isBusy = isJoining || isDeriving || isMinting || isRenewing || isSyncingScore || scoreStatus === 'submitting' || scoreStatus === 'pending';
  const isLoading = isJoining;

  /* ─────────── NOT CONNECTED WALL ─────────── */
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#040c12] text-white flex flex-col">
        <nav className="border-b border-[#1a2535] px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-[#00e5c0] font-semibold tracking-wide hover:opacity-80 transition-opacity">
            ← Veil Protocol
          </Link>
          <span className="text-xs text-[#4a5568] uppercase tracking-widest">Dashboard</span>
          <div className="w-24" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 gap-10">
          {/* Hero text */}
          <div className="text-center space-y-3 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">V</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Welcome to Veil</h1>
            <p className="text-sm text-[#4a5568] leading-relaxed">
              Connect your Midnight Lace wallet to access your privacy-preserving credit score and Proof of Trustworthiness NFT.
            </p>
          </div>

          {/* Skeleton cards — blurred preview */}
          <div className="w-full max-w-xl space-y-3 opacity-40 pointer-events-none select-none">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
                <Shimmer className="h-3 w-20" />
                <Shimmer className="h-7 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
              </div>
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
                <Shimmer className="h-3 w-16" />
                <Shimmer className="h-7 w-2/3" />
                <Shimmer className="h-3 w-2/5" />
              </div>
            </div>
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-4/5" />
            </div>
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
              <Shimmer className="h-3 w-20" />
              <div className="flex gap-3 pt-1">
                <Shimmer className="h-8 flex-1 rounded-xl" />
                <Shimmer className="h-8 flex-1 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Connect CTA */}
          <button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="px-8 py-4 rounded-2xl font-semibold text-base disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg shadow-primary/30"
            style={{ background: '#00e5c0', color: '#062019' }}
          >
            {isConnecting ? 'Connecting…' : 'Connect Midnight Wallet'}
          </button>

          <p className="text-xs text-[#4a5568] text-center max-w-xs">
            Requires the Midnight Lace browser extension. Your data stays private — ZK proofs never expose your score.
          </p>
        </div>
      </div>
    );
  }

  /* ─────────── CONNECTED DASHBOARD ─────────── */
  return (
    <div className="min-h-screen bg-[#040c12] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a2535] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-[#00e5c0] font-semibold tracking-wide hover:opacity-80 transition-opacity">
          ← Veil Protocol
        </Link>
        <span className="text-xs text-[#4a5568] uppercase tracking-widest">Dashboard · Preprod</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00e5c0]" />
            <span className="text-xs text-[#4a5568] font-mono hidden sm:block truncate max-w-35">
              {walletAddress ?? 'connected'}
            </span>
          </div>
          <button
            onClick={disconnect}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#2d3748] text-[#a0aec0] hover:text-white hover:border-[#4a5568] transition-colors"
          >
            Disconnect
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Your Veil Dashboard</h1>
          <p className="text-sm text-[#4a5568]">
            {CONTRACT_ADDRESS
              ? `Contract: ${shortAddr(CONTRACT_ADDRESS)}`
              : 'Set NEXT_PUBLIC_CONTRACT_ADDRESS to auto-connect'}
          </p>
        </div>

        {/* Inline error banner */}
        {error && (
          <div className="rounded-xl px-4 py-3 flex items-start justify-between gap-3" style={{ background: '#1a0808', border: '1px solid #7f1d1d' }}>
            <span className="text-xs font-mono text-red-400 leading-relaxed">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 text-red-700 hover:text-red-400 transition-colors text-sm leading-none">✕</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Veil ID"
            value={userPk ? `${userPk.slice(0, 10)}…${userPk.slice(-6)}` : undefined}
            sub={userPk ? 'User public key' : joinedAddress ? 'Click Generate below' : 'Join contract first'}
            shimmer={isDeriving}
          />
          <StatCard
            label="Credit Score"
            value={
              creditScore != null ? String(creditScore)
                : isSyncingScore ? 'Syncing…'
                : scoreStatus === 'done' ? 'Entry confirmed'
                : scoreStatus === 'pending' ? 'Pending…'
                : '—'
            }
            sub={
              creditScore != null ? 'Computed on-chain'
                : scoreStatus === 'done' ? 'Accumulator synced — mint to compute score'
                : 'Submit score entry to backend'
            }
            shimmer={isLoading || isSyncingScore}
          />
          <StatCard
            label="PoT NFT"
            value={hasMinted ? 'Active' : joinedAddress ? 'Not minted' : '—'}
            sub={hasMinted ? 'Proof of Trustworthiness' : 'Mint after score entry'}
            shimmer={isLoading && !joinedAddress}
          />
        </div>

        {/* Progress steps */}
        <div className="rounded-2xl p-5" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
          <p className="text-xs uppercase tracking-widest text-[#4a5568] mb-4">Progress</p>
          <div className="space-y-3">
            <StepRow n="1" label="Connect wallet" done={isConnected} active={!isConnected} />
            <StepRow n="2" label="Join protocol contract" done={!!joinedAddress} active={isConnected && !joinedAddress} />
            <StepRow n="3" label="Generate Veil ID" done={!!userPk} active={!!joinedAddress && !userPk} />
            <StepRow n="4" label="Create credit score entry" done={scoreStatus === 'done'} active={!!userPk && scoreStatus === 'idle'} />
            <StepRow n="5" label="Mint Proof of Trustworthiness NFT" done={hasMinted} active={scoreStatus === 'done' && !hasMinted} />
          </div>
        </div>

        {/* Action panel */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>

          {/* Join / Status */}
          {!joinedAddress ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Join Protocol Contract</p>
                <p className="text-xs text-[#4a5568]">
                  {CONTRACT_ADDRESS
                    ? `Auto-connecting to ${shortAddr(CONTRACT_ADDRESS)}`
                    : 'No NEXT_PUBLIC_CONTRACT_ADDRESS set — enter one below'}
                </p>
              </div>
              {!CONTRACT_ADDRESS && (
                <input
                  id="contract-addr-input"
                  type="text"
                  placeholder="Paste contract address…"
                  className="w-full rounded-xl px-3 py-2 bg-[#040c12] text-white text-sm border border-[#1a2535] focus:outline-none focus:border-[#00e5c0] placeholder-[#2d3748]"
                  onBlur={(e) => {
                    (window as any).__manualContractAddr = e.target.value;
                  }}
                />
              )}
              <button
                onClick={() => void handleJoin()}
                disabled={isBusy}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                style={{ background: '#00e5c0', color: '#062019' }}
              >
                {isJoining ? 'Joining contract…' : 'Join Contract'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-widest text-[#4a5568]">Connected Contract</p>
                <p className="text-xs font-mono text-[#00e5c0]">{joinedAddress}</p>
              </div>
              <button
                onClick={() => { joinedRef.current = null; setJoinedAddress(null); setUserPk(null); setHasMinted(false); setScoreStatus('idle'); setCreditScore(null); setError(null); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#2d3748] text-[#a0aec0] hover:text-white transition-colors shrink-0 ml-4"
              >
                Switch
              </button>
            </div>
          )}

          {joinedAddress && <div style={{ borderTop: '1px solid #1a2535' }} />}

          {/* Veil ID section */}
          {joinedAddress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Veil ID</p>
                {userPk && (
                  <button
                    onClick={() => void handleExportPrivateState()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#2d3748] text-[#a0aec0] hover:text-[#00e5c0] hover:border-[#00e5c0]/40 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 1v9m0 0L5 7m3 3l3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Export Keys
                  </button>
                )}
              </div>
              {isDeriving ? (
                <div className="space-y-2">
                  <Shimmer className="h-5 w-full" />
                  <Shimmer className="h-3 w-2/3" />
                </div>
              ) : userPk ? (
                <div className="rounded-xl px-4 py-3 bg-[#040c12] border border-[#1a2535]">
                  <p className="text-xs text-[#4a5568] mb-1">User Public Key</p>
                  <p className="text-xs font-mono text-[#00e5c0] break-all">{userPk}</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const j = joinedRef.current;
                    if (j) void deriveAndCheck(j.api, j.coinPublicKey, j.api.deployedContractAddress);
                  }}
                  disabled={isBusy}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                  style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
                >
                  Generate Veil ID
                </button>
              )}
            </div>
          )}

          {userPk && <div style={{ borderTop: '1px solid #1a2535' }} />}

          {/* Score entry */}
          {userPk && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">Credit Score Entry</p>
                  <p className="text-xs text-[#4a5568]">Registers your Veil ID with the backend and creates an on-chain accumulator.</p>
                </div>
                {scoreStatus === 'done' && (
                  <span className="shrink-0 text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#0a1f16', color: '#00e5c0' }}>Confirmed</span>
                )}
              </div>

              {scoreStatus !== 'done' && (
                <button
                  onClick={() => void handleCreateScore()}
                  disabled={isBusy}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                  style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
                >
                  {scoreStatus === 'submitting' ? 'Submitting to chain…'
                    : scoreStatus === 'error' ? 'Retry Score Entry'
                    : 'Create Score Entry'}
                </button>
              )}
            </div>
          )}

          {userPk && <div style={{ borderTop: '1px solid #1a2535' }} />}

          {/* NFT actions */}
          {userPk && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Proof of Trustworthiness NFT</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => void handleMint()}
                  disabled={isBusy || scoreStatus !== 'done' || hasMinted}
                  className="py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                  style={{ background: hasMinted ? '#0a1f16' : '#00e5c0', color: hasMinted ? '#00e5c0' : '#062019', border: hasMinted ? '1px solid #00e5c033' : 'none' }}
                >
                  {isMinting ? 'Minting…' : hasMinted ? 'NFT Active' : 'Mint PoT NFT'}
                </button>
                <button
                  onClick={() => void handleRenew()}
                  disabled={isBusy || !hasMinted}
                  className="py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                  style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
                >
                  {isRenewing ? 'Renewing…' : 'Renew NFT'}
                </button>
              </div>
              {scoreStatus !== 'done' && !hasMinted && (
                <p className="text-xs text-[#4a5568]">Create a score entry before minting.</p>
              )}
            </div>
          )}
        </div>

      </main>

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
