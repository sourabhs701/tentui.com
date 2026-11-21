"use client";

import {
	ArrowUpRightIcon,
	CheckIcon,
	CopyIcon,
	FileCode2Icon,
	GitPullRequestIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import {
	HoverPeekCard,
	HoverPeekCardContent,
	HoverPeekCardDescription,
	HoverPeekCardFooter,
	HoverPeekCardGroup,
	HoverPeekCardHeader,
	HoverPeekCardMedia,
	HoverPeekCardMeta,
	type HoverPeekCardSide,
	HoverPeekCardTitle,
	HoverPeekCardTrigger,
	type HoverPeekCardVariant,
} from "@/registry/components/hover-peek-card/hover-peek-card";

const VARIANTS: Array<{ id: HoverPeekCardVariant; label: string }> = [
	{ id: "elevated", label: "Elevated" },
	{ id: "glass", label: "Glass" },
	{ id: "minimal", label: "Minimal" },
];

const SIDES: Array<{ id: HoverPeekCardSide; label: string }> = [
	{ id: "top", label: "Top" },
	{ id: "bottom", label: "Bottom" },
];

function SpecDiagram() {
	return (
		<svg
			viewBox="0 0 320 140"
			fill="none"
			aria-hidden="true"
			className="size-full bg-gradient-to-br from-muted/80 via-background to-muted/50"
		>
			<g stroke="currentColor" strokeOpacity="0.08">
				<line x1="0" y1="35" x2="320" y2="35" />
				<line x1="0" y1="70" x2="320" y2="70" />
				<line x1="0" y1="105" x2="320" y2="105" />
				<line x1="80" y1="0" x2="80" y2="140" />
				<line x1="160" y1="0" x2="160" y2="140" />
				<line x1="240" y1="0" x2="240" y2="140" />
			</g>
			<rect
				x="24"
				y="26"
				width="92"
				height="88"
				rx="10"
				fill="var(--card)"
				stroke="currentColor"
				strokeOpacity="0.14"
			/>
			<rect
				x="36"
				y="40"
				width="48"
				height="7"
				rx="3.5"
				fill="currentColor"
				fillOpacity="0.7"
			/>
			<rect
				x="36"
				y="56"
				width="66"
				height="5"
				rx="2.5"
				fill="currentColor"
				fillOpacity="0.2"
			/>
			<rect
				x="36"
				y="67"
				width="54"
				height="5"
				rx="2.5"
				fill="currentColor"
				fillOpacity="0.15"
			/>
			<rect
				x="36"
				y="86"
				width="44"
				height="16"
				rx="5"
				fill="currentColor"
				fillOpacity="0.88"
			/>
			<path
				d="M116 70 H164"
				stroke="currentColor"
				strokeOpacity="0.35"
				strokeWidth="1.5"
				strokeDasharray="3 3"
			/>
			<rect
				x="164"
				y="22"
				width="132"
				height="96"
				rx="12"
				fill="var(--card)"
				stroke="currentColor"
				strokeOpacity="0.18"
			/>
			<path
				d="M180 94 L204 72 L228 80 L256 46 L280 54"
				stroke="currentColor"
				strokeOpacity="0.7"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="256" cy="46" r="3.5" fill="currentColor" />
		</svg>
	);
}

function CopyRefButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			void navigator.clipboard.writeText(value).catch(() => undefined);
		}
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1400);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[11px] text-foreground transition-colors hover:bg-foreground/[0.07] focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid active:scale-[0.97]"
		>
			{copied ? (
				<>
					<CheckIcon aria-hidden="true" className="size-3 text-emerald-500" />
					Copied
				</>
			) : (
				<>
					<CopyIcon
						aria-hidden="true"
						className="size-3 text-muted-foreground"
					/>
					Copy ref
				</>
			)}
		</button>
	);
}

export default function HoverPeekCardDemo() {
	const [variant, setVariant] = useState<HoverPeekCardVariant>("elevated");
	const [side, setSide] = useState<HoverPeekCardSide>("top");

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-6">
			{/* Controls */}
			<div className="flex flex-wrap items-center justify-center gap-2">
				<div
					role="radiogroup"
					aria-label="Card surface variant"
					className="inline-flex items-center rounded-lg bg-muted/75 p-0.5 ring-1 ring-foreground/[0.06]"
				>
					{VARIANTS.map((item) => {
						const active = variant === item.id;
						return (
							<button
								key={item.id}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => setVariant(item.id)}
								className={`cursor-pointer rounded-[6px] px-2.5 py-1 font-medium text-xs transition-colors ${
									active
										? "bg-background text-foreground shadow-xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{item.label}
							</button>
						);
					})}
				</div>

				<div
					role="radiogroup"
					aria-label="Preferred placement"
					className="inline-flex items-center rounded-lg bg-muted/75 p-0.5 ring-1 ring-foreground/[0.06]"
				>
					{SIDES.map((item) => {
						const active = side === item.id;
						return (
							<button
								key={item.id}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => setSide(item.id)}
								className={`cursor-pointer rounded-[6px] px-2.5 py-1 font-medium text-xs transition-colors ${
									active
										? "bg-background text-foreground shadow-xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{item.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* Editorial surface with coordinated HoverPeekCardGroup */}
			<HoverPeekCardGroup
				variant={variant}
				side={side}
				openDelay={220}
				closeDelay={170}
				skipDelayDuration={380}
			>
				<div className="w-full rounded-2xl border border-border/80 bg-card/70 p-5 shadow-xs">
					<div className="flex items-center justify-between gap-2 pb-3 text-muted-foreground text-xs">
						<span className="font-medium text-foreground">
							Release notes &middot; Q4
						</span>
						<span className="font-mono text-[11px] tabular-nums">v2.14.0</span>
					</div>

					<p className="text-muted-foreground text-sm leading-7">
						In this cycle{" "}
						<HoverPeekCard>
							<HoverPeekCardTrigger
								asChild
								className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-[13px] text-foreground ring-1 ring-foreground/[0.08] hover:bg-muted"
							>
								<button type="button">
									<span
										aria-hidden="true"
										className="grid size-4 place-items-center rounded-full bg-foreground font-semibold text-[9px] text-background"
									>
										MC
									</span>
									@maya
								</button>
							</HoverPeekCardTrigger>
							<HoverPeekCardContent className="w-[296px]">
								<HoverPeekCardHeader>
									<div className="flex items-center gap-2.5">
										<div className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground font-semibold text-background text-xs">
											MC
										</div>
										<div className="min-w-0">
											<HoverPeekCardTitle>Maya Chen</HoverPeekCardTitle>
											<p className="truncate text-muted-foreground text-xs">
												Staff Design Engineer &middot; Systems
											</p>
										</div>
									</div>
									<HoverPeekCardDescription className="mt-2">
										Maintains motion primitives, floating surface positioning,
										and high-contrast accessibility tokens across the web app.
									</HoverPeekCardDescription>
									<HoverPeekCardMeta>
										<span className="inline-flex items-center gap-1 text-foreground">
											<span className="size-1.5 rounded-full bg-emerald-500" />
											Online
										</span>
										<span>&middot;</span>
										<span>San Francisco</span>
										<span>&middot;</span>
										<span>142 PRs</span>
									</HoverPeekCardMeta>
								</HoverPeekCardHeader>
								<HoverPeekCardFooter>
									<span className="font-mono text-[11px]">@maya</span>
									<CopyRefButton value="@maya" />
								</HoverPeekCardFooter>
							</HoverPeekCardContent>
						</HoverPeekCard>{" "}
						merged{" "}
						<HoverPeekCard>
							<HoverPeekCardTrigger className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium font-mono text-[12.5px] text-foreground no-underline ring-1 ring-foreground/[0.08] hover:bg-muted">
								<GitPullRequestIcon
									aria-hidden="true"
									className="size-3.5 text-emerald-600 dark:text-emerald-400"
								/>
								#418
							</HoverPeekCardTrigger>
							<HoverPeekCardContent className="w-[312px]">
								<HoverPeekCardMedia aspect="2/1">
									<SpecDiagram />
								</HoverPeekCardMedia>
								<HoverPeekCardHeader>
									<HoverPeekCardTitle>
										Origin-aware spring overlays
									</HoverPeekCardTitle>
									<HoverPeekCardDescription>
										Replaces fixed-duration fades with critically damped springs
										anchored to trigger edges and safe-corridor pointer grace.
									</HoverPeekCardDescription>
									<HoverPeekCardMeta>
										<span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
											Merged
										</span>
										<span>&middot;</span>
										<span className="font-mono">+412 &minus;188</span>
										<span>&middot;</span>
										<span>6 files</span>
									</HoverPeekCardMeta>
								</HoverPeekCardHeader>
								<HoverPeekCardFooter>
									<span className="font-mono text-[11px]">tentui#418</span>
									<CopyRefButton value="tentui#418" />
								</HoverPeekCardFooter>
							</HoverPeekCardContent>
						</HoverPeekCard>{" "}
						and updated{" "}
						<HoverPeekCard>
							<HoverPeekCardTrigger className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-[13px] text-foreground no-underline ring-1 ring-foreground/[0.08] hover:bg-muted">
								<FileCode2Icon
									aria-hidden="true"
									className="size-3.5 text-muted-foreground"
								/>
								motion-spec.md
							</HoverPeekCardTrigger>
							<HoverPeekCardContent className="w-[292px]">
								<HoverPeekCardHeader>
									<div className="flex items-center justify-between gap-2">
										<HoverPeekCardTitle>motion-spec.md</HoverPeekCardTitle>
										<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-[10.5px] text-foreground">
											<SparklesIcon aria-hidden="true" className="size-2.5" />
											Draft v4
										</span>
									</div>
									<HoverPeekCardDescription>
										Defines response budgets under 300ms, asymmetric exit
										curves, and touch long-press thresholds across interactive
										surfaces.
									</HoverPeekCardDescription>
									<HoverPeekCardMeta>
										<span>docs/architecture</span>
										<span>&middot;</span>
										<span>4 min read</span>
									</HoverPeekCardMeta>
								</HoverPeekCardHeader>
								<HoverPeekCardFooter>
									<span className="font-mono text-[11px]">
										docs/motion-spec.md
									</span>
									<span className="inline-flex items-center gap-0.5 font-medium text-foreground">
										Open
										<ArrowUpRightIcon aria-hidden="true" className="size-3" />
									</span>
								</HoverPeekCardFooter>
							</HoverPeekCardContent>
						</HoverPeekCard>{" "}
						with zero layout shift across mobile and desktop.
					</p>

					<p className="mt-4 border-border/60 border-t pt-3 text-[11.5px] text-muted-foreground">
						Hover or glide between pills on desktop, Tab on keyboard, or press
						and hold on touch.
					</p>
				</div>
			</HoverPeekCardGroup>
		</div>
	);
}
