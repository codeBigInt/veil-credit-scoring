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
          Veil v2 scores social and protocol behavior, not traditional creditworthiness. The result
          is a private score mapped to a public band that apps can use for policy.
        </p>

        <h2 id="overview">Overview</h2>
        <p>
          `Reputation_prove` accepts private witness signals and source-chain commitments. The
          contract validates bounds, recomputes the witness commitment, derives the proof binding,
          verifies the claimed band, and stores the reputation record.
        </p>

        <Callout variant="info" title="Band, not dossier">
          Integrators should design around `bronze`, `silver`, `gold`, and `platinum` policies. They
          should not expect raw scores, linked wallet history, or user-specific behavioral detail.
        </Callout>

        <h2 id="signals">Signals</h2>
        <table>
          <thead>
            <tr><th>Signal</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>walletAgeInDays</code></td><td>Longevity of public on-chain activity.</td></tr>
            <tr><td><code>distinctProtocols</code></td><td>Breadth of protocol participation.</td></tr>
            <tr><td><code>daoVoteCount</code></td><td>Governance activity and community participation.</td></tr>
            <tr><td><code>lpTenureInDays</code></td><td>Liquidity contribution duration.</td></tr>
            <tr><td><code>crossChainCount</code></td><td>Verified activity across supported chains.</td></tr>
            <tr><td><code>txConsistencyScore</code></td><td>Steady, non-bursty participation.</td></tr>
          </tbody>
        </table>

        <h2 id="bands">Bands</h2>
        <p>
          The default score config maps private scores to five bands. Governance can update these
          thresholds through a timelocked DAO-controlled path.
        </p>
        <CodeBlock code={config} language="typescript" filename="DEFAULT_SCORE_CONFIG" />

        <h2 id="commitments">Commitments</h2>
        <p>
          Chain commitments bind source-chain observations without exposing all underlying data.
          The witness commitment binds the identity, signal values, source commitments, and witness
          salt. The proof hash then binds the witness commitment, score config, claimed band, and nonce.
        </p>

        <h2 id="governance">Governance</h2>
        <p>
          Governance proposals update scoring weights and thresholds after a timelock. Production
          deployments should use a DAO-controlled key or governance contract for the controller
          commitment.
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
