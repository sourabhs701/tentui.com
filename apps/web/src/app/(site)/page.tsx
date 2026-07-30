import type { Metadata } from "next";
import { Hero } from "./_components/hero";

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
			<div className="py-1.5" />
		</div>
	);
}
