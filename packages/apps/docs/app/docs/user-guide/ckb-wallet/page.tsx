import type { Metadata } from "next";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import PrevNext from "../../../../components/prev-next";
import Toc from "../../../../components/toc";

export const metadata: Metadata = {
  title: "Identity Anchor",
  description: "How Veil v2 uses CKB lock hashes behind a single wallet flow.",
};

const tocItems = [
  { id: "why-ckb", text: "Why CKB?", depth: 2 },
  { id: "evm-flow", text: "EVM Flow", depth: 2 },
  { id: "adapter", text: "Adapter Requirement", depth: 2 },
];

export default function CkbWalletPage() {
  return (
    <div className="docs-page-grid">
      <article className="prose docs-wide-prose">
        <Breadcrumb items={[{ label: "User Guide", href: "/docs/user-guide" }, { label: "Identity Anchor" }]} />

        <h1>Identity Anchor</h1>
        <p className="prose-lead">
          You only ever connect one normal wallet (MetaMask or similar). Behind the scenes, Veil turns
          that into a second, separate ID on a different chain (CKB) — this page explains why, and you
          don&apos;t actually need to know any of it to use Veil.
        </p>

        <h2 id="why-ckb">Why a Second Chain?</h2>
        <p>
          Veil needs one stable, unchanging ID to attach a user&apos;s reputation to — something that
          won&apos;t shift if they switch wallets or chains later. CKB gives it a reliable way to derive
          that ID. You never see or manage this directly; the app handles it automatically when you connect.
        </p>

        <h2 id="evm-flow">Why Start With an EVM Wallet?</h2>
        <p>
          Because that&apos;s what most DeFi users already have installed. The app takes the wallet you
          connect, works out the matching CKB-based ID behind the scenes, and uses that as your Veil ID
          going forward.
        </p>

        <Callout variant="info" title="Implementation note">
          The current dashboard preview uses a simplified, local placeholder for this derivation step.
          Production deployments should use the real CCC/CKB library for it instead.
        </Callout>

        <h2 id="adapter">If You're Integrating</h2>
        <p>
          If you use <code>buildIdentityFromSigner</code>, you need to supply a{" "}
          <code>deriveLockHashFromAddress</code> function — basically, the piece of code that does the
          &quot;wallet address in, CKB ID out&quot; conversion for whatever wallet library your app uses.
          This keeps the derivation consistent no matter which wallet stack each app picks.
        </p>

        <PrevNext
          prev={{ title: "Using Veil", href: "/docs/user-guide", description: "User flow and testnet notes" }}
          next={{ title: "Architecture", href: "/docs/concepts", description: "System design" }}
        />
      </article>

      <Toc items={tocItems} />
    </div>
  );
}
