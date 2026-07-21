"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@tentui.com/ui/components/command";
import { Kbd, KbdGroup } from "@tentui.com/ui/components/kbd";
import {
	BoxIcon,
	CopyIcon,
	CornerDownLeftIcon,
	LayoutPanelTopIcon,
	MonitorIcon,
	MoonStarIcon,
	RssIcon,
	SearchIcon,
	SunMediumIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

import { GITHUB_REPOSITORY } from "@/config/site";
import { useClickSound } from "@/hooks/soundcn/use-click-sound";
import { copyText } from "@/utils/copy";

import { GitHubIcon } from "./icons";
import { getTentUiMarkSVG, TentUiMark } from "./tentui-mark";

type CommandKind = "command" | "page" | "link" | "component" | "block";

type CommandLink = {
	title: string;
	href: string;
	kind: CommandKind;
	description?: string;
	category?: string;
	icon?: React.ReactElement;
	shortcut?: string;
	keywords?: string[];
	openInNewTab?: boolean;
};

type CommandMenuLink = Pick<
	CommandLink,
	"title" | "href" | "description" | "category"
>;

const MENU_LINKS: CommandLink[] = [
	{
		title: "Home",
		href: "/",
		kind: "page",
		icon: <TentUiMark className="size-4 text-foreground" />,
		shortcut: "GH",
	},
	{
		title: "Components",
		href: "/components",
		kind: "page",
		icon: <BoxIcon />,
		shortcut: "GC",
	},
	{
		title: "Blocks",
		href: "/blocks",
		kind: "page",
		icon: <LayoutPanelTopIcon />,
		shortcut: "GB",
	},
];

const OTHER_LINKS: CommandLink[] = [
	{
		title: "RSS Feed",
		href: "/rss",
		kind: "link",
		icon: <RssIcon />,
		openInNewTab: true,
	},
];

export default function CommandMenu({
	components,
	blocks,
	enabledHotkeys = false,
}: {
	components: CommandMenuLink[];
	blocks: CommandMenuLink[];
	enabledHotkeys?: boolean;
}) {
	const router = useRouter();
	const { setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [selectedCommandKind, setSelectedCommandKind] =
		useState<CommandKind | null>(null);
	const [click] = useClickSound();

	useHotkeys(
		"mod+k, slash",
		(event) => {
			event.preventDefault();
			setOpen((currentOpen) => !currentOpen);
		},
		{ enabled: enabledHotkeys },
	);

	const handleOpenLink = useCallback(
		(href: string, openInNewTab = false) => {
			setOpen(false);

			if (openInNewTab) {
				window.open(href, "_blank", "noopener");
				return;
			}

			router.push(href as Route);
		},
		[router],
	);

	const handleCopyMark = useCallback(async () => {
		setOpen(false);

		const copied = await copyText(getTentUiMarkSVG());
		if (copied) {
			toast.success("Mark as SVG copied");
			return;
		}

		toast.error("Unable to copy the TentUI mark");
	}, []);

	const createThemeHandler = useCallback(
		(theme: "light" | "dark" | "system") => () => {
			click();
			setOpen(false);
			setTheme(theme);
		},
		[click, setTheme],
	);

	return (
		<>
			<Button
				data-slot="command-menu-trigger"
				className="select-none gap-1.5 border-none px-1.5 text-muted-foreground will-change-[scale]"
				variant="ghost"
				size="sm"
				onClick={() => setOpen(true)}
			>
				<SearchIcon />
				<span className="font-medium font-sans text-sm/4 sm:hidden">
					Search…
				</span>
				<KbdGroup className="hidden gap-0.75 sm:in-[.os-macos_&]:flex">
					<Kbd className="w-5 min-w-auto">⌘</Kbd>
					<Kbd className="w-5 min-w-auto">K</Kbd>
				</KbdGroup>
				<KbdGroup className="hidden gap-0.75 sm:not-[.os-macos_&]:flex">
					<Kbd>Ctrl</Kbd>
					<Kbd className="w-5 min-w-auto">K</Kbd>
				</KbdGroup>
			</Button>

			<CommandDialog open={open} onOpenChange={setOpen}>
				<CommandMenuInput />

				<div className="rounded-xl bg-background ring-1 ring-border">
					<CommandList className="scroll-fade min-h-80">
						<CommandEmpty>No results found.</CommandEmpty>

						<CommandLinkGroup
							heading="Menu"
							links={MENU_LINKS}
							onLinkHighlight={(link) => setSelectedCommandKind(link.kind)}
							onLinkSelect={handleOpenLink}
						/>

						{components.length > 0 && (
							<CommandLinkGroup
								heading="Components"
								links={components.map((component) => ({
									...component,
									kind: "component" as const,
									icon: <BoxIcon />,
									keywords: ["component"],
								}))}
								onLinkHighlight={(link) => setSelectedCommandKind(link.kind)}
								onLinkSelect={handleOpenLink}
							/>
						)}

						{blocks.length > 0 && (
							<CommandLinkGroup
								heading="Blocks"
								links={blocks.map((block) => ({
									...block,
									kind: "block" as const,
									icon: <LayoutPanelTopIcon />,
									keywords: ["block"],
								}))}
								onLinkHighlight={(link) => setSelectedCommandKind(link.kind)}
								onLinkSelect={handleOpenLink}
							/>
						)}

						<CommandLinkGroup
							heading="Other"
							links={OTHER_LINKS}
							onLinkHighlight={(link) => setSelectedCommandKind(link.kind)}
							onLinkSelect={handleOpenLink}
						/>

						<CommandGroup heading="Brand Assets">
							<CommandMenuItem
								onHighlight={() => setSelectedCommandKind("command")}
								onSelect={handleCopyMark}
							>
								<TentUiMark className="size-4 text-foreground" />
								Copy Mark as SVG
							</CommandMenuItem>

							<CommandMenuItem
								onHighlight={() => setSelectedCommandKind("link")}
								onSelect={() =>
									handleOpenLink(
										`https://github.com/${GITHUB_REPOSITORY}`,
										true,
									)
								}
							>
								<GitHubIcon />
								View source code
							</CommandMenuItem>
						</CommandGroup>

						<CommandGroup heading="Theme">
							<CommandMenuItem
								keywords={["theme"]}
								onHighlight={() => setSelectedCommandKind("command")}
								onSelect={createThemeHandler("light")}
							>
								<SunMediumIcon />
								Light
							</CommandMenuItem>
							<CommandMenuItem
								keywords={["theme"]}
								onHighlight={() => setSelectedCommandKind("command")}
								onSelect={createThemeHandler("dark")}
							>
								<MoonStarIcon />
								Dark
							</CommandMenuItem>
							<CommandMenuItem
								keywords={["theme"]}
								onHighlight={() => setSelectedCommandKind("command")}
								onSelect={createThemeHandler("system")}
							>
								<MonitorIcon />
								System
							</CommandMenuItem>
						</CommandGroup>
					</CommandList>
				</div>

				<CommandMenuFooter selectedCommandKind={selectedCommandKind} />
			</CommandDialog>
		</>
	);
}

function CommandMenuInput() {
	const [searchValue, setSearchValue] = useState("");

	return (
		<CommandInput
			placeholder="Type a command or search…"
			value={searchValue}
			onValueChange={setSearchValue}
		/>
	);
}

function CommandMenuItem({
	children,
	onHighlight,
	...props
}: React.ComponentProps<typeof CommandItem> & {
	onHighlight?: () => void;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const commandItem = ref.current;
		if (!commandItem) {
			return;
		}

		const observer = new MutationObserver(() => {
			if (commandItem.dataset.selected === "true") {
				onHighlight?.();
			}
		});

		observer.observe(commandItem, {
			attributes: true,
			attributeFilter: ["data-selected"],
		});

		return () => observer.disconnect();
	}, [onHighlight]);

	return (
		<CommandItem ref={ref} {...props}>
			{children}
		</CommandItem>
	);
}

function CommandLinkGroup({
	heading,
	links,
	onLinkHighlight,
	onLinkSelect,
}: {
	heading: string;
	links: CommandLink[];
	onLinkHighlight: (link: CommandLink) => void;
	onLinkSelect: (href: string, openInNewTab?: boolean) => void;
}) {
	return (
		<CommandGroup heading={heading}>
			{links.map((link) => (
				<CommandMenuItem
					key={link.href}
					keywords={link.keywords}
					onHighlight={() => onLinkHighlight(link)}
					onSelect={() => onLinkSelect(link.href, link.openInNewTab)}
				>
					{link.icon ?? <CopyIcon />}
					<p className="line-clamp-1">{link.title}</p>
					{link.category ? (
						<span className="ml-auto font-mono font-normal text-muted-foreground text-xs tabular-nums max-sm:hidden">
							{link.category}
						</span>
					) : null}
					{link.shortcut ? (
						<CommandShortcut className="font-mono tracking-[0.2em] max-sm:hidden">
							{link.shortcut}
						</CommandShortcut>
					) : null}
				</CommandMenuItem>
			))}
		</CommandGroup>
	);
}

const ENTER_ACTION_LABELS: Record<CommandKind, string> = {
	command: "Run command",
	page: "Go to page",
	link: "Open link",
	component: "Go to component",
	block: "Go to block",
};

function CommandMenuFooter({
	selectedCommandKind,
}: {
	selectedCommandKind: CommandKind | null;
}) {
	return (
		<>
			<div className="flex h-10" />

			<div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-between gap-2 rounded-b-2xl px-4 font-medium text-xs">
				<TentUiMark className="size-4 text-foreground" />

				<div className="flex items-center gap-2 max-sm:hidden">
					<span>{ENTER_ACTION_LABELS[selectedCommandKind ?? "page"]}</span>
					<Kbd>
						<CornerDownLeftIcon />
					</Kbd>
				</div>
			</div>
		</>
	);
}
