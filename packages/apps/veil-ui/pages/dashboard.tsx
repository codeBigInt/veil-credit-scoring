import { useState, useRef } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { syncNetworkId } from '@/utils/network-id';
import { PRIVATE_STATE_ID, makeFullCompiledContract } from '@/contract-api-utils';
import { fromHex, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';

const NETWORK_ID = 'preprod';
const PREPROD_ENV = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
};
const BACKEND_URL = 'http://localhost:8081';

type LogEntry = { ts: string; msg: string; kind: 'info' | 'success' | 'error' };
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

function createInitialPrivateState(secreteKey: Uint8Array) {
  return {
    secreteKey,
    scoreAmmulations: {},
    creditScores: {},
    ownershipSecret: fromHex(sampleSigningKey()),
  };
}

export default function DashboardPage() {
  const { isConnected, isConnecting, walletApi, connect, walletAddress, disconnect } = useWallet();

  const [contractInput, setContractInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [joinedAddress, setJoinedAddress] = useState<string | null>(null);
  const joinedRef = useRef<{ api: any; providers: any; coinPublicKey: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const [userPk, setUserPk] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);

  const [hasMinted, setHasMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>('idle');
  const [scoreJobId, setScoreJobId] = useState<string | null>(null);

  const addLog = (msg: string, kind: LogEntry['kind'] = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { ts, msg, kind }]);
  };

  const buildProviders = async (walletApi: any, zkBasePath: string) => {
    const [
      { FetchZkConfigProvider },
      { httpClientProofProvider },
      { indexerPublicDataProvider },
      { levelPrivateStateProvider },
      { Transaction },
    ] = await Promise.all([
      import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider'),
      import('@midnight-ntwrk/midnight-js-http-client-proof-provider'),
      import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
      import('@midnight-ntwrk/midnight-js-level-private-state-provider'),
      import('@midnight-ntwrk/ledger-v8'),
    ]);

    if (process.env.NEXT_PUBLIC_PROVE_SERVER_URI == undefined) throw new Error('Proving url not found');

    const shielded = await walletApi.getShieldedAddresses();
    const account = await walletApi.getUnshieldedAddress();
    const resolvedProofServer = process.env.NEXT_PUBLIC_PROVE_SERVER_URI;
    const zkConfigProvider = new FetchZkConfigProvider(zkBasePath, fetch.bind(window));
    const accountId: string = account.unshieldedAddress;

    const privateStoragePasswordProvider = () => {
      const key = `veil-user-state-password:${accountId.toUpperCase()}`;
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const generated = `${bytesToHex(browserRandomBytes(32))}!$&VeIlDash`;
      window.localStorage.setItem(key, generated);
      return generated;
    };

    const providers = {
      proofProvider: httpClientProofProvider(resolvedProofServer, zkConfigProvider),
      walletProvider: {
        getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
        getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
        balanceTx: async (tx: any) => {
          const received = await walletApi.balanceUnsealedTransaction(bytesToHex(tx.serialize()));
          return Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(received.tx));
        },
      },
      midnightProvider: {
        submitTx: async (tx: any) => {
          await walletApi.submitTransaction(bytesToHex(tx.serialize()));
          return tx.identifiers()[0];
        },
      },
      publicDataProvider: indexerPublicDataProvider(PREPROD_ENV.indexer, PREPROD_ENV.indexerWS),
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'veil-user-private-state',
        accountId,
        privateStoragePasswordProvider,
      }),
      zkConfigProvider,
    };

    return { providers, coinPublicKey: shielded.shieldedCoinPublicKey as string };
  };

  const checkAndDeriveId = async (api: any, coinPublicKey: string, contractAddress: string) => {
    setIsDeriving(true);
    addLog('Deriving Veil ID from private state...');

    try {
      const { firstValueFrom } = await import('rxjs');
      const { createCircuitContext, toHex: _toHex } = await import('@midnight-ntwrk/compact-runtime');
      const { Contract: VeilContractClass, witness: veilWitness, ledger: veilLedger } = await import('@veil/veil-contract');

      const [contractState, privateState] = await firstValueFrom(api.contractState);
      if (!privateState?.secreteKey) throw new Error('Private state not initialized');

      const ctx = createCircuitContext(
        contractAddress,
        coinPublicKey,
        contractState.data,
        privateState,
      );

      const contract = new VeilContractClass(veilWitness as any);
      const { result: userPkBytes } = contract.impureCircuits.Utils_generateUserPk(ctx, privateState.secreteKey);
      const pk = _toHex(userPkBytes);
      setUserPk(pk);
      addLog(`Veil ID derived: ${pk.slice(0, 12)}...${pk.slice(-8)}`, 'success');

      const currentLedger = veilLedger(contractState.data);
      if (currentLedger.LedgerStates_nftRegistry.member(hexToBytes(pk))) {
        setHasMinted(true);
        addLog('Existing PoT NFT found in registry', 'success');
      } else {
        addLog('No PoT NFT found yet — mint one after creating your score');
      }
    } catch (err) {
      addLog(`Veil ID derivation failed: ${serializeError(err)}`, 'error');
    } finally {
      setIsDeriving(false);
    }
  };

  const handleJoinContract = async () => {
    if (!walletApi) { await connect(); return; }
    if (!contractInput.trim()) { addLog('Enter a contract address first', 'error'); return; }

    setIsJoining(true);
    setLogs([]);
    setUserPk(null);
    setHasMinted(false);
    setScoreStatus('idle');
    setScoreJobId(null);
    joinedRef.current = null;
    setJoinedAddress(null);

    try {
      syncNetworkId(NETWORK_ID);
      const { DynamicContractAPI } = await import('nite-api');
      const fullZkPath = new URL('/zk/full', window.location.origin).toString();
      const { providers, coinPublicKey } = await buildProviders(walletApi, fullZkPath);
      const fullCompiledContract = makeFullCompiledContract(fullZkPath);

      addLog('Joining contract...');
      const api = await DynamicContractAPI.join({
        providers: providers as any,
        compiledContract: fullCompiledContract,
        contractAddress: contractInput.trim(),
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createInitialPrivateState(browserRandomBytes(32)),
      });

      joinedRef.current = { api, providers, coinPublicKey };
      setJoinedAddress(api.deployedContractAddress);
      addLog(`Joined: ${api.deployedContractAddress}`, 'success');

      await checkAndDeriveId(api, coinPublicKey, api.deployedContractAddress);
    } catch (err) {
      addLog(`Join failed: ${serializeError(err)}`, 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateScore = async () => {
    if (!userPk) { addLog('Derive Veil ID first', 'error'); return; }

    setScoreStatus('submitting');
    addLog('Submitting credit score request to backend...');

    try {
      const res = await fetch(`${BACKEND_URL}/score-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const jobId: string = data.id ?? data.jobId;
      if (!jobId) throw new Error('No job ID returned from backend');
      setScoreJobId(jobId);
      setScoreStatus('pending');
      addLog(`Job enqueued (id: ${jobId}), waiting for confirmation...`);

      await pollJob(jobId);
    } catch (err) {
      addLog(`Score creation failed: ${serializeError(err)}`, 'error');
      setScoreStatus('error');
    }
  };

  const pollJob = async (jobId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`${BACKEND_URL}/jobs/${jobId}`);
        const data = await res.json();
        if (data.status === 'done' || data.result !== undefined) {
          setScoreStatus('done');
          addLog('Credit score entry created on-chain!', 'success');
          return;
        }
        if (data.status === 'failed' || data.error) {
          throw new Error(data.error || 'Job failed');
        }
      } catch (e) {
        if (i > 5) throw e;
      }
    }
    addLog('Job polling timed out', 'error');
    setScoreStatus('error');
  };

  const handleMintNFT = async () => {
    if (!joinedRef.current) { addLog('Join a contract first', 'error'); return; }

    setIsMinting(true);
    addLog('Minting PoT NFT — generating ZK proof (this may take a minute)...');

    try {
      const { api } = joinedRef.current;
      await api.callTx('NFT_mintPoTNFT');
      setHasMinted(true);
      addLog('PoT NFT minted successfully!', 'success');
    } catch (err) {
      addLog(`Mint failed: ${serializeError(err)}`, 'error');
    } finally {
      setIsMinting(false);
    }
  };

  const handleRenewNFT = async () => {
    if (!joinedRef.current || !userPk) { addLog('Join contract and derive Veil ID first', 'error'); return; }

    setIsRenewing(true);
    addLog('Reconstructing PoT NFT token for renewal...');

    try {
      const { api } = joinedRef.current;
      const { firstValueFrom } = await import('rxjs');
      const { rawTokenType, encodeRawTokenType } = await import('@midnight-ntwrk/compact-runtime');
      const { ledger: veilLedger } = await import('@veil/veil-contract');

      const [contractState] = await firstValueFrom(api.contractState);
      const currentLedger = veilLedger(contractState.data);
      const userPkBytes = hexToBytes(userPk);

      if (!currentLedger.LedgerStates_nftRegistry.member(userPkBytes)) {
        throw new Error('No existing PoT NFT found for this Veil ID. Mint one first.');
      }

      const nftMetadata = currentLedger.LedgerStates_nftRegistry.lookup(userPkBytes);

      const domainSep = new Uint8Array(32);
      const domStr = 'veil:protocol:nft';
      for (let i = 0; i < domStr.length; i++) domainSep[i] = domStr.charCodeAt(i);

      const token = {
        nonce: nftMetadata.nonce,
        color: encodeRawTokenType(rawTokenType(domainSep, api.deployedContractAddress)),
        value: 1n,
      };

      addLog('Submitting NFT renewal transaction...');
      await api.callTx('NFT_renewPoTNFT', token);
      addLog('PoT NFT renewed successfully!', 'success');
    } catch (err) {
      addLog(`Renewal failed: ${serializeError(err)}`, 'error');
    } finally {
      setIsRenewing(false);
    }
  };

  const isBusy = isJoining || isDeriving || isMinting || isRenewing || scoreStatus === 'submitting' || scoreStatus === 'pending';

  const statusDot = (active: boolean, done: boolean) =>
    done ? '●' : active ? '○' : '·';

  return (
    <div className="min-h-screen bg-[#040c12] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a2535] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-[#00e5c0] font-semibold tracking-wide hover:opacity-80 transition-opacity">
          ← Veil Protocol
        </Link>
        <span className="text-xs text-[#4a5568] uppercase tracking-widest">User Dashboard</span>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#4a5568] font-mono truncate max-w-[160px]">
              {walletAddress ?? 'connected'}
            </span>
            <button
              onClick={disconnect}
              className="text-xs px-3 py-1 rounded-lg border border-[#2d3748] text-[#a0aec0] hover:text-white transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50 transition-colors"
            style={{ background: '#00e5c0', color: '#062019' }}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Veil Protocol Dashboard</h1>
          <p className="text-sm text-[#4a5568]">
            Connect your wallet, join a deployed contract, create your credit score, and manage your PoT NFT.
          </p>
        </div>

        {/* Step 1: Join Contract */}
        <section className="rounded-2xl p-6 space-y-4" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
          <div className="flex items-center gap-2">
            <span className="text-[#00e5c0] text-xs font-mono">01</span>
            <p className="text-sm font-semibold text-white">Join Contract</p>
            {joinedAddress && <span className="ml-auto text-xs text-[#00e5c0]">✓ Joined</span>}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-[#4a5568]">Contract Address</label>
            <input
              type="text"
              value={contractInput}
              onChange={(e) => setContractInput(e.target.value)}
              placeholder="Paste deployed contract address..."
              disabled={isJoining || !!joinedAddress}
              className="w-full rounded-xl px-3 py-2 bg-[#040c12] text-white text-sm border border-[#1a2535] focus:outline-none focus:border-[#00e5c0] placeholder-[#2d3748] disabled:opacity-50"
            />
          </div>

          {joinedAddress ? (
            <div className="p-3 rounded-xl bg-[#040c12] border border-[#1a2535]">
              <p className="text-xs uppercase tracking-widest text-[#4a5568] mb-1">Joined Contract</p>
              <p className="text-xs font-mono text-[#00e5c0] break-all">{joinedAddress}</p>
            </div>
          ) : (
            <button
              onClick={() => void handleJoinContract()}
              disabled={isBusy || (!isConnected && isConnecting)}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: '#00e5c0', color: '#062019' }}
            >
              {isJoining
                ? 'Joining...'
                : !isConnected
                ? 'Connect Wallet & Join'
                : 'Join Contract'}
            </button>
          )}

          {joinedAddress && (
            <button
              onClick={() => {
                joinedRef.current = null;
                setJoinedAddress(null);
                setUserPk(null);
                setHasMinted(false);
                setScoreStatus('idle');
                setScoreJobId(null);
                setLogs([]);
              }}
              className="w-full py-2 rounded-xl text-xs text-[#a0aec0] hover:text-white transition-colors border border-[#2d3748]"
            >
              Switch Contract
            </button>
          )}
        </section>

        {/* Step 2: Veil ID */}
        {joinedAddress && (
          <section className="rounded-2xl p-6 space-y-4" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <div className="flex items-center gap-2">
              <span className="text-[#00e5c0] text-xs font-mono">02</span>
              <p className="text-sm font-semibold text-white">Your Veil ID</p>
              {userPk && <span className="ml-auto text-xs text-[#00e5c0]">✓ Derived</span>}
            </div>

            {isDeriving ? (
              <p className="text-xs text-[#4a5568] animate-pulse">Deriving Veil ID from private state...</p>
            ) : userPk ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-[#4a5568]">User Public Key</p>
                <div className="p-3 rounded-xl bg-[#040c12] border border-[#1a2535]">
                  <p className="text-xs font-mono text-[#00e5c0] break-all">{userPk}</p>
                </div>
                <p className="text-xs text-[#4a5568]">
                  This is your on-chain identity. Share with protocol issuers to receive score events.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#4a5568]">Veil ID will be derived automatically after joining.</p>
            )}
          </section>
        )}

        {/* Step 3: Credit Score */}
        {userPk && (
          <section className="rounded-2xl p-6 space-y-4" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <div className="flex items-center gap-2">
              <span className="text-[#00e5c0] text-xs font-mono">03</span>
              <p className="text-sm font-semibold text-white">Create Credit Score</p>
              {scoreStatus === 'done' && <span className="ml-auto text-xs text-[#00e5c0]">✓ Created</span>}
            </div>

            <p className="text-xs text-[#4a5568]">
              Request the backend to create an on-chain score entry for your Veil ID. This enables NFT minting.
            </p>

            {scoreStatus === 'done' ? (
              <div className="p-3 rounded-xl text-xs font-medium" style={{ background: '#0a1f16', color: '#00e5c0', border: '1px solid #00e5c033' }}>
                Score entry confirmed on-chain.
              </div>
            ) : (
              <button
                onClick={() => void handleCreateScore()}
                disabled={isBusy || scoreStatus === 'done'}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
              >
                {scoreStatus === 'submitting'
                  ? 'Submitting...'
                  : scoreStatus === 'pending'
                  ? `Waiting for job ${scoreJobId ? `#${scoreJobId.slice(0, 8)}` : ''}...`
                  : 'Create Score Entry'}
              </button>
            )}

            {scoreStatus === 'error' && (
              <button
                onClick={() => { setScoreStatus('idle'); setScoreJobId(null); }}
                className="w-full py-2 rounded-xl text-xs text-[#a0aec0] hover:text-white transition-colors border border-[#2d3748]"
              >
                Retry
              </button>
            )}
          </section>
        )}

        {/* Step 4: Mint PoT NFT */}
        {userPk && (
          <section className="rounded-2xl p-6 space-y-4" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <div className="flex items-center gap-2">
              <span className="text-[#00e5c0] text-xs font-mono">04</span>
              <p className="text-sm font-semibold text-white">Mint Proof of Trustworthiness NFT</p>
              {hasMinted && <span className="ml-auto text-xs text-[#00e5c0]">✓ Minted</span>}
            </div>

            <p className="text-xs text-[#4a5568]">
              Mint a shielded PoT NFT that represents your credit score on-chain. Requires a confirmed score entry.
            </p>

            {!hasMinted ? (
              <button
                onClick={() => void handleMintNFT()}
                disabled={isBusy || scoreStatus !== 'done'}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                style={{ background: '#00e5c0', color: '#062019' }}
              >
                {isMinting ? 'Minting (generating ZK proof)...' : 'Mint PoT NFT'}
              </button>
            ) : (
              <div className="p-3 rounded-xl text-xs font-medium" style={{ background: '#0a1f16', color: '#00e5c0', border: '1px solid #00e5c033' }}>
                PoT NFT exists in your wallet.
              </div>
            )}

            {scoreStatus !== 'done' && !hasMinted && (
              <p className="text-xs text-[#4a5568]">
                Complete Step 3 (Create Score Entry) before minting.
              </p>
            )}
          </section>
        )}

        {/* Step 5: Renew PoT NFT */}
        {hasMinted && (
          <section className="rounded-2xl p-6 space-y-4" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <div className="flex items-center gap-2">
              <span className="text-[#00e5c0] text-xs font-mono">05</span>
              <p className="text-sm font-semibold text-white">Renew PoT NFT</p>
            </div>

            <p className="text-xs text-[#4a5568]">
              Renew your existing PoT NFT. Burns your current token and mints a fresh one with updated score metadata.
            </p>

            <button
              onClick={() => void handleRenewNFT()}
              disabled={isBusy}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
            >
              {isRenewing ? 'Renewing (generating ZK proof)...' : 'Renew PoT NFT'}
            </button>
          </section>
        )}

        {/* Activity Log */}
        {logs.length > 0 && (
          <section className="rounded-2xl p-4 space-y-1" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <p className="text-xs uppercase tracking-widest text-[#4a5568] mb-3">Activity Log</p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {logs.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono">
                  <span className="text-[#2d3748] shrink-0">{entry.ts}</span>
                  <span
                    className={
                      entry.kind === 'success'
                        ? 'text-[#00e5c0]'
                        : entry.kind === 'error'
                        ? 'text-red-400'
                        : 'text-[#a0aec0]'
                    }
                  >
                    {entry.msg}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
