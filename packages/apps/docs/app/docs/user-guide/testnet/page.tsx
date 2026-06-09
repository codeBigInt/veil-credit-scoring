import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "Testnet Testing Guide",
  description:
    "Shareable instructions for testing the Veil app on Midnight preview and CKB testnet.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "before-you-start", text: "Before You Start", depth: 2 },
  { id: "networks", text: "Testnet Networks", depth: 2 },
  { id: "step-1-open-app", text: "1. Open the App", depth: 2 },
  { id: "step-2-midnight", text: "2. Connect Midnight Wallet", depth: 2 },
  { id: "step-3-join", text: "3. Join the Contract", depth: 2 },
  { id: "step-4-veil-id", text: "4. Generate Veil ID", depth: 2 },
  { id: "step-5-score", text: "5. Create Score Entry", depth: 2 },
  { id: "step-6-ckb", text: "6. Connect CKB Wallet", depth: 2 },
  { id: "step-7-faucet", text: "7. Claim CKB Faucet Tokens", depth: 2 },
  { id: "step-8-mint", text: "8. Mint Veil Identity DOB", depth: 2 },
  { id: "step-9-decision", text: "9. Authorize Risk Decision", depth: 2 },
  { id: "verify-with-veil-id-hash", text: "Use Veil ID Hash for Verification", depth: 2 },
  { id: "what-to-share", text: "What To Share Back", depth: 2 },
  { id: "troubleshooting", text: "Troubleshooting", depth: 2 },
];

const imageBase = "/testnet-guide-images";

function guideImageSrc(filename: string) {
  return `${imageBase}/${filename}`;
}

function GuideImage({ filename, alt, caption }: { filename: string; alt: string; caption: string }) {
  return (
    <figure
      style={{
        margin: "18px 0",
        border: "1px solid oklch(0.22 0 0)",
        borderRadius: "4px",
        overflow: "hidden",
        background: "oklch(0.1 0 0)",
      }}
    >
      <img
        src={guideImageSrc(filename)}
        alt={alt}
        loading="lazy"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
      />
      <figcaption
        style={{
          borderTop: "1px solid oklch(0.22 0 0)",
          color: "oklch(0.72 0 0)",
          fontSize: "12px",
          lineHeight: 1.5,
          padding: "10px 12px",
        }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

function GuideImageGrid({
  images,
}: {
  images: Array<{ filename: string; alt: string; caption: string }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "14px",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        margin: "18px 0 24px",
      }}
    >
      {images.map((image) => (
        <GuideImage key={image.filename} {...image} />
      ))}
    </div>
  );
}

export default function TestnetGuidePage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "User Guide", href: "/docs/user-guide" },
            { label: "Testnet Testing Guide" },
          ]}
        />

        <h1>Testnet Testing Guide</h1>
        <p className="prose-lead">
          Use this guide to test the Veil app on the current preview deployment. The goal is
          to create a private Midnight credit identity, anchor it with a CKB Spore DOB, and
          request a test risk decision.
        </p>

        <Callout variant="warning" title="Use test wallets only">
          This is a testnet flow. Do not use a wallet that holds important mainnet funds or
          assets. Testnet state can be reset, redeployed, or invalidated during development.
        </Callout>

        <h2 id="overview">Overview</h2>
        <p>
          A successful test run should end with these items visible in the dashboard:
        </p>
        <ul>
          <li>A connected Midnight wallet</li>
          <li>A connected Veil contract address</li>
          <li>A generated user public key, also called the Veil ID</li>
          <li>A confirmed credit score entry</li>
          <li>A minted CKB Veil Identity DOB with a Spore ID and transaction hash</li>
          <li>An optional risk decision result after CKB authorization</li>
        </ul>

        <h2 id="before-you-start">Before You Start</h2>
        <p>
          You need the following before opening the app:
        </p>
        <ul>
          <li>
            <strong>Chrome or Brave.</strong> Browser wallet extensions work best in a
            Chromium-based browser.
          </li>
          <li>
            <strong>A Midnight-compatible wallet.</strong> Use 1AM Wallet if available.
            Lace is also supported by the dashboard.
          </li>
          <li>
            <strong>A CKB testnet wallet.</strong> Metamask is the easiest option for most
            testers. Other CCC-supported CKB wallets may also work. Make sure the wallet is in testnet mode by selecting "Show test networks"
          </li>
          <li>
            <strong>Testnet CKB.</strong> Your CKB wallet needs enough testnet CKBytes to pay
            for the Spore DOB mint. You can claim faucet tokens after connecting your CKB
            wallet in the dashboard.
          </li>
          <li>
            <strong>The Veil app URL.</strong> Use the testnet app link shared by the Veil
            team, then open <code>/dashboard</code>.
          </li>
        </ul>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 165812.png",
              alt: "Chrome Web Store search results for 1AM Wallet",
              caption: "Search for 1AM Wallet in the Chrome Web Store.",
            },
            {
              filename: "Screenshot 2026-06-09 165820.png",
              alt: "1AM Wallet Chrome Web Store detail page",
              caption: "Open the 1AM Wallet listing and add the extension to Chrome.",
            },
            {
              filename: "Screenshot 2026-06-09 165904.png",
              alt: "1AM Wallet new wallet setup screen",
              caption: "Create a new 1AM wallet or restore an existing test wallet.",
            },
            {
              filename: "Screenshot 2026-06-09 165947.png",
              alt: "1AM Wallet faster sync prompt",
              caption: "Complete the 1AM wallet setup prompts before returning to Veil.",
            },
            {
              filename: "Screenshot 2026-06-09 170012.png",
              alt: "1AM Wallet network environment settings",
              caption: "Set the wallet network environment to Preview for the current Veil testnet.",
            },
            {
              filename: "Screenshot 2026-06-09 170639.png",
              alt: "1AM Wallet syncing on preview network",
              caption: "Wait for 1AM Wallet to sync on Preview before connecting it to the dashboard.",
            },
          ]}
        />

        <h2 id="networks">Testnet Networks</h2>
        <p>
          The current frontend example configuration targets these services:
        </p>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Current testnet value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Midnight network</td>
              <td><code>preview</code></td>
            </tr>
            <tr>
              <td>Current preview contract</td>
              <td><code>115b1fb509025f6d9f7d8976101a31f28014d4b5627f518c5601ed7ef1179cc5</code></td>
            </tr>
            <tr>
              <td>Veil backend API</td>
              <td><code>https://api.13-61-145-21.sslip.io/api/v1</code></td>
            </tr>
            <tr>
              <td>Midnight indexer</td>
              <td><code>https://indexer.preview.midnight.network/api/v4/graphql</code></td>
            </tr>
            <tr>
              <td>CKB explorer</td>
              <td><code>https://testnet.explorer.nervos.org</code></td>
            </tr>
          </tbody>
        </table>

        <Callout variant="info">
          If your dashboard shows a different managed contract address than another tester,
          confirm with the Veil team that you are using the latest testnet app link.
        </Callout>

        <h2 id="step-1-open-app">1. Open the App</h2>
        <ol>
          <li>Open the testnet app URL shared by the Veil team.</li>
          <li>Click <strong>Launch App</strong>, or go directly to <code>/dashboard</code>.</li>
          <li>Keep the browser console closed unless you are collecting an error report.</li>
        </ol>
        <GuideImage
          filename="Screenshot 2026-06-09 171207.png"
          alt="Veil dashboard wallet connection screen"
          caption="Open the dashboard and choose the Midnight wallet you want to connect."
        />

        <h2 id="step-2-midnight">2. Connect Midnight Wallet</h2>
        <ol>
          <li>Click your preferred Midnight wallet in the connect screen.</li>
          <li>Approve the wallet connection request.</li>
          <li>Confirm that the dashboard shows your connected Midnight wallet address.</li>
        </ol>
        <p>
          The dashboard supports 1AM Wallet and Lace through the Midnight dApp connector.
          If the wallet popup does not appear, unlock the extension and refresh the page.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171226.png",
              alt: "1AM Wallet connection approval prompt",
              caption: "Approve the 1AM connection request for the Veil dashboard.",
            },
            {
              filename: "Screenshot 2026-06-09 171238.png",
              alt: "Veil dashboard after Midnight wallet connection",
              caption: "After approval, the dashboard shows the connected Midnight wallet and current managed contract.",
            },
          ]}
        />

        <h2 id="step-3-join">3. Join the Contract</h2>
        <ol>
          <li>Find the <strong>Join Protocol Contract</strong> section.</li>
          <li>Click <strong>Join Contract</strong>.</li>
          <li>Approve any wallet prompt and wait until the connected contract is displayed.</li>
        </ol>
        <p>
          The first load may take longer because the app fetches ZK artifacts and opens local
          private state in the browser.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171247.png",
              alt: "Veil dashboard join contract action",
              caption: "Click Join Contract to connect your browser state to the deployed preview contract.",
            },
            {
              filename: "Screenshot 2026-06-09 171313.png",
              alt: "Veil dashboard connected contract state",
              caption: "When the contract is joined, the progress panel advances to Generate Veil ID.",
            },
          ]}
        />

        <h2 id="step-4-veil-id">4. Generate Midnight Veil ID</h2>
        <ol>
          <li>Click <strong>Generate Midnight Veil ID</strong>.</li>
          <li>Wait for the <strong>User Public Key</strong> field to appear.</li>
          <li>Copy the value if the Veil team asks you to include it in feedback.</li>
        </ol>
        <p>
          This creates your test Veil identity in the browser. It does not expose your wallet
          seed phrase or private key.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171327.png",
              alt: "Veil dashboard generating a Veil ID",
              caption: "Generate your Veil ID after the contract is connected.",
            },
            {
              filename: "Screenshot 2026-06-09 171336.png",
              alt: "Veil dashboard showing generated user public key",
              caption: "The dashboard displays your User Public Key after the Veil ID is generated.",
            },
          ]}
        />

        <h2 id="step-5-score">5. Create Score Entry</h2>
        <ol>
          <li>Click <strong>Create Score Entry + Prepare CKB DOB</strong>.</li>
          <li>Connect a CKB wallet if the app asks for one.</li>
          <li>Wait for the score entry status to show as confirmed.</li>
        </ol>
        <p>
          This step registers your Veil ID with the Midnight contract and prepares the CKB
          mint intent used in the next step.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171353.png",
              alt: "Veil dashboard create score entry action",
              caption: "Create the score entry once your Veil ID is available.",
            },
            {
              filename: "Screenshot 2026-06-09 171429.png",
              alt: "Veil dashboard score entry confirmed",
              caption: "The score entry confirmation prepares the flow for CKB wallet connection and DOB minting.",
            },
          ]}
        />

        <h2 id="step-6-ckb">6. Connect CKB Wallet</h2>
        <ol>
          <li>Click <strong>Connect CKB</strong> or <strong>Connect CKB Wallet</strong>.</li>
          <li>Select your CKB wallet from the wallet picker.</li>
          <li>Approve the connection request.</li>
          <li>Confirm that a CKB address appears in the dashboard session bar or stats area.</li>
        </ol>
        <p>
          For JoyID, follow the passkey or QR flow shown by the wallet. Make sure the wallet
          is on CKB testnet and has testnet CKBytes before minting.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171445.png",
              alt: "Veil dashboard CKB wallet connection controls",
              caption: "Use Connect CKB from the dashboard when the score entry is ready.",
            },
            {
              filename: "Screenshot 2026-06-09 171542.png",
              alt: "Veil dashboard with connected CKB wallet address",
              caption: "After connecting, copy the displayed CKB address for the faucet claim.",
            },
          ]}
        />

        <h2 id="step-7-faucet">7. Claim CKB Faucet Tokens</h2>
        <p>
          You can connect your preferred CKB wallet early, immediately after connecting your
          Midnight wallet, then copy the CKB address and claim faucet tokens before the app
          needs them. You can also wait until the dashboard prompts you to connect CKB during
          score entry or DOB minting.
        </p>
        <ol>
          <li>After connecting your CKB wallet, copy the connected CKB address from the dashboard.</li>
          <li>
            Open{" "}
            <a href="https://faucet.nervos.org" target="_blank" rel="noopener noreferrer">
              faucet.nervos.org
            </a>.
          </li>
          <li>Paste your copied CKB testnet address into the faucet claim form.</li>
          <li>Submit the claim and wait for the faucet transaction to complete.</li>
          <li>Return to the Veil dashboard once your CKB wallet shows the testnet CKBytes.</li>
          <li>Refresh the Veil dashboard so it can detect the updated CKB wallet balance.</li>
        </ol>
        <p>
          These faucet tokens are required because the Veil Identity DOB mint is paid by the
          connected CKB wallet. The backend prepares the mint intent, but it does not pay the
          CKB capacity or transaction fee for the user.
        </p>
        <Callout variant="tip">
          If you claimed faucet tokens after the app had already shown a CKB balance or mint
          error, refresh the page, reconnect or rejoin the contract if prompted, then click
          <strong>Generate Veil ID</strong> again. The same Midnight wallet and contract
          produce the same Veil ID, so this restores the dashboard state without creating a
          different user identity.
        </Callout>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 165810.png",
              alt: "Nervos Pudge Faucet claim form with CKB address pasted",
              caption: "Paste the connected CKB testnet address into the Nervos faucet claim form.",
            },
            {
              filename: "Screenshot 2026-06-09 165811.png",
              alt: "Nervos Pudge Faucet claim success message",
              caption: "Wait for the Claim Success message before returning to the Veil dashboard.",
            },
          ]}
        />

        <h2 id="step-8-mint">8. Mint Veil Identity DOB</h2>
        <ol>
          <li>Find the <strong>CKB Veil Identity DOB</strong> section.</li>
          <li>Click <strong>Mint Veil Identity DOB in CKB Wallet</strong>.</li>
          <li>Review and approve the CKB transaction in your wallet.</li>
          <li>Wait while the app records the mint.</li>
          <li>Confirm that the dashboard shows a <strong>Spore ID</strong> and CKB transaction hash.</li>
        </ol>
        <p>
          The DOB is a public CKB Spore object that anchors your Veil ID hash. Your score
          data remains private on Midnight.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171705.png",
              alt: "Veil dashboard CKB DOB mint action",
              caption: "Start the Veil Identity DOB mint from the CKB DOB section.",
            },
            {
              filename: "Screenshot 2026-06-09 171722.png",
              alt: "CKB wallet DOB mint confirmation",
              caption: "Approve the CKB wallet transaction that mints and pays for the Spore DOB.",
            },
          ]}
        />

        <h2 id="step-9-decision">9. Authorize Risk Decision</h2>
        <ol>
          <li>After the DOB is minted, click <strong>Authorize Risk Decision</strong>.</li>
          <li>Approve the CKB wallet signature request.</li>
          <li>Wait for the dashboard to show the risk decision result.</li>
        </ol>
        <p>
          It is normal for early test accounts to be unranked or have a limited decision
          result if no scoring events have been submitted for that Veil ID yet.
        </p>
        <GuideImage
          filename="Screenshot 2026-06-09 171738.png"
          alt="Veil dashboard after CKB DOB minting and risk decision authorization"
          caption="After minting, the dashboard shows the DOB details and lets you authorize a risk decision."
        />

        <h2 id="verify-with-veil-id-hash">Use Veil ID Hash for Credit Score Verification</h2>
        <p>
          The <code>veilIdHash</code> is the public identifier that connects your private
          Midnight credit identity to your CKB Veil Identity DOB. It is safe to share with a
          protocol that wants to verify your Veil credit status, because it does not reveal
          your Midnight seed phrase, CKB private key, or raw credit history.
        </p>
        <p>
          After the DOB is minted, copy these values from the dashboard:
        </p>
        <ul>
          <li><strong>Veil ID Hash</strong> — the 0x-prefixed hash shown in the DOB details.</li>
          <li><strong>Spore ID</strong> — the CKB DOB object ID shown in the minted DOB card.</li>
          <li><strong>CKB address</strong> — the CKB wallet address that owns the DOB.</li>
          <li><strong>User Public Key</strong> — also called <code>userPk</code>; used by the current preview API to locate your Midnight score entry.</li>
        </ul>
        <p>
          A lending app or other verifier should not ask for your seed phrase or private keys.
          The verifier uses the values above to request a fresh challenge from Veil, asks your
          CKB wallet to sign that challenge, then sends the signed request to the Veil backend
          for a credit decision.
        </p>
        <div
          style={{
            background: "oklch(0.12 0 0)",
            border: "1px solid oklch(0.22 0 0)",
            borderRadius: "2px",
            marginBottom: "16px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              borderBottom: "1px solid oklch(0.22 0 0)",
              color: "var(--primary)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              padding: "10px 12px",
              textTransform: "uppercase",
            }}
          >
            CKB wallet message to sign
          </div>
          <pre
            style={{
              color: "oklch(0.78 0 0)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              lineHeight: 1.7,
              margin: 0,
              overflowX: "auto",
              padding: "12px",
              whiteSpace: "pre",
            }}
          >{`Veil credit decision authorization
challenge:<challengeHex>
userPk:<userPkHex>
veilIdHash:<veilIdHash>
sporeId:<sporeId>`}</pre>
        </div>
        <p>
          The backend checks that the signed request is fresh, the CKB DOB exists, the DOB
          content contains the same <code>veilIdHash</code>, and the signing CKB wallet owns
          that DOB. If those checks pass, Veil returns a minimized result such as{" "}
          <code>approved</code>, <code>scoreBand</code>, <code>maxLtvBps</code>, and{" "}
          <code>riskPremiumBps</code>.
        </p>
        <Callout variant="info" title="What to share with a verifier">
          Share your <code>veilIdHash</code>, <code>sporeId</code>, CKB address, and current
          preview <code>userPk</code> only with apps you intend to verify through. Never share
          wallet seed phrases, private keys, or browser local-storage exports.
        </Callout>

        <h2 id="what-to-share">What To Share Back</h2>
        <p>
          After testing, send the Veil team the following:
        </p>
        <ul>
          <li>Whether you completed the full flow or where you got blocked</li>
          <li>Your browser and operating system</li>
          <li>Which Midnight wallet you used</li>
          <li>Which CKB wallet you used</li>
          <li>The Spore ID and CKB transaction hash if minting succeeded</li>
          <li>A screenshot of any error message</li>
          <li>Console errors only if the team asks for debugging details</li>
        </ul>

        <h2 id="troubleshooting">Troubleshooting</h2>
        <table>
          <thead>
            <tr>
              <th>Issue</th>
              <th>What to try</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Midnight wallet does not appear</td>
              <td>Unlock the extension, refresh the page, and try Chrome or Brave.</td>
            </tr>
            <tr>
              <td>Join contract takes a long time</td>
              <td>Wait for the first ZK artifact load to finish. If it fails, refresh and retry.</td>
            </tr>
            <tr>
              <td>CKB wallet cannot mint</td>
              <td>Check that the wallet is on testnet and has enough testnet CKBytes.</td>
            </tr>
            <tr>
              <td>DOB mint succeeds but app does not update</td>
              <td>Save the transaction hash, refresh the dashboard, and reconnect both wallets.</td>
            </tr>
            <tr>
              <td>Risk decision says unranked</td>
              <td>This can happen when no scoring events exist yet for your Veil ID.</td>
            </tr>
          </tbody>
        </table>

        <Callout variant="tip">
          If you are retrying with the same wallet after a failed test, refresh the page first.
          If the team redeployed the contract, use the latest app link and start with a clean
          test wallet when possible.
        </Callout>

        <PrevNext
          prev={{ title: "Dashboard Guide", href: "/docs/user-guide", description: "Using the Veil dashboard" }}
          next={{ title: "CKB Wallet Setup", href: "/docs/user-guide/ckb-wallet", description: "Set up CKB and mint your DOB" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
