import type { Metadata } from "next";
import { components } from "@/lib/components";
import { faqPageJsonLd } from "@/lib/faq";
import { absoluteUrl, JsonLdScript, libraryJsonLd } from "@/lib/json-ld";
import blocks from "@/registry/__blocks__.json";
import { ComponentsShowcase } from "./_components/components-showcase";
import { Hero } from "./_components/hero";
import LandingFaq from "./_components/landing-faq";
import { getLandingFaqItems } from "./_components/landing-faq-items";
import { LandingQuickstart } from "./_components/landing-quickstart";
import { LandingTestimonials } from "./_components/landing-testimonials";

export const metadata: Metadata = {
	title: "Animated React Components and Blocks for shadcn/ui",
	description:
		"Free, source-available animated React components and landing-page blocks for shadcn/ui and Tailwind CSS. Install them with the shadcn CLI and own the source.",
	alternates: { canonical: "/" },
};

const counts = { componentCount: components.length, blockCount: blocks.length };
const faqItems = getLandingFaqItems(counts);

export default function Home() {
	return (
		<div className="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
			<JsonLdScript data={libraryJsonLd()} />
			<JsonLdScript
				data={faqPageJsonLd(
					faqItems.map(({ question, answer }) => ({ question, answer })),
					absoluteUrl("/"),
				)}
			/>
			<Hero blockCount={counts.blockCount} />
			<ComponentsShowcase />
			<LandingQuickstart {...counts} />
			<LandingTestimonials />
			<LandingFaq items={faqItems} />
			<div className="py-1.5" />
		</div>
	);
}
