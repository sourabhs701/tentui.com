"use client";

import {
	BookOpenIcon,
	CreditCardIcon,
	HomeIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";

import {
	SearchCommand,
	type SearchCommandGroup,
} from "@/registry/components/search-command";

const groups: readonly SearchCommandGroup[] = [
	{
		heading: "Menu",
		actionLabel: "Go to page",
		items: [
			{ title: "Home", icon: <HomeIcon />, shortcut: "GH" },
			{ title: "Customers", icon: <UsersIcon />, shortcut: "GC" },
			{ title: "Documentation", icon: <BookOpenIcon />, shortcut: "GD" },
		],
	},
	{
		heading: "Workspace",
		actionLabel: "Run command",
		items: [
			{ title: "Billing", icon: <CreditCardIcon /> },
			{ title: "Settings", icon: <SettingsIcon /> },
		],
	},
];

function SearchCommandPreview() {
	return <SearchCommand enabledHotkeys={false} groups={groups} />;
}

export default SearchCommandPreview;
