"use client";

import {
	type ComponentPropsWithoutRef,
	forwardRef,
	type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ThreeDButtonVariant = "solid" | "secondary" | "destructive";
export type ThreeDButtonSize = "sm" | "md" | "lg" | "icon";

export type ThreeDButtonProps = Readonly<
	{
		children: ReactNode;
		variant?: ThreeDButtonVariant;
		size?: ThreeDButtonSize;
	} & ComponentPropsWithoutRef<"button">
>;

const SIZE: Record<ThreeDButtonSize, string> = {
	sm: "h-9 gap-1.5 rounded-lg px-3 text-xs",
	md: "h-10 gap-2 rounded-lg px-4 text-sm",
	lg: "h-12 gap-2 rounded-xl px-5 text-sm",
	icon: "size-10 rounded-lg p-0",
};

// secondary diffused top light + bottom shade — no hard white rim.
const BEVEL_LIGHT =
	"shadow-[0_1px_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.1),0_6px_12px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.08)]";
const PRESSED_LIGHT =
	"active:shadow-[0_1px_1px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(0,0,0,0.04),inset_0_-1px_2px_rgba(0,0,0,0.05)]";

// Dark key: secondary top sheen (blurred, not a sharp bar) + deep lift + bottom recess.
const BEVEL_DARK =
	"shadow-[0_1px_1px_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.28),0_8px_16px_rgba(0,0,0,0.22),inset_0_1px_2px_rgba(255,255,255,0.14),inset_0_-3px_6px_rgba(0,0,0,0.55)]";
const PRESSED_DARK =
	"active:shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_2px_6px_rgba(0,0,0,0.55),inset_0_-1px_1px_rgba(255,255,255,0.06)]";

const VARIANT: Record<ThreeDButtonVariant, string> = {
	solid: cn(
		"bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-900",
		BEVEL_DARK,
		PRESSED_DARK,
	),
	secondary: cn(
		"bg-neutral-50 text-neutral-800 hover:text-neutral-900 active:bg-neutral-100",
		BEVEL_LIGHT,
		PRESSED_LIGHT,
	),
	destructive: cn(
		"bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-destructive dark:bg-destructive/20 dark:hover:bg-destructive/30",
		BEVEL_LIGHT,
		PRESSED_LIGHT,
	),
};

// Universal 3D button — pass any children (label, icon + label, icon only).
export const ThreeDButton = forwardRef<HTMLButtonElement, ThreeDButtonProps>(
	(
		{
			className,
			children,
			variant = "solid",
			size = "md",
			type = "button",
			disabled,
			...props
		},
		ref,
	) => {
		return (
			<button
				ref={ref}
				type={type}
				disabled={disabled}
				data-slot="3d-button"
				data-variant={variant}
				data-size={size}
				className={cn(
					"inline-flex cursor-pointer select-none items-center justify-center font-sans font-semibold outline-none",
					"transition-[background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
					"focus-visible:outline-2 focus-visible:outline-neutral-900 focus-visible:outline-offset-2",
					"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
					SIZE[size],
					VARIANT[variant],
					size === "icon" && "shrink-0",
					className,
				)}
				{...props}
			>
				{children}
			</button>
		);
	},
);

ThreeDButton.displayName = "ThreeDButton";

export default ThreeDButton;
