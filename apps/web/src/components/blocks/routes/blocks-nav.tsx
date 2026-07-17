"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { blockCategories } from "@/config/registry";

const navItems: Array<{ href: Route; title: string }> = [
	{ href: "/blocks", title: "All" },
	...blockCategories.map((category) => ({
		href: `/blocks/${category.name}` as Route,
		title: category.title,
	})),
];

export function BlocksNav() {
	const pathname = usePathname();

	return (
		<div className="no-scrollbar overflow-x-auto border-x">
			<nav
				aria-label="Block categories"
				className="flex w-max items-center whitespace-nowrap pr-2"
			>
				{navItems.map(({ href, title }) => (
					<Link
						key={href}
						href={href}
						aria-current={href === pathname ? "page" : undefined}
						className="border-line border-r p-4 font-medium font-mono text-[.8125rem]/4 text-muted-foreground uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
					>
						{title}
					</Link>
				))}
			</nav>
		</div>
	);
}
