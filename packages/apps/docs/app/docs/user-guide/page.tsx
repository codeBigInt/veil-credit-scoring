import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Using Veil",
  description: "A simple user guide for Veil v2 identity and reputation.",
};

const tocItems = [
  { id: "what-you-need", text: "What You Need", depth: 2 },
  { id: "wallet", text: "Connect Wallet", depth: 2 },
  { id: "identity", text: "Veil Identity", depth: 2 },
  { id: "reputation", text: "Reputation Bands", depth: 2 },
  { id: "testnet", text: "Testnet Flow", depth: 2 },
  { id: "troubleshooting", text: "Troubleshooting", depth: 2 },
  { id: "privacy", text: "Privacy Notes", depth: 2 },
];

export default function UserGuidePage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "User Guide" }, { label: "Using Veil" }]} />

        <h1>Using Veil</h1>
        <p className="prose-lead">
          Veil lets you prove that a wallet has useful on-chain reputation without showing every app
          your full wallet history. You connect one wallet, create a Veil identity, and share a simple
          band such as bronze, silver, gold, or platinum.
        </p>

        <Callout variant="info" title="Simple mental model">
          Apps do not need to see all your wallet activity. They only need to know whether your Veil
          reputation meets the level required for an action like access, voting, rewards, or an airdrop.
        </Callout>

        <h2 id="what-you-need">What You Need</h2>
        <ul>
          <li>A browser such as Chrome, Brave, or another wallet-friendly browser.</li>
          <li>One EVM-compatible wallet, such as MetaMask or another injected wallet.</li>
          <li>The correct Veil dashboard URL for the network you are testing.</li>
          <li>A small amount of patience during proof steps. Some actions can take longer than a normal website click.</li>
        </ul>

        <h2 id="wallet">Connect Wallet</h2>
        <p>
          Open the dashboard and choose <strong>Connect EVM Wallet</strong>. Your wallet will ask you
          to approve the connection. This does not move funds and does not give Veil permission to spend
          tokens.
        </p>
        <p>
          After connection, the dashboard shows a shortened wallet address and a Veil identity preview.
          If the wallet prompt does not appear, unlock your wallet extension and refresh the page.
        </p>

        <h2 id="identity">Veil Identity</h2>
        <p>
          Your Veil identity is a stable ID derived from your connected wallet. It is the handle Veil
          uses on Midnight so apps can ask reputation questions without asking for raw wallet history.
        </p>
        <ol>
          <li>Connect your wallet.</li>
          <li>Review the Veil ID shown in the dashboard.</li>
          <li>Sign the registration message when prompted.</li>
          <li>Wait for the registration transaction to finish.</li>
        </ol>
        <Callout variant="tip" title="Signing is not spending">
          The registration message proves wallet ownership. It is not a token approval and does not
          transfer assets.
        </Callout>

        <h2 id="reputation">Reputation Bands</h2>
        <p>
          Veil maps reputation into bands. Apps choose the minimum band they need. For example, a
          community might require bronze for a channel, silver for an airdrop, or gold for a governance
          boost.
        </p>
        <table>
          <thead>
            <tr>
              <th>Band</th>
              <th>What it usually means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>unranked</code></td>
              <td>No usable reputation proof has been submitted yet.</td>
            </tr>
            <tr>
              <td><code>bronze</code></td>
              <td>Basic activity is present.</td>
            </tr>
            <tr>
              <td><code>silver</code></td>
              <td>The wallet has enough activity for many access and reward checks.</td>
            </tr>
            <tr>
              <td><code>gold</code></td>
              <td>The wallet has stronger history and can qualify for higher trust actions.</td>
            </tr>
            <tr>
              <td><code>platinum</code></td>
              <td>The highest band, used by apps that want the strongest reputation signal.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="testnet">Testnet Flow</h2>
        <p>
          Testnet is for trying the flow with no real funds at risk. Use a test wallet. Do not use a
          wallet that holds important assets.
        </p>
        <ol>
          <li>Open the test dashboard link shared by the Veil team or your protocol team.</li>
          <li>Connect a test wallet.</li>
          <li>Check that the Veil ID appears.</li>
          <li>Sign the registration message.</li>
          <li>Try the reputation band preview and confirm the pass/fail result changes as expected.</li>
          <li>If the full provider is enabled, run the registration and reputation proof flow.</li>
        </ol>

        <h2 id="troubleshooting">Troubleshooting</h2>
        <table>
          <thead>
            <tr>
              <th>Problem</th>
              <th>Try this</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Wallet does not open</td>
              <td>Unlock the wallet extension, refresh the page, and click connect again.</td>
            </tr>
            <tr>
              <td>Contract address is missing</td>
              <td>The app is not configured for a deployed Veil contract yet. Ask the operator to check the backend contract route.</td>
            </tr>
            <tr>
              <td>DUST sponsorship fails</td>
              <td>The backend sponsor wallet may need more available NIGHT or DUST capacity.</td>
            </tr>
            <tr>
              <td>Proof takes a long time</td>
              <td>Wait for the current step to finish. Proof work can take longer than regular web requests.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="privacy">Privacy Notes</h2>
        <ul>
          <li>Apps receive a band decision, not your full wallet history.</li>
          <li>The backend does not calculate your reputation.</li>
          <li>Encrypted backups should be encrypted before they are uploaded.</li>
          <li>You should still use a test wallet on testnet.</li>
        </ul>

        <PrevNext
          prev={{ title: "Architecture", href: "/docs/concepts", description: "How Veil fits together" }}
          next={{ title: "Identity Anchor", href: "/docs/user-guide/ckb-wallet", description: "How the identity anchor works" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
