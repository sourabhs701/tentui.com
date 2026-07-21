import { Suspense } from "react";

import Testimonials01 from "@/registry/blocks/testimonials-01/testimonials-01";

import { Hero } from "./_components/hero";

export default function Home() {
	return (
		<div className="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
			<Hero />
			<Suspense fallback={null}>
				<Testimonials01 description="Here’s what some of our users have to say about Tent UI." />
			</Suspense>
			<div className="py-1.5" />
		</div>
	);
}
