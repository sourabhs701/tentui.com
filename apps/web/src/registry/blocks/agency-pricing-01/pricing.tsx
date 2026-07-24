"use client";

import { ArrowRight, Check } from "lucide-react";
import { useInView, useMotionValueEvent, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
						className="size-6 text-zinc-900 dark:text-zinc-100"
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
						className="size-6 text-zinc-900 dark:text-zinc-100"
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
						className="size-6 text-zinc-900 dark:text-zinc-100"
					/>
				),
				description: "Ideal for quick product validation",
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
};

function formatPrice(price: number) {
	return price.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
	});
}

const PRICE_SPRING = {
	stiffness: 80,
	damping: 14,
	mass: 0.5,
};

export function PricingCard({ plan }: { plan: PricingPlan }) {
	const priceRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(priceRef, { once: true });
	const priceSpring = useSpring(0, PRICE_SPRING);
	const [springyPrice, setSpringyPrice] = useState(0);

	useMotionValueEvent(priceSpring, "change", (latest) => {
		setSpringyPrice(Number(latest.toFixed(0)));
	});

	useEffect(() => {
		if (isInView) {
			priceSpring.set(plan.price ?? 0);
		}
	}, [isInView, plan.price, priceSpring]);

	if (plan.isHorizontal) {
		return (
			<div className="relative w-full md:col-span-2">
				<style>{`
                    .agency-pricing-badge::before {
                        content: 'Most Popular';
                        position: absolute;
                        width: 150%;
                        height: 40px;
                        background-image: linear-gradient(45deg, #ff6547 0%, #ffb144 51%, #ff7053 100%);
                        transform: rotate(-45deg) translateY(-20px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #fff;
                        font-weight: 600;
                        letter-spacing: 0.1em;
                        text-transform: uppercase;
                        box-shadow: 0 5px 10px rgba(0,0,0,0.23);
                    }
                    .agency-pricing-badge::after {
                        content: '';
                        position: absolute;
                        width: 10px;
                        bottom: 0;
                        left: 0;
                        height: 10px;
                        z-index: -1;
                        box-shadow: 140px -140px #cc3f47;
                        background-image: linear-gradient(45deg, #FF512F 0%, #F09819 51%, #FF512F 100%);
                    }
                `}</style>
				{/* Custom Badge */}
				{plan.showCustomBadge && (
					<span className="agency-pricing-badge absolute -top-2.5 -left-2.5 z-20 flex h-[150px] w-[150px] items-center justify-center overflow-hidden" />
				)}
				<div className="overflow-hidden rounded-[23px] border p-1">
					<div className="grid gap-6 rounded-[22px] bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 md:grid-cols-[1fr_auto] dark:from-zinc-900 dark:to-zinc-900">
						<div className="flex flex-col">
							<div className="mb-10 flex flex-col">
								<div
									className={`flex items-start justify-between gap-2 ${plan.showCustomBadge ? "pt-9 pl-9" : ""}`}
								>
									<div className="flex flex-col gap-2">
										{plan.icon && <div>{plan.icon}</div>}
										<h2 className="mb-2 font-medium text-[24px]">
											{plan.title}
										</h2>
									</div>
								</div>

								<p className="max-w-md text-muted-foreground text-sm">
									{plan.description}
								</p>
							</div>

							<div ref={priceRef} className="mb-6">
								<p className="mb-1 text-muted-foreground text-sm">starts at</p>
								<div className="flex items-baseline gap-2">
									<span className="font-medium text-4xl">
										{formatPrice(springyPrice)}
									</span>
									{plan.period && (
										<span className="text-muted-foreground text-sm">
											{plan.period}
										</span>
									)}
								</div>
							</div>

							<ul className="mb-10 grid grid-cols-1 gap-3 md:grid-cols-2">
								{plan.features.map((feature, featureIndex) => (
									<li
										key={featureIndex}
										className="flex w-full items-start gap-3 text-sm"
									>
										<span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<CardButton
								ctaLink={plan.ctaLink}
								cta={plan.cta}
								className="w-full"
							/>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-[23px] border border-border p-1">
			{/* Header with Icon and Title */}
			<div className="rounded-[22px] bg-gradient-to-b from-zinc-50 to-zinc-100 p-3 dark:from-zinc-900 dark:to-zinc-900">
				<div className="mb-2 flex flex-col gap-2">
					{plan.icon && <div className="mb-1">{plan.icon}</div>}
					<h2 className="mb-1 font-medium text-lg">{plan.title}</h2>
				</div>

				{/* Description Box */}
				<div className="mb-4 rounded-lg bg-muted p-2 text-muted-foreground text-xs">
					{plan.description}
				</div>

				{/* Features List */}
				<ul className="mb-4 space-y-2">
					{plan.features.map((feature, featureIndex) => (
						<li key={featureIndex} className="flex items-start gap-2 text-xs">
							<Check className="mt-0.5 size-3.5 shrink-0 text-foreground" />
							<span className="min-w-0 text-foreground">{feature}</span>
						</li>
					))}
				</ul>
			</div>

			{/* Footer Buttons */}
			<div className="flex flex-col gap-3 p-3">
				{/* Pricing */}
				<div
					ref={priceRef}
					className="flex flex-wrap items-baseline gap-1.5 px-1"
				>
					<span className="font-bold text-2xl text-foreground">
						{formatPrice(springyPrice)}
					</span>
					{plan.period && (
						<span className="text-muted-foreground text-xs">{plan.period}</span>
					)}
				</div>
				<div className="flex flex-col gap-2 px-1">
					<CardButton
						ctaLink={plan.ctaLink}
						cta={plan.cta}
						className="w-full"
					/>
				</div>
			</div>
		</div>
	);
}

function CardButton({
	ctaLink,
	cta,
	className,
}: {
	ctaLink: string;
	cta: string;
	className?: string;
}) {
	function handleClick() {
		if (ctaLink === "#") return;

		if (ctaLink.startsWith("http")) {
			window.open(ctaLink, "_blank", "noopener,noreferrer");
			return;
		}

		window.location.assign(ctaLink);
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`group/agency-cta inline-flex h-10 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-foreground/10 bg-foreground bg-clip-padding px-4 font-medium text-background text-sm shadow-[inset_0_1px_0_rgb(255_255_255_/_0.16),0_1px_2px_rgb(0_0_0_/_0.2)] outline-none transition-[transform,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-foreground/90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:transition-none ${className ?? ""}`}
		>
			<span className="text-sm">{cta}</span>
			<span className="block h-4 w-px bg-background/25" />
			<span
				aria-hidden="true"
				className="size-6 overflow-hidden rounded-full bg-background/10"
			>
				<span className="flex w-12 -translate-x-1/2 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/agency-cta:translate-x-0 motion-reduce:transform-none motion-reduce:transition-none">
					<span className="flex size-6 shrink-0">
						<ArrowRight className="m-auto size-3" />
					</span>
					<span className="flex size-6 shrink-0">
						<ArrowRight className="m-auto size-3" />
					</span>
				</span>
			</span>
		</button>
	);
}

// ── Component ────────────────────────────────────────────────────────
export function Pricing() {
	const [activeTab, setActiveTab] = useState("landing");
	const activeCategory =
		tabCategories.find((category) => category.value === activeTab) ??
		tabCategories[0];

	return (
		<div
			id="pricing"
			className="mx-auto max-w-4xl space-y-6 border border-border px-4 py-12 md:space-y-8 md:py-16"
		>
			{/* Section Header */}
			<div className="mb-8 text-center md:mb-16">
				<h1 className="mb-3 font-medium text-2xl md:mb-4 md:text-4xl">
					No Contract, No Surprises
				</h1>
				<p className="mx-auto max-w-2xl px-2 text-muted-foreground text-sm md:px-0 md:text-base">
					Consistent Pricing and Value Each Month, with the Flexibility to
					Cancel Anytime
				</p>
			</div>

			{/* Two-column layout: tabs + plans (left) | static popular (right) */}
			<div className="grid grid-cols-1 gap-6 border-border border-y py-4 md:grid-cols-2 md:gap-8 md:py-6">
				{/* ── Left: Tab Navigation + Dynamic Plans ── */}
				<div className="flex flex-col gap-4">
					<div
						role="group"
						aria-label="Project type"
						className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
					>
						{tabCategories.map((category) => {
							const isActive = category.value === activeTab;

							return (
								<button
									key={category.value}
									type="button"
									aria-pressed={isActive}
									onClick={() => setActiveTab(category.value)}
									className={`inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 font-medium text-sm outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:transition-none ${
										isActive
											? "border-transparent bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
											: "border-transparent text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
									}`}
								>
									{category.label}
								</button>
							);
						})}
					</div>

					<div className="mt-2 flex flex-col gap-4">
						{activeCategory.plans.map((plan) => (
							<PricingCard key={plan.title} plan={plan} />
						))}
					</div>
				</div>

				{/* ── Right: Static "Most Popular" Plan ── */}
				<div className="flex flex-col">
					<PricingCard plan={mostPopularPlan} />
				</div>
			</div>
		</div>
	);
}

export default Pricing;
