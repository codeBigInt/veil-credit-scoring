import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  buildRegistrationMessage,
  bytesToHex,
  createDerivedProvider,
  deriveVeilId,
  VeilClient,
  type CCCSigner,
  type DerivedProviderHandle,
  type ReputationProof,
  type VeilConfig,
} from '@veil-protocol/sdk';

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: 'accountsChanged', listener: (accounts: unknown) => void): void;
  removeListener?(event: 'accountsChanged', listener: (accounts: unknown) => void): void;
};

type EthereumWindow = Window & typeof globalThis & {
  ethereum?: EthereumProvider;
};

type RegistrationState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'signing'
  | 'signed'
  | 'preparing'
  | 'registering'
  | 'registered'
  | 'proving'
  | 'proved'
  | 'error';

type DashboardCache = {
  version: 2;
  address: string;
  veilId: string;
  lockHash: string;
  registrationTx?: string;
  proof?: ReputationProof;
  state: Extract<RegistrationState, 'registered' | 'proved'>;
  updatedAt: string;
};

type EncodedValue =
  | null
  | string
  | number
  | boolean
  | EncodedValue[]
  | { [key: string]: EncodedValue };

type IndexedDbBackup = {
  dbName: string;
  stores: Record<string, Array<{ key: EncodedValue; value: EncodedValue }>>;
};

type VeilDashboardBackup = {
  version: 1;
  exportedAt: string;
  network: string;
  contractAddress: string;
  dashboard?: DashboardCache;
  indexedDb: IndexedDbBackup[];
};

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
const PROOF_SERVER_URL = process.env.NEXT_PUBLIC_PROOF_SERVER_URL;
const ZK_CONFIG_BASE_URL = process.env.NEXT_PUBLIC_ZK_CONFIG_BASE_URL;
const ETHEREUM_RPC_URL = process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? '';
const MIDNIGHT_EXPLORER_URL = process.env.NEXT_PUBLIC_MIDNIGHT_EXPLORER_URL ?? '';
const MIDNIGHT_TX_URL_TEMPLATE = process.env.NEXT_PUBLIC_MIDNIGHT_TX_URL_TEMPLATE ?? '';

const config: VeilConfig = {
  contractAddress: CONTRACT_ADDRESS,
  network: (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK as VeilConfig['network']) ?? 'preview',
  proofServerUrl: PROOF_SERVER_URL,
  feeSponsorUrl: BACKEND_URL || undefined,
  zkArtifactsBaseUrl: ZK_CONFIG_BASE_URL,
  midnightRpc: process.env.NEXT_PUBLIC_INDEXER_URL,
  midnightIndexerWsUrl: process.env.NEXT_PUBLIC_INDEXER_WS_URL,
  chains: {
    ethereum: ETHEREUM_RPC_URL ? { rpcUrl: ETHEREUM_RPC_URL, chainId: 1 } : undefined,
  },
};

const sha256Bytes = async (value: string): Promise<Uint8Array> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return new Uint8Array(digest);
};

const short = (value: string, head = 8, tail = 6): string =>
  value.length > head + tail ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;

const dashboardCacheKey = (address: string): string =>
  `veil-dashboard:v2:${config.network}:${CONTRACT_ADDRESS || 'no-contract'}:${address.toLowerCase()}`;

const midnightTxUrl = (txHash: string): string | null => {
  if (txHash === 'already-registered') return null;
  if (MIDNIGHT_TX_URL_TEMPLATE) {
    return MIDNIGHT_TX_URL_TEMPLATE.replace('{txHash}', encodeURIComponent(txHash));
  }
  if (!MIDNIGHT_EXPLORER_URL) return null;
  return `${MIDNIGHT_EXPLORER_URL.replace(/\/+$/, '')}/tx/${txHash}`;
};

const statusLabel = (state: RegistrationState, proved: boolean, registered: boolean, signed: boolean, connected: boolean): string => {
  if (state === 'error') return 'Needs attention';
  if (proved) return 'Complete';
  if (registered) return 'Registered';
  if (signed) return 'Signed';
  if (connected) return 'Ready';
  return 'New';
};

const formatUserError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('no free night utxo') || lower.includes('sponsor unavailable') || lower.includes('dust sponsorship unavailable')) {
    return 'Free fee sponsorship is busy right now. Try again in a few minutes.';
  }
  if (lower.includes('user rejected') || lower.includes('rejected') || lower.includes('denied')) {
    return 'The wallet request was cancelled.';
  }
  if (lower.includes('insufficient funds') || lower.includes('could not balance dust')) {
    return 'The transaction does not have enough DUST yet. Try again after sponsorship syncs.';
  }
  if (lower.includes('missing next_public')) {
    return 'The app is missing required testnet configuration.';
  }
  if (lower.includes('timed out waiting')) {
    return 'The Midnight wallet is still syncing. Try again shortly.';
  }
  return 'Something went wrong. Try again.';
};

const encodeValue = (value: unknown): EncodedValue => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return { __veilType: 'BigInt', value: value.toString() };
  }
  if (value instanceof Uint8Array) {
    return { __veilType: 'Uint8Array', value: btoa(String.fromCharCode(...value)) };
  }
  if (value instanceof ArrayBuffer) {
    return encodeValue(new Uint8Array(value));
  }
  if (Array.isArray(value)) {
    return value.map(encodeValue);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encodeValue(item)]),
    );
  }
  return String(value);
};

const decodeValue = (value: EncodedValue): unknown => {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value.__veilType === 'BigInt' && typeof value.value === 'string') return BigInt(value.value);
  if (value.__veilType === 'Uint8Array' && typeof value.value === 'string') {
    return Uint8Array.from(atob(value.value), (char) => char.charCodeAt(0));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]));
};

const openIndexedDb = (dbName: string, storeNames?: string[]): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of storeNames ?? []) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const readIndexedDb = async (dbName: string): Promise<IndexedDbBackup> => {
  const db = await openIndexedDb(dbName);
  try {
    const storeNames = Array.from(db.objectStoreNames);
    const stores: IndexedDbBackup['stores'] = {};
    await Promise.all(storeNames.map((storeName) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result;
        const values = valuesReq.result;
        stores[storeName] = values.map((value, index) => ({
          key: encodeValue(keys[index]),
          value: encodeValue(value),
        }));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    })));
    return { dbName, stores };
  } finally {
    db.close();
  }
};

const restoreIndexedDb = async (backup: IndexedDbBackup): Promise<void> => {
  const db = await openIndexedDb(backup.dbName, Object.keys(backup.stores));
  try {
    await Promise.all(Object.entries(backup.stores).map(([storeName, rows]) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const row of rows) {
        store.put(decodeValue(row.value), decodeValue(row.key) as IDBValidKey);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    })));
  } finally {
    db.close();
  }
};

class EvmWalletSigner implements CCCSigner {
  constructor(
    private readonly provider: EthereumProvider,
    private readonly address: string,
  ) {}

  getRecommendedAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  getEvmAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  async signMessage(message: string): Promise<string> {
    return this.provider.request({
      method: 'personal_sign',
      params: [message, this.address],
    }) as Promise<string>;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function DetailRow({
  label,
  value,
  display,
  tx,
}: {
  label: string;
  value: string;
  display?: string;
  tx?: boolean;
}) {
  const txUrl = tx ? midnightTxUrl(value) : null;
  return (
    <div className="rounded-sm border border-border/20 bg-background/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="section-label">{label}</p>
        <div className="flex items-center gap-2">
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              aria-label={`View ${label}`}
              title={`View ${label}`}
            >
              <ExternalLink size={15} />
            </a>
          )}
          <CopyButton value={value} label={label} />
        </div>
      </div>
      <p className="break-all font-mono text-sm text-foreground/85">{display ?? value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [address, setAddress] = useState('');
  const [veilId, setVeilId] = useState('');
  const [lockHash, setLockHash] = useState('');
  const [signature, setSignature] = useState('');
  const [registrationTx, setRegistrationTx] = useState('');
  const [proof, setProof] = useState<ReputationProof | null>(null);
  const [state, setState] = useState<RegistrationState>('idle');
  const [message, setMessage] = useState('Connect your wallet to create a private Veil identity.');
  const [detailError, setDetailError] = useState('');
  const [backupRestored, setBackupRestored] = useState(false);

  const walletConnected = Boolean(address && veilId);
  const identitySigned = Boolean(signature) || ['signed', 'preparing', 'registering', 'registered', 'proving', 'proved'].includes(state);
  const identityRegistered = Boolean(registrationTx) || ['registered', 'proving', 'proved'].includes(state);
  const reputationProved = Boolean(proof) || state === 'proved';
  const busy = ['connecting', 'signing', 'preparing', 'registering', 'proving'].includes(state);
  const primaryActionLabel = state === 'connecting'
    ? 'Connecting wallet'
    : state === 'signing'
      ? 'Waiting for signature'
      : state === 'preparing'
        ? 'Preparing Midnight'
        : state === 'registering'
          ? 'Registering identity'
          : state === 'proving'
            ? 'Proving band'
            : reputationProved
              ? 'Band proved'
              : !walletConnected
                ? 'Connect wallet'
                : !identitySigned
                  ? 'Sign identity'
                  : identityRegistered
                    ? 'Prove band'
                    : 'Register and prove';
  const primaryActionDisabled = busy || reputationProved;
  const canImportBackup = walletConnected && !busy;
  const canExportBackup = walletConnected && (identityRegistered || reputationProved || backupRestored);
  const steps = [
    { label: 'Connect', complete: walletConnected, active: !walletConnected || state === 'connecting' },
    { label: 'Sign', complete: identitySigned, active: walletConnected && !identitySigned },
    { label: 'Prove', complete: reputationProved, active: identitySigned && !reputationProved },
  ];

  const readDashboardCache = (walletAddress: string): DashboardCache | null => {
    try {
      const raw = localStorage.getItem(dashboardCacheKey(walletAddress));
      if (!raw) return null;
      const cached = JSON.parse(raw) as DashboardCache;
      if (cached.version !== 2 || cached.address.toLowerCase() !== walletAddress.toLowerCase()) return null;
      return cached;
    } catch {
      localStorage.removeItem(dashboardCacheKey(walletAddress));
      return null;
    }
  };

  const applyDashboardCache = (cached: DashboardCache) => {
    setAddress(cached.address);
    setLockHash(cached.lockHash);
    setVeilId(cached.veilId);
    setRegistrationTx(cached.registrationTx ?? '');
    setProof(cached.proof ?? null);
    setState(cached.state);
    setBackupRestored(true);
    setMessage(cached.state === 'proved'
      ? `Proof restored. Your current band is ${cached.proof?.band ?? 'unranked'}.`
      : 'Identity registration restored. You can continue with band proof.');
  };

  const activateWallet = async (selected: string, options?: { silent?: boolean }) => {
    const nextLockHash = bytesToHex(await sha256Bytes(`veil:v2:ckb-lock:${selected.toLowerCase()}`));
    const cached = readDashboardCache(selected);

    setAddress(selected);
    setSignature('');
    setDetailError('');

    if (cached) {
      applyDashboardCache(cached);
      if (!options?.silent) toast.success('Wallet restored');
      return;
    }

    setLockHash(nextLockHash);
    setVeilId(deriveVeilId(nextLockHash));
    setRegistrationTx('');
    setProof(null);
    setBackupRestored(false);
    setState('ready');
    setMessage('Wallet connected. Sign once to create your Veil identity.');
    if (!options?.silent) toast.success('Wallet connected');
  };

  useEffect(() => {
    const provider = typeof window !== 'undefined'
      ? (window as EthereumWindow).ethereum
      : undefined;
    if (!provider) return;

    let cancelled = false;
    const syncAccounts = async (accountsInput?: unknown) => {
      try {
        const accounts = accountsInput ?? await provider.request({ method: 'eth_accounts' });
        const selected = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
        if (cancelled) return;
        if (selected) {
          await activateWallet(selected, { silent: true });
        } else {
          setAddress('');
          setVeilId('');
          setLockHash('');
          setSignature('');
          setRegistrationTx('');
          setProof(null);
          setBackupRestored(false);
          setState('idle');
          setMessage('Connect your wallet to create a private Veil identity.');
        }
      } catch {
        // Silent session restore should never block first paint.
      }
    };

    const handleAccountsChanged = (accounts: unknown) => void syncAccounts(accounts);

    void syncAccounts();
    provider.on?.('accountsChanged', handleAccountsChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, []);

  const persistProgress = (updates: Partial<DashboardCache>) => {
    if (!address || !veilId || !lockHash) return;
    const cache: DashboardCache = {
      version: 2,
      address,
      veilId,
      lockHash,
      registrationTx,
      proof: proof ?? undefined,
      state: reputationProved ? 'proved' : 'registered',
      updatedAt: new Date().toISOString(),
      ...updates,
    };
    localStorage.setItem(dashboardCacheKey(address), JSON.stringify(cache));
  };

  const showError = (error: unknown, fallbackMessage: string) => {
    const userMessage = formatUserError(error);
    setState('error');
    setDetailError(userMessage);
    setMessage(fallbackMessage);
    toast.error(userMessage);
  };

  const connectWallet = async () => {
    setDetailError('');
    setSignature('');
    setState('connecting');
    setMessage('Waiting for your wallet to connect.');

    const provider = typeof window !== 'undefined'
      ? (window as EthereumWindow).ethereum
      : undefined;

    if (!provider) {
      showError(new Error('No wallet detected'), 'Wallet connection failed.');
      return;
    }

    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      const selected = accounts[0];
      if (!selected) throw new Error('Wallet returned no accounts.');

      await activateWallet(selected);
    } catch (err) {
      showError(err, 'Wallet connection failed.');
    }
  };

  const signRegistrationMessage = async () => {
    setDetailError('');
    setSignature('');

    const provider = typeof window !== 'undefined'
      ? (window as EthereumWindow).ethereum
      : undefined;

    if (!provider || !address || !veilId) {
      showError(new Error('Connect a wallet before signing.'), 'Wallet connection required.');
      return;
    }

    try {
      setState('signing');
      setMessage('Approve the identity signature in your wallet.');

      const registrationMessage = buildRegistrationMessage(veilId, config.network);
      const signed = await provider.request({
        method: 'personal_sign',
        params: [registrationMessage, address],
      }) as string;

      setSignature(signed);
      setState('signed');
      setMessage(CONTRACT_ADDRESS
        ? 'Signature saved. Continue to register and prove your band.'
        : 'Signature saved. Add a contract address to enable on-chain registration.');
      toast.success('Identity signature saved');
    } catch (err) {
      showError(err, 'Signature was not completed.');
    }
  };

  const assertSdkConfig = () => {
    if (!CONTRACT_ADDRESS) throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS.');
    if (!PROOF_SERVER_URL) throw new Error('Missing NEXT_PUBLIC_PROOF_SERVER_URL.');
    if (!ZK_CONFIG_BASE_URL) throw new Error('Missing NEXT_PUBLIC_ZK_CONFIG_BASE_URL.');
    if (!lockHash) throw new Error('Missing wallet proof. Reconnect your wallet.');
  };

  const completeReputationProof = async () => {
    setDetailError('');
    setProof(null);

    const provider = typeof window !== 'undefined'
      ? (window as EthereumWindow).ethereum
      : undefined;

    if (!provider || !address || !veilId) {
      showError(new Error('Connect and sign before proving your band.'), 'Wallet setup is incomplete.');
      return;
    }

    let midnightProvider: DerivedProviderHandle | null = null;

    try {
      assertSdkConfig();
      setState('preparing');
      setMessage('Preparing your private Midnight wallet. Your wallet may ask for one derivation signature.');

      const signer = new EvmWalletSigner(provider, address);
      midnightProvider = await createDerivedProvider(signer, config);
      const client = new VeilClient(config, midnightProvider, {
        deriveLockHashFromAddress: () => lockHash,
      });

      setState('registering');
      setMessage('Registering your Veil identity on Midnight. Fees are sponsored when available.');
      let nextRegistrationTx = registrationTx;
      try {
        const registration = await client.register(signer);
        nextRegistrationTx = registration.txHash;
        setRegistrationTx(registration.txHash);
      } catch (registrationError) {
        if (!isAlreadyRegisteredError(registrationError)) throw registrationError;
        nextRegistrationTx = 'already-registered';
        setRegistrationTx(nextRegistrationTx);
      }
      persistProgress({ registrationTx: nextRegistrationTx, state: 'registered' });

      setState('proving');
      setMessage('Creating and submitting your band proof.');
      const reputationProof = await client.proveReputation(signer);
      setProof(reputationProof);
      persistProgress({
        registrationTx: nextRegistrationTx,
        proof: reputationProof,
        state: 'proved',
      });

      setState('proved');
      setMessage(`Band proof submitted. Your current band is ${reputationProof.band}.`);
      toast.success('Band proof submitted');
    } catch (err) {
      showError(err, 'Band proof was not completed.');
    } finally {
      await midnightProvider?.stop().catch(() => undefined);
    }
  };

  const runPrimaryAction = async () => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }
    if (!identitySigned) {
      await signRegistrationMessage();
      return;
    }
    await completeReputationProof();
  };

  const exportBackup = async () => {
    try {
      const liveDashboard = address && veilId && lockHash && (identityRegistered || reputationProved || backupRestored)
        ? {
            version: 2 as const,
            address,
            veilId,
            lockHash,
            registrationTx: registrationTx || undefined,
            proof: proof ?? undefined,
            state: reputationProved ? 'proved' as const : 'registered' as const,
            updatedAt: new Date().toISOString(),
          }
        : null;
      const cachedDashboard = address
        ? JSON.parse(localStorage.getItem(dashboardCacheKey(address)) ?? 'null') as DashboardCache | null
        : null;
      const backup: VeilDashboardBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        network: config.network,
        contractAddress: CONTRACT_ADDRESS,
        dashboard: liveDashboard ?? cachedDashboard ?? undefined,
        indexedDb: await Promise.all([
          readIndexedDb('veil-wallet-cache'),
          readIndexedDb(`veil-ps-${config.network}`),
        ]),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `veil-backup-${config.network}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported');
    } catch (err) {
      showError(err, 'Backup export failed.');
    }
  };

  const importBackup = async (file: File) => {
    try {
      const backup = JSON.parse(await file.text()) as VeilDashboardBackup;
      if (backup.version !== 1 || backup.network !== config.network) {
        throw new Error('Backup is for a different Veil network.');
      }
      for (const dbBackup of backup.indexedDb) {
        await restoreIndexedDb(dbBackup);
      }
      if (backup.dashboard?.address) {
        localStorage.setItem(dashboardCacheKey(backup.dashboard.address), JSON.stringify(backup.dashboard));
        if (address && backup.dashboard.address.toLowerCase() === address.toLowerCase()) {
          applyDashboardCache(backup.dashboard);
          toast.success('Backup imported and restored');
          return;
        }
      }
      toast.success('Backup imported. Connect the backup wallet to restore it.');
    } catch (err) {
      showError(err, 'Backup import failed.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground xl:h-screen xl:overflow-hidden">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-8 sm:px-6 lg:py-12 xl:h-screen xl:grid-cols-[minmax(0,1fr)_440px] xl:items-stretch xl:gap-12 xl:py-0">
        <div className="min-w-0 overflow-hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:items-center">
          <div>
            <a href="/" className="section-label text-primary no-underline">Veil Protocol</a>
            <h1 className="mt-5 max-w-[42rem] font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
              Your Private Band
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Create one private profile from your existing wallet. Apps can verify your band without reading your full wallet history.
            </p>
          </div>
        </div>

        <div className="min-h-0 min-w-0 xl:flex xl:items-center">
        <div className="dashboard-scroll flat-card min-w-0 rounded-sm p-5 sm:p-6 xl:max-h-[calc(100vh-4rem)] xl:w-full xl:overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-label mb-2">Activity</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Identity Setup</h2>
            </div>
            <div className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1">
              <p className="section-label text-primary">
                {statusLabel(state, reputationProved, identityRegistered, identitySigned, walletConnected)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{message}</p>
          {detailError && <p className="mt-2 text-sm text-red-400">{detailError}</p>}

          <div className="mt-6 rounded-sm border border-primary/20 bg-primary/5 p-4">
            <div className="grid grid-cols-[1fr_1fr_1fr] items-start">
              {steps.map((step, index) => (
                <div key={step.label} className="relative flex min-w-0 flex-col items-center">
                  {index > 0 && (
                    <div className={`absolute left-0 right-1/2 top-4 h-px ${steps[index - 1].complete ? 'bg-primary' : 'bg-border/40'}`} />
                  )}
                  {index < steps.length - 1 && (
                    <div className={`absolute left-1/2 right-0 top-4 h-px ${step.complete ? 'bg-primary' : 'bg-border/40'}`} />
                  )}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${
                      step.complete
                        ? 'border-primary bg-primary text-primary-foreground'
                        : step.active
                          ? 'border-primary bg-background text-primary'
                          : 'border-border/40 bg-background text-muted-foreground'
                    }`}
                    aria-label={`${step.label} ${step.complete ? 'complete' : step.active ? 'active' : 'pending'}`}
                  >
                    {step.complete ? <Check size={16} strokeWidth={3} /> : index + 1}
                  </div>
                  <p className={`section-label mt-3 text-center ${step.active || step.complete ? 'text-foreground' : ''}`}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void runPrimaryAction()}
              disabled={primaryActionDisabled}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-sm bg-primary px-5 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />}
              {primaryActionLabel}
            </button>

            {walletConnected && !busy && !reputationProved && (
              <button
                type="button"
                onClick={() => void connectWallet()}
                className="mt-3 text-xs font-black uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
              >
                Use different wallet
              </button>
            )}
          </div>

          {walletConnected && (
            <div className="mt-6 space-y-3 border-t border-border/20 pt-5">
              <DetailRow label="Main wallet" value={address} display={short(address, 12, 10)} />
              <DetailRow label="Veil ID" value={veilId} display={short(veilId, 18, 14)} />
              {registrationTx && (
                <DetailRow
                  label="Registration tx"
                  value={registrationTx}
                  display={registrationTx === 'already-registered' ? 'Already registered' : short(registrationTx, 14, 12)}
                  tx={registrationTx !== 'already-registered'}
                />
              )}
              {proof?.txHash && (
                <DetailRow label="Proof tx" value={proof.txHash} display={short(proof.txHash, 14, 12)} tx />
              )}
              {proof && (
                <div className="rounded-sm border border-primary/25 bg-primary/5 p-3">
                  <p className="section-label mb-1 text-primary">Current band</p>
                  <p className="text-lg font-black uppercase text-foreground">{proof.band}</p>
                </div>
              )}
            </div>
          )}

          {(canImportBackup || canExportBackup) && (
            <div className={`mt-6 grid gap-3 border-t border-border/20 pt-5 ${canImportBackup && canExportBackup ? 'sm:grid-cols-2' : ''}`}>
              {canExportBackup && (
                <button
                  type="button"
                  onClick={() => void exportBackup()}
                  className="inline-flex items-center justify-center gap-2 rounded-sm border border-border/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Download size={15} />
                  Export backup
                </button>
              )}
              {canImportBackup && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-sm border border-border/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Upload size={15} />
                  Import backup
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importBackup(file);
                }}
              />
              <p className={`text-xs leading-relaxed text-muted-foreground ${canImportBackup && canExportBackup ? 'sm:col-span-2' : ''}`}>
                Backup files can include local Midnight wallet cache and private state. Keep them private.
              </p>
            </div>
          )}
        </div>
        </div>
      </section>
    </main>
  );
}

const isAlreadyRegisteredError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('already') && message.toLowerCase().includes('register');
};
