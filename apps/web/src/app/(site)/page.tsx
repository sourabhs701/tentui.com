import type { Metadata } from "next";
import { ComponentsShowcase } from "./_components/components-showcase";
import { Hero } from "./_components/hero";
import LandingFaq from "./_components/landing-faq";

export const metadata: Metadata = {
	title: "React Components and Blocks for shadcn/ui",
	description:
		"Copy production-ready React components and landing-page blocks built for shadcn/ui, then customize the source for your app.",
	alternates: { canonical: "/" },
};

export default function Home() {
	return (
		<div className="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
			<Hero />
			<ComponentsShowcase />
			<LandingFaq />
			<div className="py-1.5" />
		</div>
	);
}
