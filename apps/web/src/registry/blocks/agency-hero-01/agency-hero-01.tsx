"use client";

import { ArrowRight } from "lucide-react";
import {
	MotionConfig,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import Marquee from "react-fast-marquee";

const ICON_CDN = "https://cdn.srb.codes/images/tech-stack-icons";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const TECH_STACK: {
	key: string;
	title: string;
	theme?: boolean;
}[] = [
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
	{ key: "cfw", title: "Cloudflare Worker" },
	{ key: "cf", title: "Cloudflare" },
];

const stagger = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.05,
		},
	},
} satisfies Variants;

const fadeUp = {
	hidden: {
		opacity: 0,
		transform: "translateY(12px) scale(0.98)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px) scale(1)",
		transition: {
			duration: 0.4,
			ease: EASE_OUT,
		},
	},
} satisfies Variants;

function AnimatedArrow({ className }: { className?: string }) {
	return (
		<div
			data-slot="animated-arrow"
			className={`size-6 -rotate-45 overflow-hidden duration-500 ${className ?? ""}`}
		>
			<div
				data-slot="animated-arrow-track"
				className="flex w-12 -translate-x-1/2 transition-transform duration-500 ease-in-out group-hover/animated-arrow:translate-x-0"
			>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
			</div>
		</div>
	);
}

function TechIcon({ tech }: { tech: (typeof TECH_STACK)[number] }) {
	if (tech.theme) {
		return (
			<>
				<Image
					alt={tech.title}
					className="hidden [html.light_&]:block"
					height={20}
					src={`${ICON_CDN}/${tech.key}-light.svg`}
					unoptimized
					width={20}
				/>
				<Image
					alt={tech.title}
					className="hidden [html.dark_&]:block"
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
			alt={tech.title}
			height={20}
			src={`${ICON_CDN}/${tech.key}.svg`}
			unoptimized
			width={20}
		/>
	);
}

function TechCarousel() {
	const reduceMotion = useReducedMotion();

	return (
		<div className="relative mx-auto w-full max-w-2xl">
			<Marquee
				autoFill
				className="overflow-hidden"
				gradient
				gradientColor="var(--color-background)"
				gradientWidth={80}
				pauseOnHover
				play={reduceMotion !== true}
				speed={25}
			>
				{TECH_STACK.map((tech) => (
					<div
						className="mx-4 flex items-center gap-1.5 opacity-40 grayscale transition-opacity duration-200 ease-out hover:opacity-80 hover:grayscale-0"
						key={tech.key}
					>
						<TechIcon tech={tech} />
						<span className="text-muted-foreground text-xs">{tech.title}</span>
					</div>
				))}
			</Marquee>
		</div>
	);
}

export default function AgencyHero01() {
	return (
		<MotionConfig reducedMotion="user">
			<div className="max-w-screen overflow-x-hidden px-2">
				<div className="screen-line-top screen-line-bottom mx-auto border border-line md:max-w-4xl">
					<section className="relative overflow-hidden bg-background pt-28 pb-12 text-foreground md:pt-36 md:pb-20">
						<div className="mask-[radial-gradient(75%_100%_at_top,black_45%,transparent_75%)] absolute inset-0 aspect-square opacity-65 starting:opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:starting:opacity-65 motion-reduce:transition-none md:aspect-9/4 dark:opacity-40 dark:motion-reduce:starting:opacity-40">
							<Image
								alt=""
								className="object-cover object-top dark:hidden"
								fetchPriority="high"
								fill
								priority
								sizes="100vw"
								src="https://cdn.srb.codes/images/hero-bg.avif"
								unoptimized
							/>
							<Image
								alt=""
								className="hidden object-cover object-top dark:block"
								fill
								sizes="100vw"
								src="https://cdn.srb.codes/images/hero-bg-dark.avif"
								unoptimized
							/>
						</div>

						<motion.div
							animate="visible"
							className="relative z-10 mx-auto w-full"
							initial="hidden"
							variants={stagger}
						>
							<div className="text-center">
								<motion.div variants={fadeUp}>
									<Link
										className="group/animated-arrow mx-auto mb-8 inline-flex items-center gap-2 rounded-full border bg-muted py-1 pr-1 pl-3 text-sm shadow-md shadow-zinc-950/5 transition-[transform,background-color,border-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-background active:scale-[0.98] dark:border-t-white/5 dark:shadow-zinc-950 dark:hover:border-t-border"
										href="#pricing"
									>
										<span className="relative flex size-2">
											<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
											<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
										</span>
										<span className="text-muted-foreground">
											Available for new projects
										</span>
										<span className="block h-4 w-px bg-border" />
										<AnimatedArrow className="rounded-full bg-background transition-colors duration-200 ease-out group-hover/animated-arrow:bg-muted" />
									</Link>
								</motion.div>

								<motion.h1
									className="font-semibold text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl"
									variants={fadeUp}
								>
									We build beyond
									<br />
									pretty pixels
								</motion.h1>

								<motion.p
									className="mt-6 text-balance text-lg text-muted-foreground"
									variants={fadeUp}
								>
									we build products that ship and scale
								</motion.p>

								<motion.div
									className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
									variants={fadeUp}
								>
									<Link
										className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground text-sm shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_18px_60px_rgba(0,0,0,0.12)] transition-[transform,opacity] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.97]"
										href="#contact"
									>
										Book a Call
									</Link>
									<Link
										className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background/45 px-5 font-semibold text-foreground/80 text-sm shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] backdrop-blur transition-[transform,background-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]"
										href="#pricing"
									>
										View Pricing
									</Link>
								</motion.div>

								<motion.div className="mt-20" variants={fadeUp}>
									<p className="mb-4 font-light text-muted-foreground/50 text-sm">
										Production stacks, not prototypes
									</p>
									<TechCarousel />
								</motion.div>
							</div>
						</motion.div>
					</section>
				</div>
			</div>
		</MotionConfig>
	);
}
