import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Dashboard Guide",
  description:
    "Step-by-step guide to using the Veil Protocol dashboard — from wallet connection to generating your credit score and authorizing risk decisions.",
};

const tocItems = [
  { id: "overview", text: "Overview", depth: 2 },
  { id: "step-1-wallet", text: "Step 1: Install Midnight Wallet", depth: 2 },
  { id: "step-2-connect", text: "Step 2: Connect Wallet", depth: 2 },
  { id: "step-3-join", text: "Step 3: Join the Protocol", depth: 2 },
  { id: "step-4-veil-id", text: "Step 4: Generate Your Veil ID", depth: 2 },
  { id: "step-5-score", text: "Step 5: Create Credit Score Entry", depth: 2 },
  { id: "step-6-ckb", text: "Step 6: Connect CKB Wallet", depth: 2 },
  { id: "step-7-dob", text: "Step 7: Mint Your Veil DOB", depth: 2 },
  { id: "step-8-decision", text: "Step 8: Authorize Risk Decision", depth: 2 },
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
          This guide walks you through the complete Veil Protocol user flow — from installing
          a Midnight wallet to authorizing your first credit decision on the dashboard.
        </p>

        <Callout variant="info" title="What You Will Need">
          A Chrome or Brave browser, a Midnight-compatible wallet (1AM is recommended; Lace is
          also supported), and optionally a CKB-compatible wallet (JoyID, MetaMask with CKB
          support) for minting your identity DOB.
        </Callout>

        <h2 id="overview">Overview</h2>
        <p>
          The Veil dashboard is the primary interface for end users. Through it, you will:
        </p>
        <ol>
          <li>Connect your Midnight wallet (1AM or Lace)</li>
          <li>Join the Veil smart contract on Midnight</li>
          <li>Receive a unique <code>veilIdHash</code> that identifies you across chains</li>
          <li>Create an on-chain credit score entry</li>
          <li>Connect your CKB wallet and mint a Spore DOB as your identity anchor</li>
          <li>Authorize risk decisions that lending protocols can query</li>
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

        <h2 id="step-3-join">Step 3: Join the Protocol Contract</h2>
        <p>
          Before you can receive a Veil ID, you must join the Veil smart contract on
          Midnight. This registers your wallet as a participant and initializes your private
          state in the contract.
        </p>
        <ol>
          <li>
            On the dashboard, locate the <strong>Join Protocol</strong> card and click the
            &quot;Join Protocol&quot; button.
          </li>
          <li>
            Your Midnight wallet will prompt you to sign a transaction. Review the details and
            click <strong>Sign</strong>.
          </li>
          <li>
            Wait for the transaction to be included in a Midnight block. This typically
            takes 10–30 seconds on preprod. A green checkmark will appear when complete.
          </li>
        </ol>

        <Callout variant="tip">
          You only need to join the protocol once. Rejoining after the first transaction
          will be a no-op — the contract recognizes your wallet and returns your existing state.
        </Callout>

        <h2 id="step-4-veil-id">Step 4: Generate Your Veil ID</h2>
        <p>
          Your Veil ID is a deterministic hash of your Midnight public key. It is the
          pseudonymous identifier used across all protocol interactions — behavioral data
          submitted by DeFi protocols is keyed to this hash.
        </p>
        <ol>
          <li>
            Click <strong>Generate Veil ID</strong> on the dashboard. This is a pure
            client-side operation — no transaction is sent.
          </li>
          <li>
            Your <code>veilIdHash</code> will be displayed: a 0x-prefixed 32-byte hex
            string. Copy and save this value.
          </li>
          <li>
            Share this hash with any DeFi protocols you want to include in your credit
            history so they can submit behavioral events against your ID.
          </li>
        </ol>
        <p>
          The Veil ID is derived in your browser using your wallet&apos;s public key. It cannot
          be used to recover your private key, and it reveals nothing about your wallet
          address on any other chain.
        </p>

        <h2 id="step-5-score">Step 5: Create a Credit Score Entry</h2>
        <p>
          Creating a credit score entry initializes your private score record on the
          Midnight contract. Until this step is complete, no credit decision can be
          issued for your Veil ID.
        </p>
        <ol>
          <li>
            Click <strong>Create Credit Score</strong>. This sends a transaction to the
            Midnight contract that initializes an empty score entry for your Veil ID.
          </li>
          <li>
            Sign the transaction in your Midnight wallet when prompted.
          </li>
          <li>
            Wait for confirmation. The dashboard will show &quot;Score initialized&quot; when done.
          </li>
        </ol>
        <p>
          At this point your score is 0 (Unranked). As DeFi protocols submit behavioral
          data for your <code>veilIdHash</code>, your score will increase over time. You
          can request a credit decision at any time, though the decision will show
          &quot;no score yet&quot; until sufficient behavioral data has been submitted.
        </p>

        <h2 id="step-6-ckb">Step 6: Connect Your CKB Wallet</h2>
        <p>
          The CKB wallet connection enables you to mint your Veil Identity DOB —
          an immutable on-chain identity object on the Nervos CKB blockchain.
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
          CKB wallet is only used to pay for the DOB mint transaction on the CKB blockchain.
          It does not have access to your Midnight funds.
        </Callout>

        <h2 id="step-7-dob">Step 7: Mint Your Veil Identity DOB</h2>
        <p>
          The Digital Object (DOB) is your permanent on-chain identity record on CKB.
          It contains your <code>veilIdHash</code>, your CKB lock hash, and the Midnight
          contract address — binding your Midnight credit score to your CKB identity.
        </p>
        <ol>
          <li>
            Click <strong>Mint Identity DOB</strong>. The dashboard will prepare the Spore
            protocol transaction with the following data embedded in the DOB content:
          </li>
        </ol>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">json</span>
            <span className="code-block-filename">DOB content</span>
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
            The dashboard will display your DOB transaction hash and a link to the CKB
            Explorer where you can view your minted identity object.
          </li>
        </ol>

        <Callout variant="tip" title="CKB for the mint">
          The DOB mint requires a small amount of CKB for cell capacity (typically 150–250 CKB).
          Ensure your CKB wallet has sufficient balance on the active Veil CKB network before proceeding.
        </Callout>

        <h2 id="step-8-decision">Step 8: Authorize a Risk Decision</h2>
        <p>
          Once your DOB is minted and behavioral data has been submitted by DeFi protocols,
          you can authorize a credit risk decision. This verifies your DOB, consumes a fresh
          backend challenge, and returns a policy decision without exposing your raw score.
        </p>
        <ol>
          <li>
            Click <strong>Authorize Risk Decision</strong> on the dashboard.
          </li>
          <li>
            Your CKB wallet signs the canonical credit decision message. Your Midnight secret
            key is never sent to the backend.
          </li>
          <li>
            When complete, your current credit band and lending policy outputs will be displayed:
            Unranked, Bronze, Silver, Gold, or Platinum.
          </li>
          <li>
            Any DeFi protocol integrated with Veil can request a fresh decision using your{" "}
            <code>veilIdHash</code>, DOB Spore ID, and your CKB wallet authorization.
          </li>
        </ol>
        <p>
          You can re-authorize at any time to refresh your decision with the latest
          behavioral data. This is recommended before any significant loan application.
        </p>

        <h2 id="faq">Frequently Asked Questions</h2>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Does Veil know my wallet address?
        </h3>
        <p>
          No. The Veil backend and contract interact only with your <code>veilIdHash</code>,
          which is a one-way hash of your Midnight public key. The system never learns your
          wallet address on Ethereum, Polygon, or any other chain.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Can I lose my credit score?
        </h3>
        <p>
          Your score is persistent on Midnight&apos;s private ledger. As long as you retain your
          Midnight wallet seed phrase, your score remains accessible through the same Veil ID.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          What happens if I lose access to my CKB wallet?
        </h3>
        <p>
          The DOB on CKB is permanent and immutable. If you lose your CKB wallet, you
          cannot update or authorize decisions for that DOB owner lock. Your Midnight score
          entry still exists, but credit decisions that require that DOB will fail until a new
          identity-anchor or recovery flow is supported.
        </p>

        <h3 style={{ textTransform: "none", letterSpacing: "0.02em", fontSize: "14px", fontWeight: 600, color: "var(--fg)", marginTop: "24px", marginBottom: "8px" }}>
          Which DeFi protocols currently submit behavioral data to Veil?
        </h3>
        <p>
          Veil is currently in beta. Integration partners can submit behavioral data via
          the API. The ecosystem of data-submitting protocols is growing — check the
          protocol&apos;s GitHub or community channels for the current list.
        </p>

        <PrevNext
          prev={{ title: "API Reference", href: "/docs/integration/api-reference", description: "All endpoints documented" }}
          next={{ title: "CKB Wallet Setup", href: "/docs/user-guide/ckb-wallet", description: "Set up CKB & mint your DOB" }}
        />
      </article>

      <aside className="docs-toc-col" style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}>
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
