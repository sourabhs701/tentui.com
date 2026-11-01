"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	Children,
	type CSSProperties,
	createContext,
	isValidElement,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Critically damped: it only overshoots when a flick lands fast. */
const settleSpring = {
	type: "spring",
	stiffness: 320,
	damping: 36,
	restDelta: 0.002,
	restSpeed: 0.05,
} as const;
const reducedSnap = { duration: 0.12, ease: "easeOut" } as const;

/** Minimum ms between detent clicks. */
const TICK_THROTTLE_MS = 28;
/** Minimum ms between selection haptics. */
const HAPTIC_THROTTLE_MS = 45;
/** Ms of pointer samples used for the release velocity. */
const VELOCITY_WINDOW_MS = 80;
/** Fastest coast, in px/s, so a jumpy pointer event can't fling a long list. */
const MAX_VELOCITY_PX = 5000;
/** Rows/s below which a coast hands over to the snap spring. */
const SNAP_SPEED = 6;
/** Fastest rows/s carried into the bounce at a non-looping end. */
const EDGE_SPEED = 12;
/** Ms without wheel events before a trackpad scroll settles. */
const WHEEL_IDLE_MS = 120;
/** Wheel deltas at least this large, in px, count as one notch. */
const WHEEL_NOTCH_PX = 50;
/** Pointer travel, in px, below which a press counts as a tap. */
const TAP_SLOP = 5;
/** Ms after the last key before type-ahead starts a new search. */
const TYPEAHEAD_RESET_MS = 500;
/** Opacity lost by a row turned 90 degrees away. */
const EDGE_FADE = 0.5;

const sizes = {
	sm: { rowHeight: 32, text: "text-sm", padding: "px-3" },
	md: { rowHeight: 40, text: "text-base", padding: "px-4" },
	lg: { rowHeight: 48, text: "text-lg", padding: "px-5" },
} as const;

export interface WheelPickerOption {
	/** Unique value reported by `onValueChange`. */
	value: string;
	/** What the row shows. */
	label: ReactNode;
	/** Text for type-ahead and screen readers when `label` is not a string. */
	textValue?: string;
	/** Shown muted; the wheel never settles on it. */
	disabled?: boolean;
}

export interface WheelPickerProps {
	options: WheelPickerOption[];
	/** Controlled value. */
	value?: string;
	/** Initial value when uncontrolled. */
	defaultValue?: string;
	/** Called once each time the wheel settles on a new value, and on each key that moves it. */
	onValueChange?: (value: string) => void;
	/** Called for each enabled row that crosses the centre while the user scrolls. */
	onScrollValue?: (value: string) => void;
	/** Wrap the list endlessly. Ignored when there are fewer options than `visibleCount`. */
	loop?: boolean;
	/** Rows shown on the drum. */
	visibleCount?: 3 | 5 | 7 | 9;
	/** Row height in px. Defaults by `size`: 32, 40, and 48. */
	rowHeight?: number;
	size?: keyof typeof sizes;
	/** Share of speed kept per 16 ms frame while coasting, from 0.8 to 0.98. */
	friction?: number;
	/** Play a click per row and a pop when the wheel settles. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
	/** `highlight` styles the band of a standalone wheel; in a group the group draws it. */
	classNames?: {
		root?: string;
		highlight?: string;
		option?: string;
		optionSelected?: string;
	};
}

export interface WheelPickerGroupProps {
	/** `WheelPicker` elements, laid out in document direction. */
	children?: ReactNode;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
}

type Phase = "idle" | "dragging" | "coasting" | "scrolling" | "settling";

type Geometry = {
	count: number;
	loop: boolean;
	rowHeight: number;
	/** Drum radius in px. */
	radius: number;
	/** Radians per row. */
	angle: number;
	perspective: number;
	/** Furthest row offset that is drawn. */
	reach: number;
	flat: boolean;
};

type MoveOptions = {
	silent?: boolean;
	velocity?: number;
	mode?: "spring" | "ease" | "instant";
	/** Commit the landing row; key moves commit up front instead. */
	commitOnDone?: boolean;
	/** Pop and tap when a gesture lands after crossing rows. */
	cue?: boolean;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function mod(value: number, size: number) {
	return ((value % size) + size) % size;
}

function getGeometry(
	count: number,
	loop: boolean,
	rowHeight: number,
	visibleCount: number,
	flat: boolean,
): Geometry {
	// The drum spans the frame, and the centre row keeps its full height.
	const radius = (visibleCount * rowHeight) / 2;
	const angle = rowHeight / radius;
	return {
		count,
		loop,
		rowHeight,
		radius,
		angle,
		perspective: radius * 5,
		reach: flat ? visibleCount / 2 + 1 : Math.PI / 2 / angle,
		flat,
	};
}

function rowTransform(offset: number, geometry: Geometry) {
	if (geometry.flat) {
		return `translateY(${(offset * geometry.rowHeight).toFixed(2)}px)`;
	}
	const { radius } = geometry;
	const angle = (-offset * geometry.angle).toFixed(4);
	return `translateZ(${-radius}px) rotateX(${angle}rad) translateZ(${radius}px)`;
}

function rowOpacity(offset: number, geometry: Geometry) {
	const t = Math.min(Math.abs(offset) / geometry.reach, 1);
	return (1 - EDGE_FADE * t * t).toFixed(3);
}

/** Where a row's centre lands on screen, in px from the drum centre. */
function projectY(offset: number, geometry: Geometry) {
	if (geometry.flat) return offset * geometry.rowHeight;
	const { radius, perspective } = geometry;
	const phi = offset * geometry.angle;
	const depth = radius * Math.cos(phi) - radius;
	return (radius * Math.sin(phi) * perspective) / (perspective - depth);
}

function textOf(option: WheelPickerOption) {
	if (option.textValue !== undefined) return option.textValue;
	if (typeof option.label === "string" || typeof option.label === "number") {
		return String(option.label);
	}
	return option.value;
}

/** Ends of the drag range, pulled back so they never pass `limit` rows. */
function rubberBand(raw: number, lower: number, upper: number, limit: number) {
	if (raw < lower) {
		const over = lower - raw;
		return lower - (limit * over) / (over + limit);
	}
	if (raw > upper) {
		const over = raw - upper;
		return upper + (limit * over) / (over + limit);
	}
	return raw;
}

const WheelPickerGroupContext = createContext(false);

export function WheelPicker({
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	onScrollValue,
	loop = false,
	visibleCount = 5,
	rowHeight: rowHeightProp,
	size = "md",
	friction: frictionProp = 0.92,
	sound = true,
	haptics = true,
	disabled = false,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	className,
	classNames,
}: WheelPickerProps) {
	const inGroup = useContext(WheelPickerGroupContext);
	const sizeStyle = sizes[size];
	const rowHeight = Math.max(1, rowHeightProp ?? sizeStyle.rowHeight);
	const friction = clamp(frictionProp, 0.8, 0.98);
	const count = options.length;
	// Wrapping fewer rows than the drum shows would draw duplicates.
	const looping = loop && count >= visibleCount;
	const shouldReduceMotion = useReducedMotion() ?? false;
	const geometry = getGeometry(
		count,
		looping,
		rowHeight,
		visibleCount,
		shouldReduceMotion,
	);

	let firstEnabled = -1;
	let lastEnabled = -1;
	options.forEach((option, index) => {
		if (option.disabled) return;
		if (firstEnabled < 0) firstEnabled = index;
		lastEnabled = index;
	});
	const interactive = !disabled && count > 1 && firstEnabled >= 0;

	const controlled = valueProp !== undefined;
	const [internalValue, setInternalValue] = useState(defaultValue);
	const value = controlled ? valueProp : internalValue;
	const matched = options.findIndex(
		(option) => option.value === value && !option.disabled,
	);
	// A value that isn't an enabled option shows the first enabled one.
	const selectedIndex =
		matched >= 0 ? matched : firstEnabled >= 0 ? firstEnabled : count ? 0 : -1;
	const restIndex = Math.max(selectedIndex, 0);

	const [, forceRender] = useReducer((n: number) => n + 1, 0);
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, pop: playPop } = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const drumRowRefs = useRef<(HTMLDivElement | null)[]>([]);
	const bandRowRefs = useRef<(HTMLDivElement | null)[]>([]);
	const position = useMotionValue(restIndex);
	const geometryRef = useRef(geometry);
	const selectedRef = useRef(selectedIndex);
	const syncedRef = useRef(selectedIndex);
	const reportedRef = useRef(options[selectedIndex]?.value);
	/** Absolute row the wheel rests on or is heading to; null while free. */
	const targetRef = useRef<number | null>(restIndex);
	const phaseRef = useRef<Phase>("idle");
	const sourceRef = useRef<"user" | "program">("program");
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const frameRef = useRef(0);
	const mountedRef = useRef(false);
	const normalizingRef = useRef(false);
	const centreRef = useRef(restIndex);
	const crossedRef = useRef(false);
	const overEdgeRef = useRef(false);
	const lastTickAtRef = useRef(Number.NEGATIVE_INFINITY);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const stampsRef = useRef<number[]>([]);
	const generationRef = useRef(0);
	const shownRef = useRef<number[]>([]);
	const wheelRef = useRef<{
		active: boolean;
		raw: number;
		timer?: ReturnType<typeof setTimeout>;
	}>({ active: false, raw: 0 });
	const typeaheadRef = useRef<{
		text: string;
		timer?: ReturnType<typeof setTimeout>;
	}>({ text: "" });
	const dragRef = useRef<{
		pointerId: number;
		startY: number;
		startPosition: number;
		scale: number;
		moved: boolean;
		wasMoving: boolean;
		samples: { t: number; p: number }[];
	} | null>(null);

	const wrap = (row: number) => (looping ? mod(row, count) : row);
	const isEnabled = (row: number) => {
		const index = wrap(row);
		return index >= 0 && index < count && !options[index].disabled;
	};
	const quiet = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	/** Closest enabled row to a resting point. */
	const nearestEnabled = (point: number) => {
		const anchor = looping ? point : clamp(point, firstEnabled, lastEnabled);
		const centre = Math.round(anchor);
		for (let step = 0; step <= count; step++) {
			const below = centre - step;
			const above = centre + step;
			const pair =
				Math.abs(below - anchor) <= Math.abs(above - anchor)
					? [below, above]
					: [above, below];
			for (const row of pair) if (isEnabled(row)) return row;
		}
		return centre;
	};

	/** Moves `rows` rows in `direction`, then on to the next enabled row. */
	const stepEnabled = (from: number, direction: number, rows: number) => {
		let start = from + direction * rows;
		if (!looping) start = clamp(start, firstEnabled, lastEnabled);
		for (let step = 0; step < count; step++) {
			const row = start + direction * step;
			if (!looping && (row < firstEnabled || row > lastEnabled)) break;
			if (isEnabled(row)) return row;
		}
		for (let step = 1; step < count; step++) {
			const row = start - direction * step;
			if (direction * (row - from) <= 0) break;
			if (isEnabled(row)) return row;
		}
		return from;
	};

	/** The absolute row for `index` along the shortest way round. */
	const nearestRowFor = (index: number) => {
		if (!looping) return index;
		const base = Math.round(position.get());
		let delta = mod(index - base, count);
		if (delta > count / 2) delta -= count;
		return base + delta;
	};

	const setPhase = (phase: Phase) => {
		phaseRef.current = phase;
		if (rootRef.current) rootRef.current.dataset.state = phase;
	};

	// Rows are drawn imperatively so drag and coast never re-render.
	const placeRows = (pos: number, all: boolean) => {
		const geo = geometryRef.current;
		const drumRows = drumRowRefs.current;
		const bandRows = bandRowRefs.current;
		const stamps = stampsRef.current;
		const generation = ++generationRef.current;
		const shown: number[] = [];
		const centre = Math.round(pos);
		const span = Math.ceil(geo.reach) * 2;
		// Nearest rows first, so a short looping list draws each row once.
		for (let step = 0; step <= span && geo.count; step++) {
			const row = centre + (step % 2 ? (step + 1) / 2 : -step / 2);
			const offset = row - pos;
			if (Math.abs(offset) > geo.reach) continue;
			const index = geo.loop ? mod(row, geo.count) : row;
			if (index < 0 || index >= geo.count || stamps[index] === generation) {
				continue;
			}
			stamps[index] = generation;
			shown.push(index);
			const transform = rowTransform(offset, geo);
			const drumRow = drumRows[index];
			if (drumRow) {
				drumRow.style.transform = transform;
				drumRow.style.opacity = rowOpacity(offset, geo);
				drumRow.style.visibility = "";
				drumRow.removeAttribute("aria-hidden");
			}
			const bandRow = bandRows[index];
			if (bandRow) {
				const inBand = Math.abs(offset) < 1;
				bandRow.style.visibility = inBand ? "" : "hidden";
				if (inBand) bandRow.style.transform = transform;
			}
		}
		// The selected option stays in the accessibility tree for
		// aria-activedescendant, even while a long jump carries it off the drum.
		const selected = selectedRef.current;
		if (
			selected >= 0 &&
			selected < geo.count &&
			stamps[selected] !== generation
		) {
			stamps[selected] = generation;
			shown.push(selected);
			const drumRow = drumRows[selected];
			if (drumRow) {
				drumRow.style.visibility = "";
				drumRow.style.opacity = "0";
				drumRow.removeAttribute("aria-hidden");
			}
			const bandRow = bandRows[selected];
			if (bandRow) bandRow.style.visibility = "hidden";
		}
		const previous = all ? drumRows.map((_, index) => index) : shownRef.current;
		for (const index of previous) {
			if (stamps[index] === generation) continue;
			const drumRow = drumRows[index];
			if (drumRow) {
				drumRow.style.visibility = "hidden";
				drumRow.setAttribute("aria-hidden", "true");
			}
			const bandRow = bandRows[index];
			if (bandRow) bandRow.style.visibility = "hidden";
		}
		shownRef.current = shown;
	};

	const cueTick = () => {
		if (quiet()) return;
		const now = performance.now();
		// Ticks that come too fast are dropped, never queued, like a ratchet.
		if (sound && now - lastTickAtRef.current >= TICK_THROTTLE_MS) {
			lastTickAtRef.current = now;
			playClick();
		}
		if (haptics && now - lastHapticAtRef.current >= HAPTIC_THROTTLE_MS) {
			lastHapticAtRef.current = now;
			void haptic("selection");
		}
	};

	const cueSettle = () => {
		if (quiet()) return;
		if (sound) playPop();
		if (haptics) void haptic("light");
	};

	const cueEdge = (over: boolean) => {
		if (over && !overEdgeRef.current && haptics && !quiet()) {
			void haptic("rigid");
		}
		overEdgeRef.current = over;
	};

	// The one place that reacts to movement: rows, ticks, and onScrollValue.
	const sync = (pos: number) => {
		placeRows(pos, false);
		if (!count) return;
		const centre = looping
			? Math.round(pos)
			: clamp(Math.round(pos), 0, count - 1);
		if (normalizingRef.current) {
			centreRef.current = centre;
			return;
		}
		const previous = centreRef.current;
		if (centre === previous) return;
		centreRef.current = centre;
		if (sourceRef.current !== "user") return;
		crossedRef.current = true;
		if (onScrollValue) {
			const direction = Math.sign(centre - previous);
			const crossed = Math.min(Math.abs(centre - previous), count);
			for (let step = crossed - 1; step >= 0; step--) {
				const option = options[wrap(centre - direction * step)];
				if (option && !option.disabled) onScrollValue(option.value);
			}
		}
		cueTick();
	};

	const stopAnimation = () => {
		animationRef.current?.stop();
		animationRef.current = null;
		cancelAnimationFrame(frameRef.current);
	};

	const resetWheel = () => {
		clearTimeout(wheelRef.current.timer);
		wheelRef.current.active = false;
	};

	const commit = (row: number) => {
		const option = options[wrap(row)];
		if (!option || option.disabled) return;
		if (!controlled) setInternalValue(option.value);
		// Re-render even when unchanged, so a parent that ignores the change
		// pulls the wheel back to its value.
		forceRender();
		if (option.value === reportedRef.current) return;
		reportedRef.current = option.value;
		onValueChange?.(option.value);
	};

	const moveTo = (
		target: number,
		{
			silent = false,
			velocity = 0,
			mode = "spring",
			commitOnDone = true,
			cue = false,
		}: MoveOptions = {},
	) => {
		stopAnimation();
		resetWheel();
		targetRef.current = target;
		sourceRef.current = silent ? "program" : "user";
		const done = () => {
			animationRef.current = null;
			if (!mountedRef.current) return;
			setPhase("idle");
			// Keep a looping wheel's position near zero; the rows look the same.
			const wrapped = wrap(target);
			if (wrapped !== target) {
				normalizingRef.current = true;
				position.jump(wrapped);
				normalizingRef.current = false;
				targetRef.current = wrapped;
			}
			if (silent) return;
			if (cue && crossedRef.current) cueSettle();
			if (commitOnDone) commit(target);
			else forceRender();
		};
		if (mode === "instant" || position.get() === target) {
			position.jump(target);
			done();
			return;
		}
		setPhase("settling");
		animationRef.current = animate(
			position,
			target,
			mode === "ease"
				? { ...reducedSnap, onComplete: done }
				: { ...settleSpring, velocity, onComplete: done },
		);
	};

	/** Milliseconds over which coasting speed falls by a factor of e. */
	const decayMs = -16 / Math.log(friction);

	const settleNear = (point: number, velocity = 0) => {
		moveTo(nearestEnabled(point), {
			velocity,
			mode: shouldReduceMotion ? "ease" : "spring",
			cue: true,
		});
	};

	const coast = (initial: number) => {
		setPhase("coasting");
		targetRef.current = null;
		let velocity = initial;
		let last = performance.now();
		const step = (now: number) => {
			const elapsed = Math.min(now - last, 50);
			last = now;
			const decay = friction ** (elapsed / 16);
			// Exact distance covered by exponential friction over the frame.
			const next = position.get() + velocity * decayMs * (1 - decay);
			velocity *= decay;
			if (!looping && (next < firstEnabled || next > lastEnabled)) {
				// Hit an end: bounce off it with a capped speed.
				const edge = next < firstEnabled ? firstEnabled : lastEnabled;
				position.set(edge);
				cueEdge(true);
				moveTo(edge, {
					velocity: clamp(velocity * 1000, -EDGE_SPEED, EDGE_SPEED),
					cue: true,
				});
				return;
			}
			position.set(next);
			if (Math.abs(velocity) * 1000 < SNAP_SPEED) {
				settleNear(next + velocity * decayMs, velocity * 1000);
				return;
			}
			frameRef.current = requestAnimationFrame(step);
		};
		frameRef.current = requestAnimationFrame(step);
	};

	const release = (velocity: number) => {
		const pos = position.get();
		if (shouldReduceMotion) {
			settleNear(pos);
			return;
		}
		const limit = MAX_VELOCITY_PX / rowHeight / 1000;
		const capped = clamp(velocity, -limit, limit);
		if (!looping && (pos < firstEnabled || pos > lastEnabled)) {
			settleNear(pos);
			return;
		}
		if (Math.abs(capped) * 1000 < SNAP_SPEED) {
			settleNear(pos + capped * decayMs, capped * 1000);
			return;
		}
		coast(capped);
	};

	const scrollTo = (raw: number) => {
		if (looping) {
			position.set(raw);
			return;
		}
		cueEdge(raw < firstEnabled || raw > lastEnabled);
		position.set(rubberBand(raw, firstEnabled, lastEnabled, visibleCount / 4));
	};

	/** Row under a point `y` px from the drum centre. */
	const rowAt = (y: number) => {
		const pos = position.get();
		const centre = Math.round(pos);
		const reach = Math.ceil(geometry.reach);
		let best: number | null = null;
		let bestDistance = rowHeight;
		for (let row = centre - reach; row <= centre + reach; row++) {
			const offset = row - pos;
			if (Math.abs(offset) > geometry.reach) continue;
			if (!looping && (row < 0 || row >= count)) continue;
			const distance = Math.abs(projectY(offset, geometry) - y);
			if (distance < bestDistance) {
				best = row;
				bestDistance = distance;
			}
		}
		return best;
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!interactive || event.button !== 0) return;
		const root = event.currentTarget;
		root.setPointerCapture(event.pointerId);
		root.focus({ preventScroll: true });
		const wasMoving = phaseRef.current !== "idle";
		// Touching a moving wheel stops it under the finger.
		stopAnimation();
		resetWheel();
		if (wasMoving) {
			targetRef.current = null;
			setPhase("idle");
		}
		sourceRef.current = "user";
		crossedRef.current = false;
		overEdgeRef.current = false;
		const rect = root.getBoundingClientRect();
		// CSS zoom and transforms scale client coordinates; work in local px.
		const scale = rect.height / (root.offsetHeight || 1) || 1;
		dragRef.current = {
			pointerId: event.pointerId,
			startY: event.clientY,
			startPosition: position.get(),
			scale,
			moved: false,
			wasMoving,
			samples: [{ t: event.timeStamp, p: position.get() }],
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const delta = (event.clientY - drag.startY) / drag.scale;
		if (!drag.moved) {
			if (Math.abs(delta) < TAP_SLOP) return;
			drag.moved = true;
			targetRef.current = null;
			setPhase("dragging");
		}
		const raw = drag.startPosition - delta / rowHeight;
		drag.samples.push({ t: event.timeStamp, p: raw });
		while (
			drag.samples.length > 2 &&
			event.timeStamp - drag.samples[0].t > VELOCITY_WINDOW_MS
		) {
			drag.samples.shift();
		}
		scrollTo(raw);
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragRef.current = null;
		const root = event.currentTarget;
		if (root.hasPointerCapture(event.pointerId)) {
			root.releasePointerCapture(event.pointerId);
		}

		if (!drag.moved) {
			if (drag.wasMoving) {
				settleNear(position.get());
				return;
			}
			// Tap: scroll the tapped row to the centre.
			const rect = root.getBoundingClientRect();
			const y = (event.clientY - rect.top) / drag.scale - root.offsetHeight / 2;
			const row = rowAt(y);
			if (row === null || !isEnabled(row) || row === targetRef.current) {
				return;
			}
			moveTo(row, { mode: shouldReduceMotion ? "ease" : "spring", cue: true });
			return;
		}

		const recent = drag.samples.filter(
			(sample) => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS,
		);
		const first = recent[0];
		const last = recent[recent.length - 1];
		// A finger that stopped before lifting releases with no speed.
		const held = !last || event.timeStamp - last.t > VELOCITY_WINDOW_MS / 2;
		const velocity =
			held || recent.length < 2 || last.t === first.t
				? 0
				: (last.p - first.p) / (last.t - first.t);
		release(velocity);
	};

	const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return;
		dragRef.current = null;
		settleNear(position.get());
	};

	const typeahead = (key: string, base: number) => {
		const search = typeaheadRef.current;
		clearTimeout(search.timer);
		search.text += key.toLowerCase();
		search.timer = setTimeout(() => {
			search.text = "";
		}, TYPEAHEAD_RESET_MS);
		const from = wrap(base);
		const find = (query: string, skip: number) => {
			for (let step = skip; step < count + skip; step++) {
				const index = mod(from + step, count);
				const option = options[index];
				if (
					!option.disabled &&
					textOf(option).toLowerCase().startsWith(query)
				) {
					return looping ? base + mod(index - from, count) : index;
				}
			}
			return null;
		};
		const { text } = search;
		const found = find(text, text.length === 1 ? 1 : 0);
		if (found !== null) return found;
		// Repeating one letter cycles through the options that start with it.
		const repeated = text.split("").every((char) => char === text[0]);
		return repeated ? find(text[0], 1) : null;
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!interactive || dragRef.current) return;
		// Repeated keys build on the pending target, not the moving wheel.
		const base = targetRef.current ?? nearestEnabled(position.get());
		let target: number | null = null;
		switch (event.key) {
			case "ArrowUp":
				target = stepEnabled(base, -1, 1);
				break;
			case "ArrowDown":
				target = stepEnabled(base, 1, 1);
				break;
			case "PageUp":
				target = stepEnabled(base, -1, visibleCount);
				break;
			case "PageDown":
				target = stepEnabled(base, 1, visibleCount);
				break;
			case "Home":
				target = nearestRowFor(firstEnabled);
				break;
			case "End":
				target = nearestRowFor(lastEnabled);
				break;
			default: {
				const printable =
					event.key.length === 1 &&
					!event.ctrlKey &&
					!event.metaKey &&
					!event.altKey;
				if (!printable) return;
				if (event.key === " " && !typeaheadRef.current.text) return;
				target = typeahead(event.key, base);
			}
		}
		event.preventDefault();
		if (target === null) return;
		if (target === base && phaseRef.current === "idle") return;
		crossedRef.current = false;
		moveTo(target, {
			mode: shouldReduceMotion ? "instant" : "spring",
			commitOnDone: false,
		});
		commit(target);
	};

	const handleWheel = (event: WheelEvent) => {
		if (!interactive) return;
		// Sideways scrolling belongs to the page.
		if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) {
			return;
		}
		event.preventDefault();
		if (dragRef.current) return;
		const wheel = wheelRef.current;
		const notch =
			event.deltaMode !== 0 || Math.abs(event.deltaY) >= WHEEL_NOTCH_PX;
		if (notch && !wheel.active) {
			// One notch, one row.
			const base = targetRef.current ?? nearestEnabled(position.get());
			const target = stepEnabled(base, Math.sign(event.deltaY), 1);
			if (target === base) return;
			moveTo(target, { mode: shouldReduceMotion ? "instant" : "spring" });
			return;
		}
		if (!wheel.active) {
			stopAnimation();
			wheel.active = true;
			wheel.raw = position.get();
			targetRef.current = null;
			sourceRef.current = "user";
			crossedRef.current = false;
			overEdgeRef.current = false;
			setPhase("scrolling");
		}
		// Trackpads scroll like a drag and settle once the deltas stop.
		wheel.raw += event.deltaY / rowHeight;
		scrollTo(wheel.raw);
		clearTimeout(wheel.timer);
		wheel.timer = setTimeout(() => settleNear(position.get()), WHEEL_IDLE_MS);
	};

	// Imperative listeners call through refs so they always see the latest render.
	const syncRef = useRef(sync);
	const wheelHandlerRef = useRef(handleWheel);
	const moveToRef = useRef(moveTo);
	useLayoutEffect(() => {
		syncRef.current = sync;
		wheelHandlerRef.current = handleWheel;
		moveToRef.current = moveTo;
		geometryRef.current = geometry;
		selectedRef.current = selectedIndex;
		reportedRef.current = options[selectedIndex]?.value;
		// React may have rewritten row styles; redraw them from the motion value.
		placeRows(position.get(), true);

		// Follow the value prop silently, unless the user holds the wheel.
		const previous = syncedRef.current;
		syncedRef.current = selectedIndex;
		if (selectedIndex < 0 || dragRef.current) return;
		const target = targetRef.current;
		if (target !== null && wrap(target) === selectedIndex) return;
		// A gesture in flight keeps going unless the value prop changed.
		if (phaseRef.current !== "idle" && selectedIndex === previous) return;
		moveTo(nearestRowFor(selectedIndex), {
			silent: true,
			mode: shouldReduceMotion ? "instant" : "spring",
		});
	});

	useEffect(
		() => position.on("change", (latest) => syncRef.current(latest)),
		[position],
	);

	useEffect(() => {
		mountedRef.current = true;
		const wheel = wheelRef.current;
		const search = typeaheadRef.current;
		return () => {
			mountedRef.current = false;
			animationRef.current?.stop();
			cancelAnimationFrame(frameRef.current);
			clearTimeout(wheel.timer);
			clearTimeout(search.timer);
		};
	}, []);

	// Wheel needs a non-passive listener to keep the page from scrolling, and
	// only fires while the pointer is over the wheel.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onWheel = (event: WheelEvent) => wheelHandlerRef.current(event);
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	}, []);

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.moved) event.preventDefault();
		};
		root.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => root.removeEventListener("touchmove", onTouchMove);
	}, []);

	// Disabling mid-gesture settles the wheel where it is.
	useEffect(() => {
		if (interactive || phaseRef.current === "idle") return;
		dragRef.current = null;
		moveToRef.current(Math.round(position.get()), { silent: true });
	}, [interactive, position]);

	const bandTop = `calc(50% - ${rowHeight / 2}px)`;
	const fade = rowHeight / 2;
	// Fade the drum's ends and cut out the band, where the selection layer draws.
	const mask = `linear-gradient(to bottom, transparent, #000 ${fade}px, #000 ${bandTop}, transparent ${bandTop}, transparent calc(50% + ${rowHeight / 2}px), #000 calc(50% + ${rowHeight / 2}px), #000 calc(100% - ${fade}px), transparent)`;
	const optionId = (index: number) => `${id}-option-${index}`;

	// First paint, before effects take over the row styles.
	const initialStyle = (index: number, band: boolean): CSSProperties => {
		const offset = looping
			? index - restIndex - count * Math.round((index - restIndex) / count)
			: index - restIndex;
		const shown = band
			? Math.abs(offset) < 1
			: Math.abs(offset) <= geometry.reach;
		return {
			transform: rowTransform(offset, geometry),
			opacity: band ? undefined : rowOpacity(offset, geometry),
			visibility: shown ? undefined : "hidden",
		};
	};

	return (
		<div
			ref={rootRef}
			role="listbox"
			tabIndex={interactive ? 0 : -1}
			aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? "Value")}
			aria-labelledby={ariaLabelledBy}
			aria-activedescendant={
				selectedIndex >= 0 ? optionId(selectedIndex) : undefined
			}
			aria-disabled={disabled || undefined}
			data-slot="wheel-picker"
			data-state="idle"
			data-size={size}
			data-disabled={disabled || undefined}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onKeyDown={handleKeyDown}
			style={{ height: visibleCount * rowHeight }}
			className={cn(
				"relative inline-block min-w-12 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-md font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=dragging]:cursor-grabbing data-disabled:cursor-not-allowed data-disabled:opacity-50",
				sizeStyle.text,
				classNames?.root,
				className,
			)}
		>
			{inGroup ? null : (
				<div
					aria-hidden
					data-slot="wheel-picker-highlight"
					className={cn(
						"pointer-events-none absolute inset-x-0 rounded-md bg-muted",
						classNames?.highlight,
					)}
					style={{ top: bandTop, height: rowHeight }}
				/>
			)}

			<div
				data-slot="wheel-picker-drum"
				className="absolute inset-0"
				style={{
					perspective: geometry.perspective,
					maskImage: mask,
					WebkitMaskImage: mask,
				}}
			>
				{options.map((option, index) => {
					const selected = index === selectedIndex;
					const style = initialStyle(index, false);
					return (
						// biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps focus and points here with aria-activedescendant
						<div
							key={option.value}
							ref={(node) => {
								drumRowRefs.current[index] = node;
							}}
							id={optionId(index)}
							role="option"
							aria-selected={selected}
							aria-disabled={option.disabled || undefined}
							aria-label={
								typeof option.label === "string" ? undefined : textOf(option)
							}
							aria-posinset={index + 1}
							aria-setsize={count}
							aria-hidden={style.visibility === "hidden" || undefined}
							data-slot="wheel-picker-option"
							data-selected={selected || undefined}
							data-disabled={option.disabled || undefined}
							suppressHydrationWarning
							className={cn(
								"absolute inset-x-0 flex items-center justify-center whitespace-nowrap text-muted-foreground [backface-visibility:hidden]",
								sizeStyle.padding,
								option.disabled && "text-muted-foreground/45",
								classNames?.option,
							)}
							style={{ top: bandTop, height: rowHeight, ...style }}
						>
							{option.label}
						</div>
					);
				})}
			</div>

			<div
				aria-hidden
				data-slot="wheel-picker-selection"
				className="pointer-events-none absolute inset-x-0 overflow-hidden"
				style={{
					top: bandTop,
					height: rowHeight,
					perspective: geometry.perspective,
				}}
			>
				{options.map((option, index) => (
					<div
						key={option.value}
						ref={(node) => {
							bandRowRefs.current[index] = node;
						}}
						data-disabled={option.disabled || undefined}
						suppressHydrationWarning
						className={cn(
							"absolute inset-x-0 top-0 flex items-center justify-center whitespace-nowrap text-foreground [backface-visibility:hidden]",
							sizeStyle.padding,
							option.disabled && "text-muted-foreground/60",
							classNames?.option,
							classNames?.optionSelected,
						)}
						style={{ height: rowHeight, ...initialStyle(index, true) }}
					>
						{option.label}
					</div>
				))}
			</div>

			{/* Sizes the wheel to its widest label. */}
			<div
				aria-hidden
				className={cn("invisible grid h-0 overflow-hidden", sizeStyle.padding)}
			>
				{options.map((option) => (
					<span
						key={option.value}
						className="col-start-1 row-start-1 whitespace-nowrap"
					>
						{option.label}
					</span>
				))}
			</div>
		</div>
	);
}

function groupRowHeight(children: ReactNode) {
	let height = 0;
	Children.forEach(children, (child) => {
		if (
			!isValidElement<WheelPickerProps>(child) ||
			child.type !== WheelPicker
		) {
			return;
		}
		const { rowHeight, size = "md" } = child.props;
		height = Math.max(height, rowHeight ?? sizes[size].rowHeight);
	});
	return height || sizes.md.rowHeight;
}

export function WheelPickerGroup({
	children,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	className,
}: WheelPickerGroupProps) {
	const rowHeight = groupRowHeight(children);
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledBy}
			data-slot="wheel-picker-group"
			className={cn("relative isolate inline-flex items-center", className)}
		>
			<div
				aria-hidden
				data-slot="wheel-picker-highlight"
				className="pointer-events-none absolute inset-x-0 -z-10 rounded-md bg-muted"
				style={{ top: `calc(50% - ${rowHeight / 2}px)`, height: rowHeight }}
			/>
			<WheelPickerGroupContext.Provider value>
				{children}
			</WheelPickerGroupContext.Provider>
		</div>
	);
}

export default WheelPicker;
