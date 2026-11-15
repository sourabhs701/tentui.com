"use client";

import {
	BoldIcon,
	ItalicIcon,
	LinkIcon,
	MessageSquareIcon,
	ShareIcon,
} from "lucide-react";

import {
	FluidTooltip,
	FluidTooltipGroup,
} from "@/registry/components/fluid-tooltip/fluid-tooltip";

const TOOLS = [
	{ label: "Bold", shortcut: "⌘B", icon: BoldIcon },
	{ label: "Italic", shortcut: "⌘I", icon: ItalicIcon },
	{ label: "Link", shortcut: "⌘K", icon: LinkIcon },
	{ label: "Comment", shortcut: "⌘⌥M", icon: MessageSquareIcon },
	{ label: "Share", icon: ShareIcon },
];

function FluidTooltipPreview() {
	return (
		<FluidTooltipGroup side="top">
			<div
				role="toolbar"
				aria-label="Formatting"
				className="flex items-center gap-0.5 rounded-2xl bg-muted/70 p-1"
			>
				{TOOLS.map(({ label, shortcut, icon: Icon }) => (
					<FluidTooltip key={label} content={label} shortcut={shortcut}>
						<button
							type="button"
							aria-label={label}
							className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground outline-offset-2 transition-colors duration-150 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid [&_svg]:size-[18px]"
						>
							<Icon aria-hidden="true" />
						</button>
					</FluidTooltip>
				))}
			</div>
		</FluidTooltipGroup>
	);
}

export default FluidTooltipPreview;
