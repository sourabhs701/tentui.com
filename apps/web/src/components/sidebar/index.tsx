"use client";

import { Badge } from "@tentui.com/ui/components/badge";
import { Button } from "@tentui.com/ui/components/button";
import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { motion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "@/lib/utils";

import type { SidebarIconHandle } from "./sidebar-icon";
import { SidebarIcon } from "./sidebar-icon";

const DEFAULT_SIDEBAR_OPEN = true;

export function Sidebar({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(DEFAULT_SIDEBAR_OPEN);

	const sidebarIconref = useRef<SidebarIconHandle>(null);

	useHotkeys("s", () => setIsOpen((prev) => !prev));

	useEffect(() => {
		if (isOpen) {
			sidebarIconref.current?.startAnimation();
		} else {
			sidebarIconref.current?.stopAnimation();
		}
	}, [isOpen]);

	return (
		<div
			className={cn(
				"[--sidebar-width:--spacing(60)]",
				"[--sidebar-radius:var(--radius-xl)]",
				"[--sidebar-top:calc(var(--header-height)+(--spacing(12))+(--spacing(0.75)))]",
				"sticky top-(--sidebar-top) isolate flex flex-col max-xl:hidden",
			)}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							data-sidebar-open={isOpen}
							className={cn(
								"[--trigger-inset:--spacing(1.5)]",
								"[--trigger-radius:calc(var(--sidebar-radius)-var(--trigger-inset)+1px)]",
								"absolute top-(--trigger-inset) left-(--trigger-inset) z-10 size-7 rounded-(--trigger-radius) border-none",
								"data-[sidebar-open=false]:inset-ring-1 data-[sidebar-open=false]:inset-ring-border",
							)}
							variant="ghost"
							size="icon-sm"
							onClick={() => setIsOpen((prev) => !prev)}
						>
							<SidebarIcon
								ref={sidebarIconref}
								initial={DEFAULT_SIDEBAR_OPEN ? "animate" : "normal"}
							/>
						</Button>
					}
				/>
				<TooltipContent className="pr-2 pl-3" side="right">
					<div className="flex items-center gap-3">
						Toggle Sidebar
						<Kbd>S</Kbd>
					</div>
				</TooltipContent>
			</Tooltip>

			<div
				data-open={isOpen}
				className={cn(
					"flex flex-col rounded-(--sidebar-radius) border bg-background",
					"h-[calc(100svh-var(--sidebar-top)-var(--fade-bottom-height))] w-(--sidebar-width)",
					"-translate-x-[calc(var(--sidebar-width)-1px)] data-open:translate-x-0",
					"transition-[translate] duration-350 ease-[cubic-bezier(0.24,0.88,0.28,0.92)]",
				)}
				tabIndex={isOpen ? 0 : -1}
				aria-hidden={!isOpen}
			>
				<div className="no-scrollbar scroll-fade grow overflow-y-auto overflow-x-clip overscroll-contain pt-10.25">
					{children}
				</div>
			</div>
		</div>
	);
}

type MenuItem<T extends string = string> = {
	title: string;
	href: T;
	isNew?: boolean;
};

type MenuGroup<T extends string = string> = {
	title: string;
	items: MenuItem<T>[];
	newCount?: number;
};

export function SidebarContent({ groups }: { groups: MenuGroup<Route>[] }) {
	const pathname = usePathname();

	const itemActiveRef = useRef<HTMLAnchorElement | null>(null);

	// Scroll active item into view on mount
	useEffect(() => {
		itemActiveRef.current?.scrollIntoView({ block: "center" });
	}, []);

	return (
		<nav
			aria-label="Library navigation"
			className="flex flex-col py-5.25 pr-0.5 pl-3"
			style={
				{
					"--normal-line-width": `${lineVariants.normal.width}px`,
				} as React.CSSProperties
			}
		>
			{groups.map((group, index) => (
				<section
					key={group.title}
					className={index > 0 ? "mt-5 border-border/40 border-t pt-5" : ""}
				>
					<h4 className="mb-2.5 flex w-full items-center justify-between gap-2 pr-3 font-semibold text-[12px] text-zinc-700 uppercase tracking-widest dark:text-zinc-300">
						<span>{group.title}</span>
						{!!group.newCount && (
							<Badge
								variant="secondary"
								className="h-auto rounded-full bg-muted px-1.5 py-0.5 font-bold text-[9px] tracking-normal"
							>
								New {group.newCount}
							</Badge>
						)}
					</h4>

					<div className="flex flex-col gap-2 py-2">
						{group.items.map((item, index) => (
							<SidebarMenuItem
								key={item.href}
								ref={item.href === pathname ? itemActiveRef : undefined}
								title={item.title}
								href={item.href}
								isNew={item.isNew}
								isActive={item.href === pathname}
								isLast={index === group.items.length - 1}
							/>
						))}
					</div>
				</section>
			))}
		</nav>
	);
}

const MotionLink = motion.create(Link);

const lineVariants = {
	normal: { width: 24 },
	active: { width: 40 },
	hover: { width: 40 },
};

const SidebarMenuItem = memo(function SidebarMenuItem({
	ref,
	title,
	href,
	isNew = false,
	isActive = false,
	isLast = false,
}: MenuItem<Route> & {
	ref?: React.Ref<HTMLAnchorElement>;
	isNew?: boolean;
	isActive?: boolean;
	isLast?: boolean;
}) {
	return (
		<>
			<MotionLink
				ref={ref}
				aria-current={isActive ? "page" : undefined}
				className="group relative flex h-px items-center gap-3 after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:p-3.5"
				href={href}
				initial={false}
				animate={isActive ? "active" : "normal"}
				whileHover="hover"
			>
				<motion.span
					className="block h-px shrink-0 bg-foreground/20 transition-[background-color] ease-out group-hover:bg-foreground group-aria-[current=page]:bg-foreground"
					variants={lineVariants}
					transition={{ type: "spring", stiffness: 200, damping: 20 }}
				/>
				<span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm transition-[color] ease-out group-hover:text-foreground group-aria-[current=page]:text-foreground">
					<span>{title}</span>
					{isNew && (
						<>
							<span
								aria-hidden="true"
								className="size-1.5 shrink-0 rounded-full bg-blue-500"
							/>
							<span className="sr-only">New</span>
						</>
					)}
				</span>
			</MotionLink>

			{!isLast && (
				<>
					<span className="block h-px w-(--normal-line-width) bg-foreground/20" />
					<span className="block h-px w-(--normal-line-width) bg-foreground/20" />
				</>
			)}
		</>
	);
});
