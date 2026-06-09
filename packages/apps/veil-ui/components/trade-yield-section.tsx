"use client"

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 7 5.5 10.5 12 3.5"/>
  </svg>
)

const ActivityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 7 4 3 6 9 9 5 12 7 13 7"/>
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="6" width="9" height="7" rx="1"/>
    <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6"/>
  </svg>
)

export default function TradeYieldSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">

        {/* Section label + heading — full width at top */}
        <div className="mb-12">
          <span className="section-label block mb-4">Cap. 01 · ZK Verification</span>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              ZK-Proven
              <br />
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Credit Scores</span>
            </h2>
            <div className="max-w-sm space-y-4">
              <p className="text-muted-foreground text-base leading-relaxed">
                Veil computes credit scores from on-chain history across Ethereum, Solana, CKB, and more — then proves them using Midnight ZK circuits. No raw score is ever disclosed.
              </p>
              <a href="https://docs-veil-credit-scoring.netlify.app/docs/concepts" target="_blank" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-xs no-underline">
                View Smart Contract
              </a>
            </div>
          </div>
        </div>

        {/* Full-width visual row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/20">
          {/* Credit Score central card */}
          <div className="flat-card p-8 flex flex-col items-center justify-center gap-4 text-center md:col-span-1">
            <p className="section-label">ZK Credit Score</p>
            <p className="font-black text-foreground" style={{ fontSize: 'clamp(4rem, 8vw, 6rem)', lineHeight: 1 }}>750</p>
            <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '75%' }} />
            </div>
            <p className="section-label text-primary">Excellent</p>
          </div>

          {/* Status cards */}
          <div className="flat-card p-6 space-y-6 md:col-span-1">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <CheckIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground uppercase tracking-wide">Verified</p>
                  <p className="section-label">On-chain behaviour</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <ActivityIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground uppercase tracking-wide">History</p>
                  <p className="section-label">Tracked privately 24/7</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <LockIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground uppercase tracking-wide">Private</p>
                  <p className="section-label">Identity shielded always</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chain support */}
          <div className="flat-card p-6 md:col-span-1">
            <p className="section-label mb-4">Supported chains</p>
            <div className="grid grid-cols-2 gap-2">
              {['Ethereum', 'Solana', 'CKB', 'Midnight', 'Polygon', 'Arbitrum', 'Base', 'Any EVM'].map((chain) => (
                <div key={chain} className="px-2 py-1.5 border border-border/20 rounded-sm">
                  <p className="section-label text-foreground/80">{chain}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
