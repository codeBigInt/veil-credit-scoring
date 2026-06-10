"use client"

const BarChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="11" width="3.5" height="7" rx="0.5"/>
    <rect x="8.25" y="7" width="3.5" height="11" rx="0.5"/>
    <rect x="14.5" y="3" width="3.5" height="15" rx="0.5"/>
  </svg>
)

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L3.5 5v5.5c0 4 2.8 7.7 6.5 8.5 3.7-.8 6.5-4.5 6.5-8.5V5L10 2z"/>
    <path d="M7 10l2 2 4-4"/>
  </svg>
)

const ArrowSwapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13V5M5 5L2 8M5 5L8 8"/>
    <path d="M15 7v8m0 0l-3-3m3 3l3-3"/>
  </svg>
)

const ChainLinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 11.5a4.24 4.24 0 006 0l2-2a4.243 4.243 0 00-6-6l-1 1"/>
    <path d="M11.5 8.5a4.24 4.24 0 00-6 0l-2 2a4.243 4.243 0 006 6l1-1"/>
  </svg>
)

export default function UseCasesSection() {
  const useCases = [
    {
      number: "01",
      title: "Lending Apps",
      description: "Lending apps can use Veil to offer better rates and limits based on a private credit band, without seeing the user's raw score.",
      icon: <BarChartIcon />,
      tag: "Ethereum · Solana · CKB"
    },
    {
      number: "02",
      title: "Stablecoin Systems",
      description: "Check whether a user is trusted enough to provide collateral, without asking for KYC or exposing their wallet history.",
      icon: <ShieldIcon />,
      tag: "Any EVM · Midnight"
    },
    {
      number: "03",
      title: "DEX & Yield Apps",
      description: "Give better fees and APYs to high-credit users without linking their activity across chains.",
      icon: <ArrowSwapIcon />,
      tag: "Midnight · Ethereum"
    },
    {
      number: "04",
      title: "Cross-Chain Bridges",
      description: "Reduce fraud on large transfers by checking a user's credit band without exposing their wallet data.",
      icon: <ChainLinkIcon />,
      tag: "Multi-chain"
    },
  ]

  return (
    <section className="w-full py-24 bg-background/80 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-7xl">

        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-border/20 mb-0">
          <div>
            <span className="section-label mb-3 block">Cap. 02 · Use Cases</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Built for Any App
            </h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-xs md:text-right">
            One API. Any supported chain. Any DeFi app.
          </p>
        </div>

        {/* Editorial numbered list */}
        {useCases.map((uc, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-4 md:gap-8 py-8 border-b border-border/20 group hover:bg-card/5 transition-colors -mx-6 px-6"
          >
            {/* Number */}
            <div className="col-span-2 md:col-span-1 flex items-start pt-1">
              <span className="font-black text-2xl tabular-nums" style={{ color: 'oklch(0.28 0 0)' }}>{uc.number}</span>
            </div>

            {/* Icon + Title */}
            <div className="col-span-10 md:col-span-3 space-y-3">
              <div className="w-9 h-9 flat-card rounded-sm flex items-center justify-center text-primary">
                {uc.icon}
              </div>
              <h3 className="font-black uppercase tracking-tight text-base text-foreground leading-tight">{uc.title}</h3>
              <span className="section-label" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>{uc.tag}</span>
            </div>

            {/* Description */}
            <div className="col-span-12 md:col-span-7 md:col-start-6 flex items-center">
              <p className="text-muted-foreground text-base leading-relaxed">{uc.description}</p>
            </div>

            {/* Arrow indicator */}
            <div className="hidden md:flex col-span-1 items-center justify-end">
              <svg className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
