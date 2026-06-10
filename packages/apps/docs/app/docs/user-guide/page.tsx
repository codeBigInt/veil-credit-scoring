import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Dashboard Guide",
  description:
    "Step-by-step guide to using the Veil dashboard — from wallet connection to creating your Veil ID and checking your credit status.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "step-1-wallet", text: "Step 1: Install Midnight Wallet", depth: 2 },
  { id: "step-2-connect", text: "Step 2: Connect Wallet", depth: 2 },
  { id: "step-3-join", text: "Step 3: Create Veil ID", depth: 2 },
  { id: "step-4-veil-id", text: "Step 4: View Your Veil Key", depth: 2 },
  { id: "step-5-score", text: "Step 5: Create Credit Profile", depth: 2 },
  { id: "step-6-ckb", text: "Step 6: Connect CKB Wallet", depth: 2 },
  { id: "step-7-dob", text: "Step 7: Mint Identity Pass", depth: 2 },
  { id: "step-8-decision", text: "Step 8: Check Your Credit", depth: 2 },
  { id: "faq", text: "FAQ", depth: 2 },
];

export default function UserGuidePage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "User Guide" },
            { label: "Dashboard Guide" },
          ]}
        />

        <h1>Dashboard Guide</h1>
        <p className="prose-lead">
          This guide walks you through the complete Veil user flow — from installing a
          Midnight wallet to checking your credit status on the dashboard.
        </p>

        <Callout variant="info" title="What You Will Need">
          A Chrome or Brave browser, a Midnight-compatible wallet (1AM is recommended; Lace is
          also supported), and optionally a CKB-compatible wallet (JoyID, MetaMask with CKB
          support) for minting your identity pass.
        </Callout>

        <h2 id="overview">Overview</h2>
        <p>
          The Veil dashboard is the primary interface for end users. Through it, you will:
        </p>
        <ol>
          <li>Connect your Midnight wallet (1AM or Lace)</li>
          <li>Create your Veil ID</li>
          <li>View the private Veil key used for scoring</li>
          <li>Create your credit profile</li>
          <li>Connect your CKB wallet and mint an identity pass</li>
          <li>Check your credit status for supported apps</li>
        </ol>
        <p>
          Each step is a separate action on the dashboard with a visual status indicator.
          You can complete them one at a time and return later to finish. Your progress is
          persisted in your Midnight wallet&apos;s local state.
        </p>

        <h2 id="step-1-wallet">Step 1: Install a Midnight Wallet</h2>
        <p>
          Veil supports two Midnight browser wallets. <strong>1AM</strong> is the preferred
          wallet; <strong>Lace</strong> is also fully supported. Both store your private key
          locally, sign Midnight transactions, and communicate with dApps via the Midnight
          DApp Connector API.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ padding: "14px", background: "oklch(0.10 0.04 295)", border: "2px solid var(--primary)", borderRadius: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "6px" }}>
              1AM — Recommended
            </div>
            <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
              The primary Midnight wallet for Veil. Available as a Chrome extension from{" "}
              <a href="https://midnight.network" target="_blank" rel="noopener noreferrer">midnight.network</a>.
            </div>
          </div>
          <div style={{ padding: "14px", background: "oklch(0.14 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "oklch(0.6 0 0)", marginBottom: "6px" }}>
              Lace — Also Supported
            </div>
            <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
              The Midnight Lace browser extension. Works with the Veil dashboard via the
              same DApp Connector API.
            </div>
          </div>
        </div>

        <ol>
          <li>
            Install your chosen wallet extension from{" "}
            <a href="https://midnight.network" target="_blank" rel="noopener noreferrer">
              midnight.network
            </a>.
          </li>
          <li>
            Open the extension, choose &quot;Create a new wallet&quot; or &quot;Import existing,&quot;
            and follow the seed phrase setup flow.
          </li>
          <li>
            Ensure the wallet is connected to the <strong>Midnight mainnet</strong>.
          </li>
        </ol>

        <Callout variant="warning" title="Save Your Seed Phrase">
          Your seed phrase is the only way to recover your Midnight wallet. Write it down
          and store it somewhere safe offline. Veil Protocol cannot recover lost wallets.
        </Callout>

        <h2 id="step-2-connect">Step 2: Connect Wallet to the Veil Dashboard</h2>
        <p>
          Open the Veil Protocol dashboard in your browser. You will see a{" "}
          <strong>Connect Wallet</strong> button in the top-right corner.
        </p>
        <ol>
          <li>Click <strong>Connect Wallet</strong>.</li>
          <li>
            A popup from your Midnight wallet extension (1AM or Lace) will appear asking for
            permission to connect. Click <strong>Connect</strong>.
          </li>
          <li>
            The dashboard will display your Midnight wallet address in abbreviated form.
            You are now connected.
          </li>
        </ol>
        <p>
          If the connection popup does not appear, ensure your wallet extension is active
          (click the puzzle icon in your browser toolbar and pin it) and try again.
        </p>

        <h2 id="step-3-join">Step 3: Create Veil ID</h2>
        <p>
          Before you can create a credit profile, create your Veil ID in the dashboard. This
          sets up the private browser data Veil uses for your account.
        </p>
        <ol>
          <li>
            On the dashboard, locate the <strong>Create Veil ID</strong> card and click
            <strong>Create Veil ID</strong>.
          </li>
          <li>
            Wait while the dashboard sets up your private browser data.
          </li>
          <li>
            When complete, the progress tracker moves to your Veil key.
          </li>
        </ol>

        <Callout variant="tip">
          Your private browser data stays on your device. Veil does not ask you to share wallet
          seed phrases or private keys.
        </Callout>

        <h2 id="step-4-veil-id">Step 4: View Your Veil Key</h2>
        <p>
          The dashboard creates a Veil key that the scoring system uses to find your credit
          profile. It is shown in shortened form unless you copy it.
        </p>
        <ol>
          <li>
            Click <strong>Create Veil ID</strong> if the dashboard has not already created it.
          </li>
          <li>
            Your Veil key, also called <code>userPk</code> in the API, will be displayed.
          </li>
          <li>
            After your identity pass is minted, share the Veil ID or verify link with apps
            that need to check your credit status.
          </li>
        </ol>
        <p>
          This key cannot be used to recover your wallet private key, and it does not reveal
          your wallet address on other chains.
        </p>

        <h2 id="step-5-score">Step 5: Create a Credit Profile</h2>
        <p>
          Creating a credit profile lets Veil start tracking your private score. Until this
          step is complete, apps cannot check your credit status.
        </p>
        <ol>
          <li>
            Click <strong>Create Credit Profile</strong>.
          </li>
          <li>
            Sign the transaction in your Midnight wallet when prompted.
          </li>
          <li>
            Wait for confirmation. The dashboard will show &quot;Score initialized&quot; when done.
          </li>
        </ol>
        <p>
          At this point your score may be unranked. As supported apps submit repayment and
          usage history, your score can improve over time.
        </p>

        <h2 id="step-6-ckb">Step 6: Connect Your CKB Wallet</h2>
        <p>
          The CKB wallet connection lets you mint your identity pass on Nervos CKB.
        </p>
        <ol>
          <li>
            Click <strong>Connect CKB Wallet</strong> on the dashboard.
          </li>
          <li>
            You will see a list of supported CKB wallets: <strong>JoyID</strong>,{" "}
            <strong>MetaMask (with CKB plugin)</strong>, and others supported by the
            CCC connector library.
          </li>
          <li>
            Select your wallet and follow the connection prompts. For JoyID, you will
            scan a QR code with your phone. For MetaMask, install the CKB extension
            if prompted.
          </li>
          <li>
            Ensure you are connected to the CKB network used by the current Veil deployment
            (testnet during beta, mainnet after production launch).
          </li>
        </ol>

        <Callout variant="info">
          Your CKB wallet address and your Midnight wallet are completely separate. The
          CKB wallet is only used to pay for the identity pass mint on the CKB blockchain.
          It does not have access to your Midnight funds.
        </Callout>

        <h2 id="step-7-dob">Step 7: Mint Your Identity Pass</h2>
        <p>
          Your identity pass is a public CKB record that proves this Veil ID belongs to
          your CKB wallet. It does not reveal your raw score.
        </p>
        <ol>
          <li>
            Click <strong>Mint Identity Pass</strong>. The dashboard will prepare the CKB
            transaction with the identity data shown below.
          </li>
        </ol>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">json</span>
            <span className="code-block-filename">Identity pass content</span>
          </div>
          <pre className="code-block-pre">{`{
  "protocol": "Veil",
  "objectType": "VeilIdentity",
  "veilIdHash": "0x...",
  "ownerCkbLockHash": "0x...",
  "midnightNetwork": "preprod",
  "midnightContract": "7c7d7b78ebcf6a67862fde64d5717f08109cadf0666b90b3b8179aef15ec1b9e",
  "version": "1"
}`}</pre>
        </div>
        <ol start={2}>
          <li>
            Review the transaction details in your CKB wallet. The mint requires a small
            amount of CKB to cover the cell capacity (typically 150–250 CKB). You pay
            the CKB capacity and miner fee for this transaction.
          </li>
          <li>
            Confirm the transaction in your wallet. Wait for it to be confirmed on CKB
            (usually 30–60 seconds on testnet, 10–20 seconds on mainnet).
          </li>
          <li>
            The dashboard will display your transaction hash and a link to the CKB Explorer.
          </li>
        </ol>

        <Callout variant="tip" title="CKB for the mint">
          The identity pass mint requires a small amount of CKB for storage and fees.
          Ensure your CKB wallet has sufficient balance on the active Veil CKB network before proceeding.
        </Callout>

        <h2 id="step-8-decision">Step 8: Check Your Credit</h2>
        <p>
          Once your identity pass is minted, you can ask Veil for a credit check. Your wallet
          signs a message, and Veil returns a simple result without exposing your raw score.
        </p>
        <ol>
          <li>
            Click <strong>Check My Credit</strong> on the dashboard.
          </li>
          <li>
            Your CKB wallet signs a short approval message. Your Midnight secret key is never
            sent to the backend.
          </li>
          <li>
            When complete, your current credit band and app limits will be displayed:
            Unranked, Bronze, Silver, Gold, or Platinum.
          </li>
          <li>
            Any supported DeFi app can request a fresh check using your Veil ID and CKB wallet approval.
          </li>
        </ol>
        <p>
          You can run a new check at any time to refresh your status with the latest activity.
        </p>

        <h2 id="faq">Frequently Asked Questions</h2>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Does Veil know my wallet address?
        </h3>
        <p>
          No. Veil uses private identifiers such as your Veil key and ID hash. These values do
          not reveal your wallet address on Ethereum, Polygon, or any other chain.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Can I lose my credit score?
        </h3>
        <p>
          Your score is stored on Midnight. As long as you keep your Midnight wallet and local
          browser data, your score remains tied to the same Veil ID.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          What happens if I lose access to my CKB wallet?
        </h3>
        <p>
          The identity pass on CKB is permanent. If you lose your CKB wallet, you cannot sign
          new checks for that pass. Your Midnight score still exists, but you may need a new
          identity pass or recovery flow.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Which DeFi protocols currently submit behavioral data to Veil?
        </h3>
        <p>
          Veil is currently in beta. Partner apps can submit activity data through the API.
          Check the project GitHub or community channels for the current list.
        </p>

        <PrevNext
          prev={{ title: "API Reference", href: "/docs/integration/api-reference", description: "All endpoints documented" }}
          next={{ title: "Testnet Testing Guide", href: "/docs/user-guide/testnet", description: "Shareable app testing instructions" }}
        />
      </article>

      <aside className="docs-toc-col" style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}>
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
