import type { Metadata } from "next";
import ArchitectureToggle from "../../../components/architecture-toggle";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Introduction",
  description: "Veil Protocol v2 is private, cross-chain social reputation for DeFi and on-chain communities.",
};

const tocItems = [
  { id: "what-is-veil", text: "What Is Veil?", depth: 2 },
  { id: "architecture-version", text: "Architecture Version", depth: 2 },
  { id: "how-it-works", text: "How It Works", depth: 2 },
  { id: "privacy", text: "Privacy Model", depth: 2 },
  { id: "roles", text: "System Roles", depth: 2 },
];

export default function IntroductionPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Getting Started" }, { label: "Introduction" }]} />

        <h1>Introduction</h1>
        <p className="prose-lead">
          Veil lets someone prove they&apos;re a trustworthy wallet — active, established, plugged into
          real protocols — without showing anyone their actual transaction history. Apps get a simple
          badge (a &quot;band&quot;), never the raw data behind it.
        </p>

        <Callout variant="info" title="v2 direction">
          Veil started as a credit-scoring tool. It&apos;s now broader: general-purpose reputation for
          DAOs, communities, airdrops, and access gates. Lending is just one thing you could build with it.
        </Callout>

        <h2 id="what-is-veil">What Is Veil?</h2>
        <p>
          Think of it like a credit score, but private and on-chain. Veil looks at a wallet&apos;s public
          activity — how old it is, how many protocols it&apos;s used, how consistently — and turns that
          into one of five bands: <strong>unranked, bronze, silver, gold,</strong> or <strong>platinum</strong>.
          An app can then say &quot;you need at least silver to claim this airdrop&quot; without ever
          seeing the wallet&apos;s transaction list.
        </p>
        <p>
          The user stays in control the whole time. Their own device reads the public chain data, does
          the private math, and submits the result to Midnight — nobody&apos;s backend server is deciding
          what band a user gets. That&apos;s the key shift from how this used to work: there&apos;s no
          central service you have to trust to score people fairly.
        </p>

        <h2 id="architecture-version">Architecture Version</h2>
        <ArchitectureToggle />

        <h2 id="how-it-works">How It Works</h2>
        <ol>
          <li>A user connects one wallet (any EVM-compatible wallet works) in the Veil app or your app.</li>
          <li>Behind the scenes, the SDK derives a stable Veil ID for that wallet.</li>
          <li>The user signs a message to register that ID — this just proves they own the wallet, it doesn&apos;t move any funds.</li>
          <li>The SDK looks at the wallet&apos;s public activity and submits a reputation proof.</li>
          <li>Your app asks Veil: &quot;does this ID meet band X?&quot; and gets a yes/no back.</li>
        </ol>

        <h2 id="privacy">Privacy Model</h2>
        <p>
          Your app only ever sees the band — bronze, gold, whatever the user qualifies for. It never
          sees the wallet&apos;s actual history, the exact numbers behind the score, or any of the
          random values used to keep the proof private. Veil hands you exactly what you need to make a
          decision, and nothing more.
        </p>

        <h2 id="roles">System Roles</h2>
        <table>
          <thead>
            <tr><th>Role</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr><td>User</td><td>Owns the wallet, registers their identity, generates their own proof, and can back up their data.</td></tr>
            <tr><td>Integrator (you)</td><td>Asks Veil whether a user meets a minimum band before letting them do something.</td></tr>
            <tr><td>SDK</td><td>The toolkit that does identity, data-reading, proof, and band-check work for your app.</td></tr>
            <tr><td>Backend</td><td>A small helper service — deploys the contract, hands out the contract address, covers transaction fees, and optionally stores encrypted backups. It never decides anyone&apos;s band.</td></tr>
            <tr><td>Governance</td><td>The process (community-controlled, not one person) for changing how scores are calculated, with a delay before changes take effect.</td></tr>
          </tbody>
        </table>

        <PrevNext
          prev={{ title: "Docs Home", href: "/", description: "Documentation overview" }}
          next={{ title: "Quick Start", href: "/docs/quick-start", description: "Run the v2 flow" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
