"use client"

export default function BuildSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-slate-950/40 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Left: Tech Architecture Graphic */}
          <div className="flex justify-center order-2 md:order-1">
            <svg viewBox="0 0 300 300" className="w-full max-w-xs sm:max-w-sm md:max-w-md" xmlns="http://www.w3.org/2000/svg">
              {/* Central Shield */}
              <path
                d="M 150 50 L 200 80 L 200 150 Q 150 200 150 200 Q 150 200 100 150 L 100 80 Z"
                fill="url(#shieldGradient)"
                stroke="#1d9b8f"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Shield Icon */}
              <text x="150" y="140" textAnchor="middle" fontSize="40" fill="#1d9b8f" fontWeight="bold">
                🔐
              </text>

              {/* Connecting Lines */}
              <line x1="100" y1="80" x2="50" y2="40" stroke="#1d9b8f" strokeWidth="2" opacity="0.6" />
              <line x1="200" y1="80" x2="250" y2="40" stroke="#1d9b8f" strokeWidth="2" opacity="0.6" />
              <line x1="150" y1="200" x2="100" y2="260" stroke="#1d9b8f" strokeWidth="2" opacity="0.6" />
              <line x1="150" y1="200" x2="200" y2="260" stroke="#1d9b8f" strokeWidth="2" opacity="0.6" />

              {/* Connection Nodes */}
              <circle cx="50" cy="40" r="8" fill="#1d9b8f" opacity="0.8" />
              <circle cx="250" cy="40" r="8" fill="#1d9b8f" opacity="0.8" />
              <circle cx="100" cy="260" r="8" fill="#1d9b8f" opacity="0.8" />
              <circle cx="200" cy="260" r="8" fill="#1d9b8f" opacity="0.8" />

              {/* Labels */}
              <text x="40" y="25" fontSize="10" fill="#1d9b8f" opacity="0.8">
                Smart Contract
              </text>
              <text x="240" y="25" fontSize="10" fill="#1d9b8f" opacity="0.8">
                Witness API Calls
              </text>
              <text x="70" y="280" fontSize="10" fill="#1d9b8f" opacity="0.8">
                DeFi Protocol
              </text>
              <text x="180" y="280" fontSize="10" fill="#1d9b8f" opacity="0.8">
                On-Chain
              </text>

              <defs>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#1d9b8f", stopOpacity: 0.3 }} />
                  <stop offset="100%" style={{ stopColor: "#1d9b8f", stopOpacity: 0.1 }} />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Right Content */}
          <div className="space-y-6 text-center md:text-left order-1 md:order-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              <span className="text-primary">Integrate</span> Veil Into Your Protocol
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Leverage Veil's on-chain verifiable credit scoring smart contract through Witness API calls. Enable
              trustworthiness verification without compromising user privacy on Midnight.
            </p>
            <div className="space-y-3 max-w-lg mx-auto md:mx-0">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Permissionless API integration</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Zero identity disclosure</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Immutable credit history</p>
              </div>
            </div>
            <button className="w-full md:w-auto border border-primary text-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/10 transition-colors">
              Read API Docs
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
