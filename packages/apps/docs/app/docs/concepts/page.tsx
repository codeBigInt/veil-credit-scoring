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
          Veil v2 is a private reputation architecture built around a Midnight Compact contract,
          a framework-agnostic TypeScript SDK, public chain readers, a stateless proof server, and a
          minimal sponsorship backend.
        </p>

        <h2 id="version">Version Toggle</h2>
        <ArchitectureToggle />

        <h2 id="layers">v2 Layers</h2>
        <table>
          <thead>
            <tr><th>Layer</th><th>What It Does</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Wallet layer</td>
              <td>Uses one EVM-compatible wallet path in the UI. The SDK adapter derives the CKB lock hash and Veil identity.</td>
            </tr>
            <tr>
              <td>Reader layer</td>
              <td>Reads public chain activity. Protocols can inject richer indexer readers instead of using default RPC probes.</td>
            </tr>
            <tr>
              <td>Proof layer</td>
              <td>Generates a ZK proof from private witness values. The public output is a reputation band.</td>
            </tr>
            <tr>
              <td>Midnight contract</td>
              <td>Registers identities, verifies reputation proofs, stores commitments, checks minimum bands, and controls scoring config governance.</td>
            </tr>
            <tr>
              <td>Backend</td>
              <td>Sponsors DUST and optionally stores encrypted backups. It does not decide reputation.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="circuits">Contract Circuits</h2>
        <p>
          The full contract exposes identity, reputation, governance, and utility circuits. The
          argument lists are intentionally explicit: each public hash, commitment, nonce, epoch, and
          threshold is passed directly so the contract can bind replay protection, witness commitments,
          proof hashes, and governance actions without hidden backend state.
        </p>
        <ul>
          <li><code>Identity_register</code>: stores a registered Veil identity after proof-hash binding.</li>
          <li><code>Reputation_prove</code>: validates bounded signals, witness commitment, claimed band, proof nonce, and proof hash.</li>
          <li><code>Reputation_check</code>: returns a purpose-specific band decision.</li>
          <li><code>Governance_*</code>: timelocked score-configuration updates controlled by DAO authority.</li>
          <li><code>Utils_*</code>: deterministic hash, band, config, and governance helper circuits.</li>
        </ul>

        <Callout variant="tip" title="Why many circuit arguments?">
          Compact circuits do not implicitly trust off-chain SDK state. Passing the values explicitly
          makes replay keys, commitments, proof bindings, and policy decisions auditable at the circuit boundary.
        </Callout>

        <h2 id="backend">Backend Scope</h2>
        <p>
          The backend no longer exposes credit decisions, issuer events, DID resolution, score entry
          creation, or CKB DOB orchestration. Those were v1 concepts. v2 backend endpoints are limited
          to contract metadata, DUST sponsorship, and optional encrypted backup storage.
        </p>

        <h2 id="trust">Trust Boundaries</h2>
        <ul>
          <li>The SDK should be treated as integration tooling, not an oracle.</li>
          <li>The proof server is stateless and can be self-hosted by protocols.</li>
          <li>The backend cannot change a user&apos;s reputation band.</li>
          <li>Governance authority should be DAO-controlled, never a single operator wallet.</li>
          <li>Encrypted backups must be encrypted client-side before upload.</li>
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
