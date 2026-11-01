"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	animate,
	motion,
	useIsPresent,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	Children,
	isValidElement,
	type KeyboardEvent,
	type PointerEvent,
	type ReactElement,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** The shell's liquid morph between views. */
const shellSpring = { type: "spring", bounce: 0.3, duration: 0.55 } as const;
const shellReduced = { duration: 0.15, ease: "easeOut" } as const;
const pressSpring = { type: "spring", stiffness: 600, damping: 30 } as const;
const releaseSpring = { type: "spring", bounce: 0.3, duration: 0.45 } as const;

/** Corner radius of an expanded card, in px. */
const CARD_RADIUS = 28;
/** Size of the empty idle pill, in px. */
const IDLE_WIDTH = 120;
const IDLE_HEIGHT = 36;
/** Minimum ms between view-change sounds and haptics. */
const CUE_THROTTLE_MS = 80;
/** Ms after a tap, key, or swipe in which a view change counts as the user's. */
const USER_INTENT_MS = 1000;
/** Ms of quiet before the live region announces a new view. */
const ANNOUNCE_DELAY = 150;
/** Pointer travel, in px, before a press on an expanded view becomes a swipe. */
const DRAG_SLOP = 4;
/** Upward travel, in px, that dismisses an expanded view on release. */
const DISMISS_DISTANCE = 24;
/** Upward speed, in px/ms, that dismisses an expanded view as a flick. */
const FLICK_VELOCITY = 0.5;
/** Px the shell can stretch before the rubber band hits its limit. */
const RUBBER_LIMIT = 16;
/** Px of drag the rubber band resists against. */
const RUBBER_DIMENSION = 60;

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const INTERACTIVE = `${FOCUSABLE}, label, [role="button"]`;

const viewSizes = {
	compact:
		"flex min-h-9 min-w-30 items-center justify-between gap-3 px-3 py-1.5 font-medium text-sm",
	expanded: "flex w-80 max-w-full flex-col gap-3 p-4 text-sm",
} as const;

type Tier = "idle" | "compact" | "expanded";

export interface DynamicIslandProps {
	/** Id of the `DynamicIslandView` to show. `null` shows the idle pill. */
	view: string | null;
	/** Content of the pill while `view` is `null`. Omit it for an empty pill. */
	compact?: ReactNode;
	/** `DynamicIslandView` elements. */
	children?: ReactNode;
	/** Called when a compact view is tapped, with its id, or the idle pill with `null`. Makes them buttons. */
	onExpand?: (id: string | null) => void;
	/** Called on Escape, a click outside, or a swipe up on an expanded view. */
	onDismiss?: () => void;
	/** `top` fixes the island to the top centre of the viewport. */
	position?: "inline" | "top";
	/** Play a sound per view change. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Mute sounds and haptics for view changes the user didn't cause. */
	quiet?: boolean;
	/** Let a swipe up dismiss an expanded view. */
	swipeToDismiss?: boolean;
	/** Accessible name of the idle pill when it is a button. */
	label?: string;
	/** Classes for the island shell. */
	className?: string;
	classNames?: { root?: string; content?: string };
}

export interface DynamicIslandViewProps {
	id: string;
	/** Text summary for screen readers, announced once each time the view opens. */
	label: string;
	/** `expanded` gives a card with 28px corners and a pop when it opens. */
	size?: "compact" | "expanded";
	/** Open this view without a sound or haptic. */
	silent?: boolean;
	className?: string;
	children?: ReactNode;
}

export function DynamicIslandView({
	id,
	size = "compact",
	className,
	children,
}: DynamicIslandViewProps) {
	return (
		<div
			data-slot="dynamic-island-view"
			data-view={id}
			data-size={size}
			className={cn(viewSizes[size], className)}
		>
			{children}
		</div>
	);
}

/** Soft resistance past a boundary. */
function rubberband(distance: number) {
	const constant = 0.55;
	return (
		(distance * RUBBER_DIMENSION * constant) /
		(RUBBER_DIMENSION + constant * Math.abs(distance))
	);
}

function findView(children: ReactNode, id: string | null) {
	if (id === null) return null;
	for (const child of Children.toArray(children)) {
		if (
			isValidElement<DynamicIslandViewProps>(child) &&
			child.props.id === id
		) {
			return child as ReactElement<DynamicIslandViewProps>;
		}
	}
	return null;
}

interface IslandContentProps {
	ref?: Ref<HTMLDivElement>;
	reduceMotion: boolean;
	ariaHidden: boolean;
	className?: string;
	onSize: (width: number, height: number) => void;
	onNode: (node: HTMLDivElement | null) => void;
	children: ReactNode;
}

/**
 * One view's content. It keeps its natural size so it never squashes while
 * the shell resizes around it, and reports that size while it is present.
 */
function IslandContent({
	ref,
	reduceMotion,
	ariaHidden,
	className,
	onSize,
	onNode,
	children,
}: IslandContentProps) {
	const isPresent = useIsPresent();
	const nodeRef = useRef<HTMLDivElement | null>(null);

	const setNode = (node: HTMLDivElement | null) => {
		nodeRef.current = node;
		if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	};

	useLayoutEffect(() => {
		const node = nodeRef.current;
		if (!node || !isPresent) return;
		onNode(node);
		// offsetWidth ignores the enter scale.
		const report = () => onSize(node.offsetWidth, node.offsetHeight);
		report();
		const observer = new ResizeObserver(report);
		observer.observe(node);
		return () => {
			observer.disconnect();
			onNode(null);
		};
	}, [isPresent, onNode, onSize]);

	// Same keys either way, so the server render matches under reduced motion.
	const hidden = reduceMotion
		? { opacity: 0, filter: "blur(0px)", scale: 1 }
		: { opacity: 0, filter: "blur(4px)", scale: 0.96 };
	const shown = { opacity: 1, filter: "blur(0px)", scale: 1 };

	return (
		<motion.div
			ref={setNode}
			data-slot="dynamic-island-content"
			aria-hidden={ariaHidden || undefined}
			inert={!isPresent}
			initial={hidden}
			animate={{
				...shown,
				// Enter once the shell has started to move.
				transition: {
					delay: reduceMotion ? 0 : 0.08,
					duration: reduceMotion ? 0.15 : 0.28,
					ease: [0.2, 0.8, 0.2, 1],
				},
			}}
			exit={{ ...hidden, transition: { duration: 0.12, ease: "easeOut" } }}
			className={cn("w-max max-w-[100cqw] shrink-0 origin-top", className)}
		>
			{children}
		</motion.div>
	);
}

export function DynamicIsland({
	view,
	compact,
	children,
	onExpand,
	onDismiss,
	position = "inline",
	sound = true,
	haptics = true,
	quiet = false,
	swipeToDismiss = true,
	label = "Status",
	className,
	classNames,
}: DynamicIslandProps) {
	const activeView = findView(children, view);
	const activeId = activeView ? activeView.props.id : null;
	const activeSize = activeView?.props.size ?? "compact";
	const tier: Tier = activeView
		? activeSize === "expanded"
			? "expanded"
			: "compact"
		: "idle";
	const pressable = tier !== "expanded" && onExpand !== undefined;
	const swipeable = tier === "expanded" && swipeToDismiss && !!onDismiss;

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		hover: playTick,
		pop: playPop,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const [size, setSize] = useState<{
		width: number;
		height: number;
		instant: boolean;
	} | null>(null);
	const [announcement, setAnnouncement] = useState("");

	const shellRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const scale = useMotionValue(1);
	const y = useMotionValue(0);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const userIntentAtRef = useRef(Number.NEGATIVE_INFINITY);
	const expandIntentAtRef = useRef(Number.NEGATIVE_INFINITY);
	const shownRef = useRef<{ id: string | null; tier: Tier } | null>(null);
	const pressedRef = useRef(false);
	const suppressClickRef = useRef(false);
	const dragRef = useRef<{
		pointerId: number;
		startY: number;
		lastY: number;
		lastT: number;
		velocity: number;
		dragging: boolean;
		hitLimit: boolean;
	} | null>(null);

	const handleSize = useCallback((width: number, height: number) => {
		setSize((previous) =>
			previous && previous.width === width && previous.height === height
				? previous
				: // The first size lands at once so the server render never animates.
					{ width, height, instant: previous === null },
		);
	}, []);

	const handleNode = useCallback((node: HTMLDivElement | null) => {
		contentRef.current = node;
	}, []);

	const markUser = (expanding = false) => {
		const now = performance.now();
		userIntentAtRef.current = now;
		if (expanding) expandIntentAtRef.current = now;
	};

	const expand = () => {
		if (!onExpand) return;
		markUser(true);
		onExpand(activeId);
	};

	const dismiss = () => {
		if (!onDismiss) return;
		markUser();
		onDismiss();
	};

	// Cues and focus follow the resolved view, so an unknown id acts as idle.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per view change.
	useLayoutEffect(() => {
		const previous = shownRef.current;
		shownRef.current = { id: activeId, tier };
		// The first render is silent.
		if (!previous || previous.id === activeId) return;

		const now = performance.now();
		const byUser = now - userIntentAtRef.current < USER_INTENT_MS;
		const expandIntent = now - expandIntentAtRef.current < USER_INTENT_MS;
		userIntentAtRef.current = Number.NEGATIVE_INFINITY;
		expandIntentAtRef.current = Number.NEGATIVE_INFINITY;

		const shell = shellRef.current;
		const focusInside = !!shell && shell.contains(document.activeElement);

		// Move focus in only when the user opened it; never steal it otherwise.
		if (tier === "expanded" && expandIntent && shell) {
			const target =
				contentRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? shell;
			target.focus({ preventScroll: true });
		} else if (previous.tier === "expanded" && focusInside && shell) {
			shell.focus({ preventScroll: true });
		}

		const unknown = view !== null && activeView === null;
		const muted =
			unknown ||
			activeView?.props.silent === true ||
			(quiet && !byUser) ||
			(!sound && !haptics) ||
			now - lastCueAtRef.current < CUE_THROTTLE_MS;
		if (muted) return;
		lastCueAtRef.current = now;

		if (tier === "expanded" && previous.tier !== "expanded") {
			if (sound) playPop();
			if (haptics) void haptic("soft");
		} else if (tier === "idle") {
			// A quieter tick for settling back to rest.
			if (sound) playTick();
			if (haptics) void haptic("light");
		} else {
			if (sound) playClick();
			if (haptics) {
				void haptic(previous.tier === "expanded" ? "light" : "selection");
			}
		}
	}, [activeId]);

	// Announce the label once per view change, after rapid changes settle.
	const announcedIdRef = useRef(activeId);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the label may tick; only the id matters.
	useEffect(() => {
		if (announcedIdRef.current === activeId) return;
		announcedIdRef.current = activeId;
		const next = activeView?.props.label ?? "";
		const timer = setTimeout(() => setAnnouncement(next), ANNOUNCE_DELAY);
		return () => clearTimeout(timer);
	}, [activeId]);

	// Escape and a click outside dismiss an expanded view.
	const dismissRef = useRef(dismiss);
	useLayoutEffect(() => {
		dismissRef.current = dismiss;
	});
	const canDismiss = tier === "expanded" && onDismiss !== undefined;
	useEffect(() => {
		if (!canDismiss) return;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			dismissRef.current();
		};
		const onPointerDown = (event: globalThis.PointerEvent) => {
			const shell = shellRef.current;
			if (!shell || shell.contains(event.target as Node)) return;
			dismissRef.current();
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [canDismiss]);

	const press = () => {
		if (shouldReduceMotion) return;
		pressedRef.current = true;
		animate(scale, 0.97, pressSpring);
	};

	const release = () => {
		if (!pressedRef.current) return;
		pressedRef.current = false;
		animate(scale, 1, releaseSpring);
	};

	const endDrag = (cancelled: boolean) => {
		const drag = dragRef.current;
		dragRef.current = null;
		release();
		if (!drag?.dragging) return;
		suppressClickRef.current = true;
		animate(y, 0, releaseSpring);
		if (cancelled) return;
		const distance = drag.startY - drag.lastY;
		if (distance > DISMISS_DISTANCE || -drag.velocity > FLICK_VELOCITY) {
			dismiss();
		}
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		suppressClickRef.current = false;
		if (pressable) {
			press();
			return;
		}
		if (tier !== "expanded") return;
		// Buttons inside the card keep their own press; the card squishes when grabbed.
		const onControl = (event.target as Element).closest(INTERACTIVE);
		if (!onControl || !event.currentTarget.contains(onControl)) press();
		if (!swipeable) return;
		dragRef.current = {
			pointerId: event.pointerId,
			startY: event.clientY,
			lastY: event.clientY,
			lastT: event.timeStamp,
			velocity: 0,
			dragging: false,
			hitLimit: false,
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dt = event.timeStamp - drag.lastT;
		if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
		drag.lastY = event.clientY;
		drag.lastT = event.timeStamp;
		const delta = event.clientY - drag.startY;
		if (!drag.dragging) {
			if (Math.abs(delta) < DRAG_SLOP) return;
			drag.dragging = true;
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		// Reduced motion keeps the swipe but not the stretch.
		if (shouldReduceMotion) return;
		const offset = rubberband(delta);
		y.set(offset);
		if (!drag.hitLimit && -offset >= RUBBER_LIMIT) {
			drag.hitLimit = true;
			if (haptics) void haptic("rigid");
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!pressable || event.target !== event.currentTarget) return;
		if (event.key === "Enter") {
			event.preventDefault();
			expand();
		} else if (event.key === " ") {
			// Space activates on release, like a native button.
			event.preventDefault();
		}
	};

	const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!pressable || event.target !== event.currentTarget) return;
		if (event.key === " ") expand();
	};

	useEffect(
		() => () => {
			scale.stop();
			y.stop();
		},
		[scale, y],
	);

	// A pill is fully round at any height; a card has fixed corners.
	const radius =
		tier === "expanded" ? CARD_RADIUS : (size?.height ?? IDLE_HEIGHT) / 2;
	const top = position === "top";

	let content: ReactNode;
	if (activeView) {
		content = activeView;
	} else if (compact !== undefined && compact !== null) {
		content = <div className={viewSizes.compact}>{compact}</div>;
	} else {
		content = (
			<div style={{ width: IDLE_WIDTH, height: IDLE_HEIGHT }} aria-hidden />
		);
	}

	return (
		<div
			data-slot="dynamic-island-root"
			data-position={position}
			className={cn(
				"@container flex justify-center",
				top
					? "pointer-events-none fixed top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-50 w-[min(360px,calc(100vw-1rem))] -translate-x-1/2"
					: "w-full",
				classNames?.root,
			)}
		>
			<motion.div
				ref={shellRef}
				data-slot="dynamic-island"
				data-tier={tier}
				data-view={activeId ?? undefined}
				role={pressable ? "button" : tier === "expanded" ? "region" : undefined}
				tabIndex={pressable ? 0 : -1}
				aria-label={
					pressable || tier === "expanded"
						? (activeView?.props.label ?? label)
						: undefined
				}
				initial={false}
				animate={{
					borderRadius: radius,
					...(size ? { width: size.width, height: size.height } : {}),
				}}
				transition={
					size?.instant
						? { duration: 0 }
						: shouldReduceMotion
							? shellReduced
							: shellSpring
				}
				style={{
					scale,
					y,
					borderRadius: radius,
					touchAction: swipeable ? "none" : undefined,
				}}
				onClick={() => {
					if (pressable) expand();
				}}
				// A swipe ends without clicking the button it started on.
				onClickCapture={(event) => {
					if (!suppressClickRef.current) return;
					suppressClickRef.current = false;
					event.preventDefault();
					event.stopPropagation();
				}}
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={() => endDrag(false)}
				onPointerCancel={() => endDrag(true)}
				onPointerLeave={() => {
					if (!dragRef.current?.dragging) release();
				}}
				className={cn(
					"pointer-events-auto relative flex max-w-full select-none items-start justify-center overflow-hidden bg-foreground text-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					pressable && "cursor-pointer",
					swipeable && "cursor-grab active:cursor-grabbing",
					className,
				)}
			>
				<AnimatePresence mode="popLayout" initial={false}>
					<IslandContent
						key={activeId ?? "\u0000idle"}
						reduceMotion={shouldReduceMotion}
						ariaHidden={pressable}
						className={classNames?.content}
						onSize={handleSize}
						onNode={handleNode}
					>
						{content}
					</IslandContent>
				</AnimatePresence>
			</motion.div>
			<span role="status" aria-live="polite" aria-atomic className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export interface DynamicIslandShowOptions {
	/** Ms to show the view before returning to the previous one. Omit to keep it. */
	duration?: number;
}

type QueuedView = { key: number; id: string; duration: number };

/**
 * Drives a `DynamicIsland`. `show(id)` sets the resting view; with a
 * `duration` it shows the view for that long and then returns, queueing
 * timed views first in, first out. `hide()` drops the timed view on screen,
 * or clears the resting view when none is queued.
 */
export function useDynamicIsland(initial: string | null = null) {
	const [state, setState] = useState<{
		base: string | null;
		queue: QueuedView[];
	}>({ base: initial, queue: [] });
	const keyRef = useRef(0);
	const head = state.queue[0];

	useEffect(() => {
		if (!head) return;
		const timer = setTimeout(() => {
			setState((current) =>
				current.queue[0]?.key === head.key
					? { ...current, queue: current.queue.slice(1) }
					: current,
			);
		}, head.duration);
		return () => clearTimeout(timer);
	}, [head]);

	const show = useCallback((id: string, options?: DynamicIslandShowOptions) => {
		const duration = options?.duration;
		if (duration === undefined) {
			setState((current) => ({ ...current, base: id }));
			return;
		}
		keyRef.current += 1;
		const entry = { key: keyRef.current, id, duration };
		setState((current) => ({ ...current, queue: [...current.queue, entry] }));
	}, []);

	const hide = useCallback(() => {
		setState((current) =>
			current.queue.length > 0
				? { ...current, queue: current.queue.slice(1) }
				: { ...current, base: null },
		);
	}, []);

	return { view: head ? head.id : state.base, show, hide };
}

export default DynamicIsland;
