"use client"

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7.5l3 3L12 4" />
  </svg>
)

export default function FixRatesSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-card/10 relative border-y border-border/20">
      <div className="container px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          <div className="space-y-6 text-center md:text-left">
            <span className="section-label">Cap. 03 · Portable Standing</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              Private Profile
              <br />
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Private By Default</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Veil derives a stable profile from one EVM-compatible wallet and records private proof state on Midnight. Apps verify a band, not your raw activity.
            </p>
            {/* <a href="/dashboard" target="_blank" className="inline-flex w-full md:w-auto items-center justify-center bg-primary text-primary-foreground px-6 py-3 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-sm no-underline hover:no-underline">
              Open Dashboard
            </a> */}
          </div>

          <div className="w-full max-w-md">
            <div className="rounded-sm border border-primary/40 bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label mb-2">Private Result</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">Band Ready</h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-sm border border-primary/35 bg-primary/10 px-3 py-1.5 text-primary">
                  <CheckIcon />
                  <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                </div>
              </div>

              <div className="mt-6 rounded-sm border border-primary/30 bg-primary/5 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-2">Current Band</p>
                    <p className="text-5xl font-black uppercase leading-none text-primary">Gold</p>
                  </div>
                  <p className="section-label text-foreground">No wallet history shared</p>
                </div>
                <div className="mt-5 h-1 overflow-hidden rounded-full bg-border/30">
                  <div className="h-full w-3/4 rounded-full bg-primary" />
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {[
                  ['Airdrops', 'Eligible'],
                  ['Governance', 'Multiplier ready'],
                  ['Access', 'Tier unlocked'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-sm border border-border/20 bg-background/70 px-4 py-3">
                    <p className="section-label">{label}</p>
                    <p className="text-xs font-black uppercase tracking-wide text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <a href="/dashboard" target="_blank" className="mt-5 inline-flex w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 no-underline hover:no-underline">
                Open Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
