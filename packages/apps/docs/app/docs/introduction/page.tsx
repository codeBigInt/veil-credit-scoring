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
  { id: "veil-did", text: "Veil Decentralized Identity (DID)", depth: 2 },
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

        <Callout variant="info" title="Live on Midnight">
          Veil Protocol is live on Midnight. The production contract address is{" "}
          <code>9ed09d1cfb3c1b6219d7631a29504854654e0c90461894967519ba999a92276f</code>
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
        <p>
          Each user&apos;s identity within Veil is represented as a{" "}
          <strong>Decentralized Identifier (DID)</strong> — a globally unique, self-sovereign
          identifier in the form <code>did:veil:0x…</code>. This DID is the single portable handle
          a protocol needs to request a credit check. It is safe to share publicly because it does
          not reveal the user&apos;s wallet address on any chain or their raw credit score.
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
          on-chain DID rather than a KYC document.
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
            to the Veil backend API. Events are keyed to a user&apos;s Veil public key (<code>userPk</code>),
            a deterministic anonymous key derived from the user&apos;s Midnight wallet. Only approved issuers can submit events.
          </li>
          <li>
            <strong>Privacy Layer (Midnight):</strong> A Compact smart contract on Midnight
            stores the computed credit score privately and maintains a DID registry for each user.
            A ZK circuit proves band membership (e.g. &quot;this user&apos;s score is in the Gold range&quot;)
            without revealing the raw score. The proof is submitted on-chain and the contract issues a
            verifiable credit decision.
          </li>
          <li>
            <strong>Identity Layer (CKB / Nervos):</strong> The user mints a Spore Digital Object
            (DOB) on CKB that serves as their immutable identity anchor. The DOB binds the
            user&apos;s <code>veilIdHash</code> to their CKB lock hash, linking the Midnight
            score to a portable, chain-agnostic public identity. Once minted, the user receives
            a <code>did:veil:…</code> identifier that any protocol can resolve to verify
            identity and request a credit decision.
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
          The Midnight contract also runs a <strong>DID Registry</strong> — an on-chain record
          that links a user&apos;s <code>veilIdHash</code>, CKB identity pass (Spore DOB), and CKB
          owner lock hash. This registry is what makes the <code>did:veil:…</code> identifier
          resolvable and verifiable by any party without trusting Veil.
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
          full node, this provides an unforgeable, chain-agnostic identity anchor for the
          user&apos;s Veil DID.
        </p>

        <h2 id="veil-did">Veil Decentralized Identity (DID)</h2>
        <p>
          Every Veil user has a globally unique identifier called a <strong>Veil DID</strong>,
          formatted as:
        </p>
        <div
          style={{
            background: "var(--bg-code)",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            padding: "12px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--primary)",
            marginBottom: "16px",
          }}
        >
          did:veil:0x&lt;64-hex-chars&gt;
        </div>
        <p>
          This follows the{" "}
          <a href="https://www.w3.org/TR/did-core/" target="_blank" rel="noopener noreferrer">
            W3C DID Core specification
          </a>{" "}
          and is derived from the hash of the user&apos;s Veil public key. Here is what makes this design powerful:
        </p>
        <ul>
          <li>
            <strong>Shareable without risk:</strong> The DID does not expose the user&apos;s
            Midnight private key, wallet addresses on other chains, or raw credit score. A
            user can share their DID freely with any app that wants to check their credit status.
          </li>
          <li>
            <strong>Resolvable by anyone:</strong> Any protocol can call{" "}
            <code>GET /api/v1/dids/resolve?did=did:veil:0x…</code> to retrieve a standard DID
            Document. The document contains the user&apos;s verification method (CKB public key),
            the credit-decision service endpoint, and the CKB identity pass location — enough
            to perform a credit check without any additional out-of-band information.
          </li>
          <li>
            <strong>Registered on Midnight:</strong> When a user mints their CKB identity pass,
            the backend automatically registers the DID on the Midnight DID Registry contract.
            This makes the DID cryptographically anchored to a ZK-protected on-chain record,
            not just a database entry.
          </li>
          <li>
            <strong>Used for credit authorization:</strong> When a user authorizes a credit
            decision, their CKB wallet signs a message that includes the DID and a
            verification method reference — proving they control the identity without revealing
            any private state.
          </li>
        </ul>

        <Callout variant="tip" title="For normal users">
          You do not need to understand DIDs to use Veil. The dashboard generates your Veil DID
          automatically when you mint your identity pass, and displays it as &quot;Your Veil ID.&quot;
          You can copy it and share it with any app that supports Veil credit checks.
        </Callout>

        <h2 id="key-benefits">Key Benefits</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "No Identity Disclosure", desc: "Protocols learn only a credit band and LTV limit, never a wallet address or raw score." },
            { label: "Chain-Agnostic", desc: "Behavioral data can come from Ethereum, Solana, BNB Chain, or any EVM-compatible network." },
            { label: "Composable", desc: "Any lending protocol can integrate the Veil decision API — no custom contract needed on your end." },
            { label: "Immutable Identity", desc: "CKB DOBs are permanently on-chain and cannot be revoked or altered by any third party." },
            { label: "ZK-Verified", desc: "Credit decisions carry cryptographic proofs verifiable by any party without trusting the issuer." },
            { label: "Self-Sovereign DID", desc: "Users hold a portable W3C DID that resolves to their verified identity — no central registry needed." },
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
            from wallet connection to minting an identity pass and sharing your Veil DID.
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
