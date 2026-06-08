"use client"

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6"/>
    <polyline points="5 8 7 10 11 6"/>
  </svg>
)

const DiamondIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="8 1 15 8 8 15 1 8"/>
  </svg>
)

export default function EarnMoreSection() {
  const benefits = [
    { label: 'Lower borrow rates', detail: 'Down to 0.5% for Platinum band' },
    { label: 'Higher LTV limits', detail: 'Up to 90% vs 60% default' },
    { label: 'Priority liquidation buffer', detail: '48h notice for high-credit users' },
    { label: 'Fee waivers on bridges', detail: 'Zero bridge fees for Gold+' },
    { label: 'Early access to yield vaults', detail: 'Private allocation rounds' },
    { label: 'Governance weight bonus', detail: '1.5x vote multiplier' },
  ]

  return (
    <section className="w-full py-16 md:py-24 bg-card/10 border-y border-border/20 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-12 gap-8 items-start">

          {/* Left: heading + copy (5 cols) */}
          <div className="col-span-12 md:col-span-5 space-y-6 md:sticky md:top-24">
            <span className="section-label">Cap. 04 · Protocol Benefits</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)' }}>
              Unlock{" "}
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Better Terms</span>
              {" "}With Higher Credit
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              High Veil credit scores unlock exclusive benefits across any integrated DeFi protocol — while your identity and raw score stay completely private.
            </p>

            {/* Identity card mockup */}
            <div className="flat-card rounded-sm p-5 space-y-4 max-w-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <UserIcon />
                </div>
                <div>
                  <p className="section-label">Anonymous User</p>
                  <p className="text-xs font-bold text-foreground">ID: 0x742d...35cc</p>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label">Veil Credit Score</p>
                  <span className="font-black text-primary text-sm">750</span>
                </div>
                <div className="w-full h-0.5 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <DiamondIcon />
                </div>
                <p className="section-label text-primary">Spore DOB Anchored · CKB</p>
              </div>
            </div>

            <a href="https://github.com/codeBigInt/veil-credit-scoring/tree/dev/packages/contract" target="_blank" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-sm no-underline">
              Build Credit Score
            </a>
          </div>

          {/* Right: benefits list (7 cols) */}
          <div className="col-span-12 md:col-span-7 space-y-0">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-5 border-b border-border/20 group">
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                    <CheckCircleIcon />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm uppercase tracking-wide">{b.label}</p>
                    <p className="section-label mt-0.5">{b.detail}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-border/40 group-hover:text-primary transition-colors shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
