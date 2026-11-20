"use client";

import Image from "next/image";
import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANDSCAPE_SRC = "https://cdn.tentui.com/cta-01-landscape.svg";

type ImageStatus = "loading" | "loaded" | "error";

export default function Cta01() {
	const headingId = useId();
	const [status, setStatus] = useState<ImageStatus>("loading");

	return (
		<section
			aria-labelledby={headingId}
			className="relative w-full bg-background font-sans text-foreground"
		>
			<div className="mx-auto w-full max-w-6xl md:px-8 xl:px-0">
				<div className="flex flex-col gap-8 px-5 pt-12 pb-8 sm:px-6 md:px-0 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
					<div className="flex flex-col gap-3 lg:max-w-md xl:max-w-lg">
						<h2
							className="text-balance font-normal text-3xl leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.5rem]"
							id={headingId}
						>
							Don&apos;t let your customers leave without a Tkit.
						</h2>
						<p className="max-w-sm text-pretty text-base text-muted-foreground leading-relaxed">
							Turn your website visitors into clients in minutes. No coding
							required.
						</p>
					</div>

					<div className="flex flex-col items-stretch gap-2.5 sm:items-start lg:mt-1 lg:items-center">
						<a
							className={cn(
								buttonVariants({ size: "lg" }),
								"h-11 min-w-40 touch-manipulation px-6 text-base sm:w-auto",
								"motion-safe:transition-[background-color,transform] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97]",
							)}
							href="/login"
						>
							Start free trial
						</a>
						<p className="text-center text-muted-foreground text-sm sm:text-left lg:text-center">
							No credit card required.
						</p>
					</div>
				</div>

				<div className="relative isolate h-[220px] overflow-hidden border-y bg-muted sm:h-[280px] md:h-[320px] md:border-x lg:h-[360px]">
					<LandscapeFallback />
					{status !== "error" && (
						<Image
							alt=""
							className={cn(
								"absolute inset-0 size-full object-cover object-bottom",
								"motion-safe:transition-opacity motion-safe:duration-700 motion-safe:ease-out",
								status === "loaded" ? "opacity-100" : "opacity-0",
							)}
							height={941}
							onError={() => setStatus("error")}
							onLoad={() => setStatus("loaded")}
							sizes="(min-width: 72rem) 72rem, 100vw"
							src={LANDSCAPE_SRC}
							unoptimized
							width={1672}
						/>
					)}
				</div>
			</div>
		</section>
	);
}

/**
 * Self-contained, theme-aware landscape drawn with design tokens. It renders
 * underneath the illustration as a placeholder while it loads, and stays
 * visible on its own if the remote asset can't be fetched.
 */
function LandscapeFallback() {
	const id = useId();
	const skyId = `${id}-sky`;
	const mistId = `${id}-mist`;

	return (
		<svg
			aria-hidden="true"
			className="absolute inset-0 -z-10 size-full"
			focusable="false"
			preserveAspectRatio="xMidYMax slice"
			viewBox="0 0 1600 480"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={skyId} x1="0" x2="0" y1="0" y2="1">
					<stop
						className="[stop-color:var(--primary)] [stop-opacity:0.14]"
						offset="0"
					/>
					<stop
						className="[stop-color:var(--background)] [stop-opacity:0]"
						offset="0.75"
					/>
				</linearGradient>
				<linearGradient id={mistId} x1="0" x2="0" y1="0" y2="1">
					<stop
						className="[stop-color:var(--background)] [stop-opacity:0]"
						offset="0"
					/>
					<stop
						className="[stop-color:var(--background)] [stop-opacity:0.45]"
						offset="0.55"
					/>
					<stop
						className="[stop-color:var(--background)] [stop-opacity:0]"
						offset="1"
					/>
				</linearGradient>
			</defs>

			<rect fill={`url(#${skyId})`} height="480" width="1600" />
			<circle className="fill-primary/[0.07]" cx="1000" cy="170" r="110" />
			<circle className="fill-primary/15" cx="1000" cy="170" r="58" />

			<path
				className="fill-foreground/[0.05]"
				d="M0 300L120 250 220 272 340 200 460 240 560 180 660 228 760 150 880 210 980 130 1100 200 1200 170 1320 230 1440 190 1600 240V480H0Z"
			/>
			<path
				className="fill-foreground/[0.08]"
				d="M0 340L140 292 260 318 400 252 520 300 640 232 760 172 840 122 900 160 960 98 1040 168 1140 228 1260 258 1380 222 1500 268 1600 250V480H0Z"
			/>
			<rect fill={`url(#${mistId})`} height="110" width="1600" y="270" />
			<path
				className="fill-foreground/[0.11]"
				d="M0 380C150 340 260 362 400 332S650 362 800 342 1100 302 1250 332 1500 352 1600 322V480H0Z"
			/>
			<path
				className="fill-foreground/[0.16]"
				d="M0 432C200 400 320 420 480 396S800 432 1000 410 1350 380 1600 406V480H0Z"
			/>

			<g className="fill-foreground/35">
				<circle cx="640" cy="372" r="6" />
				<rect height="24" rx="5" width="14" x="633" y="379" />
			</g>
		</svg>
	);
}
