"use client"

const previewCells = Array.from({ length: 24 }, (_, index) => ({
  opacity: 0.2 + (index % 6) * 0.08,
  borderColor: index % 2 === 0 ? 'hsl(266 92% 68% / 0.55)' : 'hsl(104 78% 48% / 0.45)',
  background: index % 3 === 0 ? 'hsl(266 92% 68% / 0.14)' : 'hsl(104 78% 48% / 0.13)',
}))

const compactId = (value: string, head = 18, tail = 12) =>
  value.length <= head + tail + 1 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`

const previewDid = 'did:veil:0xa805475eced7bea0fcb399fb386c9d3be595b38d439bbb842612e9ff2b217a52'
const previewSporeId = '0xaf21638b4c78670bb42c5bc6c113028ba8bad52da3b930c4edf02d80ccce53f4'
const previewVeilIdHash = '0xa805475eced7bea0fcb399fb386c9d3be595b38d439bbb842612e9ff2b217a52'

export default function FixRatesSection() {
  return (
    <section className="w-full flex items-center justify-center py-16 md:py-24 bg-card/10 relative border-y border-border/20">
      <div className="container px-6 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center justify-items-center">
          <div className="space-y-6 text-center md:text-left">
            <span className="section-label">Cap. 03 · Decentralized Identifier</span>
            <h2 className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
              Identity Pass
              <br />
              <span style={{ WebkitTextStroke: '2px var(--color-primary)', color: 'transparent' }}>DID You Control</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
              Veil mints your public CKB identity pass as a decentralized identifier: a stable DID that apps can resolve and verify without seeing your raw score. Your credit data stays private on Midnight, while supported protocols only check the public anchor.
            </p>
            <a href="/dashboard" target="_blank" className="inline-flex w-full md:w-auto items-center justify-center bg-primary text-primary-foreground px-6 py-3 rounded-sm font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-sm no-underline hover:no-underline">
              Mint Identity Pass
            </a>
          </div>

          <div className="w-full max-w-xl">
            <div className="overflow-hidden rounded-sm border border-primary/40 bg-card">
              <div className="grid gap-0 sm:grid-cols-[minmax(250px,0.85fr)_1fr]">
                <div
                  className="relative h-[34rem] max-h-[70vh] min-h-72 border-b border-border/20 p-5 sm:border-b-0 sm:border-r"
                  style={{
                    borderColor: 'color-mix(in oklch, var(--color-primary) 35%, var(--color-border))',
                    background: 'linear-gradient(135deg, hsl(91 75% 13%), oklch(0.1 0 0) 52%, hsl(266 78% 16%))',
                  }}
                >
                  <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-sm border border-white/15 bg-black/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-white/50 text-[8px]">✓</span>
                    ID Minted
                  </div>
                  <div className="grid h-full grid-cols-4 gap-2 pb-20 pt-14">
                    {previewCells.map((cell, index) => (
                      <div
                        key={index}
                        className="rounded-sm border"
                        style={{ opacity: cell.opacity, borderColor: cell.borderColor, background: cell.background }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-5 bottom-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">Veil ID</p>
                    <p className="mt-.5 text-2xl font-black uppercase tracking-tight text-white">Identity Pass</p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-label mb-1">Decentralized Identifier</p>
                      <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Veil ID</h3>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-sm border border-primary/30 bg-primary/5 px-4 py-3">
                      <p className="section-label mb-2">Your DID</p>
                      <p className="truncate text-xs font-black leading-relaxed text-primary" title={previewDid}>{compactId(previewDid, 22, 14)}</p>
                    </div>
                    <div className="rounded-sm border border-border/20 bg-background/70 px-4 py-3">
                      <p className="section-label mb-2">Record ID</p>
                      <p className="truncate text-xs leading-relaxed text-primary" title={previewSporeId}>{compactId(previewSporeId, 18, 14)}</p>
                    </div>
                    <div className="rounded-sm border border-border/20 bg-background/70 px-4 py-3">
                      <p className="section-label mb-2">ID Hash</p>
                      <p className="truncate text-xs leading-relaxed text-foreground/60" title={previewVeilIdHash}>{compactId(previewVeilIdHash, 18, 14)}</p>
                    </div>
                  </div>

                  <a href="/dashboard" target="_blank" className="inline-flex w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 no-underline hover:no-underline">
                    Open Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
