"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import Marquee from "react-fast-marquee";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICON_CDN = "https://cdn.tentui.com/images/tech-stack-icons";

type Tech = {
	key: string;
	title: string;
	/** Ships separate `-light.svg` / `-dark.svg` variants. */
	theme?: boolean;
};

const TECH_STACK: Tech[] = [
	{ key: "js", title: "JavaScript" },
	{ key: "ts", title: "TypeScript" },
	{ key: "python", title: "Python" },
	{ key: "next-js", title: "Next.js", theme: true },
	{ key: "express", title: "Express", theme: true },
	{ key: "redis", title: "Redis" },
	{ key: "sqlite", title: "SQLite" },
	{ key: "node-js", title: "Node.js" },
	{ key: "react", title: "React" },
	{ key: "vue", title: "Vue.js" },
	{ key: "shadcn-ui", title: "shadcn/ui", theme: true },
	{ key: "tailwind", title: "Tailwind CSS" },
	{ key: "motion", title: "Motion" },
	{ key: "git", title: "Git" },
	{ key: "postman", title: "Postman" },
	{ key: "vite", title: "Vite" },
	{ key: "aws", title: "AWS", theme: true },
	{ key: "cfw", title: "Cloudflare Workers" },
	{ key: "cf", title: "Cloudflare" },
];

/**
 * Entrance animation driven purely by CSS (tw-animate-css keyframes), so the
 * server-rendered markup is visible without waiting for hydration or
 * requestAnimationFrame. `fill-mode-both` holds the start frame during the
 * stagger delay; reduced-motion users get the final state immediately.
 */
const ENTER =
	"animate-in fade-in slide-in-from-bottom-3 zoom-in-98 fill-mode-both duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
	const media = window.matchMedia(REDUCED_MOTION_QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribeReducedMotion,
		() => window.matchMedia(REDUCED_MOTION_QUERY).matches,
		() => false,
	);
}

function AnimatedArrow({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn("block size-6 -rotate-45 overflow-hidden", className)}
			data-slot="animated-arrow"
		>
			<span
				className="flex w-12 -translate-x-1/2 transition-transform duration-500 ease-in-out group-hover/badge:translate-x-0 motion-reduce:transition-none"
				data-slot="animated-arrow-track"
			>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
			</span>
		</span>
	);
}

function TechIcon({ tech }: { tech: Tech }) {
	if (tech.theme) {
		return (
			<>
				<Image
					alt=""
					className="size-5 dark:hidden"
					height={20}
					src={`${ICON_CDN}/${tech.key}-light.svg`}
					unoptimized
					width={20}
				/>
				<Image
					alt=""
					className="hidden size-5 dark:block"
					height={20}
					src={`${ICON_CDN}/${tech.key}-dark.svg`}
					unoptimized
					width={20}
				/>
			</>
		);
	}

	return (
		<Image
			alt=""
			className="size-5"
			height={20}
			src={`${ICON_CDN}/${tech.key}.svg`}
			unoptimized
			width={20}
		/>
	);
}

function TechCarousel() {
	const reduceMotion = usePrefersReducedMotion();

	return (
		<div className="relative mx-auto w-full max-w-2xl">
			{/* The marquee clones its children, so expose one clean list to assistive tech. */}
			<ul className="sr-only">
				{TECH_STACK.map((tech) => (
					<li key={tech.key}>{tech.title}</li>
				))}
			</ul>
			<div aria-hidden="true">
				<Marquee
					autoFill
					gradient
					gradientColor="var(--color-background)"
					gradientWidth={64}
					pauseOnHover
					play={!reduceMotion}
					speed={25}
				>
					{TECH_STACK.map((tech) => (
						<div
							className="mx-4 flex items-center gap-2 opacity-60 grayscale transition-[opacity,filter] duration-200 ease-out hover:opacity-100 hover:grayscale-0"
							key={tech.key}
						>
							<TechIcon tech={tech} />
							<span className="whitespace-nowrap text-muted-foreground text-sm">
								{tech.title}
							</span>
						</div>
					))}
				</Marquee>
			</div>
		</div>
	);
}

export default function Hero01() {
	return (
		<div className="max-w-screen overflow-x-hidden bg-background px-2 text-foreground">
			<div className="screen-line-top screen-line-bottom mx-auto border border-line md:max-w-4xl">
				<section
					aria-labelledby="hero-01-title"
					className="relative isolate overflow-hidden px-4 pt-24 pb-12 sm:px-6 sm:pt-28 md:pt-36 md:pb-20"
				>
					<div
						aria-hidden="true"
						className="mask-[radial-gradient(75%_100%_at_top,black_45%,transparent_75%)] pointer-events-none absolute inset-0 -z-10 opacity-65 starting:opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:opacity-40"
					>
						<Image
							alt=""
							className="object-cover object-top dark:hidden"
							fetchPriority="high"
							fill
							loading="eager"
							sizes="(min-width: 768px) 56rem, 100vw"
							src="https://cdn.tentui.com/images/hero-bg.avif"
							unoptimized
						/>
						<Image
							alt=""
							className="hidden object-cover object-top dark:block"
							fill
							loading="eager"
							sizes="(min-width: 768px) 56rem, 100vw"
							src="https://cdn.tentui.com/images/hero-bg-dark.avif"
							unoptimized
						/>
					</div>

					<div className="mx-auto flex max-w-3xl flex-col items-center text-center">
						<Badge
							className={cn(
								ENTER,
								"mb-8 h-auto gap-2 bg-muted py-1 pr-1 pl-3 text-sm shadow-foreground/5 shadow-md transition-[background-color,border-color,scale] duration-150 hover:bg-background active:scale-[0.98] dark:shadow-black/40 [a]:hover:bg-background [a]:hover:text-foreground",
							)}
							render={<Link href="#pricing" />}
							variant="outline"
						>
							<span aria-hidden="true" className="relative flex size-2">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:hidden" />
								<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
							</span>
							<span className="font-normal text-muted-foreground">
								Available for new projects
							</span>
							<span aria-hidden="true" className="h-4 w-px bg-border" />
							<AnimatedArrow className="rounded-full bg-background transition-colors duration-200 ease-out group-hover/badge:bg-muted" />
						</Badge>

						<h1
							className={cn(
								ENTER,
								"text-balance font-semibold text-4xl leading-[1.1] tracking-tight delay-75 sm:text-5xl md:text-6xl",
							)}
							id="hero-01-title"
						>
							We build beyond
							<br />
							pretty pixels
						</h1>

						<p
							className={cn(
								ENTER,
								"mt-5 max-w-md text-pretty text-base text-muted-foreground delay-150 sm:mt-6 sm:text-lg",
							)}
						>
							We design and engineer products that ship fast and scale with you.
						</p>

						<div
							className={cn(
								ENTER,
								"mt-10 flex w-full flex-col items-stretch justify-center gap-3 delay-200 sm:w-auto sm:flex-row sm:items-center",
							)}
						>
							<Button
								className="h-11 px-5 font-semibold transition-[background-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:not-aria-[haspopup]:translate-y-0 active:scale-[0.97]"
								nativeButton={false}
								render={<Link href="#contact" />}
								size="lg"
							>
								Book a Call
							</Button>
							<Button
								className="h-11 px-5 font-semibold backdrop-blur-sm transition-[background-color,color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:not-aria-[haspopup]:translate-y-0 active:scale-[0.97]"
								nativeButton={false}
								render={<Link href="#pricing" />}
								size="lg"
								variant="outline"
							>
								View Pricing
							</Button>
						</div>

						<div className={cn(ENTER, "mt-16 w-full delay-300 md:mt-20")}>
							<p className="mb-4 text-muted-foreground text-sm">
								Production stacks, not prototypes
							</p>
							<TechCarousel />
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
