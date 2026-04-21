"use client"

export default function Footer() {
  return (
    <footer className="w-full py-16 bg-background border-t border-border/50">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12 justify-items-center text-center">
          {/* Newsletter Section */}
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Stay updated on Veil protocol developments, smart contract audits, and Midnight ecosystem integrations.
            </p>
            <div className="flex w-full flex-col sm:flex-row gap-3 justify-center items-center">
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full sm:flex-1 px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="w-full sm:w-auto bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
                Subscribe
              </button>
            </div>
          </div>

          {/* Connect Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-foreground">COMMUNITY</h3>
            <div className="space-y-3 text-muted-foreground">
              <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span>𝕏</span> Twitter
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span>◇</span> Github
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span>💬</span> Discord
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span>✈️</span> Telegram
              </a>
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-foreground">RESOURCES</h3>
            <div className="space-y-3 text-muted-foreground">
              <a href="#" className="block hover:text-primary transition-colors">
                Smart Contract
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                API Documentation
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Integration Guide
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Whitepaper
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border/50 pt-8 text-center text-muted-foreground text-sm">
          <p>© Veil Credit Protocol, 2025. Building privacy-first trust on Midnight.</p>
        </div>
      </div>
    </footer>
  )
}
