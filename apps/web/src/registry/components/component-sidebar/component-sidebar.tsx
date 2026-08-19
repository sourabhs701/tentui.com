"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	MotionConfig,
	type MotionValue,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import * as React from "react";
import { useWebHaptics } from "web-haptics/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

import { useMetalClickSound } from "@/hooks/soundcn/use-metal-click-sound";
import { cn } from "@/lib/utils";

const NORMAL_LINE_WIDTH = 24;
const MAX_LINE_WIDTH = 40;
const PROXIMITY_RADIUS = 30;
const GAP_LINES = [0, 1] as const;
const DEFAULT_CROSS_INTERVAL = 70;

export type ComponentSidebarItem = {
	title: string;
	href: string;
	isNew?: boolean;
	isUpdated?: boolean;
	external?: boolean;
};

export type ComponentSidebarGroup = {
	title: string;
	items: readonly ComponentSidebarItem[];
	newCount?: number;
};

export type ComponentSidebarLinkProps = Omit<
	React.ComponentPropsWithRef<"a">,
	"href"
> & {
	href: string;
};

export type ComponentSidebarRenderLink = (
	props: ComponentSidebarLinkProps,
	item: ComponentSidebarItem,
) => React.ReactNode;

export type ComponentSidebarProps = React.ComponentPropsWithRef<"div"> & {
	/** Controlled visibility. */
	open?: boolean;
	/** Initial visibility when uncontrolled. */
	defaultOpen?: boolean;
	/** Called after the toggle button or shortcut requests a visibility change. */
	onOpenChange?: (open: boolean) => void;
	/** Single-key shortcut used to toggle the sidebar. Pass false to disable it. */
	shortcutKey?: string | false;
	/** Accessible label and tooltip text for the toggle button. */
	toggleLabel?: string;
	/** Classes applied to the bordered sidebar panel. */
	panelClassName?: string;
};

export function ComponentSidebar({
	children,
	className,
	defaultOpen = true,
	onOpenChange,
	open,
	panelClassName,
	ref,
	shortcutKey = "s",
	toggleLabel = "Toggle sidebar",
	...props
}: ComponentSidebarProps) {
	const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
	const [instant, setInstant] = React.useState(false);
	const isOpen = open ?? internalOpen;
	const panelId = React.useId();
	const shouldReduceMotion = useReducedMotion();
	const [playMetalClick] = useMetalClickSound();
	const { trigger: haptic } = useWebHaptics();
	const normalizedShortcut =
		typeof shortcutKey === "string" ? shortcutKey.trim().toLowerCase() : null;

	const setOpen = React.useCallback(
		(nextOpen: boolean) => {
			if (open === undefined) setInternalOpen(nextOpen);
			onOpenChange?.(nextOpen);
		},
		[onOpenChange, open],
	);

	const toggleSidebar = React.useCallback(
		(animate: boolean) => {
			const nextOpen = !isOpen;
			if (!animate) setInstant(true);
			playMetalClick();
			void haptic("selection");
			setOpen(nextOpen);
		},
		[haptic, isOpen, playMetalClick, setOpen],
	);

	React.useEffect(() => {
		if (!instant) return;

		const frame = requestAnimationFrame(() => setInstant(false));
		return () => cancelAnimationFrame(frame);
	}, [instant]);

	React.useEffect(() => {
		if (!normalizedShortcut) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.defaultPrevented ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.key.toLowerCase() !== normalizedShortcut
			) {
				return;
			}

			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
			) {
				return;
			}

			event.preventDefault();
			toggleSidebar(false);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [normalizedShortcut, toggleSidebar]);

	return (
		<div
			ref={ref}
			data-open={isOpen}
			data-slot="component-sidebar"
			className={cn(
				"[--component-sidebar-height:min(34rem,calc(100svh-1rem))]",
				"[--component-sidebar-radius:var(--radius-xl)]",
				"[--component-sidebar-top:0px]",
				"[--component-sidebar-width:--spacing(60)]",
				"sticky top-(--component-sidebar-top) isolate flex flex-col overflow-x-clip",
				className,
			)}
			{...props}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							aria-controls={panelId}
							aria-expanded={isOpen}
							aria-keyshortcuts={
								normalizedShortcut?.length === 1
									? normalizedShortcut.toUpperCase()
									: undefined
							}
							aria-label={toggleLabel}
							className={cn(
								"[--trigger-inset:--spacing(1.5)]",
								"[--trigger-radius:calc(var(--component-sidebar-radius)-var(--trigger-inset)+1px)]",
								"pointer-events-auto absolute top-(--trigger-inset) left-(--trigger-inset) z-10 size-7 rounded-(--trigger-radius) border-none",
								"transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
								"data-[sidebar-open=false]:inset-ring-1 data-[sidebar-open=false]:inset-ring-border",
							)}
							data-sidebar-open={isOpen}
							onClick={() => toggleSidebar(true)}
							size="icon-sm"
							variant="ghost"
						>
							<ComponentSidebarIcon
								aria-hidden="true"
								duration={
									instant || shouldReduceMotion === true ? 0 : undefined
								}
								open={isOpen}
							/>
						</Button>
					}
				/>
				<TooltipContent className="pr-2 pl-3" side="right">
					<div className="flex items-center gap-3">
						{toggleLabel}
						{normalizedShortcut?.length === 1 ? (
							<Kbd>{normalizedShortcut.toUpperCase()}</Kbd>
						) : null}
					</div>
				</TooltipContent>
			</Tooltip>

			<div
				id={panelId}
				aria-hidden={!isOpen}
				className={cn(
					"flex h-(--component-sidebar-height) w-(--component-sidebar-width) flex-col rounded-(--component-sidebar-radius) border bg-background",
					"-translate-x-[calc(var(--component-sidebar-width)-1px)] data-open:translate-x-0",
					"transition-[translate] duration-350 ease-[cubic-bezier(0.24,0.88,0.28,0.92)] data-[instant=true]:transition-none motion-reduce:transition-none",
					panelClassName,
				)}
				data-instant={instant || undefined}
				data-open={isOpen}
				data-slot="component-sidebar-panel"
				inert={!isOpen}
			>
				<div className="no-scrollbar scroll-fade grow overflow-y-auto overflow-x-clip overscroll-contain pt-10.25">
					{children}
				</div>
			</div>
		</div>
	);
}

export type ComponentSidebarContentProps = Omit<
	React.ComponentPropsWithRef<"nav">,
	"children"
> & {
	groups: readonly ComponentSidebarGroup[];
	activeHref?: string;
	renderLink?: ComponentSidebarRenderLink;
	onItemCrossCenter?: (item: ComponentSidebarItem) => void;
	itemCrossInterval?: number;
};

export function ComponentSidebarContent({
	activeHref,
	className,
	groups,
	itemCrossInterval = DEFAULT_CROSS_INTERVAL,
	onItemCrossCenter,
	onPointerCancel,
	onPointerLeave,
	onPointerMove,
	ref,
	renderLink = renderAnchor,
	...props
}: ComponentSidebarContentProps) {
	const activeItemRef = React.useRef<HTMLAnchorElement | null>(null);
	const pointerY = useMotionValue(Number.POSITIVE_INFINITY);
	const shouldReduceMotion = useReducedMotion();
	const lastCrossAtRef = React.useRef(Number.NEGATIVE_INFINITY);
	const { click: playClick, hover: playHover } = useTiks();
	const { trigger: haptic } = useWebHaptics();

	const handleItemCrossCenter = React.useCallback(
		(item: ComponentSidebarItem) => {
			const now = performance.now();
			if (now - lastCrossAtRef.current < itemCrossInterval) return;

			lastCrossAtRef.current = now;
			playHover();
			onItemCrossCenter?.(item);
		},
		[itemCrossInterval, onItemCrossCenter, playHover],
	);

	const handleItemSelect = React.useCallback(() => {
		playClick();
		void haptic("selection");
	}, [haptic, playClick]);

	React.useEffect(() => {
		if (activeHref) {
			activeItemRef.current?.scrollIntoView({ block: "center" });
		}
	}, [activeHref]);

	return (
		<MotionConfig reducedMotion="user">
			<nav
				ref={ref}
				aria-label="Library navigation"
				className={cn("flex flex-col py-5.25 pr-0.5 pl-3", className)}
				data-slot="component-sidebar-content"
				onPointerCancel={(event) => {
					onPointerCancel?.(event);
					if (!event.defaultPrevented) {
						pointerY.set(Number.POSITIVE_INFINITY);
					}
				}}
				onPointerLeave={(event) => {
					onPointerLeave?.(event);
					if (!event.defaultPrevented) {
						pointerY.set(Number.POSITIVE_INFINITY);
					}
				}}
				onPointerMove={(event) => {
					onPointerMove?.(event);
					if (event.defaultPrevented) return;

					if (event.pointerType === "touch" || shouldReduceMotion === true) {
						pointerY.set(Number.POSITIVE_INFINITY);
						return;
					}

					pointerY.set(event.clientY);
				}}
				{...props}
			>
				{groups.map((group, groupIndex) => (
					<section
						className={
							groupIndex > 0 ? "mt-5 border-border/40 border-t pt-5" : ""
						}
						key={`${group.title}-${groupIndex}`}
					>
						<h4 className="mb-2.5 flex w-full items-center justify-between gap-2 pr-3 font-semibold text-[12px] text-foreground/70 uppercase tracking-widest">
							<span>{group.title}</span>
							{group.newCount ? (
								<Badge
									className="h-4 rounded-sm border-border/60 bg-background/40 px-1.5 py-0 font-medium text-[9px]/4 text-muted-foreground tracking-normal shadow-none"
									variant="outline"
								>
									New {group.newCount}
								</Badge>
							) : null}
						</h4>

						<div className="flex flex-col gap-2 py-2">
							{group.items.map((item, itemIndex) => (
								<ComponentSidebarMenuItem
									activeRef={
										item.href === activeHref ? activeItemRef : undefined
									}
									isActive={item.href === activeHref}
									isLast={itemIndex === group.items.length - 1}
									item={item}
									key={item.href}
									onCrossCenter={handleItemCrossCenter}
									onSelect={handleItemSelect}
									pointerY={pointerY}
									renderLink={renderLink}
								/>
							))}
						</div>
					</section>
				))}
			</nav>
		</MotionConfig>
	);
}

export type ComponentSidebarIconProps =
	React.ComponentPropsWithoutRef<"svg"> & {
		open?: boolean;
		duration?: number;
	};

export function ComponentSidebarIcon({
	duration = 0.2,
	open = false,
	...props
}: ComponentSidebarIconProps) {
	return (
		// Icon designed by @ncdai.
		<svg
			fill="none"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<rect
				height="18"
				rx="4"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				width="20"
				x="2"
				y="3"
			/>
			<motion.rect
				animate={{ width: open ? 6 : 2 }}
				fill="currentColor"
				height="12"
				initial={false}
				rx="1"
				transition={{
					duration,
					ease: [0.23, 1, 0.32, 1],
				}}
				x="5"
				y="6"
			/>
		</svg>
	);
}

function useProximityLine(
	pointerY: MotionValue<number>,
	isExpanded = false,
	onCrossCenter?: (item: ComponentSidebarItem) => void,
	item?: ComponentSidebarItem,
) {
	const ref = React.useRef<HTMLSpanElement>(null);
	const previousPointerYRef = React.useRef(Number.POSITIVE_INFINITY);
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
		if (crossedCenter && item) onCrossCenter?.(item);

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
	const lineTransform = useMotionTemplate`scaleX(${scaleX})`;
	const labelTransform = useMotionTemplate`translateX(${labelX}px)`;

	return { labelTransform, lineTransform, ref };
}

function ComponentSidebarSpacerLine({
	pointerY,
}: {
	pointerY: MotionValue<number>;
}) {
	const { lineTransform, ref } = useProximityLine(pointerY);

	return (
		<motion.span
			ref={ref}
			aria-hidden="true"
			className="-mr-4 block h-px w-10 origin-left bg-foreground/20"
			style={{ transform: lineTransform }}
		/>
	);
}

type ComponentSidebarMenuItemProps = {
	activeRef?: React.Ref<HTMLAnchorElement>;
	isActive: boolean;
	isLast: boolean;
	item: ComponentSidebarItem;
	onCrossCenter: (item: ComponentSidebarItem) => void;
	onSelect: () => void;
	pointerY: MotionValue<number>;
	renderLink: ComponentSidebarRenderLink;
};

const ComponentSidebarMenuItem = React.memo(function ComponentSidebarMenuItem({
	activeRef,
	isActive,
	isLast,
	item,
	onCrossCenter,
	onSelect,
	pointerY,
	renderLink,
}: ComponentSidebarMenuItemProps) {
	const isExternal = item.external ?? /^https?:\/\//.test(item.href);
	const { labelTransform, lineTransform, ref } = useProximityLine(
		pointerY,
		isActive,
		onCrossCenter,
		item,
	);
	const link = renderLink(
		{
			ref: activeRef,
			"aria-current": isActive ? "page" : undefined,
			className:
				"group relative flex h-px items-center gap-3 after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:p-3.5",
			href: item.href,
			onClick: onSelect,
			rel: isExternal ? "noreferrer" : undefined,
			target: isExternal ? "_blank" : undefined,
			children: (
				<>
					<motion.span
						ref={ref}
						aria-hidden="true"
						className="-mr-4 block h-px w-10 shrink-0 origin-left bg-foreground/20 transition-[background-color] ease-out group-hover:bg-foreground group-aria-[current=page]:bg-foreground"
						style={{ transform: lineTransform }}
					/>
					<motion.span
						className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm transition-[color] ease-out group-hover:text-foreground group-aria-[current=page]:text-foreground"
						style={{ transform: labelTransform }}
					>
						<span>{item.title}</span>
						{item.isNew ? (
							<>
								<span
									aria-hidden="true"
									className="size-1.5 shrink-0 rounded-full bg-primary"
								/>
								<span className="sr-only">New</span>
							</>
						) : null}
						{item.isUpdated ? (
							<>
								<span
									aria-hidden="true"
									className="size-1.5 shrink-0 rounded-full bg-yellow-400"
								/>
								<span className="sr-only">Updated</span>
							</>
						) : null}
					</motion.span>
				</>
			),
		},
		item,
	);

	return (
		<>
			{link}
			{isLast
				? null
				: GAP_LINES.map((line) => (
						<ComponentSidebarSpacerLine key={line} pointerY={pointerY} />
					))}
		</>
	);
});

function renderAnchor(props: ComponentSidebarLinkProps) {
	return <a {...props} />;
}

export default ComponentSidebar;
