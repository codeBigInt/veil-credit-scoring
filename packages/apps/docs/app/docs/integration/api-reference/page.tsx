import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import CodeBlock from "../../../../components/code-block";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "Backend API Reference",
  description: "Veil v2 backend endpoints for deployment, contract discovery, DUST sponsorship, and backups.",
};

const tocItems = [
  { id: "scope", text: "Scope", depth: 2 },
  { id: "contract", text: "Contract Address", depth: 2 },
  { id: "deploy", text: "Deploy Contract", depth: 2 },
  { id: "sponsor", text: "Dust Sponsorship", depth: 2 },
  { id: "backups", text: "Backups", depth: 2 },
  { id: "deprecated", text: "Deprecated", depth: 2 },
];

const contract = `GET /api/v1/contract

{
  "success": true,
  "contractAddress": "91e6...",
  "backendRole": "contract-deployer-dust-sponsor-and-backup",
  "deploymentEnabled": true
}`;

const deploy = `POST /api/v1/contract/deploy

{
  "success": true,
  "contractAddress": "91e6...",
  "deployed": true
}`;

const sponsor = `POST /api/v1/sponsor/dust

{
  "dustAddress": "mn_dust_preview1..."
}`;

const backup = `PUT /api/v1/backups/<backupId>

{
  "owner": "0x...",
  "kind": "private_state",
  "version": 1,
  "metadata": {
    "network": "preview",
    "contractAddress": "91e6..."
  },
  "payload": {
    "ciphertext": "...",
    "iv": "...",
    "kdf": "..."
  }
}`;

export default function ApiReferencePage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Integration" }, { label: "Backend API" }]} />

        <h1>Backend API Reference</h1>
        <p className="prose-lead">
          The v2 backend is intentionally small. It can deploy the Veil contract, return the active
          contract address, sponsor DUST, and store optional encrypted backups. Reputation decisions
          are performed through the SDK and Midnight contract.
        </p>

        <h2 id="scope">Scope</h2>
        <ul>
          <li><code>GET /api/v1/health</code></li>
          <li><code>GET /api/v1/contract</code></li>
          <li><code>POST /api/v1/contract/deploy</code></li>
          <li><code>POST /api/v1/sponsor/dust</code></li>
          <li><code>PUT /api/v1/backups/:backupId</code></li>
          <li><code>GET /api/v1/backups/:backupId?owner=...</code></li>
          <li><code>GET /api/v1/backups?owner=...</code></li>
          <li><code>DELETE /api/v1/backups/:backupId?owner=...</code></li>
        </ul>

        <h2 id="contract">Contract Address</h2>
        <CodeBlock code={contract} language="http" filename="contract.http" />
        <p>
          Use this endpoint to configure the frontend SDK. The address may come from
          <code> VEIL_CONTRACT_ADDRESS</code>, a saved Mongo deployment record, or a backend deployment.
        </p>

        <h2 id="deploy">Deploy Contract</h2>
        <CodeBlock code={deploy} language="http" filename="deploy.http" />
        <p>
          This route deploys the staged bootstrap contract and installs the missing full-contract
          verifier keys. It is disabled unless <code>VEIL_AUTO_DEPLOY=true</code>.
        </p>

        <h2 id="sponsor">Dust Sponsorship</h2>
        <CodeBlock code={sponsor} language="http" filename="dust.http" />
        <p>
          The backend registers available NIGHT UTxOs to generate DUST for the supplied address.
          It cannot transfer reputation or bypass contract checks.
        </p>

        <h2 id="backups">Backups</h2>
        <CodeBlock code={backup} language="http" filename="backup.http" />
        <Callout variant="warning" title="Encrypt before upload">
          Backup payloads must be encrypted client-side. Do not send raw private keys, seed phrases,
          or plaintext private state to the backend.
        </Callout>

        <h2 id="deprecated">Deprecated</h2>
        <p>
          `/credit-decisions`, `/score-entries`, `/challenges`, `/ckb/veil-identity/*`, and issuer
          event endpoints were v1 architecture surfaces. New integrations should not call them.
        </p>

        <PrevNext
          prev={{ title: "SDK Guide", href: "/docs/integration/sdk", description: "Use the SDK" }}
          next={{ title: "Architecture", href: "/docs/concepts", description: "System architecture" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
