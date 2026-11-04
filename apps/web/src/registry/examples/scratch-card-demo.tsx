"use client";

import { type ReactNode, useRef, useState } from "react";

import {
	ScratchCard,
	type ScratchCardHandle,
} from "@/registry/components/scratch-card/scratch-card";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function Prize({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="flex flex-col items-center gap-1 px-6 text-center">
			<p className="font-semibold text-base text-foreground tracking-tight">
				{title}
			</p>
			<p className="text-muted-foreground text-xs">{detail}</p>
		</div>
	);
}

function ScratchCardDemo() {
	const card = useRef<ScratchCardHandle>(null);
	const [reveals, setReveals] = useState(0);
	const [progress, setProgress] = useState(0);

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Silver">
				<ScratchCard aria-label="Silver scratch card" className="max-w-[280px]">
					<Prize
						title="You found it"
						detail="A little something, just for you."
					/>
				</ScratchCard>
			</Section>

			<Section title="Gold, with a prize">
				<ScratchCard
					foil="gold"
					hint="Scratch to win"
					aria-label="Gold scratch card"
					className="max-w-[280px]"
				>
					<div className="flex flex-col items-center gap-0.5 text-center">
						<p className="font-semibold text-[11px] text-amber-700 uppercase tracking-[0.16em] dark:text-amber-300">
							You won
						</p>
						<p className="font-semibold text-3xl text-foreground tabular-nums tracking-tight">
							20% off
						</p>
						<p className="text-muted-foreground text-xs">
							Code <span className="font-mono text-foreground">TENT20</span>
						</p>
					</div>
				</ScratchCard>
			</Section>

			<Section title="Graphite, sound off">
				<ScratchCard
					foil="graphite"
					sound={false}
					aria-label="Graphite scratch card"
					className="max-w-[280px]"
				>
					<Prize title="Free shipping" detail="On your next order." />
				</ScratchCard>
			</Section>

			<Section title="Controlled, counting reveals">
				<ScratchCard
					ref={card}
					aria-label="Reusable scratch card"
					className="max-w-[280px]"
					onProgress={setProgress}
					onReveal={() => setReveals((count) => count + 1)}
				>
					<Prize
						title={`Reveal #${reveals}`}
						detail="Reset it and scratch again."
					/>
				</ScratchCard>
				<div className="flex items-center gap-3">
					<p className="text-muted-foreground text-xs tabular-nums">
						{Math.round(progress * 100)}% cleared · {reveals}{" "}
						{reveals === 1 ? "reveal" : "reveals"}
					</p>
					<button
						type="button"
						onClick={() => card.current?.reset()}
						className="h-7 rounded-md border bg-background px-2.5 font-medium text-foreground text-xs shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						Reset
					</button>
				</div>
			</Section>
		</div>
	);
}

export default ScratchCardDemo;
