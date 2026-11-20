"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useTiks } from "@rexa-developer/tiks/react";
import { ArrowUpRight } from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type PointerEvent,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Taps, keys, resets, and controlled changes glide on this spring. */
const softSpring = {
	type: "spring",
	bounce: 0.15,
	visualDuration: 0.35,
} as const;
/** Follows the pointer from point to point while dragging. */
const dragSpring = { type: "spring", bounce: 0, visualDuration: 0.12 } as const;
const digitTiming = {
	duration: 450,
	easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

/** Minimum ms between ticks, so a fast drag never buzzes. */
const CUE_THROTTLE_MS = 35;
/** Above this many points, ticks fall on every nth point instead of every one. */
const MAX_TICKED_POINTS = 60;
/** Dense data ticks about this many times across the full width. */
const TICKS_ACROSS = 40;
/** A press this close to a handle, in px, grabs it. */
const HANDLE_HIT_PX = 14;
/** Room, in px, at each side of the plot for the grips and dots. */
const PLOT_INSET_X = 12;
/** Room, in px, above the curve. */
const PLOT_INSET_TOP = 14;
/** Room, in px, below the curve, so the grips on the baseline never cover it. */
const PLOT_INSET_BOTTOM = 32;
/** The baseline the grips sit on, in px above the plot's bottom edge. */
const BASELINE_OFFSET = 13;
/** Pointer travel, in px, before a press on the empty plot becomes a sweep. */
const SWEEP_SLOP = 3;
/** Touch travel, in px, before a press becomes a drag. */
const TOUCH_SLOP = 6;
/** Pulling this far past the plot's edge, in px, counts as pushing a limit. */
const PUSH_PX = 6;
/** Width of a grip plus the gap kept between two grips, in px. */
const GRIP_SPACE = 12;
/** Space, in px, kept between the two date chips before they merge. */
const CHIP_GAP = 6;
const DAY_MS = 86_400_000;
/** A true minus sign, as wide as the plus it swaps with. */
const MINUS = "\u2212";
const DEFAULT_VALUE_FORMAT: Format = { maximumFractionDigits: 2 };
const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
};

export interface ChartBrushDatum {
	/** A `Date`, an ISO string, or a timestamp in ms. */
	date: Date | string | number;
	value: number;
}

export interface ChartBrushRange {
	/** Index of the first selected point, in date order. */
	start: number;
	/** Index of the last selected point, in date order. */
	end: number;
}

export interface ChartBrushProps
	extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "ref"> {
	/** One series of points. Sorted by date for you. */
	data: ChartBrushDatum[];
	/** Shown in the header, and the chart's accessible name. */
	label: string;
	/** Keeps the label for assistive technology only. */
	hideLabel?: boolean;
	/** Controlled selection, as point indices in date order. */
	value?: ChartBrushRange;
	/** Initial selection when uncontrolled. Defaults to every point. Double-click and `Escape` return here. */
	defaultValue?: ChartBrushRange;
	/** Called on every change while dragging, sweeping, or pressing keys. */
	onValueChange?: (range: ChartBrushRange) => void;
	/** Called once a drag or tap lands, and on every key press that moves the selection. */
	onValueCommit?: (range: ChartBrushRange) => void;
	/** Fewest steps between the two handles. */
	minSpan?: number;
	/** `area` fills under the selected stretch; `line` draws the stroke only. */
	variant?: "area" | "line";
	/** Which direction counts as good: `down` suits latency, costs, or errors. */
	positive?: "up" | "down";
	/** Intl number options for values and the change. The digits roll. */
	valueFormat?: Format;
	/** Intl date options for the handle chips. */
	dateFormat?: Intl.DateTimeFormatOptions;
	/** Locale for numbers and dates. */
	locale?: string;
	/** Height of the plot in px. */
	height?: number;
	/** Play a tick per point crossed and a thunk at the limits. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	className?: string;
}

type Mode = "start" | "end" | "either" | "pan" | "sweep";
type Edge = "start" | "end" | "window";

interface Point {
	date: Date;
	time: number;
	value: number;
}

interface Geometry {
	width: number;
	xs: number[];
	ys: number[];
	line: string;
	area: string;
	/** The y the area rests on and the grips sit on. */
	baseline: number;
	grid: number[];
	/** Position on the curve at a fractional point index. */
	pointAt: (index: number) => { x: number; y: number };
	/** Fractional point index under a plot x, clamped to the data. */
	indexAt: (x: number) => number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function toPoints(data: ChartBrushDatum[]): Point[] {
	return data
		.map((datum) => {
			const date =
				datum.date instanceof Date ? datum.date : new Date(datum.date);
			return { date, time: date.getTime(), value: datum.value };
		})
		.filter(
			(point) => Number.isFinite(point.time) && Number.isFinite(point.value),
		)
		.sort((a, b) => a.time - b.time);
}

/**
 * Tangents for a monotone cubic through the points, so the curve never
 * overshoots a peak or dips below a trough between two points.
 */
function monotoneTangents(xs: number[], ys: number[]) {
	const n = xs.length;
	const secants = Array.from({ length: n - 1 }, (_, i) => {
		const dx = xs[i + 1] - xs[i];
		return dx > 0 ? (ys[i + 1] - ys[i]) / dx : 0;
	});
	const tangents = new Array<number>(n).fill(0);
	for (let i = 1; i < n - 1; i++) {
		const s0 = secants[i - 1];
		const s1 = secants[i];
		const h0 = xs[i] - xs[i - 1];
		const h1 = xs[i + 1] - xs[i];
		if (s0 * s1 <= 0 || h0 + h1 <= 0) continue;
		const p = (s0 * h1 + s1 * h0) / (h0 + h1);
		tangents[i] =
			(Math.sign(s0) + Math.sign(s1)) *
			Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
	}
	if (n > 1) {
		const end = (inner: number, secant: number) => {
			const t = (3 * secant - inner) / 2;
			return Math.sign(t) === Math.sign(secant) ? t : 0;
		};
		tangents[0] = n > 2 ? end(tangents[1], secants[0]) : secants[0];
		tangents[n - 1] =
			n > 2 ? end(tangents[n - 2], secants[n - 2]) : secants[n - 2];
	}
	return tangents;
}

function buildGeometry(
	points: Point[],
	width: number,
	height: number,
): Geometry | null {
	const n = points.length;
	if (n < 2 || width <= PLOT_INSET_X * 2) return null;
	const first = points[0].time;
	const last = points[n - 1].time;
	const left = PLOT_INSET_X;
	const right = width - PLOT_INSET_X;
	const timed = last > first;
	const xs = points.map((point, index) =>
		timed
			? left + ((point.time - first) / (last - first)) * (right - left)
			: left + (index / (n - 1)) * (right - left),
	);

	let low = Math.min(...points.map((point) => point.value));
	let high = Math.max(...points.map((point) => point.value));
	if (high === low) {
		// A flat series sits mid-plot instead of on the floor.
		const pad = Math.abs(high) * 0.1 || 1;
		low -= pad;
		high += pad;
	}
	const top = PLOT_INSET_TOP;
	const bottom = height - PLOT_INSET_BOTTOM;
	const baseline = height - BASELINE_OFFSET;
	const ys = points.map(
		(point) => bottom - ((point.value - low) / (high - low)) * (bottom - top),
	);
	const tangents = monotoneTangents(xs, ys);

	let line = `M${xs[0]},${ys[0]}`;
	for (let i = 0; i < n - 1; i++) {
		const dx = (xs[i + 1] - xs[i]) / 3;
		line += `C${xs[i] + dx},${ys[i] + dx * tangents[i]},${xs[i + 1] - dx},${
			ys[i + 1] - dx * tangents[i + 1]
		},${xs[i + 1]},${ys[i + 1]}`;
	}
	const area = `${line}L${xs[n - 1]},${baseline}L${xs[0]},${baseline}Z`;

	const pointAt = (index: number) => {
		const fi = clamp(index, 0, n - 1);
		const i = Math.min(Math.floor(fi), n - 2);
		const t = fi - i;
		const dx = xs[i + 1] - xs[i];
		// The control points sit at a third and two thirds of dx, so x is linear in t.
		const p0 = ys[i];
		const p1 = ys[i] + (dx / 3) * tangents[i];
		const p2 = ys[i + 1] - (dx / 3) * tangents[i + 1];
		const p3 = ys[i + 1];
		const u = 1 - t;
		return {
			x: xs[i] + dx * t,
			y:
				u * u * u * p0 +
				3 * u * u * t * p1 +
				3 * u * t * t * p2 +
				t * t * t * p3,
		};
	};

	const indexAt = (x: number) => {
		if (x <= xs[0]) return 0;
		if (x >= xs[n - 1]) return n - 1;
		let lo = 0;
		let hi = n - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (xs[mid] <= x) lo = mid;
			else hi = mid;
		}
		const dx = xs[hi] - xs[lo];
		return lo + (dx > 0 ? (x - xs[lo]) / dx : 0);
	};

	return {
		width,
		xs,
		ys,
		line,
		area,
		baseline,
		grid: [0, 0.5, 1].map((f) => top + f * (bottom - top)),
		pointAt,
		indexAt,
	};
}

function normalizeRange(
	range: ChartBrushRange | undefined,
	count: number,
	minSpan: number,
): ChartBrushRange {
	const last = Math.max(count - 1, 0);
	if (!range) return { start: 0, end: last };
	const a = clamp(Math.round(range.start), 0, last);
	const b = clamp(Math.round(range.end), 0, last);
	let start = Math.min(a, b);
	let end = Math.max(a, b);
	if (end - start < minSpan) {
		end = Math.min(start + minSpan, last);
		start = Math.max(end - minSpan, 0);
	}
	return { start, end };
}

function sameRange(a: ChartBrushRange, b: ChartBrushRange) {
	return a.start === b.start && a.end === b.end;
}

function durationText(ms: number, locale: string) {
	const unit = (value: number, name: "day" | "hour" | "minute") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit: name,
			unitDisplay: "long",
			maximumFractionDigits: 0,
		}).format(value);
	// Whole days read as days; a stretch like 26 hours stays in hours.
	const wholeDays =
		ms % DAY_MS < 3_600_000 || DAY_MS - (ms % DAY_MS) < 3_600_000;
	if (ms >= 2 * DAY_MS || (ms >= DAY_MS && wholeDays)) {
		return unit(Math.round(ms / DAY_MS), "day");
	}
	if (ms >= 3_600_000) return unit(Math.round(ms / 3_600_000), "hour");
	return unit(Math.max(1, Math.round(ms / 60_000)), "minute");
}

export function ChartBrush({
	data,
	label,
	hideLabel = false,
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	minSpan: minSpanProp = 1,
	variant = "area",
	positive = "up",
	valueFormat = DEFAULT_VALUE_FORMAT,
	dateFormat = DEFAULT_DATE_FORMAT,
	locale = "en-US",
	height = 176,
	sound = true,
	haptics = true,
	disabled = false,
	className,
	...props
}: ChartBrushProps) {
	const points = useMemo(() => toPoints(data), [data]);
	const count = points.length;
	const last = Math.max(count - 1, 0);
	const minSpan = clamp(
		Math.round(Number.isFinite(minSpanProp) ? minSpanProp : 1),
		1,
		Math.max(last, 1),
	);
	const inactive = disabled || count < 2;
	const bigStep = Math.max(1, Math.round(count / 10));
	const tickStride =
		count > MAX_TICKED_POINTS ? Math.ceil(count / TICKS_ACROSS) : 1;

	const resetRange = normalizeRange(defaultValue, count, minSpan);
	const controlled = valueProp !== undefined;
	const [internalRange, setInternalRange] = useState(() =>
		normalizeRange(valueProp ?? defaultValue, count, minSpan),
	);
	const [dragMode, setDragMode] = useState<Mode | null>(null);
	// A drag in progress wins over the `value` prop; it syncs on release.
	const range = normalizeRange(
		controlled && !dragMode ? valueProp : internalRange,
		count,
		minSpan,
	);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const [announcement, setAnnouncement] = useState("");

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, toggle: playToggle } = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});
	// The crisp theme's click is a touch brighter: it marks the first and last points.
	const { click: playBrightClick } = useTiks({
		theme: "crisp",
		respectReducedMotion: false,
	});

	const labelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const gradientId = `chart-brush-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
	const plotRef = useRef<HTMLDivElement>(null);
	const inkRef = useRef<HTMLDivElement>(null);
	const bandRef = useRef<HTMLDivElement>(null);
	const startRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const startDotRef = useRef<HTMLSpanElement>(null);
	const endDotRef = useRef<HTMLSpanElement>(null);
	const startChipRef = useRef<HTMLSpanElement>(null);
	const endChipRef = useRef<HTMLSpanElement>(null);
	const mergedChipRef = useRef<HTMLSpanElement>(null);

	const [width, setWidth] = useState(0);
	const geometry = useMemo(
		() => buildGeometry(points, width, height),
		[points, width, height],
	);
	const geometryRef = useRef(geometry);
	geometryRef.current = geometry;

	// Fractional point indices, so the handles glide along the curve between points.
	const startIndex = useMotionValue(range.start);
	const endIndex = useMotionValue(range.end);
	const animationsRef = useRef<{
		start: AnimationPlaybackControls | null;
		end: AnimationPlaybackControls | null;
	}>({ start: null, end: null });
	const rangeRef = useRef(range);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const chipWidthsRef = useRef({ start: 0, end: 0, merged: 0 });
	const chipTextRef = useRef<(index: number) => string>(() => "");
	const dragRef = useRef<{
		pointerId: number;
		pointerType: string;
		mode: Mode;
		active: boolean;
		originX: number;
		originY: number;
		originIndex: number;
		anchor: number;
		before: ChartBrushRange;
		pushed: boolean;
		/** No move has landed yet; a sweep's first one jumps to the pointer. */
		fresh: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		rangeRef.current = range;
	});

	useLayoutEffect(() => {
		const plot = plotRef.current;
		if (!plot) return;
		const measure = () => setWidth(plot.offsetWidth);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(plot);
		return () => observer.disconnect();
	}, []);

	/** Writes the handles, band, ink clip, and chips straight to the DOM, every frame. */
	const paint = useCallback(() => {
		const geo = geometryRef.current;
		if (!geo) return;
		const a = geo.pointAt(startIndex.get());
		const b = geo.pointAt(endIndex.get());
		const ink = inkRef.current;
		if (ink) {
			ink.style.clipPath = `inset(0 ${geo.width - b.x}px 0 ${a.x}px)`;
		}
		const band = bandRef.current;
		if (band) {
			band.style.transform = `translateX(${a.x}px)`;
			band.style.width = `${Math.max(b.x - a.x, 0)}px`;
		}
		// Handles a step apart nudge their grips outward so they sit side by side.
		const shift = Math.max(GRIP_SPACE - (b.x - a.x), 0) / 2;
		if (startRef.current) {
			startRef.current.style.transform = `translateX(${a.x}px)`;
			startRef.current.style.setProperty("--grip-shift", `${-shift}px`);
		}
		if (endRef.current) {
			endRef.current.style.transform = `translateX(${b.x}px)`;
			endRef.current.style.setProperty("--grip-shift", `${shift}px`);
		}
		if (startDotRef.current) {
			startDotRef.current.style.transform = `translate(${a.x}px, ${a.y}px)`;
		}
		if (endDotRef.current) {
			endDotRef.current.style.transform = `translate(${b.x}px, ${b.y}px)`;
		}

		// Chips name the points the handles are over right now, so a gliding
		// handle ticks through its dates instead of jumping to the last one.
		const lastIndex = geo.xs.length - 1;
		const startText = chipTextRef.current(
			clamp(Math.round(startIndex.get()), 0, lastIndex),
		);
		const endText = chipTextRef.current(
			clamp(Math.round(endIndex.get()), 0, lastIndex),
		);
		const texts: [HTMLSpanElement | null, string][] = [
			[startChipRef.current, startText],
			[endChipRef.current, endText],
			[mergedChipRef.current, `${startText} – ${endText}`],
		];
		let resized = false;
		for (const [chip, text] of texts) {
			if (chip && chip.textContent !== text) {
				chip.textContent = text;
				resized = true;
			}
		}
		if (resized) {
			chipWidthsRef.current = {
				start: startChipRef.current?.offsetWidth ?? 0,
				end: endChipRef.current?.offsetWidth ?? 0,
				merged: mergedChipRef.current?.offsetWidth ?? 0,
			};
		}

		const widths = chipWidthsRef.current;
		const place = (center: number, chipWidth: number) =>
			clamp(center - chipWidth / 2, 0, Math.max(geo.width - chipWidth, 0));
		const left0 = place(a.x, widths.start);
		const left1 = place(b.x, widths.end);
		// Chips that would touch merge into one "start – end" chip.
		const merged = left0 + widths.start + CHIP_GAP > left1;
		const chips: [HTMLSpanElement | null, number, boolean][] = [
			[startChipRef.current, left0, !merged],
			[endChipRef.current, left1, !merged],
			[mergedChipRef.current, place((a.x + b.x) / 2, widths.merged), merged],
		];
		for (const [chip, left, shown] of chips) {
			if (!chip) continue;
			chip.style.transform = `translateX(${left}px)`;
			chip.dataset.shown = shown ? "true" : "false";
		}
	}, [startIndex, endIndex]);

	useMotionValueEvent(startIndex, "change", paint);
	useMotionValueEvent(endIndex, "change", paint);

	// Repaint after every render, for new geometry, formats, or data.
	useLayoutEffect(() => {
		paint();
	});

	const moveIndex = useCallback(
		(
			edge: "start" | "end",
			target: number,
			transition: "soft" | "drag" | "jump",
		) => {
			const motionValue = edge === "start" ? startIndex : endIndex;
			animationsRef.current[edge]?.stop();
			animationsRef.current[edge] = null;
			const geo = geometryRef.current;
			// Dense data moves a px or two per point; springing it would only lag.
			const stepPx = geo ? geo.width / Math.max(count, 1) : 0;
			if (
				shouldReduceMotion ||
				transition === "jump" ||
				(transition === "drag" && stepPx < 3)
			) {
				motionValue.jump(target);
				return;
			}
			if (motionValue.get() === target) return;
			animationsRef.current[edge] = animate(
				motionValue,
				target,
				transition === "drag" ? dragSpring : softSpring,
			);
		},
		[startIndex, endIndex, count, shouldReduceMotion],
	);

	// The handles follow the selection; drags move them themselves.
	useEffect(() => {
		if (dragRef.current?.active) return;
		moveIndex("start", range.start, "soft");
		moveIndex("end", range.end, "soft");
	}, [range.start, range.end, moveIndex]);

	useEffect(
		() => () => {
			animationsRef.current.start?.stop();
			animationsRef.current.end?.stop();
		},
		[],
	);

	const formatNumber = useMemo(
		() => new Intl.NumberFormat(locale, valueFormat),
		[locale, valueFormat],
	);
	const formatValue = (value: number) =>
		formatNumber
			.formatToParts(value)
			.map((part) => (part.type === "minusSign" ? MINUS : part.value))
			.join("");
	const formatDate = useMemo(
		() => new Intl.DateTimeFormat(locale, dateFormat),
		[locale, dateFormat],
	);
	chipTextRef.current = (index) => {
		const point = points[index];
		return point ? formatDate.format(point.date) : "";
	};
	const formatLongDate = useMemo(
		() =>
			new Intl.DateTimeFormat(
				locale,
				// `dateStyle` and `timeStyle` can't be mixed with single fields like `weekday`.
				dateFormat.dateStyle || dateFormat.timeStyle
					? dateFormat
					: { weekday: "short", ...dateFormat },
			),
		[locale, dateFormat],
	);

	const describe = (next: ChartBrushRange) => {
		const from = points[next.start];
		const to = points[next.end];
		if (!from || !to) return { change: 0, ratio: null as number | null };
		const change = to.value - from.value;
		return {
			change,
			ratio: from.value !== 0 ? change / Math.abs(from.value) : null,
		};
	};

	const summarize = (next: ChartBrushRange) => {
		const from = points[next.start];
		const to = points[next.end];
		if (!from || !to) return "";
		const { change, ratio } = describe(next);
		const direction = change > 0 ? "up" : change < 0 ? "down" : "unchanged";
		const amount =
			ratio !== null
				? new Intl.NumberFormat(locale, {
						style: "percent",
						maximumFractionDigits: 1,
					}).format(Math.abs(ratio))
				: formatNumber.format(Math.abs(change));
		return `${formatDate.format(from.date)} to ${formatDate.format(to.date)}, ${
			direction === "unchanged" ? direction : `${direction} ${amount}`
		}`;
	};

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

	// Called only for user input, so first render and prop changes stay quiet.
	const cue = (previous: number, next: number) => {
		if (previous === next || silent()) return;
		const now = performance.now();
		// The first and last points always sound, a little brighter.
		if (next === 0 || next === last) {
			lastCueAtRef.current = now;
			if (sound) playBrightClick();
			vibrate("selection");
			return;
		}
		const crossed =
			tickStride === 1 ||
			Math.floor(previous / tickStride) !== Math.floor(next / tickStride);
		if (!crossed || now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (sound) playClick();
		vibrate("selection");
	};

	const setRange = (next: ChartBrushRange) => {
		const previous = rangeRef.current;
		if (sameRange(previous, next)) return false;
		rangeRef.current = next;
		setInternalRange(next);
		onValueChange?.(next);
		if (next.start !== previous.start) cue(previous.start, next.start);
		else cue(previous.end, next.end);
		return true;
	};

	const commit = (next: ChartBrushRange, announce: boolean) => {
		onValueCommit?.(next);
		if (announce) setAnnouncement(summarize(next));
		// A tick's haptic already confirmed this change; don't double up.
		if (performance.now() - lastHapticAtRef.current > CUE_THROTTLE_MS) {
			if (!silent()) vibrate("light");
		}
	};

	/** The pointer's x inside the plot, in local px. */
	const localX = (clientX: number) => {
		const plot = plotRef.current;
		if (!plot) return 0;
		const rect = plot.getBoundingClientRect();
		// CSS zoom and transforms scale client coordinates; work in local px.
		const ratio = rect.width / (plot.offsetWidth || 1) || 1;
		return (clientX - rect.left) / ratio;
	};

	const modeAt = (x: number): Mode => {
		const geo = geometryRef.current;
		if (!geo) return "sweep";
		const a = geo.pointAt(startIndex.get()).x;
		const b = geo.pointAt(endIndex.get()).x;
		const toStart = Math.abs(x - a);
		const toEnd = Math.abs(x - b);
		if (Math.min(toStart, toEnd) <= HANDLE_HIT_PX) {
			if (Math.abs(toStart - toEnd) > 0.5)
				return toStart < toEnd ? "start" : "end";
			// Handles on top of each other: outside picks the near side, between waits for a direction.
			return x < a ? "start" : x > b ? "end" : "either";
		}
		return x > a && x < b ? "pan" : "sweep";
	};

	const cursorFor = (mode: Mode, dragging: boolean) => {
		if (mode === "pan") return dragging ? "grabbing" : "grab";
		if (mode === "sweep") return "crosshair";
		return "ew-resize";
	};

	const focusEdge = (mode: Mode) => {
		const target =
			mode === "start"
				? startRef.current
				: mode === "end"
					? endRef.current
					: bandRef.current;
		target?.focus({ preventScroll: true });
	};

	const follow = (clientX: number) => {
		const drag = dragRef.current;
		const geo = geometryRef.current;
		if (!drag || !geo) return;
		const x = localX(clientX);
		const index = Math.round(geo.indexAt(x));
		const offEdge = x < geo.xs[0] - PUSH_PX || x > geo.xs[last] + PUSH_PX;
		const current = rangeRef.current;
		let next = current;
		let pushed = false;

		if (drag.mode === "either") {
			if (Math.abs(x - drag.originX) < 1) return;
			drag.mode = x < drag.originX ? "start" : "end";
			focusEdge(drag.mode);
		}

		if (drag.mode === "start") {
			const limit = current.end - minSpan;
			next = { start: clamp(index, 0, limit), end: current.end };
			pushed = index > limit || (offEdge && x < geo.xs[0]);
		} else if (drag.mode === "end") {
			const limit = current.start + minSpan;
			next = { start: current.start, end: clamp(index, limit, last) };
			pushed = index < limit || (offEdge && x > geo.xs[last]);
		} else if (drag.mode === "pan") {
			const span = drag.before.end - drag.before.start;
			const wanted =
				drag.before.start + Math.round(geo.indexAt(x) - drag.originIndex);
			const start = clamp(wanted, 0, last - span);
			next = { start, end: start + span };
			pushed = wanted !== start;
		} else {
			// A sweep grows from the press point towards the pointer.
			const anchor = drag.anchor;
			if (index >= anchor) {
				const end = clamp(Math.max(index, anchor + minSpan), 0, last);
				next = { start: Math.max(Math.min(anchor, end - minSpan), 0), end };
			} else {
				const start = clamp(Math.min(index, anchor - minSpan), 0, last);
				next = {
					start,
					end: Math.min(Math.max(anchor, start + minSpan), last),
				};
			}
		}

		// One thunk per push against a limit, not one per move.
		if (pushed && !drag.pushed) thunk();
		drag.pushed = pushed;

		setRange(next);
		// A new sweep starts under the pointer instead of flying in from the old range.
		const transition = drag.fresh && drag.mode === "sweep" ? "jump" : "drag";
		drag.fresh = false;
		moveIndex("start", next.start, transition);
		moveIndex("end", next.end, transition);
	};

	const activate = (clientX: number) => {
		const drag = dragRef.current;
		if (!drag || drag.active) return;
		drag.active = true;
		setDragMode(drag.mode);
		setHoverIndex(null);
		focusEdge(drag.mode);
		if (plotRef.current) {
			plotRef.current.style.cursor = cursorFor(drag.mode, true);
		}
		follow(clientX);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		const geo = geometryRef.current;
		// Ignore second fingers and non-primary buttons.
		if (
			inactive ||
			!geo ||
			!event.isPrimary ||
			event.button !== 0 ||
			dragRef.current
		) {
			return;
		}
		const x = localX(event.clientX);
		const mode = modeAt(x);
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			mode,
			active: false,
			originX: x,
			originY: event.clientY,
			originIndex: geo.indexAt(x),
			anchor: Math.round(geo.indexAt(x)),
			before: rangeRef.current,
			pushed: false,
			fresh: true,
		};
		// A touch might be a page scroll, and a click on the empty plot might be a tap.
		if (event.pointerType !== "touch" && mode !== "sweep") {
			activate(event.clientX);
		}
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag) {
			if (event.pointerType !== "mouse" || inactive) return;
			const geo = geometryRef.current;
			if (!geo) return;
			const x = localX(event.clientX);
			const mode = modeAt(x);
			event.currentTarget.style.cursor = cursorFor(mode, false);
			// The crosshair steps aside over a handle, which already marks its point.
			setHoverIndex(
				mode === "start" || mode === "end" || mode === "either"
					? null
					: Math.round(geo.indexAt(x)),
			);
			return;
		}
		if (drag.pointerId !== event.pointerId) return;
		if (!drag.active) {
			const dx = Math.abs(localX(event.clientX) - drag.originX);
			const dy = Math.abs(event.clientY - drag.originY);
			const slop = drag.pointerType === "touch" ? TOUCH_SLOP : SWEEP_SLOP;
			if (dx < slop || dx < dy) return;
			activate(event.clientX);
			return;
		}
		follow(event.clientX);
	};

	const finishDrag = () => {
		const drag = dragRef.current;
		if (!drag) return null;
		dragRef.current = null;
		const plot = plotRef.current;
		if (plot?.hasPointerCapture(drag.pointerId)) {
			plot.releasePointerCapture(drag.pointerId);
		}
		if (plot) plot.style.cursor = "";
		setDragMode(null);
		return drag;
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const geo = geometryRef.current;
		if (!drag.active && drag.mode === "sweep" && geo) {
			// A tap on the empty plot moves the nearer handle there.
			finishDrag();
			const index = Math.round(geo.indexAt(drag.originX));
			const current = rangeRef.current;
			const next =
				Math.abs(index - current.start) <= Math.abs(index - current.end)
					? { start: Math.min(index, current.end - minSpan), end: current.end }
					: {
							start: current.start,
							end: Math.max(index, current.start + minSpan),
						};
			const clamped = normalizeRange(next, count, minSpan);
			if (setRange(clamped)) commit(clamped, true);
			return;
		}
		finishDrag();
		if (drag.active && !sameRange(rangeRef.current, drag.before)) {
			commit(rangeRef.current, true);
		}
	};

	const cancelDrag = () => {
		const drag = finishDrag();
		if (!drag?.active) return;
		setRange(drag.before);
		moveIndex("start", drag.before.start, "soft");
		moveIndex("end", drag.before.end, "soft");
	};

	const reset = () => {
		if (inactive) return;
		if (setRange(resetRange)) commit(resetRange, true);
	};

	const handleKeyDown =
		(edge: Edge) => (event: KeyboardEvent<HTMLDivElement>) => {
			if (inactive) return;
			if (event.key === "Escape") {
				if (dragRef.current?.active) {
					event.preventDefault();
					cancelDrag();
					return;
				}
				if (edge === "window" && !sameRange(rangeRef.current, resetRange)) {
					event.preventDefault();
					reset();
				}
				return;
			}
			if (dragRef.current) return;
			const current = rangeRef.current;
			const from = edge === "end" ? current.end : current.start;
			const step = event.shiftKey ? bigStep : 1;
			const moves: Record<string, number> = {
				ArrowRight: from + step,
				ArrowUp: from + step,
				ArrowLeft: from - step,
				ArrowDown: from - step,
				PageUp: from + bigStep,
				PageDown: from - bigStep,
				Home: Number.NEGATIVE_INFINITY,
				End: Number.POSITIVE_INFINITY,
			};
			const target = moves[event.key];
			if (target === undefined) return;
			event.preventDefault();
			let next: ChartBrushRange;
			if (edge === "start") {
				next = {
					start: clamp(target, 0, current.end - minSpan),
					end: current.end,
				};
			} else if (edge === "end") {
				next = {
					start: current.start,
					end: clamp(target, current.start + minSpan, last),
				};
			} else {
				const span = current.end - current.start;
				const start = clamp(target, 0, last - span);
				next = { start, end: start + span };
			}
			if (setRange(next)) commit(next, false);
			else if (!event.repeat) thunk();
		};

	// Pointer drags move focus to the handle they hold, which browsers may treat as
	// focus-visible. Rings follow the input instead: focus that arrives while a
	// pointer is down stays ringless, and keys or tabbing in bring the ring back.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		let pressing = false;
		root.dataset.modality = "keyboard";
		const onPointerDown = () => {
			pressing = true;
			root.dataset.modality = "pointer";
		};
		const onPointerUp = () => {
			pressing = false;
		};
		const onKeyDown = () => {
			root.dataset.modality = "keyboard";
		};
		const onFocusIn = () => {
			if (!pressing) root.dataset.modality = "keyboard";
		};
		root.addEventListener("pointerdown", onPointerDown, true);
		root.addEventListener("keydown", onKeyDown, true);
		root.addEventListener("focusin", onFocusIn);
		window.addEventListener("pointerup", onPointerUp, true);
		window.addEventListener("pointercancel", onPointerUp, true);
		return () => {
			root.removeEventListener("pointerdown", onPointerDown, true);
			root.removeEventListener("keydown", onKeyDown, true);
			root.removeEventListener("focusin", onFocusIn);
			window.removeEventListener("pointerup", onPointerUp, true);
			window.removeEventListener("pointercancel", onPointerUp, true);
		};
	}, []);

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const plot = plotRef.current;
		if (!plot) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.active) event.preventDefault();
		};
		plot.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => plot.removeEventListener("touchmove", onTouchMove);
	}, []);

	useEffect(() => {
		if (!inactive) return;
		dragRef.current = null;
		setDragMode(null);
		setHoverIndex(null);
	}, [inactive]);

	const from = points[range.start];
	const to = points[range.end];
	const { change, ratio } = describe(range);
	const good = positive === "up" ? change > 0 : change < 0;
	const tone = change === 0 ? "flat" : good ? "good" : "bad";
	const hovered = hoverIndex !== null ? points[hoverIndex] : undefined;
	const hoverPoint =
		hoverIndex !== null && geometry ? geometry.pointAt(hoverIndex) : null;
	const animated = !shouldReduceMotion;

	const sliderClass =
		"absolute top-0 left-0 outline-none group-data-disabled/chart-brush:pointer-events-none";

	return (
		<div
			ref={rootRef}
			role="group"
			aria-labelledby={labelId}
			data-slot="chart-brush"
			data-variant={variant}
			data-state={dragMode ? "dragging" : "idle"}
			data-disabled={inactive || undefined}
			className={cn(
				"group/chart-brush flex w-full min-w-0 select-none flex-col gap-3 text-sm [-webkit-tap-highlight-color:transparent] data-disabled:cursor-not-allowed",
				className,
			)}
			{...props}
		>
			<div
				data-slot="chart-brush-header"
				className="flex min-w-0 flex-col gap-1 tabular-nums"
			>
				<div className="flex min-w-0 items-baseline gap-4">
					<span
						id={labelId}
						className={cn(
							"min-w-0 truncate font-medium text-muted-foreground",
							hideLabel && "sr-only",
						)}
					>
						{label}
					</span>
					<span
						aria-hidden
						data-slot="chart-brush-span"
						className="ml-auto shrink-0 text-muted-foreground text-xs"
					>
						{hovered
							? formatLongDate.format(hovered.date)
							: from && to && count >= 2
								? durationText(to.time - from.time, locale)
								: null}
					</span>
				</div>
				{/* The readout wraps under the change when both don't fit. */}
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
					<div
						aria-hidden
						className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
					>
						<span
							data-slot="chart-brush-change"
							className="font-semibold text-2xl text-foreground tabular-nums leading-none tracking-tight"
						>
							{count >= 2 ? (
								<NumberFlow
									value={Math.abs(change)}
									prefix={change > 0 ? "+" : change < 0 ? MINUS : ""}
									locales={locale}
									format={valueFormat}
									animated={animated}
									respectMotionPreference={false}
									transformTiming={digitTiming}
									spinTiming={digitTiming}
								/>
							) : (
								"—"
							)}
						</span>
						{count >= 2 ? (
							<span
								data-slot="chart-brush-delta"
								data-tone={tone}
								className={cn(
									"inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 font-medium text-xs tabular-nums transition-colors duration-200 motion-reduce:transition-none",
									"data-[tone=flat]:bg-muted data-[tone=flat]:text-muted-foreground",
									"data-[tone=good]:bg-emerald-500/12 data-[tone=good]:text-emerald-700 dark:data-[tone=good]:text-emerald-400",
									"data-[tone=bad]:bg-rose-500/12 data-[tone=bad]:text-rose-700 dark:data-[tone=bad]:text-rose-400",
								)}
							>
								<motion.span
									className="flex [&_svg]:size-3"
									initial={false}
									animate={{ rotate: change > 0 ? 0 : change < 0 ? 90 : 45 }}
									transition={animated ? softSpring : { duration: 0 }}
								>
									<ArrowUpRight strokeWidth={2.5} />
								</motion.span>
								{ratio !== null ? (
									<NumberFlow
										value={Math.abs(ratio)}
										locales={locale}
										format={{ style: "percent", maximumFractionDigits: 1 }}
										animated={animated}
										respectMotionPreference={false}
										transformTiming={digitTiming}
										spinTiming={digitTiming}
									/>
								) : (
									<span>—</span>
								)}
							</span>
						) : null}
					</div>
					<span
						aria-hidden
						data-slot="chart-brush-readout"
						className="ml-auto text-right text-muted-foreground text-xs"
					>
						{hovered ? (
							<span className="text-foreground">
								{formatValue(hovered.value)}
							</span>
						) : from && to && count >= 2 ? (
							<>
								{formatValue(from.value)}
								<span className="px-1 text-muted-foreground/60">→</span>
								<span className="text-foreground">{formatValue(to.value)}</span>
							</>
						) : null}
					</span>
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<div
					ref={plotRef}
					data-slot="chart-brush-plot"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={() => finishDrag()}
					onLostPointerCapture={(event) => {
						if (dragRef.current?.pointerId === event.pointerId) {
							handlePointerUp(event);
						}
					}}
					onPointerLeave={() => setHoverIndex(null)}
					onDoubleClick={reset}
					onContextMenu={(event) => {
						if (dragRef.current) event.preventDefault();
					}}
					className="relative w-full touch-pan-y [-webkit-touch-callout:none] group-data-disabled/chart-brush:pointer-events-none group-data-disabled/chart-brush:opacity-50"
					style={{ height }}
				>
					{geometry ? (
						<>
							<svg
								aria-hidden
								width={geometry.width}
								height={height}
								className="absolute inset-0 overflow-visible"
							>
								{geometry.grid.map((y) => (
									<line
										key={y}
										x1={0}
										x2={geometry.width}
										y1={y}
										y2={y}
										className="stroke-foreground/[0.07]"
										strokeDasharray="2 4"
									/>
								))}
								<line
									x1={0}
									x2={geometry.width}
									y1={geometry.baseline}
									y2={geometry.baseline}
									className="stroke-foreground/10"
								/>
								<path
									d={geometry.line}
									fill="none"
									className="stroke-foreground/25"
									strokeWidth={1.5}
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>

							<Handle
								edge="start"
								handleRef={startRef}
								active={dragMode === "start"}
								className={sliderClass}
								inactive={inactive}
								valueMax={range.end - minSpan}
								valueNow={range.start}
								valueText={
									from
										? `${formatLongDate.format(from.date)}, ${formatValue(from.value)}`
										: ""
								}
								onKeyDown={handleKeyDown("start")}
								height={height}
								gripY={geometry.baseline}
							/>

							<div
								ref={bandRef}
								role="slider"
								tabIndex={inactive ? -1 : 0}
								aria-label="Selected range"
								aria-valuemin={0}
								aria-valuemax={last - (range.end - range.start)}
								aria-valuenow={range.start}
								aria-valuetext={summarize(range)}
								aria-orientation="horizontal"
								aria-disabled={inactive || undefined}
								data-slot="chart-brush-window"
								onKeyDown={handleKeyDown("window")}
								style={{ height: geometry.baseline }}
								className={cn(
									sliderClass,
									"z-[1] bg-foreground/[0.035] in-data-[modality=keyboard]:focus-visible:bg-foreground/[0.05] in-data-[modality=keyboard]:focus-visible:ring-2 in-data-[modality=keyboard]:focus-visible:ring-ring/50 in-data-[modality=keyboard]:focus-visible:ring-inset",
								)}
							/>

							<div
								ref={inkRef}
								aria-hidden
								data-slot="chart-brush-ink"
								className="pointer-events-none absolute inset-0 z-[2]"
							>
								<svg
									width={geometry.width}
									height={height}
									className="absolute inset-0 overflow-visible text-foreground"
								>
									<defs>
										<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
											<stop
												offset="0%"
												stopColor="currentColor"
												stopOpacity={0.16}
											/>
											<stop
												offset="100%"
												stopColor="currentColor"
												stopOpacity={0}
											/>
										</linearGradient>
									</defs>
									{variant === "area" ? (
										<path d={geometry.area} fill={`url(#${gradientId})`} />
									) : null}
									<path
										d={geometry.line}
										fill="none"
										stroke="currentColor"
										strokeWidth={2}
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>

							{hoverPoint ? (
								<div
									aria-hidden
									data-slot="chart-brush-crosshair"
									className="pointer-events-none absolute inset-0 z-[3]"
								>
									<span
										className="absolute top-0 left-0 w-px bg-foreground/15"
										style={{
											height: geometry.baseline,
											transform: `translateX(${hoverPoint.x - 0.5}px)`,
										}}
									/>
									<span
										className="absolute top-0 left-0 size-2 rounded-full bg-foreground ring-2 ring-background"
										style={{
											transform: `translate(${hoverPoint.x - 4}px, ${hoverPoint.y - 4}px)`,
										}}
									/>
								</div>
							) : null}

							<Handle
								edge="end"
								handleRef={endRef}
								active={dragMode === "end"}
								className={sliderClass}
								inactive={inactive}
								valueMin={range.start + minSpan}
								valueMax={last}
								valueNow={range.end}
								valueText={
									to
										? `${formatLongDate.format(to.date)}, ${formatValue(to.value)}`
										: ""
								}
								onKeyDown={handleKeyDown("end")}
								height={height}
								gripY={geometry.baseline}
							/>
							<Dot dotRef={startDotRef} active={dragMode === "start"} />
							<Dot dotRef={endDotRef} active={dragMode === "end"} />
						</>
					) : count < 2 ? (
						<div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
							Not enough data
						</div>
					) : null}
				</div>

				<div
					aria-hidden
					data-slot="chart-brush-chips"
					className="relative h-5 w-full overflow-hidden text-[11px] text-muted-foreground tabular-nums leading-5"
				>
					{from && to && geometry ? (
						<>
							<Chip chipRef={startChipRef} active={dragMode === "start"} />
							<Chip chipRef={endChipRef} active={dragMode === "end"} />
							<Chip chipRef={mergedChipRef} active={dragMode !== null} />
						</>
					) : null}
				</div>
			</div>

			<span aria-live="polite" className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

function Handle({
	edge,
	handleRef,
	active,
	className,
	inactive,
	valueMin = 0,
	valueMax,
	valueNow,
	valueText,
	onKeyDown,
	height,
	gripY,
}: {
	edge: "start" | "end";
	handleRef: Ref<HTMLDivElement>;
	active: boolean;
	className: string;
	inactive: boolean;
	valueMin?: number;
	valueMax: number;
	valueNow: number;
	valueText: string;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	height: number;
	/** Where the grip sits: on the baseline, clear of the curve. */
	gripY: number;
}) {
	return (
		// The slider is a zero-width anchor at the handle's x; its parts are centered on it.
		<div
			ref={handleRef}
			role="slider"
			tabIndex={inactive ? -1 : 0}
			aria-label={edge === "start" ? "Range start" : "Range end"}
			aria-valuemin={valueMin}
			aria-valuemax={valueMax}
			aria-valuenow={valueNow}
			aria-valuetext={valueText}
			aria-orientation="horizontal"
			aria-disabled={inactive || undefined}
			data-slot={`chart-brush-${edge}`}
			data-active={active || undefined}
			onKeyDown={onKeyDown}
			className={cn("group/handle z-[4] w-0", className)}
			style={{ height }}
		>
			<span
				aria-hidden
				style={{ height: gripY }}
				className="absolute top-0 -left-[0.5px] w-px bg-foreground/35 transition-colors duration-150 group-data-active/handle:bg-foreground/70 motion-reduce:transition-none"
			/>
			<span
				aria-hidden
				data-slot="chart-brush-grip"
				style={{ top: gripY }}
				className="absolute -left-[5px] flex h-6 w-2.5 items-center justify-center gap-px rounded-full bg-background shadow-sm ring-1 ring-foreground/20 transition-[scale,box-shadow] duration-200 ease-out [translate:var(--grip-shift,0px)_-50%] in-data-[modality=keyboard]:group-focus-visible/handle:ring-2 in-data-[modality=keyboard]:group-focus-visible/handle:ring-ring in-data-[modality=keyboard]:group-has-[[data-slot=chart-brush-window]:focus-visible]/chart-brush:ring-2 in-data-[modality=keyboard]:group-has-[[data-slot=chart-brush-window]:focus-visible]/chart-brush:ring-ring group-data-active/handle:scale-[1.12] group-data-active/handle:ring-foreground/40 motion-reduce:transition-none motion-reduce:group-data-active/handle:scale-100 dark:bg-muted dark:ring-foreground/30"
			>
				<span className="h-2.5 w-px rounded-full bg-foreground/35" />
			</span>
		</div>
	);
}

function Dot({
	dotRef,
	active,
}: {
	dotRef: Ref<HTMLSpanElement>;
	active: boolean;
}) {
	return (
		<span
			ref={dotRef}
			aria-hidden
			className="pointer-events-none absolute top-0 left-0 z-[5] size-0"
		>
			<span
				className={cn(
					"absolute -top-1 -left-1 size-2 rounded-full bg-foreground ring-2 ring-background transition-transform duration-200 ease-out motion-reduce:transition-none",
					active && "scale-125 motion-reduce:scale-100",
				)}
			/>
		</span>
	);
}

function Chip({
	chipRef,
	active,
}: {
	chipRef: Ref<HTMLSpanElement>;
	active: boolean;
}) {
	// Its text is written by `paint`, from where the handle is right now.
	return (
		<span
			ref={chipRef}
			data-shown="false"
			className={cn(
				"absolute top-0 left-0 whitespace-nowrap px-1 opacity-0 transition-colors duration-150 data-[shown=true]:opacity-100 motion-reduce:transition-none",
				active && "text-foreground",
			)}
		/>
	);
}

export default ChartBrush;
