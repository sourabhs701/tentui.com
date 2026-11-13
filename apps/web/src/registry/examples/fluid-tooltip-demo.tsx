"use client";

import {
	BoldIcon,
	CalendarIcon,
	CopyIcon,
	HouseIcon,
	InboxIcon,
	ItalicIcon,
	LinkIcon,
	MessageSquareIcon,
	SettingsIcon,
	ShareIcon,
	TargetIcon,
	Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
	FluidTooltip,
	FluidTooltipGroup,
} from "@/registry/components/fluid-tooltip/fluid-tooltip";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

const BUTTON =
	"grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground outline-offset-2 transition-colors duration-150 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-[18px]";

const TOOLS = [
	{ label: "Bold", shortcut: "⌘B", icon: BoldIcon },
	{ label: "Italic", shortcut: "⌘I", icon: ItalicIcon },
	{ label: "Link", shortcut: "⌘K", icon: LinkIcon },
	{ label: "Comment", shortcut: "⌘⌥M", icon: MessageSquareIcon },
	{ label: "Share", icon: ShareIcon },
];

function Toolbar() {
	return (
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
	);
}

const PLACES = [
	{ label: "Home", shortcut: "⌘1", icon: HouseIcon },
	{ label: "Inbox", shortcut: "⌘2", icon: InboxIcon },
	{ label: "Calendar", shortcut: "⌘3", icon: CalendarIcon },
	{ label: "Focus", shortcut: "⌘4", icon: TargetIcon },
	{ label: "Settings", shortcut: "⌘5", icon: SettingsIcon },
];

function SidebarRail() {
	return (
		<div className="flex w-full max-w-[300px] gap-3">
			<FluidTooltipGroup side="right">
				<nav
					aria-label="Workspace"
					className="flex flex-col items-center gap-1 rounded-2xl bg-muted/70 p-1"
				>
					{PLACES.map(({ label, shortcut, icon: Icon }) => (
						<FluidTooltip key={label} content={label} shortcut={shortcut}>
							<button type="button" aria-label={label} className={BUTTON}>
								<Icon aria-hidden="true" />
							</button>
						</FluidTooltip>
					))}
					<FluidTooltip content="Ada Lovelace">
						<button
							type="button"
							aria-label="Account"
							className="mt-1 grid size-9 cursor-pointer place-items-center rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid"
						>
							<span
								aria-hidden="true"
								className="grid size-7 place-items-center rounded-full bg-[linear-gradient(135deg,#f6c9a8,#e58f86)] font-semibold text-[11px] text-white dark:bg-[linear-gradient(135deg,#9a5b48,#7d3f45)]"
							>
								AL
							</span>
						</button>
					</FluidTooltip>
				</nav>
			</FluidTooltipGroup>
			<div aria-hidden="true" className="flex flex-1 flex-col gap-2 py-2">
				<div className="h-3 w-2/3 rounded-full bg-muted" />
				<div className="h-3 w-full rounded-full bg-muted/70" />
				<div className="h-3 w-5/6 rounded-full bg-muted/70" />
				<div className="h-3 w-1/2 rounded-full bg-muted/70" />
			</div>
		</div>
	);
}

function Standalone() {
	return (
		<div className="flex items-center gap-2">
			<FluidTooltip content="Copy link" shortcut={["⌘", "C"]}>
				<button type="button" aria-label="Copy link" className={BUTTON}>
					<CopyIcon aria-hidden="true" />
				</button>
			</FluidTooltip>
			<FluidTooltip content="Delete">
				<button
					type="button"
					aria-label="Delete (no permission)"
					disabled
					className={BUTTON}
				>
					<Trash2Icon aria-hidden="true" />
				</button>
			</FluidTooltip>
		</div>
	);
}

function FluidTooltipDemo() {
	return (
		<div className="flex w-full max-w-[360px] flex-col items-center gap-10 py-6">
			<Section title="Toolbar">
				<Toolbar />
			</Section>

			<Section title="Sidebar rail">
				<SidebarRail />
			</Section>

			<Section title="Standalone">
				<Standalone />
			</Section>
		</div>
	);
}

export default FluidTooltipDemo;
