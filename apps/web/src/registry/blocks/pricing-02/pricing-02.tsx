"use client";

import { ArrowRight, Check } from "lucide-react";
import {
	useInView,
	useMotionValueEvent,
	useReducedMotion,
	useSpring,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { DashboardIcon, MousePointerClick01Icon, RocketIcon } from "./icons";

export type PricingPlan = {
	title: string;
	description: string;
	price: number;
	period: string;
	features: string[];
	cta: string;
	ctaLink: string;
	isHorizontal?: boolean;
	showCustomBadge?: boolean;
	showStartsAt?: boolean;
	icon?: React.ReactNode;
};

// ── Tab categories with their plans ──────────────────────────────────
type TabCategory = {
	label: string;
	value: string;
	plans: PricingPlan[];
};

const tabCategories: TabCategory[] = [
	{
		label: "Landing",
		value: "landing",
		plans: [
			{
				title: "Landing Page",
				icon: (
					<MousePointerClick01Icon
						intervalDuration={2000}
						className="size-6 text-foreground"
					/>
				),
				description: "Perfect to build your brand and get leads.",
				price: 1995,
				period: "one time",
				features: [
					"Design + Development",
					"Search Engine Optimization",
					"Responsive Design",
					"4-7 days turnaround time",
					"90+ Web vitals performance",
				],
				cta: "Book a Call",
				ctaLink: "#",
			},
		],
	},
	{
		label: "Full Site",
		value: "fullsite",
		plans: [
			{
				title: "Multi Page Website",
				icon: (
					<DashboardIcon
						intervalDuration={2000}
						className="size-6 text-foreground"
					/>
				),
				description: "Best for startups and businesses.",
				price: 2995,
				period: "/mo",
				features: [
					"Design + Development",
					"Search Engine Optimization",
					"Responsive Design",
					"+$300 per additional page",
					"7-10 days turnaround time",
				],
				cta: "Book a Call",
				ctaLink: "#",
			},
		],
	},
	{
		label: "Product",
		value: "product",
		plans: [
			{
				title: "MVP Development",
				icon: (
					<RocketIcon
						intervalDuration={2000}
						className="size-6 text-foreground"
					/>
				),
				description: "Ideal for quick product validation.",
				price: 2995,
				period: "one time",
				features: [
					"Design + Development + Deployment",
					"Core Feature Implementation",
					"Responsive Design",
					"Idea to Production",
					"10-15 days turnaround time",
				],
				cta: "Book a Call",
				ctaLink: "#",
			},
		],
	},
];

// ── Static "Most Popular" plan (always visible) ──────────────────────
const mostPopularPlan: PricingPlan = {
	title: "Design/Dev Retainer",
	description:
		"A dedicated engineer for a fraction of the cost of a full-time hire.",
	price: 2995,
	period: "/mo",
	features: [
		"Unlimited design & dev requests",
		"Average 48-hr turnaround",
		"Dedicated async channel",
		"Pause or cancel anytime",
	],
	cta: "Get Started",
	ctaLink: "#",
	isHorizontal: true,
	showCustomBadge: true,
	showStartsAt: true,
};

function formatPrice(price: number) {
	return price.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
}

const PRICE_SPRING = {
	stiffness: 80,
	damping: 14,
	mass: 0.5,
};

/** Counts the price up from 0 once it scrolls into view (instant with reduced motion). */
function useAnimatedPrice(price: number) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true });
	const shouldReduceMotion = useReducedMotion();
	const spring = useSpring(0, PRICE_SPRING);
	const [displayPrice, setDisplayPrice] = useState(0);

	useMotionValueEvent(spring, "change", (latest) => {
		setDisplayPrice(Math.round(latest));
	});

	useEffect(() => {
		if (shouldReduceMotion) {
			spring.jump(price);
			setDisplayPrice(price);
			return;
		}
		if (isInView) spring.set(price);
	}, [isInView, price, shouldReduceMotion, spring]);

	return { ref, displayPrice };
}

function Price({
	price,
	period,
	className,
	amountClassName,
}: {
	price: number;
	period?: string;
	className?: string;
	amountClassName?: string;
}) {
	const { ref, displayPrice } = useAnimatedPrice(price);

	return (
		<div
			ref={ref}
			className={cn("flex flex-wrap items-baseline gap-1.5", className)}
		>
			<span className="sr-only">
				{formatPrice(price)}
				{period ? ` ${period}` : ""}
			</span>
			<span
				aria-hidden="true"
				className={cn(
					"font-semibold text-3xl text-foreground tabular-nums tracking-tight",
					amountClassName,
				)}
			>
				{formatPrice(displayPrice)}
			</span>
			{period && (
				<span aria-hidden="true" className="text-muted-foreground text-sm">
					{period}
				</span>
			)}
		</div>
	);
}

function FeatureList({
	features,
	className,
}: {
	features: string[];
	className?: string;
}) {
	return (
		<ul className={cn("grid gap-2.5", className)}>
			{features.map((feature) => (
				<li
					key={feature}
					className="flex items-start gap-2.5 text-foreground text-sm leading-5"
				>
					<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
						<Check aria-hidden="true" className="size-2.5" strokeWidth={3} />
					</span>
					<span className="min-w-0">{feature}</span>
				</li>
			))}
		</ul>
	);
}

/** Diagonal corner ribbon. Box is 96px, offset 8px outside the card; band covers x+y ∈ [56, 96]. */
function MostPopularRibbon() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute -top-2 -left-2 z-10 size-24 overflow-hidden"
		>
			{/* Fold shadows peeking out where the band wraps behind the card */}
			<span className="absolute bottom-0 left-0 size-2 bg-orange-800 dark:bg-orange-900" />
			<span className="absolute top-0 right-0 size-2 bg-orange-800 dark:bg-orange-900" />
			<span className="absolute top-[38px] left-[38px] flex h-7 w-36 -translate-x-1/2 -translate-y-1/2 -rotate-45 items-center justify-center bg-linear-to-r from-orange-600 via-orange-500 to-orange-600 font-semibold text-[10px] text-white uppercase tracking-[0.12em] shadow-md [text-shadow:0_1px_1px_rgb(0_0_0/0.25)]">
				Most popular
			</span>
		</div>
	);
}

export function PricingCard({ plan }: { plan: PricingPlan }) {
	if (plan.isHorizontal) {
		return (
			<div className="relative h-full">
				{plan.showCustomBadge && <MostPopularRibbon />}
				<Card className="h-full gap-0 rounded-3xl p-1 shadow-sm ring-foreground/15">
					<div className="flex h-full flex-col rounded-[20px] bg-linear-to-b from-muted/30 to-muted/70 p-5 md:p-6">
						<div
							className={cn(
								"flex flex-col gap-2",
								plan.showCustomBadge && "pt-10",
							)}
						>
							{plan.icon && <div>{plan.icon}</div>}
							<h3 className="font-medium text-2xl text-foreground tracking-tight">
								{plan.title}
								{plan.showCustomBadge && (
									<span className="sr-only"> (most popular)</span>
								)}
							</h3>
							<p className="max-w-md text-pretty text-muted-foreground text-sm leading-relaxed">
								{plan.description}
							</p>
						</div>

						<div className="mt-8">
							{plan.showStartsAt && (
								<p className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">
									Starts at
								</p>
							)}
							<Price
								price={plan.price}
								period={plan.period}
								amountClassName="text-4xl md:text-5xl"
							/>
						</div>

						<FeatureList
							features={plan.features}
							className="mt-8 gap-3 sm:grid-cols-2 sm:gap-x-6"
						/>

						<CardButton
							ctaLink={plan.ctaLink}
							cta={plan.cta}
							wrapperClassName="mt-auto pt-8"
						/>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<Card className="h-full gap-0 rounded-3xl p-1 shadow-xs">
			<div className="flex flex-1 flex-col gap-4 rounded-[20px] bg-linear-to-b from-muted/30 to-muted/70 p-4 md:p-5">
				<div className="flex flex-col gap-3">
					{plan.icon && <div>{plan.icon}</div>}
					<h3 className="font-medium text-foreground text-lg tracking-tight">
						{plan.title}
					</h3>
				</div>

				<p className="rounded-lg bg-background/70 px-3 py-2 text-muted-foreground text-sm ring-1 ring-border">
					{plan.description}
				</p>

				<FeatureList features={plan.features} />
			</div>

			<div className="flex flex-col gap-3 px-4 pt-4 pb-4 md:px-5">
				<Price price={plan.price} period={plan.period} />
				<CardButton ctaLink={plan.ctaLink} cta={plan.cta} />
			</div>
		</Card>
	);
}

function CardButton({
	ctaLink,
	cta,
	className,
	wrapperClassName,
}: {
	ctaLink: string;
	cta: string;
	className?: string;
	wrapperClassName?: string;
}) {
	const isExternal = ctaLink.startsWith("http");

	return (
		<div className={wrapperClassName}>
			<a
				href={ctaLink}
				{...(isExternal
					? { target: "_blank", rel: "noopener noreferrer" }
					: {})}
				className={cn(
					buttonVariants({ size: "lg" }),
					"group/cta h-10 w-full gap-2 rounded-lg px-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.2)] hover:bg-primary/90 motion-reduce:transition-none",
					className,
				)}
			>
				<span>{cta}</span>
				<span
					aria-hidden="true"
					className="block h-4 w-px bg-primary-foreground/25"
				/>
				<span
					aria-hidden="true"
					className="size-6 overflow-hidden rounded-full bg-primary-foreground/10"
				>
					<span className="flex w-12 -translate-x-1/2 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cta:translate-x-0 group-focus-visible/cta:translate-x-0 motion-reduce:transition-none">
						<span className="flex size-6 shrink-0">
							<ArrowRight className="m-auto size-3" />
						</span>
						<span className="flex size-6 shrink-0">
							<ArrowRight className="m-auto size-3" />
						</span>
					</span>
				</span>
			</a>
		</div>
	);
}

// ── Component ────────────────────────────────────────────────────────
export function Pricing02() {
	return (
		<section
			id="pricing"
			aria-labelledby="pricing-02-heading"
			className="mx-auto max-w-4xl border border-border bg-background px-4 py-12 text-foreground md:px-6 md:py-16"
		>
			{/* Section Header */}
			<div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
				<h2
					id="pricing-02-heading"
					className="text-balance font-medium text-3xl tracking-tight md:text-4xl"
				>
					No Contract, No Surprises
				</h2>
				<p className="mt-3 text-pretty text-muted-foreground text-sm md:mt-4 md:text-base">
					Consistent pricing and value each month, with the flexibility to
					cancel anytime.
				</p>
			</div>

			{/* Two-column layout: tabs + plans (left) | static popular (right) */}
			<div className="grid grid-cols-1 gap-8 border-border border-y py-6 md:grid-cols-2 md:gap-6 md:py-8">
				{/* ── Left: Tab Navigation + Dynamic Plans ── */}
				<Tabs defaultValue={tabCategories[0].value} className="gap-4">
					<TabsList aria-label="Project type" className="w-full">
						{tabCategories.map((category) => (
							<TabsTrigger key={category.value} value={category.value}>
								{category.label}
							</TabsTrigger>
						))}
					</TabsList>

					{tabCategories.map((category) => (
						<TabsContent
							key={category.value}
							value={category.value}
							className="flex flex-col gap-4 rounded-3xl focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							{category.plans.map((plan) => (
								<PricingCard key={plan.title} plan={plan} />
							))}
						</TabsContent>
					))}
				</Tabs>

				{/* ── Right: Static "Most Popular" Plan ── */}
				<PricingCard plan={mostPopularPlan} />
			</div>
		</section>
	);
}

export default Pricing02;
