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
	className?: string;
}

const FAQS = [
	{
		id: "lorem-ipsum",
		question: "Lorem ipsum dolor sit amet?",
		answer:
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	},
	{
		id: "consectetur",
		question: "Consectetur adipiscing elit sed do?",
		answer:
			"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
	},
	{
		id: "occaecat",
		question: "Excepteur sint occaecat cupidatat?",
		answer:
			"Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos.",
	},
] satisfies FaqItem[];

export default function Faq02({
	title = "Everything you need to know",
	description = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
	faqs = FAQS,
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
			<div className="mx-auto w-full max-w-5xl">
				<header className="mx-auto flex max-w-2xl flex-col items-center text-center">
					<h2
						className="text-balance font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.03em] sm:text-5xl"
						id={headingId}
					>
						{title}
					</h2>
					<p className="mt-5 max-w-xl text-balance text-base text-muted-foreground leading-relaxed sm:text-lg">
						{description}
					</p>
				</header>

				<div className="relative mt-14 sm:mt-16">
					<Accordion className="border-y" defaultValue={defaultValue}>
						{faqs.map((faq) => (
							<AccordionItem
								className="border-border"
								key={faq.id}
								value={faq.id}
							>
								<AccordionTrigger className="group/faq-trigger [&>svg]:hidden! grid touch-manipulation grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-4 rounded-none border-0 py-6 transition-none hover:no-underline sm:gap-x-5 sm:py-7">
									<span className="text-left font-normal text-base text-foreground leading-6 sm:text-lg">
										{faq.question}
									</span>
									<span className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-[transform,background-color,border-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/faq-trigger:border-foreground/15 group-hover/faq-trigger:bg-muted group-active/faq-trigger:scale-[0.96] [&_svg]:size-4">
										<PlusIcon
											aria-hidden="true"
											className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-aria-expanded/faq-trigger:rotate-45 motion-reduce:transition-none"
										/>
									</span>
								</AccordionTrigger>
								<AccordionContent className="pr-12 pb-7 sm:pr-16 sm:pb-8">
									<div className="text-muted-foreground text-sm leading-relaxed sm:text-base">
										{faq.answer}
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>

				<p className="mt-8 text-center text-muted-foreground text-sm">
					Still curious?{" "}
					<a
						className="font-medium text-foreground underline decoration-border underline-offset-4 transition-[text-decoration-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
						href="mailto:hello@example.com"
					>
						Talk to our team
					</a>
					.
				</p>
			</div>
		</section>
	);
}
