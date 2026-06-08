import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Veil Protocol Documentation",
  description:
    "Official documentation for the Veil Protocol — a cross-chain, privacy-preserving credit scoring system built on Midnight and CKB.",
};

const sections = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4l3 2" strokeLinecap="round" />
      </svg>
    ),
    title: "Introduction",
    href: "/docs/introduction",
    desc: "Understand what Veil is, how it uses ZK proofs on Midnight, and why it anchors identity on CKB.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="4" width="16" height="12" rx="1" />
        <path d="M6 8h8M6 12h5" strokeLinecap="round" />
      </svg>
    ),
    title: "Scoring Model",
    href: "/docs/scoring-model",
    desc: "The five credit bands, behavioral factors, LTV limits, ZK proof flow, and score TTL mechanics.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 5h14M3 10h10M3 15h7" strokeLinecap="round" />
        <circle cx="16" cy="14" r="3" />
        <path d="M15 14h2M16 13v2" strokeLinecap="round" />
      </svg>
    ),
    title: "Integration Guide",
    href: "/docs/integration",
    desc: "Submit behavioral data, request credit decisions, and consume Veil scores in your DeFi protocol.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 7l8-4 8 4-8 4-8-4z" />
        <path d="M2 12l8 4 8-4M2 9.5l8 4 8-4" strokeLinecap="round" />
      </svg>
    ),
    title: "API Reference",
    href: "/docs/integration/api-reference",
    desc: "Full reference for all REST endpoints: submit scores, poll jobs, request and retrieve decisions.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="2" width="10" height="14" rx="1" />
        <path d="M7 17h8V5" strokeLinecap="round" />
        <path d="M6 6h5M6 9h5M6 12h3" strokeLinecap="round" />
      </svg>
    ),
    title: "Dashboard Guide",
    href: "/docs/user-guide",
    desc: "Step-by-step walkthrough for end users: connect wallet, generate Veil ID, mint DOB, get scored.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10c0-1.66 1.34-3 3-3s3 1.34 3 3" />
        <path d="M10 13v1" strokeLinecap="round" />
        <circle cx="10" cy="7" r="0.5" fill="currentColor" />
      </svg>
    ),
    title: "CKB Wallet Setup",
    href: "/docs/user-guide/ckb-wallet",
    desc: "Connect your CKB wallet, understand Spore DOBs, and mint your on-chain Veil identity.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <polygon points="10,2 18,7 18,13 10,18 2,13 2,7" />
        <circle cx="10" cy="10" r="2" />
      </svg>
    ),
    title: "Architecture",
    href: "/docs/concepts",
    desc: "Deep dive into cross-chain credit scoring, the ZK proof pipeline, and the three protocol roles.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Header */}
      <header className="docs-header" style={{ position: "fixed" }}>
        <Link href="/" className="docs-header-logo">
          <img src="/veil-cred-logo.PNG" alt="Veil Protocol" className="docs-header-logo-img" />
          <span className="docs-header-logo-text">Veil Protocol</span>
        </Link>
        <span className="docs-header-badge">v0.1.0-beta</span>
        <div className="docs-header-spacer" />
        <nav className="docs-header-links">
          <Link
            href="https://github.com/codeBigInt/veil-credit-scoring-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="docs-header-link always-show"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="section-label">GitHub</span>
          </Link>
        </nav>
      </header>

      <div style={{ paddingTop: "var(--header-h)" }}>
        {/* Hero */}
        <div className="home-hero">
          <div className="home-hero-eyebrow">Documentation</div>
          <h1 className="home-hero-title">
            Veil <span>Protocol</span>
          </h1>
          <p className="home-hero-sub">
            Privacy-preserving, cross-chain credit scoring. Built on Midnight for
            zero-knowledge proofs and CKB for immutable on-chain identity.
          </p>
          <div className="home-cta-row">
            <Link href="/docs/introduction" className="btn-primary">
              Get started →
            </Link>
            <Link href="/docs/integration/api-reference" className="btn-outline">
              API Reference
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="home-section-label">
          <span className="section-label">Documentation sections</span>
        </div>

        {/* Card grid */}
        <div className="home-card-grid">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="home-nav-card">
              <div className="home-nav-card-icon">{s.icon}</div>
              <span className="home-nav-card-title">{s.title}</span>
              <span className="home-nav-card-desc">{s.desc}</span>
            </Link>
          ))}
        </div>

        {/* Footer strip */}
        <div
          style={{
            borderTop: "1px solid oklch(0.22 0 0)",
            padding: "24px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span className="section-label">Veil Protocol &mdash; v0.1.0-beta</span>
          <span className="section-label">Built on Midnight &amp; CKB</span>
        </div>
      </div>
    </div>
  );
}
