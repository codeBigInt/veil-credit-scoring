"use client"

export default function BuildSection() {
  const flow = [
    ['Wallet', 'User signs once'],
    ['SDK', 'Builds proof'],
    ['Midnight', 'Stores private state'],
    ['App', 'Checks band'],
  ]

  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-card/10 relative overflow-hidden border-t border-border/20">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          {/* Left: integration flow graphic */}
          <div className="order-2 flex w-full justify-center md:order-1">
            <div className="relative w-full max-w-md rounded-sm border border-border/25 bg-background/70 p-5">
              <div className="absolute left-1/2 top-12 bottom-12 w-px -translate-x-1/2 bg-border/30" aria-hidden="true" />
              <div className="relative grid gap-4">
                {flow.map(([title, detail], index) => (
                  <div
                    key={title}
                    className={`grid grid-cols-[1fr_42px_1fr] items-center gap-3 ${index % 2 === 0 ? '' : '[&>div:first-child]:col-start-3 [&>div:first-child]:row-start-1 [&>div:last-child]:col-start-1 [&>div:last-child]:row-start-1'}`}
                  >
                    <div className="rounded-sm border border-border/25 bg-card px-4 py-3">
                      <p className="text-sm font-black uppercase tracking-wide text-foreground">{title}</p>
                      <p className="section-label mt-1">{detail}</p>
                    </div>
                    <div className="z-10 flex h-10 w-10 items-center justify-center rounded-sm border border-primary/40 bg-primary text-sm font-black text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="h-px bg-border/30" aria-hidden="true" />
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-sm border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="section-label mb-1 text-primary">Output</p>
                    <p className="font-black uppercase tracking-tight text-foreground">Band check</p>
                  </div>
                  <div className="rounded-sm border border-primary/30 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-primary">
                    Pass
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="space-y-6 text-center md:text-left order-1 md:order-2">
            <span className="section-label">Cap. 06 · Build</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Integrate</span> Veil Into Your Stack
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Add private band checks to any DeFi app, DAO, airdrop, or gated community. Users share a simple result without revealing their full wallet history.
            </p>
            <div className="space-y-3 max-w-lg mx-auto md:mx-0">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Works from any supported chain</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Private checks with simple pass/fail results</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">✓</span>
                <p className="text-muted-foreground">Portable standing users control</p>
              </div>
            </div>
            <button className="w-full md:w-auto border border-primary text-primary px-6 py-3 rounded-sm font-bold hover:bg-primary/10 transition-colors uppercase tracking-wide text-sm">
              <a href="https://docs-veil-credit-scoring.netlify.app/docs/introduction" target="_blank" className="no-underline hover:no-underline">Read API Docs</a>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
