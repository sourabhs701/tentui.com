"use client";

import { Button } from "@tentui.com/ui/components/button";
import { CheckIcon, CircleXIcon, CopyIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { IconSwap, IconSwapItem } from "@/components/icon-swap";
import type { CopyState } from "@/hooks/use-copy-to-clipboard";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export type CopyStateIconProps = {
	state: CopyState;
	/** Custom icon for idle state. */
	idleIcon?: React.ReactNode;
	/** Custom icon for done state. */
	doneIcon?: React.ReactNode;
	/** Custom icon for error state. */
	errorIcon?: React.ReactNode;
};

export function CopyStateIcon({
	state,
	idleIcon,
	doneIcon,
	errorIcon,
}: CopyStateIconProps) {
	let icon = idleIcon ?? (
		<CopyIcon data-icon="inline-start" data-slot="idle-icon" />
	);

	if (state === "done") {
		icon = doneIcon ?? (
			<CheckIcon data-icon="inline-start" data-slot="done-icon" />
		);
	} else if (state === "error") {
		icon = errorIcon ?? (
			<CircleXIcon data-icon="inline-start" data-slot="error-icon" />
		);
	}

	return (
		<IconSwap>
			<IconSwapItem key={state} as={motion.span}>
				{icon}
			</IconSwapItem>
		</IconSwap>
	);
}

export type CopyButtonProps = ComponentProps<typeof Button> & {
	/** The text to copy, or a function that returns the text. */
	text: string | (() => string);
	/** Called with the copied text on successful copy. */
	onCopySuccess?: (text: string) => void;
	/** Called with the error if the copy operation fails. */
	onCopyError?: (error: Error) => void;
} & Omit<CopyStateIconProps, "state">;

export function CopyButton({
	className,
	size = "icon",
	children,
	text,
	idleIcon,
	doneIcon,
	errorIcon,
	onClick,
	onCopySuccess,
	onCopyError,
	...props
}: CopyButtonProps) {
	const { state, copy } = useCopyToClipboard({
		onCopySuccess,
		onCopyError,
	});

	return (
		<Button
			className={cn("will-change-transform", className)}
			size={size}
			onClick={(e) => {
				void copy(text);
				onClick?.(e);
			}}
			aria-label="Copy"
			{...props}
		>
			<CopyStateIcon
				state={state}
				idleIcon={idleIcon}
				doneIcon={doneIcon}
				errorIcon={errorIcon}
			/>
			{children}
		</Button>
	);
}
