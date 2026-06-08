"use client"

import { useState } from "react"

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 pb-3 pt-0 sm:px-6">
        <div className="site-header-shell">
          <a href="/" className="site-brand" aria-label="Veil Protocol home">
            <span className="site-brand-mark">
              <img src="/veil-cred-logo.PNG" alt="" className="h-9 w-9 object-contain" />
            </span>
            <span className="site-brand-copy">
              <span className="site-brand-name">Veil Protocol</span>
              <span className="site-brand-sub">Private credit infrastructure</span>
            </span>
          </a>

          <nav className="site-nav" aria-label="Primary navigation">
            <a href="https://veil-docs.vercel.app/introduction" target="_blank" className="site-nav-link">
              Docs
            </a>
            <a href="https://veil-docs.vercel.app/introduction" target="_blank" className="site-nav-link">
              Integrations
            </a>
            <a href="https://github.com/codeBigInt/veil-credit-scoring/tree/dev" target="_blank" className="site-nav-link">
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/dashboard"
              className="site-cta hidden sm:inline-flex"
            >
              Launch App
            </a>

            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="site-menu-button lg:hidden"
            >
              {open ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {open && (
            <div className="site-mobile-panel lg:hidden">
              <div className="site-mobile-grid">
                <a href="https://veil-docs.vercel.app/introduction" target="_blank" onClick={() => setOpen(false)} className="site-mobile-link">Docs</a>
                <a href="https://veil-docs.vercel.app/introduction" target="_blank" onClick={() => setOpen(false)} className="site-mobile-link">Integrations</a>
                <a href="https://github.com/codeBigInt/veil-credit-scoring/tree/dev" target="_blank" onClick={() => setOpen(false)} className="site-mobile-link">GitHub</a>
                <a href="/dashboard" onClick={() => setOpen(false)} className="site-mobile-cta">Launch App</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
