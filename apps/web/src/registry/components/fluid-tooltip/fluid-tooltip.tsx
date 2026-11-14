"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	animate,
	domAnimation,
	LazyMotion,
	type MotionValue,
	m,
	useMotionValue,
	useReducedMotion,
	type Variants,
} from "motion/react";
import {
	Children,
	cloneElement,
	createContext,
	type FocusEvent,
	isValidElement,
	type MouseEvent,
	type PointerEvent,
	type ReactElement,
	type ReactNode,
	type Ref,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Layout, in px. The bubble is one small rounded box, sized to its label.
const HEIGHT = 24;
const PAD_X = 8;
/** Room kept between the bubble and the viewport edges. */
const VIEWPORT_PADDING = 8;

// The bubble is drawn between four edges, each on its own critically damped
// spring, so it glides onto a new target without overshoot. The edge facing
// the target is a touch quicker than the far one, which stretches the box very
// slightly along the way; the far edge then settles in behind it.
const leadSpring = { stiffness: 400, damping: 40 } as const;
const trailSpring = { stiffness: 340, damping: 37 } as const;
/** Edges across the direction of travel, such as a width change. */
const crossSpring = { stiffness: 380, damping: 39 } as const;
const leanSpring = { stiffness: 300, damping: 35 } as const;
/** The box is at most this many times its resting length mid-move. */
const MAX_STRETCH = 1.1;
/** How far, in px, the resting bubble leans toward the pointer with `follow`. */
const LEAN = 2;

// Timing, in ms.
/** A pointer that leaves a trigger has this long to reach another or the bubble. */
const CLOSE_GRACE = 120;
const LONG_PRESS = 450;
/** A long-press tooltip stays this long after the finger lifts. */
const TOUCH_HIDE = 1200;
/** Px a finger can drift before a long press is cancelled. */
const TOUCH_SLOP = 10;
const TICK_THROTTLE = 90;

// Motion, in seconds.
const OPEN_DURATION = 0.14;
const OPEN_SCALE = 0.97;
const CLOSE_DURATION = 0.1;
/** Reduced motion opens and closes with a plain fade. */
const FADE_DURATION = 0.1;
// The label swap is a short crossfade. The old label is nearly gone before the
// new one starts, so the two never read as one smeared label.
const SWAP_OUT = 0.08;
const SWAP_IN = 0.12;
const SWAP_IN_DELAY = 0.05;
/** Px the labels drift in the direction of travel as they swap. */
const SWAP_NUDGE = 2;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// A very soft, short tick of bright noise as the bubble lands on a new target.
const TICK_SOUND = {
	name: "fluid-tooltip-tick",
	baseFreq: 440,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 3000,
	filterQ: 1,
	attack: 0.001,
	decay: 0.5,
	brightness: 4200,
} as const;

type Side = "top" | "right" | "bottom" | "left";
type Align = "center" | "start" | "end";
type Axis = "x" | "y";
type Shortcut = string | string[];

const OPPOSITE: Record<Side, Side> = {
	top: "bottom",
	bottom: "top",
	left: "right",
	right: "left",
};

export interface FluidTooltipGroupProps {
	/** Where the bubble sits relative to the trigger. Flips if there is no room. */
	side?: Side;
	/** Alignment along the trigger's edge. `start` and `end` follow text direction. */
	align?: Align;
	/** Gap between the trigger and the bubble, in px. */
	sideOffset?: number;
	/** Ms a pointer rests on a trigger before the bubble opens. */
	delay?: number;
	/** Ms after the bubble closes during which it reopens without the delay. */
	skipDelay?: number;
	/** Lean the resting bubble a couple of px toward the pointer. Off by default, so it stays still. */
	follow?: boolean;
	/** Play a soft tick each time the bubble lands on a new trigger. */
	sound?: boolean;
	/** Classes for the bubble. */
	className?: string;
	children?: ReactNode;
}

export interface FluidTooltipProps {
	/** The label. Keep it short and plain; interactive content needs a popover. */
	content: ReactNode;
	/** Keyboard shortcut shown dimmer after the label, such as `"⌘K"` or `["⌘", "K"]`. */
	shortcut?: Shortcut;
	/** Overrides the group's `side` for this trigger. */
	side?: Side;
	/** Never show the tooltip. A disabled child is treated the same way. */
	disabled?: boolean;
	/** Exactly one focusable element, usually a button. */
	children: ReactElement;
}

interface TriggerEntry {
	element: HTMLElement | null;
	content: ReactNode;
	shortcut?: Shortcut;
	side?: Side;
	disabled: boolean;
}

interface View {
	key: string;
	content: ReactNode;
	shortcut?: Shortcut;
	/** Bumps on every new target, so the label swaps. */
	seq: number;
	/** The direction of travel from the last target, for the swap. */
	axis: Axis;
	dir: number;
	appear: boolean;
}

interface Target {
	x: number;
	y: number;
	w: number;
	h: number;
	side: Side;
	/** Where the trigger's center falls on the bubble, for the open scale. */
	origin: string;
}

interface GroupApi {
	register: (key: string, entry: TriggerEntry) => void;
	unregister: (key: string) => void;
	pointerEnter: (key: string, event: PointerEvent<HTMLElement>) => void;
	pointerLeave: (key: string, event: PointerEvent<HTMLElement>) => void;
	pointerMove: (key: string, event: PointerEvent<HTMLElement>) => void;
	pointerDown: (key: string, event: PointerEvent<HTMLElement>) => void;
	pointerUp: (key: string, event: PointerEvent<HTMLElement>) => void;
	focus: (key: string, element: HTMLElement) => void;
	blur: (key: string) => void;
	clickCapture: (key: string, event: MouseEvent<HTMLElement>) => void;
	contextMenu: (key: string, event: MouseEvent<HTMLElement>) => void;
}

interface GroupContextValue {
	api: GroupApi;
	tooltipId: string;
	/** The trigger the bubble describes right now, if it's open. */
	shownKey: string | null;
}

const GroupContext = createContext<GroupContextValue | null>(null);

type ZoomedElement = HTMLElement & { currentCSSZoom?: number };

function clamp(value: number, min = 0, max = 1) {
	return Math.min(Math.max(value, min), max);
}

function keysOf(shortcut: Shortcut | undefined) {
	if (shortcut === undefined) return [];
	return Array.isArray(shortcut) ? shortcut : [shortcut];
}

function sameShortcut(a: Shortcut | undefined, b: Shortcut | undefined) {
	return keysOf(a).join("\u0000") === keysOf(b).join("\u0000");
}

function center(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Places a `width` x `height` bubble beside `rect`, flipping to the opposite
 * side when it would overflow the viewport, then shifting along the edge to
 * stay inside it.
 */
function placeBubble(
	rect: { left: number; right: number; top: number; bottom: number },
	width: number,
	height: number,
	preferred: Side,
	align: Align,
	offset: number,
	viewport: { width: number; height: number },
	rtl: boolean,
): Omit<Target, "origin"> {
	const room: Record<Side, number> = {
		top: rect.top - offset - VIEWPORT_PADDING,
		bottom: viewport.height - rect.bottom - offset - VIEWPORT_PADDING,
		left: rect.left - offset - VIEWPORT_PADDING,
		right: viewport.width - rect.right - offset - VIEWPORT_PADDING,
	};
	const need = (side: Side) =>
		side === "top" || side === "bottom" ? height : width;
	let side = preferred;
	const opposite = OPPOSITE[preferred];
	if (room[side] < need(side) && room[opposite] >= need(opposite)) {
		side = opposite;
	}

	let x: number;
	let y: number;
	if (side === "top" || side === "bottom") {
		const logical =
			rtl && align !== "center" ? (align === "start" ? "end" : "start") : align;
		x =
			logical === "start"
				? rect.left
				: logical === "end"
					? rect.right - width
					: (rect.left + rect.right) / 2 - width / 2;
		x = clamp(
			x,
			VIEWPORT_PADDING,
			Math.max(VIEWPORT_PADDING, viewport.width - VIEWPORT_PADDING - width),
		);
		y = side === "top" ? rect.top - offset - height : rect.bottom + offset;
	} else {
		y =
			align === "start"
				? rect.top
				: align === "end"
					? rect.bottom - height
					: (rect.top + rect.bottom) / 2 - height / 2;
		y = clamp(
			y,
			VIEWPORT_PADDING,
			Math.max(VIEWPORT_PADDING, viewport.height - VIEWPORT_PADDING - height),
		);
		x = side === "left" ? rect.left - offset - width : rect.right + offset;
	}
	return { x, y, w: width, h: height, side };
}

/** Keeps a stretched span within `MAX_STRETCH`, pulling its trailing end along. */
function limitSpan(start: number, end: number, rest: number, dir: number) {
	const max = rest * MAX_STRETCH;
	if (end - start <= max) return [start, Math.max(end, start + 1)] as const;
	if (dir > 0) return [end - max, end] as const;
	if (dir < 0) return [start, start + max] as const;
	const middle = (start + end) / 2;
	return [middle - max / 2, middle + max / 2] as const;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
	return (node: T | null) => {
		const cleanups: Array<() => void> = [];
		for (const ref of refs) {
			if (typeof ref === "function") {
				const cleanup = ref(node);
				if (typeof cleanup === "function") cleanups.push(cleanup);
			} else if (ref) {
				(ref as RefObject<T | null>).current = node;
			}
		}
		if (cleanups.length === 0) return;
		return () => {
			for (const cleanup of cleanups) cleanup();
		};
	};
}

/** Shared by the visible label and its unseen measure, so both lay out alike. */
const LABEL = "flex items-center gap-2 whitespace-nowrap";

function Label({
	content,
	shortcut,
}: {
	content: ReactNode;
	shortcut?: Shortcut;
}) {
	const keys = keysOf(shortcut);
	return (
		<>
			<span>{content}</span>
			{keys.length > 0 ? (
				<span
					data-slot="fluid-tooltip-shortcut"
					className="flex gap-px text-neutral-400 tabular-nums"
				>
					{keys.map((key, index) => (
						<span key={index}>{key}</span>
					))}
				</span>
			) : null}
		</>
	);
}

interface Swap {
	axis: Axis;
	dir: number;
	appear: boolean;
	reduced: boolean;
}

function nudge(axis: Axis, distance: number) {
	return axis === "x" ? { x: distance, y: 0 } : { x: 0, y: distance };
}

// A quick crossfade: the old label fades out fast while drifting a couple of
// px in the direction of travel, and the new one follows it in. Reduced motion
// keeps the fade and drops the drift.
const labelVariants: Variants = {
	enter: ({ axis, dir, reduced }: Swap) =>
		reduced
			? { opacity: 0 }
			: { opacity: 0, ...nudge(axis, -dir * SWAP_NUDGE) },
	center: {
		opacity: 1,
		x: 0,
		y: 0,
		transition: { duration: SWAP_IN, delay: SWAP_IN_DELAY, ease: EASE_OUT },
	},
	exit: ({ axis, dir, appear, reduced }: Swap) =>
		appear
			? { opacity: 0, transition: { duration: 0 } }
			: {
					opacity: 0,
					...(reduced ? {} : nudge(axis, dir * SWAP_NUDGE)),
					transition: { duration: SWAP_OUT, ease: EASE_OUT },
				},
};

function keepOnFrameLoop() {}

interface Edges {
	left: MotionValue<number>;
	right: MotionValue<number>;
	top: MotionValue<number>;
	bottom: MotionValue<number>;
	/** Resting length on each axis, for the stretch limit. */
	restW: MotionValue<number>;
	restH: MotionValue<number>;
	axis: MotionValue<Axis>;
	dir: MotionValue<number>;
	leanX: MotionValue<number>;
	leanY: MotionValue<number>;
	/** Device px per bubble px, so the resting bubble lands on whole pixels. */
	pixel: MotionValue<number>;
	opacity: MotionValue<number>;
	scale: MotionValue<number>;
	origin: MotionValue<string>;
}

function FluidTooltipBubble({
	view,
	open,
	reduced,
	edges,
	tooltipId,
	className,
	bubbleRef,
	measureRef,
	onPointerEnter,
	onPointerLeave,
}: {
	view: View;
	open: boolean;
	reduced: boolean;
	edges: Edges;
	tooltipId: string;
	className?: string;
	bubbleRef: (node: HTMLDivElement | null) => void;
	measureRef: (node: HTMLSpanElement | null) => void;
	onPointerEnter: () => void;
	onPointerLeave: () => void;
}) {
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const width = useMotionValue(0);
	const height = useMotionValue(0);

	// Draws the box between the four edges. Subscribed in a layout effect, so
	// it sees the edges the group sets in its own layout effect on open.
	useLayoutEffect(() => {
		const draw = () => {
			let left = edges.left.get() + edges.leanX.get();
			let right = edges.right.get() + edges.leanX.get();
			let top = edges.top.get() + edges.leanY.get();
			let bottom = edges.bottom.get() + edges.leanY.get();
			const axis = edges.axis.get();
			const dir = edges.dir.get();
			const restW = edges.restW.get() || 1;
			const restH = edges.restH.get() || 1;
			if (axis === "x") [left, right] = limitSpan(left, right, restW, dir);
			else [top, bottom] = limitSpan(top, bottom, restH, dir);
			const pixel = edges.pixel.get() || 1;
			const snap = (value: number) => Math.round(value * pixel) / pixel;
			x.set(snap(left));
			y.set(snap(top));
			width.set(snap(right) - snap(left));
			height.set(snap(bottom) - snap(top));
		};
		draw();
		const inputs = [
			edges.left,
			edges.right,
			edges.top,
			edges.bottom,
			edges.leanX,
			edges.leanY,
			edges.axis,
			edges.dir,
			edges.restW,
			edges.restH,
			edges.pixel,
		] as MotionValue<unknown>[];
		const stops = inputs.map((value) => value.on("change", draw));
		return () => {
			for (const stop of stops) stop();
		};
	}, [edges, x, y, width, height]);

	const swap: Swap = {
		axis: view.axis,
		dir: view.dir,
		appear: view.appear,
		reduced,
	};
	const keys = keysOf(view.shortcut);

	return (
		<m.div
			ref={bubbleRef}
			id={tooltipId}
			role="tooltip"
			data-slot="fluid-tooltip"
			data-state={open ? "open" : "closed"}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			style={{
				x,
				y,
				width,
				height,
				opacity: edges.opacity,
				scale: edges.scale,
				transformOrigin: edges.origin,
			}}
			className={cn(
				// Only transform and opacity animate on the compositor; width is written
				// on a fixed, layout-contained box, so nothing else on the page reflows.
				"group/fluid-tooltip pointer-events-none fixed top-0 left-0 z-50 select-none rounded-md bg-neutral-900 font-medium text-neutral-50 text-xs leading-4 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_4px_12px_rgb(0_0_0/0.08)] [contain:layout] data-[state=open]:pointer-events-auto dark:bg-neutral-800 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.3),0_4px_12px_rgb(0_0_0/0.25)]",
				className,
			)}
		>
			{/* Keeps the bubble open while the pointer crosses the gap from its trigger. */}
			<span
				aria-hidden="true"
				data-slot="fluid-tooltip-bridge"
				className="absolute group-data-[side=bottom]/fluid-tooltip:inset-x-0 group-data-[side=top]/fluid-tooltip:inset-x-0 group-data-[side=left]/fluid-tooltip:inset-y-0 group-data-[side=right]/fluid-tooltip:inset-y-0 group-data-[side=top]/fluid-tooltip:top-full group-data-[side=right]/fluid-tooltip:right-full group-data-[side=bottom]/fluid-tooltip:bottom-full group-data-[side=left]/fluid-tooltip:left-full group-data-[side=bottom]/fluid-tooltip:h-(--fluid-tooltip-offset) group-data-[side=top]/fluid-tooltip:h-(--fluid-tooltip-offset) group-data-[side=left]/fluid-tooltip:w-(--fluid-tooltip-offset) group-data-[side=right]/fluid-tooltip:w-(--fluid-tooltip-offset)"
			/>
			<span className="sr-only">
				{view.content}
				{keys.length > 0 ? ` ${keys.join(" ")}` : null}
			</span>
			<span
				aria-hidden="true"
				className="absolute inset-0 overflow-hidden rounded-[inherit]"
			>
				<AnimatePresence initial={false} custom={swap}>
					<m.span
						key={view.seq}
						custom={swap}
						variants={labelVariants}
						initial={view.appear ? false : "enter"}
						animate="center"
						exit="exit"
						// Keeps the swap on motion's frame loop, in step with the edge
						// springs, instead of handing it to WAAPI.
						onUpdate={keepOnFrameLoop}
						className={cn("absolute inset-0 justify-center", LABEL)}
					>
						<Label content={view.content} shortcut={view.shortcut} />
					</m.span>
				</AnimatePresence>
			</span>
			{/* The new label, laid out unseen so the bubble can size itself before it fades in. */}
			<span
				ref={measureRef}
				aria-hidden="true"
				className={cn("invisible absolute top-0 left-0", LABEL)}
			>
				<Label content={view.content} shortcut={view.shortcut} />
			</span>
		</m.div>
	);
}

/**
 * Shares one tooltip between every `FluidTooltip` inside it, such as the
 * buttons of a toolbar, rail, or dock. Renders no element of its own.
 */
export function FluidTooltipGroup({
	side = "top",
	align = "center",
	sideOffset = 8,
	delay = 500,
	skipDelay = 400,
	follow = false,
	sound = false,
	className,
	children,
}: FluidTooltipGroupProps) {
	const tooltipId = `fluid-tooltip-${useId().replace(/[^\w-]/g, "")}`;
	const reducedMotion = useReducedMotion() ?? false;
	const [view, setView] = useState<View | null>(null);
	const [open, setOpen] = useState(false);
	const [present, setPresent] = useState(false);

	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { hover: playTick } = useTiks({
		theme: TICK_SOUND,
		respectReducedMotion: false,
	});

	const edges: Edges = {
		left: useMotionValue(0),
		right: useMotionValue(0),
		top: useMotionValue(0),
		bottom: useMotionValue(0),
		restW: useMotionValue(1),
		restH: useMotionValue(1),
		axis: useMotionValue<Axis>("x"),
		dir: useMotionValue(0),
		leanX: useMotionValue(0),
		leanY: useMotionValue(0),
		pixel: useMotionValue(1),
		opacity: useMotionValue(0),
		scale: useMotionValue(1),
		origin: useMotionValue("50% 100%"),
	};

	// Handlers read the latest props through a ref, so the API stays stable.
	const latest = useRef({
		side,
		align,
		sideOffset,
		delay,
		skipDelay,
		follow,
		sound,
		reducedMotion,
		haptic,
		playTick,
	});
	useLayoutEffect(() => {
		latest.current = {
			side,
			align,
			sideOffset,
			delay,
			skipDelay,
			follow,
			sound,
			reducedMotion,
			haptic,
			playTick,
		};
	});

	// The imperative core: timers, the active trigger, and the edge springs.
	const [core] = useState(() => {
		const triggers = new Map<string, TriggerEntry>();
		let bubble: HTMLDivElement | null = null;
		let measure: HTMLSpanElement | null = null;
		let target: Target | null = null;
		let activeKey: string | null = null;
		let isOpen = false;
		let closedAt = Number.NEGATIVE_INFINITY;
		let hovered: string | null = null;
		let focused: string | null = null;
		let bubbleHovered = false;
		/** Esc hides the bubble until the pointer or focus leaves that trigger. */
		let dismissed: string | null = null;
		let touchKey: string | null = null;
		let touchStart: { key: string; x: number; y: number } | null = null;
		let suppressClick: string | null = null;
		let pending: "appear" | "move" | "stay" | null = null;
		let travel: { axis: Axis; dir: number } = { axis: "x", dir: 0 };
		let seq = 0;
		let lastTick = Number.NEGATIVE_INFINITY;
		let delayTimer: ReturnType<typeof setTimeout> | undefined;
		let closeTimer: ReturnType<typeof setTimeout> | undefined;
		let longPressTimer: ReturnType<typeof setTimeout> | undefined;
		let touchHideTimer: ReturnType<typeof setTimeout> | undefined;

		const silent = () => document.visibilityState === "hidden";

		const clearTimers = () => {
			clearTimeout(delayTimer);
			clearTimeout(closeTimer);
			clearTimeout(touchHideTimer);
		};

		const measureTarget = (): Target | null => {
			const entry = activeKey ? triggers.get(activeKey) : undefined;
			const element = entry?.element;
			if (!entry || !element?.isConnected || !bubble) return null;
			const props = latest.current;
			// Inside CSS `zoom`, the bubble takes the trigger's zoom and works in
			// its px, so it matches the trigger's scale.
			const zoom = (element as ZoomedElement).currentCSSZoom ?? 1;
			bubble.style.zoom = zoom === 1 ? "" : String(zoom);
			bubble.style.setProperty(
				"--fluid-tooltip-offset",
				`${props.sideOffset}px`,
			);
			const pixel = window.devicePixelRatio * zoom;
			edges.pixel.set(pixel);
			const snap = (value: number) => Math.round(value * pixel) / pixel;
			const rect = element.getBoundingClientRect();
			const root = document.documentElement;
			const width = Math.max(
				HEIGHT,
				Math.ceil(measure?.offsetWidth ?? 0) + PAD_X * 2,
			);
			const placed = placeBubble(
				{
					left: rect.left / zoom,
					right: rect.right / zoom,
					top: rect.top / zoom,
					bottom: rect.bottom / zoom,
				},
				width,
				HEIGHT,
				entry.side ?? props.side,
				props.align,
				props.sideOffset,
				{ width: root.clientWidth / zoom, height: root.clientHeight / zoom },
				getComputedStyle(element).direction === "rtl",
			);
			const triggerX = (rect.left + rect.width / 2) / zoom;
			const triggerY = (rect.top + rect.height / 2) / zoom;
			const originX = clamp((triggerX - placed.x) / placed.w) * 100;
			const originY = clamp((triggerY - placed.y) / placed.h) * 100;
			const origin =
				placed.side === "top"
					? `${originX}% 100%`
					: placed.side === "bottom"
						? `${originX}% 0%`
						: placed.side === "left"
							? `100% ${originY}%`
							: `0% ${originY}%`;
			return {
				...placed,
				x: snap(placed.x),
				y: snap(placed.y),
				origin,
			};
		};

		const spring = (
			value: MotionValue<number>,
			to: number,
			config: { stiffness: number; damping: number },
		) => {
			if (value.get() === to && !value.isAnimating()) return;
			// Starts from the edge's current position and velocity.
			animate(value, to, {
				type: "spring",
				...config,
				restDelta: 0.05,
				restSpeed: 2,
			});
		};

		/** Moves the edges to `next`: at once, across the travel, or along it. */
		const retarget = (next: Target, how: "jump" | "move" | "cross") => {
			const previous = target;
			target = next;
			if (bubble) bubble.dataset.side = next.side;
			edges.origin.set(next.origin);
			const { left, right, top, bottom } = edges;
			if (how === "jump" || !previous || latest.current.reducedMotion) {
				edges.dir.set(0);
				edges.restW.set(next.w);
				edges.restH.set(next.h);
				left.jump(next.x);
				right.jump(next.x + next.w);
				top.jump(next.y);
				bottom.jump(next.y + next.h);
				return;
			}
			const { axis, dir } =
				how === "move" ? travel : { axis: travel.axis, dir: 0 };
			edges.axis.set(axis);
			edges.dir.set(dir);
			edges.restW.set(axis === "x" ? Math.max(previous.w, next.w) : next.w);
			edges.restH.set(axis === "y" ? Math.max(previous.h, next.h) : next.h);
			const role = (edgeAxis: Axis, facing: number) =>
				edgeAxis !== axis || dir === 0
					? crossSpring
					: facing === dir
						? leadSpring
						: trailSpring;
			spring(left, next.x, role("x", -1));
			spring(right, next.x + next.w, role("x", 1));
			spring(top, next.y, role("y", -1));
			spring(bottom, next.y + next.h, role("y", 1));
		};

		const moving = () =>
			edges.left.isAnimating() ||
			edges.right.isAnimating() ||
			edges.top.isAnimating() ||
			edges.bottom.isAnimating();

		/** Follows the trigger after a scroll, resize, or label change. */
		const sync = (how: "jump" | "cross") => {
			if (!isOpen) return;
			const next = measureTarget();
			if (!next) {
				hide();
				return;
			}
			if (
				target &&
				Math.abs(next.x - target.x) < 0.5 &&
				Math.abs(next.y - target.y) < 0.5 &&
				Math.abs(next.w - target.w) < 0.5 &&
				next.side === target.side
			) {
				return;
			}
			retarget(next, how === "cross" && moving() ? "cross" : "jump");
		};

		const fadeIn = (appear: boolean) => {
			const reduced = latest.current.reducedMotion;
			if (appear) {
				edges.opacity.jump(0);
				edges.scale.jump(reduced ? 1 : OPEN_SCALE);
			}
			const duration = reduced ? FADE_DURATION : OPEN_DURATION;
			animate(edges.opacity, 1, { duration, ease: EASE_OUT });
			if (!reduced) animate(edges.scale, 1, { duration, ease: EASE_OUT });
		};

		const show = (key: string, source: "pointer" | "focus" | "touch") => {
			clearTimers();
			const entry = triggers.get(key);
			if (!entry?.element?.isConnected || entry.disabled) return;
			if (dismissed === key) return;
			if (isOpen && activeKey === key) return;
			const previousKey = activeKey;
			const visible = isOpen || edges.opacity.get() > 0.02;
			const switching = visible && previousKey !== null && previousKey !== key;

			travel = { axis: travel.axis, dir: 0 };
			const previous = previousKey ? triggers.get(previousKey)?.element : null;
			if (switching && previous?.isConnected) {
				const from = center(previous);
				const to = center(entry.element);
				const dx = to.x - from.x;
				const dy = to.y - from.y;
				const axis: Axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
				const delta = axis === "x" ? dx : dy;
				travel = { axis, dir: Math.abs(delta) < 0.5 ? 0 : Math.sign(delta) };
			}

			const props = latest.current;
			if (props.sound && source === "pointer" && switching && !silent()) {
				const now = performance.now();
				if (now - lastTick >= TICK_THROTTLE) {
					lastTick = now;
					props.playTick();
				}
			}

			activeKey = key;
			isOpen = true;
			pending = switching ? "move" : visible ? "stay" : "appear";
			if (pending !== "stay") seq += 1;
			const nextSeq = seq;
			const { axis, dir } = travel;
			setView({
				key,
				content: entry.content,
				shortcut: entry.shortcut,
				seq: nextSeq,
				axis,
				dir,
				appear: pending === "appear",
			});
			setOpen(true);
			setPresent(true);
		};

		const hide = () => {
			clearTimers();
			clearTimeout(longPressTimer);
			touchKey = null;
			if (!isOpen) return;
			isOpen = false;
			closedAt = performance.now();
			setOpen(false);
			const fade = animate(edges.opacity, 0, {
				duration: latest.current.reducedMotion ? FADE_DURATION : CLOSE_DURATION,
				ease: "easeOut",
			});
			void fade.then(() => {
				if (isOpen) return;
				edges.leanX.jump(0);
				edges.leanY.jump(0);
				target = null;
				setPresent(false);
			});
		};

		/** After a short grace, follows whatever still holds the tooltip, or closes. */
		const scheduleClose = () => {
			clearTimeout(closeTimer);
			closeTimer = setTimeout(() => {
				if (bubbleHovered || touchKey) return;
				const next = hovered ?? focused;
				if (next && next !== dismissed) {
					show(next, hovered ? "pointer" : "focus");
					return;
				}
				hide();
			}, CLOSE_GRACE);
		};

		const api: GroupApi = {
			register(key, entry) {
				const previous = triggers.get(key);
				triggers.set(key, entry);
				if (key !== activeKey || !isOpen) return;
				if (entry.disabled) {
					hide();
					return;
				}
				if (
					previous &&
					(previous.content !== entry.content ||
						!sameShortcut(previous.shortcut, entry.shortcut))
				) {
					// The label changed in place: replace it without a swap.
					setView((current) =>
						current && current.key === key
							? { ...current, content: entry.content, shortcut: entry.shortcut }
							: current,
					);
				}
			},
			unregister(key) {
				triggers.delete(key);
				if (hovered === key) hovered = null;
				if (focused === key) focused = null;
				if (key === activeKey && isOpen) hide();
			},
			pointerEnter(key, event) {
				if (event.pointerType === "touch") return;
				hovered = key;
				clearTimeout(closeTimer);
				if (dismissed === key) return;
				const props = latest.current;
				if (
					isOpen ||
					props.delay <= 0 ||
					performance.now() - closedAt < props.skipDelay
				) {
					show(key, "pointer");
					return;
				}
				clearTimeout(delayTimer);
				delayTimer = setTimeout(() => {
					if (hovered === key) show(key, "pointer");
				}, props.delay);
			},
			pointerLeave(key, event) {
				if (event.pointerType === "touch") return;
				if (hovered === key) hovered = null;
				if (dismissed === key) dismissed = null;
				clearTimeout(delayTimer);
				if (isOpen) scheduleClose();
			},
			pointerMove(key, event) {
				if (event.pointerType === "touch") {
					if (
						touchStart?.key === key &&
						Math.hypot(
							event.clientX - touchStart.x,
							event.clientY - touchStart.y,
						) > TOUCH_SLOP
					) {
						clearTimeout(longPressTimer);
						touchStart = null;
					}
					return;
				}
				const props = latest.current;
				if (!props.follow || props.reducedMotion) return;
				if (!isOpen || key !== activeKey || !target) return;
				const element = triggers.get(key)?.element;
				if (!element) return;
				const rect = element.getBoundingClientRect();
				const zoom = (element as ZoomedElement).currentCSSZoom ?? 1;
				const across = target.side === "top" || target.side === "bottom";
				const amount = across
					? (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
					: (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
				const lean = (clamp(amount, -1, 1) * LEAN) / zoom;
				animate(across ? edges.leanX : edges.leanY, lean, {
					type: "spring",
					...leanSpring,
				});
				animate(across ? edges.leanY : edges.leanX, 0, {
					type: "spring",
					...leanSpring,
				});
			},
			pointerDown(key, event) {
				if (event.pointerType !== "touch") return;
				clearTimeout(longPressTimer);
				touchStart = { key, x: event.clientX, y: event.clientY };
				longPressTimer = setTimeout(() => {
					touchStart = null;
					dismissed = null;
					touchKey = key;
					show(key, "touch");
					if (!silent()) void latest.current.haptic("light");
				}, LONG_PRESS);
			},
			pointerUp(key, event) {
				if (event.pointerType !== "touch") return;
				clearTimeout(longPressTimer);
				touchStart = null;
				if (touchKey !== key) return;
				// The release after a long press reads the label; it isn't a tap.
				suppressClick = key;
				setTimeout(() => {
					if (suppressClick === key) suppressClick = null;
				}, 400);
				clearTimeout(touchHideTimer);
				touchHideTimer = setTimeout(() => {
					touchKey = null;
					hide();
				}, TOUCH_HIDE);
			},
			focus(key, element) {
				// Keyboard focus only; a click or tap that focuses a button doesn't open it.
				if (!element.matches(":focus-visible")) return;
				focused = key;
				if (dismissed !== key) dismissed = null;
				show(key, "focus");
			},
			blur(key) {
				if (focused === key) focused = null;
				if (dismissed === key) dismissed = null;
				if (isOpen) scheduleClose();
			},
			clickCapture(key, event) {
				if (suppressClick !== key) return;
				suppressClick = null;
				event.preventDefault();
				event.stopPropagation();
			},
			contextMenu(key, event) {
				if (touchKey === key || touchStart?.key === key) event.preventDefault();
			},
		};

		return {
			api,
			bubbleRef(node: HTMLDivElement | null) {
				bubble = node;
			},
			measureRef(node: HTMLSpanElement | null) {
				measure = node;
			},
			bubbleEnter() {
				bubbleHovered = true;
				clearTimeout(closeTimer);
			},
			bubbleLeave() {
				bubbleHovered = false;
				if (isOpen) scheduleClose();
			},
			/** Runs after the new label is in the DOM, so it can be measured. */
			commit() {
				const mode = pending;
				pending = null;
				if (!isOpen) return;
				if (mode === "stay") {
					fadeIn(false);
					return;
				}
				const next = measureTarget();
				if (!next) {
					hide();
					return;
				}
				if (mode === "appear") {
					retarget(next, "jump");
					fadeIn(true);
				} else if (mode === "move") {
					retarget(next, "move");
					fadeIn(false);
				} else {
					retarget(next, moving() ? "cross" : "jump");
				}
			},
			/** Listeners that only exist while the bubble is open. */
			listen() {
				const onKeyDown = (event: KeyboardEvent) => {
					if (event.key !== "Escape" || !isOpen) return;
					dismissed = activeKey;
					hide();
				};
				const onScroll = () => sync("jump");
				document.addEventListener("keydown", onKeyDown);
				window.addEventListener("scroll", onScroll, {
					capture: true,
					passive: true,
				});
				window.addEventListener("resize", onScroll, { passive: true });
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					window.removeEventListener("scroll", onScroll, { capture: true });
					window.removeEventListener("resize", onScroll);
				};
			},
			/** Re-measures when the active trigger or the label changes size. */
			observe() {
				const element = activeKey ? triggers.get(activeKey)?.element : null;
				if (!element || !measure) return () => undefined;
				const observer = new ResizeObserver(() => sync("cross"));
				observer.observe(element);
				observer.observe(measure);
				return () => observer.disconnect();
			},
			dispose() {
				clearTimers();
				clearTimeout(longPressTimer);
			},
		};
	});

	useLayoutEffect(() => {
		if (view) core.commit();
	}, [core, view]);

	useEffect(() => (open ? core.listen() : undefined), [core, open]);

	const activeKey = view?.key;
	useEffect(
		() => (open && activeKey ? core.observe() : undefined),
		[core, open, activeKey],
	);

	useEffect(() => () => core.dispose(), [core]);

	const shownKey = open && view ? view.key : null;
	const context = useMemo<GroupContextValue>(
		() => ({ api: core.api, tooltipId, shownKey }),
		[core, tooltipId, shownKey],
	);

	return (
		<GroupContext.Provider value={context}>
			{children}
			{present && view
				? createPortal(
						// No layout projection: it would leave a window resize listener.
						<LazyMotion features={domAnimation}>
							<FluidTooltipBubble
								view={view}
								open={open}
								reduced={reducedMotion}
								edges={edges}
								tooltipId={tooltipId}
								className={className}
								bubbleRef={core.bubbleRef}
								measureRef={core.measureRef}
								onPointerEnter={core.bubbleEnter}
								onPointerLeave={core.bubbleLeave}
							/>
						</LazyMotion>,
						document.body,
					)
				: null}
		</GroupContext.Provider>
	);
}

type TriggerChildProps = {
	ref?: Ref<HTMLElement>;
	disabled?: boolean;
	"aria-describedby"?: string;
	onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
	onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
	onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
	onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
	onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
	onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
	onFocus?: (event: FocusEvent<HTMLElement>) => void;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
	onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
	onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
};

/** Runs the child's own handler first; ours is skipped if it prevented default. */
function compose<E extends { defaultPrevented: boolean }>(
	theirs: ((event: E) => void) | undefined,
	ours: (event: E) => void,
) {
	return (event: E) => {
		theirs?.(event);
		if (!event.defaultPrevented) ours(event);
	};
}

function FluidTooltipTrigger({
	content,
	shortcut,
	side,
	disabled = false,
	children,
	group,
}: FluidTooltipProps & { group: GroupContextValue }) {
	const key = useId();
	const elementRef = useRef<HTMLElement | null>(null);
	const child = Children.only(children);
	const childProps = (
		isValidElement(child) ? child.props : {}
	) as TriggerChildProps;
	const off = disabled || childProps.disabled === true;
	const { api, tooltipId, shownKey } = group;
	const ref = mergeRefs(childProps.ref, elementRef);

	useLayoutEffect(() => {
		api.register(key, {
			element: elementRef.current,
			content,
			shortcut,
			side,
			disabled: off,
		});
	});
	useEffect(() => () => api.unregister(key), [api, key]);

	const shown = shownKey === key;
	const describedBy = shown
		? [childProps["aria-describedby"], tooltipId].filter(Boolean).join(" ")
		: childProps["aria-describedby"];
	const guard =
		<E,>(handler: (key: string, event: E) => void) =>
		(event: E) => {
			if (!off) handler(key, event);
		};

	return cloneElement(child as ReactElement<Record<string, unknown>>, {
		ref,
		"data-slot": "fluid-tooltip-trigger",
		"aria-describedby": describedBy,
		onPointerEnter: compose(childProps.onPointerEnter, guard(api.pointerEnter)),
		onPointerLeave: compose(childProps.onPointerLeave, (event) =>
			api.pointerLeave(key, event),
		),
		onPointerMove: compose(childProps.onPointerMove, guard(api.pointerMove)),
		onPointerDown: compose(childProps.onPointerDown, guard(api.pointerDown)),
		onPointerUp: compose(childProps.onPointerUp, (event) =>
			api.pointerUp(key, event),
		),
		onPointerCancel: compose(childProps.onPointerCancel, (event) =>
			api.pointerUp(key, event),
		),
		onFocus: compose(childProps.onFocus, (event) => {
			if (!off) api.focus(key, event.currentTarget);
		}),
		onBlur: compose(childProps.onBlur, () => api.blur(key)),
		onClickCapture: compose(childProps.onClickCapture, (event) =>
			api.clickCapture(key, event),
		),
		onContextMenu: compose(childProps.onContextMenu, (event) =>
			api.contextMenu(key, event),
		),
	});
}

/**
 * Adds a tooltip to its one child. Inside a `FluidTooltipGroup` every trigger
 * shares one bubble that travels between them; on its own it works as a
 * normal tooltip with the same look.
 */
export function FluidTooltip(props: FluidTooltipProps) {
	const group = useContext(GroupContext);
	if (!group) {
		return (
			<FluidTooltipGroup side={props.side}>
				<FluidTooltip {...props} />
			</FluidTooltipGroup>
		);
	}
	return <FluidTooltipTrigger {...props} group={group} />;
}

export default FluidTooltip;
