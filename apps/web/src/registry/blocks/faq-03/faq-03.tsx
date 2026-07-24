"use client";

import { PlusIcon, SendIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

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
	MessageHeader,
} from "@/components/ui/message";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FaqItem {
	id: string;
	question: string;
	answer: ReactNode;
}

export interface Faq03Props {
	title?: ReactNode;
	description?: ReactNode;
	faqs?: FaqItem[];
	supportName?: string;
	supportInitials?: string;
	supportAvatarSrc?: string;
	contactPrompt?: ReactNode;
	contactLabel?: ReactNode;
	contactHref?: string;
	className?: string;
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
] satisfies FaqItem[];

function AnimatedSendIcon() {
	return (
		<span
			aria-hidden="true"
			className="relative size-4 overflow-hidden"
			data-icon="inline-end"
		>
			<SendIcon className="absolute inset-0 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:translate-x-1/2 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:-translate-y-1/2 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:opacity-0" />
			<SendIcon className="absolute inset-0 -translate-x-1/2 translate-y-1/2 opacity-0 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:hidden motion-reduce:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:translate-x-0 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:translate-y-0 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/send:opacity-100" />
		</span>
	);
}

export default function Faq03({
	title = "Questions, answered",
	description = "Everything you need to know before adding the library to your next project.",
	faqs = FAQS,
	supportName = "Tent Support",
	supportInitials = "TS",
	supportAvatarSrc,
	contactPrompt = "Still have a question?",
	contactLabel = "Send us a message",
	contactHref = "mailto:hello@example.com",
	className,
}: Faq03Props = {}) {
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
				<header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
					<h2
						className="text-balance font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.03em] sm:text-5xl"
						id={headingId}
					>
						{title}
					</h2>
					<p className="max-w-xl text-balance text-base text-muted-foreground leading-relaxed sm:text-lg">
						{description}
					</p>
				</header>

				<div className="relative mx-auto mt-14 max-w-4xl px-1 py-6 sm:mt-16 sm:px-6 sm:py-8">
					<Separator
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
					/>
					<Separator
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
					/>
					<Accordion className="gap-3" defaultValue={defaultValue}>
						{faqs.map((faq) => (
							<AccordionItem
								className="border-0 not-last:border-b-0"
								key={faq.id}
								value={faq.id}
							>
								<AccordionTrigger className="group/question [&>[data-slot=accordion-trigger-icon]]:hidden! ml-auto w-fit max-w-[92%] flex-none touch-manipulation items-center justify-end gap-2 rounded-full border-0 py-0 font-normal transition-none hover:no-underline focus-visible:ring-2 sm:max-w-[82%]">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-[transform,background-color,border-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/question:scale-100 group-focus-visible/question:transition-none group-active/question:scale-[0.96] group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground motion-reduce:transition-colors motion-reduce:group-active/question:scale-100">
										<PlusIcon
											aria-hidden="true"
											className="size-4 transition-transform duration-180 ease-[cubic-bezier(0.77,0,0.175,1)] group-focus-visible/question:transition-none group-aria-expanded/question:rotate-45 motion-reduce:transition-none"
										/>
									</span>
									<span className="rounded-full border border-border bg-background px-5 py-3 text-left font-medium text-base leading-relaxed shadow-xs transition-[transform,background-color,border-color,color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/question:scale-100 group-focus-visible/question:transition-none group-active/question:scale-[0.98] group-aria-expanded/question:border-primary group-aria-expanded/question:bg-primary group-aria-expanded/question:text-primary-foreground motion-reduce:transition-colors motion-reduce:group-active/question:scale-100">
										{faq.question}
									</span>
								</AccordionTrigger>

								<AccordionContent className="pt-3 pb-5 sm:pb-6">
									<Message align="start">
										<MessageAvatar>
											<Avatar size="lg">
												{supportAvatarSrc ? (
													<AvatarImage
														alt={`${supportName} avatar`}
														src={supportAvatarSrc}
													/>
												) : null}
												<AvatarFallback>{supportInitials}</AvatarFallback>
											</Avatar>
										</MessageAvatar>
										<MessageContent>
											<MessageHeader>{supportName}</MessageHeader>
											<Bubble
												className="max-w-[92%] sm:max-w-[80%]"
												variant="muted"
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
				<div className="mx-auto mt-6 flex max-w-4xl flex-col items-center justify-between gap-4 px-1 sm:flex-row sm:px-6">
					<p className="text-center text-base text-muted-foreground sm:text-left">
						{contactPrompt}
					</p>
					<Button
						className="group/send transition-[transform,background-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-0 active:scale-[0.97] focus-visible:active:scale-100 motion-reduce:transition-colors motion-reduce:active:scale-100"
						nativeButton={false}
						render={<a href={contactHref} />}
						size="lg"
					>
						{contactLabel}
						<AnimatedSendIcon />
					</Button>
				</div>
			</div>
		</section>
	);
}
