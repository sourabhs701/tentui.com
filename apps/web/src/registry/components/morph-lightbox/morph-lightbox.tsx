"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	type AnimationPlaybackControls,
	animate,
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	createContext,
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
import { createPortal, flushSync } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Motion. The photo itself rides one 0 → 1 progress per flight; the scrim and
// the chrome (toolbar, neighbours, caption, filmstrip) fade on their own clocks.
const openSpring = { type: "spring", stiffness: 300, damping: 32 } as const;
const closeSpring = { type: "spring", duration: 0.32, bounce: 0 } as const;
const returnSpring = { type: "spring", stiffness: 380, damping: 34 } as const;
const slideSpring = { type: "spring", duration: 0.42, bounce: 0 } as const;
const filmstripSpring = { type: "spring", duration: 0.36, bounce: 0 } as const;
/** Off-screen thumbnails get a short scale and fade instead of a morph. */
const offscreenTween = {
	type: "tween",
	duration: 0.22,
	ease: [0.2, 0, 0, 1],
} as const;
const SCRIM_IN = 0.24;
const SCRIM_OUT = 0.22;
const CHROME_DELAY = 0.12;
const CHROME_IN = 0.2;
const CHROME_OUT = 0.12;
/** Reduced motion opens, closes, and dismisses with this cross-fade. */
const REDUCED_FADE = 0.15;
const ROLL_DURATION = 0.26;
const ROLL_STAGGER = 0.03;
const ROLL_EASE = [0.3, 0.7, 0.2, 1] as const;

// Shape.
/** Corner radius of an open slide, in px. Thumbnails keep their own. */
const SLIDE_RADIUS = 6;
/** Used when a thumbnail's own radius can't be read. */
const THUMB_RADIUS = 12;
/** Scale an off-screen flight starts from or ends at. */
const OFFSCREEN_SCALE = 0.92;

// Pull to dismiss.
/** Pointer travel, in px, before a press picks an axis. */
const AXIS_SLOP = 8;
/** Downward travel, in px, past which a release closes the viewer. */
const DISMISS_DISTANCE = 120;
/** Downward release speed, in px/s, that closes the viewer from anywhere. */
const DISMISS_VELOCITY = 600;
/** The photo shrinks to this scale by `SHRINK_RANGE` of the viewport height. */
const MIN_SCALE = 0.75;
const SHRINK_RANGE = 0.4;
/** Scrim opacity at full shrink. */
const MIN_SCRIM = 0.2;
/** Share of an upward drag the photo follows. */
const RUBBER_BAND = 0.25;
/** Ms without a wheel event before a trackpad pull counts as released. */
const WHEEL_IDLE = 140;
/** Ms of samples used for the release speed. */
const VELOCITY_WINDOW = 100;
/** Ms after the last scroll event that counts as settled, where `scrollend` is missing. */
const SCROLL_IDLE = 120;

/** A soft breath of air as the photo lifts out of the grid. */
const LIFT_SOUND = {
	name: "morph-lightbox-lift",
	baseFreq: 440,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 900,
	filterQ: 0.7,
	attack: 0.004,
	decay: 1.4,
	brightness: 2000,
} as const;
/** A muted tap as the photo settles back into its cell. */
const SETTLE_SOUND = {
	name: "morph-lightbox-settle",
	baseFreq: 440,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 1500,
	filterQ: 1.2,
	attack: 0.002,
	decay: 0.8,
	brightness: 2000,
} as const;

export interface MorphLightboxItem {
	/** Full-size image shown in the viewer. */
	src: string;
	/** Describes the photo. It names the slide and the thumbnail button. */
	alt: string;
	/** Intrinsic width; with `height` it sets the slide's aspect ratio. */
	width: number;
	height: number;
	/** Shown under the slide and read as the slide's description. */
	caption?: ReactNode;
	/** Smaller image for thumbnails and the filmstrip. Defaults to `src`. */
	thumbnailSrc?: string;
}

export interface MorphLightboxProps {
	items: MorphLightboxItem[];
	/** Controlled slide index. */
	index?: number;
	/** Slide shown first when uncontrolled. */
	defaultIndex?: number;
	/** Called when a swipe, key, or click lands on another slide. */
	onIndexChange?: (index: number) => void;
	/** Controlled open state. */
	open?: boolean;
	/** Initial open state when uncontrolled. Opens without the morph. */
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Wrap from the last slide to the first with keys and buttons. */
	loop?: boolean;
	/** Show a strip of thumbnails under the slide. */
	filmstrip?: boolean;
	/** Play a soft lift on open and a settle when the photo lands on close. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Classes for the viewer, the full-screen dialog. */
	className?: string;
	/** Your grid of `MorphLightboxTrigger`s, or any other content. */
	children?: ReactNode;
}

type Rect = { x: number; y: number; width: number; height: number };
type Phase =
	| "closed"
	| "opening"
	| "open"
	| "dragging"
	| "returning"
	| "closing";
type Drag = {
	/** The slide's rect when the drag began. */
	base: Rect;
	/** Point the photo scales around: the grab point, or the slide centre. */
	originX: number;
	originY: number;
	dx: number;
	dy: number;
	wheel: boolean;
	past: boolean;
	samples: { t: number; y: number }[];
};
type PointerGesture = {
	pointerId: number;
	startX: number;
	startY: number;
	decided: "dismiss" | "scroll" | null;
};
type Flight = {
	from: Rect;
	to: Rect;
	fromRadius: number;
	toRadius: number;
	fromOpacity?: number;
	toOpacity?: number;
	transition:
		| typeof openSpring
		| typeof closeSpring
		| typeof returnSpring
		| typeof offscreenTween;
	velocity?: number;
	onComplete: () => void;
};

type MorphLightboxContextValue = {
	items: MorphLightboxItem[];
	hiddenIndex: number | null;
	register: (index: number, node: HTMLElement | null) => void;
	openAt: (index: number) => void;
	preload: (index: number) => void;
};

const MorphLightboxContext = createContext<MorphLightboxContextValue | null>(
	null,
);

function useMorphLightbox() {
	const context = useContext(MorphLightboxContext);
	if (!context) {
		throw new Error(
			"MorphLightboxTrigger must be rendered inside <MorphLightbox>.",
		);
	}
	return context;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function mix(from: number, to: number, amount: number) {
	return from + (to - from) * amount;
}

function mixRect(from: Rect, to: Rect, amount: number): Rect {
	return {
		x: mix(from.x, to.x, amount),
		y: mix(from.y, to.y, amount),
		width: mix(from.width, to.width, amount),
		height: mix(from.height, to.height, amount),
	};
}

function scaleRect(rect: Rect, scale: number): Rect {
	const width = rect.width * scale;
	const height = rect.height * scale;
	return {
		x: rect.x + (rect.width - width) / 2,
		y: rect.y + (rect.height - height) / 2,
		width,
		height,
	};
}

function rectOf(element: Element): Rect {
	const { left, top, width, height } = element.getBoundingClientRect();
	return { x: left, y: top, width, height };
}

function centerX(element: Element) {
	const { left, width } = element.getBoundingClientRect();
	return left + width / 2;
}

function onScreen(rect: Rect) {
	return (
		rect.width > 0 &&
		rect.height > 0 &&
		rect.x + rect.width > 0 &&
		rect.y + rect.height > 0 &&
		rect.x < window.innerWidth &&
		rect.y < window.innerHeight
	);
}

function radiusOf(element: Element) {
	const radius = Number.parseFloat(
		getComputedStyle(element).borderTopLeftRadius,
	);
	return Number.isFinite(radius) ? radius : THUMB_RADIUS;
}

/** Px/s over the last `VELOCITY_WINDOW` ms of samples. */
function velocityOf(samples: { t: number; y: number }[]) {
	const last = samples[samples.length - 1];
	if (!last) return 0;
	const first =
		samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW) ?? last;
	const elapsed = last.t - first.t;
	return elapsed > 0 ? ((last.y - first.y) / elapsed) * 1000 : 0;
}

/** Locks page scroll, keeping the scrollbar's gutter so nothing shifts. */
function lockScroll() {
	const root = document.documentElement;
	const { overflow, scrollbarGutter } = root.style;
	const gutter = window.innerWidth - root.clientWidth;
	if (gutter > 0 && getComputedStyle(root).scrollbarGutter === "auto") {
		root.style.scrollbarGutter = "stable";
	}
	root.style.overflow = "hidden";
	return () => {
		root.style.overflow = overflow;
		root.style.scrollbarGutter = scrollbarGutter;
	};
}

/** Makes everything but `keep` inert, so focus and clicks stay in the viewer. */
function inertOthers(keep: Element) {
	const changed: Element[] = [];
	for (const element of Array.from(document.body.children)) {
		if (element === keep || element.hasAttribute("inert")) continue;
		if (element.tagName === "SCRIPT" || element.tagName === "STYLE") continue;
		element.setAttribute("inert", "");
		changed.push(element);
	}
	return () => {
		for (const element of changed) element.removeAttribute("inert");
	};
}

function silent() {
	return document.visibilityState === "hidden";
}

function MorphLightbox({
	items,
	index: indexProp,
	defaultIndex = 0,
	onIndexChange,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	loop = false,
	filmstrip = true,
	sound = true,
	haptics = true,
	className,
	children,
}: MorphLightboxProps) {
	const count = items.length;
	const lastIndex = Math.max(0, count - 1);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const open = (openProp ?? uncontrolledOpen) && count > 0;
	const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
	const index = clamp(indexProp ?? uncontrolledIndex, 0, lastIndex);

	// Stays mounted through the close flight, then unmounts.
	const [rendered, setRendered] = useState(open);
	/** The slide in view, read from the track's scroll position. */
	const [current, setCurrent] = useState(index);
	const userOpenRef = useRef(false);
	if (open && !rendered) {
		setRendered(true);
		if (!userOpenRef.current) setCurrent(index);
	}
	const shownIndex = clamp(current, 0, lastIndex);

	// The viewer portals into `document.body`, which only exists after hydration.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const [announcement, setAnnouncement] = useState("");
	/** Which way the counter rolls: 1 forward, -1 back. */
	const [direction, setDirection] = useState(1);
	const [viewer, setViewer] = useState<HTMLDivElement | null>(null);

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { swoosh: playLift } = useTiks({
		theme: LIFT_SOUND,
		respectReducedMotion: false,
	});
	const { click: playSettle } = useTiks({
		theme: SETTLE_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const slideId = (slide: number) => `morph-lightbox-${ids}-slide-${slide}`;
	const captionId = (slide: number) => `morph-lightbox-${ids}-caption-${slide}`;

	const scrim = useMotionValue(0);
	const chrome = useMotionValue(0);
	const fade = useMotionValue(1);
	const outlineX = useMotionValue(0);

	const triggersRef = useRef(new Map<number, HTMLElement>());
	const slidesRef = useRef<(HTMLDivElement | null)[]>([]);
	const framesRef = useRef<(HTMLDivElement | null)[]>([]);
	const thumbsRef = useRef<(HTMLButtonElement | null)[]>([]);
	const trackRef = useRef<HTMLDivElement | null>(null);
	const filmstripRef = useRef<HTMLDivElement | null>(null);
	const filmRowRef = useRef<HTMLDivElement | null>(null);
	const flyerRef = useRef<HTMLDivElement | null>(null);

	const phaseRef = useRef<Phase>("closed");
	const currentRef = useRef(current);
	const rtlRef = useRef(false);
	const instantOpenRef = useRef(open);
	const releaseRef = useRef<(() => void) | null>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const flightRef = useRef<AnimationPlaybackControls | null>(null);
	const scrimAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const chromeAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const fadeAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const scrollAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const filmAnimRef = useRef<AnimationPlaybackControls | null>(null);
	/** Where the flyer is drawn now, or null when the slide shows itself. */
	const flyerStateRef = useRef<{
		rect: Rect;
		radius: number;
		opacity: number;
	} | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const gestureRef = useRef<PointerGesture | null>(null);
	const wheelTimerRef = useRef<number | undefined>(undefined);
	const scrollTimerRef = useRef<number | undefined>(undefined);
	/** Slide a touch swipe started on, for the snap haptic. */
	const swipeRef = useRef<number | null>(null);
	const suppressClickRef = useRef(false);
	/** Slides that have been near the current one, so their images stay loaded. */
	const seenRef = useRef(new Set<number>());

	// Latest values for the imperative handlers below, so they never re-bind.
	const latest = useRef({
		items,
		open,
		indexProp,
		loop,
		sound,
		haptics,
		reducedMotion,
		onIndexChange,
		onOpenChange,
	});
	useLayoutEffect(() => {
		latest.current = {
			items,
			open,
			indexProp,
			loop,
			sound,
			haptics,
			reducedMotion,
			onIndexChange,
			onOpenChange,
		};
	});

	const setPhase = useCallback(
		(phase: Phase) => {
			phaseRef.current = phase;
			if (viewer) viewer.dataset.phase = phase;
		},
		[viewer],
	);

	const fadeTo = useCallback(
		(
			ref: { current: AnimationPlaybackControls | null },
			value: MotionValue<number>,
			to: number,
			duration: number,
			delay = 0,
			onComplete?: () => void,
		) => {
			ref.current?.stop();
			ref.current = animate(value, to, {
				duration,
				delay,
				ease: "easeOut",
				onComplete: () => {
					ref.current = null;
					onComplete?.();
				},
			});
		},
		[],
	);

	const drawFlyer = useCallback((rect: Rect, radius: number, opacity = 1) => {
		const flyer = flyerRef.current;
		if (!flyer) return;
		flyerStateRef.current = { rect, radius, opacity };
		flyer.style.visibility = "visible";
		flyer.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
		flyer.style.width = `${rect.width}px`;
		flyer.style.height = `${rect.height}px`;
		flyer.style.borderRadius = `${radius}px`;
		flyer.style.opacity = String(opacity);
	}, []);

	const hideFlyer = useCallback(() => {
		flightRef.current?.stop();
		flightRef.current = null;
		flyerStateRef.current = null;
		const flyer = flyerRef.current;
		if (flyer) flyer.style.visibility = "hidden";
	}, []);

	/** Hides the real slide while the flyer stands in for it. */
	const setSlideHidden = useCallback((slide: number, hidden: boolean) => {
		const frame = framesRef.current[slide];
		if (frame) frame.style.visibility = hidden ? "hidden" : "";
	}, []);

	const fly = useCallback(
		({
			from,
			to,
			fromRadius,
			toRadius,
			fromOpacity = 1,
			toOpacity = 1,
			transition,
			velocity = 0,
			onComplete,
		}: Flight) => {
			flightRef.current?.stop();
			drawFlyer(from, fromRadius, fromOpacity);
			flightRef.current = animate(0, 1, {
				...transition,
				...(transition.type === "spring"
					? { velocity, restDelta: 0.001, restSpeed: 0.01 }
					: {}),
				onUpdate: (amount) =>
					drawFlyer(
						mixRect(from, to, amount),
						mix(fromRadius, toRadius, amount),
						mix(fromOpacity, toOpacity, amount),
					),
				onComplete: () => {
					flightRef.current = null;
					onComplete();
				},
			});
		},
		[drawFlyer],
	);

	const stopScroll = useCallback(() => {
		scrollAnimRef.current?.stop();
		scrollAnimRef.current = null;
		if (trackRef.current) trackRef.current.style.scrollSnapType = "";
	}, []);

	/** Records a new current slide and tells whoever listens. */
	const commitCurrent = useCallback(
		(next: number, step: number, report = true) => {
			if (next === currentRef.current) return;
			const { items, indexProp, onIndexChange } = latest.current;
			currentRef.current = next;
			setDirection(step);
			setCurrent(next);
			setAnnouncement(
				`Image ${next + 1} of ${items.length}: ${items[next]?.alt ?? ""}`,
			);
			if (indexProp === undefined) setUncontrolledIndex(next);
			if (report) onIndexChange?.(next);
		},
		[],
	);

	/** Picks the slide whose centre is nearest the track's centre. */
	const nearestSlide = useCallback(() => {
		const track = trackRef.current;
		if (!track) return currentRef.current;
		const middle = centerX(track);
		let nearest = currentRef.current;
		let distance = Number.POSITIVE_INFINITY;
		slidesRef.current.forEach((slide, slideIndex) => {
			if (!slide) return;
			const gap = Math.abs(centerX(slide) - middle);
			if (gap < distance) {
				distance = gap;
				nearest = slideIndex;
			}
		});
		return nearest;
	}, []);

	const settleScroll = useCallback(() => {
		window.clearTimeout(scrollTimerRef.current);
		if (scrollAnimRef.current) return;
		const phase = phaseRef.current;
		if (phase !== "open") return;
		const next = nearestSlide();
		const started = swipeRef.current;
		swipeRef.current = null;
		commitCurrent(next, next > currentRef.current ? 1 : -1);
		if (
			started !== null &&
			started !== next &&
			latest.current.haptics &&
			!silent()
		) {
			void haptic("selection");
		}
	}, [commitCurrent, haptic, nearestSlide]);

	const scrollToSlide = useCallback(
		(slide: number, animated: boolean) => {
			const track = trackRef.current;
			const target = slidesRef.current[slide];
			if (!track || !target) return;
			stopScroll();
			const delta = centerX(target) - centerX(track);
			// `snap-always` would stop a jump at the first slide on the way, and
			// mandatory snapping would pull every frame of a glide back to a slide.
			track.style.scrollSnapType = "none";
			if (!animated || Math.abs(delta) < 1) {
				track.scrollBy({ left: delta, behavior: "instant" });
				track.style.scrollSnapType = "";
				return;
			}
			const from = track.scrollLeft;
			scrollAnimRef.current = animate(from, from + delta, {
				...slideSpring,
				onUpdate: (left) => {
					track.scrollLeft = left;
				},
				onComplete: () => {
					scrollAnimRef.current = null;
					track.style.scrollSnapType = "";
				},
			});
		},
		[stopScroll],
	);

	const goTo = useCallback(
		(requested: number, report = true) => {
			if (phaseRef.current !== "open") return;
			const total = latest.current.items.length;
			if (total < 2) return;
			const from = currentRef.current;
			const next = latest.current.loop
				? (requested + total) % total
				: clamp(requested, 0, total - 1);
			if (next === from) return;
			// Wrapping past an end still rolls the way the user went.
			const step =
				requested !== next ? (requested > from ? 1 : -1) : next > from ? 1 : -1;
			swipeRef.current = null;
			commitCurrent(next, step, report);
			scrollToSlide(next, !latest.current.reducedMotion);
		},
		[commitCurrent, scrollToSlide],
	);

	const setOpenState = useCallback((next: boolean) => {
		if (latest.current.open === next) return;
		setUncontrolledOpen(next);
		latest.current.onOpenChange?.(next);
	}, []);

	const finishClose = useCallback(
		(cue: boolean) => {
			setPhase("closed");
			hideFlyer();
			stopScroll();
			releaseRef.current?.();
			releaseRef.current = null;
			flushSync(() => setRendered(false));
			const trigger = triggersRef.current.get(currentRef.current);
			const target =
				trigger?.isConnected && trigger.offsetParent !== null
					? trigger
					: returnFocusRef.current;
			returnFocusRef.current = null;
			target?.focus({ preventScroll: true });
			scrim.jump(0);
			chrome.jump(0);
			fade.jump(1);
			if (cue && latest.current.sound && !silent()) playSettle();
		},
		[chrome, fade, hideFlyer, playSettle, scrim, setPhase, stopScroll],
	);

	const beginClose = useCallback(
		(cue: boolean, velocity = 0) => {
			const phase = phaseRef.current;
			if (phase === "closed" || phase === "closing") return;
			setPhase("closing");
			window.clearTimeout(wheelTimerRef.current);
			dragRef.current = null;
			gestureRef.current = null;
			stopScroll();
			const slide = currentRef.current;
			fadeTo(chromeAnimRef, chrome, 0, CHROME_OUT);
			fadeTo(scrimAnimRef, scrim, 0, SCRIM_OUT);
			if (latest.current.reducedMotion) {
				fadeTo(fadeAnimRef, fade, 0, REDUCED_FADE, 0, () => finishClose(cue));
				return;
			}
			const frame = framesRef.current[slide];
			const flying = flyerStateRef.current;
			const from = flying?.rect ?? (frame ? rectOf(frame) : null);
			if (!from) {
				finishClose(cue);
				return;
			}
			const fromRadius = flying?.radius ?? SLIDE_RADIUS;
			const fromOpacity = flying?.opacity ?? 1;
			setSlideHidden(slide, true);
			const trigger = triggersRef.current.get(slide);
			const to = trigger?.isConnected ? rectOf(trigger) : null;
			if (to && onScreen(to)) {
				// Carry the release speed into the flight, as progress per second.
				const travel = to.y - from.y;
				const progressVelocity =
					Math.abs(travel) > 1 && Math.sign(travel) === Math.sign(velocity)
						? clamp(velocity / travel, 0, 8)
						: 0;
				fly({
					from,
					to,
					fromRadius,
					toRadius: radiusOf(trigger as HTMLElement),
					fromOpacity,
					transition: closeSpring,
					velocity: progressVelocity,
					onComplete: () => finishClose(cue),
				});
				return;
			}
			fly({
				from,
				to: scaleRect(from, OFFSCREEN_SCALE),
				fromRadius,
				toRadius: fromRadius,
				fromOpacity,
				toOpacity: 0,
				transition: offscreenTween,
				onComplete: () => finishClose(cue),
			});
		},
		[
			chrome,
			fade,
			fadeTo,
			finishClose,
			fly,
			scrim,
			setPhase,
			setSlideHidden,
			stopScroll,
		],
	);

	/** Closes from user input: plays the settle and reports the change. */
	const requestClose = useCallback(
		(velocity = 0) => {
			const phase = phaseRef.current;
			if (phase === "closed" || phase === "closing") return;
			setOpenState(false);
			beginClose(true, velocity);
		},
		[beginClose, setOpenState],
	);

	const startOpen = useCallback(() => {
		const root = viewer;
		if (!root) return;
		const slide = currentRef.current;
		setPhase("opening");
		seenRef.current.clear();

		// The viewer is portaled out of the page, so it copies the page's direction.
		const trigger = triggersRef.current.get(slide);
		const source = trigger ?? triggersRef.current.values().next().value;
		const dir = getComputedStyle(source ?? document.documentElement).direction;
		root.dir = dir === "rtl" ? "rtl" : "ltr";
		rtlRef.current = dir === "rtl";

		const active = document.activeElement;
		returnFocusRef.current =
			active instanceof HTMLElement && active !== document.body ? active : null;
		const unlock = lockScroll();
		const restore = inertOthers(root);
		releaseRef.current = () => {
			unlock();
			restore();
		};
		scrollToSlide(slide, false);
		root.focus({ preventScroll: true });

		const cue = userOpenRef.current;
		userOpenRef.current = false;
		if (cue && latest.current.sound && !silent()) playLift();

		const land = () => {
			setSlideHidden(slide, false);
			hideFlyer();
			setPhase("open");
		};

		if (instantOpenRef.current) {
			instantOpenRef.current = false;
			scrim.jump(1);
			chrome.jump(1);
			fade.jump(1);
			setPhase("open");
			return;
		}
		if (latest.current.reducedMotion) {
			scrim.jump(1);
			chrome.jump(1);
			fade.jump(0);
			fadeTo(fadeAnimRef, fade, 1, REDUCED_FADE, 0, () => setPhase("open"));
			return;
		}

		fade.jump(1);
		scrim.jump(0);
		chrome.jump(0);
		fadeTo(scrimAnimRef, scrim, 1, SCRIM_IN);
		fadeTo(chromeAnimRef, chrome, 1, CHROME_IN, CHROME_DELAY);
		const frame = framesRef.current[slide];
		if (!frame) {
			setPhase("open");
			return;
		}
		const to = rectOf(frame);
		const from = trigger?.isConnected ? rectOf(trigger) : null;
		setSlideHidden(slide, true);
		if (from && onScreen(from)) {
			fly({
				from,
				to,
				fromRadius: radiusOf(trigger as HTMLElement),
				toRadius: SLIDE_RADIUS,
				transition: openSpring,
				onComplete: land,
			});
			return;
		}
		fly({
			from: scaleRect(to, OFFSCREEN_SCALE),
			to,
			fromRadius: SLIDE_RADIUS,
			toRadius: SLIDE_RADIUS,
			fromOpacity: 0,
			toOpacity: 1,
			transition: offscreenTween,
			onComplete: land,
		});
	}, [
		chrome,
		fade,
		fadeTo,
		fly,
		hideFlyer,
		playLift,
		scrim,
		scrollToSlide,
		setPhase,
		setSlideHidden,
		viewer,
	]);

	// Open and close from state, whether it changed here or through props.
	useLayoutEffect(() => {
		if (!viewer) return;
		const phase = phaseRef.current;
		if (open) {
			if (phase === "closed") startOpen();
			return;
		}
		// Closes that come through props are silent.
		if (phase !== "closed" && phase !== "closing") beginClose(false);
	}, [open, viewer, startOpen, beginClose]);

	// A controlled index that changes while open glides there.
	useEffect(() => {
		if (indexProp === undefined || !viewer) return;
		const next = clamp(indexProp, 0, lastIndex);
		if (next === currentRef.current) return;
		goTo(next, false);
	}, [indexProp, lastIndex, viewer, goTo]);

	// Keep the filmstrip's current thumbnail centred and outlined.
	useLayoutEffect(() => {
		if (!viewer) return;
		const strip = filmstripRef.current;
		const row = filmRowRef.current;
		const thumb = thumbsRef.current[shownIndex];
		const visual = thumb?.firstElementChild;
		if (!strip || !row || !thumb || !visual) return;
		// Arrow keys on the filmstrip carry focus along with the outline.
		const active = document.activeElement;
		if (active !== thumb && thumbsRef.current.includes(active as never)) {
			thumb.focus({ preventScroll: true });
		}
		const instant =
			phaseRef.current === "opening" || latest.current.reducedMotion;
		const x =
			visual.getBoundingClientRect().left - row.getBoundingClientRect().left;
		filmAnimRef.current?.stop();
		const delta = centerX(thumb) - centerX(strip);
		if (instant) {
			outlineX.jump(x);
			strip.scrollBy({ left: delta, behavior: "instant" });
			return;
		}
		animate(outlineX, x, filmstripSpring);
		const from = strip.scrollLeft;
		const max = strip.scrollWidth - strip.clientWidth;
		const to = rtlRef.current
			? clamp(from + delta, -max, 0)
			: clamp(from + delta, 0, max);
		if (Math.abs(to - from) < 1) return;
		filmAnimRef.current = animate(from, to, {
			...filmstripSpring,
			onUpdate: (left) => {
				strip.scrollLeft = left;
			},
		});
	}, [viewer, shownIndex, outlineX]);

	// Release everything if the lightbox unmounts while open.
	useEffect(
		() => () => {
			releaseRef.current?.();
			releaseRef.current = null;
			window.clearTimeout(wheelTimerRef.current);
			window.clearTimeout(scrollTimerRef.current);
		},
		[],
	);

	const beginDrag = useCallback(
		(drag: Drag) => {
			setPhase("dragging");
			stopScroll();
			swipeRef.current = null;
			dragRef.current = drag;
			if (!latest.current.reducedMotion) {
				setSlideHidden(currentRef.current, true);
				drawFlyer(drag.base, SLIDE_RADIUS);
			}
			fadeTo(chromeAnimRef, chrome, 0, CHROME_OUT);
		},
		[chrome, drawFlyer, fadeTo, setPhase, setSlideHidden, stopScroll],
	);

	const updateDrag = useCallback(
		(drag: Drag, dx: number, dy: number, time: number) => {
			drag.dx = dx;
			drag.dy = dy;
			drag.samples.push({ t: time, y: dy });
			if (drag.samples.length > 12) drag.samples.shift();
			const travel = drag.wheel ? Math.abs(dy) : Math.max(dy, 0);
			const amount = clamp(travel / (SHRINK_RANGE * window.innerHeight), 0, 1);
			scrim.set(1 - (1 - MIN_SCRIM) * amount);
			const past = travel > DISMISS_DISTANCE;
			if (past && !drag.past && latest.current.haptics && !silent()) {
				void haptic("light");
			}
			drag.past = past;
			if (latest.current.reducedMotion) {
				fade.set(1 - 0.4 * amount);
				return;
			}
			// Shrink around the grab point, so the photo stays under the finger.
			const scale = 1 - (1 - MIN_SCALE) * amount;
			const y = !drag.wheel && dy < 0 ? dy * RUBBER_BAND : dy;
			const { base, originX, originY } = drag;
			drawFlyer(
				{
					x: originX + dx + (base.x - originX) * scale,
					y: originY + y + (base.y - originY) * scale,
					width: base.width * scale,
					height: base.height * scale,
				},
				SLIDE_RADIUS,
			);
		},
		[drawFlyer, fade, haptic, scrim],
	);

	const springBack = useCallback(() => {
		const slide = currentRef.current;
		dragRef.current = null;
		setPhase("returning");
		fadeTo(scrimAnimRef, scrim, 1, CHROME_IN);
		fadeTo(chromeAnimRef, chrome, 1, CHROME_IN);
		if (latest.current.reducedMotion) {
			fadeTo(fadeAnimRef, fade, 1, REDUCED_FADE, 0, () => setPhase("open"));
			return;
		}
		const frame = framesRef.current[slide];
		const flying = flyerStateRef.current;
		if (!frame || !flying) {
			setSlideHidden(slide, false);
			hideFlyer();
			setPhase("open");
			return;
		}
		fly({
			from: flying.rect,
			to: rectOf(frame),
			fromRadius: flying.radius,
			toRadius: SLIDE_RADIUS,
			transition: returnSpring,
			onComplete: () => {
				setSlideHidden(slide, false);
				hideFlyer();
				setPhase("open");
			},
		});
	}, [chrome, fade, fadeTo, fly, hideFlyer, scrim, setPhase, setSlideHidden]);

	const releaseDrag = useCallback(
		(drag: Drag) => {
			const velocity = velocityOf(drag.samples);
			const travel = drag.wheel ? Math.abs(drag.dy) : drag.dy;
			// Wheel deltas arrive fast even for a short pull, and a real flick's
			// momentum carries it past the distance anyway, so wheels go by distance.
			if (
				travel > DISMISS_DISTANCE ||
				(!drag.wheel && travel > 0 && velocity > DISMISS_VELOCITY)
			) {
				requestClose(velocity);
				return;
			}
			springBack();
		},
		[requestClose, springBack],
	);

	// Trackpads: a two-finger vertical swipe pulls the photo like a drag.
	useEffect(() => {
		if (!viewer) return;
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey) return;
			let drag = dragRef.current;
			if (!drag?.wheel) {
				if (phaseRef.current !== "open") {
					if (phaseRef.current !== "closed") event.preventDefault();
					return;
				}
				// Sideways swipes belong to the native scroller.
				if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
				const frame = framesRef.current[currentRef.current];
				if (!frame) return;
				const base = rectOf(frame);
				drag = {
					base,
					originX: base.x + base.width / 2,
					originY: base.y + base.height / 2,
					dx: 0,
					dy: 0,
					wheel: true,
					past: false,
					samples: [{ t: event.timeStamp, y: 0 }],
				};
				beginDrag(drag);
			}
			event.preventDefault();
			const unit =
				event.deltaMode === 1
					? 16
					: event.deltaMode === 2
						? window.innerHeight
						: 1;
			updateDrag(drag, 0, drag.dy - event.deltaY * unit, event.timeStamp);
			window.clearTimeout(wheelTimerRef.current);
			// Close as soon as the pull is far enough; momentum would only lag it.
			if (Math.abs(drag.dy) > DISMISS_DISTANCE) {
				requestClose(velocityOf(drag.samples));
				return;
			}
			const pulled = drag;
			wheelTimerRef.current = window.setTimeout(() => {
				if (dragRef.current === pulled) releaseDrag(pulled);
			}, WHEEL_IDLE);
		};
		const onScrollEnd = () => settleScroll();
		viewer.addEventListener("wheel", onWheel, { passive: false });
		const track = trackRef.current;
		track?.addEventListener("scrollend", onScrollEnd);
		return () => {
			viewer.removeEventListener("wheel", onWheel);
			track?.removeEventListener("scrollend", onScrollEnd);
		};
	}, [viewer, beginDrag, updateDrag, releaseDrag, requestClose, settleScroll]);

	const handleTrackScroll = () => {
		const phase = phaseRef.current;
		if (scrollAnimRef.current || phase !== "open") return;
		const next = nearestSlide();
		if (next !== currentRef.current) {
			commitCurrent(next, next > currentRef.current ? 1 : -1);
		}
		window.clearTimeout(scrollTimerRef.current);
		scrollTimerRef.current = window.setTimeout(settleScroll, SCROLL_IDLE);
	};

	const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!event.isPrimary) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		stopScroll();
		if (phaseRef.current !== "open") return;
		swipeRef.current =
			event.pointerType === "touch" ? currentRef.current : null;
		gestureRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			decided: null,
		};
	};

	const handleTrackPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;
		const dx = event.clientX - gesture.startX;
		const dy = event.clientY - gesture.startY;
		if (gesture.decided === null) {
			if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
			// Axis lock: sideways belongs to native scrolling.
			if (Math.abs(dx) >= Math.abs(dy) || phaseRef.current !== "open") {
				gesture.decided = "scroll";
				return;
			}
			const frame = framesRef.current[currentRef.current];
			if (!frame) return;
			gesture.decided = "dismiss";
			suppressClickRef.current = true;
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {
				// The pointer may already be gone.
			}
			window.getSelection()?.removeAllRanges();
			beginDrag({
				base: rectOf(frame),
				originX: gesture.startX,
				originY: gesture.startY,
				dx: 0,
				dy: 0,
				wheel: false,
				past: false,
				samples: [{ t: event.timeStamp, y: 0 }],
			});
		}
		const drag = dragRef.current;
		if (gesture.decided !== "dismiss" || !drag) return;
		updateDrag(drag, dx, dy, event.timeStamp);
	};

	const handleTrackPointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;
		gestureRef.current = null;
		const drag = dragRef.current;
		if (gesture.decided !== "dismiss" || !drag) return;
		if (event.type === "pointercancel") {
			springBack();
			return;
		}
		releaseDrag(drag);
	};

	const handleClick = (event: MouseEvent<HTMLDivElement>) => {
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}
		const phase = phaseRef.current;
		if (phase !== "open") return;
		const target = event.target as HTMLElement;
		// A neighbour comes to the centre; the current photo stays put.
		const photo = target.closest<HTMLElement>("[data-slide]");
		if (photo) {
			const slide = Number(photo.dataset.slide);
			if (slide !== currentRef.current) goTo(slide);
			return;
		}
		if (target.closest("button, [data-slot='morph-lightbox-caption']")) return;
		// Anywhere else is the backdrop.
		requestClose();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const phase = phaseRef.current;
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			requestClose();
			return;
		}
		if (event.key === "Tab") {
			// Keep focus inside the dialog.
			const root = event.currentTarget;
			const focusable = Array.from(
				root.querySelectorAll<HTMLElement>(
					"button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
				),
			).filter((element) => element.tabIndex >= 0);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first || !last) {
				event.preventDefault();
				return;
			}
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === root)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
			return;
		}
		if (phase !== "open") return;
		const forward = rtlRef.current ? "ArrowLeft" : "ArrowRight";
		const back = rtlRef.current ? "ArrowRight" : "ArrowLeft";
		const targets: Record<string, number> = {
			[forward]: currentRef.current + 1,
			[back]: currentRef.current - 1,
			Home: 0,
			End: count - 1,
		};
		const target = targets[event.key];
		if (target === undefined) return;
		event.preventDefault();
		goTo(target);
	};

	const register = useCallback((slide: number, node: HTMLElement | null) => {
		if (node) triggersRef.current.set(slide, node);
		else triggersRef.current.delete(slide);
	}, []);

	const openAt = useCallback(
		(slide: number) => {
			if (phaseRef.current !== "closed") return;
			const { items, indexProp, onIndexChange } = latest.current;
			if (!items[slide]) return;
			userOpenRef.current = true;
			currentRef.current = slide;
			setCurrent(slide);
			setDirection(1);
			if (indexProp === undefined) setUncontrolledIndex(slide);
			if (slide !== indexProp) onIndexChange?.(slide);
			setOpenState(true);
		},
		[setOpenState],
	);

	const preload = useCallback((slide: number) => {
		const item = latest.current.items[slide];
		if (!item) return;
		const image = new Image();
		image.decoding = "async";
		image.src = item.src;
	}, []);

	// The thumbnail of the photo in the viewer hides, so it's never seen twice.
	const hiddenIndex = rendered ? shownIndex : null;
	const contextValue = useMemo(
		() => ({ items, hiddenIndex, register, openAt, preload }),
		[items, hiddenIndex, register, openAt, preload],
	);

	// Opens that come through props jump straight to the slide. This render
	// still shows the old slide, so read the target from props.
	if (!rendered) {
		currentRef.current =
			open && !userOpenRef.current ? clamp(index, 0, lastIndex) : shownIndex;
	}

	const multiple = count > 1;
	const hasCaptions = items.some((item) => item.caption != null);
	const currentItem = items[shownIndex];
	for (let near = shownIndex - 1; near <= shownIndex + 1; near++) {
		if (near >= 0 && near < count) seenRef.current.add(near);
	}
	/** A slide's width: the photo's fitted width, at most the max slide width. */
	const slideWidth = (item: MorphLightboxItem) =>
		`min(var(--morph-lightbox-max), calc(100cqh * ${item.width / item.height}))`;
	const firstItem = items[0];
	const lastItem = items[lastIndex];

	const viewerNode =
		rendered && mounted && currentItem && firstItem && lastItem ? (
			<div
				ref={setViewer}
				role="dialog"
				aria-modal="true"
				aria-label="Image viewer"
				aria-describedby={
					currentItem.caption != null
						? `${slideId(shownIndex)} ${captionId(shownIndex)}`
						: slideId(shownIndex)
				}
				tabIndex={-1}
				data-slot="morph-lightbox"
				onKeyDown={handleKeyDown}
				onClick={handleClick}
				className={cn(
					"fixed inset-0 z-50 select-none overflow-hidden overscroll-contain text-foreground outline-none data-[phase=closing]:pointer-events-none",
					className,
				)}
			>
				<motion.div style={{ opacity: fade }} className="absolute inset-0">
					<motion.div
						aria-hidden
						data-slot="morph-lightbox-scrim"
						style={{ opacity: scrim }}
						className="absolute inset-0 bg-background/96 backdrop-blur-[8px]"
					/>
					<div className="relative flex h-full flex-col">
						<motion.div
							style={{ opacity: chrome }}
							className="flex h-12 shrink-0 items-center justify-between gap-2 ps-4 pe-1 sm:h-14 sm:ps-5 sm:pe-2"
						>
							{multiple ? (
								<Counter
									value={shownIndex + 1}
									total={count}
									direction={direction}
									reduced={reducedMotion}
								/>
							) : (
								<span />
							)}
							<button
								type="button"
								aria-label="Close"
								data-slot="morph-lightbox-close"
								onClick={() => requestClose()}
								className="group/close grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none"
							>
								<span className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-foreground/80 transition-colors duration-150 group-hover/close:bg-foreground/10 group-hover/close:text-foreground group-focus-visible/close:ring-2 group-focus-visible/close:ring-foreground group-focus-visible/close:ring-offset-2 group-focus-visible/close:ring-offset-background">
									<svg
										aria-hidden
										viewBox="0 0 16 16"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
										className="size-3.5"
									>
										<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
									</svg>
								</span>
							</button>
						</motion.div>

						<motion.div
							ref={trackRef}
							tabIndex={-1}
							data-slot="morph-lightbox-track"
							style={{ opacity: chrome, touchAction: "pan-x pinch-zoom" }}
							onScroll={handleTrackScroll}
							onPointerDown={handleTrackPointerDown}
							onPointerMove={handleTrackPointerMove}
							onPointerUp={handleTrackPointerUp}
							onPointerCancel={handleTrackPointerUp}
							className="min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain py-2 outline-none [container-type:size] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							<div
								className="flex h-full w-max items-center gap-2 [--morph-lightbox-max:calc(100cqw-16px)] sm:gap-3 sm:[--morph-lightbox-max:80cqw]"
								style={{
									paddingInlineStart: `calc(50cqw - ${slideWidth(firstItem)} / 2)`,
									paddingInlineEnd: `calc(50cqw - ${slideWidth(lastItem)} / 2)`,
								}}
							>
								{items.map((item, slide) => {
									const isCurrent = slide === shownIndex;
									const near = seenRef.current.has(slide);
									return (
										<div
											key={slide}
											ref={(node) => {
												slidesRef.current[slide] = node;
											}}
											aria-hidden={!isCurrent || undefined}
											className="flex h-full shrink-0 snap-center snap-always items-center"
											style={{ width: slideWidth(item) }}
										>
											<div
												ref={(node) => {
													framesRef.current[slide] = node;
												}}
												data-slide={slide}
												data-slot="morph-lightbox-slide"
												data-current={isCurrent}
												className={cn(
													"relative w-full overflow-hidden rounded-[6px] bg-center bg-cover bg-muted transition-opacity duration-200 ease-out data-[current=false]:cursor-pointer data-[current=false]:opacity-40",
												)}
												style={{
													aspectRatio: `${item.width} / ${item.height}`,
													backgroundImage: near
														? `url("${item.thumbnailSrc ?? item.src}")`
														: undefined,
												}}
											>
												{/* biome-ignore lint/performance/noImgElement: plain images keep the component framework-agnostic; sizes come from the items */}
												<img
													id={slideId(slide)}
													src={near ? item.src : undefined}
													alt={item.alt}
													width={item.width}
													height={item.height}
													decoding="async"
													draggable={false}
													className="size-full object-cover"
												/>
											</div>
										</div>
									);
								})}
							</div>
						</motion.div>

						{hasCaptions ? (
							<motion.div
								style={{ opacity: chrome }}
								className="grid min-h-9 shrink-0 place-items-center px-6 pt-1 text-center text-muted-foreground text-sm"
							>
								<AnimatePresence initial={false}>
									{currentItem.caption != null ? (
										<motion.p
											key={shownIndex}
											id={captionId(shownIndex)}
											data-slot="morph-lightbox-caption"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.18, ease: "easeOut" }}
											className="col-start-1 row-start-1 max-w-prose text-balance"
										>
											{currentItem.caption}
										</motion.p>
									) : null}
								</AnimatePresence>
							</motion.div>
						) : null}

						{multiple && filmstrip ? (
							<motion.div
								style={{ opacity: chrome }}
								className="shrink-0 pt-1 pb-[max(env(safe-area-inset-bottom),6px)]"
							>
								<div
									ref={filmstripRef}
									role="group"
									aria-label="Thumbnails"
									className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
									style={{ touchAction: "pan-x pinch-zoom" }}
								>
									<div
										ref={filmRowRef}
										className="relative mx-auto flex w-max px-3"
									>
										{items.map((item, slide) => (
											<button
												key={slide}
												ref={(node) => {
													thumbsRef.current[slide] = node;
												}}
												type="button"
												tabIndex={slide === shownIndex ? 0 : -1}
												aria-label={`Show image ${slide + 1}: ${item.alt}`}
												aria-current={slide === shownIndex || undefined}
												data-slot="morph-lightbox-thumbnail"
												onClick={() => goTo(slide)}
												className="group/thumb grid h-12 pointer-coarse:w-11 w-10 shrink-0 cursor-pointer place-items-center outline-none"
											>
												<span className="block size-9 overflow-hidden rounded-[5px] bg-muted opacity-50 transition-opacity duration-200 group-hover/thumb:opacity-80 group-focus-visible/thumb:ring-2 group-focus-visible/thumb:ring-foreground group-focus-visible/thumb:ring-offset-2 group-focus-visible/thumb:ring-offset-background group-aria-[current=true]/thumb:opacity-100">
													{/* biome-ignore lint/performance/noImgElement: plain images keep the component framework-agnostic; sizes come from the items */}
													<img
														src={item.thumbnailSrc ?? item.src}
														alt=""
														width={item.width}
														height={item.height}
														loading="lazy"
														decoding="async"
														draggable={false}
														className="size-full object-cover"
													/>
												</span>
											</button>
										))}
										<motion.span
											aria-hidden
											style={{ x: outlineX }}
											className="pointer-events-none absolute top-1.5 left-0 size-9 rounded-[6px] outline-[1.5px] outline-foreground outline-solid outline-offset-[1.5px]"
										/>
									</div>
								</div>
							</motion.div>
						) : null}
					</div>

					<div
						ref={flyerRef}
						aria-hidden
						data-slot="morph-lightbox-flyer"
						className="pointer-events-none invisible absolute top-0 left-0 overflow-hidden bg-center bg-cover bg-muted"
						style={{
							backgroundImage: `url("${currentItem.thumbnailSrc ?? currentItem.src}")`,
						}}
					>
						{/* biome-ignore lint/performance/noImgElement: plain images keep the component framework-agnostic; sizes come from the items */}
						<img
							src={currentItem.src}
							alt=""
							decoding="async"
							draggable={false}
							className="size-full object-cover"
						/>
					</div>
				</motion.div>
				<p aria-live="polite" aria-atomic className="sr-only">
					{announcement}
				</p>
			</div>
		) : null;

	return (
		<MorphLightboxContext.Provider value={contextValue}>
			{children}
			{viewerNode ? createPortal(viewerNode, document.body) : null}
		</MorphLightboxContext.Provider>
	);
}

const rollVariants = {
	enter: (step: number) => ({ y: step > 0 ? "100%" : "-100%" }),
	center: { y: "0%" },
	exit: (step: number) => ({ y: step > 0 ? "-100%" : "100%" }),
};
const swapVariants = {
	enter: { opacity: 0 },
	center: { opacity: 1 },
	exit: { opacity: 0 },
};

/** "3 / 8". The current number rolls one digit at a time, the way you went. */
function Counter({
	value,
	total,
	direction,
	reduced,
}: {
	value: number;
	total: number;
	direction: number;
	reduced: boolean;
}) {
	const digits = String(value).split("");
	return (
		// Numbers read left to right in RTL text too.
		<span
			aria-hidden
			dir="ltr"
			data-slot="morph-lightbox-counter"
			className="inline-flex items-center font-medium text-foreground/80 text-sm tabular-nums"
		>
			{digits.map((digit, order) => (
				<span
					// Places are keyed from the right, so units stay units.
					key={`place-${digits.length - order}`}
					className="relative inline-block h-[1lh] overflow-hidden"
				>
					<AnimatePresence initial={false} custom={direction} mode="popLayout">
						<motion.span
							key={digit}
							custom={direction}
							variants={reduced ? swapVariants : rollVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={
								reduced
									? { duration: REDUCED_FADE }
									: {
											duration: ROLL_DURATION,
											ease: ROLL_EASE,
											delay: order * ROLL_STAGGER,
										}
							}
							className="block"
						>
							{digit}
						</motion.span>
					</AnimatePresence>
				</span>
			))}
			<span className="px-1 text-muted-foreground">/</span>
			<span className="text-muted-foreground">{total}</span>
		</span>
	);
}

export interface MorphLightboxTriggerProps extends ComponentProps<"button"> {
	/** Which item this thumbnail opens. */
	index: number;
	/** Custom thumbnail content. Defaults to the item's thumbnail, cropped to fill. */
	children?: ReactNode;
}

function MorphLightboxTrigger({
	index,
	className,
	children,
	onClick,
	onPointerEnter,
	onFocus,
	...props
}: MorphLightboxTriggerProps) {
	const { items, hiddenIndex, register, openAt, preload } = useMorphLightbox();
	const item = items[index];
	if (!item) return null;

	return (
		<button
			ref={(node) => register(index, node)}
			type="button"
			aria-label={`Open image: ${item.alt}`}
			data-slot="morph-lightbox-trigger"
			data-hidden={hiddenIndex === index || undefined}
			onClick={(event) => {
				onClick?.(event);
				if (!event.defaultPrevented) openAt(index);
			}}
			onPointerEnter={(event) => {
				onPointerEnter?.(event);
				preload(index);
			}}
			onFocus={(event) => {
				onFocus?.(event);
				preload(index);
			}}
			className={cn(
				"relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background data-hidden:invisible",
				className,
			)}
			{...props}
		>
			{children ?? (
				// biome-ignore lint/performance/noImgElement: plain images keep the component framework-agnostic; sizes come from the items
				<img
					src={item.thumbnailSrc ?? item.src}
					alt=""
					width={item.width}
					height={item.height}
					loading="lazy"
					decoding="async"
					draggable={false}
					className="size-full object-cover"
				/>
			)}
		</button>
	);
}

export { MorphLightbox, MorphLightboxTrigger };

export default MorphLightbox;
