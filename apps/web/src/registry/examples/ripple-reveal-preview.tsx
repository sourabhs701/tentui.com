"use client";

import {
	RippleReveal,
	RippleRevealSurface,
	RippleRevealTrigger,
} from "@/registry/components/ripple-reveal/ripple-reveal";

// A month of closing balances, 0 to 1.
const HISTORY = [
	0.16, 0.22, 0.19, 0.3, 0.27, 0.35, 0.33, 0.41, 0.38, 0.45, 0.43, 0.49, 0.47,
	0.55, 0.51, 0.53, 0.6, 0.57, 0.64, 0.61, 0.66, 0.71, 0.68, 0.76, 0.73, 0.8,
	0.84, 0.82,
];
const LINE = HISTORY.map(
	(value, index) =>
		`${index ? "L" : "M"}${((index / (HISTORY.length - 1)) * 340).toFixed(1)} ${(78 - value * 62).toFixed(1)}`,
).join("");
const AREA = `${LINE}L340 84L0 84Z`;

function Sparkline({ id, className }: { id: string; className?: string }) {
	return (
		<svg
			aria-hidden
			viewBox="0 0 340 84"
			preserveAspectRatio="none"
			className={className}
		>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#4ade80" stopOpacity={0.22} />
					<stop offset="1" stopColor="#4ade80" stopOpacity={0} />
				</linearGradient>
			</defs>
			<path d={AREA} fill={`url(#${id})`} />
			<path
				d={LINE}
				fill="none"
				stroke="#4ade80"
				strokeWidth={1.5}
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function TrendIcon() {
	return (
		<svg
			aria-hidden
			width={14}
			height={14}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 17L9 11L13 15L21 7M15 7H21V13" />
		</svg>
	);
}

function RippleRevealPreview() {
	return (
		<RippleReveal className="relative w-full max-w-[340px]">
			<RippleRevealSurface
				hiddenLabel="Balance hidden"
				className="grid h-52 w-full rounded-[22px] shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)] [--ripple-reveal-highlight:0.5] [--ripple-reveal-shade:0.3] dark:shadow-none dark:ring-1 dark:ring-white/6 dark:[--ripple-reveal-highlight:0.45] dark:[--ripple-reveal-shade:0.35]"
				placeholder={
					<div className="relative h-full overflow-hidden rounded-[inherit] bg-[linear-gradient(170deg,#2a2b2e,#1d1e21_55%,#151517)] px-5 pt-[52px]">
						{/* Smoked glass: a faint sheen along the top edge. */}
						<div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgb(255_255_255/0.07),transparent)]" />
						<div className="flex h-10 items-center gap-2">
							{["a", "b", "c", "d", "e"].map((key) => (
								<span key={key} className="size-2.5 rounded-full bg-white/30" />
							))}
						</div>
						<div className="mt-0.5 flex h-5 items-center gap-1">
							{["a", "b", "c"].map((key) => (
								<span key={key} className="size-1 rounded-full bg-white/25" />
							))}
						</div>
						<p className="absolute inset-x-0 top-[54%] text-center font-semibold text-[40px] text-white/5 tracking-tight">
							tentui
						</p>
						<Sparkline
							id="ripple-reveal-preview-stub"
							className="absolute inset-x-0 bottom-0 h-[84px] w-full opacity-50 [mask-image:linear-gradient(to_right,#000_10%,transparent_21%)]"
						/>
					</div>
				}
			>
				<div className="relative h-full overflow-hidden rounded-[inherit] bg-[radial-gradient(130%_100%_at_78%_0%,#227a35,#13451f_42%,#0c1a10_72%,#09090a)] px-5 pt-[52px]">
					<p className="font-semibold text-[34px] text-white tabular-nums leading-10 tracking-tight">
						$24,618.90
					</p>
					<p className="mt-0.5 font-medium text-[#5ee07c] text-[13px] tabular-nums leading-5">
						+$312.44 (1.28%) today
					</p>
					<Sparkline
						id="ripple-reveal-preview-line"
						className="absolute inset-x-0 bottom-0 h-[84px] w-full"
					/>
				</div>
			</RippleRevealSurface>

			{/* The label and the eye stay put while the faces change underneath. */}
			<div className="absolute inset-x-0 top-0 flex h-[52px] items-center justify-between pr-3 pl-5">
				<p className="flex items-center gap-1.5 font-medium text-[13px] text-white/75">
					<TrendIcon />
					Total assets
				</p>
				<RippleRevealTrigger
					label="Show balance"
					className="bg-white/10 text-white/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] backdrop-blur-md hover:bg-white/16 hover:text-white"
				/>
			</div>
		</RippleReveal>
	);
}

export default RippleRevealPreview;
