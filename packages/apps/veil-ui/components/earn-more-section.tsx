"use client"

export default function EarnMoreSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Left: Dashboard Mockup */}
          <div className="flex justify-center order-2 md:order-1">
            <div className="relative w-70 h-80 sm:w-72 sm:h-96 md:w-96 md:h-100">
              {/* Top Card - User Profile */}
              <div className="absolute top-0 left-0 right-0 bg-card rounded-2xl p-5 shadow-xl border border-border/50 transform -rotate-3 z-30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">👤</div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Anonymous User</p>
                    <p className="text-sm font-semibold text-foreground">ID: 0x742d...35cc</p>
                  </div>
                </div>
              </div>

              {/* Middle Card - Credit Score */}
              <div className="absolute top-20 left-4 right-4 bg-linear-to-br from-primary/10 to-primary/5 rounded-2xl p-5 shadow-lg border border-primary/30 transform rotate-1 z-20">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium">CREDIT SCORE</p>
                  <span className="text-lg font-bold text-primary">750</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-linear-to-r from-primary to-primary/60" style={{ width: "75%" }}></div>
                </div>
              </div>

              {/* Bottom Card 1 - Verification */}
              <div className="absolute bottom-24 left-2 right-2 bg-card rounded-xl p-4 shadow-lg border border-border/50 transform -rotate-2 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">✓</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verified</p>
                    <p className="text-sm font-medium">On-chain Behavior</p>
                  </div>
                </div>
              </div>

              {/* Bottom Card 2 - PoT NFT */}
              <div className="absolute bottom-0 left-6 right-6 bg-card rounded-xl p-4 shadow-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">🎖️</div>
                  <div>
                    <p className="text-xs text-muted-foreground">PoT NFT</p>
                    <p className="text-sm font-medium">Proof of Trustworthiness</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="space-y-6 text-center md:text-left order-1 md:order-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              Access <span className="text-primary">Better Terms</span> With Your Credit Score
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              High credit scores unlock exclusive benefits across Midnight DeFi. Get lower fees, better rates, and
              priority access to premium strategies—all while staying anonymous.
            </p>
            <button className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg hover:shadow-primary/50">
              Build Credit Score
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
