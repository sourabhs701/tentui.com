"use client";

import NumberFlow from "@number-flow/react";
import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Shared spring for elastic release, track thickening, and jump transitions. */
const softSpring = {
	type: "spring",
	bounce: 0.18,
	visualDuration: 0.32,
} as const;

/** Critically damped micro-spring for coarse steps and magnetic mark detents. */
const dragSpring = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.1,
} as const;

const digitTiming = {
	duration: 420,
	easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

/** Minimum ms between sound/haptic ticks so fast sweeps never buzz. */
const CUE_THROTTLE_MS = 35;
/** Ranges with more steps than this tick on every 10% instead of every step. */
const MAX_TICKED_STEPS = 40;
/** A dragged handle gently sticks to a mark while within this distance, in px. */
const MARK_STICK_PX = 6;
/** Touch movement, in px, required before claiming a horizontal drag. */
const TOUCH_SLOP = 4;
/** Movement, in px, to disambiguate overlapped handles (`low === high`). */
const AMBIGUOUS_SLOP = 2;
/** Overdrag distance, in px, that triggers a boundary thunk. */
const OVERDRAG_THUNK_PX = 1;
/** Minimum hit target height, in px, for WCAG / Apple HIG touch comfort. */
const MIN_HIT_PX = 44;
/** Maximum elastic nudge, in px, when pushing one handle against `minGap`. */
const PINCH_LIMIT_PX = 3.5;
/** Fraction of `maxStretch` used for one-shot keyboard bumps at a limit. */
const BUMP_STRETCH = 0.35;
/** Horizontal gap, in px, below which the two floating labels merge into one. */
const LABEL_MERGE_GAP_PX = 6;
/** Horizontal gap, in px, above which a merged label splits back apart. */
const LABEL_UNMERGE_GAP_PX = 12;

const sizes = {
	sm: {
		thin: 4,
		thick: 7,
		thumb: 14,
		dot: 4,
		text: "text-xs",
		pill: "h-5 px-1.5 text-[11px] leading-none",
		pillRow: "h-6 mb-1.5",
	},
	md: {
		thin: 6,
		thick: 10,
		thumb: 18,
		dot: 5,
		text: "text-sm",
		pill: "h-6 px-2 text-xs leading-none",
		pillRow: "h-7 mb-2",
	},
	lg: {
		thin: 8,
		thick: 12,
		thumb: 22,
		dot: 6,
		text: "text-base",
		pill: "h-7 px-2.5 text-xs leading-none",
		pillRow: "h-8 mb-2",
	},
} as const;

type Direction = 1 | -1;
type HandleId = "low" | "high";
type DragTarget = HandleId | "span" | "ambiguous";

export type RangeSpanValue = readonly [number, number];

export interface RangeSpanMark {
	value: number;
	/** Shown under the track; clicking it moves the nearest handle there. */
	label?: string;
}

export interface RangeSpanProps
	extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "ref"> {
	/** Visible label, also the range group's accessible name. */
	label: string;
	/** Keeps the label available to screen readers while hiding it visually. */
	hideLabel?: boolean;
	/** Accessible name for the lower handle. Defaults to `"Minimum <label>"`. */
	minLabel?: string;
	/** Accessible name for the upper handle. Defaults to `"Maximum <label>"`. */
	maxLabel?: string;
	/** Controlled `[min, max]` range tuple. */
	value?: RangeSpanValue;
	/** Initial `[min, max]` range when uncontrolled. Defaults to `[min, max]`. */
	defaultValue?: RangeSpanValue;
	/** Called on every change while dragging, clicking, or pressing keys. */
	onValueChange?: (value: [number, number]) => void;
	/** Called once a drag is released, or a click, key press, or mark lands. */
	onValueCommit?: (value: [number, number]) => void;
	/** Minimum bound of the scale. Defaults to `0`. */
	min?: number;
	/** Maximum bound of the scale. Defaults to `100`. */
	max?: number;
	/** Step increment between selectable values. Defaults to `1`. */
	step?: number;
	/** Step used by `Shift`+arrows and `PageUp`/`PageDown`. Defaults to a tenth of the range. */
	largeStep?: number;
	/** Minimum allowed distance between the lower and upper handles. Defaults to `0`. */
	minGap?: number;
	/** Lets users drag the selected fill bar to pan the entire span at once. Defaults to `true`. */
	draggableSpan?: boolean;
	/** Detents that handles gently stick to while dragging. Labelled marks render under the track. */
	marks?: Array<number | RangeSpanMark>;
	/** Formats individual min and max values for readouts, floating labels, and `aria-valuetext`. */
	format?: (value: number) => string;
	/** Controls how live min and max labels are shown: always floating above handles, floating on interaction with a header readout (`"auto"`), or header-only. Defaults to `"floating"`. */
	liveLabels?: "floating" | "auto" | "header";
	/** Size preset controlling track thickness, handle size, and typography. Defaults to `"md"`. */
	size?: keyof typeof sizes;
	/** Furthest the track stretches past either end on overdrag, in px. Defaults to `10`. */
	maxStretch?: number;
	/** Play a soft tick per step or mark and a muted thunk at limits. Defaults to `true`. */
	sound?: boolean;
	/** Trigger subtle haptics on supported devices. Defaults to `true`. */
	haptics?: boolean;
	/** Disables all pointer and keyboard interaction. */
	disabled?: boolean;
	/** Submits both lower and upper values in native forms through hidden inputs. */
	name?: string;
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

/**
 * Square-root rubber-band resistance: tracks 1:1 near the boundary, then eases
 * smoothly toward `max` px without ever exceeding it.
 */
function resist(over: number, max: number) {
	if (over <= 0 || max <= 0) return 0;
	return max * (1 - Math.exp(1 - Math.sqrt(1 + (2 * over) / max)));
}

/** Keeps mark labels at the very start or end flush with the track edges. */
function labelShift(fraction: number) {
	if (fraction < 0.1) return fraction * 5;
	if (fraction > 0.9) return 0.5 + (fraction - 0.9) * 5;
	return 0.5;
}

interface Scale {
	lower: number;
	upper: number;
	step: number;
	minGap: number;
	decimals: number;
	/** Values that emit ticks; `null` ticks on every step. */
	ticks: number[] | null;
	marks: RangeSpanMark[];
	round: (value: number) => number;
	snap: (value: number) => number;
	stepFrom: (value: number, direction: Direction) => number;
	fractionOf: (value: number) => number;
	normalizePair: (pair: RangeSpanValue) => [number, number];
}

function buildScale(
	min: number,
	max: number,
	step: number,
	minGap: number,
	marks?: Array<number | RangeSpanMark>,
): Scale {
	const lower = Number.isFinite(min) ? min : 0;
	const upper = Number.isFinite(max) ? Math.max(max, lower) : lower;
	const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
	const span = upper - lower;
	const safeMinGap = clamp(
		Number.isFinite(minGap) && minGap > 0 ? minGap : 0,
		0,
		span,
	);
	const decimals = Math.max(
		decimalsOf(safeStep),
		decimalsOf(lower),
		decimalsOf(safeMinGap),
	);
	const round = (value: number) => Number(value.toFixed(decimals));

	const snap = (value: number) => {
		if (!(value > lower)) return lower;
		if (value >= upper) return upper;
		const steps = Number(((value - lower) / safeStep).toFixed(9));
		const snapped = round(lower + Math.round(steps) * safeStep);
		if (snapped > upper || upper - value < Math.abs(snapped - value)) {
			return upper;
		}
		return snapped;
	};

	const stepFrom = (value: number, direction: Direction) => {
		const steps = (value - lower) / safeStep;
		const index =
			direction > 0
				? Math.floor(steps + 1e-9) + 1
				: Math.ceil(steps - 1e-9) - 1;
		return clamp(round(lower + index * safeStep), lower, upper);
	};

	const normalizePair = (pair: RangeSpanValue): [number, number] => {
		const rawA = Number.isFinite(pair[0]) ? pair[0] : lower;
		const rawB = Number.isFinite(pair[1]) ? pair[1] : upper;
		const a = snap(Math.min(rawA, rawB));
		const b = snap(Math.max(rawA, rawB));
		if (b - a >= safeMinGap - 1e-9) {
			return [a, b];
		}
		let nextHigh = snap(clamp(a + safeMinGap, lower, upper));
		if (nextHigh - a < safeMinGap - 1e-9 && nextHigh < upper) {
			nextHigh = stepFrom(nextHigh, 1);
		}
		let nextLow = a;
		if (nextHigh - nextLow < safeMinGap - 1e-9) {
			nextLow = snap(clamp(nextHigh - safeMinGap, lower, upper));
			if (nextHigh - nextLow < safeMinGap - 1e-9 && nextLow > lower) {
				nextLow = stepFrom(nextLow, -1);
			}
		}
		return [clamp(nextLow, lower, upper), clamp(nextHigh, lower, upper)];
	};

	const normalizedMarks = (marks ?? [])
		.map((mark) => (typeof mark === "number" ? { value: mark } : mark))
		.filter(
			(mark) =>
				Number.isFinite(mark.value) &&
				mark.value >= lower &&
				mark.value <= upper,
		)
		.map((mark) => ({ ...mark, value: round(mark.value) }))
		.sort((a, b) => a.value - b.value)
		.filter((mark, index, list) => mark.value !== list[index - 1]?.value);

	let ticks: number[] | null;
	if (normalizedMarks.length) {
		ticks = normalizedMarks.map((mark) => mark.value);
	} else if (span / safeStep <= MAX_TICKED_STEPS) {
		ticks = null;
	} else {
		ticks = Array.from({ length: 9 }, (_, index) =>
			snap(lower + ((index + 1) * span) / 10),
		);
	}

	return {
		lower,
		upper,
		step: safeStep,
		minGap: safeMinGap,
		decimals,
		ticks,
		marks: normalizedMarks,
		round,
		snap,
		stepFrom,
		fractionOf: (value) => (span > 0 ? clamp((value - lower) / span, 0, 1) : 0),
		normalizePair,
	};
}

function Readout({
	value,
	text,
	formatted,
	decimals,
	animated,
}: {
	value: number;
	text: string;
	formatted: boolean;
	decimals: number;
	animated: boolean;
}) {
	if (formatted) return <span>{text}</span>;
	return (
		<NumberFlow
			value={value}
			locales="en-US"
			format={{
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
				useGrouping: false,
			}}
			animated={animated}
			respectMotionPreference={false}
			transformTiming={digitTiming}
			spinTiming={digitTiming}
		/>
	);
}

export function RangeSpan({
	label,
	hideLabel = false,
	minLabel,
	maxLabel,
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	min = 0,
	max = 100,
	step = 1,
	largeStep,
	minGap = 0,
	draggableSpan = true,
	marks,
	format,
	liveLabels = "floating",
	size = "md",
	maxStretch = 10,
	sound = true,
	haptics = true,
	disabled = false,
	name,
	className,
	...props
}: RangeSpanProps) {
	const sizeStyle = sizes[size];
	const scale = buildScale(min, max, step, minGap, marks);
	const { lower, upper } = scale;
	const inactive = disabled || upper <= lower;
	const stretchLimit = Math.max(
		0,
		Number.isFinite(maxStretch) ? maxStretch : 0,
	);
	const bigStep =
		largeStep !== undefined && Number.isFinite(largeStep) && largeStep > 0
			? largeStep
			: Math.max(
					scale.step,
					Math.round((upper - lower) / 10 / scale.step) * scale.step,
				);

	const controlled = valueProp !== undefined;
	const [internalPair, setInternalPair] = useState<[number, number]>(() =>
		scale.normalizePair(valueProp ?? defaultValue ?? [lower, upper]),
	);
	const [activeDrag, setActiveDrag] = useState<DragTarget | null>(null);
	const [focusedHandle, setFocusedHandle] = useState<HandleId | null>(null);
	const [hovered, setHovered] = useState(false);
	const [lastMoved, setLastMoved] = useState<HandleId>("high");
	const [rtl, setRtl] = useState(false);
	const [isMerged, setIsMerged] = useState(() => {
		const initial = scale.normalizePair(
			valueProp ?? defaultValue ?? [lower, upper],
		);
		return (
			initial[0] === initial[1] ||
			scale.fractionOf(initial[1]) - scale.fractionOf(initial[0]) < 0.14
		);
	});
	const [measured, setMeasured] = useState(false);

	const dragging = activeDrag !== null;
	const [low, high] = scale.normalizePair(
		controlled && !dragging ? valueProp : internalPair,
	);
	const lowText = format ? format(low) : low.toFixed(scale.decimals);
	const highText = format ? format(high) : high.toFixed(scale.decimals);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, toggle: playToggle } = useTiks({
		respectReducedMotion: false,
	});
	const { click: playBrightClick } = useTiks({
		theme: "crisp",
		respectReducedMotion: false,
	});

	const labelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const lowThumbRef = useRef<HTMLButtonElement>(null);
	const highThumbRef = useRef<HTMLButtonElement>(null);
	const lowPillRef = useRef<HTMLSpanElement>(null);
	const highPillRef = useRef<HTMLSpanElement>(null);
	const mergedPillRef = useRef<HTMLSpanElement>(null);

	const lowFrac = useMotionValue(scale.fractionOf(low));
	const highFrac = useMotionValue(scale.fractionOf(high));
	const stretch = useMotionValue(0);
	const lowOffset = useMotionValue(0);
	const highOffset = useMotionValue(0);
	const thickness = useMotionValue<number>(sizeStyle.thin);
	const trackWidth = useMotionValue(0);
	const direction = useMotionValue<number>(1);
	const lowPillX = useMotionValue(0);
	const highPillX = useMotionValue(0);
	const mergedPillX = useMotionValue(0);

	const lowAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const highAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const stretchAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const lowOffsetAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const highOffsetAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const thicknessAnimRef = useRef<AnimationPlaybackControls | null>(null);

	const pairRef = useRef<[number, number]>([low, high]);
	const mergedRef = useRef(isMerged);
	const pillWidthsRef = useRef({ low: 36, high: 36, merged: 76 });
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const dragRef = useRef<{
		pointerId: number;
		target: DragTarget;
		active: boolean;
		originX: number;
		originY: number;
		originOffset: number;
		grabOffsetPx: number;
		startPair: [number, number];
		overdragged: boolean;
		pinched: boolean;
		jumpedOnDown: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		pairRef.current = [low, high];
	});

	useLayoutEffect(() => {
		mergedRef.current = isMerged;
	}, [isMerged]);

	const trackStart = useTransform(stretch, (s) => `${Math.min(s, 0)}px`);
	const trackEnd = useTransform(stretch, (s) => `${-Math.max(s, 0)}px`);
	const trackHeight = useTransform(thickness, (h) => `${h}px`);

	const fillClipPath = useTransform(() => {
		const w = trackWidth.get();
		const lf = lowFrac.get();
		const hf = highFrac.get();
		const isRtlLayout = direction.get() < 0;
		if (w <= 0) {
			const startPct = clamp(lf * 100, 0, 100);
			const endPct = clamp((1 - hf) * 100, 0, 100);
			return isRtlLayout
				? `inset(0% ${startPct}% 0% ${endPct}% round 9999px)`
				: `inset(0% ${endPct}% 0% ${startPct}% round 9999px)`;
		}
		const s = stretch.get();
		const sStart = Math.min(s, 0);
		const total = w + Math.abs(s);
		const lowPx = lf * w + lowOffset.get();
		const highPx = hf * w + highOffset.get();
		const startInset = clamp(lowPx - sStart, 0, total);
		const endInset = clamp(total - (highPx - sStart), 0, total);
		return isRtlLayout
			? `inset(0px ${startInset}px 0px ${endInset}px round 9999px)`
			: `inset(0px ${endInset}px 0px ${startInset}px round 9999px)`;
	});

	const lowRailTransform = useTransform(() => {
		const dir = direction.get();
		const pct = dir * lowFrac.get() * 100;
		const px = dir * lowOffset.get();
		return `translate3d(calc(${pct}% + ${px}px), 0px, 0px)`;
	});

	const highRailTransform = useTransform(() => {
		const dir = direction.get();
		const pct = dir * highFrac.get() * 100;
		const px = dir * highOffset.get();
		return `translate3d(calc(${pct}% + ${px}px), 0px, 0px)`;
	});

	const spanHitStart = useTransform(() => `${lowFrac.get() * 100}%`);
	const spanHitEnd = useTransform(() => `${(1 - highFrac.get()) * 100}%`);

	const lowPillTransform = useTransform(
		lowPillX,
		(x) => `translate3d(${x}px, 0px, 0px) translateX(-50%)`,
	);
	const highPillTransform = useTransform(
		highPillX,
		(x) => `translate3d(${x}px, 0px, 0px) translateX(-50%)`,
	);
	const mergedPillTransform = useTransform(
		mergedPillX,
		(x) => `translate3d(${x}px, 0px, 0px) translateX(-50%)`,
	);

	const updateFloatingLabels = useCallback(() => {
		if (liveLabels === "header") return;
		const w = trackWidth.get();
		if (w <= 0) return;

		const s = stretch.get();
		const sStart = Math.min(s, 0);
		const sEnd = Math.max(s, 0);
		const isRtlLayout = direction.get() < 0;

		const lowLocal = lowFrac.get() * w + lowOffset.get();
		const highLocal = highFrac.get() * w + highOffset.get();
		const lowPhysical = isRtlLayout ? w - lowLocal : lowLocal;
		const highPhysical = isRtlLayout ? w - highLocal : highLocal;

		const leftBound = isRtlLayout ? -sEnd : sStart;
		const rightBound = isRtlLayout ? w - sStart : w + sEnd;

		const { low: lowW, high: highW, merged: mergedW } = pillWidthsRef.current;

		const clampCenter = (cx: number, pillW: number) => {
			const half = pillW / 2;
			if (rightBound - leftBound <= pillW) {
				return (leftBound + rightBound) / 2;
			}
			return clamp(cx, leftBound + half, rightBound - half);
		};

		const lowCx = clampCenter(lowPhysical, lowW);
		const highCx = clampCenter(highPhysical, highW);
		const mergedCx = clampCenter((lowPhysical + highPhysical) / 2, mergedW);

		lowPillX.set(lowCx);
		highPillX.set(highCx);
		mergedPillX.set(mergedCx);

		const leftPillRightEdge = isRtlLayout
			? highCx + highW / 2
			: lowCx + lowW / 2;
		const rightPillLeftEdge = isRtlLayout
			? lowCx - lowW / 2
			: highCx - highW / 2;
		const gap = rightPillLeftEdge - leftPillRightEdge;

		const [curLow, curHigh] = pairRef.current;
		const shouldMerge =
			curLow === curHigh ||
			(mergedRef.current
				? gap < LABEL_UNMERGE_GAP_PX
				: gap < LABEL_MERGE_GAP_PX);

		if (shouldMerge !== mergedRef.current) {
			mergedRef.current = shouldMerge;
			setIsMerged(shouldMerge);
		}
	}, [
		liveLabels,
		trackWidth,
		stretch,
		direction,
		lowFrac,
		highFrac,
		lowOffset,
		highOffset,
		lowPillX,
		highPillX,
		mergedPillX,
	]);

	useMotionValueEvent(lowFrac, "change", updateFloatingLabels);
	useMotionValueEvent(highFrac, "change", updateFloatingLabels);
	useMotionValueEvent(lowOffset, "change", updateFloatingLabels);
	useMotionValueEvent(highOffset, "change", updateFloatingLabels);
	useMotionValueEvent(stretch, "change", updateFloatingLabels);
	useMotionValueEvent(trackWidth, "change", updateFloatingLabels);

	useLayoutEffect(() => {
		const row = rowRef.current;
		const root = rootRef.current;
		if (!row || !root) return;

		const measure = () => {
			const isRtlLayout = getComputedStyle(root).direction === "rtl";
			direction.set(isRtlLayout ? -1 : 1);
			setRtl(isRtlLayout);
			pillWidthsRef.current = {
				low: lowPillRef.current?.offsetWidth || pillWidthsRef.current.low,
				high: highPillRef.current?.offsetWidth || pillWidthsRef.current.high,
				merged:
					mergedPillRef.current?.offsetWidth || pillWidthsRef.current.merged,
			};
			const nextW = row.offsetWidth;
			trackWidth.set(nextW);
			if (nextW > 0) setMeasured(true);
			updateFloatingLabels();
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		if (lowPillRef.current) observer.observe(lowPillRef.current);
		if (highPillRef.current) observer.observe(highPillRef.current);
		if (mergedPillRef.current) observer.observe(mergedPillRef.current);
		return () => observer.disconnect();
	}, [direction, trackWidth, updateFloatingLabels]);

	useLayoutEffect(() => {
		if (liveLabels === "header") return;
		const nextLow =
			lowPillRef.current?.offsetWidth || pillWidthsRef.current.low;
		const nextHigh =
			highPillRef.current?.offsetWidth || pillWidthsRef.current.high;
		const nextMerged =
			mergedPillRef.current?.offsetWidth || pillWidthsRef.current.merged;
		if (
			nextLow !== pillWidthsRef.current.low ||
			nextHigh !== pillWidthsRef.current.high ||
			nextMerged !== pillWidthsRef.current.merged
		) {
			pillWidthsRef.current = {
				low: nextLow,
				high: nextHigh,
				merged: nextMerged,
			};
			updateFloatingLabels();
		}
	}, [liveLabels, lowText, highText, updateFloatingLabels]);

	const moveFractions = useCallback(
		(
			targetLow: number,
			targetHigh: number,
			transition: "jump" | "drag" | "soft",
		) => {
			lowAnimRef.current?.stop();
			highAnimRef.current?.stop();
			lowAnimRef.current = null;
			highAnimRef.current = null;
			if (shouldReduceMotion || transition === "jump") {
				lowFrac.jump(targetLow);
				highFrac.jump(targetHigh);
				return;
			}
			const spring = transition === "drag" ? dragSpring : softSpring;
			if (lowFrac.get() !== targetLow) {
				lowAnimRef.current = animate(lowFrac, targetLow, spring);
			}
			if (highFrac.get() !== targetHigh) {
				highAnimRef.current = animate(highFrac, targetHigh, spring);
			}
		},
		[lowFrac, highFrac, shouldReduceMotion],
	);

	const releaseElastic = useCallback(() => {
		stretchAnimRef.current?.stop();
		lowOffsetAnimRef.current?.stop();
		highOffsetAnimRef.current?.stop();
		stretchAnimRef.current = null;
		lowOffsetAnimRef.current = null;
		highOffsetAnimRef.current = null;
		if (shouldReduceMotion) {
			stretch.jump(0);
			lowOffset.jump(0);
			highOffset.jump(0);
			return;
		}
		if (stretch.get() !== 0) {
			stretchAnimRef.current = animate(stretch, 0, softSpring);
		}
		if (lowOffset.get() !== 0) {
			lowOffsetAnimRef.current = animate(lowOffset, 0, softSpring);
		}
		if (highOffset.get() !== 0) {
			highOffsetAnimRef.current = animate(highOffset, 0, softSpring);
		}
	}, [shouldReduceMotion, stretch, lowOffset, highOffset]);

	const setThick = useCallback(
		(active: boolean) => {
			thicknessAnimRef.current?.stop();
			thicknessAnimRef.current = null;
			const target = active ? sizeStyle.thick : sizeStyle.thin;
			if (shouldReduceMotion) {
				thickness.jump(sizeStyle.thin);
				return;
			}
			if (thickness.get() === target) return;
			thicknessAnimRef.current = animate(thickness, target, softSpring);
		},
		[shouldReduceMotion, sizeStyle.thick, sizeStyle.thin, thickness],
	);

	useEffect(() => {
		if (!dragRef.current?.active) setThick(false);
	}, [setThick]);

	const targetLowFrac = scale.fractionOf(low);
	const targetHighFrac = scale.fractionOf(high);
	useEffect(() => {
		if (dragRef.current?.active) return;
		moveFractions(targetLowFrac, targetHighFrac, "soft");
	}, [targetLowFrac, targetHighFrac, moveFractions]);

	useEffect(
		() => () => {
			lowAnimRef.current?.stop();
			highAnimRef.current?.stop();
			stretchAnimRef.current?.stop();
			lowOffsetAnimRef.current?.stop();
			highOffsetAnimRef.current?.stop();
			thicknessAnimRef.current?.stop();
		},
		[],
	);

	useEffect(() => {
		if (shouldReduceMotion) {
			stretch.jump(0);
			lowOffset.jump(0);
			highOffset.jump(0);
			thickness.jump(sizeStyle.thin);
		}
	}, [
		shouldReduceMotion,
		stretch,
		lowOffset,
		highOffset,
		thickness,
		sizeStyle.thin,
	]);

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const vibrate = (pattern: "selection" | "rigid" | "light") => {
		if (!haptics) return;
		lastHapticAtRef.current = performance.now();
		void haptic(pattern);
	};

	const thunk = () => {
		if (silent()) return;
		if (sound) playToggle(false);
		vibrate("rigid");
	};

	const cue = (previous: number, next: number) => {
		if (previous === next || silent()) return;
		const now = performance.now();
		if (next === lower || next === upper) {
			lastCueAtRef.current = now;
			if (sound) playBrightClick();
			vibrate("selection");
			return;
		}
		const { ticks } = scale;
		const crossed =
			ticks === null ||
			ticks.some((tick) =>
				next > previous
					? tick > previous && tick <= next
					: tick < previous && tick >= next,
			);
		if (!crossed || now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (sound) playClick();
		vibrate("selection");
	};

	const commit = (next: [number, number]) => {
		onValueCommit?.(next);
		if (performance.now() - lastHapticAtRef.current > CUE_THROTTLE_MS) {
			if (!silent()) vibrate("light");
		}
	};

	const setPair = (
		nextLow: number,
		nextHigh: number,
		movedHandle?: HandleId,
	) => {
		const [prevLow, prevHigh] = pairRef.current;
		if (nextLow === prevLow && nextHigh === prevHigh) return false;
		const next: [number, number] = [nextLow, nextHigh];
		pairRef.current = next;
		setInternalPair(next);
		if (movedHandle) setLastMoved(movedHandle);
		onValueChange?.(next);
		if (nextLow !== prevLow) cue(prevLow, nextLow);
		else if (nextHigh !== prevHigh) cue(prevHigh, nextHigh);
		return true;
	};

	const bump = (
		handle: HandleId,
		towards: Direction,
		isOuterLimit: boolean,
	) => {
		thunk();
		if (shouldReduceMotion) return;
		if (isOuterLimit && stretchLimit > 0) {
			const delta = towards * stretchLimit * BUMP_STRETCH;
			stretchAnimRef.current?.stop();
			const controls = animate(stretch, delta, {
				duration: 0.08,
				ease: "easeOut",
			});
			stretchAnimRef.current = controls;
			if (handle === "low") {
				lowOffsetAnimRef.current?.stop();
				lowOffsetAnimRef.current = animate(lowOffset, delta, {
					duration: 0.08,
					ease: "easeOut",
				});
			} else {
				highOffsetAnimRef.current?.stop();
				highOffsetAnimRef.current = animate(highOffset, delta, {
					duration: 0.08,
					ease: "easeOut",
				});
			}
			void controls.then(() => {
				if (stretchAnimRef.current === controls) releaseElastic();
			});
			return;
		}
		const nudge = towards * 2.5;
		if (handle === "low") {
			lowOffsetAnimRef.current?.stop();
			const controls = animate(lowOffset, nudge, {
				duration: 0.075,
				ease: "easeOut",
			});
			lowOffsetAnimRef.current = controls;
			void controls.then(() => {
				if (lowOffsetAnimRef.current === controls) releaseElastic();
			});
		} else {
			highOffsetAnimRef.current?.stop();
			const controls = animate(highOffset, nudge, {
				duration: 0.075,
				ease: "easeOut",
			});
			highOffsetAnimRef.current = controls;
			void controls.then(() => {
				if (highOffsetAnimRef.current === controls) releaseElastic();
			});
		}
	};

	const isRtl = () => {
		const root = rootRef.current;
		const next = root ? getComputedStyle(root).direction === "rtl" : false;
		direction.set(next ? -1 : 1);
		setRtl(next);
		return next;
	};

	const pointerOffset = (clientX: number) => {
		const row = rowRef.current;
		if (!row) return { offset: 0, width: 0 };
		const rect = row.getBoundingClientRect();
		const width = row.offsetWidth;
		const ratio = rect.width / (width || 1) || 1;
		const fromLeft = (clientX - rect.left) / ratio;
		return {
			offset: direction.get() < 0 ? width - fromLeft : fromLeft,
			width,
		};
	};

	const valueAtOffset = (offset: number, width: number) => {
		const f = width > 0 ? clamp(offset / width, 0, 1) : 0;
		const raw = lower + f * (upper - lower);
		for (const mark of scale.marks) {
			if (
				Math.abs(scale.fractionOf(mark.value) * width - f * width) <=
				MARK_STICK_PX
			) {
				return mark.value;
			}
		}
		return scale.snap(raw);
	};

	const stepPx = () =>
		(trackWidth.get() * scale.step) / Math.max(upper - lower, scale.step);

	const applyElasticValues = (
		nextStretch: number,
		nextLowOffset: number,
		nextHighOffset: number,
	) => {
		if (shouldReduceMotion) return;
		stretchAnimRef.current?.stop();
		lowOffsetAnimRef.current?.stop();
		highOffsetAnimRef.current?.stop();
		stretchAnimRef.current = null;
		lowOffsetAnimRef.current = null;
		highOffsetAnimRef.current = null;
		stretch.set(nextStretch);
		lowOffset.set(nextLowOffset);
		highOffset.set(nextHighOffset);
	};

	const followPointer = (clientX: number, jumped: boolean) => {
		const drag = dragRef.current;
		if (!drag) return;
		const { offset, width } = pointerOffset(clientX);
		if (width <= 0) return;

		if (drag.target === "ambiguous") {
			const delta = offset - drag.originOffset;
			if (Math.abs(delta) < AMBIGUOUS_SLOP) return;
			const [curLow, curHigh] = pairRef.current;
			let resolved: HandleId;
			if (delta < 0) {
				resolved = curLow > lower ? "low" : "high";
			} else {
				resolved = curHigh < upper ? "high" : "low";
			}
			drag.target = resolved;
			setActiveDrag(resolved);
			setLastMoved(resolved);
		}

		const [curLow, curHigh] = pairRef.current;

		if (drag.target === "span") {
			const [startLow, startHigh] = drag.startPair;
			const spanValue = scale.round(startHigh - startLow);
			const deltaPx = offset - drag.originOffset;
			const deltaValue = (deltaPx / width) * (upper - lower);
			const rawLow = startLow + deltaValue;

			let nextLow: number;
			let nextHigh: number;
			let overPx = 0;

			if (rawLow < lower) {
				nextLow = lower;
				nextHigh = scale.round(lower + spanValue);
				overPx = ((rawLow - lower) / (upper - lower)) * width;
			} else if (rawLow + spanValue > upper) {
				nextHigh = upper;
				nextLow = scale.round(upper - spanValue);
				overPx = ((rawLow + spanValue - upper) / (upper - lower)) * width;
			} else {
				nextLow = clamp(
					scale.snap(rawLow),
					lower,
					scale.round(upper - spanValue),
				);
				nextHigh = scale.round(nextLow + spanValue);
			}

			setPair(nextLow, nextHigh);
			const transition = stepPx() > 3 ? "drag" : "jump";
			moveFractions(
				scale.fractionOf(nextLow),
				scale.fractionOf(nextHigh),
				transition,
			);

			if (Math.abs(overPx) >= OVERDRAG_THUNK_PX) {
				if (!drag.overdragged) thunk();
				drag.overdragged = true;
			} else {
				drag.overdragged = false;
			}

			const s = Math.sign(overPx) * resist(Math.abs(overPx), stretchLimit);
			const lo = s < 0 ? s : s * 0.55;
			const hi = s > 0 ? s : s * 0.55;
			applyElasticValues(s, lo, hi);
			return;
		}

		const adjustedOffset = offset - drag.grabOffsetPx;
		const candidate = valueAtOffset(adjustedOffset, width);

		if (drag.target === "low") {
			const maxAllowed = scale.round(curHigh - scale.minGap);
			const nextLow = clamp(candidate, lower, maxAllowed);
			setPair(nextLow, curHigh, "low");

			const onMark = scale.marks.some((mark) => mark.value === nextLow);
			const transition = jumped
				? "soft"
				: onMark || stepPx() > 3
					? "drag"
					: "jump";
			moveFractions(
				scale.fractionOf(nextLow),
				scale.fractionOf(curHigh),
				transition,
			);

			const overLeft = adjustedOffset < 0 ? adjustedOffset : 0;
			const maxAllowedPx = scale.fractionOf(maxAllowed) * width;
			const overRight =
				adjustedOffset > maxAllowedPx ? adjustedOffset - maxAllowedPx : 0;

			if (Math.abs(overLeft) >= OVERDRAG_THUNK_PX) {
				if (!drag.overdragged) thunk();
				drag.overdragged = true;
			} else if (overLeft === 0) {
				drag.overdragged = false;
			}

			if (overRight >= OVERDRAG_THUNK_PX) {
				if (!drag.pinched) thunk();
				drag.pinched = true;
			} else if (overRight === 0) {
				drag.pinched = false;
			}

			if (overLeft < 0) {
				const s = -resist(-overLeft, stretchLimit);
				applyElasticValues(s, s, 0);
			} else if (overRight > 0) {
				const pinchLow = resist(overRight, PINCH_LIMIT_PX);
				const highSpace = Math.max(
					0,
					width - scale.fractionOf(curHigh) * width,
				);
				const pinchHigh = Math.min(resist(overRight, 1.5), highSpace);
				applyElasticValues(0, pinchLow, pinchHigh);
			} else {
				applyElasticValues(0, 0, 0);
			}
			return;
		}

		const minAllowed = scale.round(curLow + scale.minGap);
		const nextHigh = clamp(candidate, minAllowed, upper);
		setPair(curLow, nextHigh, "high");

		const onMark = scale.marks.some((mark) => mark.value === nextHigh);
		const transition = jumped
			? "soft"
			: onMark || stepPx() > 3
				? "drag"
				: "jump";
		moveFractions(
			scale.fractionOf(curLow),
			scale.fractionOf(nextHigh),
			transition,
		);

		const overRight = adjustedOffset > width ? adjustedOffset - width : 0;
		const minAllowedPx = scale.fractionOf(minAllowed) * width;
		const overLeft =
			adjustedOffset < minAllowedPx ? minAllowedPx - adjustedOffset : 0;

		if (overRight >= OVERDRAG_THUNK_PX) {
			if (!drag.overdragged) thunk();
			drag.overdragged = true;
		} else if (overRight === 0) {
			drag.overdragged = false;
		}

		if (overLeft >= OVERDRAG_THUNK_PX) {
			if (!drag.pinched) thunk();
			drag.pinched = true;
		} else if (overLeft === 0) {
			drag.pinched = false;
		}

		if (overRight > 0) {
			const s = resist(overRight, stretchLimit);
			applyElasticValues(s, 0, s);
		} else if (overLeft > 0) {
			const pinchHigh = -resist(overLeft, PINCH_LIMIT_PX);
			const lowSpace = Math.max(0, scale.fractionOf(curLow) * width);
			const pinchLow = -Math.min(resist(overLeft, 1.5), lowSpace);
			applyElasticValues(0, pinchLow, pinchHigh);
		} else {
			applyElasticValues(0, 0, 0);
		}
	};

	const activateDrag = (clientX: number) => {
		const drag = dragRef.current;
		if (!drag || drag.active) return;
		drag.active = true;
		if (controlled) {
			setInternalPair(pairRef.current);
		}
		setActiveDrag(drag.target);
		setThick(true);
		if (drag.target === "low" || drag.target === "high") {
			setLastMoved(drag.target);
		}
		if (drag.jumpedOnDown) {
			followPointer(clientX, true);
		}
	};

	const beginPointerInteraction = (
		event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
		preferredHandle?: HandleId,
	) => {
		if (inactive || !event.isPrimary || event.button !== 0 || dragRef.current) {
			return;
		}
		isRtl();
		const row = rowRef.current;
		if (!row) return;
		row.setPointerCapture(event.pointerId);

		const { offset, width } = pointerOffset(event.clientX);
		const [curLow, curHigh] = pairRef.current;
		const lowPx = scale.fractionOf(curLow) * width;
		const highPx = scale.fractionOf(curHigh) * width;
		const thumbRadius =
			event.pointerType === "touch"
				? Math.max(sizeStyle.thumb / 2 + 12, 24)
				: Math.max(sizeStyle.thumb / 2 + 6, 16);

		let target: DragTarget;
		let grabOffsetPx = 0;
		let jumpedOnDown = false;

		if (curLow === curHigh && Math.abs(offset - lowPx) <= thumbRadius) {
			target = "ambiguous";
			grabOffsetPx = 0;
		} else if (preferredHandle) {
			const distLow = Math.abs(offset - lowPx);
			const distHigh = Math.abs(offset - highPx);
			target =
				distLow === distHigh
					? preferredHandle
					: distLow < distHigh
						? "low"
						: "high";
			grabOffsetPx = offset - (target === "low" ? lowPx : highPx);
		} else if (
			draggableSpan &&
			highPx - lowPx >= sizeStyle.thumb + 14 &&
			offset > lowPx + sizeStyle.thumb / 2 + 4 &&
			offset < highPx - sizeStyle.thumb / 2 - 4
		) {
			target = "span";
			grabOffsetPx = 0;
		} else {
			const distLow = Math.abs(offset - lowPx);
			const distHigh = Math.abs(offset - highPx);
			if (curLow === curHigh) {
				target = offset < lowPx ? "low" : "high";
			} else {
				target = distLow <= distHigh ? "low" : "high";
			}
			const nearThumb = (target === "low" ? distLow : distHigh) <= thumbRadius;
			grabOffsetPx = nearThumb
				? offset - (target === "low" ? lowPx : highPx)
				: 0;
			jumpedOnDown = !nearThumb;
		}

		dragRef.current = {
			pointerId: event.pointerId,
			target,
			active: false,
			originX: event.clientX,
			originY: event.clientY,
			originOffset: offset,
			grabOffsetPx,
			startPair: [curLow, curHigh],
			overdragged: false,
			pinched: false,
			jumpedOnDown,
		};

		// Direct thumb grabs activate immediately even on touch for 1:1 tracking;
		// track pan/jump on touch waits for horizontal intent so page scroll still works.
		if (
			event.pointerType !== "touch" ||
			preferredHandle !== undefined ||
			target === "ambiguous"
		) {
			activateDrag(event.clientX);
		}
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (!drag.active) {
			const dx = Math.abs(event.clientX - drag.originX);
			const dy = Math.abs(event.clientY - drag.originY);
			if (dx < TOUCH_SLOP || dx < dy) return;
			activateDrag(event.clientX);
			followPointer(event.clientX, false);
			return;
		}
		followPointer(event.clientX, false);
	};

	const endDrag = (
		event: PointerEvent<HTMLDivElement>,
		reason: "up" | "cancel",
	) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (!drag.active && reason === "up" && drag.jumpedOnDown) {
			activateDrag(event.clientX);
		}
		dragRef.current = null;
		const row = rowRef.current;
		if (row?.hasPointerCapture(drag.pointerId)) {
			row.releasePointerCapture(drag.pointerId);
		}
		if (!drag.active) return;

		setActiveDrag(null);
		setThick(false);
		releaseElastic();

		const [endLow, endHigh] = pairRef.current;
		moveFractions(scale.fractionOf(endLow), scale.fractionOf(endHigh), "soft");
		if (endLow !== drag.startPair[0] || endHigh !== drag.startPair[1]) {
			commit([endLow, endHigh]);
		}
	};

	const handleThumbKeyDown = (
		handle: HandleId,
		event: KeyboardEvent<HTMLButtonElement>,
	) => {
		if (inactive) return;
		const forward: Direction = isRtl() ? -1 : 1;
		const [curLow, curHigh] = pairRef.current;
		const from = handle === "low" ? curLow : curHigh;
		const minBound =
			handle === "low" ? lower : scale.round(curLow + scale.minGap);
		const maxBound =
			handle === "low" ? scale.round(curHigh - scale.minGap) : upper;

		const by = (towards: Direction): [number, Direction] => [
			event.shiftKey
				? scale.snap(from + towards * bigStep)
				: scale.stepFrom(from, towards),
			towards,
		];

		const moves: Record<string, () => [number, Direction]> = {
			ArrowUp: () => by(1),
			ArrowDown: () => by(-1),
			ArrowRight: () => by(forward),
			ArrowLeft: () => by(-forward as Direction),
			PageUp: () => [scale.snap(from + bigStep), 1],
			PageDown: () => [scale.snap(from - bigStep), -1],
			Home: () => [minBound, -1],
			End: () => [maxBound, 1],
		};

		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		const [target, towards] = move();
		const nextVal = clamp(target, minBound, maxBound);
		const nextLow = handle === "low" ? nextVal : curLow;
		const nextHigh = handle === "high" ? nextVal : curHigh;

		if (setPair(nextLow, nextHigh, handle)) {
			moveFractions(
				scale.fractionOf(nextLow),
				scale.fractionOf(nextHigh),
				"jump",
			);
			commit([nextLow, nextHigh]);
		} else if (!event.repeat) {
			const isOuterLimit =
				(handle === "low" && towards < 0 && curLow === lower) ||
				(handle === "high" && towards > 0 && curHigh === upper);
			bump(handle, towards, isOuterLimit);
		}
	};

	const selectMark = (markValue: number) => {
		if (inactive) return;
		const [curLow, curHigh] = pairRef.current;
		const distLow = Math.abs(markValue - curLow);
		const distHigh = Math.abs(markValue - curHigh);
		let handle: HandleId;
		if (curLow === curHigh) {
			handle = markValue < curLow ? "low" : "high";
		} else {
			handle = distLow <= distHigh ? "low" : "high";
		}
		const nextLow =
			handle === "low"
				? clamp(markValue, lower, scale.round(curHigh - scale.minGap))
				: curLow;
		const nextHigh =
			handle === "high"
				? clamp(markValue, scale.round(curLow + scale.minGap), upper)
				: curHigh;
		if (setPair(nextLow, nextHigh, handle)) {
			moveFractions(
				scale.fractionOf(nextLow),
				scale.fractionOf(nextHigh),
				"soft",
			);
			commit([nextLow, nextHigh]);
		}
		const thumbRef = handle === "low" ? lowThumbRef : highThumbRef;
		thumbRef.current?.focus({ preventScroll: true });
	};

	useEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.active) event.preventDefault();
		};
		row.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => row.removeEventListener("touchmove", onTouchMove);
	}, []);

	useEffect(() => {
		if (!inactive) return;
		dragRef.current = null;
		setActiveDrag(null);
		setThick(false);
		releaseElastic();
	}, [inactive, setThick, releaseElastic]);

	const lowActive =
		activeDrag === "low" || activeDrag === "span" || focusedHandle === "low";
	const highActive =
		activeDrag === "high" || activeDrag === "span" || focusedHandle === "high";
	const anyActive = dragging || focusedHandle !== null;
	const showFloatingPills =
		liveLabels === "floating" ||
		(liveLabels === "auto" && (hovered || anyActive));
	const showHeaderReadout = liveLabels !== "floating";
	const showHeader = !hideLabel || showHeaderReadout;
	const labelledMarks = scale.marks.some((mark) => mark.label);
	const hitInset = Math.max(0, (MIN_HIT_PX - sizeStyle.thick) / 2);
	const isPanReady = draggableSpan && !inactive && high > low;

	const lowReadout = (
		<Readout
			value={low}
			text={lowText}
			formatted={Boolean(format)}
			decimals={scale.decimals}
			animated={!shouldReduceMotion}
		/>
	);
	const highReadout = (
		<Readout
			value={high}
			text={highText}
			formatted={Boolean(format)}
			decimals={scale.decimals}
			animated={!shouldReduceMotion}
		/>
	);

	const pillBaseClass = cn(
		"inline-flex origin-bottom items-center justify-center whitespace-nowrap rounded-md border font-medium tabular-nums shadow-xs",
		shouldReduceMotion
			? "transition-[opacity,background-color,color,border-color] duration-150"
			: "transition-[opacity,background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
		sizeStyle.pill,
	);

	return (
		<div
			ref={rootRef}
			role="group"
			aria-labelledby={labelId}
			data-slot="range-span"
			data-size={size}
			data-live-labels={liveLabels}
			data-state={dragging ? "dragging" : "idle"}
			data-active-handle={activeDrag ?? undefined}
			data-disabled={inactive || undefined}
			onPointerEnter={(event) => {
				if (event.pointerType !== "touch") setHovered(true);
			}}
			onPointerLeave={() => setHovered(false)}
			className={cn(
				"group/range-span flex w-full min-w-0 touch-pan-y select-none flex-col [-webkit-tap-highlight-color:transparent] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				sizeStyle.text,
				className,
			)}
			{...props}
		>
			{showHeader ? (
				<div
					data-slot="range-span-header"
					className={cn(
						"flex items-baseline justify-between gap-3 transition-opacity duration-150 motion-reduce:transition-none",
						liveLabels === "floating" ? "mb-1.5" : "mb-3",
						liveLabels === "auto" && showFloatingPills && "opacity-0",
						hideLabel && "justify-end",
					)}
				>
					<span
						id={labelId}
						className={cn(
							"truncate font-medium text-foreground",
							hideLabel && "sr-only",
						)}
					>
						{label}
					</span>
					{showHeaderReadout ? (
						<span
							aria-hidden="true"
							data-slot="range-span-readout"
							className="flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums"
						>
							<span
								data-slot="range-span-min-readout"
								className={cn(
									"transition-colors duration-150",
									lowActive && "font-medium text-foreground",
								)}
							>
								{lowReadout}
							</span>
							<span className="text-muted-foreground/60">–</span>
							<span
								data-slot="range-span-max-readout"
								className={cn(
									"transition-colors duration-150",
									highActive && "font-medium text-foreground",
								)}
							>
								{highReadout}
							</span>
						</span>
					) : null}
				</div>
			) : (
				<span id={labelId} className="sr-only">
					{label}
				</span>
			)}

			<div className="relative min-w-0">
				{liveLabels !== "header" ? (
					<div
						aria-hidden="true"
						data-slot="range-span-labels"
						className={cn(
							"pointer-events-none relative z-30 w-full",
							liveLabels === "floating"
								? sizeStyle.pillRow
								: "absolute inset-x-0 bottom-full mb-2 h-7",
						)}
					>
						<motion.div
							className="absolute bottom-0 left-0 will-change-transform"
							style={
								measured
									? { transform: lowPillTransform }
									: {
											left: `${(rtl ? 1 - targetLowFrac : targetLowFrac) * 100}%`,
											transform: "translateX(-50%)",
										}
							}
						>
							<span
								ref={lowPillRef}
								data-slot="range-span-min-label"
								data-active={lowActive || undefined}
								className={cn(
									pillBaseClass,
									lowActive
										? "border-transparent bg-foreground text-background shadow-sm"
										: "border-border/80 bg-background/95 text-foreground backdrop-blur-xs [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
									showFloatingPills && !isMerged
										? lowActive && !shouldReduceMotion
											? "-translate-y-0.5 scale-100 opacity-100"
											: "translate-y-0 scale-100 opacity-100"
										: shouldReduceMotion
											? "opacity-0"
											: "translate-y-0.5 scale-95 opacity-0",
								)}
							>
								{lowReadout}
							</span>
						</motion.div>

						<motion.div
							className="absolute bottom-0 left-0 will-change-transform"
							style={
								measured
									? { transform: highPillTransform }
									: {
											left: `${(rtl ? 1 - targetHighFrac : targetHighFrac) * 100}%`,
											transform: "translateX(-50%)",
										}
							}
						>
							<span
								ref={highPillRef}
								data-slot="range-span-max-label"
								data-active={highActive || undefined}
								className={cn(
									pillBaseClass,
									highActive
										? "border-transparent bg-foreground text-background shadow-sm"
										: "border-border/80 bg-background/95 text-foreground backdrop-blur-xs [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
									showFloatingPills && !isMerged
										? highActive && !shouldReduceMotion
											? "-translate-y-0.5 scale-100 opacity-100"
											: "translate-y-0 scale-100 opacity-100"
										: shouldReduceMotion
											? "opacity-0"
											: "translate-y-0.5 scale-95 opacity-0",
								)}
							>
								{highReadout}
							</span>
						</motion.div>

						<motion.div
							className="absolute bottom-0 left-0 will-change-transform"
							style={
								measured
									? { transform: mergedPillTransform }
									: {
											left: `${(rtl ? 1 - (targetLowFrac + targetHighFrac) / 2 : (targetLowFrac + targetHighFrac) / 2) * 100}%`,
											transform: "translateX(-50%)",
										}
							}
						>
							<span
								ref={mergedPillRef}
								data-slot="range-span-merged-label"
								data-active={anyActive || undefined}
								className={cn(
									pillBaseClass,
									"gap-1",
									anyActive
										? "border-transparent bg-foreground text-background shadow-sm"
										: "border-border/80 bg-background/95 text-foreground backdrop-blur-xs [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
									showFloatingPills && isMerged
										? anyActive && !shouldReduceMotion
											? "-translate-y-0.5 scale-100 opacity-100"
											: "translate-y-0 scale-100 opacity-100"
										: shouldReduceMotion
											? "opacity-0"
											: "translate-y-0.5 scale-95 opacity-0",
								)}
							>
								{low === high ? (
									lowReadout
								) : (
									<>
										<span>{lowReadout}</span>
										<span className="opacity-55">–</span>
										<span>{highReadout}</span>
									</>
								)}
							</span>
						</motion.div>
					</div>
				) : null}

				{/* Interactive track row */}
				<div
					ref={rowRef}
					data-slot="range-span-control"
					onPointerDown={(event) => beginPointerInteraction(event)}
					onPointerMove={handlePointerMove}
					onPointerUp={(event) => endDrag(event, "up")}
					onPointerCancel={(event) => endDrag(event, "cancel")}
					onLostPointerCapture={(event) => endDrag(event, "cancel")}
					onContextMenu={(event) => {
						if (dragRef.current) event.preventDefault();
					}}
					className={cn(
						"relative cursor-pointer [-webkit-touch-callout:none] group-data-disabled/range-span:pointer-events-none",
						activeDrag === "span" && "cursor-grabbing",
					)}
					style={{ height: Math.max(sizeStyle.thumb, sizeStyle.thick) }}
				>
					{/* Expands the vertical touch hit target to at least 44px. */}
					<span
						aria-hidden="true"
						className="absolute inset-x-0"
						style={{ top: -hitInset, bottom: -hitInset }}
					/>

					{/* Stretchy track & clipped selected fill */}
					<motion.div
						data-slot="range-span-track"
						className="pointer-events-none absolute inset-y-0 my-auto rounded-full bg-muted"
						style={{
							insetInlineStart: trackStart,
							insetInlineEnd: trackEnd,
							height: trackHeight,
						}}
					>
						<motion.div
							data-slot="range-span-fill"
							className="absolute inset-0 rounded-full bg-foreground will-change-[clip-path]"
							style={{ clipPath: fillClipPath }}
						/>
					</motion.div>

					{/* Grab affordance over the interior of the selected fill when `draggableSpan` is on. */}
					{isPanReady ? (
						<motion.div
							aria-hidden="true"
							data-slot="range-span-pan-zone"
							className={cn(
								"absolute inset-y-0",
								activeDrag === "span" ? "cursor-grabbing" : "cursor-grab",
							)}
							style={{
								insetInlineStart: spanHitStart,
								insetInlineEnd: spanHitEnd,
							}}
						/>
					) : null}

					{/* Lower handle rail (unclipped sibling so thumb and focus ring never slice at 0% or 100%) */}
					<motion.div
						className={cn(
							"pointer-events-none absolute inset-0 will-change-transform",
							lastMoved === "low" || activeDrag === "low" ? "z-20" : "z-10",
						)}
						style={{ transform: lowRailTransform }}
					>
						<button
							ref={lowThumbRef}
							type="button"
							role="slider"
							tabIndex={inactive ? -1 : 0}
							aria-label={minLabel ?? `Minimum ${label}`}
							aria-valuemin={lower}
							aria-valuemax={scale.round(high - scale.minGap)}
							aria-valuenow={low}
							aria-valuetext={lowText}
							aria-orientation="horizontal"
							aria-disabled={inactive || undefined}
							data-slot="range-span-thumb"
							data-handle="low"
							data-active={activeDrag === "low" || undefined}
							onPointerDown={(event) => {
								event.stopPropagation();
								beginPointerInteraction(event, "low");
							}}
							onKeyDown={(event) => handleThumbKeyDown("low", event)}
							onFocus={(event) => {
								setLastMoved("low");
								if (event.currentTarget.matches(":focus-visible")) {
									setFocusedHandle("low");
								}
							}}
							onBlur={() =>
								setFocusedHandle((current) =>
									current === "low" ? null : current,
								)
							}
							className="group/range-span-thumb pointer-events-auto absolute top-1/2 flex size-11 cursor-grab touch-none items-center justify-center rounded-full outline-none active:cursor-grabbing disabled:pointer-events-none"
							style={{
								insetInlineStart: 0,
								translate: `${rtl ? "50%" : "-50%"} -50%`,
							}}
						>
							<span
								className={cn(
									"flex items-center justify-center rounded-full border-2 border-foreground bg-background shadow-[0_1px_3px_rgba(0,0,0,0.16),0_1px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
									shouldReduceMotion
										? "transition-shadow duration-150"
										: "transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/range-span-thumb:scale-110",
									activeDrag === "low" &&
										(shouldReduceMotion
											? "ring-4 ring-foreground/15"
											: "scale-115 ring-4 ring-foreground/15"),
									"group-focus-visible/range-span-thumb:ring-3 group-focus-visible/range-span-thumb:ring-ring/50 group-focus-visible/range-span-thumb:ring-offset-2 group-focus-visible/range-span-thumb:ring-offset-background",
								)}
								style={{
									width: sizeStyle.thumb,
									height: sizeStyle.thumb,
								}}
							>
								<span
									aria-hidden="true"
									className={cn(
										"rounded-full bg-foreground/25 transition-colors duration-150 group-hover/range-span-thumb:bg-foreground/60",
										activeDrag === "low" && "bg-foreground/80",
									)}
									style={{
										width: sizeStyle.dot,
										height: sizeStyle.dot,
									}}
								/>
							</span>
						</button>
					</motion.div>

					{/* Upper handle rail */}
					<motion.div
						className={cn(
							"pointer-events-none absolute inset-0 will-change-transform",
							lastMoved === "high" || activeDrag === "high" ? "z-20" : "z-10",
						)}
						style={{ transform: highRailTransform }}
					>
						<button
							ref={highThumbRef}
							type="button"
							role="slider"
							tabIndex={inactive ? -1 : 0}
							aria-label={maxLabel ?? `Maximum ${label}`}
							aria-valuemin={scale.round(low + scale.minGap)}
							aria-valuemax={upper}
							aria-valuenow={high}
							aria-valuetext={highText}
							aria-orientation="horizontal"
							aria-disabled={inactive || undefined}
							data-slot="range-span-thumb"
							data-handle="high"
							data-active={activeDrag === "high" || undefined}
							onPointerDown={(event) => {
								event.stopPropagation();
								beginPointerInteraction(event, "high");
							}}
							onKeyDown={(event) => handleThumbKeyDown("high", event)}
							onFocus={(event) => {
								setLastMoved("high");
								if (event.currentTarget.matches(":focus-visible")) {
									setFocusedHandle("high");
								}
							}}
							onBlur={() =>
								setFocusedHandle((current) =>
									current === "high" ? null : current,
								)
							}
							className="group/range-span-thumb pointer-events-auto absolute top-1/2 flex size-11 cursor-grab touch-none items-center justify-center rounded-full outline-none active:cursor-grabbing disabled:pointer-events-none"
							style={{
								insetInlineStart: 0,
								translate: `${rtl ? "50%" : "-50%"} -50%`,
							}}
						>
							<span
								className={cn(
									"flex items-center justify-center rounded-full border-2 border-foreground bg-background shadow-[0_1px_3px_rgba(0,0,0,0.16),0_1px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
									shouldReduceMotion
										? "transition-shadow duration-150"
										: "transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/range-span-thumb:scale-110",
									activeDrag === "high" &&
										(shouldReduceMotion
											? "ring-4 ring-foreground/15"
											: "scale-115 ring-4 ring-foreground/15"),
									"group-focus-visible/range-span-thumb:ring-3 group-focus-visible/range-span-thumb:ring-ring/50 group-focus-visible/range-span-thumb:ring-offset-2 group-focus-visible/range-span-thumb:ring-offset-background",
								)}
								style={{
									width: sizeStyle.thumb,
									height: sizeStyle.thumb,
								}}
							>
								<span
									aria-hidden="true"
									className={cn(
										"rounded-full bg-foreground/25 transition-colors duration-150 group-hover/range-span-thumb:bg-foreground/60",
										activeDrag === "high" && "bg-foreground/80",
									)}
									style={{
										width: sizeStyle.dot,
										height: sizeStyle.dot,
									}}
								/>
							</span>
						</button>
					</motion.div>
				</div>

				{scale.marks.length ? (
					<div
						aria-hidden="true"
						data-slot="range-span-marks"
						className={cn(
							"pointer-events-none relative mt-2",
							labelledMarks ? "h-8" : "h-1",
						)}
					>
						{scale.marks.map((mark) => {
							const f = scale.fractionOf(mark.value);
							const shift = (rtl ? 100 : -100) * labelShift(f);
							const inRange = mark.value >= low && mark.value <= high;
							return (
								<span
									key={mark.value}
									className="absolute top-0"
									style={{ insetInlineStart: `${f * 100}%` }}
								>
									<span
										className={cn(
											"absolute top-0 h-1 w-px transition-colors duration-150",
											inRange ? "bg-foreground/55" : "bg-foreground/20",
										)}
										style={{
											insetInlineStart: 0,
											translate: `${rtl ? 50 : -50}% 0`,
										}}
									/>
									{mark.label ? (
										<button
											type="button"
											tabIndex={-1}
											disabled={inactive}
											onClick={() => selectMark(mark.value)}
											className={cn(
												"pointer-events-auto absolute top-0 inline-flex min-h-8 cursor-pointer items-center whitespace-nowrap px-1.5 pt-1 text-xs tabular-nums leading-4 transition-colors duration-150 disabled:cursor-not-allowed",
												mark.value === low || mark.value === high
													? "font-medium text-foreground"
													: inRange
														? "text-foreground/75 hover:text-foreground"
														: "text-muted-foreground hover:text-foreground",
											)}
											style={{
												insetInlineStart: 0,
												translate: `${shift}% 0`,
											}}
										>
											{mark.label}
										</button>
									) : null}
								</span>
							);
						})}
					</div>
				) : null}
			</div>

			{name ? (
				<>
					<input type="hidden" name={name} value={low} disabled={inactive} />
					<input type="hidden" name={name} value={high} disabled={inactive} />
				</>
			) : null}
		</div>
	);
}

export default RangeSpan;
