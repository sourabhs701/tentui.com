"use client";

import { CheckIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	type AnimatedTab,
	AnimatedTabs,
} from "@/registry/components/animated-tabs";

type BillingCycle = "monthly" | "annual";
type PlanId = "starter" | "growth" | "scale";
type LimitKey = "workspaces" | "ticketsPerMonth" | "agentCredits";
type PlanLimits = Record<LimitKey, number>;

type PricingPlan = {
	id: PlanId;
	name: string;
	tagline: string;
	monthly: number;
	annual: number;
	unit: string;
	popular?: boolean;
	limits: PlanLimits;
	features: readonly string[];
};

const UNLIMITED = Number.POSITIVE_INFINITY;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const USD_PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const PLANS: readonly PricingPlan[] = [
	{
		id: "starter",
		name: "Starter",
		tagline: "For small businesses and startups.",
		monthly: 12,
		annual: 9,
		unit: "/mo.",
		limits: {
			workspaces: 3,
			ticketsPerMonth: 1_000,
			agentCredits: 800,
		},
		features: [
			"1,000 tickets every month",
			"800 AI credits every month",
			"3 workspaces",
			"Real-time customer chat",
			"Add more AI credits anytime",
		],
	},
	{
		id: "growth",
		name: "Growth",
		tagline: "For growing support teams.",
		monthly: 19,
		annual: 15,
		unit: "/mo.",
		popular: true,
		limits: {
			workspaces: 5,
			ticketsPerMonth: 10_000,
			agentCredits: 2_000,
		},
		features: [
			"Everything in Starter",
			"10,000 tickets every month",
			"2,000 AI credits every month",
			"Up to 5 workspaces",
			"Add more AI credits anytime",
		],
	},
	{
		id: "scale",
		name: "Scale",
		tagline: "For established organizations.",
		monthly: 39,
		annual: 31,
		unit: "/mo.",
		limits: {
			workspaces: UNLIMITED,
			ticketsPerMonth: 50_000,
			agentCredits: 10_000,
		},
		features: [
			"Everything in Growth",
			"50,000 tickets every month",
			"10,000 AI credits every month",
			"Unlimited workspaces",
			"Priority support",
		],
	},
];

const LIMIT_ROWS: ReadonlyArray<{ label: string; key: LimitKey }> = [
	{ label: "Workspaces", key: "workspaces" },
	{ label: "Tickets / month", key: "ticketsPerMonth" },
	{ label: "AI credits / month", key: "agentCredits" },
];

const MAX_SAVINGS_PERCENT = Math.max(
	...PLANS.map((plan) => Math.round((1 - plan.annual / plan.monthly) * 100)),
);

const BILLING_TABS: readonly AnimatedTab[] = [
	{ value: "monthly", label: "Monthly" },
	{
		value: "annual",
		label: (
			<span className="flex items-center gap-1.5">
				Annual
				<Badge variant="secondary">Save {MAX_SAVINGS_PERCENT}%</Badge>
			</span>
		),
	},
];

const CTA_CLASS_NAME =
	"touch-manipulation transition-[transform,background-color,color,box-shadow] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

function isUnlimited(value: number) {
	return !Number.isFinite(value);
}

function formatLimit(value: number) {
	if (isUnlimited(value)) return "Unlimited";

	return value
		.toLocaleString("en-US", {
			notation: "compact",
			maximumFractionDigits: 1,
		})
		.toLowerCase();
}

function formatPrice(value: number) {
	return USD_PRICE_FORMATTER.format(value);
}

function checkoutHref(plan: PricingPlan, cycle: BillingCycle) {
	return `/signup?plan=${plan.id}&billing=${cycle}`;
}

function GridTick({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-20 flex size-4 items-center justify-center",
				className,
			)}
		>
			<span className="absolute h-px w-full bg-foreground/20" />
			<span className="absolute h-full w-px bg-foreground/20" />
		</span>
	);
}

function GridRect({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn("pointer-events-none absolute z-20 size-1", className)}
		>
			<span className="block size-full bg-foreground/20" />
		</span>
	);
}

function PricingHeading({ level }: { level: "h1" | "h2" }) {
	const className =
		"text-balance font-normal text-[2.4rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl";
	const animation = {
		initial: { opacity: 0, transform: "translateY(18px)" },
		animate: { opacity: 1, transform: "translateY(0px)" },
		transition: { duration: 0.55, ease: EASE_OUT },
	};

	if (level === "h1") {
		return (
			<motion.h1 className={className} {...animation}>
				Choose your <em className="italic">pricing plan</em>
			</motion.h1>
		);
	}

	return (
		<motion.h2
			className={className}
			initial={animation.initial}
			transition={animation.transition}
			viewport={{ once: true }}
			whileInView={animation.animate}
		>
			Choose your <em className="italic">pricing plan</em>
		</motion.h2>
	);
}

export type Pricing01Props = {
	headingLevel?: "h1" | "h2";
	showLimits?: boolean;
};

export function Pricing01({
	headingLevel = "h2",
	showLimits = true,
}: Pricing01Props) {
	const [cycle, setCycle] = useState<BillingCycle>("monthly");
	const PlanHeading = headingLevel === "h1" ? "h2" : "h3";

	return (
		<MotionConfig reducedMotion="user">
			<section className="relative w-full bg-background px-4 py-20 text-foreground sm:px-6 lg:px-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
					<div className="mx-auto flex max-w-2xl flex-col gap-5 text-center">
						<PricingHeading level={headingLevel} />
						<motion.p
							animate={{ opacity: 1, transform: "translateY(0px)" }}
							className="mx-auto max-w-md text-balance text-base text-muted-foreground leading-relaxed"
							initial={{ opacity: 0, transform: "translateY(14px)" }}
							transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT }}
						>
							Flexible plans designed to scale with your support needs.
						</motion.p>
					</div>

					<div className="flex justify-center">
						<AnimatedTabs
							aria-label="Billing cycle"
							className="[&_[data-slot=animated-tabs-trigger]]:h-10 [&_[data-slot=animated-tabs-trigger]]:px-5"
							layoutId="pricing-01-billing-indicator"
							onValueChange={(value) => {
								if (value === "monthly" || value === "annual") setCycle(value);
							}}
							tabs={BILLING_TABS}
							value={cycle}
						/>
					</div>

					<div className="flex flex-col gap-4">
						<div className="relative grid grid-cols-1 border border-border bg-background text-foreground lg:grid-cols-3">
							<GridTick className="-top-2 -left-2" />
							<GridTick className="-top-2 -right-2" />
							{showLimits ? null : (
								<>
									<GridTick className="-bottom-2 -left-2" />
									<GridTick className="-right-2 -bottom-2" />
								</>
							)}

							{PLANS.map((plan, index) => {
								const price = cycle === "annual" ? plan.annual : plan.monthly;

								return (
									<motion.article
										className={cn(
											"relative flex flex-col overflow-hidden border-border py-4",
											index < PLANS.length - 1 && "border-b lg:border-b-0",
											index < 2 && "lg:border-r",
										)}
										initial={{ opacity: 0, transform: "translateY(12px)" }}
										key={plan.id}
										transition={{
											duration: 0.4,
											delay: index * 0.06,
											ease: EASE_OUT,
										}}
										viewport={{ once: true, amount: 0.12 }}
										whileInView={{
											opacity: 1,
											transform: "translateY(0px)",
										}}
									>
										{plan.popular ? (
											<div
												aria-hidden="true"
												className="pointer-events-none absolute inset-0"
												style={{
													background:
														"radial-gradient(125% 125% at 50% 10%, var(--background) 40%, var(--primary) 100%)",
												}}
											/>
										) : null}

										<div className="relative z-10 flex flex-1 flex-col gap-5 p-6">
											<div className="flex flex-col gap-5">
												<div className="flex min-w-0 flex-1 flex-col gap-2">
													<div className="flex w-full items-center justify-between gap-2.5">
														<PlanHeading className="font-normal text-2xl text-foreground tracking-tight">
															{plan.name}
														</PlanHeading>
														{plan.popular ? <Badge>Popular</Badge> : null}
													</div>
													<p className="text-muted-foreground text-sm leading-relaxed">
														{plan.tagline}
													</p>
												</div>
											</div>

											<div className="flex items-baseline gap-1.5">
												<span className="font-normal text-4xl text-foreground tracking-tight">
													{formatPrice(price)}
												</span>
												<span className="text-muted-foreground text-sm">
													{plan.unit}
												</span>
											</div>
											<p className="h-4 text-muted-foreground text-xs">
												{cycle === "annual" ? "billed annually" : ""}
											</p>
											<a
												aria-label={`Get started with the ${plan.name} plan`}
												className={cn(
													buttonVariants({
														variant: plan.popular ? "default" : "secondary",
													}),
													CTA_CLASS_NAME,
													"my-4 w-full",
												)}
												href={checkoutHref(plan, cycle)}
											>
												Get Started
											</a>

											<ul className="flex flex-col gap-3">
												{plan.features.map((feature) => (
													<li
														className="flex items-start gap-2.5 text-foreground/80 text-sm"
														key={feature}
													>
														<CheckIcon
															aria-hidden="true"
															className={cn(
																"mt-0.5 size-4 shrink-0",
																plan.popular
																	? "text-primary"
																	: "text-foreground",
															)}
														/>
														<span>{feature}</span>
													</li>
												))}
											</ul>
										</div>
									</motion.article>
								);
							})}
						</div>

						{showLimits ? (
							<div className="relative border border-border bg-background text-foreground">
								<GridTick className="-bottom-2 -left-2" />
								<GridTick className="-right-2 -bottom-2" />

								<div className="relative grid grid-cols-1 bg-muted/30 md:grid-cols-4">
									<GridRect className="-top-[2px] -left-[2px]" />
									<GridRect className="-top-[2px] -right-[3px]" />
									<GridRect className="-bottom-[2px] -left-[2px]" />
									<GridRect className="-right-[3px] -bottom-[2px]" />
									<div className="p-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Limits
									</div>
									{PLANS.map((plan) => (
										<div
											className="hidden border-border border-l p-4 text-center font-medium text-foreground text-sm md:block"
											key={plan.id}
										>
											{plan.name}
										</div>
									))}
								</div>

								{LIMIT_ROWS.map((row) => (
									<div
										className="grid grid-cols-2 border-border border-t md:grid-cols-4"
										key={row.key}
									>
										<div className="col-span-2 p-4 text-foreground/80 text-sm md:col-span-1">
											{row.label}
										</div>
										{PLANS.map((plan) => {
											const value = plan.limits[row.key];

											return (
												<div
													className="flex items-center justify-between border-border p-4 text-sm md:justify-center md:border-l"
													key={plan.id}
												>
													<span className="text-muted-foreground text-xs uppercase tracking-wide md:hidden">
														{plan.name}
													</span>
													{isUnlimited(value) ? (
														<span className="flex items-center gap-1.5 text-foreground">
															<CheckIcon
																aria-hidden="true"
																className="size-3.5"
															/>
															Unlimited
														</span>
													) : (
														<span className="text-foreground/80">
															{formatLimit(value)}
														</span>
													)}
												</div>
											);
										})}
									</div>
								))}
							</div>
						) : null}
					</div>
				</div>
			</section>
		</MotionConfig>
	);
}

export default Pricing01;
