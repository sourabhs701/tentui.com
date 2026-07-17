"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@tentui.com/ui/components/popover";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { SiteNavItem } from "./site-navigation";

export function SiteMobileNav({ items }: { items: readonly SiteNavItem[] }) {
	const [open, setOpen] = React.useState(false);
	const pathname = usePathname();

	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger render={<MobileNavTrigger />} />

			<PopoverContent
				className="w-48 gap-0 rounded-xl p-1"
				side="top"
				align="center"
				sideOffset={8}
			>
				<nav className="flex flex-col" aria-label="Mobile navigation">
					{items.map(({ title, href }) => {
						const isActive =
							pathname === href ||
							(href !== "/" && pathname.startsWith(`${href}/`));

						return (
							<Link
								key={href}
								href={href}
								aria-current={isActive ? "page" : undefined}
								className="rounded-lg px-3 py-1.5 text-base aria-[current=page]:bg-accent"
								onClick={() => setOpen(false)}
							>
								{title}
							</Link>
						);
					})}
				</nav>
			</PopoverContent>
		</Popover>
	);
}

function MobileNavTrigger(props: React.ComponentProps<typeof Button>) {
	return (
		<Button
			className="group relative flex touch-manipulation flex-col gap-1 border-none before:absolute before:-top-8 before:-right-2 before:-bottom-1 before:-left-2 active:translate-y-0 aria-expanded:bg-accent"
			variant="ghost"
			size="icon-sm"
			aria-label="Toggle menu"
			{...props}
		>
			<span className="flex h-0.5 w-4 rounded-[1px] bg-foreground transition-transform group-aria-expanded:translate-y-0.75 group-aria-expanded:rotate-45" />
			<span className="flex h-0.5 w-4 rounded-[1px] bg-foreground transition-transform group-aria-expanded:-translate-y-0.75 group-aria-expanded:-rotate-45" />
		</Button>
	);
}
