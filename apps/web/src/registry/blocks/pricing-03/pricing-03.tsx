"use client";

import { ArrowUpRight, Check } from "lucide-react";
import type { CSSProperties } from "react";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import FluidWave from "./fluid-wave";

// Brand accent for the featured plan's fluid treatment. Exposed as a CSS variable
// so the WebGL wave, the fallback gradient and the glow all stay in sync.
const ACCENT = "#FC4C01";

type Plan = {
	name: string;
	description: string;
	price: number;
	features: readonly string[];
	cta: string;
	href: string;
	popular?: boolean;
};

const PLANS: readonly Plan[] = [
	{
		name: "Core",
		description: "For individuals turning focused ideas into real products.",
		price: 12,
		features: [
			"3 active projects",
			"Unlimited collaborators",
			"5 GB file storage",
			"Community support",
		],
		cta: "Start with Core",
		href: "/signup?plan=core",
	},
	{
		name: "Studio",
		description: "For ambitious teams shipping together, without the busywork.",
		price: 29,
		features: [
			"Unlimited projects",
			"Advanced permissions",
			"100 GB file storage",
			"Priority support",
		],
		cta: "Choose Studio",
		href: "/signup?plan=studio",
		popular: true,
	},
];

function FeaturedBackdrop() {
	return (
		<div aria-hidden="true" className="absolute inset-0 -z-10">
			{/* Static glow: always painted, and the full treatment when WebGL is unavailable. */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_100%,color-mix(in_oklab,var(--pricing-accent)_66%,transparent),transparent_66%)]" />
			<FluidWave color={ACCENT} />
			{/* Keeps the upper half calm so the copy stays legible over the wave. */}
			<div className="absolute inset-0 bg-gradient-to-b from-8% from-background via-38% via-background/90 to-background/10" />
		</div>
	);
}

function PlanCard({ plan }: { plan: Plan }) {
	const titleId = useId();
	const { popular } = plan;

	return (
		<Card
			aria-labelledby={titleId}
			className={cn(
				"relative isolate h-full gap-0 rounded-[2rem] text-base shadow-none [--card-spacing:--spacing(7)] lg:min-h-[34rem] sm:[--card-spacing:--spacing(9)]",
				popular
					? // Scope the dark palette to this card so tokens resolve to the inverted
						// surface in both themes.
						"dark bg-background text-foreground shadow-[0_24px_70px_-32px_color-mix(in_oklab,var(--pricing-accent)_45%,transparent)] ring-foreground/10"
					: "bg-card text-card-foreground shadow-[0_24px_70px_-42px_rgb(15_23_42/0.3)] dark:shadow-none",
			)}
			role="group"
			style={
				popular ? ({ "--pricing-accent": ACCENT } as CSSProperties) : undefined
			}
		>
			{popular ? <FeaturedBackdrop /> : null}

			<CardHeader className="gap-3">
				<h3
					className="font-medium text-2xl leading-tight tracking-tight"
					id={titleId}
				>
					{plan.name}
				</h3>
				{popular ? (
					<CardAction className="row-span-1 self-center">
						<Badge
							className="h-6 border-foreground/15 bg-foreground/10 px-2.5 text-[0.6875rem] text-foreground/90 uppercase tracking-[0.14em] backdrop-blur-md"
							variant="outline"
						>
							Most popular
						</Badge>
					</CardAction>
				) : null}
				<CardDescription className="col-span-full max-w-sm text-pretty leading-6 lg:min-h-12">
					{plan.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="mt-10 flex flex-1 flex-col">
				<p className="flex items-baseline gap-2">
					<span className="font-medium text-5xl tabular-nums tracking-tighter">
						${plan.price}
					</span>
					<span className="text-muted-foreground text-sm">per month</span>
				</p>

				<Separator className="my-8" />

				<ul className="flex flex-col gap-4 text-sm">
					{plan.features.map((feature) => (
						<li className="flex items-center gap-3" key={feature}>
							<span
								aria-hidden="true"
								className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10"
							>
								<Check className="size-3" strokeWidth={2.5} />
							</span>
							<span className="text-foreground/85">{feature}</span>
						</li>
					))}
				</ul>
			</CardContent>

			<CardFooter className="pt-10">
				<a
					className={cn(
						buttonVariants({ size: "lg" }),
						"group/cta h-12 w-full touch-manipulation justify-between rounded-full bg-foreground pr-2.5 pl-5 text-background hover:bg-foreground/85 motion-reduce:transition-none",
					)}
					href={plan.href}
				>
					{plan.cta}
					<span className="flex size-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-200 ease-out group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none">
						<ArrowUpRight aria-hidden="true" className="size-3.5" />
					</span>
				</a>
			</CardFooter>
		</Card>
	);
}

export function Pricing03() {
	const headingId = useId();

	return (
		<section
			aria-labelledby={headingId}
			className="relative overflow-hidden bg-background px-4 py-20 text-foreground sm:px-6 sm:py-28 lg:px-8"
		>
			<div
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
			/>
			<div className="mx-auto max-w-5xl">
				<div className="mb-12 grid gap-6 md:mb-16 md:grid-cols-[1fr_0.72fr] md:items-end">
					<h2
						className="max-w-xl text-balance font-medium text-4xl tracking-tight sm:text-5xl sm:leading-[1.05]"
						id={headingId}
					>
						Plans that scale with the work.
					</h2>
					<p className="max-w-md text-pretty text-muted-foreground text-sm leading-6 md:justify-self-end">
						Start small, then move up when your team is ready. Every plan
						includes a 14-day trial and no long-term contract.
					</p>
				</div>

				<ul className="grid gap-5 lg:grid-cols-2">
					{PLANS.map((plan) => (
						<li key={plan.name}>
							<PlanCard plan={plan} />
						</li>
					))}
				</ul>

				<p className="mt-8 text-center text-muted-foreground text-xs">
					Prices are in USD. Cancel or change your plan at any time.
				</p>
			</div>
		</section>
	);
}

export default Pricing03;
