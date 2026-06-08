import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "Deep dive into the Veil Protocol architecture — cross-chain credit scoring, the Midnight ZK proof pipeline, CKB identity anchoring, and the three protocol roles.",
};

const tocItems = [
  { id: "cross-chain-credit", text: "Cross-Chain Credit Scoring", depth: 2 },
  { id: "traditional-vs-defi", text: "Traditional vs. DeFi Credit", depth: 3 },
  { id: "three-roles", text: "The Three Roles", depth: 2 },
  { id: "zk-proof-pipeline", text: "ZK Proof Pipeline", depth: 2 },
  { id: "compact-contract", text: "The Compact Contract", depth: 3 },
  { id: "proof-generation", text: "Proof Generation", depth: 3 },
  { id: "ckb-identity", text: "CKB Identity Layer", depth: 2 },
  { id: "privacy-model", text: "Privacy Model", depth: 2 },
  { id: "never-revealed", text: "What Is Never Revealed", depth: 3 },
  { id: "publicly-verifiable", text: "What Is Publicly Verifiable", depth: 3 },
  { id: "trust-assumptions", text: "Trust Assumptions", depth: 2 },
];

export default function ConceptsPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Concepts" },
            { label: "Architecture" },
          ]}
        />

        <h1>Architecture</h1>
        <p className="prose-lead">
          A technical deep dive into how Veil Protocol assembles Midnight ZK proofs,
          CKB identity anchors, and a multi-chain behavioral data layer into a coherent
          privacy-preserving credit system.
        </p>

        <h2 id="cross-chain-credit">Cross-Chain Credit Scoring</h2>
        <p>
          Credit scoring in traditional finance relies on centralized data aggregators
          (credit bureaus) that collect repayment histories from lenders, normalize the
          data, and issue a score. This works because identity is anchored to government
          IDs and social security numbers — persistent identifiers that lenders trust.
        </p>
        <p>
          In decentralized finance, wallets are pseudonymous by design. There is no
          persistent identifier across chains, no credit bureau, and no way to aggregate
          behavioral data across Ethereum, Solana, and Polygon for the same user without
          either linking wallet addresses (destroying privacy) or relying on off-chain
          identity systems (recreating the surveillance infrastructure of traditional finance).
        </p>

        <h3 id="traditional-vs-defi">Traditional vs. DeFi Credit</h3>
        <table>
          <thead>
            <tr>
              <th>Aspect</th>
              <th>Traditional Credit</th>
              <th>Current DeFi</th>
              <th>Veil Protocol</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identity</td>
              <td>Government ID / SSN</td>
              <td>Wallet address</td>
              <td>veilIdHash (ZK-bound)</td>
            </tr>
            <tr>
              <td>Data source</td>
              <td>Bank reporting</td>
              <td>None (over-collateral)</td>
              <td>Protocol behavioral events</td>
            </tr>
            <tr>
              <td>Privacy</td>
              <td>None (bureau knows all)</td>
              <td>Pseudonymous</td>
              <td>ZK proofs, no raw data shared</td>
            </tr>
            <tr>
              <td>Cross-chain</td>
              <td>N/A</td>
              <td>Not supported</td>
              <td>Any chain submits events</td>
            </tr>
            <tr>
              <td>LTV</td>
              <td>Variable (based on score)</td>
              <td>Fixed 150%+ over-collateral</td>
              <td>Variable (35%–85% based on band)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Veil&apos;s breakthrough is the use of a <strong>pseudonymous identity hash</strong>{" "}
          (the <code>veilIdHash</code>) as the cross-chain aggregation key, combined with
          ZK proofs that certify score properties without revealing the score itself. The
          <code>veilIdHash</code> is derived from the user&apos;s Midnight public key, which is
          cryptographically bound to their identity but never linked to their other-chain
          wallets unless the user explicitly discloses that link.
        </p>

        <h2 id="three-roles">The Three Roles</h2>
        <p>
          The Veil Protocol ecosystem has three distinct participant roles, each with different
          interactions and trust relationships:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            {
              role: "User",
              color: "oklch(0.68 0.22 295)",
              desc: "The individual being scored. Controls their Midnight wallet, generates their veilIdHash, mints a CKB DOB, and authorizes credit decisions. The user is the only party who knows their raw score.",
              actions: ["Generate Veil ID", "Create score entry", "Mint DOB on CKB", "Authorize decisions"],
            },
            {
              role: "Protocol",
              color: "oklch(0.70 0.15 150)",
              desc: "Any DeFi lending or credit protocol that integrates with Veil. Submits behavioral events for users and requests credit decisions when users apply for loans.",
              actions: ["Submit behavioral events", "Request decisions", "Apply LTV limits", "Add risk premium"],
            },
            {
              role: "Veil",
              color: "oklch(0.80 0.12 60)",
              desc: "The Veil oracle (backend + Midnight contract). Aggregates behavioral data, computes scores privately, generates ZK proofs, and commits decisions to the Midnight blockchain.",
              actions: ["Aggregate events", "Compute score", "Generate ZK proof", "Commit decision"],
            },
          ].map((r) => (
            <div
              key={r.role}
              style={{
                padding: "16px",
                background: "oklch(0.14 0 0)",
                border: `1px solid ${r.color}30`,
                borderTop: `3px solid ${r.color}`,
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: r.color,
                  marginBottom: "8px",
                }}
              >
                {r.role}
              </div>
              <p style={{ fontSize: "12.5px", color: "oklch(0.72 0 0)", lineHeight: 1.55, marginBottom: "10px" }}>
                {r.desc}
              </p>
              <ul style={{ paddingLeft: "16px", margin: 0 }}>
                {r.actions.map((a) => (
                  <li key={a} style={{ fontSize: "12px", color: "oklch(0.65 0 0)", lineHeight: 1.6, marginBottom: "2px" }}>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h2 id="zk-proof-pipeline">ZK Proof Pipeline</h2>
        <p>
          The zero-knowledge proof pipeline is the technical core of Veil&apos;s privacy
          guarantees. Here is a complete walkthrough of what happens from score computation
          to on-chain commitment:
        </p>

        <div
          style={{
            background: "oklch(0.11 0 0)",
            border: "1px solid oklch(0.22 0 0)",
            borderRadius: "2px",
            padding: "20px 24px",
            marginBottom: "24px",
            fontFamily: "var(--font-mono)",
            fontSize: "12.5px",
            lineHeight: "2.0",
            color: "oklch(0.75 0 0)",
          }}
        >
          <div style={{ color: "oklch(0.60 0 0)", marginBottom: "4px" }}>// Data flow</div>
          <div>
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Protocol</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>POST /scoring-events/*</span>
            {" → "}
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Backend</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>Event queue</span>
          </div>
          <div>
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Protocol</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>POST /credit-decisions</span>
            {" → "}
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Backend</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>Score computation</span>
          </div>
          <div>
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Backend</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>Prover API</span>
            {" → "}
            <span style={{ color: "oklch(0.68 0.22 295)" }}>ZK circuit</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>π (proof)</span>
          </div>
          <div>
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Backend</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>Compact contract</span>
            {" → "}
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Midnight ledger</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>commitment</span>
          </div>
          <div>
            <span style={{ color: "oklch(0.68 0.22 295)" }}>Protocol</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>POST /credit-decisions</span>
            {" → "}
            <span style={{ color: "oklch(0.75 0 0)" }}>{`{ band, maxLtv, premium }`}</span>
          </div>
        </div>

        <h3 id="compact-contract">The Compact Contract</h3>
        <p>
          The Veil smart contract is written in Compact — Midnight&apos;s ZK-native smart
          contract language. Compact programs are compiled into two artifacts:
        </p>
        <ul>
          <li>
            <strong>A ZK circuit</strong> that encodes the computation the prover must perform.
            For Veil, the circuits validate issuer authorization, update private score
            accumulators, maintain score commitments, and derive the user&apos;s deterministic
            Veil ID without exposing the user&apos;s secret key.
          </li>
          <li>
            <strong>A ledger program</strong> that manages on-chain state: the mapping of
            public issuer/admin state, replay-protection sets, and Merkle commitments to
            private score and accumulator records.
          </li>
        </ul>
        <p>
          The Compact contract exposes the following operations:
        </p>
        <ul>
          <li><code>Utils_generateUserPk(secret)</code> — Derive the user&apos;s deterministic Veil ID locally.</li>
          <li><code>Scoring_createScoreEntry(userPk)</code> — Create an empty private score and accumulator entry.</li>
          <li><code>Scoring_submitRepaymentEvent</code>, <code>Scoring_submitLiquidationEvent</code>, <code>Scoring_submitProtocolUsageEvent</code>, and <code>Scoring_submitDebtStateEvent</code> — Record issuer-submitted behavioral events.</li>
          <li><code>Admin_addIssuer</code> and related admin circuits — Manage approved data issuers and score policy.</li>
        </ul>

        <h3 id="proof-generation">Proof Generation</h3>
        <p>
          When a scoring event is submitted, the following happens inside the Midnight proof
          and transaction flow:
        </p>
        <ol>
          <li>
            The witness provides the current private score/accumulator record and the Merkle
            path proving the existing commitment is part of the Midnight ledger state.
          </li>
          <li>
            The ZK circuit validates the issuer, rejects duplicate/backdated events, updates
            the accumulator, and creates a new commitment.
          </li>
          <li>
            The prover outputs a transaction proof showing the state transition is valid
            without revealing the private accumulator contents.
          </li>
          <li>
            The on-chain contract verifies the proof and stores only the updated public
            commitment and replay-protection data.
          </li>
        </ol>
        <p>
          The key property is that public observers see commitments and authorized decision
          outputs, not raw score values or behavioral records.
        </p>

        <h2 id="ckb-identity">CKB Identity Layer</h2>
        <p>
          The CKB layer solves a specific problem: how do multiple parties verify that the
          <code>veilIdHash</code> in a credit decision belongs to the same entity as a
          specific CKB wallet address, without relying on Veil as a trusted intermediary?
        </p>
        <p>
          The answer is the Spore DOB. When a user mints a DOB, they:
        </p>
        <ol>
          <li>
            Sign the CKB transaction with their CKB private key, proving ownership of the
            <code>ownerCkbLockHash</code>.
          </li>
          <li>
            Embed the <code>veilIdHash</code> in the DOB content, which is stored on-chain
            and publicly readable.
          </li>
          <li>
            The DOB is then a self-certifying, immutable claim: &quot;The owner of this CKB
            lock hash is associated with this veilIdHash.&quot;
          </li>
        </ol>
        <p>
          Any protocol can verify this claim by querying the CKB blockchain for DOBs with
          the given <code>veilIdHash</code> and checking that the DOB&apos;s lock matches
          the user&apos;s claimed CKB address. No trust in Veil or any other party is required.
        </p>

        <h2 id="privacy-model">Privacy Model</h2>

        <h3 id="never-revealed">What Is Never Revealed</h3>
        <p>
          The following information is explicitly protected by the Veil privacy model:
        </p>
        <ul>
          <li>
            <strong>Raw credit score:</strong> The numeric score is stored only in
            Midnight private state. It is private input to Veil&apos;s scoring flow and is
            never included in any public transaction or API response.
          </li>
          <li>
            <strong>Wallet addresses on other chains:</strong> The <code>veilIdHash</code>
            is a one-way hash. Knowing the hash does not reveal the user&apos;s Ethereum,
            Solana, or other wallet addresses.
          </li>
          <li>
            <strong>Specific behavioral events:</strong> Individual events (e.g. &quot;repaid
            loan on Aave on March 15&quot;) are never published publicly. The behavioral
            data is aggregated into the score computation and then discarded from
            public-facing storage.
          </li>
          <li>
            <strong>Score history:</strong> Public data exposes commitments and fresh decision
            outputs, not the full score trajectory.
          </li>
        </ul>

        <h3 id="publicly-verifiable">What Is Publicly Verifiable</h3>
        <p>
          The following information is intentionally public and verifiable:
        </p>
        <ul>
          <li>
            <strong>Current credit band:</strong> The band (Unranked, Bronze, Silver, Gold,
            Platinum) is returned by the credit decision API after DOB and wallet-signature
            verification. This is the minimum necessary for a lending protocol to make a
            credit decision.
          </li>
          <li>
            <strong>Decision validity:</strong> The timestamp (<code>validAt</code>) is public
            so protocols can verify the decision is fresh.
          </li>
          <li>
            <strong>DOB existence on CKB:</strong> The Spore DOB is a public CKB cell. Any
            party can verify that a <code>veilIdHash</code> has a corresponding DOB on CKB.
          </li>
          <li>
            <strong>Protocol participation:</strong> The fact that a user has joined the
            Veil contract and created a score entry is on-chain on Midnight (but without
            linking to their other-chain identity).
          </li>
        </ul>

        <Callout variant="info" title="Midnight&apos;s Dual-Ledger Model">
          Midnight uses a dual-ledger architecture: a public ledger visible to all, and private
          state available to authorized proving contexts. Veil stores raw score records in
          private state and public Merkle commitments on the ledger.
        </Callout>

        <h2 id="trust-assumptions">Trust Assumptions</h2>
        <p>
          No system is trustless. Veil&apos;s trust assumptions are:
        </p>
        <table>
          <thead>
            <tr>
              <th>Assumption</th>
              <th>Trusted Party</th>
              <th>Mitigation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Score computation is correct</td>
              <td>Veil backend oracle</td>
              <td>
                The backend&apos;s scoring formula is open-source. The ZK circuit enforces
                that the committed band matches the computation.
              </td>
            </tr>
            <tr>
              <td>Behavioral events are accurate</td>
              <td>Submitting protocols</td>
              <td>
                Events are tied to <code>veilIdHash</code>. Protocols signing false events
                would undermine their own credibility and can be blacklisted.
              </td>
            </tr>
            <tr>
              <td>Midnight ledger security</td>
              <td>Midnight network validators</td>
              <td>
                Midnight&apos;s consensus mechanism and ZK proof verification are the same
                guarantees that underpin the entire Midnight ecosystem.
              </td>
            </tr>
            <tr>
              <td>CKB DOB immutability</td>
              <td>CKB network miners</td>
              <td>
                CKB is a PoW blockchain with a global mining network. Rewriting DOB
                data would require a 51% attack on CKB.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The strongest trust assumption is in the Veil backend oracle — it currently holds
          the exclusive ability to submit behavioral events and compute scores. Future
          iterations of the protocol aim to introduce a decentralized oracle network so that
          no single entity controls the score computation.
        </p>

        <PrevNext
          prev={{ title: "CKB Wallet Setup", href: "/docs/user-guide/ckb-wallet", description: "Set up CKB & mint your DOB" }}
        />
      </article>

      <aside className="docs-toc-col" style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}>
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
