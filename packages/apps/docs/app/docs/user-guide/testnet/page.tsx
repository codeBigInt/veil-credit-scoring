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
  { id: "step-3-initialize", text: "3. Create Veil ID", depth: 2 },
  { id: "step-4-veil-id", text: "4. View Veil Key", depth: 2 },
  { id: "step-5-score", text: "5. Create Credit Profile", depth: 2 },
  { id: "step-6-ckb", text: "6. Connect CKB Wallet", depth: 2 },
  { id: "step-7-faucet", text: "7. Claim CKB Faucet Tokens", depth: 2 },
  { id: "step-8-mint", text: "8. Mint Identity Pass", depth: 2 },
  { id: "step-9-decision", text: "9. Check Credit Status", depth: 2 },
  { id: "verify-with-veil-did", text: "Use Veil ID for Verification", depth: 2 },
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
          to create a private Veil credit profile, mint a CKB identity pass, and run a test
          credit check.
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
          <li>A connected Veil network address</li>
          <li>A created Veil ID</li>
          <li>A confirmed credit profile</li>
          <li>A minted CKB identity pass with a record ID and transaction hash</li>
          <li>An optional credit check result after CKB wallet approval</li>
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
            for the identity pass mint. You can claim faucet tokens after connecting your CKB
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
              caption: "After approval, the dashboard shows the connected Midnight wallet and current Veil network.",
            },
          ]}
        />

        <h2 id="step-3-initialize">3. Create Veil ID</h2>
        <ol>
          <li>Find the <strong>Create Veil ID</strong> section.</li>
          <li>Click <strong>Create Veil ID</strong>.</li>
          <li>Wait while the dashboard sets up your private browser data and selects the current Veil network.</li>
        </ol>
        <p>
          This step prepares the private browser data used for your Veil credit profile. It
          does not expose your wallet seed phrase or private keys.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171247.png",
              alt: "Veil dashboard create ID action",
              caption: "Click Create Veil ID to set up your private browser data.",
            },
            {
              filename: "Screenshot 2026-06-09 171313.png",
              alt: "Veil dashboard created ID state",
              caption: "When the Veil network is selected, the progress panel moves to the Veil key step.",
            },
          ]}
        />

        <h2 id="step-4-veil-id">4. View Veil Key</h2>
        <ol>
          <li>Click <strong>Create Veil ID</strong> if the dashboard has not already created it.</li>
          <li>Wait for the <strong>Veil Key</strong> field to appear.</li>
          <li>Copy the value only if the Veil team asks you to include it in feedback.</li>
        </ol>
        <p>
          The Veil key helps the scoring system find your private credit profile. It does not
          expose your wallet seed phrase, Midnight private key, or CKB private key.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171327.png",
              alt: "Veil dashboard creating a Veil key",
              caption: "Create your Veil key after the network is selected.",
            },
            {
              filename: "Screenshot 2026-06-09 171336.png",
              alt: "Veil dashboard showing generated Veil key",
              caption: "The dashboard displays your Veil key after setup completes.",
            },
          ]}
        />

        <h2 id="step-5-score">5. Create Credit Profile</h2>
        <ol>
          <li>Click <strong>Create Credit Profile</strong>.</li>
          <li>Connect a CKB wallet if the app asks for one.</li>
          <li>Wait for the credit profile status to show as confirmed.</li>
        </ol>
        <p>
          This step creates your private score profile and prepares the CKB identity pass used
          in the next step.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171353.png",
              alt: "Veil dashboard create credit profile action",
              caption: "Create the credit profile once your Veil ID is ready.",
            },
            {
              filename: "Screenshot 2026-06-09 171429.png",
              alt: "Veil dashboard credit profile confirmed",
              caption: "The credit profile confirmation prepares the flow for CKB wallet connection and identity pass minting.",
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
              caption: "Use Connect CKB from the dashboard when the credit profile is ready.",
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
          credit profile or identity pass minting.
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
          These faucet tokens are required because the identity pass mint is paid by the
          connected CKB wallet. The backend prepares the mint, but it does not pay the CKB
          storage or transaction fee for the user.
        </p>
        <Callout variant="tip">
          If you claimed faucet tokens after the app had already shown a CKB balance or mint
          error, refresh the page, reconnect your wallets if prompted, then click
          <strong>Create Veil ID</strong> again. The same Midnight wallet, Veil network, and
          browser data restore the same Veil ID.
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

        <h2 id="step-8-mint">8. Mint Identity Pass</h2>
        <ol>
          <li>Find the <strong>CKB Identity Pass</strong> section.</li>
          <li>Click <strong>Mint Identity Pass in CKB Wallet</strong>.</li>
          <li>Review and approve the CKB transaction in your wallet.</li>
          <li>Wait while the app records the mint.</li>
          <li>Confirm that the dashboard shows your <strong>Veil ID</strong>, record details, and a <strong>View Transaction</strong> link.</li>
        </ol>
        <p>
          The identity pass is a public CKB record that proves this Veil ID belongs to your
          CKB wallet. Your score data remains private on Midnight.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-09 171705.png",
              alt: "Veil dashboard identity pass mint action",
              caption: "Start the identity pass mint from the CKB Identity Pass section.",
            },
            {
              filename: "Screenshot 2026-06-09 171722.png",
              alt: "CKB wallet identity pass mint confirmation",
              caption: "Approve the CKB wallet transaction that mints and pays for the identity pass.",
            },
          ]}
        />

        <h2 id="step-9-decision">9. Check Credit Status</h2>
        <ol>
          <li>After the identity pass is minted, click <strong>Check My Credit</strong>.</li>
          <li>Approve the CKB wallet signature request.</li>
          <li>Wait for the dashboard to show the credit check result.</li>
        </ol>
        <p>
          It is normal for early test accounts to be unranked if no activity has been submitted
          for that Veil ID yet.
        </p>
        <GuideImage
          filename="Screenshot 2026-06-09 171738.png"
          alt="Veil dashboard after CKB identity pass minting and credit check"
          caption="After minting, the dashboard shows the identity pass details and lets you run a credit check."
        />

        <h2 id="verify-with-veil-did">Use Veil ID for Credit Checks</h2>
        <p>
          Your Veil ID connects your private Midnight credit profile to your CKB identity pass.
          It is safe to share with an app that wants to check your Veil credit status, because
          it does not reveal your seed phrase, CKB private key, or raw credit history.
        </p>
        <p>
          After the identity pass is minted, use the QR card or <strong>Copy Verify Link</strong>
          to share a verification link. The dashboard shortens long identifiers visually, but
          copy buttons still copy the full values.
        </p>
        <ul>
          <li><strong>Veil ID</strong> — the ID shown in the minted identity pass card.</li>
          <li><strong>Record ID</strong> — the CKB record ID shown in the pass details.</li>
          <li><strong>ID Hash</strong> — the 0x-prefixed hash stored inside the pass content.</li>
          <li><strong>CKB address</strong> — the CKB wallet address that owns the identity pass.</li>
          <li><strong>Veil key</strong> — also called <code>userPk</code>; used by the preview API to locate your score profile.</li>
        </ul>
        <p>
          A lending app or other checker should not ask for your seed phrase or private keys.
          It asks your CKB wallet to sign a short approval message, then sends that signed
          request to Veil for a credit check.
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
          The backend checks that the signed request is fresh, the CKB identity pass exists,
          and the signing CKB wallet owns that pass. If those checks pass, Veil returns a
          minimized result such as{" "}
          <code>approved</code>, <code>scoreBand</code>, <code>maxLtvBps</code>, and{" "}
          <code>riskPremiumBps</code>.
        </p>
        <Callout variant="info" title="What to share with a verifier">
          Share your Veil ID or verification link with apps you want to use. Technical
          integrations may also ask for <code>veilIdHash</code>, <code>sporeId</code>, CKB
          address, and preview <code>userPk</code>. Never share wallet seed phrases, private
          keys, or browser private-state exports.
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
          <li>The record ID and CKB transaction hash if minting succeeded</li>
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
              <td>Create Veil ID takes a long time</td>
              <td>Unlock the Midnight wallet, refresh, and retry.</td>
            </tr>
            <tr>
              <td>CKB wallet cannot mint</td>
              <td>Check that the wallet is on testnet and has enough testnet CKBytes.</td>
            </tr>
            <tr>
              <td>Identity pass mint succeeds but app does not update</td>
              <td>Save the transaction hash, refresh the dashboard, and reconnect both wallets.</td>
            </tr>
            <tr>
              <td>Credit check says unranked</td>
              <td>This can happen when no activity exists yet for your Veil ID.</td>
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
          next={{ title: "CKB Wallet Setup", href: "/docs/user-guide/ckb-wallet", description: "Set up CKB and mint your identity pass" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
