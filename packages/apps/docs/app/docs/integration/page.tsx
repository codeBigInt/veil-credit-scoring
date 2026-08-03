import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Integration Guide",
  description: "Integrate with Veil Protocol v2 using the SDK and Midnight contract circuits.",
};

const tocItems = [
  { id: "model", text: "Integration Model", depth: 2 },
  { id: "sdk", text: "Use the SDK", depth: 2 },
  { id: "identity", text: "Identity Registration", depth: 2 },
  { id: "reputation", text: "Reputation Proofs", depth: 2 },
  { id: "checks", text: "Band Checks", depth: 2 },
  { id: "governance", text: "Governance Updates", depth: 2 },
];

const sdk = `import {
  VeilClient,
  checkReputation,
  collectReputationWitnessFromAddresses,
  type ReputationDecision,
} from '@veil-reputation-protocol/sdk';`;

const check = `const decision = await checkReputation(veilId, {
  minimumBand: 'silver',
  purpose: 'incentive',
  midnightProvider,
  config,
});

if (decision.meetsThreshold) {
  applyProtocolPolicy(decision);
}`;

export default function IntegrationPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Integration" }, { label: "Guide" }]} />

        <h1>Integration Guide</h1>
        <p className="prose-lead">
          Integrating Veil means three things: let a user register, let them prove their reputation,
          and ask for a band decision when you need one. All three happen through{" "}
          <code>@veil-reputation-protocol/sdk</code> talking directly to the Midnight contract — your backend
          doesn&apos;t need to be involved in any of it.
        </p>

        <Callout variant="warning" title="If you see references to an old REST scoring API, ignore them">
          Earlier versions of Veil had a backend that computed credit decisions directly (endpoints like{" "}
          <code>Admin_addIssuer</code> or <code>Scoring_submitRepaymentEvent</code>). None of that exists
          anymore. Everything now goes through the SDK and the Midnight contract.
        </Callout>

        <h2 id="model">The Basic Flow</h2>
        <ol>
          <li>Connect to the deployed Veil contract using its address.</li>
          <li>Register the user&apos;s identity with <code>Identity_register</code>.</li>
          <li>Submit their reputation proof with <code>Reputation_prove</code>.</li>
          <li>Whenever you need to gate something, check their band with <code>Reputation_check</code>.</li>
        </ol>

        <h2 id="sdk">Use the SDK</h2>
        <CodeBlock code={sdk} language="typescript" filename="imports.ts" />
        <p>
          You get a ready-made client for the common case, standalone functions if you only need one
          piece, ways to plug in your own data sources, and lower-level tooling for CLIs or deploy scripts.
        </p>

        <h2 id="identity">Identity Registration</h2>
        <p>
          This step works out a stable ID for the user&apos;s wallet, asks them to sign a message proving
          they own it (not a fund transfer — just a signature), and saves that registration on Midnight.
          If your setup covers transaction fees for users, that happens automatically here too.
        </p>

        <h2 id="reputation">Reputation Proofs</h2>
        <p>
          This is where a user&apos;s public activity turns into a private proof. The SDK&apos;s
          built-in reader works out of the box using public RPCs, but it&apos;s intentionally basic —
          for production, plug in your own reader backed by a real indexer so you get better signal.
        </p>

        <h2 id="checks">Band Checks</h2>
        <CodeBlock code={check} language="typescript" filename="check.ts" />
        <p>
          You get back whether the user meets the band you asked for, what their actual band is, and a
          couple of extra numbers (a weight and an access tier) your app can use however it wants.
        </p>

        <h2 id="governance">Governance Updates</h2>
        <p>
          The rules behind scoring (the weights, the band cutoffs) aren&apos;t fixed forever. They can be
          proposed and changed, but only after a mandatory waiting period — so a change can&apos;t take
          effect instantly and catch users off guard. Whoever can propose those changes should be a DAO
          or a multi-party process, never a single wallet.
        </p>

        <PrevNext
          prev={{ title: "Reputation Model", href: "/docs/scoring-model", description: "How v2 reputation bands work" }}
          next={{ title: "SDK Guide", href: "/docs/integration/sdk", description: "Use @veil-reputation-protocol/sdk and React hooks" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
