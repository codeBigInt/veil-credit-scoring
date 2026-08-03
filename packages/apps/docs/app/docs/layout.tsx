"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Top header bar ── */}
      <header className="docs-header">
        <Link href="/" className="docs-header-logo">
          <img src="/veil-cred-logo.PNG" alt="Veil Protocol" className="docs-header-logo-img" />
          <span className="docs-header-logo-text">Veil Protocol</span>
        </Link>

        <span className="docs-header-badge">v2 docs</span>

        <div className="docs-header-spacer" />

        <nav className="docs-header-links">
          <Link
            href="https://github.com/codeBigInt/veil-credit-scoring-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="docs-header-link always-show"
            aria-label="GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="section-label">GitHub</span>
          </Link>

          <Link
            href="/"
            className="docs-header-link always-show"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 2H14V6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10L14 2" strokeLinecap="round" />
              <path d="M8 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="section-label">Back to Protocol</span>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="docs-mobile-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      {/* ── Three-column shell ── */}
      <div className="docs-shell">
        {/* Left sidebar */}
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Main content */}
        <main className="docs-content-col">
          {children}
        </main>

      </div>
    </>
  );
}
