"use client"

export default function EcosystemSection() {
  const integrations = [
    { name: "Lending Protocol", icon: "💳" },
    { name: "DEX", icon: "⚡" },
    { name: "Staking", icon: "📊" },
    { name: "Yield Farm", icon: "🌾" },
    { name: "Payment", icon: "💸" },
    { name: "Bridge", icon: "🌉" },
    { name: "Collateral", icon: "🔐" },
    { name: "Coming Soon...", icon: "🚀" },
  ]

  return (
    <section className="w-full py-24 bg-linear-to-b from-background to-slate-950/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold">
            Integrate <span className="text-primary">Veil</span> Into Your Protocol
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veil provides Witness API calls that seamlessly integrate with DeFi protocols on Midnight, enabling credit
            score verification without identity disclosure.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg hover:shadow-primary/50">
              Integration Guide
            </button>
            <button className="border border-foreground/20 text-foreground px-6 py-3 rounded-lg font-medium hover:bg-muted/50 transition-colors">
              API Docs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {integrations.map((integration, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all hover:bg-card/80"
            >
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg hover:from-primary/30 transition-all">
                <span className="text-3xl">{integration.icon}</span>
              </div>
              <p className="font-medium text-center text-sm">{integration.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
