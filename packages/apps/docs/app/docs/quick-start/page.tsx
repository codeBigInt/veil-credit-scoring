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

const install = `bun add @veil-protocol/sdk`;

const usage = `import { VeilClient } from '@veil-protocol/sdk';

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
          Start with the SDK. Veil v2 integrations do not ask the backend to decide reputation.
          They register identity, prove reputation, and check bands through Midnight.
        </p>

        <Callout variant="info" title="Default flow">
          The user connects one EVM-compatible wallet. The UI/SDK adapter derives the Veil identity,
          then the user signs and submits the registration and proof flow.
        </Callout>

        <h2 id="install">Install</h2>
        <CodeBlock code={install} language="bash" filename="terminal" />

        <h2 id="configure">Configure</h2>
        <p>
          Provide the Midnight contract address, network, proof server, optional fee sponsor, and
          public chain RPCs or reader adapters. Production protocols should use their own indexers
          for high-quality reputation signals.
        </p>

        <h2 id="register">Register</h2>
        <p>
          <code>client.register()</code> derives the user&apos;s Veil identity, asks the wallet to sign the
          registration message, optionally requests DUST sponsorship, and submits <code>Identity_register</code>.
        </p>

        <h2 id="prove">Prove</h2>
        <p>
          <code>client.proveReputation()</code> collects public chain signals, builds private witness values,
          calls the configured proof server, and submits <code>Reputation_prove</code>. Raw signal values are not
          returned to integrators.
        </p>

        <h2 id="check">Check</h2>
        <CodeBlock code={usage} language="typescript" filename="quick-start.ts" />
        <p>
          <code>checkReputation</code> returns a <code>ReputationDecision</code>: band, threshold result, access tier,
          community weight, purpose, epoch, and proof hash.
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
