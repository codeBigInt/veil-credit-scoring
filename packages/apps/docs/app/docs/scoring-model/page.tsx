import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Reputation Model",
  description: "How Veil Protocol v2 maps private social and protocol signals to reputation bands.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "signals", text: "Signals", depth: 2 },
  { id: "bands", text: "Bands", depth: 2 },
  { id: "commitments", text: "Commitments", depth: 2 },
  { id: "governance", text: "Governance", depth: 2 },
];

const config = `{
  baseScore: 300n,
  maxScore: 900n,
  walletAgeWeight: 3n,
  protocolWeight: 15n,
  daoWeight: 20n,
  lpWeight: 10n,
  crossChainWeight: 25n,
  consistencyWeight: 5n,
  bronzeThreshold: 400n,
  silverThreshold: 550n,
  goldThreshold: 700n,
  platinumThreshold: 820n,
}`;

export default function ScoringModelPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Reputation Model" }, { label: "Overview" }]} />

        <h1>Reputation Model</h1>
        <p className="prose-lead">
          This isn&apos;t a credit score in the traditional sense — Veil looks at general on-chain
          behavior (how established a wallet is, how broadly it&apos;s used DeFi) and turns it into a
          score. That score is never shown to anyone; only the band it falls into is.
        </p>

        <h2 id="overview">How a Proof Gets Made</h2>
        <p>
          When a user proves their reputation, the SDK sends their activity numbers to the contract.
          The contract checks the numbers are within sane limits, works out the score and band itself
          from those numbers (using the current scoring rules), and saves the result. The user never
          gets to just declare &quot;I&apos;m gold&quot; — the contract always does that math itself.
        </p>

        <Callout variant="info" title="Band, not dossier">
          Design your app around the bands — <code>bronze</code>, <code>silver</code>, <code>gold</code>,{" "}
          <code>platinum</code> — as your policy levels. Don&apos;t expect (or ask for) the exact score,
          the wallet&apos;s history, or any other behavioral detail. Veil doesn&apos;t hand those out.
        </Callout>

        <h2 id="signals">What Goes Into the Score</h2>
        <table>
          <thead>
            <tr><th>Signal</th><th>What it measures</th></tr>
          </thead>
          <tbody>
            <tr><td><code>walletAgeInDays</code></td><td>How long the wallet has been active on-chain.</td></tr>
            <tr><td><code>distinctProtocols</code></td><td>How many different protocols it has used.</td></tr>
            <tr><td><code>daoVoteCount</code></td><td>How much it participates in governance voting.</td></tr>
            <tr><td><code>lpTenureInDays</code></td><td>How long it has provided liquidity somewhere.</td></tr>
            <tr><td><code>crossChainCount</code></td><td>How many different chains it&apos;s active on.</td></tr>
            <tr><td><code>txConsistencyScore</code></td><td>Whether activity is steady over time, rather than one burst.</td></tr>
          </tbody>
        </table>

        <h2 id="bands">How Bands Are Set</h2>
        <p>
          Each signal is weighted and added up into a score, and the score determines the band. These
          are today&apos;s default weights and cutoffs — governance can change them later (see below).
        </p>
        <CodeBlock code={config} language="typescript" filename="DEFAULT_SCORE_CONFIG" />

        <h2 id="commitments">How Privacy Is Preserved</h2>
        <p>
          Every proof is sealed with a few layers of cryptographic commitments — think of them as tamper-evident
          envelopes. One seals the raw activity data. Another seals the whole set of signals plus which
          reader collected them. A final one seals the complete proof, tying it to a one-time-use number
          so the same proof can&apos;t be replayed twice. None of these envelopes reveal their contents;
          they only prove that whatever&apos;s inside hasn&apos;t been altered.
        </p>

        <h2 id="governance">Governance</h2>
        <p>
          Changing the scoring weights or band cutoffs isn&apos;t instant. Someone proposes a change, and
          it has to wait out a fixed delay before it can be applied — so nobody can spring a change on
          users with no warning. In production, that proposal power should belong to a DAO or a
          multi-party process, not a single wallet.
        </p>

        <PrevNext
          prev={{ title: "Quick Start", href: "/docs/quick-start", description: "Use v2" }}
          next={{ title: "Integration Guide", href: "/docs/integration", description: "Integrate reputation checks" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
