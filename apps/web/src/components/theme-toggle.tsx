"use client";

import { Button } from "@tentui.com/ui/components/button";
import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useHotkeys } from "react-hotkeys-hook";

import { META_THEME_COLORS } from "@/config/site";
import { useClickSound } from "@/hooks/soundcn/use-click-sound";
import { useMetaColor } from "@/hooks/use-meta-color";

export function ThemeToggle() {
	const { resolvedTheme, systemTheme, setTheme } = useTheme();
	const { setMetaColor } = useMetaColor();
	const [click] = useClickSound();

	const switchTheme = () => {
		const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

		click();
		setTheme(nextTheme === systemTheme ? "system" : nextTheme);
		setMetaColor(
			resolvedTheme === "dark"
				? META_THEME_COLORS.light
				: META_THEME_COLORS.dark,
		);
	};

	useHotkeys("d", switchTheme);

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="relative touch-manipulation border-none"
						variant="ghost"
						size="icon-sm"
						aria-label="Toggle mode"
						onClick={switchTheme}
					/>
				}
			>
				<span className="absolute pointer-fine:hidden size-12" aria-hidden />
				<MoonIcon className="hidden size-4 [html.dark_&]:block" aria-hidden />
				<SunIcon className="hidden size-4 [html.light_&]:block" aria-hidden />
			</TooltipTrigger>
			<TooltipContent className="pr-2 pl-3">
				<div className="flex items-center gap-3">
					Toggle mode
					<Kbd>D</Kbd>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
