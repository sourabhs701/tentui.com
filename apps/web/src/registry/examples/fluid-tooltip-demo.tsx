"use client";

import {
	BoldIcon,
	CalendarIcon,
	HouseIcon,
	InboxIcon,
	ItalicIcon,
	LinkIcon,
	MessageSquareIcon,
	SettingsIcon,
	ShareIcon,
} from "lucide-react";

import {
	FluidTooltip,
	FluidTooltipGroup,
} from "@/registry/components/fluid-tooltip/fluid-tooltip";

const BUTTON =
	"grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground outline-offset-2 transition-colors duration-150 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid [&_svg]:size-[18px]";

const TOOLS = [
	{ label: "Bold", shortcut: "⌘B", icon: BoldIcon },
	{ label: "Italic", shortcut: "⌘I", icon: ItalicIcon },
	{ label: "Link", shortcut: "⌘K", icon: LinkIcon },
	{ label: "Comment", shortcut: "⌘⌥M", icon: MessageSquareIcon },
	{ label: "Share", icon: ShareIcon },
];

const PLACES = [
	{ label: "Home", shortcut: ["⌘", "1"], icon: HouseIcon },
	{ label: "Inbox", shortcut: ["⌘", "2"], icon: InboxIcon },
	{ label: "Calendar", shortcut: ["⌘", "3"], icon: CalendarIcon },
	{ label: "Settings", shortcut: ["⌘", ","], icon: SettingsIcon },
];

function FluidTooltipDemo() {
	return (
		<div className="flex w-full max-w-[420px] flex-wrap items-end justify-center gap-x-14 gap-y-10 py-6">
			<div className="flex flex-col items-center gap-3">
				<FluidTooltipGroup side="top">
					<div
						role="toolbar"
						aria-label="Formatting"
						className="flex items-center gap-0.5 rounded-2xl bg-muted/70 p-1"
					>
						{TOOLS.map(({ label, shortcut, icon: Icon }) => (
							<FluidTooltip key={label} content={label} shortcut={shortcut}>
								<button type="button" aria-label={label} className={BUTTON}>
									<Icon aria-hidden="true" />
								</button>
							</FluidTooltip>
						))}
					</div>
				</FluidTooltipGroup>
				<p className="text-muted-foreground text-xs">Toolbar</p>
			</div>

			<div className="flex flex-col items-center gap-3">
				<FluidTooltipGroup side="right">
					<nav
						aria-label="Workspace"
						className="flex flex-col items-center gap-0.5 rounded-2xl bg-muted/70 p-1"
					>
						{PLACES.map(({ label, shortcut, icon: Icon }) => (
							<FluidTooltip key={label} content={label} shortcut={shortcut}>
								<button type="button" aria-label={label} className={BUTTON}>
									<Icon aria-hidden="true" />
								</button>
							</FluidTooltip>
						))}
					</nav>
				</FluidTooltipGroup>
				<p className="text-muted-foreground text-xs">Rail</p>
			</div>
		</div>
	);
}

export default FluidTooltipDemo;
