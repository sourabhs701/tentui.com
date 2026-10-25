"use client";

import { useCallback, useState } from "react";

import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";

const GROUPS = [
	{
		title: "Getting started",
		items: [
			{ title: "Overview", href: "/overview" },
			{ title: "Installation", href: "/installation" },
			{ title: "Changelog", href: "/changelog", isNew: true },
		],
		newCount: 1,
	},
	{
		title: "Components",
		items: [
			{ title: "Button", href: "/button", isUpdated: true },
			{ title: "Dialog", href: "/dialog" },
		],
	},
];

function ComponentSidebarPreview() {
	const [activeHref, setActiveHref] = useState("/overview");

	const renderLink = useCallback(
		({ href, onClick, ...props }: ComponentSidebarLinkProps) => (
			<a
				href={href}
				onClick={(event) => {
					onClick?.(event);
					if (event.defaultPrevented) return;

					event.preventDefault();
					setActiveHref(href);
				}}
				{...props}
			/>
		),
		[],
	);

	return (
		<ComponentSidebar
			className="relative top-auto [--component-sidebar-height:19rem]"
			shortcutKey={false}
		>
			<ComponentSidebarContent
				activeHref={activeHref}
				groups={GROUPS}
				renderLink={renderLink}
			/>
		</ComponentSidebar>
	);
}

export default ComponentSidebarPreview;
