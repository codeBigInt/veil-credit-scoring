import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Scoring Model",
  description:
    "How Veil computes credit scores from issuer-submitted behavioral events, private Midnight commitments, CKB identity anchors, and credit decision bands.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "issuers", text: "Issuers & Data Providers", depth: 2 },
  { id: "scoring-events", text: "Scoring Events", depth: 2 },
  { id: "repayment", text: "Repayment Events", depth: 3 },
  { id: "liquidation", text: "Liquidation Events", depth: 3 },
  { id: "protocol-usage", text: "Protocol Usage Events", depth: 3 },
  { id: "debt-state", text: "Debt State Events", depth: 3 },
  { id: "score-computation", text: "Score Computation", depth: 2 },
  { id: "trust-tiers", text: "Trust Tiers", depth: 2 },
  { id: "identity-dob", text: "Veil Identity DOB", depth: 2 },
  { id: "epoch-system", text: "Epoch System", depth: 2 },
  { id: "privacy-invariants", text: "Privacy Invariants", depth: 2 },
];

const repaymentExample = `curl -X POST https://{VEIL_API}/scoring-events/repayments \\
  -H "Content-Type: application/json" \\
  -d '{
    "userPk": "0xabc123...",
    "issuerPk": "0xdef456...",
    "paidOnTimeFlag": 1,
    "amountWeight": 1000,
    "eventEpoch": 3,
    "eventId": "0x..."
  }'`;

const liquidationExample = `curl -X POST https://{VEIL_API}/scoring-events/liquidations \\
  -H "Content-Type: application/json" \\
  -d '{
    "userPk": "0xabc123...",
    "issuerPk": "0xdef456...",
    "severity": 2,
    "eventEpoch": 3,
    "eventId": "0x..."
  }'`;

export default function ScoringModelPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Scoring Model" },
            { label: "Overview" },
          ]}
        />

        <h1>Scoring Model</h1>
        <p className="prose-lead">
          Veil builds a behavioral credit score from events submitted by registered issuers.
          Midnight keeps the score and accumulators private, while CKB stores only the user&apos;s
          immutable Veil Identity DOB anchor. Credit decisions expose a band and policy limits,
          never the raw score.
        </p>

        <h2 id="overview">Overview</h2>
        <p>
          The scoring model is intentionally <strong>behavioral</strong> rather than balance-based.
          A wallet with large holdings but a poor repayment history is less trustworthy than a
          smaller wallet with a consistent on-time record. Veil captures this by accumulating
          behavioral events over time and weighting them according to a configurable formula.
        </p>
        <p>
          The score lives entirely in <strong>private state</strong> — it is never stored in
          plaintext on any public ledger. Only a ZK commitment to the score is published on-chain.
          When a protocol requests a credit decision, the user authorizes that request with their
          CKB wallet and Veil returns a decision band without revealing the raw score value.
        </p>

        <Callout variant="info" title="Issuer-gated data">
          Only <strong>registered issuers</strong> — DeFi protocols approved by the Veil admin —
          can submit scoring events. This gating prevents unverified sources from polluting the
          credit data. Contact the Veil team to register your protocol as an issuer.
        </Callout>

        <h2 id="issuers">Issuers & Data Providers</h2>
        <p>
          An issuer is a DeFi protocol that has been approved to submit behavioral data to Veil.
          Issuers are registered on-chain by the Veil admin via <code>Admin_addIssuer</code>, which
          derives and returns the issuer&apos;s public key (<code>issuerPk</code>). This key must be
          included in every scoring event the issuer submits.
        </p>
        <p>
          Issuers fulfill two roles:
        </p>
        <ul>
          <li><strong>Data provider</strong> — submit repayment, liquidation, protocol usage, and debt state events tied to a user&apos;s Veil ID.</li>
          <li><strong>Verifier</strong> — call the credit decision endpoint to check the user&apos;s current band and lending limits after the user authorizes the request.</li>
        </ul>
        <p>
          Issuers never learn the real identity of the users they track. All interactions use
          the user&apos;s Veil ID (<code>userPk</code>) — a deterministic, anonymous public key.
        </p>

        <h2 id="scoring-events">Scoring Events</h2>
        <p>
          Issuers submit behavioral events via four dedicated endpoints. Each event is
          processed by a ZK circuit that validates the issuer&apos;s authorization, enforces
          replay protection, and updates the user&apos;s private score accumulator.
        </p>

        <Callout variant="warning" title="Event monotonicity">
          The <code>eventEpoch</code> field must be <strong>equal to or greater</strong> than the
          epoch of the last event submitted for that user. Backdated events are rejected by the
          contract to prevent retroactive score manipulation.
        </Callout>

        <h3 id="repayment">Repayment Events</h3>
        <p>
          Submit whenever a user repays a loan. This is the highest-weight signal in the scoring model.
        </p>
        <CodeBlock code={repaymentExample} language="bash" filename="POST /scoring-events/repayments" />

        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>userPk</code></td>
              <td>Bytes (hex)</td>
              <td>The user&apos;s Veil ID</td>
            </tr>
            <tr>
              <td><code>issuerPk</code></td>
              <td>Bytes (hex)</td>
              <td>Your registered issuer public key</td>
            </tr>
            <tr>
              <td><code>paidOnTimeFlag</code></td>
              <td><code>1</code> | <code>0</code></td>
              <td><code>1</code> = paid on time, <code>0</code> = late</td>
            </tr>
            <tr>
              <td><code>amountWeight</code></td>
              <td>BigInt</td>
              <td>Relative loan size weight (e.g. 1000 for a normalized unit)</td>
            </tr>
            <tr>
              <td><code>eventEpoch</code></td>
              <td>BigInt</td>
              <td>Protocol epoch at which the event occurred</td>
            </tr>
            <tr>
              <td><code>eventId</code></td>
              <td>Bytes (hex, optional)</td>
              <td>Unique event identifier for replay protection. Auto-generated if omitted.</td>
            </tr>
          </tbody>
        </table>

        <h3 id="liquidation">Liquidation Events</h3>
        <p>
          Submit when a user&apos;s position is liquidated. Severity determines the penalty magnitude.
        </p>
        <CodeBlock code={liquidationExample} language="bash" filename="POST /scoring-events/liquidations" />

        <table>
          <thead>
            <tr>
              <th>severity</th>
              <th>Meaning</th>
              <th>Score impact</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>1</code></td>
              <td>Minor liquidation — small position, managed outcome</td>
              <td>Low penalty</td>
            </tr>
            <tr>
              <td><code>2</code></td>
              <td>Moderate liquidation — significant position</td>
              <td>Medium penalty</td>
            </tr>
            <tr>
              <td><code>3</code></td>
              <td>Severe liquidation — large or full position loss</td>
              <td>High penalty</td>
            </tr>
          </tbody>
        </table>

        <h3 id="protocol-usage">Protocol Usage Events</h3>
        <p>
          Submit each time a user meaningfully interacts with your protocol (e.g. takes a position,
          provides liquidity). Diversity of protocol usage is a positive scoring signal — but each
          unique <code>(user, protocol)</code> pair is counted only once, preventing inflation.
        </p>

        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>userPk</code></td><td>Bytes (hex)</td><td>The user&apos;s Veil ID</td>
            </tr>
            <tr>
              <td><code>issuerPk</code></td><td>Bytes (hex)</td><td>Your registered issuer public key</td>
            </tr>
            <tr>
              <td><code>protocolId</code></td><td>Bytes (hex)</td><td>A stable identifier for your protocol</td>
            </tr>
            <tr>
              <td><code>eventEpoch</code></td><td>BigInt</td><td>Protocol epoch at which the interaction occurred</td>
            </tr>
          </tbody>
        </table>

        <h3 id="debt-state">Debt State Events</h3>
        <p>
          Periodic debt state snapshots capture a user&apos;s current risk exposure. The{" "}
          <code>riskBand</code> (0–3) encodes collateralization quality, and{" "}
          <code>activeDebtFlag</code> indicates whether the user currently holds open debt.
        </p>

        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>activeDebtFlag</code></td><td><code>0</code> | <code>1</code></td>
              <td><code>1</code> = user has active debt, <code>0</code> = no active debt</td>
            </tr>
            <tr>
              <td><code>riskBand</code></td><td>0–3</td>
              <td>0 = healthy, 3 = high-risk collateral position</td>
            </tr>
          </tbody>
        </table>

        <h2 id="score-computation">Score Computation</h2>
        <p>
          The score is derived from private score accumulators updated by issuer-submitted
          events. The current implementation records the accumulator and score commitments on
          Midnight, then derives credit decisions from the private state associated with the
          user&apos;s Veil ID. The formula combines positive behavioral signals with penalty deductions:
        </p>

        {/* ── Top-level formula ── */}
        <div style={{
          background: "oklch(0.10 0.04 295)",
          border: "2px solid var(--primary)",
          borderRadius: "4px",
          padding: "28px 32px",
          marginBottom: "8px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "16px" }}>
            Core Formula
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: "var(--fg)", letterSpacing: "0.02em", lineHeight: 1.7 }}>
            <span style={{ color: "var(--primary)" }}>rawScore</span>
            {" = baseScore + "}
            <span style={{ color: "oklch(0.72 0.18 160)" }}>behaviorScore</span>
            {" − "}
            <span style={{ color: "oklch(0.72 0.18 20)" }}>penaltyScore</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "oklch(0.6 0 0)", marginTop: "10px" }}>
            score = clamp(rawScore, 0, maxScore)
          </div>
        </div>

        {/* ── Behavior and penalty breakdown ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          <div style={{
            background: "oklch(0.10 0.03 160)",
            border: "1px solid oklch(0.72 0.18 160 / 0.4)",
            borderRadius: "4px",
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "oklch(0.72 0.18 160)", marginBottom: "14px" }}>
              Behavior Score <span style={{ fontWeight: 400, fontSize: "10px", opacity: 0.7 }}>positive signals</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg)", lineHeight: 2 }}>
              <div>
                <span style={{ color: "oklch(0.72 0.18 160)", fontWeight: 700 }}>repaymentRatio</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × repaymentWeight</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>+ repayment history</div>
              <div>
                <span style={{ color: "oklch(0.72 0.18 160)", fontWeight: 700 }}>distinctProtocols</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × protocolWeight</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>+ cross-protocol breadth</div>
              <div>
                <span style={{ color: "oklch(0.72 0.18 160)", fontWeight: 700 }}>epochsActive</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × tenureWeight</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>+ on-chain tenure</div>
            </div>
          </div>

          <div style={{
            background: "oklch(0.10 0.03 20)",
            border: "1px solid oklch(0.72 0.18 20 / 0.4)",
            borderRadius: "4px",
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "oklch(0.72 0.18 20)", marginBottom: "14px" }}>
              Penalty Score <span style={{ fontWeight: 400, fontSize: "10px", opacity: 0.7 }}>risk deductions</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg)", lineHeight: 2 }}>
              <div>
                <span style={{ color: "oklch(0.72 0.18 20)", fontWeight: 700 }}>liquidationPts</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × liquidationWeight</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>− liquidation history</div>
              <div>
                <span style={{ color: "oklch(0.72 0.18 20)", fontWeight: 700 }}>activeDebtFlag</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × activeDebtPenalty</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>− open debt exposure</div>
              <div>
                <span style={{ color: "oklch(0.72 0.18 20)", fontWeight: 700 }}>riskBand</span>
                <span style={{ color: "oklch(0.55 0 0)" }}> × riskBandWeight</span>
              </div>
              <div style={{ color: "oklch(0.4 0 0)", fontSize: "11px", paddingLeft: "2px" }}>− collateral risk level (0–3)</div>
            </div>
          </div>
        </div>

        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "oklch(0.55 0 0)",
          background: "oklch(0.12 0 0)",
          border: "1px solid oklch(0.2 0 0)",
          borderRadius: "2px",
          padding: "10px 14px",
          marginBottom: "24px",
        }}>
          repaymentRatio = (onTimeRepayments / totalRepayments) × scale
          <span style={{ color: "oklch(0.4 0 0)", marginLeft: "12px" }}>// verified in-circuit via remainder proof</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>baseScore</code></td><td>350</td><td>Starting score for all users</td></tr>
            <tr><td><code>maxScore</code></td><td>900</td><td>Score ceiling</td></tr>
            <tr><td><code>repaymentWeight</code></td><td>2</td><td>Multiplier on repayment ratio</td></tr>
            <tr><td><code>protocolWeight</code></td><td>10</td><td>Per unique protocol interaction</td></tr>
            <tr><td><code>tenureWeight</code></td><td>1</td><td>Per active epoch</td></tr>
            <tr><td><code>liquidationWeight</code></td><td>3</td><td>Penalty multiplier per liquidation point</td></tr>
            <tr><td><code>activeDebtPenalty</code></td><td>5</td><td>Flat penalty when user holds active debt</td></tr>
            <tr><td><code>riskBandWeight</code></td><td>5</td><td>Penalty per risk band level (0–3)</td></tr>
          </tbody>
        </table>

        <Callout variant="info" title="On-chain safety invariants">
          The contract enforces event monotonicity (no backdating), replay protection via
          domain-tagged event hashes, commitment validation against on-chain Merkle trees,
          and score arithmetic underflow/overflow assertions before any value is stored.
        </Callout>

        <h2 id="trust-tiers">Trust Tiers</h2>
        <p>
          Trust tiers are returned in the credit decision response. They are derived from the
          current private score and should be treated as policy bands rather than public score
          disclosures:
        </p>

        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Score profile</th>
              <th>Access profile</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="band-unranked">Unranked</span></td>
              <td>No score entry, insufficient history, or low current score</td>
              <td>No privileged access; standard over-collateralized terms</td>
            </tr>
            <tr>
              <td><span className="band-bronze">Bronze</span></td>
              <td>Basic positive behavior</td>
              <td>Basic credit access; reduced collateral requirements</td>
            </tr>
            <tr>
              <td><span className="band-silver">Silver</span></td>
              <td>Consistent repayment and moderate activity</td>
              <td>Moderate benefit tier; improved LTV and rate adjustments</td>
            </tr>
            <tr>
              <td><span className="band-gold">Gold</span></td>
              <td>Strong repayment behavior and low risk exposure</td>
              <td>High-trust tier; preferential rates, higher LTV limits</td>
            </tr>
            <tr>
              <td><span className="band-platinum">Platinum</span></td>
              <td>Best current risk profile</td>
              <td>Maximum trust tier; undercollateralized borrowing, fee waivers</td>
            </tr>
          </tbody>
        </table>

        <p>
          Protocols consuming Veil decisions should handle all tiers, including Unranked. They
          should also use the returned <code>maxLtvBps</code> and <code>riskPremiumBps</code>
          rather than hard-coding their own interpretation of the band.
        </p>

        <h2 id="identity-dob">Veil Identity DOB</h2>
        <p>
          Veil no longer mints Proof-of-Trustworthiness NFTs on Midnight. The public identity
          anchor is a user-minted <strong>Veil Identity DOB</strong> on CKB using Spore. The DOB
          stores only stable identity-anchor metadata: <code>veilIdHash</code>, the owner CKB
          lock hash, the Midnight network, the backend-deployed Midnight contract address, and
          a version string.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Prepare", desc: "The backend creates a DOB mint intent after the Midnight score entry exists. The intent contains stable public metadata only." },
            { label: "Mint", desc: "The user's CKB wallet constructs, signs, funds, and submits the Spore transaction. The backend does not pay CKB capacity or fees." },
            { label: "Record", desc: "After minting, the app records the Spore ID and transaction hash with the backend for later lookup." },
            { label: "Verify", desc: "Credit decisions verify the DOB content, veil_sbt_lock script, owner lock hash, and CKB wallet authorization signature." },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "14px",
                background: "oklch(0.14 0 0)",
                border: "1px solid oklch(0.22 0 0)",
                borderRadius: "2px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "6px" }}>
                {item.label}
              </div>
              <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>

        <Callout variant="info" title="Immutable public metadata only">
          Do not put mutable scores, changing commitments, raw identity, behavioral history, or
          private state in the DOB. The DOB is a public cross-chain anchor, not the score itself.
        </Callout>

        <h2 id="epoch-system">Epoch System</h2>
        <p>
          Veil scoring events carry an <code>eventEpoch</code> supplied by the issuer/backend.
          The contract enforces monotonicity so a user&apos;s event stream cannot be backdated.
          Epochs are used to:
        </p>
        <ul>
          <li>Enforce event monotonicity (events must not be backdated)</li>
          <li>Compute <code>epochsActive</code> (tenure contribution to score)</li>
          <li>Keep score updates ordered across issuer submissions</li>
        </ul>

        <h2 id="privacy-invariants">Privacy Invariants</h2>
        <p>
          The Veil scoring model is designed so that no participant — not even the Veil backend —
          can reconstruct a user&apos;s score from public data:
        </p>
        <ul>
          <li>
            <strong>Raw score never disclosed:</strong> Only ZK commitments (Merkle tree roots) are
            published on-chain. The actual numeric value stays in private state.
          </li>
          <li>
            <strong>Decision returns a band:</strong> Integrators learn only the decision band,
            LTV limit, risk premium, and validity timestamp — not the raw score or private inputs.
          </li>
          <li>
            <strong>Replay-protected challenges:</strong> Each verification call requires a fresh
            challenge that expires in 60 seconds and cannot be reused.
          </li>
          <li>
            <strong>Wallet authorization:</strong> The user signs the canonical credit decision
            message with their CKB wallet. Their Midnight secret key never leaves their machine
            and is never sent to a backend endpoint.
          </li>
        </ul>

        <PrevNext
          prev={{ title: "Quick Start", href: "/docs/quick-start", description: "Integrate in 5 minutes" }}
          next={{ title: "Integration Guide", href: "/docs/integration", description: "Step-by-step integration guide" }}
        />
      </article>

      <aside
        className="docs-toc-col"
        style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}
      >
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
