import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "CKB Wallet Setup",
  description:
    "How to connect a CKB wallet, understand Spore Digital Objects, and mint your Veil Identity DOB on the Nervos CKB blockchain.",
};

const tocItems = [
  { id: "what-is-ckb", text: "What Is CKB?", depth: 2 },
  { id: "what-is-a-dob", text: "What Is a Spore DOB?", depth: 2 },
  { id: "why-veil-uses-ckb", text: "Why Veil Uses CKB DOBs", depth: 2 },
  { id: "supported-wallets", text: "Supported Wallets", depth: 2 },
  { id: "connect-ckb", text: "Connect Your CKB Wallet", depth: 2 },
  { id: "dob-content", text: "What Goes Into Your DOB", depth: 2 },
  { id: "mint-process", text: "The Mint Process", depth: 2 },
  { id: "gas-fees", text: "Gas & Fees", depth: 2 },
  { id: "view-dob", text: "View Your DOB", depth: 2 },
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
          The Nervos CKB blockchain serves as Veil&apos;s immutable identity layer. Your
          Veil Identity DOB — a Spore Digital Object on CKB — permanently anchors your
          Midnight credit score to a chain-agnostic public identity.
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
          Key properties that make CKB suitable for Veil:
        </p>
        <ul>
          <li><strong>Immutability:</strong> Once a cell is created, its data cannot be changed without destroying it. A DOB cell is designed to be permanent.</li>
          <li><strong>Low ongoing cost:</strong> You pay once to create the cell (capacity deposit), not recurring fees to keep it alive.</li>
          <li><strong>Decentralization:</strong> CKB is a public PoW blockchain with global node distribution — no single party controls the data.</li>
          <li><strong>Interoperability:</strong> CKB&apos;s cell model supports ECDSA and Schnorr signatures, making it compatible with EVM-derived key material.</li>
        </ul>

        <h2 id="what-is-a-dob">What Is a Spore DOB?</h2>
        <p>
          Spore is a protocol built on CKB that defines a standard for creating Digital
          Objects — on-chain entities with structured content, an owner, and a creation
          provenance. Spore DOBs are the CKB equivalent of NFTs, but with a stronger
          emphasis on on-chain data availability: the content is stored directly in the
          cell, not in off-chain IPFS or centralized storage.
        </p>
        <p>
          A Spore DOB consists of:
        </p>
        <ul>
          <li><strong>Content type:</strong> A MIME type or custom type string describing the data format (Veil uses <code>application/json</code>).</li>
          <li><strong>Content:</strong> The raw bytes of the object&apos;s content. For Veil, this is a JSON object containing stable identity-anchor metadata.</li>
          <li><strong>Lock:</strong> Veil uses the deployed <code>veil_sbt_lock</code>, with args derived from the owner CKB lock hash and <code>veilIdHash</code>. This is designed to preserve the same lock across spends and prevent ordinary transferability.</li>
          <li><strong>Cluster ID (optional):</strong> A grouping mechanism. Veil DOBs may optionally belong to a Veil cluster.</li>
        </ul>
        <p>
          DOBs are non-fungible and immutable. Once minted, the content cannot be modified.
          Veil&apos;s identity DOB is also intentionally non-transferable in normal use because
          the deployed lock script requires the same identity lock to remain present.
        </p>

        <Callout variant="info">
          Spore DOBs are genuinely on-chain. Unlike many NFT projects where token metadata
          points to an off-chain IPFS URL, Spore content is embedded directly in the CKB
          cell data. It will persist as long as CKB itself does.
        </Callout>

        <h2 id="why-veil-uses-ckb">Why Veil Uses CKB DOBs</h2>
        <p>
          The choice of CKB for Veil&apos;s identity layer is deliberate:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            {
              label: "Stable Identity Anchor",
              desc: "A DOB on CKB cannot be altered or revoked by Veil Protocol or any third party. The user owns it unconditionally.",
            },
            {
              label: "Chain-Agnostic",
              desc: "CKB lock hashes are derived from public keys that can be generated from any wallet — including EVM wallets — making it accessible to all DeFi users.",
            },
            {
              label: "Verifiable Off-Chain",
              desc: "Any application can verify DOB existence by querying the CKB full node or indexer — no special infrastructure required.",
            },
            {
              label: "Low Cost",
              desc: "The one-time mint costs 150–300 CKB (≈ a few dollars). There are no ongoing fees to maintain the DOB.",
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
          Your <code>ownerCkbLockHash</code> — the hash of your CKB wallet&apos;s lock script —
          will be extracted automatically by the dashboard and embedded in your DOB.
        </p>

        <h2 id="dob-content">What Goes Into Your DOB</h2>
        <p>
          When you mint a Veil Identity DOB, the following JSON is embedded directly into
          the Spore cell&apos;s content field on the CKB blockchain:
        </p>
        <div className="code-block-wrap" style={{ marginBottom: "16px" }}>
          <div className="code-block-header">
            <span className="code-block-lang">json</span>
            <span className="code-block-filename">DOB content (stored on-chain)</span>
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
              <td>Always &quot;Veil&quot;; used by indexers to identify Veil DOBs</td>
            </tr>
            <tr>
              <td><code>objectType</code></td>
              <td>Always &quot;VeilIdentity&quot;; distinguishes from other Veil DOB types</td>
            </tr>
            <tr>
              <td><code>veilIdHash</code></td>
              <td>Your pseudonymous Veil ID hash; links to your Midnight credit score</td>
            </tr>
            <tr>
              <td><code>ownerCkbLockHash</code></td>
              <td>The lock hash of the CKB wallet that minted and owns this DOB</td>
            </tr>
            <tr>
              <td><code>midnightNetwork</code></td>
              <td>&quot;preprod&quot;/testnet or &quot;mainnet&quot;; indicates which Midnight network the score lives on</td>
            </tr>
            <tr>
              <td><code>midnightContract</code></td>
              <td>The deployed Veil Compact contract address on Midnight</td>
            </tr>
            <tr>
              <td><code>version</code></td>
              <td>DOB format version; currently &quot;1&quot;</td>
            </tr>
          </tbody>
        </table>

        <Callout variant="info">
          The DOB content is permanently public on the CKB blockchain. Do not embed any
          sensitive personal data. The <code>veilIdHash</code> is a one-way hash — it cannot
          be used to derive your real identity or Midnight private key.
        </Callout>

        <h2 id="mint-process">The Mint Process</h2>
        <p>
          Minting a DOB creates a new Spore cell on CKB. Here is what happens technically:
        </p>
        <ol>
          <li>
            The dashboard encodes the identity JSON as UTF-8 bytes and wraps it in the
            Spore v2 cell format (using <code>application/json</code> content type).
          </li>
          <li>
            A CKB transaction is constructed with one output cell: the new Spore DOB cell.
            The cell capacity is set to cover the data size plus the minimum CKB cell overhead
            (typically 150–250 CKB depending on content size).
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
            Once confirmed, the transaction hash and output index uniquely identify your DOB.
            This is your DOB&apos;s permanent address on CKB.
          </li>
        </ol>

        <h2 id="gas-fees">Gas &amp; Fees</h2>
        <p>
          CKB uses a different fee model than Ethereum. Rather than paying gas per computation,
          you pay a cell capacity deposit that covers the storage of your DOB indefinitely.
          You &quot;lock up&quot; CKB tokens as collateral for the storage space.
        </p>
        <ul>
          <li>
            <strong>Minimum capacity:</strong> Each CKB cell requires at least 61 CKBytes of
            base capacity. The Veil DOB content adds approximately 300–400 bytes, bringing
            the total capacity to around 65–70 CKBytes minimum (but the dashboard uses a
            comfortable 200 CKB to ensure success).
          </li>
          <li>
            <strong>Transaction fee:</strong> A small miner fee of approximately 0.001 CKB
            is added to the transaction to incentivize miners.
          </li>
          <li>
            <strong>Total cost:</strong> Approximately 200–250 CKB to mint. This CKB is
            locked in the cell. Veil&apos;s deployed identity lock is designed to preserve the
            identity anchor, so treat this capacity as committed to a long-lived public identity.
          </li>
        </ul>
        <p>
          On testnet, use the Nervos faucet to get free test CKB. On mainnet, at current
          CKB market prices, the mint cost is typically under $5 USD.
        </p>

        <h2 id="view-dob">View Your DOB</h2>
        <p>
          After minting, you can view your DOB on the CKB Explorer:
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
          Search for your CKB wallet address to find the outpoint of your DOB cell. Click
          on the transaction hash to see the encoded cell data. You can verify that the
          <code>veilIdHash</code> in the DOB content matches the one shown on your Veil
          dashboard.
        </p>
        <p>
          The Spore protocol explorer at{" "}
          <a href="https://spore.pro" target="_blank" rel="noopener noreferrer">
            spore.pro
          </a>{" "}
          also indexes Spore DOBs and may show your Veil Identity DOB in a more readable
          format once the Spore indexer processes the new cell.
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
