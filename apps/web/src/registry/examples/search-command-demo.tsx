"use client";

import {
	BookOpenIcon,
	CreditCardIcon,
	FileTextIcon,
	HomeIcon,
	MonitorIcon,
	MoonStarIcon,
	SettingsIcon,
	SunMediumIcon,
	UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import {
	SearchCommand,
	type SearchCommandGroup,
} from "@/registry/components/search-command";

function NorthstarMark() {
	return (
		<svg
			className="size-full"
			fill="none"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default function SearchCommandDemo() {
	const [selection, setSelection] = useState("Home");
	const { setTheme } = useTheme();
	const groups: readonly SearchCommandGroup[] = [
		{
			heading: "Menu",
			actionLabel: "Go to page",
			items: [
				{
					title: "Home",
					description: "Workspace overview and recent activity",
					icon: <HomeIcon />,
					keywords: ["dashboard"],
					shortcut: "GH",
				},
				{
					title: "Customers",
					description: "Profiles, segments, and account health",
					icon: <UsersIcon />,
					shortcut: "GC",
				},
				{
					title: "Documentation",
					description: "Guides and API reference",
					icon: <BookOpenIcon />,
					shortcut: "GD",
				},
			],
		},
		{
			heading: "Workspace",
			actionLabel: "Run command",
			items: [
				{
					title: "Create document",
					description: "Start with a blank page",
					icon: <FileTextIcon />,
				},
				{
					title: "Billing",
					description: "Plans, invoices, and payment methods",
					icon: <CreditCardIcon />,
					meta: "Account",
				},
				{
					title: "Settings",
					description: "Preferences and integrations",
					icon: <SettingsIcon />,
				},
			],
		},
		{
			heading: "Theme",
			actionLabel: "Change theme",
			items: [
				{
					title: "Light",
					icon: <SunMediumIcon />,
					keywords: ["theme", "appearance"],
					onSelect: () => setTheme("light"),
				},
				{
					title: "Dark",
					icon: <MoonStarIcon />,
					keywords: ["theme", "appearance"],
					onSelect: () => setTheme("dark"),
				},
				{
					title: "System",
					icon: <MonitorIcon />,
					keywords: ["theme", "appearance"],
					onSelect: () => setTheme("system"),
				},
			],
		},
	];

	return (
		<div className="flex min-h-96 w-full items-center justify-center bg-background p-8">
			<div className="flex flex-col items-center gap-3 text-center">
				<SearchCommand
					enabledHotkeys={false}
					footerIcon={<NorthstarMark />}
					groups={groups}
					onItemSelect={(item) => setSelection(item.title)}
					shortcutKey="i"
					shortcutModifier="command"
				/>
				<p className="text-muted-foreground text-xs">Selected: {selection}</p>
			</div>
		</div>
	);
}
