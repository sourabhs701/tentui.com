"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import type { ThemeState } from "@/hooks/use-theme-toggle";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { cn } from "@/lib/utils";
import {
	IconSwap,
	IconSwapItem,
} from "@/registry/components/icon-swap/icon-swap";

export type ThemeStateIconProps = {
	state: ThemeState | null;
	/** Custom icon for the light theme. */
	lightIcon?: React.ReactNode;
	/** Custom icon for the dark theme. */
	darkIcon?: React.ReactNode;
};

export function ThemeStateIcon({
	state,
	lightIcon,
	darkIcon,
}: ThemeStateIconProps) {
	if (!state) {
		return <span className="block size-4" aria-hidden />;
	}

	return (
		<IconSwap>
			<IconSwapItem
				key={state}
				as={motion.span}
				aria-hidden
				data-icon="inline-start"
			>
				{state === "dark"
					? (darkIcon ?? <MoonIcon data-slot="dark-icon" />)
					: (lightIcon ?? <SunIcon data-slot="light-icon" />)}
			</IconSwapItem>
		</IconSwap>
	);
}

export type ThemeToggleProps = ComponentProps<typeof Button> & {
	/** Called with the resolved theme after it changes. */
	onThemeChange?: (theme: ThemeState) => void;
} & Omit<ThemeStateIconProps, "state">;

export function ThemeToggle({
	className,
	size = "icon",
	children,
	lightIcon,
	darkIcon,
	onClick,
	onThemeChange,
	...props
}: ThemeToggleProps) {
	const { state, toggle } = useThemeToggle({ onThemeChange });
	const label = state
		? `Switch to ${state === "dark" ? "light" : "dark"} theme`
		: "Toggle theme";

	return (
		<Button
			className={cn("will-change-transform", className)}
			size={size}
			onClick={(event) => {
				toggle();
				onClick?.(event);
			}}
			aria-label={label}
			data-state={state ?? "loading"}
			{...props}
		>
			<ThemeStateIcon state={state} lightIcon={lightIcon} darkIcon={darkIcon} />
			{children}
		</Button>
	);
}

export default ThemeToggle;
