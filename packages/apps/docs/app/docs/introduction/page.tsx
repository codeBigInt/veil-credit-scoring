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
          Veil Protocol v2 is a private reputation layer for cross-chain DeFi, DAOs, airdrops,
          communities, and access systems. Users prove a reputation band without exposing wallet
          history, raw scores, or linked addresses.
        </p>

        <Callout variant="info" title="v2 direction">
          Veil has moved from credit scoring to broader social and protocol reputation. Lending is
          one possible integration, not the protocol&apos;s primary framing.
        </Callout>

        <h2 id="what-is-veil">What Is Veil?</h2>
        <p>
          Veil turns public on-chain behavior into a private, reusable reputation proof. The proof
          is expressed as one of five bands: unranked, bronze, silver, gold, or platinum. Integrators
          can use those bands for eligibility, governance weighting, tiered rewards, rate limits,
          community access, or abuse resistance.
        </p>
        <p>
          The user controls the proof flow. The SDK reads public chain data, builds private witness
          inputs, sends them to a stateless proof server or self-hosted prover, and submits the
          resulting Midnight transaction. The backend is no longer an oracle for reputation decisions.
        </p>

        <h2 id="architecture-version">Architecture Version</h2>
        <ArchitectureToggle />

        <h2 id="how-it-works">How It Works</h2>
        <ol>
          <li>A user connects one EVM-compatible wallet in the Veil UI or an integrator flow.</li>
          <li>The SDK derives a stable Veil identity anchored to a CKB lock hash.</li>
          <li>The user signs an identity registration message and submits `Identity_register`.</li>
          <li>The SDK collects public chain signals and submits `Reputation_prove` on Midnight.</li>
          <li>Protocols call `checkReputation` for a minimum band and purpose.</li>
        </ol>

        <h2 id="privacy">Privacy Model</h2>
        <p>
          Raw wallet histories, private signal values, salts, and raw scores are not returned to
          integrators. The contract stores commitments and exposes banded decisions. Integrators get
          the least information needed to apply a policy.
        </p>

        <h2 id="roles">System Roles</h2>
        <table>
          <thead>
            <tr><th>Role</th><th>Responsibility</th></tr>
          </thead>
          <tbody>
            <tr><td>User</td><td>Controls the wallet, identity registration, proof generation, and backup export.</td></tr>
            <tr><td>Integrator</td><td>Checks a minimum reputation band for a specific purpose.</td></tr>
            <tr><td>SDK</td><td>Provides identity, reader, proof, and check APIs for apps and protocols.</td></tr>
            <tr><td>Backend</td><td>Deploys the contract, returns the active address, sponsors DUST, and optionally stores encrypted client backups.</td></tr>
            <tr><td>Governance</td><td>Updates scoring parameters through DAO-controlled authority and timelock.</td></tr>
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
