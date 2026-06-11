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
              caption: "Create a new 1AM wallet or restore an existing test wallet. Set the network environment to Preview before connecting.",
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
          filename="Screenshot 2026-06-10 220315.png"
          alt="Veil app connect screen showing 1AM Wallet option"
          caption="Open the dashboard to see the wallet connection screen. Select 1AM Wallet for the best Midnight experience."
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
              filename: "Screenshot 2026-06-10 221913.png",
              alt: "1AM Wallet connection request for Veil dashboard",
              caption: "Approve the connection request in your 1AM wallet when prompted.",
            },
            {
              filename: "Screenshot 2026-06-10 221934.png",
              alt: "Veil Dashboard after 1AM wallet is connected",
              caption: "After approval, your Midnight wallet address appears in the session bar and the Create Veil ID step becomes active.",
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
              filename: "Screenshot 2026-06-10 221951.png",
              alt: "Dashboard showing Veil ID creation in progress",
              caption: "Click Create Veil ID and wait while the dashboard sets up your private browser data.",
            },
            {
              filename: "Screenshot 2026-06-10 222023.png",
              alt: "Dashboard after Veil ID is created showing Veil Key in stats bar",
              caption: "When setup completes, your Veil Key appears in the stats bar and the progress panel advances to the next step.",
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
        <GuideImage
          filename="Screenshot 2026-06-10 222037.png"
          alt="Veil Key section on dashboard with Export Keys and Connect CKB Wallet"
          caption="Your Veil Key is shown in its own section after Veil ID is created. Copy it only if the Veil team specifically asks for it. The Credit Profile section below prompts you to connect a CKB wallet next."
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
              filename: "Screenshot 2026-06-10 222124.png",
              alt: "Dashboard after CKB wallet connected showing Create Credit Profile button",
              caption: "After connecting your CKB wallet, the Create Credit Profile button becomes active.",
            },
            {
              filename: "Screenshot 2026-06-10 222144.png",
              alt: "Dashboard showing creating credit profile in progress",
              caption: "The dashboard shows a creating status while it processes your credit profile on Midnight. Wait for confirmation before proceeding.",
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
              filename: "Screenshot 2026-06-10 222052.png",
              alt: "CKB wallet picker showing JoyID, MetaMask, EVM, OKX, UniSat, and UTXO Global options",
              caption: "Select your CKB wallet from the picker. MetaMask is the easiest option for most testers.",
            },
            {
              filename: "Screenshot 2026-06-10 222106.png",
              alt: "MetaMask CKB connection approval popup",
              caption: "Approve the connection in your CKB wallet. After approval, your CKB address appears in the dashboard header.",
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
          <li>Wait while the app records the mint and registers your DID on Midnight.</li>
          <li>
            Confirm that the dashboard shows:
            <ul>
              <li>Your <strong>Veil ID</strong> — a <code>did:veil:0x…</code> identifier in the identity pass card</li>
              <li>A <strong>Record ID</strong> and <strong>View Transaction</strong> link</li>
              <li>A <strong>QR code panel</strong> on the left for sharing your DID verification link</li>
            </ul>
          </li>
        </ol>
        <p>
          The identity pass is a permanent public record on CKB that proves your Veil DID belongs
          to your CKB wallet. Your score data remains private on Midnight. The backend also
          registers your DID on Midnight during this step, making it resolvable by any protocol.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-10 222412.png",
              alt: "MetaMask signature request for CKB identity pass mint transaction",
              caption: "Approve the CKB transaction in your wallet to mint and pay for the identity pass.",
            },
            {
              filename: "Screenshot 2026-06-10 222510.png",
              alt: "Dashboard complete state showing QR code and ID Minted card with Veil ID",
              caption: "After minting completes, the dashboard shows your Veil ID in the identity pass card and a QR code for sharing.",
            },
          ]}
        />

        <h2 id="step-9-decision">9. Check Credit Status</h2>
        <ol>
          <li>After the identity pass is minted, click <strong>Check My Credit</strong>.</li>
          <li>
            Your CKB wallet will ask you to sign a short message tied to your Veil DID. This
            proves you control the identity pass without revealing any private keys.
          </li>
          <li>Wait for the dashboard to show the credit check result.</li>
          <li>
            The result shows your current credit band (Unranked, Bronze, Silver, Gold, or
            Platinum) and the LTV limit associated with that band.
          </li>
        </ol>
        <p>
          It is normal for early test accounts to be unranked if no activity has been submitted
          for that Veil ID yet. Your score improves as partner protocols submit behavioral data.
        </p>
        <GuideImageGrid
          images={[
            {
              filename: "Screenshot 2026-06-10 222522.png",
              alt: "MetaMask showing the Veil DID credit decision authorization message to sign",
              caption: "Click Check My Credit to prompt your CKB wallet to sign a short message tied to your Veil DID.",
            },
            {
              filename: "Screenshot 2026-06-10 222546.png",
              alt: "Final dashboard state showing Veil ID, View Transaction link, and Check My Credit button",
              caption: "After signing, the dashboard shows your identity pass details, a View Transaction link, and your current credit status.",
            },
          ]}
        />

        <h2 id="verify-with-veil-did">Use Veil ID for Credit Checks</h2>
        <p>
          After minting your identity pass, the dashboard shows your <strong>Veil ID</strong> — a
          globally unique identifier in the format <code>did:veil:0x…</code>. This is a
          Decentralized Identifier (DID) that connects your private Midnight credit profile to
          your CKB identity pass.
        </p>
        <p>
          Your Veil DID is safe to share with any app that wants to check your credit status.
          It does not reveal your seed phrase, Midnight private key, CKB private key, or raw
          credit history.
        </p>
        <p>
          After the identity pass is minted, use the <strong>Copy ID</strong> button, the QR card,
          or <strong>Copy Verify Link</strong> to share your identity with apps. The dashboard
          shortens long identifiers visually, but the copy buttons always copy the full values.
        </p>
        <ul>
          <li><strong>Veil ID</strong> — your <code>did:veil:0x…</code> DID shown in the identity pass card. This is the main identifier to share.</li>
          <li><strong>Verify Link</strong> — a URL pointing to the DID resolution endpoint for your DID. Apps can follow this link to verify your identity.</li>
          <li><strong>QR Code</strong> — encodes the same verify link. Apps can scan it to initiate a credit check without you typing anything.</li>
          <li><strong>Record ID</strong> — the CKB Spore record ID shown in the pass details. Used internally by the backend.</li>
          <li><strong>ID Hash</strong> — the 0x-prefixed hash stored inside the pass content. Technical integrations may ask for this.</li>
          <li><strong>Veil key</strong> — also called <code>userPk</code>; used by protocols to submit behavioral events for your profile.</li>
        </ul>
        <p>
          A lending app or other checker should not ask for your seed phrase or private keys.
          It asks your CKB wallet to sign a short authorization message tied to your Veil DID,
          then sends that signed request to Veil for a credit decision.
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
            CKB wallet message to sign (DID flow)
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
did:<your-veil-did>
challenge:<challengeHex>
verificationMethod:<your-veil-did>#ckb-owner-1
registryVersion:1
purpose:credit-decision`}</pre>
        </div>
        <p>
          The backend checks that the signed request is fresh, the Veil DID is registered on
          Midnight, and the signing CKB wallet owns the associated identity pass. If those checks
          pass, Veil returns a minimized result:{" "}
          <code>approved</code>, <code>scoreBand</code>, <code>maxLtvBps</code>, and{" "}
          <code>riskPremiumBps</code>.
        </p>
        <Callout variant="info" title="What to share with a verifier">
          Share your Veil DID (<code>did:veil:0x…</code>) or verification link with apps you
          want to use. The DID is safe to share publicly — it does not expose your score,
          private keys, or wallet addresses on other chains. Never share wallet seed phrases,
          private keys, or browser private-state exports.
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
