import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Quick Start",
  description:
    "Integrate Veil in under 5 minutes — submit a user event, get a challenge, request a private credit check using the user's Veil DID, and act on the result.",
};

const tocItems = [
  { id: "what-you-need", text: "What You Need", depth: 2 },
  { id: "step-1", text: "1. Submit a User Event", depth: 2 },
  { id: "step-2", text: "2. Obtain a Challenge", depth: 2 },
  { id: "step-3", text: "3. Request a Credit Check", depth: 2 },
  { id: "step-4", text: "4. Read the Result", depth: 2 },
  { id: "complete-example", text: "Complete Example", depth: 2 },
  { id: "next-steps", text: "Next Steps", depth: 2 },
];

const step1 = `# Submit a repayment event for a user
curl -X POST "$VEIL_API_URL/scoring-events/repayments" \\
  -H "Content-Type: application/json" \\
  -d '{
    "userPk": "<user-veil-key-hex>",
    "issuerPk": "<your-issuer-pk-hex>",
    "paidOnTimeFlag": 1,
    "amountWeight": 1000,
    "eventEpoch": 3,
    "eventId": "<optional-unique-event-id>"
  }'
# → { "success": true, "job": { "id": "job_7f3a91b2", "status": "pending", ... } }`;

const step2 = `# Obtain a one-time challenge (expires in 60 seconds)
curl -X POST "$VEIL_API_URL/challenges"
# → { "challenge": "0x1a2b3c4d...", "challengeExpiresAt": 1749294060000 }`;

const step3 = `# The user's Veil DID — they share it with you or you resolve it
VEIL_DID="did:veil:0x..."
CHALLENGE="0x1a2b3c4d..."

# Build the message for the user's CKB wallet to sign:
# Veil credit decision authorization
# did:<VEIL_DID>
# challenge:<CHALLENGE>
# verificationMethod:<VEIL_DID>#ckb-owner-1
# registryVersion:1
# purpose:credit-decision

# After the user signs the message with their CKB wallet:
curl -X POST "$VEIL_API_URL/credit-decisions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "did": "'"$VEIL_DID"'",
    "challenge": "'"$CHALLENGE"'",
    "authorization": {
      "signature": "0x...",
      "identity": "<signing-key-hex>",
      "signType": "ckbSecp256k1",
      "verificationMethod": "'"$VEIL_DID"'#ckb-owner-1"
    }
  }'`;

const step4 = `# Successful credit decision response:
{
  "success": true,
  "approved": true,
  "scoreBand": "gold",
  "maxLtvBps": 6500,
  "riskPremiumBps": 150,
  "validAt": "2025-06-07T12:00:10.000Z"
}`;

const fullExample = `const VEIL = process.env.VEIL_API_URL ?? 'https://api.13-61-145-21.sslip.io/api/v1';

interface CkbSigner {
  signMessage(message: string): Promise<{ signature: string; identity: string; signType: string }>;
}

async function quickIntegration(
  userPk: string,      // user's Veil public key — for submitting behavioral events
  veilDid: string,     // user's Veil DID (did:veil:0x...) — for credit decisions
  issuerPk: string,
  ckbSigner: CkbSigner,
) {
  // 1. Submit a repayment event
  const { job } = await fetch(\`\${VEIL}/scoring-events/repayments\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userPk,
      issuerPk,
      paidOnTimeFlag: 1,
      amountWeight: 1000,
      eventEpoch: 3,
    }),
  }).then((r) => r.json());

  // Optionally poll the event job (not required before requesting a decision)
  await pollJob(job.id);

  // 2. Obtain a fresh challenge
  const { challenge } = await fetch(\`\${VEIL}/challenges\`, { method: 'POST' })
    .then((r) => r.json());

  // 3. Build the DID authorization message and have the user sign it
  const verificationMethod = \`\${veilDid}#ckb-owner-1\`;
  const message = [
    'Veil credit decision authorization',
    \`did:\${veilDid}\`,
    \`challenge:\${challenge}\`,
    \`verificationMethod:\${verificationMethod}\`,
    'registryVersion:1',
    'purpose:credit-decision',
  ].join('\\n');
  const authorization = await ckbSigner.signMessage(message);

  // 4. Request the credit decision
  const decision = await fetch(\`\${VEIL}/credit-decisions\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      did: veilDid,
      challenge,
      authorization: { ...authorization, verificationMethod },
    }),
  }).then((r) => r.json());

  // 5. Act on the result
  if (decision.approved) {
    console.log(\`Tier: \${decision.scoreBand}, Max LTV: \${decision.maxLtvBps / 100}%\`);
    grantPrivilegedAccess(decision.scoreBand);
  }

  return decision;
}

async function pollJob(jobId: string): Promise<void> {
  while (true) {
    const { job } = await fetch(\`\${VEIL}/jobs/\${jobId}\`).then((r) => r.json());
    if (job.status === 'succeeded') return;
    if (job.status === 'failed') throw new Error(job.error ?? 'Job failed');
    await new Promise((r) => setTimeout(r, 3000));
  }
}

declare function grantPrivilegedAccess(band: string): void;`;

export default function QuickStartPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "Getting Started" },
            { label: "Quick Start" },
          ]}
        />

        <h1>Quick Start</h1>
        <p className="prose-lead">
          Get a private credit check from Veil in four API calls. Submit a behavioral event,
          get a challenge, have the user sign with their CKB wallet, and read the result. No
          smart contract deployment needed on your end.
        </p>

        <Callout variant="info" title="Time to complete">
          This guide takes about 5 minutes to follow. For production patterns with full error
          handling, polling utilities, and TypeScript types, see the{" "}
          <a href="/docs/integration">Integration Guide</a>.
        </Callout>

        <h2 id="what-you-need">What You Need</h2>
        <ul>
          <li>
            <strong><code>VEIL_API_URL</code></strong> — the Veil backend endpoint provided
            during issuer onboarding. Current preview endpoint:{" "}
            <code>https://api.13-61-145-21.sslip.io/api/v1</code>.
          </li>
          <li>
            <strong><code>issuerPk</code></strong> — your app&apos;s issuer key, assigned when
            the Veil admin approves your registration.
          </li>
          <li>
            <strong><code>userPk</code></strong> — the user&apos;s Veil Key from the dashboard.
            Protocols use this to submit behavioral events keyed to that user.
          </li>
          <li>
            <strong>User&apos;s Veil DID (<code>did:veil:0x…</code>)</strong> — the user obtains
            this from the dashboard after minting their identity pass. This is the only
            identifier you need to request a credit decision. Users can share it freely.
          </li>
        </ul>

        <Callout variant="tip">
          You do not need to deploy any smart contract or run a Midnight node. The Veil backend
          handles proof generation and Midnight transactions entirely on your behalf.
        </Callout>

        <h2 id="step-1">1. Submit a User Event</h2>
        <p>
          Tell Veil about something the user did in your app. In this example, a user made an
          on-time loan repayment. Submit events in real time using the user&apos;s Veil Key. The
          backend queues the event and processes it on Midnight.
        </p>
        <CodeBlock code={step1} language="bash" filename="POST /scoring-events/repayments" />
        <p>
          All four event types follow the same pattern: <code>POST /scoring-events/repayments</code>,{" "}
          <code>/liquidations</code>, <code>/protocol-usage</code>, and <code>/debt-states</code>.
          See the <a href="/docs/scoring-model#scoring-events">Scoring Model</a> for field
          details. Each event returns a job ID — use <code>GET /jobs/:id</code> to poll until
          the event settles on-chain.
        </p>

        <h2 id="step-2">2. Obtain a Challenge</h2>
        <p>
          Before requesting a credit decision, obtain a one-time challenge from the backend.
          Challenges expire in 60 seconds and prevent replay attacks. Request a fresh challenge
          each time — never cache or reuse one.
        </p>
        <CodeBlock code={step2} language="bash" filename="POST /challenges" />

        <h2 id="step-3">3. Request a Credit Check</h2>
        <p>
          Build a short authorization message using the user&apos;s Veil DID and the challenge,
          have their CKB wallet sign it, then submit the signed request. The backend verifies
          the user&apos;s identity pass and returns a credit decision.
        </p>
        <div
          style={{
            background: "oklch(0.12 0 0)",
            border: "1px solid oklch(0.22 0 0)",
            borderRadius: "2px",
            padding: "12px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "oklch(0.65 0 0)",
            marginBottom: "16px",
          }}
        >
          <div style={{ color: "var(--primary)", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
            Message to sign (DID flow)
          </div>
          {`Veil credit decision authorization\ndid:{veilDid}\nchallenge:{challengeHex}\nverificationMethod:{veilDid}#ckb-owner-1\nregistryVersion:1\npurpose:credit-decision`}
        </div>
        <CodeBlock code={step3} language="bash" filename="POST /credit-decisions" />

        <h2 id="step-4">4. Read the Result</h2>
        <p>
          The response tells you the user&apos;s trust tier and whether they are approved for
          the action you are gating. <code>/credit-decisions</code> is synchronous — no
          polling needed.
        </p>
        <CodeBlock code={step4} language="json" filename="Decision response" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          {[
            { field: "approved", desc: "true if the user has a valid identity pass, a registered DID, and meets the current policy." },
            { field: "scoreBand", desc: "Trust tier: unranked · bronze · silver · gold · platinum" },
            { field: "maxLtvBps", desc: "Maximum loan-to-value in basis points. 6500 = 65% LTV. Use this directly in your lending logic." },
            { field: "validAt", desc: "ISO 8601 timestamp. The decision reflects the user's state at this exact moment." },
          ].map((item) => (
            <div
              key={item.field}
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
                  fontFamily: "monospace",
                }}
              >
                {item.field}
              </div>
              <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>

        <h2 id="complete-example">Complete Example</h2>
        <p>
          All four steps in a single TypeScript function using the DID flow:
        </p>
        <CodeBlock code={fullExample} language="typescript" filename="quick-start.ts" />

        <h2 id="next-steps">Next Steps</h2>
        <ul>
          <li>
            <a href="/docs/integration">Integration Guide</a> — production-ready patterns with
            full error handling, retry logic, and all four event types.
          </li>
          <li>
            <a href="/docs/integration/api-reference">API Reference</a> — complete reference
            for all endpoints, including DID resolution, request schemas, and response types.
          </li>
          <li>
            <a href="/docs/scoring-model">Scoring Model</a> — understand the scoring formula
            and how behavioral signals map to trust tiers.
          </li>
          <li>
            <a href="/docs/user-guide">Dashboard Guide</a> — walk users through creating their
            Veil ID, minting their identity pass, and sharing their Veil DID.
          </li>
        </ul>

        <PrevNext
          prev={{ title: "Introduction", href: "/docs/introduction", description: "What Veil is and how it works" }}
          next={{ title: "Scoring Model", href: "/docs/scoring-model", description: "How credit scores are computed" }}
        />
      </article>

      <aside
        className="docs-toc-col"
        style={{
          position: "sticky",
          top: "var(--header-h)",
          height: "calc(100vh - var(--header-h))",
          overflowY: "auto",
          padding: "32px 0 40px",
          flexShrink: 0,
        }}
      >
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
