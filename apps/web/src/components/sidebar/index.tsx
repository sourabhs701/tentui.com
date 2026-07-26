"use client";

import { Badge } from "@tentui.com/ui/components/badge";
import { Button } from "@tentui.com/ui/components/button";
import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useCallback, useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useClickSound } from "@/hooks/soundcn/use-click-sound";
import { useMetalClickSound } from "@/hooks/soundcn/use-metal-click-sound";
import { cn } from "@/lib/utils";

import type { SidebarIconHandle } from "./sidebar-icon";
import { SidebarIcon } from "./sidebar-icon";

const DEFAULT_SIDEBAR_OPEN = true;
const NORMAL_LINE_WIDTH = 24;
const MAX_LINE_WIDTH = 40;
const PROXIMITY_RADIUS = 30;
const GAP_LINE_COUNT = 2;
const TICK_INTERVAL = 70;
const TICK_VOLUME = 0.09;

const sidebarOpenAtom = atomWithStorage(
	"tentui:sidebar-open:v1",
	DEFAULT_SIDEBAR_OPEN,
);

export function Sidebar({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);
	const [click] = useMetalClickSound();

	const sidebarIconref = useRef<SidebarIconHandle>(null);

	const toggleSidebar = useCallback(() => {
		click();
		setIsOpen((previousIsOpen) => !previousIsOpen);
	}, [click, setIsOpen]);

	useHotkeys("s", toggleSidebar);

	useEffect(() => {
		if (isOpen) {
			sidebarIconref.current?.startAnimation();
		} else {
			sidebarIconref.current?.stopAnimation();
		}
	}, [isOpen]);

	return (
		<div
			data-open={isOpen}
			className={cn(
				"[--sidebar-width:--spacing(60)]",
				"[--sidebar-radius:var(--radius-xl)]",
				// "[--sidebar-top:--spacing(1)]",
				"[--sidebar-top:calc(var(--header-height)+(--spacing(2)))]",
				"sticky top-(--sidebar-top) isolate flex flex-col max-lg:fixed max-lg:left-2 max-lg:z-50 max-lg:data-[open=false]:pointer-events-none",
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
								"pointer-events-auto absolute top-(--trigger-inset) left-(--trigger-inset) z-10 size-7 rounded-(--trigger-radius) border-none",
								"data-[sidebar-open=false]:inset-ring-1 data-[sidebar-open=false]:inset-ring-border",
							)}
							variant="ghost"
							size="icon-sm"
							onClick={toggleSidebar}
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

type MenuItem = {
	title: string;
	href: string;
	isNew?: boolean;
};

type MenuGroup = {
	title: string;
	items: MenuItem[];
	newCount?: number;
};

export function SidebarContent({ groups }: { groups: MenuGroup[] }) {
	const pathname = usePathname();
	const itemActiveRef = useRef<HTMLAnchorElement | null>(null);
	const pointerY = useMotionValue(Number.POSITIVE_INFINITY);
	const shouldReduceMotion = useReducedMotion();
	const lastTickAtRef = useRef(Number.NEGATIVE_INFINITY);
	const [playClick] = useClickSound();

	const playTick = useCallback(() => {
		const now = performance.now();
		if (now - lastTickAtRef.current < TICK_INTERVAL) return;

		lastTickAtRef.current = now;
		playClick({ volume: TICK_VOLUME });
	}, [playClick]);

	// Scroll active item into view on mount
	useEffect(() => {
		itemActiveRef.current?.scrollIntoView({ block: "center" });
	}, []);

	return (
		<nav
			aria-label="Library navigation"
			className="flex flex-col py-5.25 pr-0.5 pl-3"
			onPointerCancel={() => pointerY.set(Number.POSITIVE_INFINITY)}
			onPointerLeave={() => pointerY.set(Number.POSITIVE_INFINITY)}
			onPointerMove={(event) => {
				if (event.pointerType === "touch" || shouldReduceMotion === true) {
					pointerY.set(Number.POSITIVE_INFINITY);
					return;
				}

				pointerY.set(event.clientY);
			}}
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
								variant="outline"
								className="h-4 rounded-sm border-border/60 bg-background/40 px-1.5 py-0 font-medium text-[9px]/4 text-muted-foreground tracking-normal shadow-none"
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
								onCrossCenter={playTick}
								pointerY={pointerY}
							/>
						))}
					</div>
				</section>
			))}
		</nav>
	);
}

function useProximityLine(
	pointerY: MotionValue<number>,
	isExpanded = false,
	onCrossCenter?: () => void,
) {
	const ref = useRef<HTMLSpanElement>(null);
	const previousPointerYRef = useRef(Number.POSITIVE_INFINITY);
	const restingScale =
		(isExpanded ? MAX_LINE_WIDTH : NORMAL_LINE_WIDTH) / MAX_LINE_WIDTH;
	const targetScaleX = useTransform(pointerY, (currentPointerY) => {
		const previousPointerY = previousPointerYRef.current;
		previousPointerYRef.current = currentPointerY;

		if (!Number.isFinite(currentPointerY)) return restingScale;

		const bounds = ref.current?.getBoundingClientRect();
		if (!bounds) return restingScale;

		const lineCenterY = bounds.top + bounds.height / 2;
		const crossedCenter =
			Number.isFinite(previousPointerY) &&
			((previousPointerY < lineCenterY && currentPointerY >= lineCenterY) ||
				(previousPointerY > lineCenterY && currentPointerY <= lineCenterY));
		if (crossedCenter) onCrossCenter?.();

		const distance = Math.abs(currentPointerY - lineCenterY);
		const proximity = 1 - Math.min(distance / PROXIMITY_RADIUS, 1);

		return restingScale + (1 - restingScale) * proximity;
	});
	const scaleX = useSpring(targetScaleX, {
		stiffness: 320,
		damping: 34,
		mass: 0.7,
	});
	const labelX = useTransform(
		scaleX,
		(scale) => scale * MAX_LINE_WIDTH - NORMAL_LINE_WIDTH,
	);

	return { labelX, ref, scaleX };
}

function SidebarSpacerLine({ pointerY }: { pointerY: MotionValue<number> }) {
	const { ref, scaleX } = useProximityLine(pointerY);

	return (
		<motion.span
			ref={ref}
			aria-hidden="true"
			className="-mr-4 block h-px w-10 origin-left bg-foreground/20"
			style={{ scaleX }}
		/>
	);
}

const SidebarMenuItem = memo(function SidebarMenuItem({
	ref,
	title,
	href,
	isNew = false,
	isActive = false,
	isLast = false,
	onCrossCenter,
	pointerY,
}: MenuItem & {
	ref?: React.Ref<HTMLAnchorElement>;
	isNew?: boolean;
	isActive?: boolean;
	isLast?: boolean;
	onCrossCenter: () => void;
	pointerY: MotionValue<number>;
}) {
	const isExternal = href.startsWith("http");
	const {
		labelX,
		ref: lineRef,
		scaleX,
	} = useProximityLine(pointerY, isActive, onCrossCenter);

	return (
		<>
			<Link
				ref={ref}
				aria-current={isActive ? "page" : undefined}
				className="group relative flex h-px items-center gap-3 after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:p-3.5"
				href={href as Route}
				target={isExternal ? "_blank" : undefined}
				rel={isExternal ? "noreferrer" : undefined}
			>
				<motion.span
					ref={lineRef}
					aria-hidden="true"
					className="-mr-4 block h-px w-10 shrink-0 origin-left bg-foreground/20 transition-[background-color] ease-out group-hover:bg-foreground group-aria-[current=page]:bg-foreground"
					style={{ scaleX }}
				/>
				<motion.span
					className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm transition-[color] ease-out group-hover:text-foreground group-aria-[current=page]:text-foreground"
					style={{ x: labelX }}
				>
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
				</motion.span>
			</Link>

			{!isLast &&
				Array.from({ length: GAP_LINE_COUNT }, (_, index) => (
					<SidebarSpacerLine key={index} pointerY={pointerY} />
				))}
		</>
	);
});
