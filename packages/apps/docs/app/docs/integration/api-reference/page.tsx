import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import CodeBlock from "../../../../components/code-block";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Complete REST API reference for the Veil Protocol backend — scoring events, CKB identity, job polling, challenges, and credit decisions.",
};

const tocItems = [
  { id: "base-url", text: "Base URL", depth: 2 },
  { id: "system", text: "System", depth: 2 },
  { id: "score-entries", text: "Score Entries", depth: 2 },
  { id: "ckb-identity", text: "CKB Identity", depth: 2 },
  { id: "scoring-events", text: "Scoring Events", depth: 2 },
  { id: "jobs", text: "Jobs", depth: 2 },
  { id: "challenges", text: "Challenges", depth: 2 },
  { id: "credit-decisions", text: "Credit Decisions", depth: 2 },
  { id: "types", text: "Type Reference", depth: 2 },
];

const scoreEntryBody = `{
  "userPk": "0xabc123...",          // user's Veil ID (32 bytes hex)
  "veilIdHash": "0x...",            // optional — auto-derived from userPk if omitted
  "userCkbAddress": "ckb1qyq..."    // user's CKB wallet address for DOB minting
}`;
const scoreEntryResponse = `{
  "success": true,
  "job": {
    "id": "job_7f3a91b2",
    "status": "pending",
    "createdAt": "2025-06-07T12:00:00.000Z"
  }
}`;

const mintIntentBody = `{
  "veilIdHash": "0x...",
  "userCkbAddress": "ckb1qyq..."
}`;
const mintIntentResponse = `{
  "success": true,
  "intent": {
    "contentType": "application/json",
    "content": {
      "protocol": "Veil",
      "objectType": "VeilIdentity",
      "veilIdHash": "0x...",
      "ownerCkbLockHash": "0x...",
      "midnightNetwork": "preprod",
      "midnightContract": "7c7d7b78...",
      "version": "1"
    },
    "lockScript": {
      "codeHash": "0x...",
      "hashType": "data2",
      "args": "0x..."
    },
    "cellDeps": [{ "...": "..." }]
  }
}`;

const recordBody = `{
  "veilIdHash": "0x...",
  "userCkbAddress": "ckb1qyq...",
  "sporeId": "0x...",
  "txHash": "0x...",
  "midnightContractAddress": "7c7d7b78..."
}`;
const recordResponse = `{
  "success": true,
  "sporeId": "0x...",
  "txHash": "0x...",
  "veilIdHash": "0x..."
}`;

const getDobResponse = `{
  "sporeId": "0x...",
  "content": {
    "protocol": "Veil",
    "objectType": "VeilIdentity",
    "veilIdHash": "0x...",
    "ownerCkbLockHash": "0x...",
    "midnightNetwork": "preprod",
    "midnightContract": "7c7d7b78...",
    "version": "1"
  },
  "validVeilIdentity": true
}`;

const repaymentBody = `{
  "userPk": "0xabc123...",
  "issuerPk": "0xdef456...",
  "paidOnTimeFlag": 1,
  "amountWeight": 1000,
  "eventEpoch": 5,
  "eventId": "0x..."          // optional — auto-generated if omitted
}`;

const liquidationBody = `{
  "userPk": "0xabc123...",
  "issuerPk": "0xdef456...",
  "severity": 2,              // 1 = minor, 2 = moderate, 3 = severe
  "eventEpoch": 5,
  "eventId": "0x..."
}`;

const protocolUsageBody = `{
  "userPk": "0xabc123...",
  "issuerPk": "0xdef456...",
  "protocolId": "0x...",      // stable 32-byte protocol identifier
  "eventEpoch": 5
}`;

const debtStateBody = `{
  "userPk": "0xabc123...",
  "issuerPk": "0xdef456...",
  "activeDebtFlag": 1,        // 1 = has active debt, 0 = none
  "riskBand": 1,              // 0 = healthy → 3 = high-risk
  "eventEpoch": 5,
  "eventId": "0x..."
}`;

const eventResponse = `{
  "success": true,
  "job": {
    "id": "job_9a2b3c4d",
    "status": "pending",
    "createdAt": "2025-06-07T12:00:00.000Z"
  }
}`;

const jobPending = `{
  "success": true,
  "job": {
    "id": "job_9a2b3c4d",
    "status": "pending",
    "createdAt": "2025-06-07T12:00:00.000Z"
  }
}`;

const jobSucceeded = `{
  "success": true,
  "job": {
    "id": "job_9a2b3c4d",
    "status": "succeeded",
    "result": { "veilIdHash": "0x..." },
    "createdAt": "2025-06-07T12:00:00.000Z",
    "completedAt": "2025-06-07T12:00:08.000Z"
  }
}`;

const jobFailed = `{
  "success": true,
  "job": {
    "id": "job_9a2b3c4d",
    "status": "failed",
    "error": "Midnight node timeout — retry with backoff",
    "createdAt": "2025-06-07T12:00:00.000Z",
    "completedAt": "2025-06-07T12:00:30.000Z"
  }
}`;

const challengeResponse = `{
  "challenge": "0x1a2b3c4d...",   // 32-byte hex — include in /credit-decisions
  "challengeExpiresAt": 1749294060000  // unix ms — expires in 60 seconds
}`;

const decisionBody = `{
  "userPk": "0xabc123...",
  "veilIdHash": "0x...",
  "sporeId": "0x...",                    // user's CKB Spore DOB ID
  "userCkbAddress": "ckb1qyq...",
  "challenge": "0x1a2b3c4d...",          // from POST /challenges
  "authorization": {
    "signature": "0x...",                // CKB wallet signature over decision message
    "identity": "0x...",                 // signing public key (hex)
    "signType": "ckbSecp256k1"           // CKB signing scheme
  }
}`;

const decisionApproved = `{
  "success": true,
  "approved": true,
  "scoreBand": "gold",
  "maxLtvBps": 6500,
  "riskPremiumBps": 150,
  "hasCreditScore": true,
  "reason": "Approved for gold tier",
  "veilIdHash": "0x...",
  "validAt": "2025-06-07T12:00:10.000Z"
}`;

const typeDefs = `// Scoring event response (all four event endpoints)
interface EventResponse {
  success: boolean;
  job: Job;
}

// Job states
type JobStatus = 'pending' | 'succeeded' | 'failed';

interface Job {
  id: string;
  status: JobStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;       // ISO 8601
  completedAt?: string;    // ISO 8601, present when terminal
}

// Credit tiers
type ScoreBand = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum';

// Credit decision response
interface CreditDecision {
  success: boolean;
  approved: boolean;
  scoreBand: ScoreBand;
  maxLtvBps: number;
  riskPremiumBps: number;
  hasCreditScore: boolean;
  reason: string;
  veilIdHash: string;
  validAt: string;         // ISO 8601
}

// CKB signing schemes
type SignType =
  | 'ckbSecp256k1'
  | 'btcEcdsa'
  | 'nostrEvent';

// Challenge authorization object
interface Authorization {
  signature: string;       // hex
  identity: string;        // public key hex
  signType: SignType;
}`;

export default function ApiReferencePage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Integration", href: "/docs/integration" },
            { label: "API Reference" },
          ]}
        />

        <h1>API Reference</h1>
        <p className="prose-lead">
          Complete REST API reference for the Veil Protocol backend service. All endpoints
          accept and return JSON over HTTPS and use standard HTTP status codes.
        </p>

        <h2 id="base-url">Base URL</h2>
        <p>
          Set <code>VEIL_API_URL</code> to the Veil backend endpoint provided during
          issuer onboarding. The current preview API base is <code>https://api.13-61-145-21.sslip.io/api/v1</code>. All paths below are relative to this base URL.
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
          https://api.13-61-145-21.sslip.io/api/v1
        </div>

        <Callout variant="info">
          The Veil API uses a job queue for all on-chain operations. Most write endpoints
          return a <code>job</code> object immediately — use <code>GET /jobs/:id</code> to
          poll for completion before taking action on the result.
        </Callout>

        {/* ── SYSTEM ── */}
        <h2 id="system">System</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-get">GET</span>
            <span className="endpoint-path">/health</span>
            <span className="endpoint-desc">Health check</span>
          </div>
          <div className="endpoint-body">
            <p>Returns service status. Use this to verify the backend is reachable.</p>
            <CodeBlock code={`{ "success": true, "service": "veil-backend", "version": "v1" }`} language="json" filename="Response" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-get">GET</span>
            <span className="endpoint-path">/contract</span>
            <span className="endpoint-desc">Contract address</span>
          </div>
          <div className="endpoint-body">
            <p>Returns the deployed Midnight contract address.</p>
            <CodeBlock
              code={`{\n  "success": true,\n  "contractAddress": "7c7d7b78ebcf6a67862fde64d5717f08109cadf0666b90b3b8179aef15ec1b9e"\n}`}
              language="json"
              filename="Response"
            />
          </div>
        </div>

        {/* ── SCORE ENTRIES ── */}
        <h2 id="score-entries">Score Entries</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/score-entries</span>
            <span className="endpoint-desc">Register a user and prepare DOB mint</span>
          </div>
          <div className="endpoint-body">
            <p>
              Creates an empty credit score entry on Midnight for the user and returns a
              CKB DOB mint intent. Call this when a user first joins the Veil protocol.
              The returned job covers both the on-chain Midnight transaction and the DOB
              mint preparation.
            </p>
            <h4>Request Body</h4>
            <CodeBlock code={scoreEntryBody} language="json" />
            <h4>Response (202 Accepted)</h4>
            <CodeBlock code={scoreEntryResponse} language="json" />
          </div>
        </div>

        {/* ── CKB IDENTITY ── */}
        <h2 id="ckb-identity">CKB Identity</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/ckb/veil-identity/mint-intent</span>
            <span className="endpoint-desc">Create a DOB mint intent</span>
          </div>
          <div className="endpoint-body">
            <p>
              Returns a Spore DOB mint intent for the user&apos;s Veil Identity. The frontend
              uses this intent to submit the mint transaction to the CKB network via the
              user&apos;s CKB wallet.
            </p>
            <h4>Request Body</h4>
            <CodeBlock code={mintIntentBody} language="json" />
            <h4>Response (200 OK)</h4>
            <CodeBlock code={mintIntentResponse} language="json" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/ckb/veil-identity/record</span>
            <span className="endpoint-desc">Record a completed DOB mint</span>
          </div>
          <div className="endpoint-body">
            <p>
              After the user submits the mint transaction from their CKB wallet, call this
              endpoint to record the resulting Spore ID and transaction hash on the Veil
              backend. This links the on-chain DOB to the user&apos;s Veil ID.
            </p>
            <h4>Request Body</h4>
            <CodeBlock code={recordBody} language="json" />
            <h4>Response (201 Created)</h4>
            <CodeBlock code={recordResponse} language="json" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-get">GET</span>
            <span className="endpoint-path">/ckb/veil-identity/:sporeId</span>
            <span className="endpoint-desc">Fetch DOB content and validity</span>
          </div>
          <div className="endpoint-body">
            <p>
              Returns the content embedded in the user&apos;s Veil Identity DOB and verifies
              that the DOB content and deployed <code>veil_sbt_lock</code> match the expected
              Veil identity-anchor format.
            </p>
            <h4>Response (200 OK)</h4>
            <CodeBlock code={getDobResponse} language="json" />
          </div>
        </div>

        {/* ── SCORING EVENTS ── */}
        <h2 id="scoring-events">Scoring Events</h2>
        <p>
          All four event endpoints accept <code>userPk</code>, <code>issuerPk</code>, and
          an <code>eventEpoch</code>. Each returns a job. Poll{" "}
          <code>GET /jobs/:id</code> for completion.
        </p>
        <Callout variant="warning" title="Issuer authorization required">
          Your <code>issuerPk</code> must be registered on-chain. Unregistered issuers
          are rejected by the ZK circuit — the job will fail.
        </Callout>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/scoring-events/repayments</span>
            <span className="endpoint-desc">Submit a loan repayment event</span>
          </div>
          <div className="endpoint-body">
            <CodeBlock code={repaymentBody} language="json" />
            <CodeBlock code={eventResponse} language="json" filename="Response (202)" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/scoring-events/liquidations</span>
            <span className="endpoint-desc">Submit a liquidation event</span>
          </div>
          <div className="endpoint-body">
            <CodeBlock code={liquidationBody} language="json" />
            <CodeBlock code={eventResponse} language="json" filename="Response (202)" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/scoring-events/protocol-usage</span>
            <span className="endpoint-desc">Submit a protocol usage event</span>
          </div>
          <div className="endpoint-body">
            <CodeBlock code={protocolUsageBody} language="json" />
            <CodeBlock code={eventResponse} language="json" filename="Response (202)" />
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/scoring-events/debt-states</span>
            <span className="endpoint-desc">Submit a debt state snapshot</span>
          </div>
          <div className="endpoint-body">
            <CodeBlock code={debtStateBody} language="json" />
            <CodeBlock code={eventResponse} language="json" filename="Response (202)" />
          </div>
        </div>

        {/* ── JOBS ── */}
        <h2 id="jobs">Jobs</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-get">GET</span>
            <span className="endpoint-path">/jobs/:id</span>
            <span className="endpoint-desc">Poll job status</span>
          </div>
          <div className="endpoint-body">
            <p>
              Returns the current status of any asynchronous job. Poll every 3–5 seconds
              until status is <code>succeeded</code> or <code>failed</code>.
            </p>
            <CodeBlock code={jobPending} language="json" filename="pending" />
            <CodeBlock code={jobSucceeded} language="json" filename="succeeded" />
            <CodeBlock code={jobFailed} language="json" filename="failed" />
          </div>
        </div>

        {/* ── CHALLENGES ── */}
        <h2 id="challenges">Challenges</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/challenges</span>
            <span className="endpoint-desc">Obtain a one-time challenge</span>
          </div>
          <div className="endpoint-body">
            <p>
              Issues a cryptographically random, single-use challenge for the credit
              decision authorization flow. Challenges expire after 60 seconds and cannot
              be reused — request a fresh one for each decision.
            </p>
            <CodeBlock code={challengeResponse} language="json" filename="Response (201)" />
          </div>
        </div>

        {/* ── CREDIT DECISIONS ── */}
        <h2 id="credit-decisions">Credit Decisions</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/credit-decisions</span>
            <span className="endpoint-desc">Request a ZK-verified credit decision</span>
          </div>
          <div className="endpoint-body">
            <p>
              Verifies the user&apos;s Veil Identity DOB on CKB, validates their authorization
              signature, and returns a credit decision based on their Midnight score.
              This is a synchronous endpoint — the response includes the decision directly.
            </p>

            <Callout variant="info" title="Decision message format">
              The user&apos;s CKB wallet must sign the following newline-delimited message:
              <code style={{ display: "block", marginTop: 8, fontSize: 12, fontFamily: "monospace" }}>
                Veil credit decision authorization{"\n"}
                challenge:&#123;challengeHex&#125;{"\n"}
                userPk:&#123;userPkHex&#125;{"\n"}
                veilIdHash:&#123;veilIdHash&#125;{"\n"}
                sporeId:&#123;sporeId&#125;
              </code>
            </Callout>

            <h4>Request Body</h4>
            <CodeBlock code={decisionBody} language="json" />
            <h4>Response (200 OK)</h4>
            <CodeBlock code={decisionApproved} language="json" />

            <h4>Error responses</h4>
            <table>
              <thead>
                <tr><th>Status</th><th>Cause</th></tr>
              </thead>
              <tbody>
                <tr><td><code>401</code></td><td>Expired or already-used challenge</td></tr>
                <tr><td><code>401</code></td><td>DOB <code>veilIdHash</code> does not match request</td></tr>
                <tr><td><code>401</code></td><td>CKB address does not match DOB owner lock hash</td></tr>
                <tr><td><code>401</code></td><td>Invalid DOB — not a registered Veil Identity</td></tr>
                <tr><td><code>401</code></td><td>Invalid authorization signature</td></tr>
                <tr><td><code>500</code></td><td>Backend or Midnight node error — retry with backoff</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 id="types">Type Reference</h2>
        <CodeBlock code={typeDefs} language="typescript" filename="types.ts" />

        <PrevNext
          prev={{ title: "Integration Guide", href: "/docs/integration", description: "Step-by-step guide" }}
          next={{ title: "Dashboard Guide", href: "/docs/user-guide", description: "Using the Veil dashboard" }}
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
