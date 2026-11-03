"use client";

import { Armchair } from "lucide-react";
import { type ReactNode, useState } from "react";

import { PullCord } from "@/registry/components/pull-cord/pull-cord";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function Room({ lit }: { lit: boolean }) {
	return (
		<div
			data-lit={lit || undefined}
			className="group/room relative flex h-32 w-48 flex-col justify-end overflow-hidden rounded-xl border bg-card p-3 shadow-xs"
		>
			{/* A warm pool of light from above, and a shade that dims the room. */}
			<div className="absolute inset-0 bg-[radial-gradient(130px_100px_at_50%_0%,rgb(255_196_120/0.4),transparent)] opacity-0 transition-opacity duration-200 group-data-lit/room:opacity-100 motion-reduce:transition-none" />
			<div className="absolute inset-0 bg-foreground/[0.06] transition-opacity duration-200 group-data-lit/room:opacity-0 motion-reduce:transition-none dark:bg-black/40" />
			<Armchair
				aria-hidden
				className="relative mb-auto size-6 text-muted-foreground transition-colors duration-200 group-data-lit/room:text-amber-600 motion-reduce:transition-none dark:group-data-lit/room:text-amber-300"
				strokeWidth={1.5}
			/>
			<p className="relative font-medium text-foreground text-sm">
				Reading nook
			</p>
			<p className="relative text-muted-foreground text-xs">
				{lit ? "Lamp on" : "Lamp off"}
			</p>
		</div>
	);
}

function PullCordDemo() {
	const [lit, setLit] = useState(false);

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Controlled, lighting a room">
				<div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
					<PullCord
						label="Reading lamp"
						checked={lit}
						onCheckedChange={setLit}
					/>
					<Room lit={lit} />
				</div>
			</Section>

			<Section title="Sound off, on by default">
				<PullCord label="Hallway light" sound={false} defaultChecked />
			</Section>
		</div>
	);
}

export default PullCordDemo;
