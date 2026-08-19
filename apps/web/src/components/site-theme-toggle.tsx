"use client";

import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { META_THEME_COLORS } from "@/config/site";
import { useMetaColor } from "@/hooks/use-meta-color";
import { ThemeToggle as ThemeToggleButton } from "@/registry/components/theme-toggle/theme-toggle";
import { MoonIcon } from "./animated-icons/moon-icon";
import { SunMediumIcon } from "./animated-icons/sun-medium-icon";

export function SiteThemeToggle() {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const { setMetaColor } = useMetaColor();

	useHotkeys("d", () => buttonRef.current?.click());

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<ThemeToggleButton
						ref={buttonRef}
						className="relative touch-manipulation border-none"
						variant="ghost"
						size="icon-sm"
						lightIcon={<SunMediumIcon />}
						darkIcon={<MoonIcon />}
						onThemeChange={(theme) => {
							setMetaColor(META_THEME_COLORS[theme]);
						}}
					>
						<span
							className="absolute pointer-fine:hidden size-12"
							aria-hidden
						/>
					</ThemeToggleButton>
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
