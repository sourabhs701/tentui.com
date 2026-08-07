"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@tentui.com/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@tentui.com/ui/components/dialog";
import { Textarea } from "@tentui.com/ui/components/textarea";
import {
	SendIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	Undo2Icon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

const VISITOR_ID_KEY = "tentui-feedback-visitor-id";
const STATE_TRANSITION = {
	duration: 0.18,
	ease: [0.23, 1, 0.32, 1] as const,
};
const RATINGS = [
	{ value: "up" as const, label: "Helpful", Icon: ThumbsUpIcon },
	{ value: "down" as const, label: "Not helpful", Icon: ThumbsDownIcon },
];
let fallbackVisitorId: string | undefined;

function getVisitorId() {
	try {
		const stored = localStorage.getItem(VISITOR_ID_KEY);
		if (stored) return stored;

		const id = crypto.randomUUID();
		localStorage.setItem(VISITOR_ID_KEY, id);
		return id;
	} catch {
		fallbackVisitorId ??= crypto.randomUUID();
		return fallbackVisitorId;
	}
}

function getStoredRating(slug: string) {
	try {
		const rating = localStorage.getItem(`${VISITOR_ID_KEY}:${slug}`);
		return rating === "up" || rating === "down" ? rating : null;
	} catch {
		return null;
	}
}

function storeRating(slug: string, rating: "up" | "down" | null) {
	try {
		const key = `${VISITOR_ID_KEY}:${slug}`;
		if (rating) localStorage.setItem(key, rating);
		else localStorage.removeItem(key);
	} catch {}
}

export function ComponentFeedback({ slug }: { slug: string }) {
	const reduceMotion = useReducedMotion();
	const textareaId = useId();
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const queryClient = useQueryClient();
	const [activeRating, setActiveRating] = useState<"up" | "down" | null>(null);
	const [feedback, setFeedback] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [submittedRating, setSubmittedRating] = useState<"up" | "down" | null>(
		null,
	);
	const countsQuery = useQuery(
		trpc.feedback.counts.queryOptions({ slug }, { staleTime: 30_000 }),
	);
	const submitFeedback = useMutation(
		trpc.feedback.submit.mutationOptions({
			onSuccess: (counts, variables) => {
				queryClient.setQueryData(
					trpc.feedback.counts.queryKey({ slug }),
					counts,
				);
				storeRating(slug, variables.rating);
				setFeedback("");
				setIsOpen(false);
				setSubmittedRating(variables.rating);
			},
		}),
	);
	const undoFeedback = useMutation(
		trpc.feedback.undo.mutationOptions({
			onSuccess: (counts) => {
				queryClient.setQueryData(
					trpc.feedback.counts.queryKey({ slug }),
					counts,
				);
				storeRating(slug, null);
				setActiveRating(null);
				setSubmittedRating(null);
			},
		}),
	);
	const counts = countsQuery.data ?? { up: 0, down: 0 };
	const SubmittedIcon =
		submittedRating === "down" ? ThumbsDownIcon : ThumbsUpIcon;
	const stateTransition = reduceMotion ? { duration: 0 } : STATE_TRANSITION;

	useEffect(() => {
		setSubmittedRating(getStoredRating(slug));
	}, [slug]);

	function open(rating: "up" | "down", trigger: HTMLButtonElement) {
		triggerRef.current = trigger;
		submitFeedback.reset();
		setActiveRating(rating);
		setIsOpen(true);
	}

	function handleOpenChange(open: boolean) {
		setIsOpen(open);
		if (open) return;

		submitFeedback.reset();
		setActiveRating(null);
		setFeedback("");
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!activeRating) return;

		submitFeedback.mutate({
			feedback,
			rating: activeRating,
			slug,
			visitorId: getVisitorId(),
		});
	}

	function undo() {
		undoFeedback.mutate({ slug, visitorId: getVisitorId() });
	}

	return (
		<div className="not-prose my-4 flex justify-end">
			<motion.div
				layout={!reduceMotion}
				transition={stateTransition}
				className="ml-auto rounded-xl border bg-card p-2 shadow-xs"
			>
				<AnimatePresence mode="popLayout" initial={false}>
					{submittedRating ? (
						<motion.div
							key="submitted"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={stateTransition}
							className="flex items-center gap-2"
						>
							<SubmittedIcon
								aria-hidden="true"
								className="ml-1 size-4 fill-current"
							/>
							<p className="px-1 font-medium text-sm" aria-live="polite">
								Thanks for your feedback!
							</p>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								disabled={undoFeedback.isPending}
								onClick={undo}
							>
								<Undo2Icon data-icon="inline-start" />
								{undoFeedback.error
									? "Try again"
									: undoFeedback.isPending
										? "Undoing…"
										: "Undo"}
							</Button>
						</motion.div>
					) : (
						<motion.div
							key="prompt"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={stateTransition}
							className="flex flex-wrap items-center justify-end gap-2"
						>
							<p className="px-2 text-right text-muted-foreground text-sm">
								Was this useful?
							</p>
							{RATINGS.map(({ Icon, label, value }) => (
								<Button
									key={value}
									type="button"
									className="active:not-aria-[haspopup]:translate-y-0"
									variant="outline"
									size="sm"
									aria-label={`${label}: ${counts[value]} votes`}
									onClick={(event) => open(value, event.currentTarget)}
								>
									<Icon
										data-icon="inline-start"
										aria-hidden="true"
										className={
											value === "up"
												? "fill-transparent transition-[transform,fill] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/button:-rotate-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover/button:scale-110 [@media(hover:hover)_and_(pointer:fine)]:group-hover/button:fill-current"
												: undefined
										}
									/>
									<span className="min-w-3 tabular-nums">{counts[value]}</span>
								</Button>
							))}
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>

			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent
					finalFocus={() => triggerRef.current}
					className="duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-closed:duration-150 motion-reduce:duration-0"
				>
					<DialogHeader>
						<DialogTitle>Share feedback</DialogTitle>
						<DialogDescription>
							{activeRating === "up"
								? "What did you like about this component?"
								: "What could we improve?"}
						</DialogDescription>
					</DialogHeader>

					<form className="flex flex-col gap-4" onSubmit={submit}>
						<label className="sr-only" htmlFor={textareaId}>
							Feedback
						</label>
						<Textarea
							id={textareaId}
							autoFocus
							rows={5}
							maxLength={1000}
							value={feedback}
							onChange={(event) => setFeedback(event.target.value)}
							placeholder="Type your feedback (optional)"
						/>
						{submitFeedback.error ? (
							<p className="text-destructive text-sm" role="alert">
								{submitFeedback.error.message}
							</p>
						) : null}
						<DialogFooter>
							<Button type="submit" disabled={submitFeedback.isPending}>
								<SendIcon data-icon="inline-start" />
								{submitFeedback.isPending ? "Sending…" : "Send feedback"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
