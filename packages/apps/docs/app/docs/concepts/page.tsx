import type { Metadata } from "next";
import ArchitectureToggle from "../../../components/architecture-toggle";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Architecture",
  description: "Veil Protocol v2 architecture for private cross-chain reputation.",
};

const tocItems = [
  { id: "version", text: "Version Toggle", depth: 2 },
  { id: "layers", text: "v2 Layers", depth: 2 },
  { id: "circuits", text: "Contract Circuits", depth: 2 },
  { id: "backend", text: "Backend Scope", depth: 2 },
  { id: "trust", text: "Trust Boundaries", depth: 2 },
];

export default function ConceptsPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Concepts" }, { label: "Architecture" }]} />

        <h1>Architecture</h1>
        <p className="prose-lead">
          This page is for anyone who wants to know how the pieces fit together, not just how to call
          them. At a high level: a smart contract on Midnight, a TypeScript SDK that talks to it, some
          code that reads public wallet activity, a service that turns that activity into a private proof,
          and a small backend that handles the boring parts (paying fees, storing backups).
        </p>

        <h2 id="version">Version Toggle</h2>
        <ArchitectureToggle />

        <h2 id="layers">The Pieces</h2>
        <table>
          <thead>
            <tr><th>Piece</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Wallet</td>
              <td>The user connects one familiar wallet (MetaMask or similar). The SDK quietly derives a separate, stable Veil ID from it.</td>
            </tr>
            <tr>
              <td>Reader</td>
              <td>Looks up a wallet&apos;s public activity — age, protocols used, etc. Veil ships a basic default; protocols can swap in their own for better data.</td>
            </tr>
            <tr>
              <td>Proof</td>
              <td>Takes that activity and produces a proof that says &quot;this wallet qualifies for band X&quot; — without revealing the activity itself.</td>
            </tr>
            <tr>
              <td>Midnight contract</td>
              <td>The on-chain source of truth. It registers identities, checks that proofs are genuine, stores the results privately, and answers band questions.</td>
            </tr>
            <tr>
              <td>Backend</td>
              <td>Covers transaction fees and optionally stores encrypted backups. It has no say in what band anyone gets.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="circuits">What's Inside the Contract</h2>
        <p>
          The contract is written in Compact (Midnight&apos;s smart contract language) and split into a
          few jobs, each one a &quot;circuit&quot; — think of a circuit as one callable function that can
          also generate or check a privacy proof.
        </p>
        <ul>
          <li><code>Identity_register</code>: saves a new Veil identity for a wallet.</li>
          <li><code>Reputation_prove</code>: checks a user&apos;s activity numbers are sensible, works out their band from those numbers, and stores the result.</li>
          <li><code>Reputation_check</code>: answers &quot;does this user meet band X, for this purpose?&quot;</li>
          <li><code>Governance_*</code>: lets the community propose and apply changes to how scoring works, with a mandatory waiting period before a change takes effect.</li>
          <li><code>Utils_*</code>: small shared helper functions the other circuits use internally.</li>
        </ul>

        <Callout variant="tip" title="Why do circuit calls take so many arguments?">
          The contract never assumes anything the SDK tells it is true just because the SDK said so —
          it re-derives and double-checks everything itself from the values it&apos;s given. That&apos;s
          why circuit calls look verbose: every value the contract needs to verify has to actually be
          passed in, not implied.
        </Callout>

        <h2 id="backend">What the Backend Doesn't Do</h2>
        <p>
          It&apos;s worth being explicit here: the backend does not decide anyone&apos;s reputation, does
          not store credit decisions, and does not run any of the older (v1) credit-scoring machinery.
          Today it only does three things: contract info, fee sponsorship, and optional encrypted backups.
        </p>

        <h2 id="trust">Who You Have to Trust</h2>
        <ul>
          <li>The SDK is just a toolkit — it doesn&apos;t make decisions, it just calls the contract.</li>
          <li>The proof server does one job (generate proofs) and keeps no records; you can run your own instead of using Veil&apos;s.</li>
          <li>The backend physically cannot change what band a user has — that lives on Midnight, not in a database it controls.</li>
          <li>Changes to scoring rules should go through a DAO or multi-party process, not one person&apos;s wallet.</li>
          <li>If you build backups, encrypt them on the user&apos;s device before you upload anything.</li>
        </ul>

        <PrevNext
          prev={{ title: "API Reference", href: "/docs/integration/api-reference", description: "Backend API" }}
          next={{ title: "Using Veil", href: "/docs/user-guide", description: "User flow and testnet notes" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
