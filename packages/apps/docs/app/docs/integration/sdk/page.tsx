import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import CodeBlock from "../../../../components/code-block";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "SDK Guide",
  description: "Build dApps and protocol integrations with @veil-reputation-protocol/sdk and @veil-protocol/react.",
};

const tocItems = [
  { id: "overview", text: "What the SDK does", depth: 2 },
  { id: "packages", text: "Packages", depth: 2 },
  { id: "urls", text: "Required URLs", depth: 2 },
  { id: "install", text: "Install", depth: 2 },
  { id: "config", text: "Configuration", depth: 2 },
  { id: "provider", text: "Midnight Provider", depth: 2 },
  { id: "client", text: "VeilClient", depth: 2 },
  { id: "react", text: "React SDK", depth: 2 },
  { id: "readers", text: "Signal Readers", depth: 2 },
  { id: "backend", text: "Backend Calls", depth: 2 },
  { id: "contracts", text: "Contract Tooling", depth: 2 },
  { id: "production", text: "Production Checklist", depth: 2 },
];

const install = `bun add @veil-reputation-protocol/sdk
bun add @veil-protocol/react

# React package peers
bun add react @ckb-ccc/connector-react`;

const env = `NEXT_PUBLIC_BACKEND_URL=https://api.your-app.example/api/v1
NEXT_PUBLIC_CONTRACT_ADDRESS=91e61119a150d2d00aa409bf077537353a6cea1a2cbd0a449c18b4ca531a7400
NEXT_PUBLIC_MIDNIGHT_NETWORK=preview
NEXT_PUBLIC_PROOF_SERVER_URL=https://proof.your-app.example
NEXT_PUBLIC_INDEXER_URL=https://indexer.preview.midnight.network/api/v4/graphql
NEXT_PUBLIC_INDEXER_WS_URL=wss://indexer.preview.midnight.network/api/v4/graphql/ws
NEXT_PUBLIC_ZK_CONFIG_BASE_URL=https://your-s3-bucket.s3.amazonaws.com/veil-protocol
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_CKB_RPC_URL=https://testnet.ckb.dev/rpc
NEXT_PUBLIC_EVM_CHAIN_RPCS='{"base":{"rpcUrl":"https://base.example","chainId":8453},"arbitrum":{"rpcUrl":"https://arb1.example","chainId":42161}}'`;

const config = `import type { VeilConfig } from '@veil-reputation-protocol/sdk';

export const veilConfig: VeilConfig = {
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
  network: process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK as 'preview' | 'preprod' | 'mainnet',
  proofServerUrl: process.env.NEXT_PUBLIC_PROOF_SERVER_URL,
  feeSponsorUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  midnightRpc: process.env.NEXT_PUBLIC_INDEXER_URL,
  midnightIndexerWsUrl: process.env.NEXT_PUBLIC_INDEXER_WS_URL,
  zkArtifactsBaseUrl: process.env.NEXT_PUBLIC_ZK_CONFIG_BASE_URL,
  chains: {
    ethereum: {
      rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL!,
      chainId: 1,
    },
    ckb: process.env.NEXT_PUBLIC_CKB_RPC_URL
      ? { rpcUrl: process.env.NEXT_PUBLIC_CKB_RPC_URL }
      : undefined,
    // Any other EVM-compatible chain can be included here.
    base: { rpcUrl: 'https://base.example', chainId: 8453 },
    arbitrum: { rpcUrl: 'https://arb1.example', chainId: 42161 },
  },
};`;

const provider = `import { createDerivedProvider } from '@veil-reputation-protocol/sdk';

// signer is a wallet signer from your app. It must be able to sign a message.
const midnightProvider = await createDerivedProvider(signer, veilConfig);

// The provider now knows how to:
// - derive a Midnight wallet for this user
// - fetch hosted proving/verifier files from zkArtifactsBaseUrl
// - call the deployed Veil contract
// - ask the backend for DUST sponsorship when needed
await midnightProvider.callTx('Identity_register', ...args);

// Stop wallet sync when the page/app unmounts.
await midnightProvider.stop();`;

const client = `import { VeilClient } from '@veil-reputation-protocol/sdk';

const client = new VeilClient(veilConfig, midnightProvider, {
  deriveLockHashFromAddress: resolveCkbLockHash,
  reputationReaders: {
    ethereumReader: readFromYourIndexer,
    ckbReader: readFromYourCkbIndexer,
    // Required whenever you supply your own reader — see "Signal Readers" below.
    readerPolicyHash: myRegisteredPolicyHash,
  },
});

const identity = await client.deriveIdentity(signer);
const registration = await client.register(signer);
const proof = await client.proveReputation(signer);

const decision = await client.checkReputation(registration.veilId, {
  minimumBand: 'silver',
  purpose: 'access',
});

if (decision.meetsThreshold) {
  unlockYourFeature(decision);
}`;

const directFunctions = `import {
  deriveVeilId,
  DEFAULT_VEIL_ID_SALT,
  registerIdentity,
  proveReputation,
  checkReputation,
  batchCheckReputation,
  bandMeetsMinimum,
  padStringToBytes32,
} from '@veil-reputation-protocol/sdk';

const passes = bandMeetsMinimum('gold', 'silver'); // true
const purposeHash = padStringToBytes32('airdrop');
const veilId = deriveVeilId(lockHash, {
  chainNamespace: padStringToBytes32('evm'),
  salt: DEFAULT_VEIL_ID_SALT,
  contractAddress: config.contractAddress,
});`;

const reactProvider = `import { ccc } from '@ckb-ccc/connector-react';
import { createDerivedProvider } from '@veil-reputation-protocol/sdk';
import { VeilProvider } from '@veil-protocol/react';

function AppProviders({ children }: { children: React.ReactNode }) {
  const signer = ccc.useSigner();
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!signer) return;

    let stopped = false;
    let activeProvider: Awaited<ReturnType<typeof createDerivedProvider>> | null = null;

    createDerivedProvider(signer, veilConfig).then((nextProvider) => {
      activeProvider = nextProvider;
      if (stopped) {
        void nextProvider.stop();
        return;
      }
      setProvider(nextProvider);
    });

    return () => {
      stopped = true;
      void activeProvider?.stop();
    };
  }, [signer]);

  return (
    <VeilProvider config={veilConfig} midnightProvider={provider ?? undefined}>
      {children}
    </VeilProvider>
  );
}`;

const reactUsage = `import { VeilGate, VeilRegister, useIdentity, useReputationCheck } from '@veil-protocol/react';

function BandPanel() {
  const { identity, status, register } = useIdentity();
  const { decision, loading } = useReputationCheck({
    veilId: identity?.veilId,
    minimumBand: 'silver',
    purpose: 'governance',
  });

  if (status === 'unregistered') {
    return <button onClick={() => void register()}>Register Veil identity</button>;
  }

  if (loading) return <p>Checking band...</p>;
  return <p>Current band: {decision?.band ?? 'unranked'}</p>;
}

function AirdropClaim({ veilId }: { veilId: string }) {
  return (
    <VeilGate
      veilId={veilId}
      minimumBand="silver"
      purpose="airdrop"
      fallback={<p>Silver band is required for this claim.</p>}
    >
      <button>Claim airdrop</button>
    </VeilGate>
  );
}`;

const readers = `import type { EthereumSignalReader, CkbSignalReader } from '@veil-reputation-protocol/sdk';

export const ethereumReader: EthereumSignalReader = async (address, configs) => {
  const rows = await yourIndexer.lookupWallet(address, configs.map((c) => c.chainId));

  return {
    firstTxTimestamp: rows.firstSeenAt,
    contractsInteracted: rows.protocolContracts,
    governanceVotes: rows.daoVotes,
    lpPositions: rows.lpPositions,
    txTimestamps: rows.txTimestamps,
    transactionCount: rows.transactionCount,
    activeChains: rows.activeChains,
  };
};

export const ckbReader: CkbSignalReader = async (address) => {
  const rows = await yourCkbIndexer.lookupLock(address);
  return {
    contractsInteracted: rows.scriptHashes,
    txTimestamps: rows.txTimestamps,
    txCount: rows.txCount,
    tipBlockNumber: rows.tipBlockNumber,
    networkReachable: true,
  };
};`;

const sponsorship = `import { requestSponsorship } from '@veil-reputation-protocol/sdk';

await requestSponsorship(
  'mn_dust_preview1...',               // user's Midnight preview DUST address
  process.env.NEXT_PUBLIC_BACKEND_URL! // https://api.example.com/api/v1
);`;

const contractTooling = `import {
  FULL_CONTRACT_CIRCUITS,
  makeFullCompiledContract,
} from '@veil-reputation-protocol/sdk';

console.log(FULL_CONTRACT_CIRCUITS); // every callable contract function, by name

// Points the SDK at your hosted proof/verifier files for this contract.
const compiledContract = makeFullCompiledContract('/zk/veil-protocol');`;

const decisionShape = `type ReputationDecision = {
  veilId: string;
  meetsThreshold: boolean;
  band: 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum';
  communityWeight: number;
  accessTier: number;
  purpose: 'airdrop' | 'governance' | 'access' | 'incentive' | 'general';
  validAt: number;
  proofHash: string;
};`;

export default function SdkReferencePage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Integration" }, { label: "SDK Guide" }]} />

        <h1>SDK Guide</h1>
        <p className="prose-lead">
          The Veil SDK is the integration layer for protocols and dApps. It helps you connect a user
          wallet, derive a Veil identity, submit private proofs on Midnight, and check whether a user
          meets the band required for a specific app action.
        </p>

        <div className="doc-hero-panel">
          <div>
            <span className="section-label">For integrators</span>
            <h2 id="overview">What the SDK does</h2>
            <p>
              Veil gives your app a simple answer: <strong>does this wallet meet the level
              needed for this action?</strong> The SDK handles the details around identity, proof
              submission, band checks, and the optional backend calls needed for DUST.
            </p>
          </div>
          <div className="doc-mini-grid">
            {[
              ["Identity", "Derive and register a stable Veil ID."],
              ["Proofs", "Submit private band proofs to Midnight."],
              ["Checks", "Ask for bronze, silver, gold, or platinum access."],
              ["React", "Use hooks and gate components in a dApp."],
            ].map(([title, copy]) => (
              <div className="doc-mini-card" key={title}>
                <strong>{title}</strong>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </div>

        <Callout variant="info" title="Plain integration model">
          The backend does not decide a user&apos;s band. Your app uses the SDK to talk to the Veil contract.
          The backend is only for contract address discovery, DUST sponsorship, deployment, and optional encrypted backups.
        </Callout>

        <h2 id="packages">Packages</h2>
        <div className="doc-card-grid two">
          <div className="doc-card">
            <span className="section-label">Core</span>
            <h3>@veil-reputation-protocol/sdk</h3>
            <p>
              Framework-agnostic TypeScript package for dApps, protocol backends, CLIs, and deployment
              tooling. Use this when you want direct control over providers, readers, and transaction flow.
            </p>
          </div>
          <div className="doc-card">
            <span className="section-label">React</span>
            <h3>@veil-protocol/react</h3>
            <p>
              React provider, hooks, and small UI helpers built on top of the core SDK. Use this when
              you want to show registration state, band checks, or gated buttons inside a React app.
            </p>
          </div>
        </div>

        <h2 id="urls">Required URLs</h2>
        <p>
          A working app needs four things configured: where the contract lives, a proof server (this
          does the heavy cryptographic work of building a proof), a place to fetch the contract&apos;s
          compiled proof/verification files from (just static files on any HTTPS host — S3 works fine),
          and optionally your backend, if you want it to cover transaction fees for users.
        </p>
        <table>
          <thead>
            <tr>
              <th>Value</th>
              <th>Where it points</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>NEXT_PUBLIC_BACKEND_URL</code></td>
              <td>Your Veil backend, for example <code>https://api.example.com/api/v1</code>.</td>
              <td>Contract address lookup and DUST sponsorship.</td>
            </tr>
            <tr>
              <td><code>NEXT_PUBLIC_PROOF_SERVER_URL</code></td>
              <td>Your Midnight proof server.</td>
              <td>Provider calls that need proofs.</td>
            </tr>
            <tr>
              <td><code>NEXT_PUBLIC_ZK_CONFIG_BASE_URL</code></td>
              <td>Your S3/CloudFront URL for <code>veil-protocol</code> artifacts.</td>
              <td>Browser provider artifact fetches.</td>
            </tr>
            <tr>
              <td><code>NEXT_PUBLIC_CONTRACT_ADDRESS</code></td>
              <td>The deployed Veil contract from <code>GET /api/v1/contract</code>.</td>
              <td>All contract reads and writes.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="install">Install</h2>
        <CodeBlock code={install} language="bash" filename="terminal" />

        <h2 id="config">Configuration</h2>
        <p>
          These are the values most dApps need. Replace the S3 URL with your updated bucket path for
          the full <code>veil-protocol</code> artifact folder.
        </p>
        <CodeBlock code={env} language="bash" filename=".env.local" />
        <CodeBlock code={config} language="typescript" filename="veil-config.ts" />

        <Callout variant="tip" title="Backend address discovery">
          If you do not want to hardcode the contract address in the frontend, fetch it from
          <code> GET /api/v1/contract</code> during app startup and pass it into <code>VeilConfig</code>.
        </Callout>

        <h2 id="provider">Midnight Provider</h2>
        <p>
          The SDK needs a way to actually talk to Midnight — that&apos;s the &quot;provider.&quot; In a
          browser app, <code>createDerivedProvider</code> does this for you: it quietly creates a Midnight
          wallet tied to the user&apos;s connected wallet, and remembers it in browser storage so they
          don&apos;t have to redo this every visit.
        </p>
        <CodeBlock code={provider} language="typescript" filename="provider.ts" />

        <h2 id="client">VeilClient</h2>
        <p>
          <code>VeilClient</code> is the easiest way to integrate. It combines identity, proof submission,
          and band checks behind one object.
        </p>
        <CodeBlock code={client} language="typescript" filename="client.ts" />

        <h3>When to use direct functions</h3>
        <p>
          Use direct functions when you already have your own app state and only need one operation,
          such as a batch check for an airdrop list or a helper for encoding a purpose.
        </p>
        <CodeBlock code={directFunctions} language="typescript" filename="direct-functions.ts" />

        <h3>Decision shape</h3>
        <p>
          A check returns a compact decision. Your app should store the policy result it needs, not a
          user&apos;s raw history.
        </p>
        <CodeBlock code={decisionShape} language="typescript" filename="decision.ts" />

        <h2 id="react">React SDK</h2>
        <p>
          The React package wraps the core SDK with hooks and small components. It is useful for
          dashboards, claim pages, gated communities, DAO voting pages, and any app that wants a clear
          registration/check flow.
        </p>
        <CodeBlock code={reactProvider} language="tsx" filename="AppProviders.tsx" />
        <CodeBlock code={reactUsage} language="tsx" filename="BandPanel.tsx" />

        <div className="doc-card-grid three">
          <div className="doc-card">
            <h3>useIdentity</h3>
            <p>Derives the user&apos;s Veil ID, checks whether it is registered, and exposes a register action.</p>
          </div>
          <div className="doc-card">
            <h3>useReputationCheck</h3>
            <p>Checks whether a Veil ID meets the band required for a purpose such as access or airdrops.</p>
          </div>
          <div className="doc-card">
            <h3>VeilGate</h3>
            <p>Renders children only when a user passes the requested threshold.</p>
          </div>
        </div>

        <h2 id="readers">Signal Readers</h2>
        <p>
          A reader turns public chain activity into the small set of signals Veil understands. Protocols
          can start with built-in readers, then replace them with their own indexers for better coverage.
        </p>
        <CodeBlock code={readers} language="typescript" filename="readers.ts" />

        <h3>Proving where the data came from</h3>
        <p>
          Every reputation proof carries a <code>readerPolicyHash</code> — a short ID for &quot;which
          reader produced these numbers.&quot; The Veil contract keeps an allow-list of IDs it trusts,
          controlled by governance, and rejects any proof whose ID isn&apos;t on it. This check happens
          on-chain, as part of the same proof, not as a note attached afterward.
        </p>
        <p>
          If you use the built-in readers shown above, you don&apos;t need to do anything — they already
          stamp a known ID (<code>veil.default-rpc.v1</code>) that&apos;s registered from day one. If you
          supply your own <code>ethereumReader</code> or <code>ckbReader</code>, you also need to: pick a
          unique ID for it, have it added to the contract&apos;s allow-list (a governance action, same
          process as adding a new chain), and pass that ID as <code>readerPolicyHash</code> alongside your
          reader. Skip that last step and the SDK refuses to build the proof and tells you what&apos;s
          missing, rather than silently mislabeling your data as coming from the default reader.
        </p>

        <h2 id="backend">Backend Calls</h2>
        <p>
          The SDK only calls the backend for support tasks. It does not ask the backend for a band
          decision. The two most common backend calls are contract address lookup and DUST sponsorship.
        </p>
        <CodeBlock code={sponsorship} language="typescript" filename="sponsorship.ts" />
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>GET /api/v1/contract</code></td>
              <td>Returns the active Veil contract address and whether backend deployment is enabled.</td>
            </tr>
            <tr>
              <td><code>POST /api/v1/sponsor/dust</code></td>
              <td>Requests DUST generation for the user&apos;s DUST address.</td>
            </tr>
            <tr>
              <td><code>PUT /api/v1/backups/:backupId</code></td>
              <td>Stores an encrypted client backup. Plain keys or plaintext private state should never be uploaded.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="contracts">Contract Tooling</h2>
        <p>
          If you&apos;re writing a deploy script or a CLI, these low-level exports let you check exactly
          which contract functions are available and point at the compiled contract files.
        </p>
        <CodeBlock code={contractTooling} language="typescript" filename="deployment.ts" />

        <h2 id="production">Production Checklist</h2>
        <ul>
          <li>Serve ZK artifacts from a stable HTTPS URL such as S3 plus CloudFront.</li>
          <li>Confirm <code>GET /api/v1/contract</code> returns the same address configured in the app.</li>
          <li>Use a production proof server URL, not a local Docker URL.</li>
          <li>Use your own chain readers/indexers for the public signals that matter to your protocol.</li>
          <li>Keep backend backups encrypted in the browser before upload.</li>
          <li>Treat bands as policy hints. Your protocol still chooses what each band unlocks.</li>
        </ul>

        <PrevNext
          prev={{ title: "Integration Guide", href: "/docs/integration", description: "End-to-end protocol flow" }}
          next={{ title: "Backend API", href: "/docs/integration/api-reference", description: "Backend endpoint reference" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
