"use client";

import {
	BoxIcon,
	FileTextIcon,
	LayoutPanelTopIcon,
	MonitorIcon,
	MoonStarIcon,
	RssIcon,
	SunMediumIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactElement, useCallback } from "react";
import { toast } from "sonner";

import { GITHUB_REPOSITORY } from "@/config/site";
import { useClickSound } from "@/hooks/soundcn/use-click-sound";
import {
	SearchCommand,
	type SearchCommandGroup,
	type SearchCommandItem,
} from "@/registry/components/search-command";
import { copyText } from "@/utils/copy";

import { GitHubIcon } from "./icons";
import { getTentUiMarkSVG, TentUiMark } from "./tentui-mark";

type CommandLink = {
	title: string;
	href: string;
	description?: string;
	category?: string;
	icon?: ReactElement;
	shortcut?: string;
	keywords?: string[];
	openInNewTab?: boolean;
};

type CommandMenuLink = Pick<CommandLink, "title" | "href" | "category"> & {
	description?: string;
};

const MENU_LINKS: CommandLink[] = [
	{
		title: "Home",
		href: "/",
		icon: <TentUiMark className="size-4 text-foreground" />,
		shortcut: "GH",
	},
	{
		title: "Components",
		href: "/components",
		icon: <BoxIcon />,
		shortcut: "GC",
	},
	{
		title: "Blocks",
		href: "/blocks",
		icon: <LayoutPanelTopIcon />,
		shortcut: "GB",
	},
];

const OTHER_LINKS: CommandLink[] = [
	{
		title: "llms.txt",
		href: "/llms.txt",
		icon: <FileTextIcon />,
		openInNewTab: true,
	},
	{
		title: "RSS Feed",
		href: "/rss",
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
	const [click] = useClickSound();

	const handleOpenLink = useCallback(
		(href: string, openInNewTab = false) => {
			if (openInNewTab) {
				window.open(href, "_blank", "noopener");
				return;
			}

			router.push(href as Route);
		},
		[router],
	);

	const handleCopyMark = useCallback(async () => {
		const copied = await copyText(getTentUiMarkSVG());
		if (copied) {
			toast.success("Mark as SVG copied");
			return;
		}

		toast.error("Unable to copy the TentUI mark");
	}, []);

	function createLinkItem(link: CommandLink): SearchCommandItem {
		return {
			id: `${link.href}:${link.title}`,
			title: link.title,
			description: link.description,
			icon: link.icon,
			meta: link.category,
			shortcut: link.shortcut,
			keywords: link.keywords,
			onSelect: () => handleOpenLink(link.href, link.openInNewTab),
		};
	}

	const groups: SearchCommandGroup[] = [
		{
			heading: "Menu",
			actionLabel: "Go to page",
			items: MENU_LINKS.map(createLinkItem),
		},
		...(components.length > 0
			? [
					{
						heading: "Components",
						actionLabel: "Go to component",
						items: components.map((component) =>
							createLinkItem({
								...component,
								icon: <BoxIcon />,
								keywords: ["component"],
							}),
						),
					},
				]
			: []),
		...(blocks.length > 0
			? [
					{
						heading: "Blocks",
						actionLabel: "Go to block",
						items: blocks.map((block) =>
							createLinkItem({
								...block,
								icon: <LayoutPanelTopIcon />,
								keywords: ["block"],
							}),
						),
					},
				]
			: []),
		{
			heading: "Other",
			actionLabel: "Open link",
			items: OTHER_LINKS.map(createLinkItem),
		},
		{
			heading: "Brand Assets",
			items: [
				{
					title: "Copy Mark as SVG",
					icon: <TentUiMark className="size-4 text-foreground" />,
					actionLabel: "Run command",
					onSelect: handleCopyMark,
				},
				{
					title: "View source code",
					icon: <GitHubIcon />,
					actionLabel: "Open link",
					onSelect: () =>
						handleOpenLink(`https://github.com/${GITHUB_REPOSITORY}`, true),
				},
			],
		},
		{
			heading: "Theme",
			actionLabel: "Run command",
			items: [
				{
					title: "Light",
					icon: <SunMediumIcon />,
					keywords: ["theme"],
					onBeforeSelect: click,
					onSelect: () => setTheme("light"),
				},
				{
					title: "Dark",
					icon: <MoonStarIcon />,
					keywords: ["theme"],
					onBeforeSelect: click,
					onSelect: () => setTheme("dark"),
				},
				{
					title: "System",
					icon: <MonitorIcon />,
					keywords: ["theme"],
					onBeforeSelect: click,
					onSelect: () => setTheme("system"),
				},
			],
		},
	];

	return (
		<SearchCommand
			defaultActionLabel="Go to page"
			enabledHotkeys={enabledHotkeys}
			footerIcon={<TentUiMark className="size-4 text-foreground" />}
			groups={groups}
		/>
	);
}
