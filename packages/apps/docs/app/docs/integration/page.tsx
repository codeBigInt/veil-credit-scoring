import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Integration Guide",
  description:
    "How to register as an issuer, submit behavioral events, obtain challenges, and verify user trust status via the Veil Protocol API.",
};

const tocItems = [
  { id: "prerequisites", text: "Prerequisites", depth: 2 },
  { id: "step-1-register", text: "Step 1: Register as an Issuer", depth: 2 },
  { id: "step-2-submit", text: "Step 2: Submit Behavioral Events", depth: 2 },
  { id: "step-3-challenge", text: "Step 3: Obtain a Challenge", depth: 2 },
  { id: "step-4-decision", text: "Step 4: Request a Credit Decision", depth: 2 },
  { id: "step-5-jobs", text: "Step 5: Poll Job Status", depth: 2 },
  { id: "typescript-example", text: "TypeScript Example", depth: 2 },
  { id: "policy-examples", text: "Policy Examples", depth: 2 },
  { id: "error-handling", text: "Error Handling", depth: 2 },
];

const step2Submit = `const VEIL_API = process.env.VEIL_API_URL ?? 'https://api.13-61-145-21.sslip.io/api/v1';

// Submit a repayment event
const res = await fetch(\`\${VEIL_API}/scoring-events/repayments\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPk: '0xabc123...',        // user's Veil ID (32 bytes hex)
    issuerPk: '0xdef456...',      // your registered issuer public key
    paidOnTimeFlag: 1,            // 1 = on time, 0 = late
    amountWeight: 1000,           // normalized loan size
    eventEpoch: 3,                // current protocol epoch
  }),
});
const { job } = await res.json();
// → { id: "job_...", status: "pending" }`;

const step3Challenge = `// Request a one-time challenge (valid for 60 seconds)
const res = await fetch(\`\${VEIL_API}/challenges\`, { method: 'POST' });
const { challenge, challengeExpiresAt } = await res.json();
// Use challenge in POST /credit-decisions within 60s`;

const step4Decision = `// After obtaining a challenge and the user's CKB signature:
const res = await fetch(\`\${VEIL_API}/credit-decisions\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPk: '0xabc123...',           // user's Veil ID
    veilIdHash: '0x...',             // hash of the Veil ID
    sporeId: '0x...',                // user's CKB Spore DOB ID
    userCkbAddress: 'ckb1...',       // user's CKB wallet address
    challenge: '0x...',              // from POST /challenges
    authorization: {
      signature: '0x...',            // CKB wallet signature over the decision message
      identity: '0x...',            // signing key (public key hex)
      signType: 'ckbSecp256k1',     // CKB signing scheme
    },
  }),
});
const decision = await res.json();`;

const decisionResponse = `{
  "success": true,
  "approved": true,
  "scoreBand": "gold",
  "maxLtvBps": 6500,
  "riskPremiumBps": 150,
  "hasCreditScore": true,
  "reason": "Approved for gold tier",
  "veilIdHash": "0x...",
  "validAt": "2025-06-07T12:00:00.000Z"
}`;

const tsExample = `const VEIL_API = process.env.VEIL_API_URL ?? 'https://api.13-61-145-21.sslip.io/api/v1';

// Submit any scoring event
async function submitRepayment(params: {
  userPk: string;
  issuerPk: string;
  paidOnTimeFlag: 0 | 1;
  amountWeight: number;
  eventEpoch: number;
}): Promise<string> {
  const res = await fetch(\`\${VEIL_API}/scoring-events/repayments\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(\`Submit failed: \${res.status}\`);
  const { job } = await res.json();
  return job.id;
}

// Poll job until settled
async function waitForJob(jobId: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { job } = await fetch(\`\${VEIL_API}/jobs/\${jobId}\`).then((r) => r.json());
    if (job.status === 'succeeded') return;
    if (job.status === 'failed') throw new Error(job.error ?? 'Job failed');
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Timed out waiting for job');
}

// Verify user trust before granting privileged access
async function verifyUserTrust(
  userPk: string,
  veilIdHash: string,
  sporeId: string,
  userCkbAddress: string,
  authorization: { signature: string; identity: string; signType: string },
): Promise<{ approved: boolean; scoreBand: string }> {
  // 1. Obtain fresh challenge
  const { challenge } = await fetch(\`\${VEIL_API}/challenges\`, { method: 'POST' }).then((r) => r.json());

  // 2. Request credit decision (user must sign the decision message)
  const res = await fetch(\`\${VEIL_API}/credit-decisions\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPk, veilIdHash, sporeId, userCkbAddress, challenge, authorization }),
  });
  if (!res.ok) throw new Error(\`Decision failed: \${res.status}\`);
  return res.json();
}`;

export default function IntegrationPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Integration" },
            { label: "Integration Guide" },
          ]}
        />

        <h1>Integration Guide</h1>
        <p className="prose-lead">
          Integrate Veil into your DeFi protocol in five steps: register as an issuer,
          submit behavioral events as users interact with your protocol, obtain a challenge,
          request a credit decision tied to the user&apos;s on-chain identity, and act on the result.
        </p>

        <h2 id="prerequisites">Prerequisites</h2>
        <ul>
          <li>
            <strong>Issuer registration:</strong> Your protocol must be registered by the Veil
            admin before you can submit events. Contact the Veil team to initiate registration.
            You will receive an <code>issuerPk</code> — keep this secure.
          </li>
          <li>
            <strong>Veil API access:</strong> Set <code>VEIL_API_URL</code> to the Veil backend
            URL provided during onboarding. Current preview endpoint: <code>https://api.13-61-145-21.sslip.io/api/v1</code>.
          </li>
          <li>
            <strong>User Veil IDs:</strong> Users must have joined the Veil protocol via the
            dashboard to have a <code>userPk</code> (Veil ID). Events submitted before a user
            registers are queued and applied when they do.
          </li>
          <li>
            <strong>User Veil Identity DOB:</strong> For credit decisions, the user must have
            minted a Veil Identity DOB on CKB. This serves as their on-chain identity anchor
            and is required for the authorization flow.
          </li>
        </ul>

        <Callout variant="info" title="No direct blockchain access required">
          Your protocol does not need a Midnight wallet or any blockchain SDK. The Veil backend
          abstracts all ZK proof generation, private state management, and transaction submission.
          You interact via standard REST.
        </Callout>

        <h2 id="step-1-register">Step 1: Register as an Issuer</h2>
        <p>
          Issuer registration is a one-time process handled by the Veil admin. The admin calls
          <code>Admin_addIssuer</code> on-chain with your protocol name and contract address.
          Upon registration you receive:
        </p>
        <ul>
          <li><code>issuerPk</code> — your protocol&apos;s identity key within Veil. Include this in every event submission.</li>
        </ul>
        <p>
          Registered issuers are listed in the contract&apos;s public ledger state. Any event
          submitted with an unregistered issuer key is rejected by the ZK circuit.
        </p>

        <Callout variant="warning" title="Issuer key security">
          Your <code>issuerPk</code> is a public key derived from your protocol&apos;s registration.
          While it is not secret, it is your identity in the Veil system — treat it as a stable
          identifier and store it securely in your backend configuration.
        </Callout>

        <h2 id="step-2-submit">Step 2: Submit Behavioral Events</h2>
        <p>
          As users interact with your protocol, submit behavioral events in real time. Four event
          types are available — see the <a href="/docs/scoring-model#scoring-events">Scoring Model</a>{" "}
          for the full field reference.
        </p>

        <table>
          <thead>
            <tr>
              <th>User action</th>
              <th>Event endpoint</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Loan repaid (on time or late)</td>
              <td><code>POST /scoring-events/repayments</code></td>
            </tr>
            <tr>
              <td>Position liquidated</td>
              <td><code>POST /scoring-events/liquidations</code></td>
            </tr>
            <tr>
              <td>User interacted with your protocol</td>
              <td><code>POST /scoring-events/protocol-usage</code></td>
            </tr>
            <tr>
              <td>Periodic debt state snapshot</td>
              <td><code>POST /scoring-events/debt-states</code></td>
            </tr>
          </tbody>
        </table>

        <CodeBlock code={step2Submit} language="typescript" filename="Submit a repayment event" />

        <p>
          All event endpoints return a <strong>job</strong>. Because events are processed via
          ZK circuits on Midnight, they are queued asynchronously. You do not need to wait for
          one event to complete before submitting the next — events are processed independently.
        </p>

        <Callout variant="tip">
          Submit events only after the user has created a Veil score entry. The Midnight circuit
          rejects events for unknown users because there is no private score accumulator to update.
        </Callout>

        <h2 id="step-3-challenge">Step 3: Obtain a Challenge</h2>
        <p>
          Before requesting a credit decision, obtain a one-time challenge from the Veil backend.
          Challenges expire in 60 seconds and cannot be reused — they prevent replay attacks
          on the authorization flow.
        </p>
        <CodeBlock code={step3Challenge} language="typescript" filename="GET a challenge" />
        <p>
          Present the <code>challenge</code> to the user so they can sign the decision message
          with their CKB wallet (step 4).
        </p>

        <h2 id="step-4-decision">Step 4: Request a Credit Decision</h2>
        <p>
          A credit decision verifies that the user holds a valid Veil Identity DOB on CKB and
          is authorized to claim the associated Veil score. The user must sign a specific
          message with their CKB wallet to prove ownership.
        </p>
        <CodeBlock code={step4Decision} language="typescript" filename="POST /credit-decisions" />
        <CodeBlock code={decisionResponse} language="json" filename="Decision response" />
        <p>
          The decision message that the user&apos;s CKB wallet must sign is:
        </p>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header"><span className="code-block-lang">text</span><span className="code-block-filename">Message format</span></div>
          <pre className="code-block-pre">{`Veil credit decision authorization
challenge:<challengeHex>
userPk:<userPkHex>
veilIdHash:<veilIdHash>
sporeId:<sporeId>`}</pre>
        </div>
        <p>
          The decision response contains:
        </p>
        <ul>
          <li><code>approved</code> — <code>true</code> if the user has a valid DOB and meets the current decision policy</li>
          <li><code>scoreBand</code> — the trust tier: <code>unranked</code> · <code>bronze</code> · <code>silver</code> · <code>gold</code> · <code>platinum</code></li>
          <li><code>maxLtvBps</code> and <code>riskPremiumBps</code> — lending policy outputs derived from the band</li>
          <li><code>validAt</code> — ISO 8601 timestamp of when the decision was issued</li>
        </ul>

        <Callout variant="warning" title="Decision freshness">
          Always issue a fresh challenge for each decision request. Reusing a challenge or a
          stale decision without a new authorization signature is rejected by the backend.
        </Callout>

        <h2 id="step-5-jobs">Step 5: Poll Job Status</h2>
        <p>
          Scoring events are queued as jobs. ZK proof generation on Midnight takes seconds to
          minutes. Poll the job endpoint until the status is <code>succeeded</code> or{" "}
          <code>failed</code>.
        </p>
        <table>
          <thead>
            <tr><th>Status</th><th>Meaning</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr><td><code>pending</code></td><td>Queued or proof in progress</td><td>Continue polling every 3–5s</td></tr>
            <tr><td><code>succeeded</code></td><td>Event committed on-chain</td><td>Done — move on</td></tr>
            <tr><td><code>failed</code></td><td>Error during processing</td><td>Check <code>error</code> field; retry with backoff</td></tr>
          </tbody>
        </table>

        <h2 id="typescript-example">TypeScript Example</h2>
        <p>A complete integration showing event submission, polling, and trust verification:</p>
        <CodeBlock code={tsExample} language="typescript" filename="veil-integration.ts" />

        <h2 id="policy-examples">Policy Examples</h2>
        <p>
          Use the <code>scoreBand</code> from the credit decision to gate privileged actions
          in your protocol:
        </p>
        <table>
          <thead>
            <tr><th>Policy</th><th>Recommended tier</th></tr>
          </thead>
          <tbody>
            <tr><td>Undercollateralized borrowing</td><td>Platinum only</td></tr>
            <tr><td>Preferential interest rate</td><td>Gold or Platinum</td></tr>
            <tr><td>Reduced liquidation buffer</td><td>Gold or Platinum</td></tr>
            <tr><td>Basic credit access</td><td>Bronze or above</td></tr>
            <tr><td>Protocol access gating</td><td>Silver or above</td></tr>
          </tbody>
        </table>

        <h2 id="error-handling">Error Handling</h2>
        <table>
          <thead>
            <tr><th>Status</th><th>Meaning</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Missing or invalid request fields</td><td>Check request schema</td></tr>
            <tr><td><code>401</code></td><td>Invalid challenge, expired, or bad signature</td><td>Re-obtain challenge and re-sign</td></tr>
            <tr><td><code>404</code></td><td>Job or user not found</td><td>Verify the userPk; user may not be registered</td></tr>
            <tr><td><code>500</code></td><td>Backend or Midnight node error</td><td>Retry with exponential backoff</td></tr>
          </tbody>
        </table>

        <PrevNext
          prev={{ title: "Scoring Model", href: "/docs/scoring-model", description: "How credit scores are computed" }}
          next={{ title: "API Reference", href: "/docs/integration/api-reference", description: "All endpoints documented" }}
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
