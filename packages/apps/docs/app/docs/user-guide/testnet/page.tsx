import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "../../../../components/breadcrumb";
import Callout from "../../../../components/callout";
import PrevNext from "../../../../components/prev-next";

export const metadata: Metadata = {
  title: "Testnet Notes",
  description: "Testnet notes for Veil v2 users.",
};

export default function TestnetGuidePage() {
  return (
    <article className="prose">
      <Breadcrumb items={[{ label: "User Guide", href: "/docs/user-guide" }, { label: "Testnet" }]} />

      <h1>Testnet Notes</h1>
      <p className="prose-lead">
        The testnet flow now lives inside the main user guide so testers have one place to follow.
      </p>

      <Callout variant="tip" title="Use the main guide">
        Start with <Link href="/docs/user-guide">Using Veil</Link>. It covers wallet connection,
        identity registration, reputation bands, testnet steps, and troubleshooting.
      </Callout>

      <PrevNext
        prev={{ title: "Using Veil", href: "/docs/user-guide", description: "Wallet, identity, reputation, and testnet flow" }}
        next={{ title: "Identity Anchor", href: "/docs/user-guide/ckb-wallet", description: "Identity anchor notes" }}
      />
    </article>
  );
}
