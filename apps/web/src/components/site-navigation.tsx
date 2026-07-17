"use client";

import { cn } from "@tentui.com/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SiteNavItem = {
	title: string;
	href: Route;
};

export function SiteNavigation({
	items,
	className,
}: {
	items: readonly SiteNavItem[];
	className?: string;
}) {
	const pathname = usePathname();

	return (
		<nav className={cn("flex items-center gap-4", className)}>
			{items.map(({ title, href }) => {
				const isActive =
					pathname === href ||
					(href !== "/" && pathname.startsWith(`${href}/`));

				return (
					<Link
						key={href}
						href={href}
						aria-current={isActive ? "page" : undefined}
						className="font-medium text-muted-foreground text-sm tracking-wide transition-colors hover:text-foreground aria-[current=page]:text-foreground"
					>
						{title}
					</Link>
				);
			})}
		</nav>
	);
}
