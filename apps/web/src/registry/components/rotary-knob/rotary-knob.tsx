"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const detentSpring = { type: "spring", stiffness: 600, damping: 32 } as const;

/** Pointer travel, in px, that turns the knob through its whole range. */
const DRAG_TRAVEL_PX = 200;
/** Drag and trackpad speed while `Shift` is held. */
const FINE_FACTOR = 0.1;
/** Pointer travel, in px, before a press becomes a drag. */
const DRAG_SLOP = 3;
/** Extra travel, in detents, before the knob leaves its current detent. */
const HYSTERESIS = 0.08;
/** Furthest the pointer rubber-bands past an end stop, in degrees. */
const MAX_BAND_DEG = 8;
/** How far past an end stop a drag winds up, as a fraction of the range. */
const MAX_WINDUP = 0.25;
/** Spin, in deg/s, the pointer gets when it bumps an end stop. */
const BUMP_VELOCITY = 240;
/** Minimum ms between detent sounds and haptics. */
const CUE_THROTTLE_MS = 35;
/** Ms of wheel quiet that starts a new wheel gesture. */
const WHEEL_IDLE_MS = 200;
/** A wheel delta of at least this many px is one mouse notch. */
const WHEEL_NOTCH_PX = 50;
/** Circular drags ignore the pointer this close to the center, in px. */
const CIRCULAR_DEAD_ZONE = 6;

/** All lengths in px. `cap` and `arcInset` are measured in from the dial edge. */
const sizes = {
	sm: {
		dial: 72,
		tick: 5,
		arc: 3,
		arcInset: 9,
		cap: 16,
		labelSpace: 18,
		maxTicks: 24,
		label: "text-[10px]",
		value: "text-xs",
	},
	md: {
		dial: 112,
		tick: 7,
		arc: 4,
		arcInset: 12,
		cap: 22,
		labelSpace: 24,
		maxTicks: 36,
		label: "text-[11px]",
		value: "text-sm",
	},
	lg: {
		dial: 152,
		tick: 9,
		arc: 5,
		arcInset: 16,
		cap: 30,
		labelSpace: 28,
		maxTicks: 48,
		label: "text-xs",
		value: "text-base",
	},
} as const;

type Variant = "default" | "minimal" | "tactile";
type Direction = 1 | -1;

export interface RotaryKnobStop {
	value: number;
	label: string;
}

export interface RotaryKnobProps {
	/** Controlled value. */
	value?: number;
	/** Initial value when uncontrolled; double-click resets to it. */
	defaultValue?: number;
	/** Called every time the knob lands on a new detent. */
	onValueChange?: (value: number) => void;
	/** Called once a drag is released, or a key, wheel step, or reset lands. */
	onValueCommit?: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/** Labelled detents drawn around the dial. Replaces `min`, `max`, and `step`. */
	stops?: RotaryKnobStop[];
	/** Degrees of travel, centered at the top. */
	angleRange?: number;
	/** `vertical` turns as you drag up and down; `circular` follows the pointer around the dial. */
	dragMode?: "vertical" | "circular";
	size?: keyof typeof sizes;
	/** `minimal` is a ring and pointer; `tactile` is a raised, knurled cap. */
	variant?: Variant;
	/** Show the value under the knob. */
	showValue?: boolean;
	/** Formats the readout and `aria-valuetext`. Stop labels are used when `stops` is set. */
	formatValue?: (value: number) => string;
	/** Play a tick per detent and a lower thunk at the end stops. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	/** Submits the value with a native form through a hidden input. */
	name?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
}

function decimalsOf(value: number) {
	if (!Number.isFinite(value)) return 0;
	const text = String(value);
	if (text.includes("e-")) return Number(text.split("e-")[1]);
	return text.split(".")[1]?.length ?? 0;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Pulls travel past an end stop back so it never exceeds `MAX_BAND_DEG`. */
function rubberBand(overDegrees: number) {
	const distance = Math.abs(overDegrees);
	return (
		(Math.sign(overDegrees) * MAX_BAND_DEG * distance) /
		(distance + MAX_BAND_DEG)
	);
}

/** Wraps an angle difference into -180..180. */
function wrapDegrees(degrees: number) {
	return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

interface Detents {
	/** Index of the last detent; the first is 0. */
	count: number;
	lower: number;
	upper: number;
	decimals: number;
	/** Labelled stops: a fast spin passes through each one. */
	labelled: boolean;
	valueAt: (index: number) => number;
	labelAt: (index: number) => string | undefined;
	/** Position of a detent along the travel, 0 to 1. */
	fractionAt: (index: number) => number;
	/** Nearest detent to a value, clamped to the range. */
	indexOf: (value: number) => number;
	/** Converts a 0 to 1 travel position to a fractional detent index. */
	toIndexSpace: (fraction: number) => number;
}

function buildDetents(
	min: number,
	max: number,
	step: number,
	stops?: RotaryKnobStop[],
): Detents {
	const sorted = (stops ?? [])
		.filter((stop) => Number.isFinite(stop.value))
		.sort((a, b) => a.value - b.value)
		.filter((stop, index, list) => stop.value !== list[index - 1]?.value);

	if (sorted.length) {
		const first = sorted[0].value;
		const span = (sorted[sorted.length - 1]?.value ?? first) - first;
		// Stops sit around the dial in proportion to their values.
		const fractions = sorted.map((stop) =>
			span > 0 ? (stop.value - first) / span : 0,
		);
		const count = sorted.length - 1;
		return {
			count,
			lower: first,
			upper: first + span,
			decimals: Math.max(...sorted.map((stop) => decimalsOf(stop.value))),
			labelled: true,
			valueAt: (index) => sorted[index]?.value ?? first,
			labelAt: (index) => sorted[index]?.label,
			fractionAt: (index) => fractions[index] ?? 0,
			indexOf: (value) => {
				if (!Number.isFinite(value)) return 0;
				let nearest = 0;
				for (let index = 1; index <= count; index++) {
					const distance = Math.abs((sorted[index]?.value ?? 0) - value);
					if (distance < Math.abs((sorted[nearest]?.value ?? 0) - value)) {
						nearest = index;
					}
				}
				return nearest;
			},
			toIndexSpace: (fraction) => {
				for (let index = 0; index < count; index++) {
					const from = fractions[index] ?? 0;
					const to = fractions[index + 1] ?? 1;
					if (fraction <= to) {
						return index + (to > from ? (fraction - from) / (to - from) : 0);
					}
				}
				return count;
			},
		};
	}

	const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
	const lower = Number.isFinite(min) ? min : 0;
	const top = Number.isFinite(max) ? Math.max(max, lower) : lower;
	// Steps are anchored at `min`; the last detent is the last step within `max`.
	const count = Math.floor(Number(((top - lower) / safeStep).toFixed(9)));
	const decimals = Math.max(decimalsOf(safeStep), decimalsOf(lower));
	// Round to the step's precision so 0.1 + 0.2 lands on 0.3.
	const valueAt = (index: number) =>
		Number((lower + index * safeStep).toFixed(decimals));
	return {
		count,
		lower,
		upper: valueAt(count),
		decimals,
		labelled: false,
		valueAt,
		labelAt: () => undefined,
		fractionAt: (index) => (count > 0 ? index / count : 0),
		indexOf: (value) => {
			if (!Number.isFinite(value)) return 0;
			// The ratio is rounded first so 0.175 / 0.05 counts as 3.5, not 3.4999….
			const steps = Number(((value - lower) / safeStep).toFixed(9));
			return clamp(Math.round(steps), 0, count);
		},
		toIndexSpace: (fraction) => fraction * count,
	};
}

/** Detents that get a tick mark: all of them, or an even 1-2-5 stride on long ranges. */
function tickIndexes(detents: Detents, maxTicks: number, fullCircle: boolean) {
	const { count } = detents;
	let stride = 1;
	if (!detents.labelled) {
		for (let k = 1; count / stride > maxTicks; k++) {
			stride = [1, 2, 5][k % 3] * 10 ** Math.floor(k / 3);
		}
	}
	const indexes: number[] = [];
	for (let index = 0; index <= count; index += stride) indexes.push(index);
	const last = indexes[indexes.length - 1] ?? 0;
	if (last !== count) {
		// Keep the end stop marked without crowding the tick before it.
		if (count - last < stride / 2) indexes.pop();
		indexes.push(count);
	}
	// On a full turn the last tick would sit on top of the first.
	if (fullCircle && count > 0 && detents.fractionAt(count) >= 1) indexes.pop();
	return indexes;
}

/** A ring `mask-image` that keeps the outer `width` px of a circle. */
function ringMask(width: number): CSSProperties {
	const mask = `radial-gradient(closest-side, transparent calc(100% - ${width + 0.5}px), #000 calc(100% - ${width}px), #000 calc(100% - 0.5px), transparent 100%)`;
	return { maskImage: mask, WebkitMaskImage: mask };
}

export function RotaryKnob({
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	min = 0,
	max = 100,
	step = 1,
	stops,
	angleRange = 270,
	dragMode = "vertical",
	size = "md",
	variant = "default",
	showValue,
	formatValue,
	sound = true,
	haptics = true,
	disabled = false,
	name,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	className,
}: RotaryKnobProps) {
	const sizeStyle = sizes[size];
	const detents = buildDetents(min, max, step, stops);
	const { count } = detents;
	const range = clamp(Number.isFinite(angleRange) ? angleRange : 270, 0, 360);
	const start = -range / 2;
	const sweepAt = (index: number) => detents.fractionAt(index) * range;

	const controlled = valueProp !== undefined;
	const [internalIndex, setInternalIndex] = useState(() =>
		detents.indexOf(valueProp ?? defaultValue ?? detents.lower),
	);
	const [dragging, setDragging] = useState(false);
	// A drag in progress wins over the `value` prop; it syncs on release.
	const index = Math.min(
		controlled && !dragging ? detents.indexOf(valueProp) : internalIndex,
		count,
	);
	const value = detents.valueAt(index);
	const stopLabel = detents.labelAt(index);
	const valueText =
		stopLabel ??
		(formatValue ? formatValue(value) : value.toFixed(detents.decimals));

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, toggle: playToggle } = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const knobRef = useRef<HTMLDivElement>(null);
	// Degrees the pointer has turned from the start of its travel.
	const sweep = useMotionValue(sweepAt(index));
	const rangeRef = useRef(range);
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const indexRef = useRef(index);
	const bandRef = useRef(0);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const pressMovedRef = useRef(false);
	const wheelRef = useRef({
		raw: 0,
		at: Number.NEGATIVE_INFINITY,
		bumped: false,
	});
	const dragRef = useRef<{
		pointerId: number;
		startIndex: number;
		raw: number;
		originX: number;
		originY: number;
		lastY: number;
		lastAngle: number | null;
		centerX: number;
		centerY: number;
		scale: number;
		moved: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		indexRef.current = index;
		rangeRef.current = range;
	});

	// The value arc is two half discs that rotate behind a ring mask, so it
	// fills with transforms alone. Ranges are read from a ref to stay current.
	const firstHalf = useTransform(sweep, (s) =>
		clamp(Math.min(s, rangeRef.current), 0, 180),
	);
	const secondHalf = useTransform(sweep, (s) =>
		clamp(Math.min(s, rangeRef.current) - 180, 0, 180),
	);
	const arcEnd = useTransform(sweep, (s) => clamp(s, 0, rangeRef.current));
	const arcOpacity = useTransform(sweep, (s) => (s > 0.5 ? 1 : 0));

	const springTo = useCallback(
		(target: number, velocity?: number) => {
			animationRef.current?.stop();
			animationRef.current = null;
			if (shouldReduceMotion) {
				sweep.jump(target);
				return;
			}
			if (
				velocity === undefined &&
				sweep.get() === target &&
				sweep.getVelocity() === 0
			) {
				return;
			}
			animationRef.current = animate(sweep, target, {
				...detentSpring,
				...(velocity === undefined ? null : { velocity }),
				restDelta: 0.01,
			});
		},
		[shouldReduceMotion, sweep],
	);

	// The pointer always heads for the current detent, plus any rubber band.
	const targetSweep = sweepAt(index);
	useEffect(() => {
		springTo(targetSweep + bandRef.current);
	}, [targetSweep, springTo]);

	useEffect(() => () => animationRef.current?.stop(), []);

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const thunk = () => {
		lastCueAtRef.current = performance.now();
		if (silent()) return;
		if (sound) playToggle(false);
		if (haptics) void haptic("medium");
	};

	// Called only for user input, so first render and prop changes stay quiet.
	const cue = (next: number) => {
		// End stops always sound so a fast spin still ends on the thunk.
		if (next === 0 || next === count) {
			thunk();
			return;
		}
		const now = performance.now();
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (silent()) return;
		if (sound) playClick();
		if (haptics) void haptic("selection");
	};

	// Pushing into an end stop: a thunk and a spring kick past the stop.
	const bump = (direction: Direction) => {
		thunk();
		if (!shouldReduceMotion) {
			springTo(sweepAt(indexRef.current), direction * BUMP_VELOCITY);
		}
	};

	const moveTo = (target: number, commit: boolean) => {
		const previous = indexRef.current;
		const next = clamp(target, 0, count);
		if (next === previous) return false;
		indexRef.current = next;
		setInternalIndex(next);
		if (onValueChange) {
			if (detents.labelled) {
				// Never skip a labelled stop, however far one event turns.
				const direction = next > previous ? 1 : -1;
				for (let i = previous + direction; i !== next; i += direction) {
					onValueChange(detents.valueAt(i));
				}
			}
			onValueChange(detents.valueAt(next));
		}
		cue(next);
		if (commit) onValueCommit?.(detents.valueAt(next));
		return true;
	};

	/** The detent for a travel position, holding the current one until it's clearly left. */
	const indexAt = (raw: number, current: number) => {
		const position = detents.toIndexSpace(clamp(raw, 0, 1));
		if (Math.abs(position - current) < 0.5 + HYSTERESIS) return current;
		return clamp(Math.round(position), 0, count);
	};

	const pointerAngle = (
		event: PointerEvent,
		drag: { centerX: number; centerY: number; scale: number },
	) => {
		const dx = event.clientX - drag.centerX;
		const dy = event.clientY - drag.centerY;
		if (Math.hypot(dx, dy) / drag.scale < CIRCULAR_DEAD_ZONE) return null;
		// Clockwise from the top, like the pointer.
		return (Math.atan2(dx, -dy) * 180) / Math.PI;
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled || event.button !== 0 || dragRef.current) return;
		const knob = event.currentTarget;
		knob.setPointerCapture(event.pointerId);
		knob.focus({ preventScroll: true });
		const rect = knob.getBoundingClientRect();
		// CSS zoom and transforms scale client coordinates; work in local px.
		const scale = rect.width / (knob.offsetWidth || 1) || 1;
		const drag = {
			pointerId: event.pointerId,
			startIndex: indexRef.current,
			raw: detents.fractionAt(indexRef.current),
			originX: event.clientX,
			originY: event.clientY,
			lastY: event.clientY,
			lastAngle: null as number | null,
			centerX: rect.left + rect.width / 2,
			centerY: rect.top + rect.height / 2,
			scale,
			moved: false,
		};
		drag.lastAngle = pointerAngle(event, drag);
		dragRef.current = drag;
		pressMovedRef.current = false;
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (!drag.moved) {
			const travel = Math.hypot(
				event.clientX - drag.originX,
				event.clientY - drag.originY,
			);
			if (travel / drag.scale < DRAG_SLOP) return;
			drag.moved = true;
			pressMovedRef.current = true;
			setInternalIndex(indexRef.current);
			setDragging(true);
		}

		let delta = 0;
		if (dragMode === "circular") {
			const angle = pointerAngle(event, drag);
			if (angle !== null && drag.lastAngle !== null) {
				delta = wrapDegrees(angle - drag.lastAngle) / Math.max(range, 1);
			}
			drag.lastAngle = angle;
		} else {
			delta = (drag.lastY - event.clientY) / drag.scale / DRAG_TRAVEL_PX;
		}
		drag.lastY = event.clientY;
		drag.raw = clamp(
			drag.raw + delta * (event.shiftKey ? FINE_FACTOR : 1),
			-MAX_WINDUP,
			1 + MAX_WINDUP,
		);

		const over = drag.raw < 0 ? drag.raw : drag.raw > 1 ? drag.raw - 1 : 0;
		bandRef.current = shouldReduceMotion ? 0 : rubberBand(over * range);
		// A new detent moves the pointer through the effect; otherwise only the band moved.
		if (!moveTo(indexAt(drag.raw, indexRef.current), false)) {
			springTo(sweepAt(indexRef.current) + bandRef.current);
		}
	};

	const endDrag = (pointerId?: number) => {
		const drag = dragRef.current;
		if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
			return;
		}
		dragRef.current = null;
		const knob = knobRef.current;
		if (knob?.hasPointerCapture(drag.pointerId)) {
			knob.releasePointerCapture(drag.pointerId);
		}
		bandRef.current = 0;
		if (!drag.moved) return;
		setDragging(false);
		springTo(sweepAt(indexRef.current));
		if (indexRef.current !== drag.startIndex) {
			onValueCommit?.(detents.valueAt(indexRef.current));
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;
		// Left and right follow the reading direction, like a native range input.
		const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
		const from = indexRef.current;
		let target: number;
		switch (event.key) {
			case "ArrowUp":
				target = from + 1;
				break;
			case "ArrowDown":
				target = from - 1;
				break;
			case "ArrowRight":
				target = from + (rtl ? -1 : 1);
				break;
			case "ArrowLeft":
				target = from + (rtl ? 1 : -1);
				break;
			case "PageUp":
				target = from + 10;
				break;
			case "PageDown":
				target = from - 10;
				break;
			case "Home":
				target = 0;
				break;
			case "End":
				target = count;
				break;
			default:
				return;
		}
		event.preventDefault();
		const direction: Direction = target > from || event.key === "End" ? 1 : -1;
		if (!moveTo(target, true) && !event.repeat) bump(direction);
	};

	const handleDoubleClick = () => {
		// A press that turned the knob isn't half of a reset.
		if (disabled || pressMovedRef.current) return;
		moveTo(detents.indexOf(defaultValue ?? detents.lower), true);
	};

	// Native listeners call through refs so they always see the latest props.
	const wheelHandlerRef = useRef((event: WheelEvent) => {
		void event;
	});
	const endDragRef = useRef(endDrag);
	useLayoutEffect(() => {
		endDragRef.current = endDrag;
		wheelHandlerRef.current = (event: WheelEvent) => {
			// Pinch zoom arrives as a ctrl wheel; leave it to the browser.
			if (event.ctrlKey || dragRef.current?.moved) return;
			const delta =
				Math.abs(event.deltaY) >= Math.abs(event.deltaX)
					? event.deltaY
					: event.deltaX;
			if (delta === 0) return;
			event.preventDefault();
			const wheel = wheelRef.current;
			const now = performance.now();
			const from = indexRef.current;
			if (now - wheel.at > WHEEL_IDLE_MS) {
				wheel.raw = detents.fractionAt(from);
				wheel.bumped = false;
			}
			wheel.at = now;
			const direction: Direction = delta < 0 ? 1 : -1;
			if (from === (direction > 0 ? count : 0)) {
				// One thunk per wheel gesture, not one per event.
				if (!wheel.bumped) bump(direction);
				wheel.bumped = true;
				return;
			}
			let target: number;
			if (event.deltaMode !== 0 || Math.abs(delta) >= WHEEL_NOTCH_PX) {
				// One notch, one detent.
				target = from + direction;
				wheel.raw = detents.fractionAt(clamp(target, 0, count));
			} else {
				const fine = event.shiftKey ? FINE_FACTOR : 1;
				wheel.raw = clamp(wheel.raw - (delta / DRAG_TRAVEL_PX) * fine, 0, 1);
				target = indexAt(wheel.raw, from);
			}
			if (moveTo(target, true)) wheel.bumped = false;
		};
	});

	// Wheel needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const knob = knobRef.current;
		if (!knob || disabled) return;
		const onWheel = (event: WheelEvent) => wheelHandlerRef.current(event);
		knob.addEventListener("wheel", onWheel, { passive: false });
		return () => knob.removeEventListener("wheel", onWheel);
	}, [disabled]);

	// iOS can still scroll the page under a captured pointer; block it mid-turn.
	useEffect(() => {
		const knob = knobRef.current;
		if (!knob) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current) event.preventDefault();
		};
		knob.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => knob.removeEventListener("touchmove", onTouchMove);
	}, []);

	useEffect(() => {
		if (disabled) endDragRef.current();
	}, [disabled]);

	const showTicks = variant !== "minimal";
	const ticks = showTicks
		? tickIndexes(detents, sizeStyle.maxTicks, range >= 360)
		: [];
	const labelled = detents.labelled;
	const startRotation: CSSProperties = { transform: `rotate(${start}deg)` };
	// Labels ring the dial; below it, reserve only as much room as the lowest label needs.
	const labelRadius = (sizeStyle.dial + sizeStyle.labelSpace) / 2;
	const lowestLabel = Math.max(
		...ticks.map(
			(tick) =>
				-labelRadius * Math.cos(((start + sweepAt(tick)) * Math.PI) / 180),
		),
	);
	const framePadding = labelled
		? {
				padding: sizeStyle.labelSpace,
				paddingBottom: clamp(
					lowestLabel + sizeStyle.labelSpace / 2 - sizeStyle.dial / 2,
					0,
					sizeStyle.labelSpace,
				),
			}
		: undefined;

	return (
		<div
			data-slot="rotary-knob"
			data-variant={variant}
			data-size={size}
			data-state={dragging ? "dragging" : "idle"}
			data-bound={index === 0 ? "min" : index === count ? "max" : undefined}
			data-disabled={disabled || undefined}
			className={cn(
				"group/knob inline-flex w-fit select-none flex-col items-center gap-2 [--rotary-knob-accent:var(--color-orange-500)] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
		>
			<div
				data-slot="rotary-knob-frame"
				className="relative"
				style={framePadding}
			>
				{labelled ? (
					<div
						aria-hidden
						data-slot="rotary-knob-labels"
						// Centered on the dial, which sits off-center when the bottom padding is trimmed.
						className="pointer-events-none absolute top-0 left-0"
						style={{
							width: sizeStyle.dial + sizeStyle.labelSpace * 2,
							height: sizeStyle.dial + sizeStyle.labelSpace * 2,
						}}
					>
						{ticks.map((tick) => {
							const angle = start + sweepAt(tick);
							return (
								<span
									key={tick}
									className="absolute inset-0"
									style={{ transform: `rotate(${angle}deg)` }}
								>
									<span
										className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center justify-center"
										style={{ height: sizeStyle.labelSpace }}
									>
										<span
											className={cn(
												"whitespace-nowrap font-medium text-foreground leading-none transition-opacity duration-150",
												sizeStyle.label,
												tick === index ? "opacity-100" : "opacity-45",
											)}
											style={{ transform: `rotate(${-angle}deg)` }}
										>
											{detents.labelAt(tick)}
										</span>
									</span>
								</span>
							);
						})}
					</div>
				) : null}

				<div
					ref={knobRef}
					role="slider"
					tabIndex={disabled ? -1 : 0}
					aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? "Value")}
					aria-labelledby={ariaLabelledBy}
					aria-valuemin={detents.lower}
					aria-valuemax={detents.upper}
					aria-valuenow={value}
					aria-valuetext={valueText}
					aria-disabled={disabled || undefined}
					data-slot="rotary-knob-dial"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={(event) => endDrag(event.pointerId)}
					onPointerCancel={(event) => endDrag(event.pointerId)}
					onLostPointerCapture={(event) => endDrag(event.pointerId)}
					onKeyDown={handleKeyDown}
					onDoubleClick={handleDoubleClick}
					onContextMenu={(event) => event.preventDefault()}
					className="relative cursor-grab touch-none rounded-full outline-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background group-data-disabled/knob:pointer-events-none group-data-[state=dragging]/knob:cursor-grabbing"
					style={{ width: sizeStyle.dial, height: sizeStyle.dial }}
				>
					{showTicks ? (
						<div
							aria-hidden
							data-slot="rotary-knob-ticks"
							className="pointer-events-none absolute inset-0"
						>
							{ticks.map((tick) => {
								const major = labelled || tick === 0 || tick === count;
								return (
									<span
										key={tick}
										className="absolute inset-0"
										style={{
											transform: `rotate(${start + sweepAt(tick)}deg)`,
										}}
									>
										<span
											className={cn(
												"absolute top-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full bg-foreground transition-opacity duration-150",
												tick <= index ? "opacity-80" : "opacity-20",
											)}
											style={{
												height: major
													? sizeStyle.tick
													: Math.round(sizeStyle.tick * 0.65),
											}}
										/>
									</span>
								);
							})}
						</div>
					) : null}

					{variant === "minimal" ? (
						<div
							aria-hidden
							data-slot="rotary-knob-ring"
							className="pointer-events-none absolute inset-0.5 rounded-full border-2 border-foreground/15"
						/>
					) : (
						<div
							aria-hidden
							data-slot="rotary-knob-arc"
							className="pointer-events-none absolute"
							style={{ inset: sizeStyle.arcInset }}
						>
							<div
								className="absolute inset-0 text-foreground/10"
								style={{
									...ringMask(sizeStyle.arc),
									background: `conic-gradient(from ${start}deg, currentColor 0deg ${range}deg, transparent ${range}deg 360deg)`,
								}}
							/>
							<motion.div
								className="absolute inset-0 rounded-full"
								style={{
									...ringMask(sizeStyle.arc),
									...startRotation,
									opacity: arcOpacity,
								}}
							>
								<div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
									<motion.div
										className="absolute top-0 -left-full h-full w-[200%]"
										style={{ rotate: firstHalf }}
									>
										<div className="absolute inset-y-0 left-0 w-1/2 bg-[var(--rotary-knob-accent)]" />
									</motion.div>
								</div>
								<div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
									<motion.div
										className="absolute top-0 left-0 h-full w-[200%]"
										style={{ rotate: secondHalf }}
									>
										<div className="absolute inset-y-0 right-0 w-1/2 bg-[var(--rotary-knob-accent)]" />
									</motion.div>
								</div>
							</motion.div>
							{/* Round caps at both ends of the arc. */}
							<motion.div
								className="absolute inset-0"
								style={{ ...startRotation, opacity: arcOpacity }}
							>
								<span
									className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-[var(--rotary-knob-accent)]"
									style={{ width: sizeStyle.arc, height: sizeStyle.arc }}
								/>
							</motion.div>
							<div className="absolute inset-0" style={startRotation}>
								<motion.div
									className="absolute inset-0"
									style={{ rotate: arcEnd, opacity: arcOpacity }}
								>
									<span
										className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-[var(--rotary-knob-accent)]"
										style={{ width: sizeStyle.arc, height: sizeStyle.arc }}
									/>
								</motion.div>
							</div>
						</div>
					)}

					{variant === "tactile" ? (
						<div
							aria-hidden
							data-slot="rotary-knob-cap"
							className="pointer-events-none absolute rounded-full shadow-[0_10px_18px_-8px_rgb(0_0_0/0.55),0_3px_6px_-2px_rgb(0_0_0/0.35)]"
							style={{ inset: sizeStyle.cap }}
						>
							{/* The knurled edge turns with the knob; the light stays put. */}
							<motion.div
								className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(rgb(0_0_0/0.22)_0deg_2.5deg,rgb(255_255_255/0.18)_2.5deg_7.5deg)] bg-zinc-300 dark:bg-zinc-700"
								style={{ rotate: sweep }}
							/>
							<div className="absolute inset-0 rounded-full bg-[linear-gradient(to_bottom,rgb(255_255_255/0.45),transparent_45%,rgb(0_0_0/0.3))] dark:bg-[linear-gradient(to_bottom,rgb(255_255_255/0.2),transparent_45%,rgb(0_0_0/0.45))]" />
							<div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_35%_28%,var(--color-zinc-50),var(--color-zinc-200)_55%,var(--color-zinc-300))] shadow-[inset_0_1px_1px_rgb(255_255_255/0.7),0_1px_3px_rgb(0_0_0/0.35)] dark:bg-[radial-gradient(circle_at_35%_28%,var(--color-zinc-500),var(--color-zinc-700)_55%,var(--color-zinc-800))] dark:shadow-[inset_0_1px_1px_rgb(255_255_255/0.25),0_1px_3px_rgb(0_0_0/0.5)]" />
							<div className="absolute inset-[14%]" style={startRotation}>
								<motion.div
									data-slot="rotary-knob-pointer"
									className="absolute inset-0"
									style={{ rotate: sweep }}
								>
									<span className="absolute top-[9%] left-1/2 h-[30%] w-[3px] -translate-x-1/2 rounded-full bg-[var(--rotary-knob-accent)] shadow-[0_0_6px_var(--rotary-knob-accent)]" />
								</motion.div>
							</div>
						</div>
					) : (
						<div
							aria-hidden
							data-slot="rotary-knob-cap"
							className={cn(
								"pointer-events-none absolute rounded-full",
								variant === "default" &&
									"border border-border bg-background shadow-xs dark:border-input dark:bg-input/30",
							)}
							style={{ inset: variant === "minimal" ? 2 : sizeStyle.cap }}
						>
							<div className="absolute inset-0" style={startRotation}>
								<motion.div
									data-slot="rotary-knob-pointer"
									className="absolute inset-0"
									style={{ rotate: sweep }}
								>
									<span
										className={cn(
											"absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-foreground",
											variant === "minimal"
												? "top-[6%] h-[24%]"
												: "top-[10%] h-[30%]",
										)}
									/>
								</motion.div>
							</div>
						</div>
					)}
				</div>
			</div>

			{showValue ? (
				<span
					aria-hidden
					data-slot="rotary-knob-value"
					className={cn(
						"font-medium text-foreground tabular-nums leading-none",
						sizeStyle.value,
					)}
				>
					{valueText}
				</span>
			) : null}
			{name ? (
				<input type="hidden" name={name} value={value} disabled={disabled} />
			) : null}
		</div>
	);
}

export default RotaryKnob;
