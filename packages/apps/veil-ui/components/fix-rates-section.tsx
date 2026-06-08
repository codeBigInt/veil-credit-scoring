"use client"

export default function FixRatesSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-card/10 relative border-y border-border/20">
      <div className="container px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Left Content */}
          <div className="space-y-6 text-center md:text-left">
            <span className="section-label">Cap. 03 · CKB Identity Layer</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              Spore DOB
              <br />
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Identity Anchor</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Every Veil identity is anchored publicly as a Spore DOB on CKB — your stable, chain-agnostic credential. Midnight handles ZK verification privately. Any protocol across any chain can reference the anchor without seeing raw scores.
            </p>
            <button className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-3 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
              <a href="/dashboard" target="_blank" className="no-underline hover:no-underline">Mint Veil Identity DOB</a>
            </button>
          </div>

          {/* Right: DOB Mint Card */}
          <div className="flex justify-center relative">
            <div className="relative w-72 h-96 md:w-80 md:h-96 lg:w-96 lg:h-112">
              {/* DOB Card Container */}
              <div className="absolute inset-0 flat-card rounded-sm p-5 md:p-6 flex flex-col items-center justify-center space-y-6">
                {/* DOB Preview */}
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-sm bg-primary/10 border-2 border-primary flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl md:text-5xl mb-2">◇</p>
                    <p className="section-label mt-1">Veil Identity DOB</p>
                  </div>
                </div>

                {/* Info */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Veil ID Hash: <span className="text-primary font-bold">0x742d...</span>
                  </p>
                  <p className="section-label">CKB Testnet Spore</p>
                </div>

                {/* Mint Button */}
                <button className="w-full bg-primary text-primary-foreground py-2 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity uppercase tracking-wide">
                  <a href="/dashboard" target="_blank" className="no-underline hover:no-underline">Mint Now</a>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
