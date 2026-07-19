"use client";

import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const FEEDBACK_DURATION = 2000;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type ContextfulSaveButtonStatus = "idle" | "loading" | "success" | "error";

type ContextfulSaveButtonLabels = Partial<
	Record<ContextfulSaveButtonStatus, string>
>;

interface ContextfulSaveButtonProps
	extends Omit<React.ComponentProps<"button">, "children" | "onClick"> {
	labels?: ContextfulSaveButtonLabels;
	onClick?: (
		event: React.MouseEvent<HTMLButtonElement>,
	) => void | Promise<void>;
}

const defaultLabels = {
	idle: "Save",
	loading: "Saving",
	success: "Saved",
	error: "Try again",
} satisfies Record<ContextfulSaveButtonStatus, string>;

function AnimatedChars({ text }: { text: string }) {
	return (
		<AnimatePresence mode="popLayout" initial={false}>
			{Array.from(text, (char, offset) => (
				<motion.span
					key={`${char}-${offset}`}
					layout
					initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
					animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
					transition={{
						type: "spring",
						stiffness: 500,
						damping: 30,
						mass: 1,
					}}
					className="inline-block"
				>
					{char === " " ? "\u00A0" : char}
				</motion.span>
			))}
		</AnimatePresence>
	);
}

function ContextfulSaveButton({
	className,
	disabled,
	labels,
	onClick,
	...props
}: ContextfulSaveButtonProps) {
	const [status, setStatus] = useState<ContextfulSaveButtonStatus>("idle");
	const isRunning = useRef(false);
	const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const resolvedLabels = { ...defaultLabels, ...labels };
	const label = resolvedLabels[status];
	const isPending = status !== "idle";

	useEffect(
		() => () => {
			if (resetTimer.current) clearTimeout(resetTimer.current);
		},
		[],
	);

	async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
		if (isRunning.current) return;

		isRunning.current = true;
		setStatus("loading");

		try {
			await onClick?.(event);
			setStatus("success");
		} catch {
			setStatus("error");
		}

		resetTimer.current = setTimeout(() => {
			isRunning.current = false;
			setStatus("idle");
		}, FEEDBACK_DURATION);
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className="relative inline-flex font-sans">
				<button
					data-slot="contextful-save-button"
					data-status={status}
					type="button"
					aria-busy={status === "loading"}
					disabled={disabled || isPending}
					onClick={handleClick}
					className={cn(
						"relative inline-flex h-12 min-w-36 select-none items-center justify-center rounded-full px-8 font-medium text-base outline-none duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-3 focus-visible:ring-ring/50 active:not-disabled:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
						status === "idle" &&
							"bg-linear-to-b from-blue-400 to-blue-500 text-primary-foreground hover:from-blue-500 hover:to-blue-600 hover:shadow-sm",
						status !== "idle" &&
							"cursor-not-allowed bg-muted/60 text-muted-foreground",
						className,
					)}
					{...props}
				>
					<span className="flex items-center justify-center">
						<AnimatedChars text={label} />
					</span>
				</button>

				<AnimatePresence initial={false}>
					{status !== "idle" && (
						<motion.span
							initial={{ opacity: 0, scale: 0.94, x: -4 }}
							animate={{ opacity: 1, scale: 1, x: 0 }}
							exit={{ opacity: 0, scale: 0.94, x: -4 }}
							transition={{ duration: 0.18, ease: EASE_OUT }}
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute -top-1 -right-1 flex size-6 items-center justify-center overflow-hidden rounded-full",
								status === "loading" && "bg-muted text-muted-foreground",
								status === "success" && "bg-success text-white",
								status === "error" && "bg-destructive text-white",
							)}
						>
							<AnimatePresence initial={false} mode="wait">
								<motion.span
									key={status}
									initial={{ opacity: 0, scale: 0.94 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.94 }}
									transition={{ duration: 0.12, ease: EASE_OUT }}
									className="absolute inset-0 flex items-center justify-center [&_svg]:size-3.5"
								>
									{status === "loading" && (
										<LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
									)}
									{status === "success" && <CheckIcon />}
									{status === "error" && <XIcon />}
								</motion.span>
							</AnimatePresence>
						</motion.span>
					)}
				</AnimatePresence>

				<span className="sr-only" role="status" aria-live="polite">
					{status === "idle" ? "" : label}
				</span>
			</div>
		</MotionConfig>
	);
}

export {
	ContextfulSaveButton,
	type ContextfulSaveButtonLabels,
	type ContextfulSaveButtonProps,
	type ContextfulSaveButtonStatus,
};

export default ContextfulSaveButton;
