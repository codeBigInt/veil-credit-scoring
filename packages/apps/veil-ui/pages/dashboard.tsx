import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import MidnightWalletSelector from '@/components/midnight-wallet-selector';
import { useWallet } from '@/context/WalletContext';
import { syncNetworkId } from '@/utils/network-id';
import { PRIVATE_STATE_ID, makeFullCompiledContract } from '@/contract-api-utils';
import { createCircuitContext, toHex } from '@midnight-ntwrk/compact-runtime';
import { DynamicContractAPI } from 'nite-api';
import { Contract, VeilPrivateState, witness, Witnesses } from '@veil/veil-contract';
import { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { parseCoinPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import { filter, firstValueFrom } from 'rxjs';
import { ccc as cccConnector } from '@ckb-ccc/connector-react';
import { spore } from '@ckb-ccc/spore';
import { Check, Copy, ExternalLink, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID!;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001/api/v1';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';
const CKB_EXPLORER_URL = process.env.NEXT_PUBLIC_CKB_EXPLORER_URL ?? 'https://pudge.explorer.nervos.org';
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
type CkbMintStatus = 'idle' | 'minting' | 'recording' | 'done' | 'error';

type CkbMintIntent = {
  readonly contentType: 'application/json';
  readonly content: {
    readonly protocol: 'Veil';
    readonly objectType: 'VeilIdentity';
    readonly veilIdHash: string;
    readonly ownerCkbLockHash: string;
    readonly midnightNetwork: string;
    readonly midnightContract: string;
    readonly version: '1';
  };
  readonly lockScript: {
    readonly codeHash: string;
    readonly hashType: string;
    readonly args: string;
  };
};

type CreditDecision = {
  readonly approved: boolean;
  readonly scoreBand: 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum';
  readonly maxLtvBps: number;
  readonly riskPremiumBps: number;
  readonly hasCreditScore: boolean;
  readonly reason: string;
  readonly veilIdHash: string;
  readonly validAt: string;
};

type ScoreEntryLookup = {
  readonly success: boolean;
  readonly message?: string;
  readonly veilIdHash?: string;
  readonly scoreEntry?: {
    readonly exists: boolean;
    readonly hasAccumulator: boolean;
    readonly hasCreditScore: boolean;
  };
  readonly ckbDob?: ExistingCkbDob;
  readonly ckbMintIntent?: CkbMintIntent;
};

type ExistingCkbDob = {
  readonly veilIdHash: string;
  readonly sporeId: string;
  readonly txHash: string;
  readonly midnightContractAddress: string;
  readonly createdAt: string;
};

type MintIntentResponse = {
  readonly success: boolean;
  readonly message?: string;
  readonly alreadyMinted?: boolean;
  readonly dob?: ExistingCkbDob;
  readonly intent?: CkbMintIntent;
};

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
async function sha256Hex(hex: string): Promise<string> {
  const bytes = hexToBytes(hex);
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return `0x${bytesToHex(new Uint8Array(digest))}`;
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
};

type CompletedDashboardFlowCache = {
  readonly version: 1;
  readonly accountId: string;
  readonly contractAddress: string;
  readonly userPk: string;
  readonly veilIdHash: string;
  readonly ckbSporeId: string;
  readonly ckbTxHash: string;
  readonly ckbAddress?: string;
  readonly completedAt: string;
};

const userSecretsStorageKey = (accountId: string, contractAddress: string): string =>
  `veil-user-secrets:v1:${accountId.toUpperCase()}:${contractAddress.toLowerCase()}`;

const completedFlowStorageKey = (accountId: string, contractAddress: string): string =>
  `veil-dashboard-completed-flow:v1:${accountId.toUpperCase()}:${contractAddress.toLowerCase()}`;

function readCompletedFlowCache(accountId: string, contractAddress: string): CompletedDashboardFlowCache | null {
  const raw = localStorage.getItem(completedFlowStorageKey(accountId, contractAddress));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CompletedDashboardFlowCache>;
    if (
      parsed.version === 1 &&
      typeof parsed.userPk === 'string' &&
      typeof parsed.veilIdHash === 'string' &&
      typeof parsed.ckbSporeId === 'string' &&
      typeof parsed.ckbTxHash === 'string'
    ) {
      return parsed as CompletedDashboardFlowCache;
    }
  } catch {
    localStorage.removeItem(completedFlowStorageKey(accountId, contractAddress));
  }

  return null;
}

function writeCompletedFlowCache(cache: CompletedDashboardFlowCache): void {
  localStorage.setItem(completedFlowStorageKey(cache.accountId, cache.contractAddress), JSON.stringify(cache));
}

function getOrCreateUserSecrets(accountId: string, contractAddress: string): StoredUserSecrets {
  const key = userSecretsStorageKey(accountId, contractAddress);
  const existing = localStorage.getItem(key);
  if (existing) {
    const parsed = JSON.parse(existing) as Partial<StoredUserSecrets>;
    if (typeof parsed.secreteKey === 'string') {
      return {
        secreteKey: parsed.secreteKey,
      };
    }
  }

  const secrets = {
    secreteKey: bytesToHex(browserRandomBytes(32)),
  };
  localStorage.setItem(key, JSON.stringify(secrets));
  return secrets;
}

function createInitialPrivateStateFromSecrets(secrets: StoredUserSecrets) {
  return {
    secreteKey: hexToBytes(secrets.secreteKey),
    scoreAmmulations: {},
    creditScores: {},
  };
}
function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

const explorerUrl = (path: string): string =>
  `${CKB_EXPLORER_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      aria-label={label}
      title={label}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

function DetailRow({
  label,
  value,
  muted = false,
  copy = true,
}: {
  label: string;
  value: string;
  muted?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="rounded-sm border border-border/20 bg-background/70 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="section-label">{label}</p>
        {copy && <CopyButton value={value} label={`Copy ${label}`} />}
      </div>
      <p className={`break-all text-xs leading-relaxed ${muted ? 'text-foreground/60' : 'text-primary'}`}>{value}</p>
    </div>
  );
}

function VeilDobNftCard({
  sporeId,
  txHash,
  veilIdHash,
  ckbAddress,
}: {
  sporeId: string;
  txHash?: string | null;
  veilIdHash?: string | null;
  ckbAddress?: string | null;
}) {
  const [sporeCopied, setSporeCopied] = useState(false);
  const seed = (veilIdHash ?? sporeId).replace(/^0x/, '').padEnd(64, '0');
  const hueA = parseInt(seed.slice(0, 6), 16) % 360;
  const hueB = parseInt(seed.slice(6, 12), 16) % 360;
  const cells = Array.from({ length: 24 }, (_, index) => {
    const byte = parseInt(seed.slice((index * 2) % seed.length, ((index * 2) % seed.length) + 2), 16);
    return {
      opacity: 0.18 + (byte % 7) * 0.09,
      borderColor: byte % 2 === 0 ? `hsl(${hueA} 78% 58% / 0.5)` : `hsl(${hueB} 78% 58% / 0.5)`,
      background: byte % 3 === 0 ? `hsl(${hueA} 78% 58% / 0.18)` : `hsl(${hueB} 78% 58% / 0.12)`,
    };
  });

  return (
    <div className="overflow-hidden rounded-sm border border-primary/40 bg-card">
      <div className="grid gap-0 md:grid-cols-[minmax(220px,0.85fr)_1fr]">
        <div
          className="relative min-h-72 border-b border-border/20 p-5 md:border-b-0 md:border-r"
          style={{
            borderColor: 'color-mix(in oklch, var(--color-primary) 35%, var(--color-border))',
            background: `linear-gradient(135deg, hsl(${hueA} 78% 14%), oklch(0.1 0 0) 52%, hsl(${hueB} 78% 16%))`,
          }}
        >
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-sm border border-white/15 bg-black/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
            <ShieldCheck size={13} aria-hidden="true" />
            Minted DOB
          </div>
          <div className="grid h-full grid-cols-4 gap-2 pt-14">
            {cells.map((cell, index) => (
              <div
                key={index}
                className="rounded-sm border"
                style={{
                  opacity: cell.opacity,
                  borderColor: cell.borderColor,
                  background: cell.background,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-x-5 bottom-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">Veil Identity</p>
            <p className="mt-.5 text-2xl font-black uppercase tracking-tight text-white">Spore DOB</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="section-label mb-1">Public Identity Anchor</p>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Veil Identity DOB</h3>
            </div>
            <span className="w-fit rounded-sm px-2.5 py-1 text-xs font-black uppercase tracking-wide" style={{ background: 'color-mix(in oklch, var(--color-primary) 18%, transparent)', color: 'var(--color-primary)' }}>
              Soulbound
            </span>
          </div>

          <div className="grid gap-3">
            <DetailRow label="Spore ID" value={sporeId} />
            {veilIdHash && <DetailRow label="Veil ID Hash" value={veilIdHash} muted />}
            {ckbAddress && <DetailRow label="Owner CKB Address" value={ckbAddress} muted />}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {txHash && (
              <a
                href={explorerUrl(`/transaction/${txHash}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border border-border/30 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                View Transaction
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(sporeId);
                setSporeCopied(true);
                window.setTimeout(() => setSporeCopied(false), 1400);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-xs font-black uppercase tracking-wide transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              {sporeCopied ? 'Copied' : 'Copy Spore ID'}
              {sporeCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton shimmer ── */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-sm ${className ?? ''}`}
      style={{ backgroundImage: 'linear-gradient(90deg,oklch(0.17 0 0) 25%,oklch(0.22 0 0) 50%,oklch(0.17 0 0) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}
    />
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, shimmer }: { label: string; value?: string; sub?: string; shimmer?: boolean }) {
  return (
    <div className="flat-card rounded-sm p-5 flex flex-col gap-2">
      <p className="section-label">{label}</p>
      {shimmer ? (
        <Shimmer className="h-7 w-3/4" />
      ) : (
        <p className="text-lg font-bold text-foreground break-all leading-tight">{value ?? '—'}</p>
      )}
      {sub && !shimmer && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {shimmer && <Shimmer className="h-3 w-1/2 mt-1" />}
    </div>
  );
}

/* ── Step row ── */
function StepRow({ n, label, done, active, loading }: { n: string; label: string; done?: boolean; active?: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold shrink-0"
        style={done ? { background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' } : active ? { background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' } : { background: 'oklch(0.18 0 0)', color: 'oklch(0.5 0 0)' }}
      >
        {done ? '✓' : loading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : n}
      </span>
      <span className={`text-sm font-medium ${done ? 'text-primary' : active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected, isConnecting, walletApi, connect, walletAddress, walletName, selectedWalletId, disconnect } = useWallet();
  const ckb = cccConnector.useCcc();
  const ckbSigner = cccConnector.useSigner();

  const [joinedAddress, setJoinedAddress] = useState<string | null>(null);
  const joinedRef = useRef<{ api: any; coinPublicKey: string; providers: any; accountId: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [userPk, setUserPk] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [ckbSporeId, setCkbSporeId] = useState<string | null>(null);
  const [ckbTxHash, setCkbTxHash] = useState<string | null>(null);
  const [veilIdHash, setVeilIdHash] = useState<string | null>(null);
  const [ckbMintIntent, setCkbMintIntent] = useState<CkbMintIntent | null>(null);
  const [ckbMintStatus, setCkbMintStatus] = useState<CkbMintStatus>('idle');
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>('idle');
  const [creditDecision, setCreditDecision] = useState<CreditDecision | null>(null);
  const [isRequestingDecision, setIsRequestingDecision] = useState(false);
  const [ckbAddress, setCkbAddress] = useState<string | null>(null);
  const [isMidnightJoined, setIsMidnightJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Restore completed dashboard cache without loading Midnight ZK assets. */
  useEffect(() => {
    let cancelled = false;

    if (!isConnected || !walletApi || !CONTRACT_ADDRESS || joinedAddress) {
      return;
    }

    walletApi.getUnshieldedAddress()
      .then(({ unshieldedAddress }: { unshieldedAddress: string }) => {
        if (cancelled) return;
        const completed = readCompletedFlowCache(unshieldedAddress, CONTRACT_ADDRESS);
        if (!completed) return;

        setJoinedAddress(CONTRACT_ADDRESS);
        setUserPk(completed.userPk);
        setVeilIdHash(completed.veilIdHash);
        setCkbSporeId(completed.ckbSporeId);
        setCkbTxHash(completed.ckbTxHash);
        setScoreStatus('done');
        setCkbMintStatus('done');
        setCkbMintIntent(null);
        setIsMidnightJoined(false);
        toast.success('Restored completed Veil DOB flow.');
      })
      .catch((error: unknown) => {
        console.warn('Completed flow cache restore failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, walletApi]);

  useEffect(() => {
    let cancelled = false;

    if (!ckbSigner) {
      setCkbAddress(null);
      return;
    }

    ckbSigner.getRecommendedAddress()
      .then((address) => {
        if (!cancelled) setCkbAddress(address);
      })
      .catch(() => {
        if (!cancelled) setCkbAddress(null);
      });

    return () => {
      cancelled = true;
    };
  }, [ckbSigner]);

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
        publicDataProvider: indexerPublicDataProvider(process.env.NEXT_PUBLIC_INDEXER_URL as string, process.env.NEXT_PUBLIC_INDEXER_WS_URL as string),
        privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: PRIVATE_STATE_STORE_NAME, accountId, privateStoragePasswordProvider: passwordProvider }),
        zkConfigProvider,
      },
      coinPublicKey: parseCoinPublicKeyToHex(shielded.shieldedCoinPublicKey as string, NETWORK_ID),
      accountId,
    };
  };

  const buildCreditDecisionMessage = (input: {
    readonly challenge: string;
    readonly userPk: string;
    readonly veilIdHash: string;
    readonly sporeId: string;
  }) => [
    'Veil credit decision authorization',
    `challenge:${input.challenge}`,
    `userPk:${input.userPk}`,
    `veilIdHash:${input.veilIdHash}`,
    `sporeId:${input.sporeId}`,
  ].join('\n');

  const requestCreditDecision = async (input?: {
    readonly userPk: string;
    readonly veilIdHash: string;
    readonly sporeId: string;
  }): Promise<void> => {
    const targetUserPk = input?.userPk ?? userPk;
    const targetVeilIdHash = input?.veilIdHash ?? veilIdHash;
    const targetSporeId = input?.sporeId ?? ckbSporeId;
    if (!targetUserPk || !targetVeilIdHash || !targetSporeId) return;
    if (!ckbSigner) {
      ckb.open();
      const msg = 'Connect a CKB wallet to authorize a credit decision request.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsRequestingDecision(true);
    const loadingToast = toast.loading('Authorizing risk decision…');
    try {
      const chalRes = await fetch(backendApiUrl('/challenges'), { method: 'POST' });
      const challengeData = await readJsonResponse(chalRes) as { challenge: string; message?: string };
      if (!chalRes.ok) throw new Error(challengeData.message ?? `Challenge request failed with HTTP ${chalRes.status}`);
      const { challenge } = challengeData;
      const message = buildCreditDecisionMessage({
        challenge,
        userPk: targetUserPk,
        veilIdHash: targetVeilIdHash,
        sporeId: targetSporeId,
      });
      const authorization = await ckbSigner.signMessage(message);
      const userCkbAddress = await ckbSigner.getRecommendedAddress();

      const queryRes = await fetch(backendApiUrl('/credit-decisions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPk: targetUserPk,
          veilIdHash: targetVeilIdHash,
          sporeId: targetSporeId,
          userCkbAddress,
          challenge,
          authorization,
        }),
      });

      const data = await readJsonResponse(queryRes) as {
        success: boolean;
        message?: string;
      } & CreditDecision;
      if (!queryRes.ok || !data.success) throw new Error(data.message ?? `Credit decision failed with HTTP ${queryRes.status}`);
      setCreditDecision({
        approved: data.approved,
        scoreBand: data.scoreBand,
        maxLtvBps: data.maxLtvBps,
        riskPremiumBps: data.riskPremiumBps,
        hasCreditScore: data.hasCreditScore,
        reason: data.reason,
        veilIdHash: data.veilIdHash,
        validAt: data.validAt,
      });
      toast.success('Risk decision ready.', { id: loadingToast });
    } catch (err) {
      console.warn('Credit decision request failed:', serializeError(err));
      setError(`Credit decision failed: ${serializeError(err)}`);
      toast.error(`Credit decision failed: ${serializeError(err)}`, { id: loadingToast });
    } finally {
      setIsRequestingDecision(false);
    }
  };

  const requestCreditDecisionInBackground = (input: {
    readonly userPk: string;
    readonly veilIdHash: string;
    readonly sporeId: string;
  }): void => {
    void requestCreditDecision(input).catch((err) => {
      console.debug('Credit decision unavailable:', serializeError(err));
    });
  };

  const getLocalScoreEntry = async (targetUserPk: string): Promise<{ exists: boolean; hasScore: boolean }> => {
    const provider = joinedRef.current?.providers?.privateStateProvider;
    if (!provider) return { exists: false, hasScore: false };

    const privateState = await provider.get(PRIVATE_STATE_ID);
    const accumulator = privateState?.scoreAmmulations?.[targetUserPk];
    const score = privateState?.creditScores?.[targetUserPk];
    return {
      exists: accumulator != null || score != null,
      hasScore: score != null,
    };
  };

  const prepareCkbMintIntent = async (targetUserPk: string): Promise<CkbMintIntent | null> => {
    if (!ckbSigner) {
      setVeilIdHash(await sha256Hex(targetUserPk));
      return null;
    }

    const userCkbAddress = await ckbSigner.getRecommendedAddress();
    const targetVeilIdHash = await sha256Hex(targetUserPk);
    const res = await fetch(backendApiUrl('/ckb/veil-identity/mint-intent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        veilIdHash: targetVeilIdHash,
        userCkbAddress,
      }),
    });
    const data = await readJsonResponse(res) as MintIntentResponse;
    if (!res.ok || data.success === false) {
      throw new Error(data.message ?? `Mint intent failed with HTTP ${res.status}`);
    }
    if (data.alreadyMinted && data.dob) {
      applyExistingCkbDob(targetUserPk, data.dob, userCkbAddress);
      return null;
    }
    if (!data.intent) {
      throw new Error('Mint intent response did not include an intent');
    }

    const intent = data.intent;
    setCkbMintIntent(intent);
    setVeilIdHash(intent.content.veilIdHash);
    setCkbMintStatus('idle');
    return intent;
  };

  const writeCompletedCacheForCurrentFlow = (input: {
    readonly userPk: string;
    readonly veilIdHash: string;
    readonly sporeId: string;
    readonly txHash: string;
    readonly ckbAddress?: string;
  }): void => {
    const joined = joinedRef.current;
    const accountId = joined?.accountId ?? walletAddress;
    const contractAddress = joined?.api?.deployedContractAddress ?? joinedAddress ?? CONTRACT_ADDRESS;
    if (!accountId || !contractAddress) return;

    writeCompletedFlowCache({
      version: 1,
      accountId,
      contractAddress,
      userPk: input.userPk,
      veilIdHash: input.veilIdHash,
      ckbSporeId: input.sporeId,
      ckbTxHash: input.txHash,
      ckbAddress: input.ckbAddress,
      completedAt: new Date().toISOString(),
    });
  };

  const applyExistingCkbDob = (targetUserPk: string, dob: ExistingCkbDob, ownerCkbAddress?: string): void => {
    setUserPk(targetUserPk);
    setVeilIdHash(dob.veilIdHash);
    setCkbSporeId(dob.sporeId);
    setCkbTxHash(dob.txHash);
    setCkbMintIntent(null);
    setScoreStatus('done');
    setCkbMintStatus('done');
    writeCompletedCacheForCurrentFlow({
      userPk: targetUserPk,
      veilIdHash: dob.veilIdHash,
      sporeId: dob.sporeId,
      txHash: dob.txHash,
      ckbAddress: ownerCkbAddress ?? ckbAddress ?? undefined,
    });
  };

  const fetchBackendScoreEntry = async (targetUserPk: string): Promise<ScoreEntryLookup> => {
    const params = new URLSearchParams();
    if (ckbSigner) {
      params.set('userCkbAddress', await ckbSigner.getRecommendedAddress());
    }
    const query = params.toString();
    const res = await fetch(backendApiUrl(`/score-entries/${targetUserPk}${query ? `?${query}` : ''}`));
    const data = await readJsonResponse(res) as ScoreEntryLookup;
    if (!res.ok || data.success === false) {
      throw new Error(data.message ?? `Score entry lookup failed with HTTP ${res.status}`);
    }
    return data;
  };

  const applyExistingBackendScoreEntry = (targetUserPk: string, lookup: ScoreEntryLookup): boolean => {
    if (!lookup.scoreEntry?.exists) return false;

    setScoreStatus('done');
    if (lookup.veilIdHash) setVeilIdHash(lookup.veilIdHash);
    if (lookup.ckbDob) {
      applyExistingCkbDob(targetUserPk, lookup.ckbDob, ckbAddress ?? undefined);
      return true;
    }
    if (lookup.ckbMintIntent) {
      setCkbMintIntent(lookup.ckbMintIntent);
      setVeilIdHash(lookup.ckbMintIntent.content.veilIdHash);
      setCkbMintStatus('idle');
    }
    return true;
  };

  const hydrateExistingScoreEntry = async (targetUserPk: string): Promise<boolean> => {
    const local = await getLocalScoreEntry(targetUserPk);
    if (!local.exists) return false;

    setScoreStatus('done');
    toast.success('Existing score entry found in browser private state.');

    try {
      await prepareCkbMintIntent(targetUserPk);
    } catch (error) {
      console.warn('Could not prepare CKB mint intent for existing score entry:', error);
      toast.error(`Could not prepare CKB DOB mint: ${serializeError(error)}`);
    }

    return true;
  };

  const hydrateBackendScoreEntry = async (targetUserPk: string): Promise<boolean> => {
    try {
      const lookup = await fetchBackendScoreEntry(targetUserPk);
      const exists = applyExistingBackendScoreEntry(targetUserPk, lookup);
      if (exists) {
        toast.success('Existing score entry found on backend.');
      }
      return exists;
    } catch (error) {
      console.warn('Backend score entry lookup failed:', error);
      return false;
    }
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
      toast.success('Veil ID generated.');
      const foundLocal = await hydrateExistingScoreEntry(pk);
      if (!foundLocal) await hydrateBackendScoreEntry(pk);
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
          toast.success('Veil ID generated.');
          const foundLocal = await hydrateExistingScoreEntry(pk2);
          if (!foundLocal) await hydrateBackendScoreEntry(pk2);
        } catch (retryErr) {
          console.error('Veil ID derivation failed after state reset:', retryErr);
          setError(`Could not derive Veil ID: ${serializeError(retryErr)}`);
          toast.error(`Could not derive Veil ID: ${serializeError(retryErr)}`);
        }
      } else {
        console.error('Veil ID derivation error:', err);
        setError(`Could not derive Veil ID: ${msg}`);
        toast.error(`Could not derive Veil ID: ${msg}`);
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
    const configuredZkBase = process.env.NEXT_PUBLIC_ZK_CONFIG_BASE_URL?.trim();
    const fullZkPath = configuredZkBase
      ? configuredZkBase.replace(/\/$/, '')
      : new URL('/zk/full', window.location.origin).toString();
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
    setIsMidnightJoined(true);
    const completed = readCompletedFlowCache(accountId, api.deployedContractAddress);
    if (completed) {
      setUserPk(completed.userPk);
      setVeilIdHash(completed.veilIdHash);
      setCkbSporeId(completed.ckbSporeId);
      setCkbTxHash(completed.ckbTxHash);
      setScoreStatus('done');
      setCkbMintStatus('done');
      setCkbMintIntent(null);
      toast.success('Restored completed Veil DOB flow.');
    }
    console.log('Connected to', api.deployedContractAddress);
  };

  const handleJoin = async () => {
    const addr = CONTRACT_ADDRESS.trim();
    if (!addr) { setError('NEXT_PUBLIC_CONTRACT_ADDRESS is not set'); return; }
    if (!walletApi) { await connect(); return; }
    const hasCompletedView = Boolean(userPk && ckbSporeId);

    setIsJoining(true);
    setError(null);
    if (!hasCompletedView) {
      setUserPk(null);
      setCkbSporeId(null);
      setCkbTxHash(null);
      setVeilIdHash(null);
      setCkbMintIntent(null);
      setCkbMintStatus('idle');
      setScoreStatus('idle');
      setCreditDecision(null);
    }
    setIsMidnightJoined(false);
    joinedRef.current = null;
    if (!hasCompletedView) setJoinedAddress(null);

    try {
      await doJoin(addr);
      toast.success('Connected to Veil contract.');
    } catch (err) {
      const msg = serializeError(err);
      const isAuthErr = msg.includes('authenticate data') || msg.includes('Unsupported state') || msg.includes('OperationError');
      if (isAuthErr) {
        console.log('Encrypted private state is stale — clearing and retrying…');
        try {
          await clearPrivateStore();
          await doJoin(addr);
          toast.success('Connected to Veil contract.');
        } catch (retryErr) {
          const retryMsg = serializeError(retryErr);
          console.error('Join failed after retry:', retryErr);
          setError(`Join failed: ${retryMsg}`);
          toast.error(`Join failed: ${retryMsg}`);
        }
      } else {
        console.error('Join failed:', err);
        setError(`Join failed: ${msg}`);
        toast.error(`Join failed: ${msg}`);
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
      toast.success('Private state exported.');
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Export failed: ${serializeError(err)}`);
      toast.error(`Export failed: ${serializeError(err)}`);
    }
  };

  const handleCreateScore = async () => {
    if (!userPk) return;
    const existing = await getLocalScoreEntry(userPk);
    if (existing.exists) {
      setScoreStatus('done');
      toast.success('Score entry already exists locally.');
      try {
        await prepareCkbMintIntent(userPk);
      } catch (error) {
        setError(`CKB DOB mint intent: ${serializeError(error)}`);
        toast.error(`CKB DOB mint intent failed: ${serializeError(error)}`);
      }
      return;
    }

    const backendExisting = await fetchBackendScoreEntry(userPk).catch((error) => {
      console.warn('Backend score entry preflight failed:', error);
      return null;
    });
    if (backendExisting && applyExistingBackendScoreEntry(userPk, backendExisting)) {
      toast.success('Score entry already exists on backend.');
      if (!backendExisting.ckbMintIntent && ckbSigner) {
        try {
          await prepareCkbMintIntent(userPk);
        } catch (error) {
          setError(`CKB DOB mint intent: ${serializeError(error)}`);
          toast.error(`CKB DOB mint intent failed: ${serializeError(error)}`);
        }
      }
      return;
    }

    if (!ckbSigner) {
      ckb.open();
      const msg = 'Connect a CKB wallet before creating the score entry. The CKB wallet will mint and pay for the Veil Identity DOB.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setScoreStatus('submitting');
    setError(null);
    console.log('Requesting score entry from backend…');
    const loadingToast = toast.loading('Creating score entry on Midnight…');
    try {
      const userCkbAddress = await ckbSigner.getRecommendedAddress();
      const res = await fetch(backendApiUrl('/score-entries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPk, userCkbAddress }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      if (data.job?.id) {
        setScoreStatus('pending');
        console.log('Score entry queued:', data.job.id);
        const result = await waitForJob(data.job.id);
        setScoreStatus('done');
        const intent = result?.ckbMintIntent as CkbMintIntent | undefined;
        const existingDob = result?.ckbDob as ExistingCkbDob | undefined;
        if (existingDob) {
          applyExistingCkbDob(userPk, existingDob, ckbAddress ?? undefined);
          toast.success('Existing Veil DOB restored.', { id: loadingToast });
          return;
        }
        if (intent) {
          setCkbMintIntent(intent);
          setVeilIdHash(intent.content.veilIdHash);
          setCkbMintStatus('idle');
        }
        console.log('Score entry confirmed. CKB Veil Identity DOB mint intent ready.', result);
        toast.success('Score entry confirmed. CKB DOB mint is ready.', { id: loadingToast });
        return;
      }
      setScoreStatus('done');
      if (data.ckbDob) {
        applyExistingCkbDob(userPk, data.ckbDob as ExistingCkbDob, ckbAddress ?? undefined);
        toast.success('Existing Veil DOB restored.', { id: loadingToast });
        return;
      }
      if (data.ckbMintIntent) {
        const intent = data.ckbMintIntent as CkbMintIntent;
        setCkbMintIntent(intent);
        setVeilIdHash(intent.content.veilIdHash);
        setCkbMintStatus('idle');
      }
      console.log('Score entry confirmed on-chain!', data.result);
      toast.success('Score entry confirmed.', { id: loadingToast });
    } catch (err) {
      console.error('Score error:', err);
      const msg = serializeError(err);
      if (msg.includes('duplicated credit score position')) {
        setScoreStatus('done');
        toast.success('Score entry already exists on Midnight.', { id: loadingToast });
        try {
          await prepareCkbMintIntent(userPk);
        } catch (intentError) {
          setError(`CKB DOB mint intent: ${serializeError(intentError)}`);
          toast.error(`CKB DOB mint intent failed: ${serializeError(intentError)}`);
        }
        return;
      }

      setError(`Score entry: ${msg}`);
      toast.error(`Score entry failed: ${msg}`, { id: loadingToast });
      setScoreStatus('error');
    }
  };

  const handlePrepareCkbMintIntent = async () => {
    if (!userPk) return;
    if (!ckbSigner) {
      ckb.open();
      const msg = 'Connect a CKB wallet to prepare the Veil Identity DOB mint.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const loadingToast = toast.loading('Preparing CKB DOB mint…');
    try {
      await prepareCkbMintIntent(userPk);
      toast.success('CKB DOB mint is ready.', { id: loadingToast });
    } catch (error) {
      setError(`CKB DOB mint intent: ${serializeError(error)}`);
      toast.error(`CKB DOB mint intent failed: ${serializeError(error)}`, { id: loadingToast });
    }
  };

  const handleMintCkbDob = async () => {
    if (!ckbMintIntent || !userPk) return;
    if (!ckbSigner) {
      ckb.open();
      const msg = 'Connect a CKB wallet to mint the Veil Identity DOB.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setCkbMintStatus('minting');
    setError(null);
    const loadingToast = toast.loading('Minting CKB Veil Identity DOB…');
    try {
      const userCkbAddress = await ckbSigner.getRecommendedAddress();
      const { tx, id } = await spore.createSpore({
        signer: ckbSigner,
        data: {
          contentType: ckbMintIntent.contentType,
          content: new TextEncoder().encode(JSON.stringify(ckbMintIntent.content)),
        },
        to: ckbMintIntent.lockScript,
        scriptInfo: spore.getSporeScriptInfo(ckbSigner.client, spore.SporeVersion.V1),
      });
      // createSpore prepares the Spore output, but the signer may still have excess input
      // capacity. Complete the fee/change output before sending so leftover CKB is not
      // interpreted as an enormous transaction fee by the node.
      await tx.completeFeeBy(ckbSigner);
      const txHash = await ckbSigner.sendTransaction(tx);

      setCkbMintStatus('recording');
      const recordRes = await fetch(backendApiUrl('/ckb/veil-identity/record'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          veilIdHash: ckbMintIntent.content.veilIdHash,
          userCkbAddress,
          sporeId: id,
          txHash,
        }),
      });
      const record = await readJsonResponse(recordRes);
      if (!recordRes.ok || record.success === false) {
        throw new Error(record.message ?? `CKB DOB record failed with HTTP ${recordRes.status}`);
      }
      setCkbSporeId(id);
      setCkbTxHash(txHash);
      setVeilIdHash(ckbMintIntent.content.veilIdHash);
      setCkbMintStatus('done');
      writeCompletedCacheForCurrentFlow({
        userPk,
        veilIdHash: ckbMintIntent.content.veilIdHash,
        sporeId: id,
        txHash,
        ckbAddress: userCkbAddress,
      });
      requestCreditDecisionInBackground({
        userPk,
        veilIdHash: ckbMintIntent.content.veilIdHash,
        sporeId: id,
      });
      console.log('CKB Veil Identity DOB minted and recorded:', record);
      toast.success('CKB Veil Identity DOB minted.', { id: loadingToast });
    } catch (err) {
      console.error('CKB DOB mint failed:', err);
      setError(`CKB DOB mint failed: ${serializeError(err)}`);
      toast.error(`CKB DOB mint failed: ${serializeError(err)}`, { id: loadingToast });
      setCkbMintStatus('error');
    }
  };

  const isBusy = isJoining || isDeriving || isRequestingDecision || scoreStatus === 'submitting' || scoreStatus === 'pending' || ckbMintStatus === 'minting' || ckbMintStatus === 'recording';
  const isLoading = isJoining;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Minimal back link — not a nav bar */}
        <div className="px-8 pt-8">
          <Link href="/" className="section-label hover:text-primary transition-colors">← Back to Veil Protocol</Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
          {/* Wordmark */}
          <div className="flex items-center gap-3 mb-4">
            <img src="/veil-cred-logo.PNG" alt="Veil Protocol" className="h-10 w-10 object-contain" />
            <span className="font-black text-sm tracking-widest uppercase text-foreground">Veil Protocol</span>
          </div>

          {/* Heading */}
          <div className="text-center space-y-3 max-w-md">
            <h1 className="font-black uppercase leading-none tracking-tight text-foreground" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.2rem)' }}>
              Connect to Access<br />
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Your Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use 1AM Wallet for the smoothest Midnight flow, or connect with Lace.
            </p>
          </div>

          <MidnightWalletSelector
            selectedWalletId={selectedWalletId}
            isConnecting={isConnecting}
            onConnect={(walletId) => void connect(walletId)}
          />

          {/* Chain strip */}
          <div className="flex items-center gap-4 mt-4">
            {['Midnight', 'Ethereum', 'Solana', 'CKB'].map((c, i) => (
              <span key={c} className="flex items-center gap-3">
                <span className="section-label">{c}</span>
                {i < 3 && <span className="w-1 h-1 rounded-full bg-border/40" />}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────── CONNECTED DASHBOARD ─────────── */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">

        {/* Sticky session bar */}
        <div className="sticky top-0 z-30 -mx-4 border-b border-border/20 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Link href="/" className="section-label hover:text-primary transition-colors">← Veil Protocol</Link>
              <span className="hidden h-1 w-1 rounded-full bg-border/40 sm:block" />
              <div className="flex min-w-0 items-center gap-2 rounded-sm border border-border/20 bg-card/70 px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate text-xs font-bold uppercase tracking-wide text-foreground">
                  {walletName ?? 'Midnight'} · {walletAddress ? shortAddr(walletAddress) : 'Connected'}
                </span>
              </div>
              {ckbAddress && (
                <div className="flex min-w-0 items-center gap-2 rounded-sm border border-border/20 bg-card/70 px-2.5 py-1.5">
                  <Wallet size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate text-xs font-bold uppercase tracking-wide text-foreground">
                    CKB · {shortAddr(ckbAddress)}
                  </span>
                  <CopyButton value={ckbAddress} label="Copy CKB address" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => ckb.open()}
                className="rounded-sm border border-border/30 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {ckbSigner ? 'Manage CKB' : 'Connect CKB'}
              </button>
              <button
                onClick={disconnect}
                className="rounded-sm border border-border/30 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Page title */}
        <div className="grid gap-6 border-b border-border/20 py-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <h1 className="font-black uppercase tracking-tight text-foreground" style={{ fontSize: 'clamp(1.9rem, 4vw, 3.2rem)' }}>Veil Dashboard</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Create a private Midnight credit identity and anchor the stable public identity proof as a user-owned CKB Spore DOB.
            </p>
          </div>
          <div className="rounded-sm border border-border/20 bg-card/70 px-4 py-3 md:min-w-72">
            <p className="section-label mb-1">Managed Contract</p>
            <p className="break-all text-xs font-bold text-primary">
              {CONTRACT_ADDRESS ? shortAddr(CONTRACT_ADDRESS) : 'NEXT_PUBLIC_CONTRACT_ADDRESS missing'}
            </p>
          </div>
        </div>

        {/* Inline error banner */}
        {error && (
          <div className="mt-6 rounded-sm px-4 py-3 flex items-start justify-between gap-3" style={{ background: 'oklch(0.12 0.04 20)', border: '1px solid oklch(0.35 0.12 20)' }}>
            <span className="text-xs text-red-400 leading-relaxed">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 text-red-700 hover:text-red-400 transition-colors text-sm leading-none">✕</button>
          </div>
        )}

        <div className="mt-8 space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Midnight Wallet"
            value={walletAddress ? shortAddr(walletAddress) : 'Connected'}
            sub={walletName ?? 'Midnight session active'}
          />
          <StatCard
            label="CKB Wallet"
            value={ckbAddress ? shortAddr(ckbAddress) : 'Not connected'}
            sub={ckbAddress ? 'Pays for Spore minting' : 'Connect to mint DOB'}
          />
          <StatCard
            label="Veil ID"
            value={userPk ? `${userPk.slice(0, 10)}…${userPk.slice(-6)}` : undefined}
            sub={userPk ? 'User public key' : joinedAddress ? 'Click Generate below' : isJoining ? 'Loading Midnight contract state' : 'Join contract first'}
            shimmer={isDeriving || isJoining}
          />
          <StatCard
            label="CKB DOB"
            value={ckbSporeId ? `${ckbSporeId.slice(0, 10)}…${ckbSporeId.slice(-6)}` : joinedAddress ? 'Not minted' : '—'}
            sub={ckbTxHash ? `Tx ${ckbTxHash.slice(0, 8)}…${ckbTxHash.slice(-6)}` : 'User-paid CKB wallet mint'}
            shimmer={isLoading && !joinedAddress}
          />
        </div>

        {/* Two-column layout: progress left, actions right */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">

          {/* Progress steps — left column */}
          <div className="flat-card rounded-sm p-5 lg:sticky lg:top-24 lg:col-span-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="section-label">Progress</p>
              <span className="rounded-sm border border-border/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {ckbSporeId ? 'Complete' : scoreStatus === 'done' ? 'Anchor ready' : 'In progress'}
              </span>
            </div>
            <div className="space-y-3">
              <StepRow n="1" label="Connect wallet" done={isConnected} active={!isConnected} />
              <StepRow n="2" label="Join contract" done={!!joinedAddress} active={isConnected && !joinedAddress} loading={isJoining} />
              <StepRow n="3" label="Generate Veil ID" done={!!userPk} active={!!joinedAddress && !userPk} />
              <StepRow n="4" label="Create score entry" done={scoreStatus === 'done'} active={!!userPk && scoreStatus === 'idle'} />
              <StepRow n="5" label="Mint CKB Spore DOB" done={!!ckbSporeId} active={!!ckbMintIntent && !ckbSporeId} />
            </div>
          </div>

          {/* Action panel — right column */}
          <div className="flat-card rounded-sm p-5 space-y-5 sm:p-6 lg:col-span-8">

          {ckbAddress && (
            <>
              <DetailRow label="CKB Address" value={ckbAddress} muted />
              <div className="border-t border-border/20" />
            </>
          )}

          {/* Join / Status */}
          {!joinedAddress ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">Join Protocol Contract</p>
                <p className="section-label">
                  {CONTRACT_ADDRESS
                    ? `Auto-connecting to ${shortAddr(CONTRACT_ADDRESS)}`
                    : 'No NEXT_PUBLIC_CONTRACT_ADDRESS set — enter one below'}
                </p>
              </div>
              {isJoining && (
                <div className="rounded-sm border border-primary/30 bg-primary/10 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    <p className="text-xs font-black uppercase tracking-widest">Joining Midnight contract</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Fetching ZK artifacts, opening the local private-state store, and loading the deployed Veil contract. This can take a moment on the first join.
                  </p>
                </div>
              )}
              {!CONTRACT_ADDRESS && (
                <input
                  id="contract-addr-input"
                  type="text"
                  placeholder="Paste contract address…"
                  className="w-full rounded-sm px-3 py-2 bg-background text-foreground text-sm border border-border/20 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                  onBlur={(e) => {
                    (window as any).__manualContractAddr = e.target.value;
                  }}
                />
              )}
              <button
                onClick={() => void handleJoin()}
                disabled={isBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-sm py-3 text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                {isJoining && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isJoining ? 'Joining Midnight…' : 'Join Contract'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <DetailRow label="Connected Contract" value={joinedAddress} />
              </div>
              <button
                onClick={() => {
                  if (!isMidnightJoined) {
                    void handleJoin();
                    return;
                  }

                  joinedRef.current = null;
                  setJoinedAddress(null);
                  setUserPk(null);
                  setCkbSporeId(null);
                  setCkbTxHash(null);
                  setVeilIdHash(null);
                  setScoreStatus('idle');
                  setCreditDecision(null);
                  setError(null);
                  setIsMidnightJoined(false);
                }}
                className="shrink-0 rounded-sm border border-border/30 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {isMidnightJoined ? 'Switch' : 'Join Midnight'}
              </button>
            </div>
          )}

          {joinedAddress && <div className="border-t border-border/20" />}

          {/* Veil ID section */}
          {joinedAddress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">Veil ID</p>
                {userPk && isMidnightJoined && (
                  <button
                    onClick={() => void handleExportPrivateState()}
                    className="text-xs px-3 py-1.5 rounded-sm border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1.5"
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
                <DetailRow label="User Public Key" value={userPk} />
              ) : (
                <button
                  onClick={() => {
                    const j = joinedRef.current;
                    if (j) void deriveAndCheck(j.api, j.coinPublicKey, j.api.deployedContractAddress);
                  }}
                  disabled={isBusy}
                  className="w-full rounded-sm px-4 py-3 text-sm font-black uppercase tracking-widest transition-transform hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  Generate Veil ID
                </button>
              )}
            </div>
          )}

          {userPk && <div className="border-t border-border/20" />}

          {/* Score entry */}
          {userPk && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-foreground uppercase tracking-wide">Credit Score Entry</p>
                  <p className="section-label">Registers your Veil ID on Midnight, then prepares a CKB Spore mint.</p>
                </div>
                {scoreStatus === 'done' && (
                  <span className="shrink-0 text-xs px-2 py-1 rounded-sm font-bold uppercase tracking-wide" style={{ background: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>Confirmed</span>
                )}
              </div>

              {scoreStatus !== 'done' && (
                <button
                  onClick={() => void handleCreateScore()}
                  disabled={isBusy}
                  className="w-full py-2.5 rounded-sm font-bold text-sm disabled:opacity-50 transition-opacity hover:opacity-90 border border-border/30 text-foreground uppercase tracking-wide"
                >
                  {scoreStatus === 'submitting' ? 'Submitting to chain…'
                    : scoreStatus === 'error' ? 'Retry Score Entry'
                    : 'Create Score Entry + Prepare CKB DOB'}
                </button>
              )}
              {!ckbSigner && scoreStatus !== 'done' && (
                <button
                  onClick={() => ckb.open()}
                  className="w-full py-2.5 rounded-sm font-bold text-sm transition-opacity hover:opacity-90 border text-primary uppercase tracking-wide"
                  style={{ borderColor: 'color-mix(in oklch, var(--color-primary) 30%, transparent)' }}
                >
                  Connect CKB Wallet
                </button>
              )}
            </div>
          )}

          {userPk && (scoreStatus === 'done' || ckbMintIntent || ckbSporeId) && <div className="border-t border-border/20" />}

          {/* CKB DOB anchor */}
          {userPk && (scoreStatus === 'done' || ckbMintIntent || ckbSporeId) && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-foreground uppercase tracking-wide">CKB Veil Identity DOB</p>
                  <p className="section-label">Public Spore anchor for your Veil ID hash. Scores stay private on Midnight.</p>
                </div>
                {ckbSporeId && (
                  <span className="shrink-0 text-xs px-2 py-1 rounded-sm font-bold uppercase tracking-wide" style={{ background: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>Minted</span>
                )}
              </div>
              {ckbSporeId ? (
                <div className="rounded-sm border border-border/20 bg-background/70 p-3 space-y-3">
                  <VeilDobNftCard
                    sporeId={ckbSporeId}
                    txHash={ckbTxHash}
                    veilIdHash={veilIdHash}
                    ckbAddress={ckbAddress}
                  />
                  {creditDecision && (
                    <div className="rounded-sm border border-border/20 bg-background/70 px-4 py-3">
                      <p className="section-label mb-1">Risk Decision</p>
                      <p className="text-xs text-foreground/60 break-all">
                        {creditDecision.scoreBand} · {creditDecision.approved ? `LTV ${creditDecision.maxLtvBps / 100}%` : 'not approved'}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => void requestCreditDecision()}
                    disabled={isBusy || !ckbSigner}
                    className="w-full py-2.5 rounded-sm font-bold text-sm disabled:opacity-40 transition-opacity hover:opacity-90 border border-border/30 text-foreground uppercase tracking-wide"
                  >
                    {isRequestingDecision ? 'Authorizing risk decision…' : 'Authorize Risk Decision'}
                  </button>
                </div>
              ) : ckbMintIntent ? (
                <div className="space-y-3">
                  <DetailRow label="Veil ID Hash" value={ckbMintIntent.content.veilIdHash} muted />
                  <button
                    onClick={() => void handleMintCkbDob()}
                    disabled={isBusy || !ckbSigner}
                    className="w-full py-2.5 rounded-sm font-bold text-sm disabled:opacity-40 transition-opacity hover:opacity-90 uppercase tracking-widest"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                  >
                    {ckbMintStatus === 'minting' ? 'Confirming in CKB wallet…'
                      : ckbMintStatus === 'recording' ? 'Recording mint…'
                      : ckbMintStatus === 'error' ? 'Retry CKB DOB Mint'
                      : 'Mint Veil Identity DOB in CKB Wallet'}
                  </button>
                  {!ckbSigner && (
                    <p className="section-label">Connect a CKB wallet to sign and pay for this Spore mint.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="section-label">
                    Score entry is confirmed. Prepare the CKB Spore mint intent with your connected CKB wallet.
                  </p>
                  <button
                    onClick={() => void handlePrepareCkbMintIntent()}
                    disabled={isBusy}
                    className="w-full rounded-sm px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                  >
                    {ckbSigner ? 'Prepare CKB DOB Mint' : 'Connect CKB Wallet'}
                  </button>
                </div>
              )}
            </div>
          )}
          </div>{/* end action panel */}
        </div>{/* end two-column grid */}
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
