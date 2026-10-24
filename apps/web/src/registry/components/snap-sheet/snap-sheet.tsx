"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useTiks } from "@rexa-developer/tiks/react";
import { XIcon } from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type ComponentProps,
	createContext,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const settleSpring = {
	type: "spring",
	stiffness: 400,
	damping: 40,
	mass: 0.9,
} as const;
const openSpring = { type: "spring", stiffness: 320, damping: 34 } as const;
const reducedTween = {
	type: "tween",
	duration: 0.12,
	ease: "easeOut",
} as const;

/** Seconds of release velocity projected ahead before picking a snap point. */
const PROJECTION_SECONDS = 0.2;
/** Downward release speed, in px/s, that closes the sheet from its lowest snap. */
const DISMISS_VELOCITY = 1000;
/** Fastest release, in px/s, so one jumpy pointer event can't fling the sheet. */
const MAX_VELOCITY = 4000;
/** Share of the pointer's travel past full height that the sheet follows. */
const RUBBER_BAND = 0.3;
/** Px past full height where the rubber band hits its limit. */
const RUBBER_LIMIT = 16;
/** Px band around a snap point a drag must clear before it counts as crossed. */
const DETENT_HYSTERESIS = 6;
/** Pointer travel, in px, before a press turns into a drag or a scroll. */
const DRAG_SLOP = 4;
/** Px kept free above the sheet at full height. Matches the height classes. */
const TOP_GAP = 24;
/** Px around the floating variant. Matches its inset classes. */
const FLOATING_INSET = 8;
/** Px past the bottom edge a closed sheet rests at, so its shadow is hidden too. */
const CLOSED_OVERSHOOT = 24;
/** Px from a target where a settling sheet counts as landed for its cue. */
const LANDING_DISTANCE = 2;
const BACKGROUND_SCALE = 0.94;
const BACKGROUND_RADIUS = 12;
const BACKGROUND_OFFSET = 10;
/** Off-screen until the first measure, so the sheet never flashes at full height. */
const UNMEASURED_Y = 10_000;
const NO_DRAG_SELECTOR =
	"input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-sheet-no-drag]";
const DEFAULT_SNAP_POINTS: SnapPoint[] = [0.5, 1];

/** A fraction of the viewport height, or a px string such as `"148px"`. */
export type SnapPoint = number | `${number}px`;
type DesktopMode = "bottom" | "dialog" | "sheet";
type Phase =
	| "closed"
	| "opening"
	| "open"
	| "dragging"
	| "settling"
	| "closing";
type CloseCue = "flick" | "plain" | null;
type Layout = {
	/** `y` of each snap point; 0 is full height. */
	snaps: number[];
	/** `y` with the sheet fully off-screen. */
	closed: number;
	/** Height of the sheet element. */
	max: number;
};
type Drag = {
	pointerId: number;
	startX: number;
	startY: number;
	startSheetY: number;
	scale: number;
	scroller: HTMLElement | null;
	decided: "sheet" | "none" | null;
	fromLowest: boolean;
	hitLimit: boolean;
	sides: number[];
};

export interface SnapSheetProps {
	/** Controlled open state. */
	open?: boolean;
	/** Initial open state when uncontrolled. */
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/**
	 * Heights the sheet rests at, lowest first. Numbers are fractions of the
	 * viewport height and px strings are fixed heights. `1` is as tall as the
	 * sheet gets: the viewport less a 24 px gap.
	 */
	snapPoints?: SnapPoint[];
	/** Controlled index into `snapPoints`. */
	activeSnap?: number;
	/** Snap point the sheet opens to when uncontrolled. */
	defaultSnap?: number;
	/** Called when a drag, key press, or handle tap picks a new snap point. */
	onSnapChange?: (index: number) => void;
	/**
	 * Dim the page, trap focus, and lock scroll. Turn it off for map- or
	 * player-style sheets that leave the page interactive.
	 */
	modal?: boolean;
	/** Let a downward drag, a flick, Esc, or an overlay click close the sheet. */
	dismissible?: boolean;
	/** Scale `[data-sheet-wrapper]` back as the sheet reaches full height. */
	scaleBackground?: boolean;
	/** How the sheet renders from the `md` breakpoint up. */
	desktop?: DesktopMode;
	/** Only start drags from `SnapSheet.Handle`. */
	handleOnly?: boolean;
	/** Play a click per snap, a pop at full height, and a swoosh on open and dismiss. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Play cues for open and snap changes that come from props too. */
	soundOnProgrammatic?: boolean;
	children?: ReactNode;
}

type SnapSheetContextValue = {
	y: MotionValue<number>;
	overlayOpacity: MotionValue<number>;
	dialogScale: MotionValue<number>;
	progress: MotionValue<number>;
	sheetX: MotionValue<string>;
	mode: DesktopMode;
	modal: boolean;
	snapIndex: number;
	snapCount: number;
	snapLabel: string;
	announcement: string;
	setPopup: (node: HTMLDivElement | null) => void;
	containerRef: RefObject<HTMLElement | null>;
	floatingRef: RefObject<boolean>;
	shouldMoveFocus: () => boolean;
	stepSnap: (index: number) => void;
	handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	consumeClick: () => boolean;
};

const SnapSheetContext = createContext<SnapSheetContextValue | null>(null);

function useSnapSheet() {
	const context = useContext(SnapSheetContext);
	if (!context) {
		throw new Error("SnapSheet parts must be rendered inside <SnapSheet>.");
	}
	return context;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function toPx(point: SnapPoint, frame: number) {
	return typeof point === "number" ? point * frame : Number.parseFloat(point);
}

function describeSnap(points: SnapPoint[], index: number) {
	const point = points[index];
	const last = index === points.length - 1;
	if (typeof point === "number") {
		if (last && point >= 0.85) return "Full height";
		if (Math.abs(point - 0.5) < 0.05) return "Half height";
		if (index === 0) return "Peek height";
		return `${Math.round(point * 100)}% height`;
	}
	if (index === 0) return "Peek height";
	if (last) return "Full height";
	return `Height ${index + 1} of ${points.length}`;
}

/** Which side of `snap` a sheet at `y` sits on: -1 above, 1 below, 0 inside the band. */
function sideOf(y: number, snap: number) {
	if (y < snap - DETENT_HYSTERESIS / 2) return -1;
	if (y > snap + DETENT_HYSTERESIS / 2) return 1;
	return 0;
}

/** The nearest element between `target` and `sheet` that scrolls vertically. */
function findScroller(target: Element, sheet: HTMLElement) {
	let node: Element | null = target;
	while (node && node !== sheet) {
		if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight) {
			const { overflowY } = getComputedStyle(node);
			if (overflowY === "auto" || overflowY === "scroll") return node;
		}
		node = node.parentElement;
	}
	return null;
}

function resolveContainer(
	container: HTMLElement | RefObject<HTMLElement | null> | null | undefined,
) {
	if (!container) return null;
	return container instanceof HTMLElement ? container : container.current;
}

function subscribeDesktop(onChange: () => void) {
	const query = window.matchMedia("(min-width: 768px)");
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

function useIsDesktop() {
	return useSyncExternalStore(
		subscribeDesktop,
		() => window.matchMedia("(min-width: 768px)").matches,
		() => false,
	);
}

function SnapSheet({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	snapPoints = DEFAULT_SNAP_POINTS,
	activeSnap,
	defaultSnap = 0,
	onSnapChange,
	modal = true,
	dismissible = true,
	scaleBackground = false,
	desktop = "bottom",
	handleOnly = false,
	sound = true,
	haptics = true,
	soundOnProgrammatic = false,
	children,
}: SnapSheetProps) {
	const snapCount = Math.max(1, snapPoints.length);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const open = openProp ?? uncontrolledOpen;
	// Stays mounted through the close animation, then unmounts.
	const [rendered, setRendered] = useState(open);
	if (open && !rendered) setRendered(true);

	const [uncontrolledSnap, setUncontrolledSnap] = useState(defaultSnap);
	const snapIndex = clamp(activeSnap ?? uncontrolledSnap, 0, snapCount - 1);
	const [announcement, setAnnouncement] = useState("");
	const [popup, setPopupState] = useState<HTMLDivElement | null>(null);

	const isDesktop = useIsDesktop();
	const mode: DesktopMode = isDesktop ? desktop : "bottom";
	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		swoosh: playSwoosh,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const y = useMotionValue(UNMEASURED_Y);
	const progress = useMotionValue(0);
	const popupRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLElement | null>(null);
	const floatingRef = useRef(false);
	const wrapperRef = useRef<HTMLElement | null>(null);
	const directionRef = useRef(1);
	const phaseRef = useRef<Phase>("closed");
	const layoutRef = useRef<Layout | null>(null);
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const dragRef = useRef<Drag | null>(null);
	/** Snap index the sheet rests at or is heading to. */
	const indexRef = useRef(snapIndex);
	/** Snap index the sheet last came to rest at, for "settled somewhere new". */
	const settledIndexRef = useRef(snapIndex);
	const landingRef = useRef<{ y: number; index: number } | null>(null);
	const userOpenRef = useRef(false);
	const suppressClickRef = useRef(false);

	// Latest values for the imperative handlers below, so they never re-bind.
	const latest = useRef({
		open,
		snapPoints,
		snapIndex,
		activeSnap,
		defaultSnap,
		mode,
		modal,
		dismissible,
		scaleBackground,
		handleOnly,
		sound,
		haptics,
		soundOnProgrammatic,
		shouldReduceMotion,
		onOpenChange,
		onSnapChange,
	});
	useLayoutEffect(() => {
		latest.current = {
			open,
			snapPoints,
			snapIndex,
			activeSnap,
			defaultSnap,
			mode,
			modal,
			dismissible,
			scaleBackground,
			handleOnly,
			sound,
			haptics,
			soundOnProgrammatic,
			shouldReduceMotion,
			onOpenChange,
			onSnapChange,
		};
	});

	const overlayOpacity = useTransform(() => {
		const value = y.get();
		const amount = progress.get();
		const layout = layoutRef.current;
		if (latest.current.mode !== "bottom") return amount;
		if (!layout) return 0;
		const top = layout.snaps[layout.snaps.length - 1] ?? 0;
		// Modal sheets dim from closed; non-modal ones only near full height.
		const from =
			latest.current.modal || layout.snaps.length < 2
				? layout.closed
				: (layout.snaps[layout.snaps.length - 2] ?? layout.closed);
		return clamp((from - value) / (from - top || 1), 0, 1);
	});
	const dialogScale = useTransform(progress, [0, 1], [0.96, 1]);
	const sheetX = useTransform(
		() => `${(1 - progress.get()) * 100 * directionRef.current}%`,
	);

	const setPhase = useCallback((phase: Phase) => {
		phaseRef.current = phase;
		if (popupRef.current) popupRef.current.dataset.sheetState = phase;
	}, []);

	const setPopup = useCallback((node: HTMLDivElement | null) => {
		popupRef.current = node;
		if (node) node.dataset.sheetState = phaseRef.current;
		setPopupState(node);
	}, []);

	const measure = useCallback(() => {
		const element = popupRef.current;
		if (!element) return null;
		const max = element.offsetHeight;
		const inset = floatingRef.current ? FLOATING_INSET : 0;
		const frame = max + TOP_GAP + inset;
		const snaps = latest.current.snapPoints.map(
			(point) => max - clamp(toPx(point, frame), 0, max),
		);
		if (snaps.length === 0) snaps.push(0);
		layoutRef.current = { snaps, closed: max + inset + CLOSED_OVERSHOOT, max };
		directionRef.current =
			getComputedStyle(element).direction === "rtl" ? -1 : 1;
		return layoutRef.current;
	}, []);

	const stop = useCallback(() => {
		animationRef.current?.stop();
		animationRef.current = null;
	}, []);

	const runTo = useCallback(
		(
			value: MotionValue<number>,
			to: number,
			transition: typeof settleSpring | typeof openSpring,
			velocity: number,
			onComplete: () => void,
		) => {
			stop();
			if (value.get() === to) {
				onComplete();
				return;
			}
			animationRef.current = animate(value, to, {
				...(latest.current.shouldReduceMotion
					? reducedTween
					: { ...transition, velocity }),
				restDelta: 0.5,
				onComplete: () => {
					animationRef.current = null;
					onComplete();
				},
			});
		},
		[stop],
	);

	const playSnapCue = useCallback(
		(index: number) => {
			const { sound, haptics, snapPoints } = latest.current;
			const top = index === snapPoints.length - 1;
			if (sound) (top ? playPop : playClick)();
			if (haptics) void haptic(top ? "light" : "selection");
		},
		[haptic, playClick, playPop],
	);

	const resetWrapper = useCallback(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;
		wrapper.style.removeProperty("transform");
		wrapper.style.removeProperty("transform-origin");
		wrapper.style.removeProperty("border-radius");
		wrapper.style.removeProperty("overflow");
		wrapper.style.removeProperty("will-change");
		wrapperRef.current = null;
	}, []);

	const attachWrapper = useCallback(() => {
		resetWrapper();
		const { scaleBackground, shouldReduceMotion, mode } = latest.current;
		if (!scaleBackground || shouldReduceMotion || mode !== "bottom") return;
		const root = containerRef.current ?? document;
		const wrapper = root.querySelector<HTMLElement>("[data-sheet-wrapper]");
		if (!wrapper) return;
		wrapper.style.transformOrigin = "center top";
		wrapper.style.willChange = "transform";
		wrapperRef.current = wrapper;
	}, [resetWrapper]);

	const animateOpen = useCallback(
		(cue: boolean) => {
			const layout = measure();
			if (!layout) return;
			const fromClosed = phaseRef.current === "closed";
			const index = clamp(latest.current.snapIndex, 0, layout.snaps.length - 1);
			indexRef.current = index;
			settledIndexRef.current = index;
			landingRef.current = null;
			attachWrapper();
			setPhase("opening");
			if (latest.current.mode === "bottom") {
				if (fromClosed) y.jump(layout.closed);
				progress.jump(1);
				runTo(y, layout.snaps[index] ?? 0, openSpring, 0, () =>
					setPhase("open"),
				);
			} else {
				y.jump(0);
				if (fromClosed) progress.jump(0);
				runTo(progress, 1, openSpring, 0, () => setPhase("open"));
			}
			if (cue && latest.current.sound) playSwoosh();
		},
		[attachWrapper, measure, playSwoosh, progress, runTo, setPhase, y],
	);

	const animateClose = useCallback(
		(velocity: number, cue: CloseCue) => {
			const finish = () => {
				setPhase("closed");
				resetWrapper();
				// A controlled parent can refuse to close; come back up.
				if (latest.current.open) {
					animateOpen(false);
					return;
				}
				setRendered(false);
				// Uncontrolled sheets open at their default snap point again.
				if (latest.current.activeSnap === undefined) {
					const index = clamp(
						latest.current.defaultSnap,
						0,
						latest.current.snapPoints.length - 1,
					);
					indexRef.current = index;
					setUncontrolledSnap(index);
				}
			};
			landingRef.current = null;
			setPhase("closing");
			const layout = layoutRef.current;
			if (latest.current.mode === "bottom" && layout) {
				runTo(y, layout.closed, openSpring, velocity, finish);
			} else {
				runTo(progress, 0, openSpring, 0, finish);
			}
			if (cue) {
				if (latest.current.sound) playSwoosh();
				if (cue === "flick" && latest.current.haptics) void haptic("nudge");
			}
		},
		[
			animateOpen,
			haptic,
			playSwoosh,
			progress,
			resetWrapper,
			runTo,
			setPhase,
			y,
		],
	);

	const setOpen = useCallback((next: boolean) => {
		if (latest.current.open === next) return;
		setUncontrolledOpen(next);
		latest.current.onOpenChange?.(next);
	}, []);

	const requestClose = useCallback(
		(cue: CloseCue, velocity = 0) => {
			const phase = phaseRef.current;
			if (phase === "closed" || phase === "closing") return;
			setOpen(false);
			animateClose(velocity, cue);
		},
		[animateClose, setOpen],
	);

	const settle = useCallback(
		(index: number, { velocity = 0, cue = false } = {}) => {
			const layout = layoutRef.current;
			if (!layout) return;
			const target = layout.snaps[index] ?? 0;
			indexRef.current = index;
			landingRef.current =
				cue && index !== settledIndexRef.current ? { y: target, index } : null;
			setPhase("settling");
			runTo(y, target, settleSpring, velocity, () => {
				settledIndexRef.current = index;
				setPhase("open");
				const landing = landingRef.current;
				if (landing) {
					landingRef.current = null;
					playSnapCue(landing.index);
				}
			});
		},
		[playSnapCue, runTo, setPhase, y],
	);

	/** Moves to a snap picked by the user and reports it. */
	const commitSnap = useCallback(
		(index: number, velocity = 0) => {
			settle(index, { velocity, cue: true });
			if (index === latest.current.snapIndex) return;
			setUncontrolledSnap(index);
			setAnnouncement(
				`Sheet at ${describeSnap(latest.current.snapPoints, index).toLowerCase()}`,
			);
			latest.current.onSnapChange?.(index);
		},
		[settle],
	);

	// Open and close from state, whether it changed here or through props.
	useLayoutEffect(() => {
		if (!popup) return;
		const phase = phaseRef.current;
		if (open) {
			if (phase === "closed" || phase === "closing") {
				const cue = userOpenRef.current || latest.current.soundOnProgrammatic;
				animateOpen(cue);
			}
			return;
		}
		if (phase === "closed") {
			setRendered(false);
		} else if (phase !== "closing") {
			animateClose(0, latest.current.soundOnProgrammatic ? "plain" : null);
		}
	}, [open, popup, animateOpen, animateClose]);

	// Controlled snap: glide there, unless a drag is in progress (the drag wins).
	useEffect(() => {
		if (activeSnap === undefined) return;
		const phase = phaseRef.current;
		if (phase === "dragging" || phase === "closed" || phase === "closing") {
			return;
		}
		const index = clamp(activeSnap, 0, snapCount - 1);
		if (index === indexRef.current) return;
		settle(index, { cue: latest.current.soundOnProgrammatic });
	}, [activeSnap, snapCount, settle]);

	// The one place that reacts to movement: detents, the rubber band,
	// landing cues, and the background scale.
	useEffect(() => {
		const sync = (value: number) => {
			const layout = layoutRef.current;
			if (!layout) return;
			const { haptics } = latest.current;
			const landing = landingRef.current;
			if (landing && Math.abs(value - landing.y) < LANDING_DISTANCE) {
				landingRef.current = null;
				playSnapCue(landing.index);
			}

			const top = layout.snaps[layout.snaps.length - 1] ?? 0;
			const drag = dragRef.current;
			if (phaseRef.current === "dragging" && drag) {
				if (!drag.hitLimit && value < top - RUBBER_LIMIT) {
					drag.hitLimit = true;
					if (haptics) void haptic("rigid");
				}
				let crossed = false;
				layout.snaps.forEach((snap, index) => {
					const side = sideOf(value, snap);
					if (side === 0 || side === drag.sides[index]) return;
					if (drag.sides[index] !== 0) crossed = true;
					drag.sides[index] = side;
				});
				if (crossed && haptics) void haptic("soft");
			}

			const wrapper = wrapperRef.current;
			if (!wrapper) return;
			const from =
				layout.snaps.length > 1
					? (layout.snaps[layout.snaps.length - 2] ?? layout.closed)
					: layout.closed;
			const amount = clamp((from - value) / (from - top || 1), 0, 1);
			if (amount === 0) {
				wrapper.style.removeProperty("transform");
				wrapper.style.removeProperty("border-radius");
				wrapper.style.removeProperty("overflow");
				return;
			}
			const scale = 1 - (1 - BACKGROUND_SCALE) * amount;
			wrapper.style.transform = `translateY(${BACKGROUND_OFFSET * amount}px) scale(${scale})`;
			wrapper.style.borderRadius = `${BACKGROUND_RADIUS * amount}px`;
			wrapper.style.overflow = "hidden";
		};
		return y.on("change", sync);
	}, [haptic, playSnapCue, y]);

	// Recompute snap px on resize, rotation, and the iOS address bar.
	useLayoutEffect(() => {
		if (!popup) return;
		let lastHeight = popup.offsetHeight;
		const observer = new ResizeObserver(() => {
			if (latest.current.mode !== "bottom") return;
			if (popup.offsetHeight === lastHeight) return;
			lastHeight = popup.offsetHeight;
			const layout = measure();
			if (!layout) return;
			const target = layout.snaps[indexRef.current] ?? 0;
			const phase = phaseRef.current;
			if (phase === "open") {
				y.jump(target);
			} else if (phase === "opening" || phase === "settling") {
				runTo(y, target, settleSpring, y.getVelocity(), () => setPhase("open"));
			}
		});
		observer.observe(popup);
		return () => observer.disconnect();
	}, [popup, measure, runTo, setPhase, y]);

	// Keep the sheet above the virtual keyboard.
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!popup || !viewport || containerRef.current) return;
		const update = () => {
			const keyboard =
				viewport.scale > 1.01
					? 0
					: Math.max(
							0,
							Math.round(
								window.innerHeight - viewport.height - viewport.offsetTop,
							),
						);
			popup.style.setProperty("--snap-sheet-keyboard", `${keyboard}px`);
		};
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
		};
	}, [popup]);

	// Switching between bottom and desktop layouts while open.
	useLayoutEffect(() => {
		const phase = phaseRef.current;
		if (phase === "closed" || phase === "closing") return;
		stop();
		attachWrapper();
		if (mode === "bottom") {
			const layout = measure();
			progress.jump(1);
			if (layout) y.jump(layout.snaps[indexRef.current] ?? 0);
		} else {
			y.jump(0);
			progress.jump(1);
		}
		setPhase("open");
	}, [mode, attachWrapper, measure, progress, setPhase, stop, y]);

	useEffect(
		() => () => {
			stop();
			resetWrapper();
		},
		[stop, resetWrapper],
	);

	const beginDrag = useCallback(
		(drag: Drag, clientY: number) => {
			const layout = layoutRef.current;
			const sheet = popupRef.current;
			if (!layout || !sheet) return;
			stop();
			landingRef.current = null;
			drag.startY = clientY;
			drag.startSheetY = y.get();
			drag.sides = layout.snaps.map((snap) => sideOf(drag.startSheetY, snap));
			setPhase("dragging");
			try {
				sheet.setPointerCapture(drag.pointerId);
			} catch {
				// The pointer may already be gone.
			}
			window.getSelection()?.removeAllRanges();
			suppressClickRef.current = true;
		},
		[setPhase, stop, y],
	);

	/** Settles on the first move past the slop: the sheet drags or the content scrolls. */
	const decide = useCallback(
		(drag: Drag, clientX: number, clientY: number) => {
			const dx = clientX - drag.startX;
			const dy = clientY - drag.startY;
			if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
			// Axis lock: sideways swipes belong to carousels and the browser.
			if (Math.abs(dx) > Math.abs(dy)) {
				drag.decided = "none";
				return;
			}
			const layout = layoutRef.current;
			const top = layout?.snaps[layout.snaps.length - 1] ?? 0;
			const atFull = y.get() <= top + 1;
			const scroller = drag.scroller;
			const scrolls = scroller && (dy < 0 || scroller.scrollTop > 0);
			drag.decided = atFull && scrolls ? "none" : "sheet";
			if (drag.decided === "sheet") beginDrag(drag, clientY);
		},
		[beginDrag, y],
	);

	const release = useCallback(
		(drag: Drag) => {
			const layout = layoutRef.current;
			if (!layout) return;
			const { dismissible } = latest.current;
			const velocity = clamp(y.getVelocity(), -MAX_VELOCITY, MAX_VELOCITY);
			const current = y.get();
			const lowest = layout.snaps[0] ?? 0;
			if (
				dismissible &&
				velocity > DISMISS_VELOCITY &&
				(drag.fromLowest || current >= lowest)
			) {
				requestClose("flick", velocity);
				return;
			}
			const projected = current + velocity * PROJECTION_SECONDS;
			let nearest = 0;
			layout.snaps.forEach((snap, index) => {
				if (
					Math.abs(snap - projected) <
					Math.abs((layout.snaps[nearest] ?? 0) - projected)
				) {
					nearest = index;
				}
			});
			const nearestDistance = Math.abs(
				(layout.snaps[nearest] ?? 0) - projected,
			);
			if (
				dismissible &&
				Math.abs(layout.closed - projected) < nearestDistance
			) {
				requestClose("flick", Math.max(velocity, 0));
				return;
			}
			commitSnap(nearest, velocity);
		},
		[commitSnap, requestClose, y],
	);

	const handlePointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const { mode, handleOnly } = latest.current;
			if (mode !== "bottom" || !event.isPrimary) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const phase = phaseRef.current;
			if (phase === "closed" || phase === "closing") return;
			const target = event.target as HTMLElement;
			const sheet = event.currentTarget;
			const onHandle = Boolean(
				target.closest("[data-slot='snap-sheet-handle']"),
			);
			if (handleOnly && !onHandle) return;
			if (!onHandle && target.closest(NO_DRAG_SELECTOR)) return;
			const rect = sheet.getBoundingClientRect();
			suppressClickRef.current = false;
			dragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startSheetY: y.get(),
				// CSS zoom and transforms scale client coordinates; work in local px.
				scale: rect.height / (sheet.offsetHeight || 1) || 1,
				scroller: onHandle ? null : findScroller(target, sheet),
				decided: null,
				fromLowest: settledIndexRef.current === 0,
				hitLimit: false,
				sides: [],
			};
		},
		[y],
	);

	// Follow the gesture on window: before it's decided, the pointer can leave
	// the sheet, and capturing on press would retarget clicks inside it.
	useEffect(() => {
		if (!popup) return;
		const onPointerMove = (event: globalThis.PointerEvent) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			if (drag.decided === null) decide(drag, event.clientX, event.clientY);
			if (drag.decided !== "sheet") return;
			const layout = layoutRef.current;
			if (!layout) return;
			const raw = drag.startSheetY + (event.clientY - drag.startY) / drag.scale;
			const top = layout.snaps[layout.snaps.length - 1] ?? 0;
			const lowest = layout.snaps[0] ?? 0;
			let next = raw;
			if (raw < top) {
				next = top - (top - raw) * RUBBER_BAND;
			} else if (!latest.current.dismissible && raw > lowest) {
				next = lowest + (raw - lowest) * RUBBER_BAND;
			}
			y.set(Math.min(next, layout.closed));
		};
		const onPointerUp = (event: globalThis.PointerEvent) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			dragRef.current = null;
			if (popup.hasPointerCapture(event.pointerId)) {
				popup.releasePointerCapture(event.pointerId);
			}
			if (drag.decided === "sheet") release(drag);
		};
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [popup, decide, release, y]);

	// iOS and Android start scrolling unless the first touchmove is cancelled.
	useEffect(() => {
		if (!popup) return;
		const onTouchMove = (event: TouchEvent) => {
			const drag = dragRef.current;
			const touch = event.touches[0];
			if (!drag || !touch) return;
			if (drag.decided === null) decide(drag, touch.clientX, touch.clientY);
			if (drag.decided === "sheet" && event.cancelable) event.preventDefault();
		};
		popup.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => popup.removeEventListener("touchmove", onTouchMove);
	}, [popup, decide]);

	const stepSnap = useCallback(
		(index: number) => {
			const phase = phaseRef.current;
			if (phase === "closed" || phase === "closing" || phase === "dragging") {
				return;
			}
			commitSnap(clamp(index, 0, latest.current.snapPoints.length - 1));
		},
		[commitSnap],
	);

	const consumeClick = useCallback(() => {
		const suppressed = suppressClickRef.current;
		suppressClickRef.current = false;
		return suppressed;
	}, []);

	const shouldMoveFocus = useCallback(
		() => latest.current.modal || userOpenRef.current,
		[],
	);

	const handleOpenChange = useCallback(
		(next: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => {
			if (next) {
				userOpenRef.current = true;
				setOpen(true);
				return;
			}
			const userDismissal =
				details.reason === "escape-key" || details.reason === "outside-press";
			if (userDismissal && !latest.current.dismissible) return;
			requestClose("plain");
		},
		[requestClose, setOpen],
	);

	// Opens that don't come through the trigger stay silent and keep focus.
	useLayoutEffect(() => {
		if (!open) userOpenRef.current = false;
	}, [open]);

	return (
		<SnapSheetContext.Provider
			value={{
				y,
				overlayOpacity,
				dialogScale,
				progress,
				sheetX,
				mode,
				modal,
				snapIndex,
				snapCount,
				snapLabel: describeSnap(snapPoints, snapIndex),
				announcement,
				setPopup,
				containerRef,
				floatingRef,
				shouldMoveFocus,
				stepSnap,
				handlePointerDown,
				consumeClick,
			}}
		>
			<DialogPrimitive.Root
				open={rendered}
				onOpenChange={handleOpenChange}
				modal={modal}
				disablePointerDismissal={!modal || !dismissible}
			>
				{children}
			</DialogPrimitive.Root>
		</SnapSheetContext.Provider>
	);
}

function SnapSheetTrigger(props: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="snap-sheet-trigger" {...props} />;
}

export interface SnapSheetContentProps {
	className?: string;
	overlayClassName?: string;
	/**
	 * Element to render into instead of `document.body`, such as a phone frame.
	 * Give it `position: relative` and `overflow: clip`.
	 */
	container?: HTMLElement | RefObject<HTMLElement | null> | null;
	/** `attached` spans the width with rounded top corners; `floating` is inset and fully rounded. */
	variant?: "attached" | "floating";
	children?: ReactNode;
}

function SnapSheetContent({
	className,
	overlayClassName,
	container,
	variant = "attached",
	children,
}: SnapSheetContentProps) {
	const {
		y,
		overlayOpacity,
		dialogScale,
		progress,
		sheetX,
		mode,
		modal,
		announcement,
		setPopup,
		containerRef,
		floatingRef,
		shouldMoveFocus,
		handlePointerDown,
	} = useSnapSheet();
	const contained = Boolean(container);
	const floating = variant === "floating";

	useLayoutEffect(() => {
		containerRef.current = resolveContainer(container);
		floatingRef.current = floating;
	});

	const style =
		mode === "dialog"
			? { opacity: progress, scale: dialogScale }
			: mode === "sheet"
				? { x: sheetX }
				: { y };

	return (
		<DialogPrimitive.Portal container={container}>
			<DialogPrimitive.Backdrop
				data-slot="snap-sheet-overlay"
				forceRender
				render={<motion.div style={{ opacity: overlayOpacity }} />}
				className={cn(
					"inset-0 z-50 bg-black/40",
					contained ? "absolute" : "fixed",
					!modal && "pointer-events-none",
					overlayClassName,
				)}
			/>
			<DialogPrimitive.Popup
				ref={setPopup}
				data-slot="snap-sheet-content"
				data-mode={mode}
				data-variant={variant}
				aria-modal={modal || undefined}
				initialFocus={shouldMoveFocus}
				render={<motion.div style={style} />}
				onPointerDown={handlePointerDown}
				className={cn(
					"group/sheet z-50 flex flex-col overscroll-contain border border-border/70 bg-background text-foreground outline-none",
					contained ? "absolute" : "fixed",
					mode === "bottom" && [
						"touch-none will-change-transform data-[sheet-state=dragging]:select-none",
						"shadow-[0_-12px_40px_-16px_rgb(0_0_0/0.35)]",
						floating
							? "inset-x-2 bottom-2 mx-auto max-w-xl rounded-[28px]"
							: "inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-[22px] border-b-0",
						contained
							? floating
								? "h-[calc(100%-32px)]"
								: "h-[calc(100%-24px)]"
							: floating
								? "mb-[var(--snap-sheet-keyboard,0px)] h-[calc(100dvh-32px-var(--snap-sheet-keyboard,0px))]"
								: "mb-[var(--snap-sheet-keyboard,0px)] h-[calc(100dvh-24px-var(--snap-sheet-keyboard,0px))]",
					],
					mode === "dialog" &&
						"top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl pt-4 shadow-2xl",
					mode === "sheet" &&
						"inset-y-0 end-0 w-full max-w-md border-y-0 border-e-0 pt-4 shadow-2xl",
					className,
				)}
			>
				{children}
				<span aria-live="polite" className="sr-only">
					{announcement}
				</span>
			</DialogPrimitive.Popup>
		</DialogPrimitive.Portal>
	);
}

function SnapSheetHandle({
	className,
	onClick,
	onKeyDown,
	...props
}: Omit<ComponentProps<"button">, "children">) {
	const { mode, snapIndex, snapCount, snapLabel, stepSnap, consumeClick } =
		useSnapSheet();
	if (mode !== "bottom") return null;

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		if (consumeClick() || event.defaultPrevented) return;
		// Tapping or pressing Enter cycles through the snap points.
		stepSnap((snapIndex + 1) % snapCount);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;
		const targets: Record<string, number> = {
			ArrowUp: snapIndex + 1,
			ArrowRight: snapIndex + 1,
			ArrowDown: snapIndex - 1,
			ArrowLeft: snapIndex - 1,
			Home: 0,
			End: snapCount - 1,
		};
		const target = targets[event.key];
		if (target === undefined) return;
		event.preventDefault();
		stepSnap(target);
	};

	return (
		<button
			type="button"
			role="slider"
			aria-label="Resize sheet"
			aria-orientation="vertical"
			aria-valuemin={0}
			aria-valuemax={snapCount - 1}
			aria-valuenow={snapIndex}
			aria-valuetext={snapLabel}
			data-slot="snap-sheet-handle"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={cn(
				"group/handle mx-auto flex h-6 w-16 shrink-0 cursor-grab touch-none items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-data-[sheet-state=dragging]/sheet:cursor-grabbing",
				className,
			)}
			{...props}
		>
			<span className="h-[5px] w-9 rounded-full bg-muted-foreground/35 transition-[width,background-color] duration-200 ease-out group-hover/handle:bg-muted-foreground/50 group-data-[sheet-state=dragging]/sheet:w-11 group-data-[sheet-state=dragging]/sheet:bg-muted-foreground/60" />
		</button>
	);
}

function SnapSheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="snap-sheet-title"
			className={cn("font-semibold text-base text-foreground", className)}
			{...props}
		/>
	);
}

function SnapSheetDescription({
	className,
	...props
}: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="snap-sheet-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function SnapSheetClose({
	className,
	children,
	...props
}: DialogPrimitive.Close.Props) {
	return (
		<DialogPrimitive.Close
			data-slot="snap-sheet-close"
			className={cn(
				!children &&
					"inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
				className,
			)}
			{...props}
		>
			{children ?? (
				<>
					<XIcon className="size-4" />
					<span className="sr-only">Close</span>
				</>
			)}
		</DialogPrimitive.Close>
	);
}

SnapSheet.Trigger = SnapSheetTrigger;
SnapSheet.Content = SnapSheetContent;
SnapSheet.Handle = SnapSheetHandle;
SnapSheet.Title = SnapSheetTitle;
SnapSheet.Description = SnapSheetDescription;
SnapSheet.Close = SnapSheetClose;

export {
	SnapSheet,
	SnapSheetClose,
	SnapSheetContent,
	SnapSheetDescription,
	SnapSheetHandle,
	SnapSheetTitle,
	SnapSheetTrigger,
};

export default SnapSheet;
