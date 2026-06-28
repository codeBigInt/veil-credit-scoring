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
} from '@veil-protocol/sdk';`;

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
          Veil Protocol v2 integration is centered on the Midnight contract and <code>@veil-protocol/sdk</code>.
          Applications register privacy-preserving identities, submit reputation proofs, and request
          band decisions without exposing raw score inputs.
        </p>

        <Callout variant="warning" title="Deprecated API surface">
          The old issuer-scoring REST flow is not part of v2. Avoid references to
          <code>Admin_addIssuer</code>, <code>Scoring_submitRepaymentEvent</code>, DID Registry
          circuits, or user public-key event streams when building against v2.
        </Callout>

        <h2 id="model">Integration Model</h2>
        <ol>
          <li>Join the deployed full contract using the address provided by the deployer.</li>
          <li>Register the user identity with <code>Identity_register</code>.</li>
          <li>Submit a reputation proof with <code>Reputation_prove</code>.</li>
          <li>Check a minimum band with <code>Reputation_check</code>.</li>
        </ol>

        <h2 id="sdk">Use the SDK</h2>
        <CodeBlock code={sdk} language="typescript" filename="imports.ts" />
        <p>
          The SDK exports a framework-agnostic client, direct reputation-check helpers, reader adapters,
          and low-level contract tooling for CLIs and deployment systems.
        </p>

        <h2 id="identity">Identity Registration</h2>
        <p>
          Identity registration derives a stable <code>veilId</code> from the wallet's CKB lock hash,
          asks the user to sign a registration message, and submits <code>Identity_register</code> to
          Midnight. Fee sponsorship is optional and only applies when the configured provider supports it.
        </p>

        <h2 id="reputation">Reputation Proofs</h2>
        <p>
          Reputation proof submission binds private signal values to a witness commitment and proof hash.
          The SDK can build conservative commitments from public RPC data, but production protocols should
          inject richer reader adapters backed by their own indexers.
        </p>

        <h2 id="checks">Band Checks</h2>
        <CodeBlock code={check} language="typescript" filename="check.ts" />
        <p>
          The check output includes whether the requested threshold is met, the current band,
          community weight, access tier, epoch, and purpose hash.
        </p>

        <h2 id="governance">Governance Updates</h2>
        <p>
          Score-config changes are proposed, timelocked, and applied through governance circuits.
          The governance authority should be a DAO-controlled key or governance contract, not a
          single operator wallet.
        </p>

        <PrevNext
          prev={{ title: "Reputation Model", href: "/docs/scoring-model", description: "How v2 reputation bands work" }}
          next={{ title: "SDK Guide", href: "/docs/integration/sdk", description: "Use @veil-protocol/sdk and React hooks" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
