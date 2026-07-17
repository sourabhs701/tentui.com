"use client";
import type { Route } from "next";
import { Sidebar, SidebarContent } from "@/components/sidebar";
import {
	ComponentGrid,
	ComponentLeftCol,
} from "@/components/sidebar/component-page-layout";
import { ComponentPageRoot } from "@/components/sidebar/component-page-root";
import { components } from "@/registry/components/_registry";
import { isNewComponent } from "@/utils/registry";

function sortByTitle<T extends { name: string; title?: string }>(items: T[]) {
	return [...items].sort((a, b) =>
		(a.title ?? a.name).localeCompare(b.title ?? b.name, "en", {
			sensitivity: "base",
		}),
	);
}

const sidebarComponentItems = sortByTitle(components).map((component) => ({
	title: component.title ?? component.name,
	href: `/components/${component.name}` as Route,
	isNew: isNewComponent(component),
}));

const sidebarGroups = [
	{
		title: "Components",
		newCount: sidebarComponentItems.filter((component) => component.isNew)
			.length,
		items: sidebarComponentItems,
	},
];

export default function ComponentPageLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ComponentPageRoot>
			<ComponentGrid className="pt-20">
				<ComponentLeftCol className="-translate-x-1 pb-3.75">
					<Sidebar>
						<SidebarContent groups={sidebarGroups} />
					</Sidebar>
				</ComponentLeftCol>

				{children}
			</ComponentGrid>
		</ComponentPageRoot>
	);
}
