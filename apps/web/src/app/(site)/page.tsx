import { Hero } from "./_components/hero";

export default function Home() {
	return (
		<div className="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
			<Hero />
			<div className="py-1.5" />
		</div>
	);
}
