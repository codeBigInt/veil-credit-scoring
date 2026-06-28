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
          Veil v2 keeps the user flow to one EVM-compatible wallet while using a CKB lock hash as the
          stable identity anchor under the hood.
        </p>

        <h2 id="why-ckb">Why CKB?</h2>
        <p>
          CKB gives Veil a stable identity anchor that can stay consistent across apps. Users do not
          need to manage this directly; the app handles it during wallet connection.
        </p>

        <h2 id="evm-flow">EVM Flow</h2>
        <p>
          The dashboard starts with an EVM wallet because that is the most familiar path for DeFi
          users. The app maps that wallet to the identity anchor before creating the Veil ID.
        </p>

        <Callout variant="info" title="Implementation note">
          The current dashboard preview derives a deterministic local lock-hash placeholder. Production
          deployments should replace it with the canonical CCC/CKB derivation adapter.
        </Callout>

        <h2 id="adapter">Adapter Requirement</h2>
        <p>
          Integrators using <code>buildIdentityFromSigner</code> should provide
          <code> deriveLockHashFromAddress</code>. That lets each app choose the wallet stack it wants
          while keeping Veil identity derivation consistent.
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
