"use client"

export default function TradeYieldSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-background relative">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Visual: Credit Score Circle */}
          <div className="flex justify-center order-2 md:order-1">
            <div className="relative w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96">
              {/* Main Circle with Credit Score */}
              <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-2xl border border-primary/50">
                <div className="text-center space-y-2">
                  <p className="text-primary-foreground/70 text-sm font-medium">CREDIT SCORE</p>
                  <p className="text-6xl font-bold text-primary-foreground">750</p>
                  <p className="text-primary-foreground/60 text-sm">Excellent</p>
                </div>
              </div>

              {/* Floating Status Cards */}
              <div className="absolute -right-6 top-12 bg-card/90 backdrop-blur border border-border rounded-2xl p-5 shadow-xl max-w-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-xl">
                    ✓
                  </div>
                  <span className="font-semibold text-foreground text-sm">Verified</span>
                </div>
                <p className="text-xs text-muted-foreground">On-chain identity verified</p>
              </div>

              <div className="absolute right-8 bottom-20 bg-card/90 backdrop-blur border border-border rounded-2xl p-5 shadow-xl max-w-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                    📊
                  </div>
                  <span className="font-semibold text-foreground text-sm">History</span>
                </div>
                <p className="text-xs text-muted-foreground">24 months tracked</p>
              </div>

              <div className="absolute -left-8 bottom-6 bg-card/90 backdrop-blur border border-border rounded-2xl p-5 shadow-xl max-w-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">
                    🔒
                  </div>
                  <span className="font-semibold text-foreground text-sm">Private</span>
                </div>
                <p className="text-xs text-muted-foreground">Identity shielded always</p>
              </div>
            </div>
          </div>
          
          {/* Left Content */}
          <div className="space-y-6 text-center md:text-left order-1 md:order-2">
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                On-Chain Verified
                <br />
                <span className="text-primary">Credit Scores</span>
              </h2>
            </div>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Veil integrates with DeFi protocols through Witness API calls to track financial behavior and allocate
              immutable on-chain credit scores without revealing user identities.
            </p>
            <button className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg hover:shadow-primary/50">
              View Smart Contract
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
