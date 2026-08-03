import type { Metadata } from "next";
import Breadcrumb from "../../../components/breadcrumb";
import Callout from "../../../components/callout";
import CodeBlock from "../../../components/code-block";
import PrevNext from "../../../components/prev-next";
import Toc from "../../../components/toc";

export const metadata: Metadata = {
  title: "Quick Start",
  description: "Use Veil Protocol v2 for private reputation checks.",
};

const tocItems = [
  { id: "install", text: "Install", depth: 2 },
  { id: "configure", text: "Configure", depth: 2 },
  { id: "register", text: "Register", depth: 2 },
  { id: "prove", text: "Prove", depth: 2 },
  { id: "check", text: "Check", depth: 2 },
];

const install = `bun add @veil-reputation-protocol/sdk`;

const usage = `import { VeilClient } from '@veil-reputation-protocol/sdk';

const client = new VeilClient(config, midnightProvider, {
  deriveLockHashFromAddress,
  reputationReaders: {
    ethereumReader: readEthereumSignalsFromIndexer,
    ckbReader: readCkbSignalsFromIndexer,
  },
});

const registration = await client.register(evmCompatibleSigner);
await client.proveReputation(evmCompatibleSigner);

const decision = await client.checkReputation(registration.veilId, {
  minimumBand: 'silver',
  purpose: 'access',
});`;

export default function QuickStartPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "Getting Started" }, { label: "Quick Start" }]} />

        <h1>Quick Start</h1>
        <p className="prose-lead">
          This is the fastest way to add Veil to your app: install the SDK, then register a user,
          prove their reputation, and check their band — four calls, no backend decision-making involved.
        </p>

        <Callout variant="info" title="What the user sees">
          The user connects one wallet (any EVM-compatible wallet, like MetaMask). The SDK quietly
          derives their Veil identity behind the scenes, then asks them to sign a couple of messages
          to register and prove their reputation.
        </Callout>

        <h2 id="install">Install</h2>
        <CodeBlock code={install} language="bash" filename="terminal" />

        <h2 id="configure">Configure</h2>
        <p>
          Tell the client where your Veil contract lives, which network you&apos;re on, where the proof
          server is, and (optionally) which chains to read wallet activity from. If you want higher-quality
          reputation data, plug in your own indexer instead of the built-in reader — see the{" "}
          <a href="/docs/integration/sdk#readers">SDK Guide</a>.
        </p>

        <h2 id="register">Register</h2>
        <p>
          <code>client.register()</code> is step one for any new user. It works out their Veil ID, asks
          their wallet to sign a registration message (proving they own the wallet — this doesn&apos;t
          move any funds), and saves that registration on Midnight.
        </p>

        <h2 id="prove">Prove</h2>
        <p>
          <code>client.proveReputation()</code> is step two. It reads the wallet&apos;s public activity,
          does the private math to work out a band, and submits proof of that band to Midnight. The
          numbers behind the band never leave the user&apos;s device.
        </p>

        <h2 id="check">Check</h2>
        <CodeBlock code={usage} language="typescript" filename="quick-start.ts" />
        <p>
          <code>checkReputation</code> gives you back a simple decision object: which band the user has,
          whether they meet the level you asked for, and a few extra fields (like a numeric weight) your
          app can use to fine-tune what it does next.
        </p>

        <PrevNext
          prev={{ title: "Introduction", href: "/docs/introduction", description: "What Veil is" }}
          next={{ title: "Reputation Model", href: "/docs/scoring-model", description: "Signals and bands" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
