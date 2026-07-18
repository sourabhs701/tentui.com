"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
		<nav
			aria-label="Company"
			className="self-start py-8 md:sticky md:top-12 md:py-14"
		>
			<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.32em]">
				Legal
			</p>

			<ul className="mt-6 space-y-0.5">
				{LEGAL.map((item) => {
					const active = pathname === item.href;
					return (
						<li key={item.href}>
							<Link
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"group relative flex items-center gap-2 py-1.5 pr-2 pl-4 font-mono text-[13px] tracking-tight transition-colors",
									active
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"absolute top-0 bottom-0 left-0 w-px transition-colors",
										active
											? "bg-primary"
											: "bg-transparent group-hover:bg-border",
									)}
								/>
								{item.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
