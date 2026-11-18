"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type ComponentProps,
	type CSSProperties,
	type FocusEvent,
	Fragment,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Every header is a sticky "spine" with both a top and a bottom offset:
// header i sticks `peek` px further down than the one before it, and `peek`
// px further up from the bottom than the one after it. Headers you have read
// collect at the top edge in order, the ones still ahead wait at the bottom
// edge, and the section you are reading fills the band between them. With a
// `peek` under the spine height the stacked headers overlap like a deck of
// index cards: only a sliver of each shows, and the open and next sections'
// headers show in full. Nothing changes height: it is native scrolling, and
// every visual below is drawn from the scroll position each frame.

/** Most stack levels a card recedes by; deeper cards stay at this size. */
const MAX_DEPTH = 3;
/** Scale lost per stack level in the deck variant. */
const DEPTH_SCALE = 0.035;
/** Px of slack when deciding which header has reached its slot. */
const SLOT_TOLERANCE = 2;
/** Ms without scroll events that ends a scroll. */
const SETTLE_MS = 140;
/** Least ms between two flip ticks, so a long jump riffles instead of buzzing. */
const TICK_THROTTLE_MS = 45;
/** Height of the soft fades along each stack's band edge, in px (`h-3`). */
const EDGE_FADE = 12;
/** Px kept between focused content and either stack. */
const FOCUS_MARGIN = 12;
/**
 * A header press glides there with an ease-out: quick to answer, soft to
 * land. Longer trips take longer, but never drag.
 */
const GLIDE_MIN_MS = 300;
const GLIDE_MAX_MS = 620;
const GLIDE_MS_PER_SQRT_PX = 12;
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
/** Ring radius and circumference, in the 16 px viewBox. */
const RING_RADIUS = 6.25;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// A fingertip riffling the edge of a card: short, dry, papery.
const FLIP_SOUND = {
	name: "scroll-accordion-flip",
	baseFreq: 1650,
	noiseColor: "pink",
	oscType: "triangle",
	filterFreq: 3400,
	filterQ: 0.9,
	attack: 0.001,
	decay: 0.045,
	brightness: 2600,
} as const;

const DEFAULT_SPINE = { deck: 48, list: 44 } as const;
/** Px of each stacked deck card left showing. */
const DEFAULT_DECK_PEEK = 12;

type Variant = "deck" | "list";
type Section = "read" | "active" | "upcoming";
type Geometry = {
	/** Each header's top in the scroll content when it is not stuck, in px. */
	naturals: number[];
	/** Viewport height, in px. */
	height: number;
	/** Largest scrollTop. */
	max: number;
};

export interface ScrollAccordionItem {
	/** Unique id, used for `value` and `onValueChange`. */
	id: string;
	/** Header text. Long titles truncate to one line. */
	title: ReactNode;
	/** Short trailing text in the header, such as "4 min". */
	meta?: ReactNode;
	/** The section body. */
	content: ReactNode;
}

export interface ScrollAccordionHandle {
	/**
	 * Scrolls so the section's header sits at its slot. Plays no sound, and
	 * calls `onValueChange` once, when it lands.
	 */
	scrollToItem: (id: string, options?: { behavior?: ScrollBehavior }) => void;
}

export interface ScrollAccordionProps
	extends Omit<ComponentProps<"div">, "children" | "ref" | "defaultValue"> {
	/** The sections, in reading order. */
	items: ScrollAccordionItem[];
	/** Controlled id of the section being read. Changing it scrolls there. */
	value?: string;
	/** Section shown on mount when uncontrolled. */
	defaultValue?: string;
	/** Called once per change of the section being read, from scrolling or a header press. */
	onValueChange?: (id: string) => void;
	/**
	 * `"deck"` stacks headers as cards on a tray, narrowing the ones further
	 * back; `"list"` stacks flush rows with hairlines.
	 */
	variant?: Variant;
	/** Panel height, in px or any CSS length. */
	height?: number | string;
	/**
	 * Header height, in px. Defaults to 48 for the deck and 44 for the list.
	 */
	spineHeight?: number;
	/**
	 * Px of each stacked header left showing. The full `spineHeight` keeps
	 * every title readable; less overlaps the stacks like a deck of cards, so
	 * the reading band stays roomy with many sections. Defaults to 12 for the
	 * deck and `spineHeight` for the list.
	 */
	peek?: number;
	/** Settle gently at the start of a section when a scroll ends near one. */
	snap?: boolean;
	/** Show a 01, 02… index before each title. */
	numbered?: boolean;
	/** Heading level wrapping each header button. */
	headingLevel?: 2 | 3 | 4 | 5 | 6;
	/** Play a soft paper flip when the section being read changes from your scroll or press. */
	sound?: boolean;
	/** Trigger a selection haptic on touch devices with each flip. */
	haptics?: boolean;
	/** Exposes `scrollToItem()`. */
	ref?: Ref<ScrollAccordionHandle>;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function toLength(value: number | string) {
	return typeof value === "number" ? `${value}px` : value;
}

function prefersReducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Depth of each card before the first measure, assuming the first body fills
 * the band: header 0 is open and the rest wait at the bottom, each one a
 * level deeper than the one above it.
 */
function initialDepth(index: number) {
	return index === 0 ? 0 : Math.min(MAX_DEPTH, index - 1);
}

export function ScrollAccordion({
	items,
	value,
	defaultValue,
	onValueChange,
	variant = "deck",
	height = 420,
	spineHeight,
	peek: peekProp,
	snap = true,
	numbered = true,
	headingLevel = 3,
	sound = true,
	haptics = true,
	className,
	style,
	ref,
	...props
}: ScrollAccordionProps) {
	const spine = spineHeight ?? DEFAULT_SPINE[variant];
	const peek = Math.min(
		spine,
		Math.max(0, peekProp ?? (variant === "deck" ? DEFAULT_DECK_PEEK : spine)),
	);
	const count = items.length;
	const baseId = useId();
	const Heading = `h${headingLevel}` as const;

	const scrollerRef = useRef<HTMLDivElement>(null);
	const headerRefs = useRef<Array<HTMLElement | null>>([]);
	const cardRefs = useRef<Array<HTMLElement | null>>([]);
	const ringRefs = useRef<Array<SVGCircleElement | null>>([]);
	const fadeRefs = useRef<Array<HTMLElement | null>>([]);
	const edgeRef = useRef<HTMLSpanElement>(null);
	const edgeFadeRef = useRef(-1);
	const bodyRefs = useRef<Array<HTMLElement | null>>([]);

	const geometryRef = useRef<Geometry | null>(null);
	const frameRef = useRef(0);
	const glideRef = useRef(0);
	const settleRef = useRef(0);
	/** Last painted scale, ring fill, fade, and done flag per header. */
	const paintedRef = useRef<
		Array<{ scale: number; fill: number; fade: number; done: boolean }>
	>([]);

	const initialIndex = Math.max(
		0,
		items.findIndex((item) => item.id === (value ?? defaultValue)),
	);
	const [active, setActive] = useState(initialIndex);
	const activeRef = useRef(initialIndex);
	/** Last id reported through `onValueChange`, or synced from `value`. */
	const emittedRef = useRef<string | undefined>(items[initialIndex]?.id);
	/** A jump in flight: section changes on the way there are not reported. */
	const pendingRef = useRef<number | null>(null);
	/** True while scrolling comes from the person, so cues may play. */
	const intentRef = useRef(false);
	const touchRef = useRef(false);
	const lastTickRef = useRef(0);
	/** Snapping paused after a focus nudge, until the person scrolls again. */
	const snapPausedRef = useRef(false);

	const { trigger: haptic } = useWebHaptics();
	const { click: playFlip } = useTiks({
		theme: FLIP_SOUND,
		volume: 0.4,
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const deck = variant === "deck";
	const latest = useRef({
		items,
		onValueChange,
		sound,
		haptics,
		spine,
		peek,
		deck,
		snap,
	});
	latest.current = {
		items,
		onValueChange,
		sound,
		haptics,
		spine,
		peek,
		deck,
		snap,
	};

	const emit = useCallback((index: number) => {
		const { items, onValueChange } = latest.current;
		const id = items[index]?.id;
		if (id === undefined || id === emittedRef.current) return;
		emittedRef.current = id;
		onValueChange?.(id);
	}, []);

	const measure = useCallback(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { spine, peek } = latest.current;
		const naturals = bodyRefs.current
			.slice(0, latest.current.items.length)
			.map((body) => (body ? body.offsetTop - spine : 0));
		const height = scroller.clientHeight;
		geometryRef.current = {
			naturals,
			height,
			max: Math.max(0, scroller.scrollHeight - height),
		};
		scroller.parentElement?.style.setProperty(
			"--sa-band",
			`${Math.max(0, height - spine - (naturals.length - 1) * peek)}px`,
		);
	}, []);

	const paint = useCallback(() => {
		frameRef.current = 0;
		const scroller = scrollerRef.current;
		const geometry = geometryRef.current;
		if (!scroller || !geometry) return;
		const { naturals, height, max } = geometry;
		const { spine, peek } = latest.current;
		const n = naturals.length;
		const scroll = scroller.scrollTop;

		// How far each header has arrived at its top and bottom slots, from 0
		// one spine away to 1 stuck, so cards recede smoothly, not in steps.
		const free: number[] = [];
		const top: number[] = [];
		const bottom: number[] = [];
		for (let i = 0; i < n; i++) {
			free.push(naturals[i] - scroll);
			top.push(clamp01(1 - (free[i] - i * peek) / spine));
			bottom.push(
				clamp01(1 - (height - (n - 1 - i) * peek - spine - free[i]) / spine),
			);
		}

		let next = 0;
		for (let i = 0; i < n; i++) {
			if (scroll >= naturals[i] - i * peek - SLOT_TOLERANCE) next = i;
		}

		let below = 0;
		const depthTop: number[] = new Array(n).fill(0);
		for (let i = n - 1; i >= 0; i--) {
			depthTop[i] = below;
			below += top[i];
		}
		let above = 0;
		for (let i = 0; i < n; i++) {
			const depth = Math.min(MAX_DEPTH, depthTop[i] + above);
			above += bottom[i];

			const start = naturals[i] - i * peek;
			const end = i + 1 < n ? naturals[i + 1] - (i + 1) * peek : max;
			const fill =
				end - start > 1
					? clamp01((scroll - start) / (end - start))
					: scroll >= start - SLOT_TOLERANCE
						? 1
						: 0;
			const done = fill >= 0.999;
			const scale = latest.current.deck ? 1 - depth * DEPTH_SCALE : 1;

			let painted = paintedRef.current[i];
			if (!painted) {
				painted = { scale: -1, fill: -1, fade: -1, done: false };
				paintedRef.current[i] = painted;
			}
			const card = cardRefs.current[i];
			if (card && Math.abs(painted.scale - scale) > 0.0005) {
				painted.scale = scale;
				card.style.transform = scale === 1 ? "" : `scale(${scale.toFixed(4)})`;
			}
			const ring = ringRefs.current[i];
			if (ring && Math.abs(painted.fill - fill) > 0.002) {
				painted.fill = fill;
				ring.style.strokeDashoffset = `${(RING_LENGTH * (1 - fill)).toFixed(2)}`;
			}
			// The fade over an upcoming header softens body text going under
			// the bottom stack. Once the gap between it and the open header
			// above closes, it would wash over that card instead, so it fades
			// out as the gap closes.
			const fade =
				i === 0 ? 1 : clamp01((free[i] - ((i - 1) * peek + spine)) / EDGE_FADE);
			const fadeNode = fadeRefs.current[i];
			if (fadeNode && Math.abs(painted.fade - fade) > 0.01) {
				painted.fade = fade;
				fadeNode.style.opacity = fade.toFixed(2);
			}
			const header = headerRefs.current[i];
			if (header && painted.done !== done) {
				painted.done = done;
				header.toggleAttribute("data-complete", done);
			}
		}

		// Once the last header leaves the bottom edge, body text runs off it
		// instead, so the edge softens.
		const edge = 1 - (bottom[n - 1] ?? 1);
		if (edgeRef.current && Math.abs(edgeFadeRef.current - edge) > 0.01) {
			edgeFadeRef.current = edge;
			edgeRef.current.style.opacity = edge.toFixed(2);
		}

		if (next !== activeRef.current) {
			activeRef.current = next;
			setActive(next);
			if (intentRef.current) {
				const { sound, haptics } = latest.current;
				const now = performance.now();
				if (now - lastTickRef.current >= TICK_THROTTLE_MS) {
					lastTickRef.current = now;
					if (sound) playFlip();
					if (haptics && touchRef.current) void haptic("selection");
				}
			}
			if (pendingRef.current === null) emit(next);
		}
	}, [emit, haptic, playFlip]);

	const schedule = useCallback(() => {
		if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
	}, [paint]);

	const stopGlide = useCallback(() => {
		if (!glideRef.current) return;
		cancelAnimationFrame(glideRef.current);
		glideRef.current = 0;
		const scroller = scrollerRef.current;
		if (scroller) scroller.style.scrollSnapType = "";
	}, []);

	// Driven by rAF timestamps rather than native smooth scrolling, so it
	// follows the page's frame clock and stops the moment the person takes
	// over. Snapping is paused on the way, or each step would snap.
	const glide = useCallback(
		(scroller: HTMLElement, target: number) => {
			stopGlide();
			const from = scroller.scrollTop;
			const distance = target - from;
			const duration = Math.min(
				GLIDE_MAX_MS,
				Math.max(
					GLIDE_MIN_MS,
					GLIDE_MIN_MS + Math.sqrt(Math.abs(distance)) * GLIDE_MS_PER_SQRT_PX,
				),
			);
			scroller.style.scrollSnapType = "none";
			snapPausedRef.current = false;
			let start = -1;
			const step = (now: number) => {
				if (start < 0) start = now;
				const t = Math.min(1, (now - start) / duration);
				scroller.scrollTop = from + distance * easeOutQuart(t);
				paint();
				if (t < 1) {
					glideRef.current = requestAnimationFrame(step);
				} else {
					glideRef.current = 0;
					scroller.style.scrollSnapType = "";
				}
			};
			glideRef.current = requestAnimationFrame(step);
		},
		[paint, stopGlide],
	);

	const jumpTo = useCallback(
		(index: number, behavior?: ScrollBehavior) => {
			const scroller = scrollerRef.current;
			const geometry = geometryRef.current;
			if (!scroller || !geometry || geometry.naturals[index] === undefined)
				return;
			const target = Math.min(
				geometry.max,
				Math.max(0, geometry.naturals[index] - index * latest.current.peek),
			);
			stopGlide();
			// Already there: no scroll event will come to clear the jump.
			if (Math.abs(scroller.scrollTop - target) < 1) {
				pendingRef.current = null;
				schedule();
				return;
			}
			pendingRef.current = index;
			const smooth =
				behavior === "smooth" ||
				(behavior === undefined && !prefersReducedMotion());
			if (smooth) glide(scroller, target);
			else scroller.scrollTop = target;
		},
		[glide, schedule, stopGlide],
	);

	const onSettle = useCallback(() => {
		settleRef.current = 0;
		// A glide can idle on a slow frame; it settles when it lands.
		if (glideRef.current) {
			settleRef.current = window.setTimeout(onSettle, SETTLE_MS);
			return;
		}
		// Turning snapping back on snaps at once, so wait until a scroll of
		// the person's own ends, where snapping would act anyway.
		if (snapPausedRef.current && intentRef.current) {
			snapPausedRef.current = false;
			const scroller = scrollerRef.current;
			if (scroller) scroller.style.scrollSnapType = "";
		}
		pendingRef.current = null;
		intentRef.current = false;
		emit(activeRef.current);
	}, [emit]);

	const onScroll = useCallback(() => {
		schedule();
		window.clearTimeout(settleRef.current);
		settleRef.current = window.setTimeout(onSettle, SETTLE_MS);
	}, [onSettle, schedule]);

	// Anything the person does to the panel takes over from a jump in flight.
	const onUserInput = useCallback(
		(touch: boolean) => {
			intentRef.current = true;
			touchRef.current = touch;
			pendingRef.current = null;
			stopGlide();
		},
		[stopGlide],
	);

	useImperativeHandle(
		ref,
		() => ({
			scrollToItem: (id, options) => {
				const index = latest.current.items.findIndex((item) => item.id === id);
				if (index < 0) return;
				intentRef.current = false;
				jumpTo(index, options?.behavior);
			},
		}),
		[jumpTo],
	);

	// Measure before the first paint and on every size change, and open the
	// initial section without animating.
	const mountedRef = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the items, spine, or peek change.
	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		// New items may be new nodes: repaint every header from scratch.
		paintedRef.current = [];
		measure();
		if (!mountedRef.current) {
			mountedRef.current = true;
			if (activeRef.current > 0) jumpTo(activeRef.current, "instant");
			pendingRef.current = null;
		}
		paint();

		const observer = new ResizeObserver(() => {
			measure();
			schedule();
		});
		observer.observe(scroller);
		for (const body of bodyRefs.current.slice(0, count)) {
			if (body) observer.observe(body);
		}
		return () => observer.disconnect();
	}, [count, spine, peek, items, measure, paint, schedule, jumpTo]);

	useEffect(
		() => () => {
			cancelAnimationFrame(frameRef.current);
			frameRef.current = 0;
			cancelAnimationFrame(glideRef.current);
			glideRef.current = 0;
			window.clearTimeout(settleRef.current);
		},
		[],
	);

	// A controlled `value` from outside scrolls there, silently.
	useEffect(() => {
		if (value === undefined || value === emittedRef.current) return;
		const index = latest.current.items.findIndex((item) => item.id === value);
		emittedRef.current = value;
		if (index < 0 || index === activeRef.current) return;
		intentRef.current = false;
		jumpTo(index);
	}, [value, jumpTo]);

	// Focus moving into a section (Tab to a link) lands under a stack when
	// the browser scrolls it into view. Nudge it into the reading band.
	const onFocusIn = (event: FocusEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement;
		if (target.closest('[data-slot="scroll-accordion-header"]')) return;
		const index = bodyRefs.current.findIndex((body) => body?.contains(target));
		if (index < 0) return;
		requestAnimationFrame(() => {
			const scroller = scrollerRef.current;
			const geometry = geometryRef.current;
			if (!scroller || !geometry) return;
			const { spine, peek } = latest.current;
			const n = geometry.naturals.length;
			const box = scroller.getBoundingClientRect();
			const rect = target.getBoundingClientRect();
			const scroll = scroller.scrollTop;
			const top = rect.top - box.top - scroller.clientTop + scroll;
			const bottom = top + rect.height;
			// The band under this section's header, above the next one's.
			const bandBottom =
				index + 1 < n
					? geometry.height - (n - 2 - index) * peek - spine
					: geometry.height;
			const lowest = Math.max(
				geometry.naturals[index] - index * peek,
				bottom - bandBottom + FOCUS_MARGIN,
			);
			const highest = top - index * peek - spine - FOCUS_MARGIN;
			let next = scroll;
			if (scroll < lowest) next = Math.min(lowest, highest);
			else if (scroll > highest) next = Math.max(highest, 0);
			if (Math.abs(next - scroll) >= 1) {
				// Snapping would pull the panel back to the section start.
				if (latest.current.snap) {
					snapPausedRef.current = true;
					scroller.style.scrollSnapType = "none";
				}
				scroller.scrollTo({ top: next, behavior: "instant" });
			}
		});
	};

	if (count === 0) return null;

	const tray =
		variant === "deck"
			? "[--sa-tray:var(--color-neutral-100)] dark:[--sa-tray:var(--color-neutral-900)]"
			: "[--sa-tray:var(--color-background)]";
	const labelled = props["aria-label"] || props["aria-labelledby"];

	return (
		<div
			role={labelled ? "region" : undefined}
			data-slot="scroll-accordion"
			data-variant={variant}
			className={cn(
				"relative w-full overflow-hidden rounded-2xl bg-(--sa-tray) text-sm",
				// The deck's hairline is drawn above the scroller; under it, the
				// stacked headers would cover it in pieces.
				variant === "deck"
					? "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)] dark:after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]"
					: "border border-border",
				tray,
				className,
			)}
			style={
				{
					height: toLength(height),
					"--sa-spine": `${spine}px`,
					"--sa-peek": `${peek}px`,
					"--sa-count": 2 * count,
					...style,
				} as CSSProperties
			}
			{...props}
		>
			<div
				ref={scrollerRef}
				data-slot="scroll-accordion-viewport"
				onScroll={onScroll}
				onWheel={() => onUserInput(false)}
				onTouchStart={() => onUserInput(true)}
				onPointerDown={(event) => onUserInput(event.pointerType === "touch")}
				onKeyDown={(event) => {
					if (event.key !== "Tab") onUserInput(false);
				}}
				onFocus={onFocusIn}
				className={cn(
					"relative isolate h-full overflow-y-auto overflow-x-hidden [scrollbar-color:color-mix(in_oklab,var(--color-foreground)_18%,transparent)_transparent] [scrollbar-width:thin]",
					snap && "snap-y snap-proximity",
				)}
			>
				{items.map((item, index) => {
					const section: Section =
						index < active ? "read" : index === active ? "active" : "upcoming";
					const stack = index <= active ? "top" : "bottom";
					const headerId = `${baseId}-header-${index}`;
					const bodyId = `${baseId}-body-${index}`;
					const depth = initialDepth(index);
					const last = index === count - 1;
					return (
						<Fragment key={item.id}>
							{snap && (
								<span
									aria-hidden="true"
									className="block h-0 snap-start"
									style={{ scrollMarginTop: index * peek }}
								/>
							)}
							<Heading
								ref={(node: HTMLElement | null) => {
									headerRefs.current[index] = node;
								}}
								data-slot="scroll-accordion-header"
								data-state={section}
								data-stack={stack}
								// A card focused from the keyboard lifts above its stack, so
								// its whole plate and focus ring show, not just its sliver.
								className="group/header sticky z-(--sa-z) m-0 bg-(--sa-tray) font-normal text-sm has-focus-visible:z-[calc(var(--sa-z)+var(--sa-count))]"
								style={
									{
										top: index * peek,
										bottom: (count - 1 - index) * peek,
										height: spine,
										// Read headers stack later-over-earlier, upcoming ones the
										// reverse, so each stack's fade only falls on the band.
										// Every upcoming header sits above every read one, so the
										// next card slides over the open one, like a card dealt
										// onto a pile.
										"--sa-z": stack === "top" ? index + 1 : 2 * count - index,
									} as CSSProperties
								}
							>
								<button
									type="button"
									id={headerId}
									aria-controls={bodyId}
									aria-current={section === "active" ? "true" : undefined}
									onClick={() => {
										intentRef.current = true;
										jumpTo(index);
										emit(index);
									}}
									className={cn(
										"group/button relative flex size-full cursor-pointer select-none items-center text-left outline-none",
										variant === "deck" ? "px-2 py-[3px]" : "",
									)}
								>
									<span
										ref={(node) => {
											cardRefs.current[index] = node;
										}}
										data-slot="scroll-accordion-card"
										className={cn(
											"relative flex size-full min-w-0 items-center gap-3 transition-[box-shadow,background-color] duration-150 group-data-[stack=bottom]/header:origin-bottom group-data-[stack=top]/header:origin-top motion-reduce:transition-none",
											variant === "deck"
												? "rounded-xl bg-white px-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.05)] group-hover/button:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_2px_6px_rgb(0_0_0/0.07)] group-focus-visible/button:shadow-[0_0_0_2px_var(--color-ring)] dark:bg-neutral-800 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),0_1px_2px_rgb(0_0_0/0.3)] dark:group-focus-visible/button:shadow-[inset_0_0_0_2px_var(--color-ring)] dark:group-hover/button:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),0_2px_6px_rgb(0_0_0/0.35)]"
												: // A hairline on the band side of each row: under read rows, over upcoming ones.
													"px-4 before:pointer-events-none before:absolute before:inset-x-0 before:h-px before:bg-border/70 group-hover/button:bg-foreground/[0.03] group-focus-visible/button:shadow-[inset_0_0_0_2px_var(--color-ring)] group-data-[stack=bottom]/header:before:top-0 group-data-[stack=top]/header:before:bottom-0",
										)}
										style={
											variant === "deck" && depth > 0
												? { transform: `scale(${1 - depth * DEPTH_SCALE})` }
												: undefined
										}
									>
										{numbered && (
											<span
												aria-hidden="true"
												className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums tracking-tight"
											>
												{String(index + 1).padStart(2, "0")}
											</span>
										)}
										<span
											className={cn(
												// No colour transition: the open section follows the
												// scroll, and a fade would lag behind a quick riffle.
												"min-w-0 flex-1 truncate font-medium",
												section === "active"
													? "text-foreground"
													: "text-muted-foreground group-hover/button:text-foreground",
											)}
										>
											{item.title}
										</span>
										{item.meta != null && (
											<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
												{item.meta}
											</span>
										)}
										<svg
											aria-hidden="true"
											viewBox="0 0 16 16"
											className="size-4 shrink-0 -rotate-90"
										>
											<circle
												cx="8"
												cy="8"
												r={RING_RADIUS}
												fill="none"
												strokeWidth="1.5"
												className="stroke-foreground/12"
											/>
											<circle
												ref={(node) => {
													ringRefs.current[index] = node;
												}}
												cx="8"
												cy="8"
												r={RING_RADIUS}
												fill="none"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeDasharray={RING_LENGTH.toFixed(2)}
												strokeDashoffset={RING_LENGTH.toFixed(2)}
												className={cn(
													section === "active"
														? "stroke-foreground"
														: "stroke-muted-foreground",
												)}
											/>
											<circle
												cx="8"
												cy="8"
												r="2.75"
												className="origin-center scale-0 fill-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[complete]/header:scale-100 motion-reduce:transition-none"
											/>
										</svg>
									</span>
								</button>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute inset-x-0 top-full h-3 bg-linear-to-b from-(--sa-tray) to-transparent opacity-0 group-data-[stack=top]/header:opacity-100"
								/>
								<span
									aria-hidden="true"
									className="pointer-events-none absolute inset-x-0 bottom-full h-3 opacity-0 group-data-[stack=bottom]/header:opacity-100"
								>
									<span
										ref={(node) => {
											fadeRefs.current[index] = node;
										}}
										className="absolute inset-0 bg-linear-to-t from-(--sa-tray) to-transparent"
									/>
								</span>
							</Heading>
							<div
								ref={(node) => {
									bodyRefs.current[index] = node;
								}}
								role="region"
								id={bodyId}
								aria-labelledby={headerId}
								data-slot="scroll-accordion-content"
								data-state={section}
								className={cn(
									"py-4 text-neutral-600 leading-relaxed [overflow-wrap:anywhere] dark:text-neutral-300",
									variant === "deck" ? "px-[22px]" : "px-4",
								)}
								style={
									last
										? {
												// Room for the last section to reach its slot.
												minHeight: `var(--sa-band, calc(${toLength(height)} - ${spine + (count - 1) * peek}px))`,
											}
										: undefined
								}
							>
								{item.content}
							</div>
						</Fragment>
					);
				})}
			</div>
			<span
				ref={edgeRef}
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-(--sa-tray) to-transparent opacity-0"
			/>
		</div>
	);
}

export default ScrollAccordion;
