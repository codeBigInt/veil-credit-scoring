"use client"

import { useState } from "react"

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-2xl border-b border-primary/10">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-5 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-all duration-300">
              <span className="text-primary-foreground font-bold text-lg">V</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">Veil</span>
              <span className="text-xs text-muted-foreground/80 font-medium">Credit Protocol</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary px-4 py-2 rounded-lg transition-all duration-300 hover:bg-primary/5">
              Protocol
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary px-4 py-2 rounded-lg transition-all duration-300 hover:bg-primary/5">
              Docs
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary px-4 py-2 rounded-lg transition-all duration-300 hover:bg-primary/5">
              Integrations
            </a>
          </nav>
          {/* Mobile menu toggle + CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
              className="lg:hidden p-2 rounded-md hover:bg-primary/5 transition-colors"
            >
              <svg className="w-6 h-6 text-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button className="hidden sm:inline-block bg-linear-to-r from-primary to-primary/90 text-primary-foreground px-5 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105 shadow-md">
              Launch App
            </button>
          </div>

          {/* Mobile dropdown menu */}
          {open && (
            <div className="lg:hidden absolute right-4 top-full mt-2 w-52 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="flex flex-col p-2">
                <a href="#" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-foreground hover:bg-primary/5">Protocol</a>
                <a href="#" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-foreground hover:bg-primary/5">Docs</a>
                <a href="#" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-foreground hover:bg-primary/5">Integrations</a>
                <div className="border-t border-border/50 mt-2 pt-2">
                  <a href="#" onClick={() => setOpen(false)} className="block text-center bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium">Launch App</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
