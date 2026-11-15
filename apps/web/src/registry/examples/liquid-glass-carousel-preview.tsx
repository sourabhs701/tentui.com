"use client";

import {
	LiquidGlassCarousel,
	LiquidGlassCarouselSlide,
} from "@/registry/components/liquid-glass-carousel/liquid-glass-carousel";

/** A mat around an off-white card, like a print in a capsule frame. Pale in light, graphite in dark. */
function PrintCard({
	children,
	dark,
}: {
	children: React.ReactNode;
	dark?: boolean;
}) {
	return (
		<div className="flex size-full items-center justify-center bg-[#e8e8ea] px-[9%] dark:bg-[#232325]">
			<div
				className={
					dark
						? "relative flex aspect-[0.92] w-full flex-col justify-between rounded-[14%] bg-[#111] p-[9%] text-[#f2f2f0]"
						: "relative flex aspect-[0.92] w-full flex-col justify-between rounded-[10%] bg-[#f4f3ef] p-[9%] text-[#141414]"
				}
			>
				{children}
			</div>
		</div>
	);
}

function FineLines({ dark }: { dark?: boolean }) {
	const tone = dark ? "bg-white/25" : "bg-black/25";
	return (
		<div className="space-y-[3px]">
			<div className={`h-px w-full ${tone}`} />
			<div className={`h-[2px] w-1/3 rounded-full ${tone}`} />
			<div className={`h-[2px] w-1/2 rounded-full ${tone}`} />
		</div>
	);
}

export const slides = [
	{
		label: "Cosmos, a blue study",
		art: (
			<div className="relative size-full bg-[#1764f4]">
				<div className="absolute inset-x-[-20%] top-[38%] h-[90%] rounded-[50%] bg-[#0b2fa8]" />
				<div className="absolute top-[18%] left-[22%] size-[46%] rounded-full bg-[#0a1d6b]" />
				<div className="absolute top-[22%] right-[14%] h-[10%] w-[30%] rounded-full bg-[#59b7ff]" />
				<div className="absolute right-0 bottom-0 left-0 h-[30%] bg-linear-to-b from-transparent to-[#06124a]/70" />
			</div>
		),
	},
	{
		label: "Number 03",
		art: (
			<PrintCard>
				<div className="h-px w-1/3 bg-black/25" />
				<div className="relative font-normal text-[2.6rem] leading-none tracking-[-0.06em]">
					03
					<span className="absolute top-[0.05em] -right-[0.05em] flex flex-col gap-[3px]">
						<span className="size-[0.24em] rounded-full bg-[#2f45ff]" />
						<span className="size-[0.24em] rounded-full bg-[#2f45ff]" />
					</span>
				</div>
				<FineLines />
			</PrintCard>
		),
	},
	{
		label: "Orbit, a burnt orange study",
		art: (
			<div className="relative size-full bg-linear-to-b from-[#d0703f] to-[#a2421f]">
				<div className="absolute top-[24%] left-[-6%] size-[86%] rounded-full bg-[#170d0a]" />
				<div className="absolute top-[40%] right-[8%] h-[9%] w-[52%] rounded-full bg-linear-to-r from-[#ffcf7a] via-[#ff8a3d] to-[#f4f0e8]" />
				<div className="absolute right-[-10%] bottom-[-14%] left-[10%] h-[40%] rounded-[50%] bg-[#1d110d]" />
			</div>
		),
	},
	{
		label: "Nö 02",
		art: (
			<PrintCard dark>
				<div className="font-normal text-[2.15rem] leading-[0.92] tracking-[-0.05em]">
					Nö
					<br />
					<span className="pl-[0.55em]">02</span>
				</div>
				<FineLines dark />
			</PrintCard>
		),
	},
	{
		label: "Nova, a silver study",
		art: (
			<div className="relative size-full bg-linear-to-b from-[#d9d9d9] to-[#8d8d8d]">
				<div className="absolute top-[16%] left-[20%] size-[60%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fafafa,#9a9a9a_55%,#3b3b3b)]" />
				<div className="absolute right-[-15%] bottom-[-10%] left-[-15%] h-[38%] rounded-[50%] bg-[#2b2b2b]" />
			</div>
		),
	},
	{
		label: "Light, 光",
		art: (
			<div className="relative flex size-full items-center justify-center bg-[#ee3a1f]">
				<span className="font-medium text-[#3a0b04] text-[3.2rem] leading-none">
					光
				</span>
				<span className="absolute top-[16%] right-[16%] size-[22%] overflow-hidden rounded-full bg-[#f6efe6]">
					<span className="absolute inset-x-0 bottom-0 h-1/2 bg-[#1a0d0a]" />
				</span>
			</div>
		),
	},
];

// Inset 8px, the same as the pause glyph, so the right column lines up.
const CORNERS = [
	{ label: "Cosmos", className: "top-0 left-2" },
	{ label: "Orbit", className: "top-0 right-2" },
	{ label: "Nova", className: "bottom-0 left-2" },
	{ label: "Light", className: "bottom-0 right-2" },
];

export function LiquidGlassCarouselPreview() {
	return (
		<div className="relative w-full max-w-[320px]">
			{CORNERS.map((corner) => (
				<span
					key={corner.label}
					aria-hidden
					className={`pointer-events-none absolute font-medium text-[10px] text-muted-foreground uppercase leading-none tracking-[0.14em] ${corner.className}`}
				>
					{corner.label}
				</span>
			))}
			<LiquidGlassCarousel
				aria-label="Studies"
				autoplay={2200}
				slideSize={{ width: 116, height: 160 }}
				gap={14}
			>
				{slides.map((slide) => (
					<LiquidGlassCarouselSlide key={slide.label} aria-label={slide.label}>
						{slide.art}
					</LiquidGlassCarouselSlide>
				))}
			</LiquidGlassCarousel>
		</div>
	);
}

export default LiquidGlassCarouselPreview;
