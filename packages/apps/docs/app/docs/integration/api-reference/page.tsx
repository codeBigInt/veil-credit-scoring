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
          The backend is deliberately small — it does not decide anyone&apos;s reputation. It just
          handles a few support jobs: telling your app where the contract is, deploying it if needed,
          covering transaction fees, and optionally storing encrypted backups.
        </p>

        <h2 id="scope">All Endpoints</h2>
        <ul>
          <li><code>GET /api/v1/health</code> — is the backend up?</li>
          <li><code>GET /api/v1/contract</code> — where&apos;s the contract deployed?</li>
          <li><code>POST /api/v1/contract/deploy</code> — deploy a new contract instance.</li>
          <li><code>POST /api/v1/sponsor/dust</code> — cover this user&apos;s transaction fees.</li>
          <li><code>PUT /api/v1/backups/:backupId</code> — store an encrypted backup.</li>
          <li><code>GET /api/v1/backups/:backupId?owner=...</code> — fetch one backup.</li>
          <li><code>GET /api/v1/backups?owner=...</code> — list a user&apos;s backups.</li>
          <li><code>DELETE /api/v1/backups/:backupId?owner=...</code> — delete a backup.</li>
        </ul>

        <h2 id="contract">Contract Address</h2>
        <CodeBlock code={contract} language="http" filename="contract.http" />
        <p>
          Call this when your app starts up to find out which contract address to use, instead of
          hardcoding it. It comes from whatever contract the backend has on record as the active one.
        </p>

        <h2 id="deploy">Deploy Contract</h2>
        <CodeBlock code={deploy} language="http" filename="deploy.http" />
        <p>
          Deploys a fresh copy of the Veil contract. This is an operator/admin action, not something a
          typical integration calls — it&apos;s turned off by default and has to be explicitly enabled.
        </p>

        <h2 id="sponsor">Dust Sponsorship</h2>
        <CodeBlock code={sponsor} language="http" filename="dust.http" />
        <p>
          Midnight transactions need a small amount of DUST to pay for themselves. This endpoint lets
          your backend cover that cost so users don&apos;t need to hold DUST themselves. It only ever
          pays fees — it has no ability to change a user&apos;s reputation or bypass any contract check.
        </p>

        <h2 id="backups">Backups</h2>
        <CodeBlock code={backup} language="http" filename="backup.http" />
        <Callout variant="warning" title="Encrypt before upload">
          Whatever you send here must already be encrypted on the user&apos;s own device before it
          leaves the browser. Never send raw private keys, seed phrases, or unencrypted private data
          to the backend — it should only ever see ciphertext it can&apos;t read.
        </Callout>

        <h2 id="deprecated">No Longer Available</h2>
        <p>
          Some older endpoints from an earlier version of Veil — things like{" "}
          <code>/credit-decisions</code>, <code>/score-entries</code>, <code>/challenges</code>, and the
          issuer/event endpoints — don&apos;t exist anymore. If you see them mentioned anywhere, that
          reference is outdated; don&apos;t build against them.
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
