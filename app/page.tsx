import { LandingNavbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { VenueShowcase } from "@/components/landing/venue-showcase"
import { PricingSection } from "@/components/landing/pricing-section"
import { SocialProof } from "@/components/landing/social-proof"
import { Footer } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <HowItWorks />
        <VenueShowcase />
        <PricingSection />
        <SocialProof />
      </main>
      <Footer />
    </div>
  )
}
