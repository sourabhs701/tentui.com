"use client";

import { CheckIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
				<Badge
					className="in-data-[state=active]:bg-primary-foreground/15 in-data-[state=active]:text-primary-foreground"
					variant="secondary"
				>
					Save {MAX_SAVINGS_PERCENT}%
				</Badge>
			</span>
		),
	},
];

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
			<span className="absolute h-px w-full bg-foreground/25" />
			<span className="absolute h-full w-px bg-foreground/25" />
		</span>
	);
}

function PlanPrice({
	plan,
	cycle,
}: {
	plan: PricingPlan;
	cycle: BillingCycle;
}) {
	const price = cycle === "annual" ? plan.annual : plan.monthly;

	return (
		<div className="flex flex-col gap-1.5">
			<p className="flex items-baseline gap-1.5">
				<span className="relative inline-flex overflow-hidden">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.span
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							className="font-normal text-4xl text-foreground tabular-nums tracking-tight"
							exit={{ opacity: 0, y: -12, filter: "blur(2px)" }}
							initial={{ opacity: 0, y: 12, filter: "blur(2px)" }}
							key={price}
							transition={{ duration: 0.25, ease: EASE_OUT }}
						>
							{formatPrice(price)}
						</motion.span>
					</AnimatePresence>
				</span>
				<span className="text-muted-foreground text-sm">/ month</span>
			</p>
			<p className="text-muted-foreground text-xs">
				{cycle === "annual"
					? `${formatPrice(plan.annual * 12)} billed yearly`
					: "Billed monthly"}
			</p>
		</div>
	);
}

function PlanCard({
	plan,
	cycle,
	headingLevel,
}: {
	plan: PricingPlan;
	cycle: BillingCycle;
	headingLevel: "h2" | "h3";
}) {
	const PlanHeading = headingLevel;
	const headingId = useId();

	return (
		<article
			aria-labelledby={headingId}
			className={cn(
				"relative flex flex-col border-border not-last:border-b lg:not-last:border-r lg:not-last:border-b-0",
				plan.popular && "bg-card",
			)}
		>
			{plan.popular ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_10%,transparent_40%,color-mix(in_oklch,var(--primary)_22%,transparent)_100%)]"
				/>
			) : null}

			<div className="relative flex flex-1 flex-col gap-6 p-6 sm:p-8">
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-3">
						<PlanHeading
							className="font-normal text-2xl text-foreground tracking-tight"
							id={headingId}
						>
							{plan.name}
						</PlanHeading>
						{plan.popular ? <Badge>Popular</Badge> : null}
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{plan.tagline}
					</p>
				</div>

				<PlanPrice cycle={cycle} plan={plan} />

				<Button
					aria-label={`Get started with the ${plan.name} plan`}
					className="w-full touch-manipulation active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
					nativeButton={false}
					render={<a href={checkoutHref(plan, cycle)} />}
					size="lg"
					variant={plan.popular ? "default" : "secondary"}
				>
					Get started
				</Button>

				<ul className="flex flex-col gap-3 border-border border-t pt-6">
					{plan.features.map((feature) => (
						<li
							className="flex items-start gap-2.5 text-foreground/80 text-sm"
							key={feature}
						>
							<CheckIcon
								aria-hidden="true"
								className={cn(
									"mt-0.5 size-4 shrink-0",
									plan.popular ? "text-primary" : "text-muted-foreground",
								)}
							/>
							<span>{feature}</span>
						</li>
					))}
				</ul>
			</div>
		</article>
	);
}

function LimitsTable() {
	return (
		<div className="relative border border-border bg-background text-foreground">
			<GridTick className="-bottom-2 -left-2" />
			<GridTick className="-right-2 -bottom-2" />

			<div className="w-full overflow-x-auto">
				<table className="w-full min-w-[20rem] table-fixed border-collapse text-sm">
					<caption className="sr-only">Usage limits by plan</caption>
					<colgroup>
						<col className="w-[31%] md:w-1/4" />
						<col />
						<col />
						<col />
					</colgroup>
					<thead className="bg-muted/40">
						<tr>
							<th
								className="px-3 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide sm:px-4"
								scope="col"
							>
								Limits
							</th>
							{PLANS.map((plan) => (
								<th
									className="border-border border-l px-1 py-3 text-center font-medium text-foreground sm:px-4"
									key={plan.id}
									scope="col"
								>
									{plan.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{LIMIT_ROWS.map((row) => (
							<tr className="border-border border-t" key={row.key}>
								<th
									className="px-3 py-3 text-left font-normal text-foreground/80 sm:px-4 sm:py-4"
									scope="row"
								>
									{row.label}
								</th>
								{PLANS.map((plan) => {
									const value = plan.limits[row.key];

									return (
										<td
											className="border-border border-l px-1 py-3 text-center tabular-nums sm:px-4 sm:py-4"
											key={plan.id}
										>
											{isUnlimited(value) ? (
												<span className="inline-flex items-center justify-center gap-1.5 text-foreground">
													<CheckIcon
														aria-hidden="true"
														className="hidden size-3.5 text-primary sm:block"
													/>
													Unlimited
												</span>
											) : (
												<span className="text-foreground/80">
													{formatLimit(value)}
												</span>
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
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
	const titleId = useId();
	const Heading = headingLevel;

	return (
		<MotionConfig reducedMotion="user">
			<section
				aria-labelledby={titleId}
				className="relative w-full bg-background px-4 py-16 text-foreground sm:px-6 sm:py-20 lg:px-8"
			>
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
					<header className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
						<Heading
							className="text-balance font-normal text-[2.5rem] text-foreground leading-[1.05] tracking-[-0.02em] sm:text-6xl"
							id={titleId}
						>
							Choose your <em className="italic">pricing plan</em>
						</Heading>
						<p className="mx-auto max-w-md text-balance text-base text-muted-foreground leading-relaxed">
							Flexible plans designed to scale with your support needs.
						</p>
					</header>

					<div className="flex justify-center">
						<AnimatedTabs
							aria-label="Billing cycle"
							className="[&_[data-slot=animated-tabs-trigger]]:h-9 [&_[data-slot=animated-tabs-trigger]]:px-4 sm:[&_[data-slot=animated-tabs-trigger]]:px-5"
							layoutId="pricing-01-billing-indicator"
							onValueChange={(value) => {
								if (value === "monthly" || value === "annual") setCycle(value);
							}}
							tabs={BILLING_TABS}
							value={cycle}
						/>
					</div>

					<div className="flex flex-col gap-4">
						<div className="relative grid grid-cols-1 border border-border bg-background lg:grid-cols-3">
							<GridTick className="-top-2 -left-2" />
							<GridTick className="-top-2 -right-2" />
							{showLimits ? null : (
								<>
									<GridTick className="-bottom-2 -left-2" />
									<GridTick className="-right-2 -bottom-2" />
								</>
							)}

							{PLANS.map((plan) => (
								<PlanCard
									cycle={cycle}
									headingLevel={headingLevel === "h1" ? "h2" : "h3"}
									key={plan.id}
									plan={plan}
								/>
							))}
						</div>

						{showLimits ? <LimitsTable /> : null}
					</div>
				</div>
			</section>
		</MotionConfig>
	);
}

export default Pricing01;
