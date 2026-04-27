import { useState, useRef } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { syncNetworkId } from '@/utils/network-id';
import {
  PRIVATE_STATE_ID,
  BOOTSTRAP_CIRCUITS,
  FULL_CIRCUITS,
  makeBootstrapCompiledContract,
  makeFullCompiledContract,
} from '@/contract-api-utils';
import { fromHex, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';

const NETWORK_ID = 'preprod';

const PREPROD_ENV = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proveServerUri: "http://127.0.0.1:6300/"
};


type DeployStage = 'idle' | 'deploying-bootstrap' | 'installing-circuits' | 'done' | 'error';

type LogEntry = { ts: string; msg: string; kind: 'info' | 'success' | 'error' };

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

function createVeilPrivateState(secretKey: Uint8Array) {
  return {
    secreteKey: secretKey,
    scoreAmmulations: {},
    creditScores: {},
    ownershipSecret: fromHex(sampleSigningKey()),
  };
}

export default function DeployPage() {
  const { isConnected, isConnecting, walletApi, connect, walletAddress, disconnect } = useWallet();
  const [stage, setStage] = useState<DeployStage>('idle');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [circuitProgress, setCircuitProgress] = useState<{ done: number; total: number } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [proofServerUri, setProofServerUri] = useState('');
  const deployedApiRef = useRef<any>(null);
  
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
    
    if(process.env.NEXT_PUBLIC_PROVE_SERVER_URI == undefined) throw(`Proving url not found`);
    
    const shielded = await walletApi.getShieldedAddresses();
    const config = await walletApi.getConfiguration();
    const account = await walletApi.getUnshieldedAddress();
    const resolvedProofServer = process.env.NEXT_PUBLIC_PROVE_SERVER_URI;
    console.log(`Proof server url from env: `, process.env.NEXT_PUBLIC_PROVE_SERVER_URI);
    const zkConfigProvider = new FetchZkConfigProvider(zkBasePath, fetch.bind(window));

    const accountId: string = account.unshieldedAddress;
    const privateStoragePasswordProvider = () => {
      const key = `veil-private-state-password:${accountId.toUpperCase()}`;
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const generated = `${bytesToHex(browserRandomBytes(32))}!$&VeIl`;
      window.localStorage.setItem(key, generated);
      return generated;
    };

    return {
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
        privateStateStoreName: 'veil-deploy-private-state',
        accountId,
        privateStoragePasswordProvider,
      }),
      zkConfigProvider,
    };
  };

  const handleDeployBootstrap = async () => {
    if (!walletApi) {
      await connect();
      return;
    }

    setStage('deploying-bootstrap');
    setLogs([]);
    setContractAddress(null);
    setCircuitProgress(null);
    deployedApiRef.current = null;

    try {
      syncNetworkId(NETWORK_ID);
      addLog('Connecting to preprod network...');

      const { DynamicContractAPI } = await import('nite-api');
      const bootstrapZkPath = new URL('/zk/bootstrap', window.location.origin).toString();
      const providers = await buildProviders(walletApi, bootstrapZkPath);

      addLog('Deploying bootstrap contract (3 circuits)...');
      const bootstrapCompiledContract = makeBootstrapCompiledContract(bootstrapZkPath);

      const api = await DynamicContractAPI.deploy({
        providers: providers as any,
        compiledContract: bootstrapCompiledContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createVeilPrivateState(browserRandomBytes(32)),
        args: [browserRandomBytes(32), BigInt(Date.now())],
      });

      deployedApiRef.current = { api, providers };
      setContractAddress(api.deployedContractAddress);
      addLog(`Bootstrap contract deployed at: ${api.deployedContractAddress}`, 'success');
      setStage('idle');
    } catch (err) {
      addLog(`Deploy failed: ${serializeError(err)}`, 'error');
      setStage('error');
    }
  };

  const handleInstallFullCircuits = async () => {
    if (!deployedApiRef.current) {
      addLog('Deploy bootstrap contract first.', 'error');
      return;
    }

    setStage('installing-circuits');
    setCircuitProgress({ done: 0, total: FULL_CIRCUITS.length });

    try {
      syncNetworkId(NETWORK_ID);
      const { createCircuitMaintenanceTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');
      const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');

      if (process.env.NEXT_PUBLIC_PROVE_SERVER_URI == undefined) throw new Error('NEXT_PUBLIC_PROVE_SERVER_URI is not set');
      const resolvedProofServer = process.env.NEXT_PUBLIC_PROVE_SERVER_URI;
      const fullZkPath = new URL('/zk/full', window.location.origin).toString();
      const fullZkConfigProvider = new FetchZkConfigProvider(fullZkPath, fetch.bind(window));

      const { providers, api } = deployedApiRef.current;
      const fullProviders = {
        ...providers,
        zkConfigProvider: fullZkConfigProvider,
        proofProvider: httpClientProofProvider(resolvedProofServer, fullZkConfigProvider),
      };

      const fullCompiledContract = makeFullCompiledContract(fullZkPath);
      const address = api.deployedContractAddress;

      addLog(`Installing ${FULL_CIRCUITS.length} verifier keys for full contract...`);

      for (let i = 0; i < FULL_CIRCUITS.length; i++) {
        const circuitId = FULL_CIRCUITS[i];
        addLog(`Installing: ${circuitId}`);

        const [[, verifierKey]] = await fullZkConfigProvider.getVerifierKeys([circuitId as any]);
        const contractState = await fullProviders.publicDataProvider.queryContractState(address);
        const maintenanceTx = createCircuitMaintenanceTxInterface(
          fullProviders as any,
          circuitId as any,
          fullCompiledContract,
          address,
        );

        if (contractState?.operation(circuitId) != null) {
          await maintenanceTx.removeVerifierKey();
        }
        await maintenanceTx.insertVerifierKey(verifierKey);

        setCircuitProgress({ done: i + 1, total: FULL_CIRCUITS.length });
        addLog(`Installed: ${circuitId}`, 'success');
      }

      addLog('All circuits installed. Contract is fully operational.', 'success');
      setStage('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Circuit installation failed: ${msg}`, 'error');
      setStage('error');
    }
  };

  const isDeploying = stage === 'deploying-bootstrap';
  const isInstalling = stage === 'installing-circuits';
  const isBusy = isDeploying || isInstalling;

  return (
    <div className="min-h-screen bg-[#040c12] text-white">
      <nav className="border-b border-[#1a2535] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-[#00e5c0] font-semibold tracking-wide hover:opacity-80 transition-opacity">
          ← Veil Protocol
        </Link>
        <span className="text-xs text-[#4a5568] uppercase tracking-widest">Preprod Deploy</span>
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

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Deploy Veil Contract</h1>
          <p className="text-sm text-[#4a5568]">
            Two-stage deployment: bootstrap contract first (3 circuits), then upgrade to full contract (17 circuits).
          </p>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-[#4a5568]">Proof Server URL</label>
            <input
              type="text"
              value={proofServerUri}
              onChange={(e) => setProofServerUri(e.target.value)}
              placeholder="Auto-detected from wallet config"
              className="w-full rounded-xl px-3 py-2 bg-[#040c12] text-white text-sm border border-[#1a2535] focus:outline-none focus:border-[#00e5c0] placeholder-[#2d3748]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-[#4a5568]">Stage 1 — Bootstrap Contract</p>
              <p className="text-xs text-[#2d3748]">
                Circuits: {BOOTSTRAP_CIRCUITS.join(', ')}
              </p>
            </div>
            <button
              onClick={() => void handleDeployBootstrap()}
              disabled={isBusy || (!isConnected && isConnecting)}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: '#00e5c0', color: '#062019' }}
            >
              {isDeploying
                ? 'Deploying Bootstrap...'
                : !isConnected
                ? 'Connect Wallet & Deploy Bootstrap'
                : contractAddress
                ? 'Redeploy Bootstrap Contract'
                : 'Deploy Bootstrap Contract'}
            </button>
          </div>

          {contractAddress && (
            <div className="space-y-1 p-4 rounded-xl bg-[#040c12] border border-[#1a2535]">
              <p className="text-xs uppercase tracking-widest text-[#4a5568]">Deployed Contract Address</p>
              <p className="text-sm font-mono text-[#00e5c0] break-all">{contractAddress}</p>
            </div>
          )}

          <div className="border-t border-[#1a2535] pt-5 space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-[#4a5568]">Stage 2 — Install Full Circuits</p>
              <p className="text-xs text-[#2d3748]">
                Adds {FULL_CIRCUITS.length} verifier keys, enabling all protocol operations.
              </p>
            </div>

            {circuitProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#4a5568]">
                  <span>Installing circuits</span>
                  <span>{circuitProgress.done}/{circuitProgress.total}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1a2535] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(circuitProgress.done / circuitProgress.total) * 100}%`,
                      background: '#00e5c0',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => void handleInstallFullCircuits()}
              disabled={isBusy || !contractAddress}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: '#1c242f', color: '#e2e8f0', border: '1px solid #2d3748' }}
            >
              {isInstalling ? 'Installing Circuits...' : 'Install Full Circuits'}
            </button>
          </div>

          {stage === 'done' && (
            <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#0a1f16', color: '#00e5c0', border: '1px solid #00e5c033' }}>
              Contract fully deployed and operational at {contractAddress}
            </div>
          )}
        </div>

        {logs.length > 0 && (
          <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0d141c', border: '1px solid #1a2535' }}>
            <p className="text-xs uppercase tracking-widest text-[#4a5568] mb-3">Deploy Log</p>
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
          </div>
        )}
      </main>
    </div>
  );
}
