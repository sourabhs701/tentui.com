"use client";

import NumberFlow from "@number-flow/react";
import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	type MotionValue,
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
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Stretch, thickness, icon nudge, and jumps all share this soft spring. */
const softSpring = {
	type: "spring",
	bounce: 0.2,
	visualDuration: 0.35,
} as const;
/** Follows the pointer between coarse steps and onto marks while dragging. */
const dragSpring = { type: "spring", bounce: 0, visualDuration: 0.12 } as const;
const digitTiming = {
	duration: 450,
	easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

/** Minimum ms between ticks, so a fast drag never buzzes. */
const CUE_THROTTLE_MS = 35;
/** Above this many steps, ticks fall on every 10% instead of every step. */
const MAX_TICKED_STEPS = 40;
/** A dragged value sticks to a mark while the pointer is this close, in px. */
const MARK_STICK_PX = 6;
/** Touch travel, in px, before a press on the track becomes a drag. */
const TOUCH_SLOP = 4;
/** Overdrag, in px, that counts as pulling past an end. */
const OVERDRAG_THUNK_PX = 1;
/** The track's hit area is never shorter than this, in px. */
const MIN_HIT_PX = 44;
/** How far a key press at a limit stretches the track, as a fraction of `maxStretch`. */
const BUMP_STRETCH = 0.35;
/** Distance, in px, over which inline text fades back in beside the fill's edge. */
const TEXT_FADE_PX = 8;
/** Extra scale an end icon reaches at full stretch. */
const ICON_SCALE = 0.15;

/** Track heights in px; `inline` holds the label and value inside the track. */
const sizes = {
	sm: {
		thin: 4,
		thick: 8,
		inlineThin: 32,
		inlineThick: 36,
		padding: 12,
		text: "text-xs",
		icon: "[&_svg]:size-3.5",
		gap: "gap-2.5",
	},
	md: {
		thin: 6,
		thick: 12,
		inlineThin: 40,
		inlineThick: 46,
		padding: 16,
		text: "text-sm",
		icon: "[&_svg]:size-4",
		gap: "gap-3",
	},
	lg: {
		thin: 8,
		thick: 16,
		inlineThin: 48,
		inlineThick: 54,
		padding: 18,
		text: "text-base",
		icon: "[&_svg]:size-5",
		gap: "gap-3.5",
	},
} as const;

type Direction = 1 | -1;

export interface ElasticSliderMark {
	value: number;
	/** Shown under the track; clicking it moves the slider there. */
	label?: string;
}

export interface ElasticSliderProps
	extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "ref"> {
	/** Visible label, also the slider's accessible name. */
	label: string;
	/** Keeps the label for assistive technology only. */
	hideLabel?: boolean;
	/** Controlled value. */
	value?: number;
	/** Initial value when uncontrolled. Defaults to `min`. */
	defaultValue?: number;
	/** Called on every change while dragging, clicking, or pressing keys. */
	onValueChange?: (value: number) => void;
	/** Called once a drag is released, or a click, key press, or mark lands. */
	onValueCommit?: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/** Moved by `Shift`+arrows and `PageUp`/`PageDown`. Defaults to a tenth of the range. */
	largeStep?: number;
	/** Detents a drag sticks to. Labelled marks render under the track. */
	marks?: Array<number | ElasticSliderMark>;
	/** Formats the readout and `aria-valuetext`. */
	format?: (value: number) => string;
	/** Shown before the track, nudged outward when it stretches past `min`. */
	startIcon?: ReactNode;
	/** Shown after the track, nudged outward when it stretches past `max`. */
	endIcon?: ReactNode;
	/** `inline` puts the label and value inside the track; `stacked` puts them above a thin track. */
	variant?: "inline" | "stacked";
	size?: keyof typeof sizes;
	/** Furthest the track stretches past either end, in px. */
	maxStretch?: number;
	/** Play a tick per step or mark and a thunk at the limits. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	/** Submits the value with a native form through a hidden input. */
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
 * Square-root resistance: follows the pointer 1:1 at first, then eases towards
 * `max` px and never passes it.
 */
function resist(over: number, max: number) {
	if (over <= 0 || max <= 0) return 0;
	return max * (1 - Math.exp(1 - Math.sqrt(1 + (2 * over) / max)));
}

/** Labels at the ends align to the edge, so they never overflow the track. */
function labelShift(fraction: number) {
	if (fraction < 0.1) return fraction * 5;
	if (fraction > 0.9) return 0.5 + (fraction - 0.9) * 5;
	return 0.5;
}

interface Scale {
	lower: number;
	upper: number;
	step: number;
	decimals: number;
	/** Values that tick; `null` ticks on every step. */
	ticks: number[] | null;
	marks: ElasticSliderMark[];
	round: (value: number) => number;
	/** Nearest valid value; `max` counts even when the steps don't reach it. */
	snap: (value: number) => number;
	/** The next valid value above or below. */
	stepFrom: (value: number, direction: Direction) => number;
	fractionOf: (value: number) => number;
}

function buildScale(
	min: number,
	max: number,
	step: number,
	marks?: Array<number | ElasticSliderMark>,
): Scale {
	const lower = Number.isFinite(min) ? min : 0;
	const upper = Number.isFinite(max) ? Math.max(max, lower) : lower;
	const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
	const decimals = Math.max(decimalsOf(safeStep), decimalsOf(lower));
	const span = upper - lower;
	// Round to the step's precision so 0.1 + 0.2 lands on 0.3.
	const round = (value: number) => Number(value.toFixed(decimals));

	const snap = (value: number) => {
		if (!(value > lower)) return lower;
		if (value >= upper) return upper;
		// The ratio is rounded first so 0.175 / 0.05 counts as 3.5, not 3.4999….
		const steps = Number(((value - lower) / safeStep).toFixed(9));
		const snapped = round(lower + Math.round(steps) * safeStep);
		// A step that doesn't divide the range still lets the end reach `max`.
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
		// Long ranges tick on every 10% instead of every step.
		ticks = Array.from({ length: 9 }, (_, index) =>
			snap(lower + ((index + 1) * span) / 10),
		);
	}

	return {
		lower,
		upper,
		step: safeStep,
		decimals,
		ticks,
		marks: normalizedMarks,
		round,
		snap,
		stepFrom,
		fractionOf: (value) => (span > 0 ? clamp((value - lower) / span, 0, 1) : 0),
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
	// A custom `format` returns a string, which can't roll digit by digit.
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

export function ElasticSlider({
	label,
	hideLabel = false,
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	min = 0,
	max = 100,
	step = 1,
	largeStep,
	marks,
	format,
	startIcon,
	endIcon,
	variant = "inline",
	size = "md",
	maxStretch = 10,
	sound = true,
	haptics = true,
	disabled = false,
	name,
	className,
	...props
}: ElasticSliderProps) {
	const sizeStyle = sizes[size];
	const inline = variant === "inline";
	const thin = inline ? sizeStyle.inlineThin : sizeStyle.thin;
	const thick = inline ? sizeStyle.inlineThick : sizeStyle.thick;
	const scale = buildScale(min, max, step, marks);
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
	const [internalValue, setInternalValue] = useState(() =>
		scale.snap(valueProp ?? defaultValue ?? lower),
	);
	const [dragging, setDragging] = useState(false);
	// A drag in progress wins over the `value` prop; it syncs on release.
	// Out-of-range values are clamped for display without calling `onValueChange`.
	const value = scale.snap(controlled && !dragging ? valueProp : internalValue);
	const valueText = format ? format(value) : value.toFixed(scale.decimals);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, toggle: playToggle } = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});
	// The crisp theme's click is a touch brighter: it marks `min` and `max`.
	const { click: playBrightClick } = useTiks({
		theme: "crisp",
		respectReducedMotion: false,
	});

	const labelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const readoutRef = useRef<HTMLSpanElement>(null);

	// Position of the value along the track, 0 to 1.
	const fraction = useMotionValue(scale.fractionOf(value));
	// Px the track is stretched past an end: negative past `min`, positive past `max`.
	const stretch = useMotionValue(0);
	const thickness = useMotionValue<number>(thin);
	const trackWidth = useMotionValue(0);
	// 1 in left-to-right layouts, -1 in right-to-left ones.
	const direction = useMotionValue<number>(1);
	const [rtl, setRtl] = useState(false);
	const labelOpacity = useMotionValue(1);
	const readoutOpacity = useMotionValue(1);

	const fractionAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const stretchAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const valueRef = useRef(value);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const textBoxesRef = useRef({ label: 0, readout: 0 });
	const dragRef = useRef<{
		pointerId: number;
		active: boolean;
		originX: number;
		originY: number;
		startValue: number;
		overdragged: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		valueRef.current = value;
	});

	// The track grows past whichever end is stretched; the fill follows it.
	const trackStart = useTransform(stretch, (s) => `${Math.min(s, 0)}px`);
	const trackEnd = useTransform(stretch, (s) => `${-Math.max(s, 0)}px`);
	const trackHeight = useTransform(thickness, (h) => `${h}px`);
	const fillRatio = (f: number, s: number, width: number) =>
		width > 0 ? (f * width + Math.max(s, 0)) / (width + Math.abs(s)) : f;
	// The fill is a full-width layer slid along the track, so it moves with transforms only.
	const fillX = useTransform(
		() =>
			`${direction.get() * (fillRatio(fraction.get(), stretch.get(), trackWidth.get()) - 1) * 100}%`,
	);
	const fillContentX = useTransform(
		() =>
			`${direction.get() * (1 - fillRatio(fraction.get(), stretch.get(), trackWidth.get())) * 100}%`,
	);
	const startIconX = useTransform(
		() => direction.get() * Math.min(stretch.get(), 0),
	);
	const endIconX = useTransform(
		() => direction.get() * Math.max(stretch.get(), 0),
	);
	const startIconScale = useTransform(stretch, (s) =>
		stretchLimit > 0 ? 1 + (ICON_SCALE * Math.max(-s, 0)) / stretchLimit : 1,
	);
	const endIconScale = useTransform(stretch, (s) =>
		stretchLimit > 0 ? 1 + (ICON_SCALE * Math.max(s, 0)) / stretchLimit : 1,
	);

	/** Inline text fades out while the fill's edge passes through it. */
	const updateTextFade = useCallback(() => {
		if (!inline) return;
		const width = trackWidth.get();
		if (width <= 0) return;
		const s = stretch.get();
		const edge = fraction.get() * width + Math.max(s, 0);
		const total = width + Math.abs(s);
		const { padding } = sizeStyle;
		const fade = (from: number, to: number) => {
			if (to <= from) return 1;
			const distance = Math.max(from - edge, edge - to, 0);
			return clamp(distance / TEXT_FADE_PX, 0, 1);
		};
		const { label: labelWidth, readout: readoutWidth } = textBoxesRef.current;
		labelOpacity.set(fade(padding - 4, padding + labelWidth + 4));
		readoutOpacity.set(
			fade(total - padding - readoutWidth - 4, total - padding + 4),
		);
	}, [
		inline,
		sizeStyle,
		trackWidth,
		stretch,
		fraction,
		labelOpacity,
		readoutOpacity,
	]);

	useMotionValueEvent(fraction, "change", updateTextFade);
	useMotionValueEvent(stretch, "change", updateTextFade);
	useMotionValueEvent(trackWidth, "change", updateTextFade);

	// One observer measures the track and the inline text, so a resize mid-drag stays in step.
	useLayoutEffect(() => {
		const row = rowRef.current;
		const root = rootRef.current;
		if (!row || !root) return;
		const measure = () => {
			const isRtl = getComputedStyle(root).direction === "rtl";
			direction.set(isRtl ? -1 : 1);
			setRtl(isRtl);
			textBoxesRef.current = {
				label: labelRef.current?.offsetWidth ?? 0,
				readout: readoutRef.current?.offsetWidth ?? 0,
			};
			trackWidth.set(row.offsetWidth);
			updateTextFade();
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		if (labelRef.current) observer.observe(labelRef.current);
		if (readoutRef.current) observer.observe(readoutRef.current);
		return () => observer.disconnect();
	}, [direction, trackWidth, updateTextFade]);

	const moveFraction = useCallback(
		(target: number, transition: "jump" | "drag" | "soft") => {
			fractionAnimationRef.current?.stop();
			fractionAnimationRef.current = null;
			if (shouldReduceMotion || transition === "jump") {
				fraction.jump(target);
				return;
			}
			if (fraction.get() === target) return;
			fractionAnimationRef.current = animate(
				fraction,
				target,
				transition === "drag" ? dragSpring : softSpring,
			);
		},
		[fraction, shouldReduceMotion],
	);

	const releaseStretch = useCallback(() => {
		stretchAnimationRef.current?.stop();
		stretchAnimationRef.current = null;
		if (shouldReduceMotion) {
			stretch.jump(0);
			return;
		}
		if (stretch.get() === 0) return;
		// Springs carry the stretch's current velocity, so a release keeps its momentum.
		stretchAnimationRef.current = animate(stretch, 0, softSpring);
	}, [shouldReduceMotion, stretch]);

	const setThick = useCallback(
		(active: boolean) => {
			const target = active ? thick : thin;
			if (shouldReduceMotion) thickness.jump(target);
			else animate(thickness, target, softSpring);
		},
		[shouldReduceMotion, thick, thin, thickness],
	);

	useEffect(() => {
		if (!dragRef.current?.active) setThick(false);
	}, [setThick]);

	// The fill follows the value; drags move it themselves.
	const targetFraction = scale.fractionOf(value);
	useEffect(() => {
		if (dragRef.current?.active) return;
		moveFraction(targetFraction, "soft");
	}, [targetFraction, moveFraction]);

	useEffect(
		() => () => {
			fractionAnimationRef.current?.stop();
			stretchAnimationRef.current?.stop();
		},
		[],
	);

	useEffect(() => {
		if (shouldReduceMotion) stretch.jump(0);
	}, [shouldReduceMotion, stretch]);

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
		// The ends always sound, a little brighter, so a fast drag still lands on them.
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

	const commit = (next: number) => {
		onValueCommit?.(next);
		// A tick's haptic already confirmed this change; don't double up.
		if (performance.now() - lastHapticAtRef.current > CUE_THROTTLE_MS) {
			if (!silent()) vibrate("light");
		}
	};

	const setValue = (next: number) => {
		const previous = valueRef.current;
		if (next === previous) return false;
		valueRef.current = next;
		setInternalValue(next);
		onValueChange?.(next);
		cue(previous, next);
		return true;
	};

	/** A tiny one-shot stretch past an end, for keys pressed at a limit. */
	const bump = (towards: Direction) => {
		thunk();
		if (shouldReduceMotion || stretchLimit <= 0) return;
		stretchAnimationRef.current?.stop();
		const controls = animate(stretch, towards * stretchLimit * BUMP_STRETCH, {
			duration: 0.08,
			ease: "easeOut",
		});
		stretchAnimationRef.current = controls;
		void controls.then(() => {
			if (stretchAnimationRef.current === controls) releaseStretch();
		});
	};

	const isRtl = () => {
		const root = rootRef.current;
		const next = root ? getComputedStyle(root).direction === "rtl" : false;
		direction.set(next ? -1 : 1);
		setRtl(next);
		return next;
	};

	/** The pointer's position along the track, in local px from the start edge. */
	const pointerOffset = (clientX: number) => {
		const row = rowRef.current;
		if (!row) return { offset: 0, width: 0 };
		const rect = row.getBoundingClientRect();
		const width = row.offsetWidth;
		// CSS zoom and transforms scale client coordinates; work in local px.
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
		// Within a few px of a mark, the value sticks to it.
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

	/** Moves to the pointer: sets the value, the fill, and any stretch past the ends. */
	const followPointer = (clientX: number, jumped: boolean) => {
		const drag = dragRef.current;
		const { offset, width } = pointerOffset(clientX);
		const next = valueAtOffset(offset, width);
		setValue(next);
		const onMark = scale.marks.some((mark) => mark.value === next);
		const transition = jumped
			? "soft"
			: onMark || stepPx() > 3
				? "drag"
				: "jump";
		moveFraction(scale.fractionOf(next), transition);

		const over = offset < 0 ? offset : offset > width ? offset - width : 0;
		if (drag) {
			if (Math.abs(over) >= OVERDRAG_THUNK_PX) {
				// One thunk per pull past an end, not one per move.
				if (!drag.overdragged) thunk();
				drag.overdragged = true;
			} else if (over === 0) {
				drag.overdragged = false;
			}
		}
		if (shouldReduceMotion) return;
		stretchAnimationRef.current?.stop();
		stretchAnimationRef.current = null;
		stretch.set(Math.sign(over) * resist(Math.abs(over), stretchLimit));
	};

	const activate = (clientX: number) => {
		const drag = dragRef.current;
		if (!drag || drag.active) return;
		drag.active = true;
		setDragging(true);
		setThick(true);
		followPointer(clientX, true);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		// Ignore second fingers and non-primary buttons.
		if (inactive || !event.isPrimary || event.button !== 0 || dragRef.current) {
			return;
		}
		isRtl();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			pointerId: event.pointerId,
			active: false,
			originX: event.clientX,
			originY: event.clientY,
			startValue: valueRef.current,
			overdragged: false,
		};
		// A touch might be the start of a vertical page scroll; wait until it moves sideways or lifts.
		if (event.pointerType !== "touch") activate(event.clientX);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (!drag.active) {
			const dx = Math.abs(event.clientX - drag.originX);
			const dy = Math.abs(event.clientY - drag.originY);
			if (dx < TOUCH_SLOP || dx < dy) return;
			activate(event.clientX);
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
		// A lifted tap counts as a click; a cancelled touch was a page scroll.
		if (!drag.active && reason === "up") activate(event.clientX);
		dragRef.current = null;
		const row = rowRef.current;
		if (row?.hasPointerCapture(drag.pointerId)) {
			row.releasePointerCapture(drag.pointerId);
		}
		if (!drag.active) return;
		setDragging(false);
		setThick(false);
		releaseStretch();
		moveFraction(scale.fractionOf(valueRef.current), "soft");
		if (valueRef.current !== drag.startValue) commit(valueRef.current);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (inactive) return;
		// Left and right follow the reading direction, like a native range input.
		const forward: Direction = isRtl() ? -1 : 1;
		const from = valueRef.current;
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
			Home: () => [lower, -1],
			End: () => [upper, 1],
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		const [target, towards] = move();
		const next = clamp(target, lower, upper);
		if (setValue(next)) commit(next);
		else if (!event.repeat) bump(towards);
	};

	const selectMark = (markValue: number) => {
		if (inactive) return;
		if (setValue(markValue)) commit(markValue);
		rowRef.current?.focus({ preventScroll: true });
	};

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
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
		setDragging(false);
		setThick(false);
		releaseStretch();
	}, [inactive, setThick, releaseStretch]);

	// Re-measure the readout after its text changes width.
	useLayoutEffect(() => {
		if (!inline) return;
		const readoutWidth = readoutRef.current?.offsetWidth ?? 0;
		if (readoutWidth === textBoxesRef.current.readout) return;
		textBoxesRef.current.readout = readoutWidth;
		updateTextFade();
	});

	const readout = (
		<Readout
			value={value}
			text={valueText}
			formatted={Boolean(format)}
			decimals={scale.decimals}
			animated={!shouldReduceMotion}
		/>
	);
	const labelledMarks = scale.marks.some((mark) => mark.label);
	const hitInset = Math.max(0, (MIN_HIT_PX - thick) / 2);

	return (
		<div
			ref={rootRef}
			data-slot="elastic-slider"
			data-variant={variant}
			data-size={size}
			data-state={dragging ? "dragging" : "idle"}
			data-bound={value === lower ? "min" : value === upper ? "max" : undefined}
			data-disabled={inactive || undefined}
			className={cn(
				"group/elastic-slider flex w-full min-w-0 touch-pan-y select-none flex-col [-webkit-tap-highlight-color:transparent] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				sizeStyle.text,
				className,
			)}
			{...props}
		>
			{inline ? (
				hideLabel ? (
					<span id={labelId} className="sr-only">
						{label}
					</span>
				) : null
			) : (
				<div
					data-slot="elastic-slider-header"
					className={cn(
						"mb-2 flex items-baseline justify-between gap-3",
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
					<span
						aria-hidden
						data-slot="elastic-slider-value"
						className="shrink-0 text-muted-foreground tabular-nums"
					>
						{readout}
					</span>
				</div>
			)}

			<div className={cn("flex items-start", sizeStyle.gap)}>
				{startIcon ? (
					<span
						aria-hidden
						className="flex shrink-0 items-center"
						style={{ height: thick }}
					>
						<motion.span
							data-slot="elastic-slider-start-icon"
							className={cn("flex text-muted-foreground", sizeStyle.icon)}
							style={{ x: startIconX, scale: startIconScale }}
						>
							{startIcon}
						</motion.span>
					</span>
				) : null}

				<div className="min-w-0 flex-1">
					{/* The whole hit area is the slider, so a click focuses it natively and never shows a focus ring. */}
					<div
						ref={rowRef}
						role="slider"
						tabIndex={inactive ? -1 : 0}
						aria-labelledby={labelId}
						aria-valuemin={lower}
						aria-valuemax={upper}
						aria-valuenow={value}
						aria-valuetext={valueText}
						aria-orientation="horizontal"
						aria-disabled={inactive || undefined}
						data-slot="elastic-slider-thumb"
						onKeyDown={handleKeyDown}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={(event) => endDrag(event, "up")}
						onPointerCancel={(event) => endDrag(event, "cancel")}
						onLostPointerCapture={(event) => endDrag(event, "cancel")}
						onContextMenu={(event) => {
							if (dragRef.current) event.preventDefault();
						}}
						className="group/elastic-slider-thumb relative cursor-pointer outline-none [-webkit-touch-callout:none] group-data-disabled/elastic-slider:pointer-events-none"
						style={{ height: thick }}
					>
						{/* Keeps the hit target at least 44px tall while the track is thin. */}
						<span
							aria-hidden
							className="absolute inset-x-0"
							style={{ top: -hitInset, bottom: -hitInset }}
						/>
						<motion.div
							data-slot="elastic-slider-track"
							className="absolute inset-y-0 my-auto rounded-full group-focus-visible/elastic-slider-thumb:ring-3 group-focus-visible/elastic-slider-thumb:ring-ring/50 group-focus-visible/elastic-slider-thumb:ring-offset-2 group-focus-visible/elastic-slider-thumb:ring-offset-background"
							style={{
								insetInlineStart: trackStart,
								insetInlineEnd: trackEnd,
								height: trackHeight,
							}}
						>
							<div className="absolute inset-0 isolate overflow-hidden rounded-full bg-muted">
								{inline ? (
									<InlineText
										labelRef={labelRef}
										readoutRef={readoutRef}
										labelId={labelId}
										label={hideLabel ? null : label}
										readout={readout}
										padding={sizeStyle.padding}
										labelOpacity={labelOpacity}
										readoutOpacity={readoutOpacity}
										className="text-foreground"
										readoutClassName="text-muted-foreground"
									/>
								) : null}
								<motion.div
									data-slot="elastic-slider-fill"
									className="absolute inset-0 overflow-hidden bg-foreground"
									style={{ x: fillX }}
								>
									{inline ? (
										// The same text in the background color, pinned to the track as the fill slides.
										<motion.div
											aria-hidden
											className="absolute inset-0"
											style={{ x: fillContentX }}
										>
											<InlineText
												label={hideLabel ? null : label}
												readout={readout}
												padding={sizeStyle.padding}
												labelOpacity={labelOpacity}
												readoutOpacity={readoutOpacity}
												className="text-background"
											/>
										</motion.div>
									) : null}
								</motion.div>
							</div>
						</motion.div>
					</div>

					{scale.marks.length ? (
						<div
							aria-hidden
							data-slot="elastic-slider-marks"
							className={cn(
								"pointer-events-none relative mt-1.5",
								labelledMarks ? "h-6" : "h-1",
							)}
						>
							{scale.marks.map((mark) => {
								const f = scale.fractionOf(mark.value);
								const shift = (rtl ? 100 : -100) * labelShift(f);
								return (
									<span
										key={mark.value}
										className="absolute top-0"
										style={{ insetInlineStart: `${f * 100}%` }}
									>
										<span
											className="absolute top-0 h-1 w-px bg-foreground/20"
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
													"pointer-events-auto absolute top-1.5 cursor-pointer whitespace-nowrap px-0.5 text-xs tabular-nums leading-4 transition-colors duration-150 disabled:cursor-not-allowed",
													mark.value === value
														? "text-foreground"
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

				{endIcon ? (
					<span
						aria-hidden
						className="flex shrink-0 items-center"
						style={{ height: thick }}
					>
						<motion.span
							data-slot="elastic-slider-end-icon"
							className={cn("flex text-muted-foreground", sizeStyle.icon)}
							style={{ x: endIconX, scale: endIconScale }}
						>
							{endIcon}
						</motion.span>
					</span>
				) : null}
			</div>

			{name ? (
				<input type="hidden" name={name} value={value} disabled={inactive} />
			) : null}
		</div>
	);
}

function InlineText({
	labelRef,
	readoutRef,
	labelId,
	label,
	readout,
	padding,
	labelOpacity,
	readoutOpacity,
	className,
	readoutClassName,
}: {
	labelRef?: Ref<HTMLSpanElement>;
	readoutRef?: Ref<HTMLSpanElement>;
	labelId?: string;
	label: string | null;
	readout: ReactNode;
	padding: number;
	labelOpacity: MotionValue<number>;
	readoutOpacity: MotionValue<number>;
	className?: string;
	readoutClassName?: string;
}) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-0 flex items-center justify-between gap-3 font-medium",
				className,
			)}
			style={{ paddingInline: padding }}
		>
			{label !== null ? (
				<motion.span
					ref={labelRef}
					id={labelId}
					className="truncate"
					style={{ opacity: labelOpacity }}
				>
					{label}
				</motion.span>
			) : (
				<span />
			)}
			<motion.span
				ref={readoutRef}
				aria-hidden
				data-slot="elastic-slider-value"
				className={cn("shrink-0 tabular-nums", readoutClassName)}
				style={{ opacity: readoutOpacity }}
			>
				{readout}
			</motion.span>
		</div>
	);
}

export default ElasticSlider;
