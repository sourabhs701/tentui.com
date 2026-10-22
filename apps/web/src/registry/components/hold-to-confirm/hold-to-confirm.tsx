"use client";

import { Trash2Icon } from "lucide-react";
import {
	AnimatePresence,
	type HTMLMotionProps,
	motion,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { type ReactNode, useId } from "react";
import {
	type UseHoldToConfirmOptions,
	useHoldToConfirm,
} from "@/hooks/use-hold-to-confirm";
import { cn } from "@/lib/utils";

const labelTransition = {
	type: "spring",
	duration: 0.3,
	bounce: 0,
} as const;

function HoldToConfirmCheck() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			data-slot="confirmed-icon"
		>
			<motion.path
				d="M5 12.5l4.5 4.5L19 7.5"
				initial={{ pathLength: 0 }}
				animate={{ pathLength: 1 }}
				transition={{ duration: 0.35, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
			/>
		</svg>
	);
}

type HeldHandler =
	| "onPointerDown"
	| "onPointerUp"
	| "onPointerCancel"
	| "onLostPointerCapture"
	| "onKeyDown"
	| "onKeyUp"
	| "onBlur"
	| "onContextMenu";

export type HoldToConfirmProps = Omit<
	HTMLMotionProps<"button">,
	"children" | HeldHandler
> &
	UseHoldToConfirmOptions & {
		/** Label shown while idle and under the fill. */
		children?: ReactNode;
		/** Icon shown before the label. */
		icon?: ReactNode;
		/** Label shown after the hold completes. */
		confirmedLabel?: ReactNode;
		/** Icon shown after the hold completes. Defaults to an animated checkmark. */
		confirmedIcon?: ReactNode;
		/** Description announced to assistive technology. */
		instructions?: string;
		/** Class name for the fill layer, e.g. to change its color. */
		fillClassName?: string;
	};

export function HoldToConfirm({
	className,
	children = "Hold to delete",
	icon = <Trash2Icon data-slot="idle-icon" />,
	confirmedLabel = "Deleted",
	confirmedIcon,
	instructions = "Press and hold to confirm",
	fillClassName,
	holdDuration,
	resetDelay,
	onConfirm,
	onCancel,
	sound,
	haptics,
	disabled,
	...props
}: HoldToConfirmProps) {
	const { state, progress, fillOpacity, handlers } = useHoldToConfirm({
		holdDuration,
		resetDelay,
		onConfirm,
		onCancel,
		sound,
		haptics,
		disabled,
	});
	const shouldReduceMotion = useReducedMotion();
	const descriptionId = useId();
	const clipPath = useTransform(progress, (value) => {
		const clamped = Math.min(Math.max(value, 0), 1);
		return `inset(0 ${(1 - clamped) * 100}% 0 0)`;
	});
	const isHolding = state === "holding";
	const isConfirmed = state === "confirmed";

	return (
		<>
			<motion.button
				type="button"
				data-slot="hold-to-confirm"
				data-state={state}
				disabled={disabled}
				aria-describedby={descriptionId}
				aria-disabled={isConfirmed || undefined}
				animate={{ scale: isHolding && !shouldReduceMotion ? 0.97 : 1 }}
				transition={{
					type: "spring",
					visualDuration: isHolding ? 0.2 : 0.4,
					bounce: isHolding ? 0 : 0.45,
				}}
				className={cn(
					"relative inline-flex h-10 shrink-0 cursor-pointer touch-manipulation select-none items-center justify-center whitespace-nowrap rounded-full border border-border bg-background px-5 font-medium text-foreground text-sm shadow-xs outline-none transition-[background-color,box-shadow] [-webkit-touch-callout:none] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
					className,
				)}
				{...handlers}
				{...props}
			>
				<span className="inline-flex items-center gap-2">
					{icon}
					{children}
				</span>

				<motion.span
					aria-hidden
					data-slot="hold-to-confirm-fill"
					style={{ clipPath, opacity: fillOpacity }}
					className={cn(
						"pointer-events-none absolute -inset-px flex items-center justify-center rounded-[inherit] border border-transparent bg-destructive px-5 text-white dark:bg-red-600",
						fillClassName,
					)}
				>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={isConfirmed ? "confirmed" : "idle"}
							initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
							animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
							exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
							transition={labelTransition}
							className="inline-flex items-center gap-2"
						>
							{isConfirmed ? (confirmedIcon ?? <HoldToConfirmCheck />) : icon}
							{isConfirmed ? confirmedLabel : children}
						</motion.span>
					</AnimatePresence>
				</motion.span>
			</motion.button>

			<span id={descriptionId} className="sr-only">
				{instructions}
			</span>
			<span aria-live="polite" className="sr-only">
				{isConfirmed ? confirmedLabel : null}
			</span>
		</>
	);
}

export default HoldToConfirm;
