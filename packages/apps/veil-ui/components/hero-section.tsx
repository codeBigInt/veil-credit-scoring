"use client"

export default function HeroSection() {
  const chains = ['ETHEREUM', 'SOLANA', 'CKB', 'MIDNIGHT', 'POLYGON', 'ARBITRUM', 'BASE', 'AVALANCHE', 'OPTIMISM', 'ANY CHAIN']
  const ticker = [...chains, ...chains]

  return (
    <section className="hero-grid-shell w-full bg-background relative overflow-hidden">
      <div className="hero-grid-lines" aria-hidden="true" />
      <div className="hero-scanline" aria-hidden="true" />

      {/* Main hero content */}
      <div className="container relative z-10 mx-auto px-6 max-w-7xl pt-20 md:pt-36 pb-16">
        {/* Section label */}
        <p className="section-label mb-8">Cross-Chain Credit Protocol</p>

        {/* Main heading — full width, massive */}
        <div className="mb-10">
          <h1
            className="font-black uppercase leading-none tracking-tight text-foreground"
            style={{ fontSize: 'clamp(3.8rem, 10.5vw, 8.5rem)' }}
          >
            Cross-Chain
          </h1>
          <h1
            className="font-black uppercase leading-none tracking-tight"
            style={{
              fontSize: 'clamp(3.8rem, 10.5vw, 8.5rem)',
              WebkitTextStroke: '3px var(--color-primary)',
              color: 'transparent',
            }}
          >
            Credit Score.
          </h1>
        </div>

        {/* Three-column stat strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/20 mb-14 max-w-3xl">
          <div className="flat-card px-6 py-5">
            <p className="section-label mb-1">Privacy Layer</p>
            <p className="font-black uppercase text-foreground text-base">Midnight ZK Proofs</p>
          </div>
          <div className="flat-card px-6 py-5">
            <p className="section-label mb-1">Identity Anchor</p>
            <p className="font-black uppercase text-foreground text-base">CKB Spore DOB</p>
          </div>
          <div className="flat-card px-6 py-5">
            <p className="section-label mb-1">Open to</p>
            <p className="font-black uppercase text-primary text-base">Any Protocol</p>
          </div>
        </div>

        {/* Description + CTAs */}
        <div className="max-w-2xl">
          {/* <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Your on-chain history from Ethereum, Solana, CKB, or any chain builds a private credit score — verified by Midnight ZK proofs, anchored as a Spore DOB on CKB. Any DeFi protocol on any chain can consume it. No identity disclosed.
          </p> */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/dashboard"
              className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-widest text-sm text-center"
            >
              Launch Protocol
            </a>
            <a
              href="https://veil-docs.vercel.app/introduction"
              target="_blank"
              className="inline-block border border-border/40 text-foreground px-8 py-4 rounded-sm font-medium hover:border-primary/60 transition-colors uppercase tracking-widest text-sm text-center no-underline"
            >
              Read Docs
            </a>
          </div>
        </div>
      </div>

      {/* Chain ticker strip */}
      <div className="chain-ticker-wrap py-3">
        <div className="chain-ticker gap-0">
          {ticker.map((chain, i) => (
            <span key={i} className="inline-flex items-center gap-5 px-5">
              <span className="section-label" style={{ color: 'var(--color-primary)', letterSpacing: '0.2em' }}>{chain}</span>
              <span className="ticker-dot" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
