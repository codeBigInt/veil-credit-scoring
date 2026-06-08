"use client"

const CreditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="16" height="11" rx="1.5"/>
    <path d="M1 8h16"/>
    <path d="M5 13h2M9 13h2"/>
  </svg>
)

const SwapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 14V4M5 4L2 7M5 4L8 7"/>
    <path d="M13 4v10m0 0l3-3m-3 3l-3-3"/>
  </svg>
)

const StakeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7"/>
    <path d="M9 5v4l3 3"/>
  </svg>
)

const YieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 12 6 7 10 10 16 4"/>
    <path d="M12 4h4v4"/>
  </svg>
)

const PayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7"/>
    <path d="M9 6v6M7 8h3.5a1.5 1.5 0 010 3H7"/>
  </svg>
)

const BridgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 11c2-4 12-4 14 0"/>
    <path d="M2 11v3M16 11v3"/>
    <path d="M5 11v3M9 11v3M13 11v3"/>
  </svg>
)

const CollateralIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2L3 5.5v4.5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5.5L9 2z"/>
  </svg>
)

const SoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7"/>
    <path d="M9 5v4l2 2"/>
  </svg>
)

export default function EcosystemSection() {
  const integrations = [
    { name: "Lending", icon: <CreditIcon />, status: "Available" },
    { name: "DEX", icon: <SwapIcon />, status: "Available" },
    { name: "Staking", icon: <StakeIcon />, status: "Available" },
    { name: "Yield Farm", icon: <YieldIcon />, status: "Available" },
    { name: "Payment", icon: <PayIcon />, status: "Beta" },
    { name: "Bridge", icon: <BridgeIcon />, status: "Beta" },
    { name: "Collateral", icon: <CollateralIcon />, status: "Beta" },
    { name: "Custom", icon: <SoonIcon />, status: "Coming Soon" },
  ]

  return (
    <section className="w-full py-24 bg-background border-t border-border/20">
      <div className="container mx-auto px-6 max-w-7xl">

        {/* Header — asymmetric */}
        <div className="grid grid-cols-12 gap-8 mb-16 items-end">
          <div className="col-span-12 md:col-span-7">
            <span className="section-label block mb-4">Cap. 05 · Integrations</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Plug Veil Into{" "}
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>Your Protocol</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-5 space-y-4">
            <p className="text-muted-foreground text-base leading-relaxed">
              Veil exposes a REST API any DeFi protocol can call to request verified credit decisions — no contract composability needed.
            </p>
            <div className="flex gap-3">
              <a href="https://veil-docs.vercel.app/api-integration-guide" target="_blank" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-xs no-underline">
                Integration Guide
              </a>
              <a href="https://veil-docs.vercel.app/api-integration-guide" target="_blank" className="inline-block border border-border/40 text-foreground px-5 py-2.5 rounded-sm font-medium hover:border-primary/60 transition-colors uppercase tracking-wide text-xs no-underline">
                API Docs
              </a>
            </div>
          </div>
        </div>

        {/* Integration table — horizontal rows */}
        <div className="border border-border/20 rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 px-6 py-3 border-b border-border/20 bg-card/20">
            <div className="col-span-1"><span className="section-label">#</span></div>
            <div className="col-span-5 md:col-span-4"><span className="section-label">Integration Type</span></div>
            <div className="col-span-3 md:col-span-4 hidden md:block"><span className="section-label">Use Case</span></div>
            <div className="col-span-6 md:col-span-3"><span className="section-label">Status</span></div>
          </div>

          {integrations.map((integration, i) => (
            <div
              key={i}
              className="grid grid-cols-12 px-6 py-4 border-b border-border/20 last:border-b-0 hover:bg-card/10 transition-colors items-center group"
            >
              <div className="col-span-1">
                <span className="section-label tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 flat-card rounded-sm flex items-center justify-center text-primary shrink-0">
                  {integration.icon}
                </div>
                <span className="font-bold text-foreground text-sm uppercase tracking-wide">{integration.name}</span>
              </div>
              <div className="col-span-4 hidden md:block">
                <span className="section-label">Credit band–based access control</span>
              </div>
              <div className="col-span-6 md:col-span-3 flex items-center justify-between">
                <span
                  className="section-label px-2 py-0.5 rounded-sm"
                  style={{
                    color: integration.status === 'Available' ? 'var(--color-primary)' : integration.status === 'Beta' ? 'oklch(0.75 0.15 60)' : 'oklch(0.5 0 0)',
                    background: integration.status === 'Available' ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'transparent',
                    border: '1px solid',
                    borderColor: integration.status === 'Available' ? 'color-mix(in oklch, var(--color-primary) 20%, transparent)' : 'transparent',
                  }}
                >
                  {integration.status}
                </span>
                <svg className="w-4 h-4 text-border/30 group-hover:text-primary transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
