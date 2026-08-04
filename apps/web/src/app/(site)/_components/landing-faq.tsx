"use client";

import { PlusIcon } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	Message,
	MessageAvatar,
	MessageContent,
} from "@/components/ui/message";

declare global {
	interface Window {
		Tkit?: { open: () => void };
	}
}

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

export default function LandingFaq() {
	return (
		<section
			aria-labelledby="landing-faq-heading"
			className="w-full bg-background px-4 py-24 font-sans sm:px-6 md:py-32"
		>
			<div className="mx-auto w-full max-w-6xl">
				<header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
					<h2
						className="text-balance font-bold text-2xl tracking-tight sm:text-3xl md:text-4xl"
						id="landing-faq-heading"
					>
						Questions, answered
					</h2>
					<p className="max-w-lg text-balance font-medium text-muted-foreground text-sm sm:text-base">
						Everything you need to know before adding TentUI to your next
						project.
					</p>
				</header>

				<div className="mt-12 w-full rounded-[21px] border bg-muted p-0.5">
					<div className="rounded-[19px] border bg-background px-4 py-6 sm:px-8 sm:py-8">
						<Accordion className="gap-3" defaultValue={["getting-started"]}>
							{FAQS.map((faq) => (
								<AccordionItem
									className="border-0 not-last:border-b-0"
									key={faq.id}
									value={faq.id}
								>
									<AccordionTrigger className="group/question [&>[data-slot=accordion-trigger-icon]]:hidden! ml-auto w-fit max-w-[92%] flex-none touch-manipulation items-center justify-end gap-2 rounded-full border-0 py-0 font-normal transition-none hover:no-underline focus-visible:ring-2 sm:max-w-[82%]">
										<span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-[transform,background-color,border-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-active/question:scale-[0.96] group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground motion-reduce:transition-colors motion-reduce:group-active/question:scale-100">
											<PlusIcon
												aria-hidden="true"
												className="size-4 transition-transform duration-180 ease-[cubic-bezier(0.77,0,0.175,1)] group-aria-expanded/question:rotate-45 motion-reduce:transition-none"
											/>
										</span>
										<span className="rounded-full border bg-background px-5 py-3 text-left font-medium text-base leading-relaxed shadow-xs transition-[transform,background-color,border-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-active/question:scale-[0.98] group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground motion-reduce:transition-colors motion-reduce:group-active/question:scale-100">
											{faq.question}
										</span>
									</AccordionTrigger>

									<AccordionContent className="pt-3 pb-5 sm:pb-6">
										<Message align="start">
											<MessageAvatar>
												<Avatar size="lg">
													<AvatarImage
														alt="Sourabh"
														src="https://cdn.srb.codes/srb.avif"
													/>
													<AvatarFallback>SR</AvatarFallback>
												</Avatar>
											</MessageAvatar>
											<MessageContent>
												<Bubble
													className="max-w-[92%] sm:max-w-[80%]"
													variant="secondary"
												>
													<BubbleContent className="rounded-2xl rounded-bl-sm px-5 py-4 text-base leading-relaxed">
														{faq.answer}
													</BubbleContent>
												</Bubble>
											</MessageContent>
										</Message>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>

					<div className="flex flex-col items-center justify-between gap-4 px-3 py-2 sm:flex-row">
						<p className="text-center font-semibold tracking-tight sm:text-left">
							Still have a question?
						</p>
						<Button
							className="rounded-xl border-primary-foreground/20 px-4"
							onClick={() => window.Tkit?.open()}
							size="lg"
						>
							Send us a message
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
