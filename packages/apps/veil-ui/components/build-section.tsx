"use client"

export default function BuildSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-card/10 relative overflow-hidden border-t border-border/20">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Left: Tech Architecture Graphic */}
          <div className="flex justify-center order-2 md:order-1">
            <svg viewBox="0 0 300 300" className="w-full max-w-xs sm:max-w-sm md:max-w-md text-primary" style={{ color: 'var(--color-primary)' }} xmlns="http://www.w3.org/2000/svg">
              {/* Central Shield */}
              <path
                d="M 150 50 L 200 80 L 200 150 Q 150 200 150 200 Q 150 200 100 150 L 100 80 Z"
                fill="url(#shieldGradient)"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Connecting Lines */}
              <line x1="100" y1="80" x2="50" y2="40" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <line x1="200" y1="80" x2="250" y2="40" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <line x1="150" y1="200" x2="100" y2="260" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <line x1="150" y1="200" x2="200" y2="260" stroke="currentColor" strokeWidth="2" opacity="0.5" />

              {/* Connection Nodes */}
              <circle cx="50" cy="40" r="9" fill="currentColor" opacity="1" filter="url(#nodeGlow)" />
              <circle cx="250" cy="40" r="9" fill="currentColor" opacity="1" filter="url(#nodeGlow)" />
              <circle cx="100" cy="260" r="9" fill="currentColor" opacity="1" filter="url(#nodeGlow)" />
              <circle cx="200" cy="260" r="9" fill="currentColor" opacity="1" filter="url(#nodeGlow)" />

              {/* Labels */}
              <text x="0" y="25" fontSize="9" fill="currentColor" opacity="0.7">Smart Contract</text>
              <text x="230" y="25" fontSize="9" fill="currentColor" opacity="0.7">API Calls</text>
              <text x="65" y="283" fontSize="9" fill="currentColor" opacity="0.7">DeFi Protocol</text>
              <text x="175" y="283" fontSize="9" fill="currentColor" opacity="0.7">On-Chain</text>

              {/* Center label */}
              <text x="150" y="138" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="700" letterSpacing="2">ZK</text>

              <defs>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.10" />
                </linearGradient>
                <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>

          {/* Right Content */}
          <div className="space-y-6 text-center md:text-left order-1 md:order-2">
            <span className="section-label">Cap. 06 · Build</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Integrate</span> Veil Into Your Stack
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Call Veil's REST API from any DeFi protocol on Ethereum, Solana, CKB, Midnight, or any EVM chain. Get ZK-verified credit decisions without any user identity disclosure.
            </p>
            <div className="space-y-3 max-w-lg mx-auto md:mx-0">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Chain-agnostic REST API</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Midnight ZK proofs — zero identity disclosure</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">CKB Spore DOB identity anchor</p>
              </div>
            </div>
            <button className="w-full md:w-auto border border-primary text-primary px-6 py-3 rounded-sm font-bold hover:bg-primary/10 transition-colors uppercase tracking-wide text-sm">
              <a href="https://veil-docs.vercel.app/introduction" target="_blank" className="no-underline hover:no-underline">Read API Docs</a>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
