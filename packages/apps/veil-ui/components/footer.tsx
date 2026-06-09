"use client"

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)

const DiscordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
  </svg>
)

const TelegramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

const ArrowUpRightIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 8L8 2M8 2H3M8 2v5"/>
  </svg>
)

export default function Footer() {
  return (
    <footer className="w-full bg-background border-t border-border/30">
      <div className="container mx-auto px-6 max-w-7xl">

        {/* Main footer grid */}
        <div className="grid grid-cols-12 gap-8 py-16 border-b border-border/20">

          {/* Brand block — spans 4 cols */}
          <div className="col-span-12 md:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              <img src="/veil-cred-logo.PNG" alt="Veil Protocol" className="h-8 w-8 object-contain" />
              <span className="font-black text-sm tracking-widest uppercase text-foreground">Veil Protocol</span>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Cross-chain credit scoring. Privacy enforced by Midnight ZK proofs. Identity anchored as a Spore DOB on CKB.
            </p>

            {/* Chain badges */}
            <div className="flex flex-wrap gap-2">
              {['Midnight', 'Ethereum', 'Solana', 'CKB'].map((c) => (
                <span key={c} className="section-label px-2 py-1 flat-card rounded-sm" style={{ color: 'var(--color-primary)' }}>
                  {c}
                </span>
              ))}
            </div>

            {/* Social icons */}
            <div className="flex gap-2">
              <a href="#" className="w-8 h-8 flat-card rounded-sm flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
                <XIcon />
              </a>
              <a href="https://github.com/codeBigInt/veil-credit-scoring/tree/dev" className="w-8 h-8 flat-card rounded-sm flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub">
                <GithubIcon />
              </a>
              <a href="#" className="w-8 h-8 flat-card rounded-sm flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label="Discord">
                <DiscordIcon />
              </a>
              <a href="#" className="w-8 h-8 flat-card rounded-sm flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label="Telegram">
                <TelegramIcon />
              </a>
            </div>
          </div>

          {/* Link columns — span 8 cols across 3 groups */}
          <div className="col-span-12 md:col-span-8 grid grid-cols-3 gap-8">

            {/* Protocol */}
            <div className="space-y-5">
              <p className="section-label text-foreground" style={{ color: 'oklch(0.7 0 0)' }}>Protocol</p>
              <div className="space-y-3">
                {[
                  { label: 'Architecture', href: 'https://docs-veil-credit-scoring.netlify.app/docs/concepts' },
                  { label: 'Smart Contract', href: 'https://github.com/codeBigInt/veil-credit-scoring/tree/dev/packages/contract' },
                  { label: 'Security', href: 'https://docs-veil-credit-scoring.netlify.app/docs/introduction' },
                  { label: 'Roadmap', href: '#' },
                ].map((link) => (
                  <a key={link.label} href={link.href} target="_blank" className="flex items-center gap-1.5 section-label hover:text-primary transition-colors group">
                    {link.label}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUpRightIcon /></span>
                  </a>
                ))}
              </div>
            </div>

            {/* Developers */}
            <div className="space-y-5">
              <p className="section-label text-foreground" style={{ color: 'oklch(0.7 0 0)' }}>Developers</p>
              <div className="space-y-3">
                {[
                  { label: 'API Guide', href: 'https://docs-veil-credit-scoring.netlify.app/docs/integration/api-reference' },
                  { label: 'Integration', href: 'https://docs-veil-credit-scoring.netlify.app/docs/integration' },
                  { label: 'Whitepaper', href: 'https://docs-veil-credit-scoring.netlify.app/docs/introduction' },
                  { label: 'GitHub', href: 'https://github.com/codeBigInt/veil-credit-scoring/tree/dev' },
                ].map((link) => (
                  <a key={link.label} href={link.href} target="_blank" className="flex items-center gap-1.5 section-label hover:text-primary transition-colors group">
                    {link.label}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUpRightIcon /></span>
                  </a>
                ))}
              </div>
            </div>

            {/* Community */}
            <div className="space-y-5">
              <p className="section-label text-foreground" style={{ color: 'oklch(0.7 0 0)' }}>Community</p>
              <div className="space-y-3">
                {[
                  { label: 'Twitter', href: '#' },
                  { label: 'Discord', href: '#' },
                  { label: 'Telegram', href: '#' },
                  { label: 'Newsletter', href: '#' },
                ].map((link) => (
                  <a key={link.label} href={link.href} className="flex items-center gap-1.5 section-label hover:text-primary transition-colors group">
                    {link.label}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUpRightIcon /></span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="section-label">© 2025 Veil Protocol — All rights reserved</span>
          <span className="section-label" style={{ letterSpacing: '0.25em' }}>Privacy · By · Default · On · Midnight</span>
        </div>
      </div>
    </footer>
  )
}
