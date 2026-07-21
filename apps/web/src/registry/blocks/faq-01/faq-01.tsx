"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
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
			<span className="absolute h-px w-full bg-border" />
			<span className="absolute h-full w-px bg-border" />
		</span>
	);
}

function FaqBackdrop() {
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0">
			<div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[32px_32px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
			<div className="absolute top-[12%] left-[8%] size-64 rounded-full bg-muted/80 blur-3xl" />
		</div>
	);
}

export default function Faq01({
	title = "Frequently asked questions",
	faqs = FAQS,
	className,
}: FaqSectionProps = {}) {
	const headingId = useId();

	return (
		<section
			aria-labelledby={headingId}
			className={cn(
				"w-full bg-background px-4 py-20 font-sans sm:px-6 sm:py-24",
				className,
			)}
		>
			<div className="relative mx-auto w-full max-w-6xl border-border border-y bg-background md:border-x">
				<GridTick className="-top-2 -left-2" />
				<GridTick className="-top-2 -right-2" />
				<GridTick className="-bottom-2 -left-2" />
				<GridTick className="-right-2 -bottom-2" />

				<div className="relative grid grid-cols-1 md:grid-cols-12">
					<div className="relative flex min-h-64 flex-col items-start overflow-hidden border-border border-b p-8 md:col-span-5 md:min-h-0 md:border-r md:border-b-0 md:p-10 lg:p-12">
						<FaqBackdrop />
						<h2
							className="relative max-w-md text-balance font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.03em] sm:text-5xl"
							id={headingId}
						>
							{title}
						</h2>
					</div>

					<div className="relative md:col-span-7">
						<GridTick className="-top-2 -left-2 hidden md:flex" />
						<GridTick className="-bottom-2 -left-2 hidden md:flex" />

						<Accordion>
							{faqs.map((faq) => (
								<AccordionItem
									className="px-6 sm:px-8"
									key={faq.id}
									value={faq.id}
								>
									<AccordionTrigger className="group/faq-trigger touch-manipulation items-center rounded-none py-6 transition-none hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden sm:py-7">
										<span className="flex flex-1 items-center pr-4">
											<span className="text-left text-base text-foreground leading-6 sm:text-lg">
												{faq.question}
											</span>
										</span>
										<span className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/faq-trigger:bg-muted/80 group-active/faq-trigger:scale-[0.97]">
											<PlusIcon
												aria-hidden="true"
												className="group-aria-expanded/faq-trigger:hidden"
												data-slot="accordion-trigger-icon"
											/>
											<MinusIcon
												aria-hidden="true"
												className="hidden group-aria-expanded/faq-trigger:block"
												data-slot="accordion-trigger-icon"
											/>
										</span>
									</AccordionTrigger>
									<AccordionContent className="pr-10 pb-7 sm:pr-12">
										<div className="text-muted-foreground text-sm leading-relaxed sm:text-base">
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
