"use client"

export default function UseCasesSection() {
  const useCases = [
    {
      title: "Lending Protocols",
      description:
        "Assess borrower creditworthiness and adjust lending parameters based on anonymous credit scores without identity disclosure.",
      icon: "💰",
    },
    {
      title: "Stablecoin Systems",
      description:
        "Verify collateral provider trustworthiness while maintaining user privacy in collateralized stablecoin protocols.",
      icon: "📌",
    },
    {
      title: "DEX & Yield",
      description:
        "Enable tiered access and better pricing for high-trust users while preserving complete privacy on Midnight.",
      icon: "⚡",
    },
    {
      title: "Payment Protocols",
      description:
        "Reduce fraud risk in payment channels by verifying user creditworthiness without revealing transaction history.",
      icon: "✅",
    },
  ]

  return (
    <section className="w-full py-24 bg-slate-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Built for Privacy-First DeFi</h2>
          <p className="text-xl text-white/60">
            <span className="text-primary">Veil</span> solves the privacy paradox—trust without identity disclosure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((useCase, i) => (
            <div
              key={i}
              className="bg-linear-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-8 space-y-4 hover:border-primary/50 transition-all duration-300 hover:bg-slate-900/60"
            >
              {/* Icon */}
              <div className="text-4xl">{useCase.icon}</div>

              {/* Title and Description */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold">{useCase.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{useCase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
