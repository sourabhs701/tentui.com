"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { useMetalClickSound } from "@/hooks/soundcn/use-metal-click-sound";

export type ThemeState = "light" | "dark";

export type UseThemeToggleOptions = {
	onThemeChange?: (theme: ThemeState) => void;
};

export function useThemeToggle({ onThemeChange }: UseThemeToggleOptions = {}) {
	const { resolvedTheme, systemTheme, setTheme } = useTheme();
	const { trigger: haptic } = useWebHaptics();
	const [playClick] = useMetalClickSound();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	const state: ThemeState | null =
		mounted && (resolvedTheme === "light" || resolvedTheme === "dark")
			? resolvedTheme
			: null;

	const toggle = useCallback(() => {
		const nextTheme: ThemeState = state === "dark" ? "light" : "dark";

		setTheme(nextTheme === systemTheme ? "system" : nextTheme);
		playClick();
		void haptic("selection");
		onThemeChange?.(nextTheme);
	}, [state, systemTheme, setTheme, playClick, haptic, onThemeChange]);

	return { state, toggle } as const;
}
