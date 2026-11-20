"use client";

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

export interface FaqSectionProps {
	title?: ReactNode;
	description?: ReactNode;
	faqs?: FaqItem[];
	className?: string;
}

const FAQS = [
	{
		id: "go-live",
		question: "Lorem ipsum dolor sit amet?",
		answer: (
			<>
				Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
				tempor incididunt ut labore et dolore magna aliqua.
			</>
		),
	},
	{
		id: "tech-stack",
		question: "Consectetur adipiscing elit?",
		answer: (
			<>
				Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
				ut aliquip ex ea commodo consequat.
			</>
		),
	},
	{
		id: "visitor-messages",
		question: "Sed do eiusmod tempor incididunt?",
		answer: (
			<>
				Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
				dolore eu fugiat nulla pariatur.
			</>
		),
	},
	{
		id: "brand-customization",
		question: "Ut labore et dolore magna aliqua?",
		answer: (
			<>
				Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
				officia deserunt mollit anim id est laborum.
			</>
		),
	},
	{
		id: "domain-controls",
		question: "Quis nostrud exercitation ullamco?",
		answer: (
			<>
				Sed ut perspiciatis unde omnis iste natus error sit voluptatem
				accusantium doloremque laudantium, totam rem aperiam.
			</>
		),
	},
	{
		id: "free-trial",
		question: "Excepteur sint occaecat cupidatat?",
		answer: (
			<>
				Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
				fugit, sed quia consequuntur magni dolores eos.
			</>
		),
	},
] satisfies FaqItem[];

function GridTick({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-10 flex size-4 items-center justify-center",
				className,
			)}
		>
			<span className="absolute h-px w-full bg-foreground/25" />
			<span className="absolute h-full w-px bg-foreground/25" />
		</span>
	);
}

function FaqBackdrop() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 hidden md:block"
		>
			<div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-position-[-1px_-1px] bg-size-[32px_32px] [mask-image:radial-gradient(ellipse_120%_65%_at_50%_100%,black_20%,transparent_75%)]" />
		</div>
	);
}

function ToggleIcon() {
	return (
		<span
			aria-hidden="true"
			className="relative flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs transition-[background-color,border-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/accordion-trigger:border-foreground/20 group-hover/accordion-trigger:text-foreground group-active/accordion-trigger:scale-[0.96] group-aria-expanded/accordion-trigger:border-primary group-aria-expanded/accordion-trigger:bg-primary group-aria-expanded/accordion-trigger:text-primary-foreground motion-reduce:transition-colors motion-reduce:group-active/accordion-trigger:scale-100"
		>
			<span className="absolute h-[1.5px] w-3 rounded-full bg-current" />
			<span className="absolute h-3 w-[1.5px] rounded-full bg-current transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-aria-expanded/accordion-trigger:rotate-90 group-aria-expanded/accordion-trigger:scale-y-0 motion-reduce:transition-none" />
		</span>
	);
}

export default function Faq01({
	title = "Frequently asked questions",
	description = "Everything you need to know about getting started. Can’t find the answer you’re looking for? Reach out to our team.",
	faqs = FAQS,
	className,
}: FaqSectionProps = {}) {
	const headingId = useId();

	return (
		<section
			aria-labelledby={headingId}
			className={cn(
				"w-full bg-background px-4 py-16 font-sans text-foreground sm:px-6 sm:py-24",
				className,
			)}
		>
			<div className="relative mx-auto w-full max-w-6xl border-y md:border-x">
				<GridTick className="-top-2 -left-2" />
				<GridTick className="-top-2 -right-2" />
				<GridTick className="-bottom-2 -left-2" />
				<GridTick className="-right-2 -bottom-2" />

				<div className="relative grid grid-cols-1 md:grid-cols-12">
					<div className="relative flex flex-col items-start gap-4 overflow-hidden border-b px-6 py-10 sm:px-8 sm:py-12 md:col-span-5 md:border-r md:border-b-0 md:p-10 lg:p-12">
						<FaqBackdrop />
						<h2
							className="relative max-w-md text-balance font-normal text-4xl leading-[1.08] tracking-[-0.03em] sm:text-5xl"
							id={headingId}
						>
							{title}
						</h2>
						{description ? (
							<p className="relative max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
								{description}
							</p>
						) : null}
					</div>

					<div className="relative md:col-span-7">
						<GridTick className="-top-2 -left-2 hidden md:flex" />
						<GridTick className="-bottom-2 -left-2 hidden md:flex" />

						<Accordion>
							{faqs.map((faq) => (
								<AccordionItem key={faq.id} value={faq.id}>
									<AccordionTrigger className="**:data-[slot=accordion-trigger-icon]:hidden! touch-manipulation items-center gap-4 rounded-none border-0 px-6 py-6 text-base transition-[color,background-color,box-shadow] duration-150 after:hidden hover:bg-muted/40 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset motion-reduce:transition-none sm:px-8 sm:py-7 sm:text-lg">
										<span className="flex-1 text-pretty text-left leading-6">
											{faq.question}
										</span>
										<ToggleIcon />
									</AccordionTrigger>
									<AccordionContent className="px-6 pb-7 sm:px-8">
										<div className="max-w-prose pr-12 text-muted-foreground text-sm leading-relaxed sm:text-base">
											{faq.answer}
										</div>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>
			</div>
		</section>
	);
}
