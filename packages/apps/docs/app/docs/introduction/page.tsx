import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "An overview of the Veil Protocol — what it is, how it works, and why it matters for privacy-preserving DeFi credit.",
};

const tocItems = [
  { id: "what-is-veil", text: "What Is Veil?", depth: 2 },
  { id: "the-problem", text: "The Problem", depth: 2 },
  { id: "how-it-works", text: "How It Works", depth: 2 },
  { id: "architecture", text: "Architecture Overview", depth: 3 },
  { id: "midnight-layer", text: "Midnight Layer", depth: 3 },
  { id: "ckb-layer", text: "CKB Identity Layer", depth: 3 },
  { id: "key-benefits", text: "Key Benefits", depth: 2 },
  { id: "next-steps", text: "Next Steps", depth: 2 },
];

export default function IntroductionPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Getting Started" },
            { label: "Introduction" },
          ]}
        />

        <h1>Introduction</h1>
        <p className="prose-lead">
          Veil is a cross-chain, privacy-preserving credit scoring protocol that lets any DeFi
          application make informed credit decisions without ever learning who the borrower is or
          seeing their raw on-chain history.
        </p>

        <Callout variant="info" title="Deployed Contract">
          Veil Protocol is live on Midnight. The production contract address is{" "}
          <code>7c7d7b78ebcf6a67862fde64d5717f08109cadf0666b90b3b8179aef15ec1b9e</code>.
        </Callout>

        <h2 id="what-is-veil">What Is Veil?</h2>
        <p>
          Veil Protocol is a three-layer infrastructure stack that bridges on-chain behavioral data
          from any blockchain, aggregates it into a privacy-preserving credit score, and delivers
          verifiable credit decisions to DeFi lending protocols — all without exposing the
          individual user&apos;s wallet address, transaction history, or raw score.
        </p>
        <p>
          Think of Veil as the credit bureau of DeFi, but one that operates entirely within a
          zero-knowledge framework. Borrowers obtain a credit band (Bronze, Silver, Gold, Platinum)
          rather than a raw number, and protocols receive a ZK-verified decision that includes a
          maximum LTV ratio and a risk premium adjustment — with no personally identifiable
          information attached.
        </p>

        <h2 id="the-problem">The Problem</h2>
        <p>
          Traditional DeFi lending is either fully over-collateralized (inefficient capital) or
          relies on off-chain identity systems that destroy the core promise of self-sovereign
          finance. The existing approaches fail in two ways:
        </p>
        <ul>
          <li>
            <strong>Over-collateralization (e.g. 150% LTV):</strong> Users must lock up more
            capital than they borrow. This is safe for protocols but deeply inefficient for users
            with solid repayment histories.
          </li>
          <li>
            <strong>Off-chain identity systems:</strong> KYC-gated credit scoring brings back
            precisely the trust relationships and surveillance risks that blockchain was designed
            to remove.
          </li>
        </ul>
        <p>
          Veil solves this by letting on-chain behavior speak for itself, aggregated and
          proven with zero-knowledge cryptography, with identity anchored to an immutable
          on-chain object rather than a KYC document.
        </p>

        <h2 id="how-it-works">How It Works</h2>
        <p>
          The protocol operates in four phases: data collection, score computation, ZK proof
          generation, and decision delivery.
        </p>

        <h3 id="architecture">Architecture Overview</h3>
        <p>
          Veil is composed of three logical layers that each have a distinct responsibility:
        </p>
        <ol>
          <li>
            <strong>Data Layer (Any Chain):</strong> Registered DeFi protocols (issuers) submit
            behavioral signals — repayments, liquidations, protocol usage, debt state snapshots —
            to the Veil backend API. Events are keyed to a user&apos;s Veil ID (<code>userPk</code>),
            a deterministic anonymous public key. Only approved issuers can submit events.
          </li>
          <li>
            <strong>Privacy Layer (Midnight):</strong> A Compact smart contract on Midnight
            stores the computed credit score privately. A ZK circuit proves band membership
            (e.g. &quot;this user&apos;s score is in the Gold range&quot;) without revealing the raw score.
            The proof is submitted on-chain and the contract issues a verifiable credit decision.
          </li>
          <li>
            <strong>Identity Layer (CKB / Nervos):</strong> The user mints a Spore Digital Object
            (DOB) on CKB that serves as their immutable identity anchor. The DOB binds the
            user&apos;s <code>veilIdHash</code> to their CKB lock hash, linking the Midnight
            score to a portable, chain-agnostic public identity.
          </li>
        </ol>

        <h3 id="midnight-layer">Midnight Layer</h3>
        <p>
          Midnight is a data-protection blockchain that enables privacy-preserving smart
          contracts written in Compact — a ZK-native language that compiles to circuits the
          Midnight prover can evaluate. Veil&apos;s core contract is written in Compact and stores
          credit scores in a private ledger state that only the score owner and the Veil oracle
          can update.
        </p>
        <p>
          When a credit decision is requested, the backend runs the Midnight ZK prover to
          generate a proof that the score falls within a particular band. This proof is
          verified by the on-chain contract and stored as a commitment, never revealing the
          raw numeric score.
        </p>

        <h3 id="ckb-layer">CKB Identity Layer</h3>
        <p>
          CKB (Common Knowledge Base, the Nervos Network Layer 1) is optimized for on-chain
          asset and identity primitives. The Spore protocol on CKB provides &quot;Digital Objects&quot;
          (DOBs) — immutable, non-fungible cells that can store arbitrary structured data and
          are permanently associated with an owner lock.
        </p>
        <p>
          Veil uses a Spore DOB as the user&apos;s public identity container. The DOB stores the
          user&apos;s <code>veilIdHash</code>, the Midnight contract address, and the network
          version. Because CKB cells are immutable once created and verified by every CKB
          full node, this provides an unforgeable, chain-agnostic identity anchor.
        </p>

        <h2 id="key-benefits">Key Benefits</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "No Identity Disclosure", desc: "Protocols learn only a credit band and LTV limit, never a wallet address or raw score." },
            { label: "Chain-Agnostic", desc: "Behavioral data can come from Ethereum, Solana, BNB Chain, or any EVM-compatible network." },
            { label: "Composable", desc: "Any lending protocol can integrate the Veil decision API — no custom contract needed." },
            { label: "Immutable Identity", desc: "CKB DOBs are permanently on-chain and cannot be revoked or altered by any third party." },
            { label: "ZK-Verified", desc: "Credit decisions carry cryptographic proofs verifiable by any party without trusting the issuer." },
            { label: "User-Controlled", desc: "Users decide when to generate a score and when to authorize a credit decision." },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                padding: "14px",
                background: "oklch(0.14 0 0)",
                border: "1px solid oklch(0.22 0 0)",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--primary)",
                  marginBottom: "6px",
                }}
              >
                {b.label}
              </div>
              <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>

        <h2 id="next-steps">Next Steps</h2>
        <p>
          From here, you can dive deeper into specific areas of the protocol:
        </p>
        <ul>
          <li>
            <a href="/docs/scoring-model">Scoring Model</a> — understand how the five credit
            bands are computed and what behavioral signals matter.
          </li>
          <li>
            <a href="/docs/integration">Integration Guide</a> — start submitting behavioral
            data and consuming credit decisions in your protocol.
          </li>
          <li>
            <a href="/docs/user-guide">Dashboard Guide</a> — walk through the end-user flow
            from wallet connection to minting a DOB.
          </li>
          <li>
            <a href="/docs/concepts">Architecture Deep Dive</a> — understand the ZK proof
            pipeline and the three protocol roles in detail.
          </li>
        </ul>

        <PrevNext
          next={{ title: "Quick Start", href: "/docs/quick-start", description: "Integrate in 5 minutes" }}
        />
      </article>

      {/* Right TOC */}
      <aside className="docs-toc-col" style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}>
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
