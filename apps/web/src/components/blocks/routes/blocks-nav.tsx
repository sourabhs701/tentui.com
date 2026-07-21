"use client";

import { Badge } from "@tentui.com/ui/components/badge";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { blockCategories } from "@/config/registry";
import { blocks } from "@/registry/blocks/_registry";
import { isNewRegistryItem } from "@/utils/registry";

const newBlocks = blocks.filter(isNewRegistryItem);

const navItems: Array<{ href: Route; title: string; newCount: number }> = [
	{ href: "/blocks", title: "All", newCount: newBlocks.length },
	...blockCategories.map((category) => ({
		href: `/blocks/${category.name}` as Route,
		title: category.title,
		newCount: newBlocks.filter((block) =>
			block.categories?.includes(category.name),
		).length,
	})),
];

export function BlocksNav() {
	const pathname = usePathname();

	return (
		<div className="no-scrollbar sticky top-[calc(var(--header-height))] z-20 overflow-x-auto border-x border-b bg-background">
			<nav
				aria-label="Block categories"
				className="flex w-max items-center whitespace-nowrap pr-2"
			>
				{navItems.map(({ href, title, newCount }) => (
					<Link
						key={href}
						href={href}
						aria-current={href === pathname ? "page" : undefined}
						className="inline-flex items-center gap-1.5 border-line border-r p-4 font-medium font-mono text-[.8125rem]/4 text-muted-foreground uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
					>
						{title}
						{!!newCount && (
							<Badge
								variant="outline"
								className="h-4 rounded-sm border-border/60 bg-background/40 px-1.5 py-0 font-medium text-[9px]/4 text-muted-foreground tracking-normal shadow-none"
							>
								New {newCount}
							</Badge>
						)}
					</Link>
				))}
			</nav>
		</div>
	);
}
