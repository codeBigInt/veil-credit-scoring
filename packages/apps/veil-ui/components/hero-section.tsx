"use client"

export default function HeroSection() {
  return (
    <section className="w-full flex items-center justify-center py-20 md:py-32 relative bg-background overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center md:justify-items-start">
          {/* Left Content */}
          <div className="space-y-8 text-center md:text-left">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Private Trust,
                <br />
                <span className="text-primary">Verified Credit</span>
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Veil enables anonymous credit scoring on Midnight blockchain. Verify financial trustworthiness without
              revealing identities. Built for DeFi protocols that prioritize privacy.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 justify-center md:justify-start">
              <button className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg hover:shadow-primary/50">
                Launch Protocol
              </button>
              <button className="w-full sm:w-auto border border-border text-foreground px-8 py-3 rounded-lg font-medium hover:bg-muted/50 transition-colors">
                Read Docs
              </button>
            </div>
          </div>

          {/* Right Decorative Element */}
          <div className="hidden md:flex items-center justify-center relative h-96">
            {/* Soft glowing base layer (strong blur) */}
            <div
              className="absolute -inset-6 rounded-full bg-linear-to-br from-primary/30 via-primary/15 to-transparent opacity-80 transform scale-110 animate-pulse"
              style={{ filter: "blur(80px)" }}
            />
            {/* Inner subtle halo (softer blur for depth) */}
            <div
              className="absolute inset-0 bg-linear-to-br from-primary/8 to-transparent rounded-full opacity-60 transform scale-102"
              style={{ filter: "blur(36px)" }}
            />
            <div className="relative w-100 h-100 bg-linear-to-br from-primary/15 to-primary/5 rounded-full border border-primary/30 flex items-center justify-center shadow-2xl ring-8 ring-primary/10">
              <div className="text-center space-y-4">
                <div className="text-6xl">🔐</div>
                <p className="text-sm text-muted-foreground font-medium">Anonymous Verification</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
