import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import CodeBlock from "../../../../components/code-block";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Complete REST API reference for the Veil Protocol backend — DID resolution, scoring events, CKB identity, job polling, challenges, and credit decisions.",
};

const tocItems = [
  { id: "base-url", text: "Base URL", depth: 2 },
  { id: "system", text: "System", depth: 2 },
  { id: "dids", text: "DID Resolution", depth: 2 },
  { id: "score-entries", text: "Score Entries", depth: 2 },
  { id: "ckb-identity", text: "CKB Identity", depth: 2 },
  { id: "scoring-events", text: "Scoring Events", depth: 2 },
  { id: "jobs", text: "Jobs", depth: 2 },
  { id: "challenges", text: "Challenges", depth: 2 },
  { id: "credit-decisions", text: "Credit Decisions", depth: 2 },
  { id: "types", text: "Type Reference", depth: 2 },
];

const scoreEntryBody = `{
  "userPk": "0xabc123...",          // user's Veil public key (32 bytes hex)
  "veilIdHash": "0x...",            // optional — auto-derived from userPk if omitted
  "userCkbAddress": "ckb1qyq..."    // user's CKB wallet address for DOB minting
}`;
const scoreEntryResponse = `{
  "success": true,
  "created": true,
  "did": "did:veil:0x...",          // the user's Veil DID (W3C DID format)
  "scoreEntry": { "exists": true, "hasAccumulator": false, "hasCreditScore": false },
  "ckbMintIntent": { ... },         // mint intent for the CKB identity pass
  "job": {
    "id": "job_7f3a91b2",
    "status": "pending",
    "createdAt": "2025-06-07T12:00:00.000Z"
  }
}`;

const didResolveResponse = `{
  "success": true,
  "didDocument": {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://veil.id/contexts/veil-did/v1"
    ],
    "id": "did:veil:0x...",
    "controller": "did:veil:0x...",
    "verificationMethod": [{
      "id": "did:veil:0x...#ckb-owner-1",
      "type": "CkbSecp256k1VerificationKey2026",
      "controller": "did:veil:0x...",
      "blockchainAccountId": "ckb:ckb1qyq...",
      "publicKeyHash": "0x..."
    }],
    "authentication": ["did:veil:0x...#ckb-owner-1"],
    "assertionMethod": ["did:veil:0x...#ckb-owner-1"],
    "service": [
      {
        "id": "did:veil:0x...#credit-decision",
        "type": "VeilCreditDecisionService",
        "serviceEndpoint": "https://api.13-61-145-21.sslip.io/api/v1/credit-decisions"
      },
      {
        "id": "did:veil:0x...#identity-dob",
        "type": "CkbSporeDobService",
        "serviceEndpoint": "ckb:spore:0x..."
      }
    ],
    "veil": {
      "veilIdHash": "0x...",
      "status": "active",
      "version": 1,
      "sporeId": "0x...",
      "sporeIdHash": "0x...",
      "ckbOwnerLockHash": "0x...",
      "midnightRegistry": "7c7d7b78...",
      "createdAt": "2025-06-07T12:00:00.000Z"
    }
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
  "userPk": "0x...",              // optional — used to register DID on Midnight
  "userCkbAddress": "ckb1qyq...",
  "sporeId": "0x...",
  "txHash": "0x..."
}`;
const recordResponse = `{
  "success": true,
  "did": "did:veil:0x...",        // the user's Veil DID — store this for credit checks
  "sporeId": "0x...",
  "sporeIdHash": "0x...",
  "txHash": "0x...",
  "veilIdHash": "0x...",
  "ckbOwnerLockHash": "0x...",
  "didRegistryTxHash": "0x..."    // Midnight DID registration tx hash (when userPk provided)
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

const decisionBodyDid = `{
  "did": "did:veil:0x...",                  // the user's Veil DID (recommended)
  "challenge": "0x1a2b3c4d...",             // from POST /challenges
  "authorization": {
    "signature": "0x...",                   // CKB wallet signature over DID message
    "identity": "0x...",                    // signing public key (hex)
    "signType": "ckbSecp256k1",             // CKB signing scheme
    "verificationMethod": "did:veil:0x...#ckb-owner-1"
  }
}`;

const decisionBodyLegacy = `// Legacy flow — use only when the user's DID is not yet registered on Midnight
{
  "userPk": "0xabc123...",
  "veilIdHash": "0x...",
  "sporeId": "0x...",
  "userCkbAddress": "ckb1qyq...",
  "challenge": "0x1a2b3c4d...",
  "authorization": {
    "signature": "0x...",
    "identity": "0x...",
    "signType": "ckbSecp256k1"
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
  maxLtvBps: number;       // max LTV in basis points, e.g. 6500 = 65%
  riskPremiumBps: number;  // risk premium in basis points, e.g. 150 = 1.5%
  hasCreditScore: boolean;
  reason: string;
  veilIdHash: string;
  validAt: string;         // ISO 8601
}

// CKB signing schemes supported by authorization
type SignType =
  | 'ckbSecp256k1'
  | 'btcEcdsa'
  | 'nostrEvent';

// Authorization object (included in credit decision requests)
interface Authorization {
  signature: string;           // hex
  identity: string;            // public key hex
  signType: SignType;
  verificationMethod?: string; // e.g. "did:veil:0x...#ckb-owner-1"
}

// DID credit decision request body
interface DidCreditDecisionRequest {
  did: string;                 // e.g. "did:veil:0x..."
  challenge: string;           // from POST /challenges
  authorization: Authorization;
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
          Set <code>VEIL_API_URL</code> to the Veil backend endpoint provided during issuer
          onboarding. The current preview API base is{" "}
          <code>https://api.13-61-145-21.sslip.io/api/v1</code>. All paths below are relative
          to this base URL.
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
          The Veil API uses a job queue for all on-chain operations. Most write endpoints return
          a <code>job</code> object immediately — use <code>GET /jobs/:id</code> to poll for
          completion before taking action on the result. Credit decisions (<code>POST /credit-decisions</code>)
          are synchronous and return the result directly.
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
            <p>Returns service status. Use this to confirm the backend is reachable.</p>
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

        {/* ── DID RESOLUTION ── */}
        <h2 id="dids">DID Resolution</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-get">GET</span>
            <span className="endpoint-path">/dids/resolve</span>
            <span className="endpoint-desc">Resolve a Veil DID to a DID Document</span>
          </div>
          <div className="endpoint-body">
            <p>
              Resolves a <code>did:veil:…</code> identifier to a W3C-compliant DID Document.
              The document contains the user&apos;s verification method (CKB public key hash),
              authentication references, and service endpoints for credit decisions and identity
              pass lookup. Use this endpoint to verify a user&apos;s identity or to discover the
              credit decision service endpoint from their DID alone.
            </p>
            <h4>Query Parameters</h4>
            <table>
              <thead>
                <tr><th>Parameter</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>did</code></td>
                  <td>Yes</td>
                  <td>The Veil DID to resolve, e.g. <code>did:veil:0x1a2b3c…</code></td>
                </tr>
              </tbody>
            </table>
            <h4>Response (200 OK)</h4>
            <CodeBlock code={didResolveResponse} language="json" />
            <h4>Error responses</h4>
            <table>
              <thead>
                <tr><th>Status</th><th>Cause</th></tr>
              </thead>
              <tbody>
                <tr><td><code>400</code></td><td>Missing or malformed <code>did</code> query parameter</td></tr>
                <tr><td><code>404</code></td><td>DID not found — user has not minted an identity pass yet</td></tr>
                <tr><td><code>409</code></td><td>DID found but not yet registered on Midnight (mint in progress)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SCORE ENTRIES ── */}
        <h2 id="score-entries">Score Entries</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/score-entries</span>
            <span className="endpoint-desc">Register a user and prepare their identity pass</span>
          </div>
          <div className="endpoint-body">
            <p>
              Creates an empty credit score entry on Midnight for the user and returns a
              CKB identity pass mint intent plus the user&apos;s Veil DID. Call this when a
              user first joins the Veil protocol. If the score entry already exists, the
              endpoint returns the existing state without creating a new job.
            </p>
            <h4>Request Body</h4>
            <CodeBlock code={scoreEntryBody} language="json" />
            <h4>Response (202 Accepted — new entry / 200 OK — already exists)</h4>
            <CodeBlock code={scoreEntryResponse} language="json" />
          </div>
        </div>

        {/* ── CKB IDENTITY ── */}
        <h2 id="ckb-identity">CKB Identity</h2>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method-badge method-post">POST</span>
            <span className="endpoint-path">/ckb/veil-identity/mint-intent</span>
            <span className="endpoint-desc">Create an identity pass mint intent</span>
          </div>
          <div className="endpoint-body">
            <p>
              Returns a Spore DOB mint intent for the user&apos;s Veil Identity Pass. The
              frontend passes this intent to the user&apos;s CKB wallet to submit the mint
              transaction on the CKB network. If the identity pass is already minted, returns
              <code>alreadyMinted: true</code> with the existing DOB record.
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
            <span className="endpoint-desc">Record a completed identity pass mint and register the DID</span>
          </div>
          <div className="endpoint-body">
            <p>
              After the user submits the mint transaction from their CKB wallet, call this
              endpoint to record the Spore ID and transaction hash. When <code>userPk</code> is
              provided, the backend also <strong>registers the user&apos;s DID on Midnight</strong>{" "}
              via the DID Registry contract. The response includes the user&apos;s{" "}
              <code>did:veil:…</code> identifier.
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
            <span className="endpoint-desc">Fetch identity pass content and validity</span>
          </div>
          <div className="endpoint-body">
            <p>
              Returns the content stored inside the user&apos;s Veil Identity Pass (Spore DOB) and
              verifies that the DOB content and lock script match the expected Veil identity
              anchor format.
            </p>
            <h4>Response (200 OK)</h4>
            <CodeBlock code={getDobResponse} language="json" />
          </div>
        </div>

        {/* ── SCORING EVENTS ── */}
        <h2 id="scoring-events">Scoring Events</h2>
        <p>
          All four event endpoints accept <code>userPk</code>, <code>issuerPk</code>, and an
          <code>eventEpoch</code>. Each returns a job — poll <code>GET /jobs/:id</code> for
          completion.
        </p>
        <Callout variant="warning" title="Issuer authorization required">
          Your <code>issuerPk</code> must be registered on-chain. Unregistered issuers are
          rejected by the ZK circuit — the job will fail with a circuit validation error.
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
              until the status is <code>succeeded</code> or <code>failed</code>.
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
              Issues a cryptographically random, single-use challenge for the credit decision
              authorization flow. Challenges expire after <strong>60 seconds</strong> and cannot
              be reused — request a fresh one for each credit decision.
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
              Verifies the user&apos;s Veil identity, validates their authorization signature,
              and returns a credit decision based on their private Midnight score. This is a
              <strong> synchronous</strong> endpoint — the decision is returned directly in
              the response. Two request formats are supported.
            </p>

            <h4>DID Flow (Recommended)</h4>
            <p>
              Pass only the user&apos;s <code>did:veil:…</code> identifier. The backend resolves
              the DID internally to find the identity pass, Midnight score, and CKB wallet.
            </p>

            <Callout variant="info" title="DID authorization message">
              The user&apos;s CKB wallet signs the following newline-delimited message:
              <code style={{ display: "block", marginTop: 8, fontSize: 12, fontFamily: "monospace", lineHeight: 1.7 }}>
                Veil credit decision authorization{"\n"}
                did:&#123;did:veil:0x...&#125;{"\n"}
                challenge:&#123;challengeHex&#125;{"\n"}
                verificationMethod:&#123;did:veil:0x...#ckb-owner-1&#125;{"\n"}
                registryVersion:1{"\n"}
                purpose:credit-decision
              </code>
            </Callout>

            <CodeBlock code={decisionBodyDid} language="json" filename="DID request body" />

            <h4>Legacy Flow</h4>
            <p>
              Used when the user&apos;s DID has not yet been registered on Midnight (older
              accounts). Pass <code>userPk</code>, <code>veilIdHash</code>,{" "}
              <code>sporeId</code>, and <code>userCkbAddress</code> explicitly.
            </p>
            <CodeBlock code={decisionBodyLegacy} language="json" filename="Legacy request body" />

            <h4>Response (200 OK)</h4>
            <CodeBlock code={decisionApproved} language="json" />

            <h4>Error responses</h4>
            <table>
              <thead>
                <tr><th>Status</th><th>Cause</th></tr>
              </thead>
              <tbody>
                <tr><td><code>400</code></td><td>Missing required fields or malformed DID</td></tr>
                <tr><td><code>401</code></td><td>Challenge expired or already used</td></tr>
                <tr><td><code>401</code></td><td>Identity pass <code>veilIdHash</code> does not match request</td></tr>
                <tr><td><code>401</code></td><td>CKB address does not match identity pass owner lock hash</td></tr>
                <tr><td><code>401</code></td><td>Invalid or unrecognized Veil Identity Pass</td></tr>
                <tr><td><code>401</code></td><td>Authorization signature does not verify</td></tr>
                <tr><td><code>404</code></td><td>DID not found</td></tr>
                <tr><td><code>409</code></td><td>DID not yet registered on Midnight</td></tr>
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
