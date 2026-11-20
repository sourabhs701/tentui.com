"use client";

import { PlusIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

import { cn } from "@/lib/utils";

export interface FaqItem {
	id: string;
	question: string;
	answer: ReactNode;
}

export interface Faq02Props {
	title?: ReactNode;
	description?: ReactNode;
	faqs?: FaqItem[];
	contactHref?: string;
	className?: string;
}

const FAQS = [
	{
		id: "getting-started",
		question: "How long does it take to get up and running?",
		answer:
			"Most teams are live in under an hour. Connect your workspace, invite your teammates, and import existing projects from a CSV or one of our native integrations. Our onboarding checklist walks you through every step.",
	},
	{
		id: "free-trial",
		question: "Is there a free trial, and do I need a credit card?",
		answer:
			"Every plan includes a 14-day free trial with full access to all features. No credit card is required to start, and you can upgrade, downgrade, or cancel at any time from your billing settings.",
	},
	{
		id: "data-security",
		question: "How do you keep our data secure?",
		answer:
			"All data is encrypted in transit with TLS 1.3 and at rest with AES-256. We are SOC 2 Type II certified, run regular third-party penetration tests, and offer SSO and SCIM provisioning on the Business plan.",
	},
	{
		id: "integrations",
		question: "Which tools do you integrate with?",
		answer:
			"We connect with Slack, GitHub, Linear, Figma, Notion, and more than 40 other tools out of the box. For anything else, our REST API and webhooks let you build custom workflows in minutes.",
	},
	{
		id: "seat-changes",
		question: "What happens when I add or remove seats?",
		answer:
			"Seat changes take effect immediately and are prorated on your next invoice. You only pay for active members, and guests with view-only access are always free.",
	},
	{
		id: "support",
		question: "What kind of support do you offer?",
		answer:
			"All plans include email support with a one-business-day response time. Business customers get priority chat support and a dedicated success manager to help with rollout and training.",
	},
] satisfies FaqItem[];

const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

function formatIndex(index: number) {
	return String(index + 1).padStart(2, "0");
}

export default function Faq02({
	title = "Everything you need to know",
	description = "Answers to the questions we hear most from teams evaluating the product. Can't find what you're looking for? We're happy to help.",
	faqs = FAQS,
	contactHref = "mailto:support@example.com",
	className,
}: Faq02Props = {}) {
	const headingId = useId();
	const defaultValue = faqs.length > 0 ? [faqs[0].id] : [];

	return (
		<section
			aria-labelledby={headingId}
			className={cn(
				"w-full bg-background px-4 py-20 font-sans sm:px-6 sm:py-28",
				className,
			)}
		>
			<div className="mx-auto w-full max-w-4xl">
				<header className="mx-auto flex max-w-2xl flex-col items-center text-center">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
						FAQ
					</p>
					<h2
						className="mt-4 text-balance font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.03em] sm:text-5xl"
						id={headingId}
					>
						{title}
					</h2>
					<p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
						{description}
					</p>
				</header>

				<Accordion
					className="mt-14 border-border border-y sm:mt-16"
					defaultValue={defaultValue}
				>
					{faqs.map((faq, index) => (
						<AccordionItem
							className="group/faq-item border-border"
							key={faq.id}
							value={faq.id}
						>
							<AccordionTrigger className="group/faq-trigger [&>svg]:hidden! grid touch-manipulation grid-cols-[2rem_minmax(0,1fr)_2.25rem] items-start gap-x-3 rounded-none border-0 py-6 transition-none hover:no-underline sm:grid-cols-[3.5rem_minmax(0,1fr)_2.25rem] sm:gap-x-5 sm:py-7">
								<span
									aria-hidden="true"
									className={cn(
										"font-mono text-muted-foreground/70 text-xs tabular-nums leading-6 tracking-wider transition-colors duration-200 group-hover/faq-trigger:text-muted-foreground group-aria-expanded/faq-trigger:text-foreground motion-reduce:transition-none sm:text-sm sm:leading-7",
										EASE_OUT,
									)}
								>
									{formatIndex(index)}
								</span>
								<span className="text-pretty text-left font-normal text-base text-foreground leading-6 sm:text-lg sm:leading-7">
									{faq.question}
								</span>
								<span
									aria-hidden="true"
									className={cn(
										"-my-1.5 flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-[transform,background-color,border-color,color] duration-200 group-hover/faq-trigger:bg-muted group-hover/faq-trigger:text-foreground group-active/faq-trigger:scale-[0.96] group-aria-expanded/faq-trigger:border-primary group-aria-expanded/faq-trigger:bg-primary group-aria-expanded/faq-trigger:text-primary-foreground motion-reduce:transition-none sm:-my-1 [&_svg]:size-4",
										EASE_OUT,
									)}
								>
									<PlusIcon
										className={cn(
											"transition-transform duration-200 group-aria-expanded/faq-trigger:rotate-45 motion-reduce:transition-none",
											EASE_OUT,
										)}
									/>
								</span>
							</AccordionTrigger>
							<AccordionContent className="pr-2 pb-7 pl-[2.75rem] sm:pr-14 sm:pb-8 sm:pl-[4.75rem]">
								<p className="max-w-2xl text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
									{faq.answer}
								</p>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>

				<p className="mt-10 text-center text-muted-foreground text-sm">
					Still have questions?{" "}
					<a
						className={cn(
							"rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 outline-none transition-[text-decoration-color] duration-150 hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
							EASE_OUT,
						)}
						href={contactHref}
					>
						Talk to our team
					</a>
					.
				</p>
			</div>
		</section>
	);
}
