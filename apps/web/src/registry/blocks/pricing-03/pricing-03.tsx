"use client";

import { ArrowUpRight, Check } from "lucide-react";

import FluidWave from "./fluid-wave";

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

function PlanCard({ plan }: { plan: Plan }) {
	return (
		<article
			aria-label={`${plan.name} plan`}
			className={`relative isolate flex min-h-[34rem] overflow-hidden rounded-[2rem] border p-7 sm:p-9 ${
				plan.popular
					? "border-white/10 bg-[#0a0a0a] text-white shadow-[0_24px_70px_-32px_rgba(252,76,1,0.42)]"
					: "border-border bg-card text-card-foreground shadow-[0_24px_70px_-42px_rgba(15,23,42,0.3)]"
			}`}
		>
			{plan.popular ? (
				<>
					<div
						aria-hidden="true"
						className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_70%_100%,rgba(252,76,1,0.66),transparent_66%)]"
					/>
					<div aria-hidden="true" className="absolute inset-0 -z-10">
						<FluidWave />
					</div>
					<div
						aria-hidden="true"
						className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,#0a0a0a_8%,rgba(10,10,10,0.9)_38%,rgba(10,10,10,0.36)_72%,rgba(10,10,10,0.08))]"
					/>
				</>
			) : null}

			<div className="flex w-full flex-col">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="font-medium text-2xl tracking-[-0.03em]">
							{plan.name}
						</h3>
						<p
							className={`mt-3 max-w-sm text-sm leading-6 ${
								plan.popular ? "text-white/62" : "text-muted-foreground"
							}`}
						>
							{plan.description}
						</p>
					</div>

					{plan.popular ? (
						<span className="shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-1 font-medium text-[0.68rem] text-white/90 uppercase tracking-[0.14em] backdrop-blur-md">
							Most popular
						</span>
					) : null}
				</div>

				<div className="mt-10 flex items-end gap-2">
					<span className="font-medium text-5xl tracking-[-0.055em]">
						${plan.price}
					</span>
					<span
						className={`pb-1 text-sm ${
							plan.popular ? "text-white/58" : "text-muted-foreground"
						}`}
					>
						per month
					</span>
				</div>

				<div
					className={`my-8 h-px ${plan.popular ? "bg-white/12" : "bg-border"}`}
				/>

				<ul className="space-y-4">
					{plan.features.map((feature) => (
						<li className="flex items-center gap-3 text-sm" key={feature}>
							<span
								className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
									plan.popular ? "bg-white/14" : "bg-muted"
								}`}
							>
								<Check
									aria-hidden="true"
									className="size-3"
									strokeWidth={2.5}
								/>
							</span>
							<span className={plan.popular ? "text-white/82" : undefined}>
								{feature}
							</span>
						</li>
					))}
				</ul>

				<a
					className={`group mt-auto inline-flex h-12 touch-manipulation items-center justify-between rounded-full px-5 font-medium text-sm outline-none transition-[transform,background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:transition-none ${
						plan.popular
							? "bg-white text-[#111217] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/88"
							: "bg-foreground text-background [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/86"
					}`}
					href={plan.href}
				>
					{plan.cta}
					<span className="flex size-7 items-center justify-center rounded-full bg-current/10">
						<ArrowUpRight aria-hidden="true" className="size-3.5" />
					</span>
				</a>
			</div>
		</article>
	);
}

export function Pricing03() {
	return (
		<section className="relative overflow-hidden bg-background px-4 py-20 text-foreground sm:px-6 sm:py-28 lg:px-8">
			<div
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
			/>
			<div className="mx-auto max-w-5xl">
				<div className="mb-12 grid gap-7 md:mb-16 md:grid-cols-[1fr_0.72fr] md:items-end">
					<h2 className="max-w-xl text-balance font-medium text-4xl tracking-[-0.045em] sm:text-5xl sm:leading-[1.02]">
						Plans that scale with the work.
					</h2>
					<p className="max-w-md text-pretty text-muted-foreground text-sm leading-6 md:justify-self-end">
						Start small, then move up when your team is ready. Every plan
						includes a 14-day trial and no long-term contract.
					</p>
				</div>

				<div className="grid gap-5 lg:grid-cols-2">
					{PLANS.map((plan) => (
						<PlanCard key={plan.name} plan={plan} />
					))}
				</div>

				<p className="mt-7 text-center text-muted-foreground text-xs">
					Prices are in USD. Cancel or change your plan at any time.
				</p>
			</div>
		</section>
	);
}

export default Pricing03;
