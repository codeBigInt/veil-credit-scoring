import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "CKB Wallet Setup",
  description:
    "How to connect a CKB wallet and mint your Veil identity pass on the Nervos CKB blockchain.",
};

const tocItems = [
  { id: "what-is-ckb", text: "What Is CKB?", depth: 2 },
  { id: "what-is-a-dob", text: "What Is an Identity Pass?", depth: 2 },
  { id: "why-veil-uses-ckb", text: "Why Veil Uses CKB", depth: 2 },
  { id: "supported-wallets", text: "Supported Wallets", depth: 2 },
  { id: "connect-ckb", text: "Connect Your CKB Wallet", depth: 2 },
  { id: "dob-content", text: "What Goes Into Your Pass", depth: 2 },
  { id: "mint-process", text: "The Mint Process", depth: 2 },
  { id: "gas-fees", text: "Gas & Fees", depth: 2 },
  { id: "view-dob", text: "View Your Pass", depth: 2 },
];

export default function CkbWalletPage() {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      <article className="prose" style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: "User Guide", href: "/docs/user-guide" },
            { label: "CKB Wallet Setup" },
          ]}
        />

        <h1>CKB Wallet Setup</h1>
        <p className="prose-lead">
          Nervos CKB is where Veil stores your public identity pass. The pass proves that a
          Veil ID belongs to your CKB wallet, while your raw score stays private on Midnight.
        </p>

        <h2 id="what-is-ckb">What Is CKB?</h2>
        <p>
          CKB (Common Knowledge Base) is the Layer 1 blockchain of the Nervos Network.
          Unlike most smart contract chains that prioritize computation, CKB is designed
          around a storage-first model: the fundamental resource on CKB is cell capacity
          (measured in CKBytes), not computation gas. This makes CKB uniquely suited for
          long-lived, immutable on-chain objects.
        </p>
        <p>
          CKB uses a UTXO-like model called the Cell Model, where each &quot;cell&quot; holds
          arbitrary data and is locked by a script (similar to a smart contract). Cells can
          only be consumed by the owner of the lock key, making CKB data both persistent
          and tamper-resistant.
        </p>
        <p>
          Key properties that make CKB useful for Veil:
        </p>
        <ul>
          <li><strong>Permanent records:</strong> Once a cell is created, its data cannot be changed without destroying it. Your identity pass is designed to be long-lived.</li>
          <li><strong>Low ongoing cost:</strong> You pay once to create the cell (capacity deposit), not recurring fees to keep it alive.</li>
          <li><strong>Decentralization:</strong> CKB is a public PoW blockchain with global node distribution — no single party controls the data.</li>
          <li><strong>Wallet-friendly:</strong> CKB can work with keys from many wallet types, including EVM wallets.</li>
        </ul>

        <h2 id="what-is-a-dob">What Is an Identity Pass?</h2>
        <p>
          A Veil identity pass is a public CKB record created through Spore. It is similar
          to an NFT, but its important data is stored directly on CKB instead of pointing to
          a separate server.
        </p>
        <p>
          The pass contains:
        </p>
        <ul>
          <li><strong>Content type:</strong> A MIME type or custom type string describing the data format (Veil uses <code>application/json</code>).</li>
          <li><strong>Content:</strong> The JSON data that links your Veil ID to your CKB wallet.</li>
          <li><strong>Lock:</strong> The CKB rule that makes the pass belong to your wallet.</li>
          <li><strong>Record ID:</strong> The CKB identifier used to find the pass later.</li>
        </ul>
        <p>
          Once minted, the pass content cannot be modified. In normal use, it is intended to
          stay with the wallet that minted it.
        </p>

        <Callout variant="info">
          Your identity pass is stored on CKB. It will persist as long as CKB itself does.
        </Callout>

        <h2 id="why-veil-uses-ckb">Why Veil Uses CKB</h2>
        <p>
          Veil uses CKB because users can own a public proof without giving up score privacy:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            {
              label: "User-Owned Pass",
              desc: "A CKB identity pass cannot be changed by Veil or a third party. The user owns it.",
            },
            {
              label: "Works Across Wallets",
              desc: "CKB can support keys from many wallet types, including EVM wallets.",
            },
            {
              label: "Easy to Check",
              desc: "Apps can check the pass through CKB without needing special infrastructure.",
            },
            {
              label: "Low Cost",
              desc: "The one-time mint costs CKB for storage. There are no ongoing fees to maintain the pass.",
            },
          ].map((b) => (
            <div
              key={b.label}
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
                }}
              >
                {b.label}
              </div>
              <div style={{ fontSize: "13px", color: "oklch(0.75 0 0)", lineHeight: 1.55 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>

        <h2 id="supported-wallets">Supported Wallets</h2>
        <p>
          Veil uses the CCC (CKB Connect Connector) library to support multiple CKB wallets.
          The following wallets are currently supported:
        </p>
        <table>
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Type</th>
              <th>Networks</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>JoyID</strong></td>
              <td>Mobile (Passkey)</td>
              <td>Mainnet, Testnet</td>
              <td>Recommended; uses WebAuthn, no seed phrase</td>
            </tr>
            <tr>
              <td><strong>MetaMask (EVM)</strong></td>
              <td>Browser extension</td>
              <td>Mainnet, Testnet</td>
              <td>Uses EVM key, requires CCC adapter</td>
            </tr>
            <tr>
              <td><strong>OKX Wallet</strong></td>
              <td>Browser extension</td>
              <td>Mainnet, Testnet</td>
              <td>Native CKB support</td>
            </tr>
            <tr>
              <td><strong>UTXO Global</strong></td>
              <td>Browser extension</td>
              <td>Mainnet, Testnet</td>
              <td>CKB-specific wallet</td>
            </tr>
          </tbody>
        </table>

        <Callout variant="tip">
          JoyID is the easiest wallet for new users. It uses your phone&apos;s biometrics (Face ID
          or fingerprint) as the key — no seed phrase required. Visit{" "}
          <a href="https://joy.id" target="_blank" rel="noopener noreferrer">joy.id</a>{" "}
          to get started.
        </Callout>

        <h2 id="connect-ckb">Connect Your CKB Wallet</h2>
        <p>
          From the Veil dashboard, after completing the Midnight wallet steps:
        </p>
        <ol>
          <li>
            Scroll to the <strong>CKB Identity</strong> section and click{" "}
            <strong>Connect CKB Wallet</strong>.
          </li>
          <li>
            A wallet picker modal will appear. Select your preferred wallet.
          </li>
          <li>
            <strong>For JoyID:</strong> A QR code will appear. Scan it with your phone&apos;s
            camera app. Authenticate with your biometric (Face ID / fingerprint). The
            connection completes automatically.
          </li>
          <li>
            <strong>For MetaMask:</strong> Click through the MetaMask popup. The CCC
            adapter will derive a CKB key from your Ethereum key using BIP44 derivation.
          </li>
          <li>
            Your CKB address will appear in the dashboard once connected.
          </li>
        </ol>
        <p>
          The dashboard reads the public CKB wallet data needed for your identity pass
          automatically.
        </p>

        <h2 id="dob-content">What Goes Into Your Pass</h2>
        <p>
          When you mint a Veil identity pass, the following JSON is stored on CKB:
        </p>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">json</span>
            <span className="code-block-filename">Identity pass content (stored on-chain)</span>
          </div>
          <pre className="code-block-pre">{`{
  "protocol": "Veil",
  "objectType": "VeilIdentity",
  "veilIdHash": "0x7f3a91b2c4d5e6f700112233445566778899aabbccddeeff0011223344556677",
  "ownerCkbLockHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "midnightNetwork": "preprod",
  "midnightContract": "0xcontract_address_here",
  "version": "1"
}`}</pre>
        </div>
        <p>Field descriptions:</p>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>protocol</code></td>
              <td>Always &quot;Veil&quot;; used to identify Veil records</td>
            </tr>
            <tr>
              <td><code>objectType</code></td>
              <td>Always &quot;VeilIdentity&quot;; identifies this as a Veil identity pass</td>
            </tr>
            <tr>
              <td><code>veilIdHash</code></td>
              <td>Your Veil ID hash; links the pass to your private credit profile</td>
            </tr>
            <tr>
              <td><code>ownerCkbLockHash</code></td>
              <td>The public wallet hash of the CKB wallet that owns this pass</td>
            </tr>
            <tr>
              <td><code>midnightNetwork</code></td>
              <td>Shows which Midnight network stores the score</td>
            </tr>
            <tr>
              <td><code>midnightContract</code></td>
              <td>The Veil network address on Midnight</td>
            </tr>
            <tr>
              <td><code>version</code></td>
              <td>Pass format version; currently &quot;1&quot;</td>
            </tr>
          </tbody>
        </table>

        <Callout variant="info">
          The pass content is permanently public on CKB. Do not embed personal data. The
          <code>veilIdHash</code> is a one-way hash — it cannot be used to recover your real
          identity or Midnight private key.
        </Callout>

        <h2 id="mint-process">The Mint Process</h2>
        <p>
          Minting an identity pass creates a new CKB record. Here is what happens:
        </p>
        <ol>
          <li>
            The dashboard prepares the identity JSON.
          </li>
          <li>
            A CKB transaction is prepared with one new identity pass record.
          </li>
          <li>
            The transaction is signed by your CKB wallet using the lock script corresponding
            to your wallet&apos;s public key.
          </li>
          <li>
            The signed transaction is broadcast to the CKB network. Miners include it in the
            next block (usually within 30–60 seconds on testnet).
          </li>
          <li>
            Once confirmed, the transaction hash and output index identify your pass.
          </li>
        </ol>

        <h2 id="gas-fees">Gas &amp; Fees</h2>
        <p>
          CKB uses a different fee model than Ethereum. Instead of paying gas for computation,
          you lock some CKB to pay for the storage used by your identity pass.
        </p>
        <ul>
          <li>
            <strong>Minimum capacity:</strong> Each CKB cell requires at least 61 CKBytes of
            base capacity. The Veil pass content adds approximately 300–400 bytes, bringing
            the total capacity to around 65–70 CKBytes minimum (but the dashboard uses a
            comfortable 200 CKB to ensure success).
          </li>
          <li>
            <strong>Transaction fee:</strong> A small miner fee of approximately 0.001 CKB
            is added to the transaction to incentivize miners.
          </li>
          <li>
            <strong>Total cost:</strong> Approximately 200–250 CKB to mint. This CKB is
            locked in the record. Treat this capacity as committed to a long-lived public identity.
          </li>
        </ul>
        <p>
          On testnet, use the Nervos faucet to get free test CKB. On mainnet, at current
          CKB market prices, the mint cost is typically under $5 USD.
        </p>

        <h2 id="view-dob">View Your Pass</h2>
        <p>
          After minting, you can view your identity pass on the CKB Explorer:
        </p>
        <ul>
          <li>
            <strong>Testnet (Pudge):</strong>{" "}
            <a href="https://pudge.explorer.nervos.org" target="_blank" rel="noopener noreferrer">
              pudge.explorer.nervos.org
            </a>
          </li>
          <li>
            <strong>Mainnet:</strong>{" "}
            <a href="https://explorer.nervos.org" target="_blank" rel="noopener noreferrer">
              explorer.nervos.org
            </a>
          </li>
        </ul>
        <p>
          Search for your CKB wallet address to find your pass. Click on the transaction hash
          to see the record data. You can verify that the <code>veilIdHash</code> in the pass
          content matches the one shown on your Veil
          dashboard.
        </p>
        <p>
          The Spore explorer at{" "}
          <a href="https://spore.pro" target="_blank" rel="noopener noreferrer">
            spore.pro
          </a>{" "}
          may show your Veil identity pass in a more readable format once it processes the new record.
        </p>

        <PrevNext
          prev={{ title: "Testnet Testing Guide", href: "/docs/user-guide/testnet", description: "Shareable app testing instructions" }}
          next={{ title: "Architecture", href: "/docs/concepts", description: "How everything fits together" }}
        />
      </article>

      <aside className="docs-toc-col" style={{ position: "sticky", top: "var(--header-h)", height: "calc(100vh - var(--header-h))", overflowY: "auto", padding: "32px 0 40px", flexShrink: 0 }}>
        <Toc items={tocItems} />
      </aside>
    </div>
  );
}
