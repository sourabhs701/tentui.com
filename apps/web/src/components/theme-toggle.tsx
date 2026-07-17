"use client";

import { Button } from "@tentui.com/ui/components/button";
import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { useTheme } from "next-themes";
import { useHotkeys } from "react-hotkeys-hook";
import { META_THEME_COLORS } from "@/config/site";
import { useMetalClickSound } from "@/hooks/soundcn/use-metal-click-sound";
import { useMetaColor } from "@/hooks/use-meta-color";
import { MoonIcon } from "./animated-icons/moon-icon";
import { SunMediumIcon } from "./animated-icons/sun-medium-icon";

export function ThemeToggle() {
	const { resolvedTheme, systemTheme, setTheme } = useTheme();

	const { setMetaColor } = useMetaColor();

	const [click] = useMetalClickSound();

	const switchTheme = () => {
		const next = resolvedTheme === "dark" ? "light" : "dark";

		click();
		setTheme(next === systemTheme ? "system" : next);
		setMetaColor(
			resolvedTheme === "dark"
				? META_THEME_COLORS.light
				: META_THEME_COLORS.dark,
		);
	};

	useHotkeys("d", () => switchTheme());

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="relative touch-manipulation border-none"
						variant="ghost"
						size="icon-sm"
						aria-label="Toggle mode"
						onClick={() => switchTheme()}
					>
						<span
							className="absolute pointer-fine:hidden size-12"
							aria-hidden
						/>
						<MoonIcon className="hidden [html.dark_&]:block" aria-hidden />
						<SunMediumIcon
							className="hidden [html.light_&]:block"
							aria-hidden
						/>
					</Button>
				}
			/>
			<TooltipContent className="pr-2 pl-3">
				<div className="flex items-center gap-3">
					Toggle mode
					<Kbd>D</Kbd>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
