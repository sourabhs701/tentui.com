"use client";

import type { ReactNode } from "react";

import {
	LiquidGlassCarousel,
	LiquidGlassCarouselControls,
	LiquidGlassCarouselSlide,
} from "@/registry/components/liquid-glass-carousel/liquid-glass-carousel";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-3">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

const SWATCHES = [
	{
		name: "Tide",
		className: "bg-[#1764f4] text-[#cfe3ff]",
		shape: "rounded-full bg-[#0b2fa8]",
	},
	{
		name: "Ember",
		className: "bg-[#d0703f] text-[#2a120a]",
		shape: "rounded-[30%] bg-[#170d0a]",
	},
	{
		name: "Chalk",
		className: "bg-[#ecebe6] text-[#141414]",
		shape: "rounded-full bg-[#2f45ff]",
	},
	{
		name: "Signal",
		className: "bg-[#ee3a1f] text-[#3a0b04]",
		shape: "rounded-full bg-[#f6efe6]",
	},
	{
		name: "Ink",
		className: "bg-[#141414] text-[#f2f2f0]",
		shape: "rounded-[30%] bg-[#3d3d3d]",
	},
	{
		name: "Moss",
		className: "bg-[#3f7a4f] text-[#dff2df]",
		shape: "rounded-full bg-[#1d3b26]",
	},
];

function Swatch({
	index,
	horizontal,
}: {
	index: number;
	horizontal?: boolean;
}) {
	const swatch = SWATCHES[index % SWATCHES.length];
	return (
		<div
			className={`relative flex size-full flex-col justify-between p-[16%] ${swatch.className}`}
		>
			<span className="font-medium text-[10px] uppercase tracking-[0.18em]">
				{swatch.name}
			</span>
			<span
				aria-hidden
				className={`absolute size-[38%] ${horizontal ? "top-[18%] right-[14%]" : "top-[30%] right-[18%]"} ${swatch.shape}`}
			/>
			<span className="font-normal text-[2.4rem] leading-none tracking-[-0.06em]">
				{String(index + 1).padStart(2, "0")}
			</span>
		</div>
	);
}

export function LiquidGlassCarouselDemo() {
	return (
		<div className="flex w-full max-w-sm flex-col items-center gap-12 py-6">
			<Section title="Drag or swipe">
				<LiquidGlassCarousel
					aria-label="Swatches"
					slideSize={{ width: 120, height: 166 }}
					gap={14}
					className="gap-2"
				>
					{SWATCHES.map((swatch, index) => (
						<LiquidGlassCarouselSlide
							key={swatch.name}
							aria-label={swatch.name}
						>
							<Swatch index={index} />
						</LiquidGlassCarouselSlide>
					))}
					<LiquidGlassCarouselControls />
				</LiquidGlassCarousel>
			</Section>

			<Section title="Horizontal">
				<LiquidGlassCarousel
					aria-label="Swatches, side by side"
					orientation="horizontal"
					slideSize={{ width: 168, height: 112 }}
					gap={14}
					defaultIndex={2}
					className="gap-2"
				>
					{SWATCHES.map((swatch, index) => (
						<LiquidGlassCarouselSlide
							key={swatch.name}
							aria-label={swatch.name}
						>
							<Swatch index={index} horizontal />
						</LiquidGlassCarouselSlide>
					))}
					<LiquidGlassCarouselControls />
				</LiquidGlassCarousel>
			</Section>

			<Section title="Melt off, sound off">
				<LiquidGlassCarousel
					aria-label="Swatches, no melt"
					melt="off"
					sound={false}
					slideSize={{ width: 120, height: 166 }}
					gap={14}
					defaultIndex={3}
				>
					{SWATCHES.map((swatch, index) => (
						<LiquidGlassCarouselSlide
							key={swatch.name}
							aria-label={swatch.name}
						>
							<Swatch index={index} />
						</LiquidGlassCarouselSlide>
					))}
				</LiquidGlassCarousel>
			</Section>
		</div>
	);
}

export default LiquidGlassCarouselDemo;
