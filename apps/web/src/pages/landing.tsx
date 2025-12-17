import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { PricingSection } from "@/components/landing/pricing-section";
import { CTASection } from "@/components/landing/cta-section";

export function LandingPage() {
	return (
		<>
			<Hero />
			<Features />
			<PricingSection />
			<CTASection />
		</>
	);
}
