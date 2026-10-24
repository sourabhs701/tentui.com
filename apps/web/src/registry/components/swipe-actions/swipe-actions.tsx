"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { Ellipsis } from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	LayoutGroup,
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	createContext,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const snapSpring = { type: "spring", stiffness: 500, damping: 40 } as const;
const armSpring = { type: "spring", stiffness: 700, damping: 35 } as const;
const collapseTransition = { duration: 0.22, ease: "easeOut" } as const;
const fadeTransition = { duration: 0.12, ease: "easeOut" } as const;
const popTransition = { duration: 0.28, ease: "easeOut" } as const;

/** Pointer travel, in px, before a gesture commits to an axis. */
const AXIS_LOCK = 8;
/** Share of the action group a release must pass to stay open. */
const REVEAL_RATIO = 0.4;
/** Release speed, in px/s, that fires the outermost action. */
const FLICK_VELOCITY = 800;
/** Fastest release, in px/s, so one jumpy pointer event can't fling the row. */
const MAX_VELOCITY = 4000;
/** Seconds of release velocity added when deciding to open or close. */
const PROJECT_SECONDS = 0.08;
/** Resistance past the furthest travel. */
const ELASTIC = 0.1;
/** Distance, in px, a drag must back off a line before it can cross again. */
const HYSTERESIS = 12;
/** Most of the row an action group may cover when revealed. */
const MAX_GROUP_RATIO = 0.75;
/** Minimum gap, in px, between the revealed actions and the arm line. */
const MIN_ARM_GAP = 32;
/** Ms after opening that pointer clicks on actions are ignored, so a double-click on ⋯ can't fire one. */
const OPEN_GUARD_MS = 350;

type Side = "leading" | "trailing";
type RowState =
	| "idle"
	| "dragging"
	| "revealed"
	| "armed"
	| "committing"
	| "collapsed"
	| "disabled";

export type SwipeActionTone = "default" | "blue" | "amber" | "destructive";

export interface SwipeAction {
	id: string;
	/** Visible label and accessible name. */
	label: string;
	icon?: ReactNode;
	tone?: SwipeActionTone;
	/** Collapse the row before calling `onAction`. */
	destructive?: boolean;
	/** Ask "Confirm?" in place before firing. */
	confirm?: boolean;
	/** Live region message once the action fires. Defaults to `label: row label`. */
	announce?: string;
	/** Rejecting springs the row back and plays an error. */
	onAction: () => void | Promise<void>;
}

export interface SwipeActionsProps {
	children: ReactNode;
	/** Revealed by swiping toward the end edge, listed from the start edge in. */
	leading?: SwipeAction[];
	/** Revealed by swiping toward the start edge, listed from the content out. */
	trailing?: SwipeAction[];
	/** Fire the outermost action on a long swipe or a fast flick. */
	fullSwipe?: boolean;
	/** Share of the row width that arms a full swipe. */
	fullSwipeThreshold?: number;
	/** Width of each action, in px. Shrinks to fit narrow rows. */
	actionWidth?: number;
	/** Show a ⋯ button on hover that reveals the actions. */
	showHandle?: boolean;
	/** Show labels under icons. Inherits from `SwipeList`. */
	showLabels?: boolean;
	/** Play a toggle when arming and a swoosh or pop when an action fires. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	/** Accessible name for the row, used in announcements. */
	label: string;
	className?: string;
}

export interface SwipeListProps {
	children: ReactNode;
	/** `inset` rounded cards with a gap, or `plain` edge-to-edge rows. */
	variant?: "inset" | "plain";
	/** Show labels under icons for every row. */
	showLabels?: boolean;
	/** Accessible name for the list. */
	label?: string;
	className?: string;
}

const tones: Record<SwipeActionTone, string> = {
	default: "bg-zinc-500 text-white dark:bg-zinc-600",
	blue: "bg-blue-500 text-white",
	amber: "bg-amber-500 text-white",
	destructive: "bg-red-500 text-white",
};

type SwipeListContextValue = {
	variant: "inset" | "plain";
	showLabels: boolean;
	register: (id: string, close: () => void) => () => void;
	notifyOpen: (id: string) => void;
	announce: (message: string) => void;
};

const SwipeListContext = createContext<SwipeListContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Polite status region; a counter forces repeat messages to be read again. */
function useAnnouncer() {
	const [message, setMessage] = useState({ text: "", count: 0 });
	const region = (
		<span role="status" aria-live="polite" className="sr-only">
			{message.text}
			{message.count % 2 ? "​" : ""}
		</span>
	);
	const announce = useCallback(
		(text: string) =>
			setMessage((previous) => ({ text, count: previous.count + 1 })),
		[],
	);
	return { region, announce };
}

export function SwipeList({
	children,
	variant = "plain",
	showLabels = true,
	label,
	className,
}: SwipeListProps) {
	const rowsRef = useRef(new Map<string, () => void>());
	const { region, announce } = useAnnouncer();

	const value = useMemo<SwipeListContextValue>(
		() => ({
			variant,
			showLabels,
			register: (id, close) => {
				rowsRef.current.set(id, close);
				return () => {
					rowsRef.current.delete(id);
				};
			},
			notifyOpen: (id) => {
				for (const [other, close] of rowsRef.current) {
					if (other !== id) close();
				}
			},
			announce,
		}),
		[variant, showLabels, announce],
	);

	return (
		<SwipeListContext.Provider value={value}>
			<LayoutGroup>
				<div
					role="list"
					aria-label={label}
					data-slot="swipe-list"
					data-variant={variant}
					className={cn("flex flex-col", className)}
				>
					{children}
				</div>
			</LayoutGroup>
			{region}
		</SwipeListContext.Provider>
	);
}

function ActionButton({
	action,
	side,
	count,
	sign,
	x,
	stretch,
	popScale,
	stretchTarget,
	width: actionWidth,
	showLabel,
	reduceMotion,
	confirming,
	onPress,
}: {
	action: SwipeAction;
	side: Side;
	count: number;
	sign: number;
	x: MotionValue<number>;
	stretch: MotionValue<number>;
	popScale: MotionValue<number>;
	stretchTarget: boolean;
	width: number;
	showLabel: boolean;
	reduceMotion: boolean;
	confirming: boolean;
	onPress: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
	// Buttons split the revealed width; the stretch target eats the others' share.
	const width = useTransform([x, stretch], ([value, grow]: number[]) => {
		const revealed = Math.max(0, value * sign);
		if (count === 1) return revealed;
		const share = (revealed / count) * (1 - grow);
		return stretchTarget ? revealed - share * (count - 1) : share;
	});
	const progress = useTransform(width, (value) =>
		clamp(value / actionWidth, 0, 1),
	);
	const iconScale = useTransform(progress, (value) =>
		reduceMotion ? 1 : 0.6 + 0.4 * value,
	);
	const opacity = useTransform(progress, (value) => (reduceMotion ? 1 : value));

	return (
		<motion.button
			type="button"
			data-slot="swipe-actions-action"
			data-tone={action.tone ?? "default"}
			data-confirming={confirming || undefined}
			aria-label={confirming ? `Confirm ${action.label}` : undefined}
			onClick={onPress}
			style={{ width }}
			className={cn(
				"relative flex h-full min-w-0 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset",
				side === "leading" ? "justify-end" : "justify-start",
				tones[action.tone ?? "default"],
			)}
		>
			<motion.span
				style={{ width: actionWidth, opacity }}
				className="flex h-full shrink-0 flex-col items-center justify-center gap-1 px-1"
			>
				{action.icon ? (
					<motion.span
						aria-hidden
						style={{ scale: iconScale }}
						className="flex [&_svg:not([class*='size-'])]:size-5"
					>
						<motion.span
							style={{ scale: stretchTarget ? popScale : 1 }}
							className="flex"
						>
							{action.icon}
						</motion.span>
					</motion.span>
				) : null}
				<span
					className={cn(
						"max-w-full truncate font-medium text-xs leading-none",
						!showLabel && !confirming && action.icon && "sr-only",
					)}
				>
					{confirming ? "Confirm?" : action.label}
				</span>
			</motion.span>
		</motion.button>
	);
}

export function SwipeActions({
	children,
	leading = [],
	trailing = [],
	fullSwipe = true,
	fullSwipeThreshold = 0.6,
	actionWidth = 76,
	showHandle = true,
	showLabels: showLabelsProp,
	sound = true,
	haptics = true,
	disabled = false,
	label,
	className,
}: SwipeActionsProps) {
	const list = useContext(SwipeListContext);
	const variant = list?.variant ?? "plain";
	const showLabels = showLabelsProp ?? list?.showLabels ?? true;
	const id = useId();
	const reduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		toggle: playToggle,
		swoosh: playSwoosh,
		pop: playPop,
		error: playError,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});
	const { region, announce: announceLocally } = useAnnouncer();
	const announce = list?.announce ?? announceLocally;

	const collapserRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const x = useMotionValue(0);
	const stretch = useMotionValue(0);
	const popScale = useMotionValue(1);
	const surfaceOpacity = useMotionValue(1);

	const [openSide, setOpenSide] = useState<Side | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [rowWidth, setRowWidth] = useState(0);
	const [dir, setDir] = useState(1);

	const openRef = useRef<Side | null>(null);
	const busyRef = useRef(false);
	const suppressClickRef = useRef(false);
	const openedAtRef = useRef(0);
	const xAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const savedBoxRef = useRef<{
		height: number;
		paddingTop: string;
		paddingBottom: string;
	} | null>(null);
	const cuesRef = useRef({
		side: null as Side | null,
		pastReveal: false,
		armed: false,
	});
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		origin: number;
		locked: boolean;
		scale: number;
	} | null>(null);

	const actionsOf = (side: Side) => (side === "leading" ? leading : trailing);
	/** +1 when the side opens by moving content right. Flips in RTL. */
	const signOf = (side: Side) => (side === "leading" ? dir : -dir);
	const sideOf = (value: number): Side | null =>
		value === 0 ? null : value * dir > 0 ? "leading" : "trailing";
	const outermostOf = (side: Side) => {
		const actions = actionsOf(side);
		return side === "leading" ? actions[0] : actions[actions.length - 1];
	};
	const widthOf = (side: Side) => {
		const count = actionsOf(side).length;
		if (!count || !rowWidth) return actionWidth;
		return Math.min(actionWidth, (rowWidth * MAX_GROUP_RATIO) / count);
	};
	const revealOf = (side: Side) => widthOf(side) * actionsOf(side).length;
	const armAtOf = (side: Side) =>
		Math.max(fullSwipeThreshold * rowWidth, revealOf(side) + MIN_ARM_GAP);

	const setRowState = (state: RowState) => {
		if (rootRef.current) rootRef.current.dataset.state = state;
	};

	const moveTo = (target: number, velocity = 0) => {
		xAnimationRef.current?.stop();
		xAnimationRef.current = null;
		if (reduceMotion) {
			if (x.get() === target) return;
			// No travel: the row reappears in place with a short fade.
			x.jump(target);
			surfaceOpacity.jump(0);
			animate(surfaceOpacity, 1, fadeTransition);
			return;
		}
		xAnimationRef.current = animate(x, target, {
			...snapSpring,
			velocity,
			restDelta: 0.5,
		});
	};

	const setStretch = (on: boolean) => {
		if (reduceMotion) stretch.jump(on ? 1 : 0);
		else animate(stretch, on ? 1 : 0, armSpring);
	};

	const pop = () => {
		if (!reduceMotion) animate(popScale, [1, 1.15, 1], popTransition);
	};

	const open = (side: Side, velocity = 0) => {
		openedAtRef.current = performance.now();
		openRef.current = side;
		setOpenSide(side);
		list?.notifyOpen(id);
		setRowState("revealed");
		moveTo(signOf(side) * revealOf(side), velocity);
	};

	const close = (velocity = 0) => {
		openRef.current = null;
		setOpenSide(null);
		setConfirming(null);
		cuesRef.current.armed = false;
		setStretch(false);
		if (!busyRef.current) setRowState("idle");
		moveTo(0, velocity);
	};

	/** Keeps focus out of a tray that is about to go inert. */
	const reclaimFocus = () => {
		const root = rootRef.current;
		if (
			root?.contains(document.activeElement) &&
			document.activeElement !== root
		)
			root.focus({ preventScroll: true });
	};

	const collapse = async () => {
		const element = collapserRef.current;
		if (!element) return;
		const style = getComputedStyle(element);
		savedBoxRef.current = {
			height: element.offsetHeight,
			paddingTop: style.paddingTop,
			paddingBottom: style.paddingBottom,
		};
		if (reduceMotion) {
			await animate(element, { opacity: 0 }, fadeTransition);
			Object.assign(element.style, {
				height: "0px",
				paddingTop: "0px",
				paddingBottom: "0px",
			});
			return;
		}
		await animate(
			element,
			{
				height: [savedBoxRef.current.height, 0],
				paddingTop: [savedBoxRef.current.paddingTop, "0px"],
				paddingBottom: [savedBoxRef.current.paddingBottom, "0px"],
				opacity: [1, 0],
			},
			collapseTransition,
		);
	};

	const expand = async () => {
		const element = collapserRef.current;
		const saved = savedBoxRef.current;
		if (!element || !saved) return;
		await animate(
			element,
			{
				height: saved.height,
				paddingTop: saved.paddingTop,
				paddingBottom: saved.paddingBottom,
				opacity: 1,
			},
			reduceMotion ? fadeTransition : collapseTransition,
		);
		for (const property of [
			"height",
			"padding-top",
			"padding-bottom",
			"opacity",
		])
			element.style.removeProperty(property);
		savedBoxRef.current = null;
	};

	const fail = (action: SwipeAction) => {
		if (sound) playError();
		if (haptics) void haptic("error");
		announce(`${action.label} failed: ${label}`);
	};

	/** The next row's root, so focus has somewhere to go when this one leaves. */
	const neighbourRow = () => {
		const item = collapserRef.current?.parentElement;
		const sibling = item?.nextElementSibling ?? item?.previousElementSibling;
		return sibling?.querySelector<HTMLElement>('[data-slot="swipe-actions"]');
	};

	const fire = async (side: Side, action: SwipeAction, velocity = 0) => {
		if (busyRef.current || disabled) return;
		const sign = signOf(side);

		if (action.confirm && confirming !== action.id) {
			// First press asks in place; the action fills the group.
			cuesRef.current.armed = false;
			openedAtRef.current = performance.now();
			setConfirming(action.id);
			openRef.current = side;
			setOpenSide(side);
			list?.notifyOpen(id);
			setRowState("revealed");
			setStretch(true);
			pop();
			if (sound) playToggle(true);
			if (haptics) void haptic("medium");
			moveTo(sign * revealOf(side), velocity);
			return;
		}

		busyRef.current = true;
		setRowState("committing");
		if (action.destructive) {
			if (sound) playPop();
			if (haptics) void haptic("rigid");
		} else {
			if (sound) playSwoosh();
			if (haptics) void haptic("success");
		}
		announce(action.announce ?? `${action.label}: ${label}`);

		if (!action.destructive) {
			reclaimFocus();
			busyRef.current = false;
			close(velocity);
			setRowState("committing");
			try {
				await action.onAction();
			} catch {
				fail(action);
			} finally {
				if (!openRef.current && !dragRef.current) setRowState("idle");
			}
			return;
		}

		const hadFocus = rootRef.current?.contains(document.activeElement);
		openRef.current = null;
		setOpenSide(null);
		setConfirming(null);
		if (!reduceMotion) {
			xAnimationRef.current?.stop();
			xAnimationRef.current = animate(x, sign * rowWidth, {
				...snapSpring,
				velocity,
			});
		}
		await collapse();
		setRowState("collapsed");
		if (hadFocus)
			(neighbourRow() ?? rootRef.current)?.focus({ preventScroll: true });
		try {
			await action.onAction();
		} catch {
			fail(action);
			xAnimationRef.current?.stop();
			x.jump(0);
			cuesRef.current.armed = false;
			stretch.jump(0);
			await expand();
			busyRef.current = false;
			setRowState("idle");
		}
	};

	// Latest handlers for the imperative listeners, so they never re-bind.
	const api = useRef({ close, track: (_value: number) => {} });
	useLayoutEffect(() => {
		api.current = {
			close,
			// Threshold cues, only while a finger or mouse drives the row.
			track: (value) => {
				if (!dragRef.current?.locked) return;
				const cues = cuesRef.current;
				const side = sideOf(value);
				if (side !== cues.side) {
					cues.side = side;
					cues.pastReveal = false;
				}
				if (!side) return;
				const distance = Math.abs(value);
				const revealLine = revealOf(side) * REVEAL_RATIO;
				if (!cues.pastReveal && distance >= revealLine) {
					cues.pastReveal = true;
					if (haptics) void haptic("selection");
				} else if (cues.pastReveal && distance < revealLine - HYSTERESIS) {
					cues.pastReveal = false;
				}
				if (!fullSwipe) return;
				const armAt = armAtOf(side);
				if (!cues.armed && distance >= armAt) {
					cues.armed = true;
					setRowState("armed");
					if (sound) playToggle(true);
					if (haptics) void haptic("medium");
					if (!reduceMotion) {
						animate(stretch, 1, armSpring);
						pop();
					}
				} else if (cues.armed && distance < armAt - HYSTERESIS) {
					cues.armed = false;
					setRowState("dragging");
					if (sound) playToggle(false);
					if (haptics) void haptic("soft");
					if (!reduceMotion) animate(stretch, 0, armSpring);
				}
			},
		};
	});

	useEffect(() => x.on("change", (value) => api.current.track(value)), [x]);

	useEffect(() => {
		if (!list) return;
		return list.register(id, () => {
			if (openRef.current) api.current.close();
		});
	}, [list, id]);

	// Row size and direction.
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const measure = () => {
			setDir(getComputedStyle(root).direction === "rtl" ? -1 : 1);
			setRowWidth(root.offsetWidth);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	// A resize while open keeps the actions fully revealed.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-anchor on resize
	useEffect(() => {
		const side = openRef.current;
		if (!side || dragRef.current || busyRef.current) return;
		xAnimationRef.current?.stop();
		x.jump(signOf(side) * revealOf(side));
	}, [rowWidth, dir]);

	// Tapping elsewhere or scrolling closes an open row.
	useEffect(() => {
		if (!openSide) return;
		const onPointerDown = (event: globalThis.PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) api.current.close();
		};
		const onScroll = (event: Event) => {
			if (dragRef.current?.locked) return;
			if (rootRef.current?.contains(event.target as Node)) return;
			api.current.close();
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [openSide]);

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.locked) event.preventDefault();
		};
		root.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => root.removeEventListener("touchmove", onTouchMove);
	}, []);

	useEffect(() => () => xAnimationRef.current?.stop(), []);

	/** Follows the pointer, with resistance past the furthest travel. */
	const resist = (raw: number) => {
		const side = sideOf(raw);
		if (!side || !actionsOf(side).length) return 0;
		const sign = signOf(side);
		const distance = raw * sign;
		const max = fullSwipe ? rowWidth : revealOf(side);
		if (distance <= max) return raw;
		return sign * (reduceMotion ? max : max + (distance - max) * ELASTIC);
	};

	const release = () => {
		const value = x.get();
		const side = sideOf(value);
		const velocity = clamp(x.getVelocity(), -MAX_VELOCITY, MAX_VELOCITY);
		if (!side) return close(velocity);
		const sign = signOf(side);
		const distance = value * sign;
		const speed = velocity * sign;
		const reveal = revealOf(side);
		const outermost = outermostOf(side);
		if (
			fullSwipe &&
			outermost &&
			(cuesRef.current.armed || (speed > FLICK_VELOCITY && distance >= reveal))
		) {
			// A flick skips the arm line, so stretch the outermost action here.
			if (!cuesRef.current.armed && !reduceMotion)
				animate(stretch, 1, armSpring);
			void fire(side, outermost, velocity);
			return;
		}
		const projected = distance + speed * PROJECT_SECONDS;
		if (projected >= reveal * REVEAL_RATIO) open(side, velocity);
		else close(velocity);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled || busyRef.current || event.button !== 0 || !event.isPrimary)
			return;
		const root = event.currentTarget;
		const rect = root.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			origin: x.get(),
			locked: false,
			// CSS zoom and transforms scale client coordinates; work in local px.
			scale: rect.width / (root.offsetWidth || 1) || 1,
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = (event.clientX - drag.startX) / drag.scale;
		if (!drag.locked) {
			const dy = (event.clientY - drag.startY) / drag.scale;
			if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
			if (Math.abs(dy) > Math.abs(dx)) {
				// Vertical: leave the gesture to the page.
				dragRef.current = null;
				return;
			}
			const root = event.currentTarget;
			root.setPointerCapture(event.pointerId);
			root.dataset.dragging = "";
			xAnimationRef.current?.stop();
			xAnimationRef.current = null;
			drag.locked = true;
			// Count travel from the lock line so a fast first move isn't lost.
			drag.startX += Math.sign(dx) * AXIS_LOCK * drag.scale;
			drag.origin = x.get();
			const side = sideOf(drag.origin);
			cuesRef.current = {
				side,
				pastReveal: side
					? Math.abs(drag.origin) >= revealOf(side) * REVEAL_RATIO
					: false,
				armed: false,
			};
			if (confirming) {
				setConfirming(null);
				setStretch(false);
			}
			setRowState("dragging");
		}
		x.set(resist(drag.origin + (event.clientX - drag.startX) / drag.scale));
	};

	const endDrag = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragRef.current = null;
		if (!drag.locked) return;
		const root = event.currentTarget;
		if (root.hasPointerCapture(event.pointerId))
			root.releasePointerCapture(event.pointerId);
		delete root.dataset.dragging;
		// The click that follows a drag belongs to the drag.
		suppressClickRef.current = true;
		setTimeout(() => {
			suppressClickRef.current = false;
		}, 0);
		release();
	};

	const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
		if (!suppressClickRef.current) return;
		suppressClickRef.current = false;
		event.preventDefault();
		event.stopPropagation();
	};

	// A tap on the content of an open row closes it instead of activating it.
	const handleContentClickCapture = (event: MouseEvent<HTMLDivElement>) => {
		if (!openRef.current || event.detail === 0) return;
		event.preventDefault();
		event.stopPropagation();
		close();
	};

	const sideFor = (push: number): Side =>
		push * dir > 0 ? "leading" : "trailing";
	const handleSide: Side | null = trailing.length
		? "trailing"
		: leading.length
			? "leading"
			: null;

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled || busyRef.current) return;
		const root = event.currentTarget;
		const target = event.target as HTMLElement;
		if (event.key === "Escape" && openRef.current) {
			event.preventDefault();
			close();
			root.focus({ preventScroll: true });
			return;
		}
		const fromRow = target === root;
		const fromTray = !!target.closest('[data-slot="swipe-actions-tray"]');
		if (!fromRow && !fromTray) return;

		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			const push = event.key === "ArrowRight" ? 1 : -1;
			const current = openRef.current;
			if (current) {
				if (signOf(current) === push) return;
				event.preventDefault();
				close();
				root.focus({ preventScroll: true });
				return;
			}
			const side = sideFor(push);
			if (!actionsOf(side).length) return;
			event.preventDefault();
			open(side);
			return;
		}

		if (event.key === "Delete" || event.key === "Backspace") {
			const candidates = (["trailing", "leading"] as const).flatMap((side) =>
				actionsOf(side).map((action) => ({ side, action })),
			);
			const match =
				candidates.find(
					({ action }) => action.destructive && action.tone === "destructive",
				) ?? candidates.find(({ action }) => action.destructive);
			if (!match) return;
			event.preventDefault();
			void fire(match.side, match.action);
		}
	};

	const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
		const next = event.relatedTarget as Node | null;
		if (next && !event.currentTarget.contains(next) && openRef.current) close();
	};

	const renderTray = (side: Side) => {
		const actions = actionsOf(side);
		if (!actions.length) return null;
		const sign = signOf(side);
		const width = widthOf(side);
		const outermost = outermostOf(side);
		const isOpen = openSide === side;
		return (
			<Tray
				id={`${id}-${side}`}
				side={side}
				sign={sign}
				x={x}
				inert={!isOpen || disabled}
				className={tones[outermost?.tone ?? "default"]}
			>
				{actions.map((action) => (
					<ActionButton
						key={action.id}
						action={action}
						side={side}
						count={actions.length}
						sign={sign}
						x={x}
						stretch={stretch}
						popScale={popScale}
						stretchTarget={
							confirming && isOpen
								? confirming === action.id
								: action === outermost
						}
						width={width}
						showLabel={showLabels}
						reduceMotion={reduceMotion}
						confirming={isOpen && confirming === action.id}
						onPress={(event) => {
							// Keyboard clicks have no detail and are never accidental.
							if (
								event.detail > 0 &&
								performance.now() - openedAtRef.current < OPEN_GUARD_MS
							)
								return;
							void fire(side, action);
						}}
					/>
				))}
			</Tray>
		);
	};

	return (
		<motion.div
			layout={list && !reduceMotion ? "position" : undefined}
			role={list ? "listitem" : undefined}
			data-slot="swipe-actions-item"
			className="group/swipe-item"
		>
			<div
				ref={collapserRef}
				className={cn(
					"overflow-hidden",
					variant === "inset" && "pb-2 group-last/swipe-item:pb-0",
				)}
			>
				<div
					ref={rootRef}
					role="group"
					aria-label={label}
					tabIndex={disabled ? -1 : 0}
					data-slot="swipe-actions"
					data-state={disabled ? "disabled" : "idle"}
					data-variant={variant}
					data-open={openSide ?? undefined}
					data-disabled={disabled || undefined}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
					onClickCapture={handleClickCapture}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					className={cn(
						"group/swipe relative isolate touch-pan-y overflow-hidden outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 data-dragging:cursor-grabbing data-dragging:select-none data-disabled:opacity-60",
						variant === "inset"
							? "rounded-xl border bg-card text-card-foreground shadow-xs"
							: "border-b bg-background group-last/swipe-item:border-b-0",
						className,
					)}
				>
					<motion.div style={{ opacity: surfaceOpacity }} className="relative">
						{renderTray("leading")}
						{renderTray("trailing")}
						<motion.div
							data-slot="swipe-actions-content"
							onClickCapture={handleContentClickCapture}
							style={{ x }}
							className="relative z-10 bg-inherit will-change-transform"
						>
							{children}
							{showHandle && handleSide && !disabled ? (
								<button
									type="button"
									tabIndex={-1}
									data-slot="swipe-actions-handle"
									aria-expanded={openSide !== null}
									aria-controls={`${id}-${openSide ?? handleSide}`}
									aria-label={
										openSide
											? `Hide actions for ${label}`
											: `Show actions for ${label}`
									}
									onClick={() => (openSide ? close() : open(handleSide))}
									className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-xs outline-none transition-[opacity,color] duration-150 hover:text-foreground focus-visible:opacity-100 group-hover/swipe:opacity-100 group-data-dragging/swipe:opacity-0 [@media(hover:none)]:sr-only"
								>
									<Ellipsis aria-hidden className="size-4" />
								</button>
							) : null}
						</motion.div>
					</motion.div>
				</div>
			</div>
			{list ? null : region}
		</motion.div>
	);
}

function Tray({
	id,
	side,
	sign,
	x,
	inert,
	className,
	children,
}: {
	id: string;
	side: Side;
	sign: number;
	x: MotionValue<number>;
	inert: boolean;
	className?: string;
	children: ReactNode;
}) {
	const width = useTransform(x, (value) => Math.max(0, value * sign));
	return (
		<motion.div
			id={id}
			inert={inert}
			data-slot="swipe-actions-tray"
			data-side={side}
			style={{ width }}
			className={cn(
				"absolute inset-y-0 flex overflow-hidden",
				side === "leading" ? "start-0" : "end-0",
				className,
			)}
		>
			{children}
		</motion.div>
	);
}

export default SwipeActions;
