"use client";

import { ArrowUpRightIcon, PlusIcon } from "lucide-react";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	Message,
	MessageAvatar,
	MessageContent,
} from "@/components/ui/message";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const FAQS = [
	{
		id: "getting-started",
		question: "How quickly can I get started?",
		answer:
			"You can be up and running in a few minutes. Install the package, choose the components you need, and customize them directly in your codebase.",
	},
	{
		id: "customize",
		question: "Can I customize every component?",
		answer:
			"Yes. You own the source code, so every detail is yours to adapt — from tokens and typography to layout, behavior, and motion.",
	},
	{
		id: "frameworks",
		question: "Which frameworks are supported?",
		answer:
			"The components are designed for React and work especially well with Next.js. They use standard TypeScript, Tailwind CSS, and accessible primitives.",
	},
	{
		id: "accessibility",
		question: "Are the components accessible?",
		answer:
			"Accessibility is built into the underlying primitives, including keyboard navigation, focus management, and the appropriate ARIA attributes.",
	},
	{
		id: "updates",
		question: "Do I get future updates?",
		answer:
			"Yes. You can pull newer versions whenever they are useful while keeping full control over the local changes you have made.",
	},
];

const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

export default function Faq03() {
	return (
		<section
			aria-labelledby="faq-03-heading"
			className="w-full bg-background px-4 py-16 font-sans text-foreground sm:px-6 sm:py-24"
		>
			<div className="mx-auto w-full max-w-3xl">
				<header className="flex flex-col items-center gap-4 text-center">
					<h2
						className="text-balance font-normal text-4xl leading-[1.08] tracking-[-0.03em] sm:text-5xl"
						id="faq-03-heading"
					>
						Questions, answered
					</h2>
					<p className="max-w-xl text-balance text-base text-muted-foreground leading-relaxed sm:text-lg">
						Everything you need to know before adding the library to your next
						project.
					</p>
				</header>

				<Separator className="mt-12 bg-linear-to-r bg-transparent from-transparent via-border to-transparent sm:mt-14" />

				<Accordion
					className="gap-3 py-6 sm:gap-4 sm:py-8"
					defaultValue={["getting-started"]}
				>
					{FAQS.map((faq) => (
						<AccordionItem
							className="border-0 not-last:border-b-0"
							key={faq.id}
							value={faq.id}
						>
							<AccordionTrigger
								className={cn(
									"group/question ml-auto w-fit max-w-[92%] flex-none touch-manipulation items-center justify-end gap-2 rounded-none border-0 py-0 font-normal hover:no-underline focus-visible:ring-0 focus-visible:after:hidden sm:max-w-[80%] sm:gap-3",
									"[&>[data-slot=accordion-trigger-icon]]:hidden!",
								)}
							>
								<span
									className={cn(
										"min-w-0 rounded-2xl rounded-br-sm border bg-card px-4 py-2.5 text-left font-medium text-card-foreground text-sm leading-relaxed shadow-xs sm:px-5 sm:py-3 sm:text-base",
										"transition-[transform,background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none",
										EASE_OUT,
										"group-hover/question:bg-muted group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground",
										"group-focus-visible/question:border-ring group-focus-visible/question:ring-3 group-focus-visible/question:ring-ring/50",
										"group-active/question:scale-[0.98] motion-reduce:group-active/question:scale-100",
									)}
								>
									{faq.question}
								</span>
								<span
									aria-hidden="true"
									className={cn(
										"flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-xs sm:size-9",
										"transition-[background-color,border-color,color] duration-150 motion-reduce:transition-none",
										EASE_OUT,
										"group-hover/question:text-foreground group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground",
									)}
								>
									<PlusIcon className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-aria-expanded/question:rotate-45 motion-reduce:transition-none" />
								</span>
							</AccordionTrigger>

							<AccordionContent className="pt-3 pb-2 sm:pt-4">
								<Message align="start" className="gap-2 sm:gap-3">
									<MessageAvatar aria-hidden="true">
										<Avatar className="sm:size-9">
											<AvatarFallback className="font-medium text-xs">
												TS
											</AvatarFallback>
										</Avatar>
									</MessageAvatar>
									<MessageContent>
										<Bubble
											className="max-w-[90%] sm:max-w-[80%]"
											variant="muted"
										>
											<BubbleContent className="rounded-2xl rounded-bl-sm px-4 py-2.5 text-foreground text-sm leading-relaxed sm:px-5 sm:py-3 sm:text-base">
												{faq.answer}
											</BubbleContent>
										</Bubble>
									</MessageContent>
								</Message>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>

				<Separator className="bg-linear-to-r bg-transparent from-transparent via-border to-transparent" />

				<div className="mt-6 flex flex-col items-center justify-between gap-4 sm:mt-8 sm:flex-row">
					<p className="text-center text-base text-muted-foreground sm:text-left">
						Still have a question?
					</p>
					<Button
						nativeButton={false}
						render={<a href="mailto:hello@example.com" />}
						size="lg"
					>
						Send us a message
						<ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
					</Button>
				</div>
			</div>
		</section>
	);
}
