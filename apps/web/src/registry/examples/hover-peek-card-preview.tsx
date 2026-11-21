"use client";

import {
	ArrowUpRightIcon,
	GitCommitHorizontalIcon,
	LayersIcon,
} from "lucide-react";

import {
	HoverPeekCard,
	HoverPeekCardContent,
	HoverPeekCardDescription,
	HoverPeekCardFooter,
	HoverPeekCardGroup,
	HoverPeekCardHeader,
	HoverPeekCardMedia,
	HoverPeekCardMeta,
	HoverPeekCardTitle,
	HoverPeekCardTrigger,
} from "@/registry/components/hover-peek-card/hover-peek-card";

function CacheGraphArtwork() {
	return (
		<svg
			viewBox="0 0 280 120"
			fill="none"
			aria-hidden="true"
			className="size-full bg-gradient-to-br from-muted/80 via-background to-muted/60"
		>
			<g stroke="currentColor" strokeOpacity="0.08" strokeWidth="1">
				<line x1="0" y1="30" x2="280" y2="30" />
				<line x1="0" y1="60" x2="280" y2="60" />
				<line x1="0" y1="90" x2="280" y2="90" />
				<line x1="70" y1="0" x2="70" y2="120" />
				<line x1="140" y1="0" x2="140" y2="120" />
				<line x1="210" y1="0" x2="210" y2="120" />
			</g>
			<path
				d="M0 92 C36 88, 54 74, 88 68 C124 62, 146 38, 184 32 C216 27, 244 22, 280 18 L280 120 L0 120 Z"
				fill="currentColor"
				fillOpacity="0.06"
			/>
			<path
				d="M0 92 C36 88, 54 74, 88 68 C124 62, 146 38, 184 32 C216 27, 244 22, 280 18"
				stroke="currentColor"
				strokeOpacity="0.65"
				strokeWidth="1.75"
				strokeLinecap="round"
			/>
			<circle
				cx="184"
				cy="32"
				r="4"
				fill="var(--background)"
				stroke="currentColor"
				strokeWidth="1.75"
			/>
			<rect
				x="14"
				y="14"
				width="76"
				height="20"
				rx="6"
				fill="var(--background)"
				fillOpacity="0.88"
				stroke="currentColor"
				strokeOpacity="0.1"
			/>
			<circle cx="24" cy="24" r="3" fill="#10b981" />
			<text
				x="33"
				y="27.5"
				fill="currentColor"
				fontSize="9.5"
				fontWeight="500"
				fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
			>
				99.4% hit
			</text>
		</svg>
	);
}

function TokenGridArtwork() {
	return (
		<svg
			viewBox="0 0 280 120"
			fill="none"
			aria-hidden="true"
			className="size-full bg-gradient-to-br from-muted/80 via-background to-muted/60"
		>
			<rect
				x="16"
				y="16"
				width="112"
				height="88"
				rx="10"
				fill="var(--card)"
				stroke="currentColor"
				strokeOpacity="0.12"
			/>
			<rect
				x="28"
				y="28"
				width="42"
				height="8"
				rx="4"
				fill="currentColor"
				fillOpacity="0.7"
			/>
			<rect
				x="28"
				y="44"
				width="86"
				height="6"
				rx="3"
				fill="currentColor"
				fillOpacity="0.18"
			/>
			<rect
				x="28"
				y="56"
				width="64"
				height="6"
				rx="3"
				fill="currentColor"
				fillOpacity="0.14"
			/>
			<rect
				x="28"
				y="74"
				width="54"
				height="18"
				rx="6"
				fill="currentColor"
				fillOpacity="0.9"
			/>
			<rect
				x="140"
				y="16"
				width="124"
				height="40"
				rx="10"
				fill="var(--card)"
				stroke="currentColor"
				strokeOpacity="0.12"
			/>
			<circle cx="158" cy="36" r="8" fill="currentColor" fillOpacity="0.14" />
			<rect
				x="174"
				y="30"
				width="58"
				height="5"
				rx="2.5"
				fill="currentColor"
				fillOpacity="0.55"
			/>
			<rect
				x="174"
				y="39"
				width="38"
				height="4"
				rx="2"
				fill="currentColor"
				fillOpacity="0.2"
			/>
			<rect
				x="140"
				y="64"
				width="124"
				height="40"
				rx="10"
				fill="var(--card)"
				stroke="currentColor"
				strokeOpacity="0.12"
			/>
			<rect
				x="152"
				y="76"
				width="20"
				height="16"
				rx="4"
				fill="currentColor"
				fillOpacity="0.82"
			/>
			<rect
				x="178"
				y="76"
				width="20"
				height="16"
				rx="4"
				fill="currentColor"
				fillOpacity="0.35"
			/>
			<rect
				x="204"
				y="76"
				width="20"
				height="16"
				rx="4"
				fill="currentColor"
				fillOpacity="0.14"
			/>
			<rect
				x="230"
				y="76"
				width="20"
				height="16"
				rx="4"
				fill="currentColor"
				fillOpacity="0.06"
				stroke="currentColor"
				strokeOpacity="0.16"
			/>
		</svg>
	);
}

export default function HoverPeekCardPreview({
	initialOpenFirst = false,
}: {
	initialOpenFirst?: boolean;
}) {
	return (
		<HoverPeekCardGroup openDelay={200} closeDelay={150} side="top">
			<p className="max-w-md text-center text-muted-foreground text-sm leading-7">
				Shipped{" "}
				<HoverPeekCard defaultOpen={initialOpenFirst}>
					<HoverPeekCardTrigger
						data-peek-trigger="edge-cache"
						className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-[13px] text-foreground no-underline ring-1 ring-foreground/[0.08] transition-[background-color,transform] duration-150 hover:bg-muted"
					>
						<GitCommitHorizontalIcon
							aria-hidden="true"
							className="size-3.5 text-muted-foreground"
						/>
						Edge Cache v3
					</HoverPeekCardTrigger>
					<HoverPeekCardContent className="w-[264px]">
						<HoverPeekCardMedia aspect="2/1">
							<CacheGraphArtwork />
						</HoverPeekCardMedia>
						<HoverPeekCardHeader className="pb-2.5">
							<HoverPeekCardTitle>Edge Cache v3</HoverPeekCardTitle>
							<HoverPeekCardDescription>
								Stale-while-revalidate across 34 regions with sub-12ms p95
								invalidation.
							</HoverPeekCardDescription>
							<HoverPeekCardMeta>
								<span className="inline-flex items-center gap-1.5 text-foreground">
									<span className="size-1.5 rounded-full bg-emerald-500" />
									Live
								</span>
								<span>&middot;</span>
								<span>11.4 ms p95</span>
								<span>&middot;</span>
								<span>2h ago</span>
							</HoverPeekCardMeta>
						</HoverPeekCardHeader>
						<HoverPeekCardFooter>
							<span className="font-mono text-[11px]">release/v3.4.0</span>
							<span className="inline-flex items-center gap-0.5 font-medium text-foreground">
								Inspect
								<ArrowUpRightIcon aria-hidden="true" className="size-3" />
							</span>
						</HoverPeekCardFooter>
					</HoverPeekCardContent>
				</HoverPeekCard>{" "}
				and{" "}
				<HoverPeekCard>
					<HoverPeekCardTrigger
						data-peek-trigger="surface-tokens"
						className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-[13px] text-foreground no-underline ring-1 ring-foreground/[0.08] transition-[background-color,transform] duration-150 hover:bg-muted"
					>
						<LayersIcon
							aria-hidden="true"
							className="size-3.5 text-muted-foreground"
						/>
						Surface Tokens
					</HoverPeekCardTrigger>
					<HoverPeekCardContent className="w-[264px]">
						<HoverPeekCardMedia aspect="2/1">
							<TokenGridArtwork />
						</HoverPeekCardMedia>
						<HoverPeekCardHeader className="pb-2.5">
							<HoverPeekCardTitle>Surface Tokens</HoverPeekCardTitle>
							<HoverPeekCardDescription>
								Unified contrast ramps and hairline elevation rings for light
								and dark canvases.
							</HoverPeekCardDescription>
							<HoverPeekCardMeta>
								<span className="text-foreground">48 tokens</span>
								<span>&middot;</span>
								<span>WCAG AAA</span>
								<span>&middot;</span>
								<span>Updated today</span>
							</HoverPeekCardMeta>
						</HoverPeekCardHeader>
						<HoverPeekCardFooter>
							<span className="font-mono text-[11px]">design/surfaces</span>
							<span className="inline-flex items-center gap-0.5 font-medium text-foreground">
								Inspect
								<ArrowUpRightIcon aria-hidden="true" className="size-3" />
							</span>
						</HoverPeekCardFooter>
					</HoverPeekCardContent>
				</HoverPeekCard>
				.
			</p>
		</HoverPeekCardGroup>
	);
}
