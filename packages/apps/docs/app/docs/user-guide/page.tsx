import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Dashboard Guide",
  description:
    "Step-by-step guide to using the Veil dashboard — from wallet connection to creating your Veil ID, minting your identity pass, and sharing your Veil DID.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "step-1-wallet", text: "Step 1: Install Midnight Wallet", depth: 2 },
  { id: "step-2-connect", text: "Step 2: Connect Wallet", depth: 2 },
  { id: "step-3-join", text: "Step 3: Create Veil ID", depth: 2 },
  { id: "step-4-veil-key", text: "Step 4: View Your Veil Key", depth: 2 },
  { id: "step-5-score", text: "Step 5: Create Credit Profile", depth: 2 },
  { id: "step-6-ckb", text: "Step 6: Connect CKB Wallet", depth: 2 },
  { id: "step-7-dob", text: "Step 7: Mint Identity Pass", depth: 2 },
  { id: "step-8-decision", text: "Step 8: Check Your Credit", depth: 2 },
  { id: "sharing-your-did", text: "Sharing Your Veil DID", depth: 2 },
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
          Midnight wallet to minting your identity pass and sharing your Veil DID with
          apps that support Veil credit checks.
        </p>

        <Callout variant="info" title="What You Will Need">
          A Chrome or Brave browser, a Midnight-compatible wallet (1AM is recommended; Lace is
          also supported), and a CKB-compatible wallet (JoyID, MetaMask with CKB support, or any
          CCC-supported wallet) for minting your identity pass. The identity pass requires a small
          amount of CKB to cover storage (typically 150–250 CKB on testnet).
        </Callout>

        <h2 id="overview">Overview</h2>
        <p>
          The Veil dashboard is the primary interface for end users. Through it, you will:
        </p>
        <ol>
          <li>Connect your Midnight wallet (1AM or Lace)</li>
          <li>Create your Veil ID — derives a private key used by the scoring system</li>
          <li>Create your credit profile — initializes your private score entry on Midnight</li>
          <li>Connect your CKB wallet and mint an identity pass on CKB</li>
          <li>Receive your <strong>Veil DID</strong> (<code>did:veil:0x…</code>) — a portable identity you share with apps</li>
          <li>Run a credit check to see your current score band</li>
        </ol>
        <p>
          Each step is a separate action on the dashboard with a visual progress tracker.
          You can complete them one at a time and return later. Your progress is
          persisted in your browser&apos;s local storage, linked to your Midnight wallet and the
          current Veil contract address.
        </p>

        <h2 id="step-1-wallet">Step 1: Install a Midnight Wallet</h2>
        <p>
          Veil supports two Midnight browser wallets. <strong>1AM</strong> is the preferred
          wallet; <strong>Lace</strong> is also fully supported. Both store your private key
          locally, sign Midnight transactions, and communicate with apps via the Midnight
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
            Ensure the wallet is connected to the correct Midnight network for the Veil deployment
            you are using (Preview for testnet, mainnet when live).
          </li>
        </ol>

        <Callout variant="warning" title="Save Your Seed Phrase">
          Your seed phrase is the only way to recover your Midnight wallet. Write it down and
          store it safely offline. Veil Protocol cannot recover lost wallets.
        </Callout>

        <h2 id="step-2-connect">Step 2: Connect Wallet to the Veil Dashboard</h2>
        <p>
          Open the Veil Protocol dashboard in your browser. You will see a wallet selection
          screen on the dashboard page.
        </p>
        <ol>
          <li>Click the wallet button for your Midnight wallet (1AM or Lace).</li>
          <li>
            A popup from your wallet extension will ask for permission to connect.
            Click <strong>Connect</strong>.
          </li>
          <li>
            The dashboard will load with your Midnight wallet address shown in the session bar
            at the top.
          </li>
        </ol>
        <p>
          If the connection popup does not appear, ensure your wallet extension is active
          (click the puzzle icon in your browser toolbar to find and pin it) and try again.
        </p>

        <h2 id="step-3-join">Step 3: Create Veil ID</h2>
        <p>
          This step derives a private key from your Midnight wallet that the scoring system uses
          to find and update your credit profile. It does not create an on-chain transaction —
          it only prepares local browser data.
        </p>
        <ol>
          <li>
            On the dashboard, locate the <strong>Create Veil ID</strong> section and click
            <strong> Create Veil ID</strong>.
          </li>
          <li>
            Wait while the dashboard sets up your private browser data. This typically takes
            a few seconds.
          </li>
          <li>
            When complete, the progress tracker advances and your Veil Key becomes visible in
            the panel.
          </li>
        </ol>

        <Callout variant="tip">
          Your private browser data stays entirely on your device. Veil never receives your
          wallet seed phrase, Midnight private key, or CKB private key during this step.
        </Callout>

        <h2 id="step-4-veil-key">Step 4: View Your Veil Key</h2>
        <p>
          After creating your Veil ID, the dashboard shows your <strong>Veil Key</strong> — a
          public key that the scoring system uses to locate your private credit profile. Think of
          it as your scoring system handle, separate from any wallet address you use on other chains.
        </p>
        <ul>
          <li>
            The Veil Key is also called <code>userPk</code> in the API. Protocols that submit
            behavioral data for you use this key to key those events to your profile.
          </li>
          <li>
            The Veil Key itself is not your Veil DID. Your DID (<code>did:veil:0x…</code>) is
            derived from a hash of this key and is created when you mint your identity pass.
          </li>
          <li>
            The Veil Key cannot be used to recover your Midnight private key, and it does not
            reveal your wallet addresses on Ethereum, Polygon, or any other chain.
          </li>
        </ul>

        <h2 id="step-5-score">Step 5: Create a Credit Profile</h2>
        <p>
          Creating a credit profile submits a transaction on Midnight that reserves a private
          score slot for your Veil Key. Until this step is done, apps cannot run a credit check
          for you, and behavioral events submitted by protocols cannot be applied to your score.
        </p>
        <ol>
          <li>
            Make sure your CKB wallet is connected first (see Step 6 below). The dashboard
            needs your CKB address to prepare the identity pass mint at the same time.
          </li>
          <li>
            Click <strong>Create Credit Profile</strong>.
          </li>
          <li>
            Wait for confirmation. The dashboard will show <strong>Confirmed</strong> next
            to Credit Profile when the Midnight transaction settles (this may take 30–90 seconds
            while the ZK proof is generated).
          </li>
        </ol>
        <p>
          At this point your score is unranked. As supported apps submit repayment and usage
          history for your Veil Key, your score improves over time.
        </p>

        <h2 id="step-6-ckb">Step 6: Connect Your CKB Wallet</h2>
        <p>
          A CKB wallet is required to mint your identity pass. The identity pass is a small record
          stored permanently on the CKB blockchain that proves your Veil DID belongs to your CKB
          wallet — without revealing your score or Midnight details.
        </p>
        <ol>
          <li>
            Click <strong>Connect CKB</strong> in the top bar or the CKB wallet button in the
            action panel.
          </li>
          <li>
            Select your CKB wallet from the list. Supported options include <strong>JoyID</strong>,
            <strong> MetaMask with CKB support</strong>, and other CCC-compatible wallets.
          </li>
          <li>
            Follow the connection flow for your wallet. For JoyID, scan the QR code with your
            phone. For MetaMask, install the CKB snap if prompted.
          </li>
          <li>
            Confirm that a CKB address appears in the session bar at the top of the dashboard.
          </li>
        </ol>

        <Callout variant="info">
          Your CKB wallet and your Midnight wallet are completely separate. The CKB wallet is
          used only to sign the identity pass mint transaction and authorize credit checks. It
          does not have access to your Midnight funds.
        </Callout>

        <h2 id="step-7-dob">Step 7: Mint Your Identity Pass</h2>
        <p>
          Your identity pass is a permanent, public record on the CKB blockchain that links your
          Veil DID to your CKB wallet. Minting it also registers your DID on the Midnight DID
          Registry, making it resolvable by any protocol that wants to run a credit check.
        </p>
        <ol>
          <li>
            Click <strong>Mint Identity Pass in CKB Wallet</strong>. The dashboard will prepare
            the CKB transaction with the identity data shown below.
          </li>
        </ol>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">json</span>
            <span className="code-block-filename">Identity pass content stored on CKB</span>
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
            Review the transaction in your CKB wallet. You pay a small amount of CKB to cover
            the cell storage cost (typically 150–250 CKB) plus a small miner fee.
          </li>
          <li>
            Confirm the transaction in your wallet. It usually confirms on CKB testnet within
            30–60 seconds.
          </li>
          <li>
            Once confirmed, the dashboard shows your minted identity pass card with:
            <ul>
              <li><strong>Your Veil ID</strong> — this is your <code>did:veil:0x…</code> identifier</li>
              <li><strong>Record ID</strong> — the CKB Spore object ID</li>
              <li><strong>ID Hash</strong> — the <code>veilIdHash</code> stored inside the pass</li>
              <li>A <strong>View Transaction</strong> link to the CKB explorer</li>
            </ul>
          </li>
        </ol>

        <Callout variant="tip" title="Make sure you have enough CKB">
          Before minting, confirm your CKB wallet has sufficient testnet CKBytes. On testnet
          you can claim free tokens from the Nervos faucet at{" "}
          <a href="https://faucet.nervos.org" target="_blank" rel="noopener noreferrer">faucet.nervos.org</a>.
        </Callout>

        <h2 id="step-8-decision">Step 8: Check Your Credit</h2>
        <p>
          Once your identity pass is minted, you can run a credit check. This uses your Veil DID
          to look up your private Midnight score and returns a result without ever revealing the
          raw score value.
        </p>
        <ol>
          <li>
            Click <strong>Check My Credit</strong> on the dashboard.
          </li>
          <li>
            Your CKB wallet signs a short authorization message. This proves you control the
            identity pass without sending any private keys to the backend.
          </li>
          <li>
            When complete, your current credit band is shown: Unranked, Bronze, Silver, Gold,
            or Platinum.
          </li>
        </ol>
        <p>
          The authorization message your CKB wallet signs:
        </p>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">text</span>
            <span className="code-block-filename">Credit check authorization message</span>
          </div>
          <pre className="code-block-pre">{`Veil credit decision authorization
did:<your-veil-did>
challenge:<challengeHex>
verificationMethod:<your-veil-did>#ckb-owner-1
registryVersion:1
purpose:credit-decision`}</pre>
        </div>
        <p>
          You can run a new check at any time to refresh your status with the latest activity
          submitted by partner protocols.
        </p>

        <h2 id="sharing-your-did">Sharing Your Veil DID</h2>
        <p>
          After minting your identity pass, the dashboard shows two convenient ways to share
          your Veil DID with apps:
        </p>
        <ul>
          <li>
            <strong>Copy ID</strong> — copies your full <code>did:veil:0x…</code> identifier to
            your clipboard. Paste this into any app that requests your Veil DID.
          </li>
          <li>
            <strong>QR code panel</strong> — on the left side of the dashboard, a QR code appears
            that encodes a verification URL. Apps can scan this QR to resolve your DID and request
            a credit decision without you typing anything.
          </li>
          <li>
            <strong>Copy Verify Link</strong> — copies the full DID resolution URL to your clipboard,
            which points to <code>GET /api/v1/dids/resolve?did=did:veil:0x…</code>. Send this
            link to an app or developer who wants to verify your identity programmatically.
          </li>
        </ul>

        <Callout variant="info" title="Your DID is safe to share">
          Your Veil DID reveals only that you have a Veil identity pass on CKB. It does not expose
          your raw credit score, your Midnight private key, your wallet addresses on other chains,
          or any personal information. Sharing it with an app only allows that app to request a
          credit check — which still requires your CKB wallet signature to complete.
        </Callout>

        <h2 id="faq">Frequently Asked Questions</h2>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Does Veil know my wallet address?
        </h3>
        <p>
          Veil&apos;s scoring system uses private identifiers — your Veil Key and Veil DID — that do
          not reveal your wallet addresses on Ethereum, Polygon, or any other chain. Your CKB
          wallet address is associated with your identity pass on the public CKB blockchain, but
          only in the context of Veil and only if you choose to connect that wallet.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          What is the difference between my Veil Key and my Veil DID?
        </h3>
        <p>
          Your <strong>Veil Key</strong> (<code>userPk</code>) is an internal scoring system
          identifier derived from your Midnight wallet. Protocols use it to submit behavioral
          events for your score. Your <strong>Veil DID</strong> (<code>did:veil:0x…</code>) is
          a public, portable identity identifier built from a hash of your Veil Key. The DID is
          what you share with apps to authorize credit checks — protocols only need the DID, not
          the raw Veil Key.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Can I lose my credit score?
        </h3>
        <p>
          Your score is stored in private state on Midnight, linked to your Veil Key. As long as
          you keep your Midnight wallet (or its seed phrase), your Veil Key stays the same and your
          score is intact. Your browser&apos;s local storage also caches your completed dashboard flow,
          so returning to the dashboard with the same wallet restores your identity pass view without
          reloading ZK assets.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          What happens if I lose my CKB wallet?
        </h3>
        <p>
          Your identity pass on CKB is permanent. If you lose your CKB wallet, you cannot sign
          new credit check requests for that pass. Your Midnight score still exists, but you would
          need to use a new CKB wallet and mint a fresh identity pass, which creates a new Veil DID.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Which DeFi protocols currently submit behavioral data to Veil?
        </h3>
        <p>
          Veil is currently in beta. Partner protocols can submit behavioral data through the API.
          Check the project GitHub or community channels for the current list of integrated partners.
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
