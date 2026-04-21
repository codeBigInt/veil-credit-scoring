import Header from "@/components/header"
import HeroSection from "@/components/hero-section"
import TradeYieldSection from "@/components/trade-yield-section"
import FixRatesSection from "@/components/fix-rates-section"
import EarnMoreSection from "@/components/earn-more-section"
import UseCasesSection from "@/components/use-cases-section"
import EcosystemSection from "@/components/ecosystem-section"
import BuildSection from "@/components/build-section"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <main className="w-full">
      <Header />
      <HeroSection />
      <TradeYieldSection />
      <FixRatesSection />
      <EarnMoreSection />
      <UseCasesSection />
      <EcosystemSection />
      <BuildSection />
      <Footer />
    </main>
  )
}
