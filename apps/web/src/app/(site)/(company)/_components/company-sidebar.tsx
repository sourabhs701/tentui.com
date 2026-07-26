"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
	ARCHIVE_SIDEBAR_ROW,
	ArchiveSidebar,
	ArchiveSidebarActiveRail,
} from "@/components/archive-sidebar";
import { cn } from "@/lib/utils";

const LEGAL = [
	{ href: "/license" as Route, label: "License" },
	{ href: "/terms" as Route, label: "Terms" },
	{ href: "/privacy" as Route, label: "Privacy" },
	{ href: "/copyright" as Route, label: "Copyright" },
] as const;

export function CompanySidebar() {
	const pathname = usePathname();

	return (
		<ArchiveSidebar title="Legal" aria-label="Company">
			{LEGAL.map((item) => {
				const active = pathname === item.href;
				return (
					<li key={item.href}>
						<Link
							href={item.href}
							aria-current={active ? "page" : undefined}
							className={cn(
								ARCHIVE_SIDEBAR_ROW,
								active
									? "bg-primary/10 text-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							{active ? <ArchiveSidebarActiveRail /> : null}
							{item.label}
						</Link>
					</li>
				);
			})}
		</ArchiveSidebar>
	);
}
