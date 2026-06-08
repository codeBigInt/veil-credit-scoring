import Header from "@/components/header"
import HeroSection from "@/components/hero-section"
import TradeYieldSection from "@/components/trade-yield-section"
import FixRatesSection from "@/components/fix-rates-section"
import EarnMoreSection from "@/components/earn-more-section"
import UseCasesSection from "@/components/use-cases-section"
import EcosystemSection from "@/components/ecosystem-section"
import BuildSection from "@/components/build-section"
import Footer from "@/components/footer"
import ScrollReveal from "@/components/scroll-reveal"

export default function Home() {
  return (
    <main className="w-full">
      <Header />
      <HeroSection />
      <ScrollReveal variant="left">
        <TradeYieldSection />
      </ScrollReveal>
      <ScrollReveal variant="right">
        <FixRatesSection />
      </ScrollReveal>
      <ScrollReveal>
        <EarnMoreSection />
      </ScrollReveal>
      <ScrollReveal variant="left">
        <UseCasesSection />
      </ScrollReveal>
      <ScrollReveal>
        <EcosystemSection />
      </ScrollReveal>
      <ScrollReveal variant="right">
        <BuildSection />
      </ScrollReveal>
      <Footer />
    </main>
  )
}
