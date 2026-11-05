"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { defineTheme } from "@rexa-developer/tiks";
import { useTiks } from "@rexa-developer/tiks/react";
import { Moon, Sun } from "lucide-react";
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
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const DAY = 1440;
const HOUR = 60;

const snapSpring = { type: "spring", stiffness: 600, damping: 40 } as const;
const digitTiming = {
	duration: 450,
	easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

/** Hour clicks and limit thunks: the same tiks sounds, a little lower. */
const deepTheme = defineTheme({
	name: "time-ring-deep",
	baseFreq: 300,
	filterFreq: 1400,
	filterQ: 1.4,
	decay: 1.5,
});

/** The dial is drawn on a 200 x 200 grid and scales to its container. */
const VIEW = 200;
const CENTER = VIEW / 2;
/**
 * Clearance, in grid units, outside the track. It keeps the stroke, round
 * caps, handles (including the press scale), and their shadows inside the
 * square so a clipping preview cannot shave the top of the ring.
 */
const PAD = 13;
const TRACK_WIDTH = 22;
const TRACK_RADIUS = CENTER - PAD - TRACK_WIDTH / 2;
const ARC_WIDTH = 18;
const HANDLE_SIZE = 14;
const TICK_OUTER = TRACK_RADIUS - TRACK_WIDTH / 2 - 5.5;
const LABEL_RADIUS = TICK_OUTER - 18;
/** Extra reach, in grid units, around the track and handles for presses. */
const HIT_SLOP = 8;
const HANDLE_HIT = HANDLE_SIZE / 2 + HIT_SLOP;
/** Pointer travel, in px, before a press becomes a drag. */
const DRAG_SLOP = 3;
/** Extra travel, in steps, before a drag leaves its current step. */
const HYSTERESIS = 0.08;
/** Minimum ms between step sounds and haptics. */
const CUE_THROTTLE_MS = 35;

const sizes = {
	sm: 240,
	md: 288,
	lg: 336,
} as const;

const steps = [5, 15, 30] as const;

type Part = "start" | "end";
type DragPart = Part | "arc";

export interface TimeRingValue {
	/** Minutes from midnight, 0 to 1439. */
	start: number;
	/** Minutes from midnight, 0 to 1439. Before `start` means the next day. */
	end: number;
}

export interface TimeRingProps {
	/** Controlled range, in minutes from midnight. */
	value?: TimeRingValue;
	/** Initial range when uncontrolled. */
	defaultValue?: TimeRingValue;
	/** Called every time either end lands on a new step. */
	onValueChange?: (value: TimeRingValue) => void;
	/** Minutes each end snaps to. */
	step?: (typeof steps)[number];
	/** Shortest range in minutes. Defaults to one `step`. */
	minDuration?: number;
	/** Longest range in minutes. Defaults to a day less one `step`. */
	maxDuration?: number;
	/** Clock used for the times, labels, and `aria-valuetext`. */
	format?: "12h" | "24h";
	/** Icon on the start handle. */
	startIcon?: ReactNode;
	/** Icon on the end handle. */
	endIcon?: ReactNode;
	/** Accessible name of the start handle, also used in its `aria-valuetext`. */
	startLabel?: string;
	/** Accessible name of the end handle, also used in its `aria-valuetext`. */
	endLabel?: string;
	/** Play a tick per step, a deeper click per hour, and a thunk at the limits. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Largest diameter. The ring shrinks to fit narrower containers. */
	size?: keyof typeof sizes;
	disabled?: boolean;
	/** Submits `start` and `end` with a native form as `name[start]` and `name[end]`. */
	name?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Wraps minutes into 0..1439. */
function wrapDay(minutes: number) {
	return ((minutes % DAY) + DAY) % DAY;
}

/** Wraps a minute difference into -720..719. */
function wrapDelta(minutes: number) {
	return wrapDay(minutes + DAY / 2) - DAY / 2;
}

function durationOf({ start, end }: TimeRingValue) {
	return wrapDay(end - start);
}

/** A point on a circle around the center, clockwise from midnight at the top. */
function pointAt(minutes: number, radius: number) {
	const angle = (minutes / DAY) * Math.PI * 2;
	// Rounded so server and client render the same attributes.
	return [
		Number((CENTER + radius * Math.sin(angle)).toFixed(3)),
		Number((CENTER - radius * Math.cos(angle)).toFixed(3)),
	];
}

function formatTime(minutes: number, format: "12h" | "24h") {
	const hours = Math.floor(minutes / HOUR);
	const mins = String(minutes % HOUR).padStart(2, "0");
	if (format === "24h") return `${String(hours).padStart(2, "0")}:${mins}`;
	return `${hours % 12 || 12}:${mins} ${hours < 12 ? "AM" : "PM"}`;
}

function formatDuration(minutes: number) {
	const hours = Math.floor(minutes / HOUR);
	const mins = minutes % HOUR;
	if (!hours) return `${mins} min`;
	return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

function hourLabel(hour: number, format: "12h" | "24h") {
	if (format === "24h") return String(hour).padStart(2, "0");
	const short = hour % 12 || 12;
	return hour % 6 === 0 ? `${short}${hour < 12 ? "AM" : "PM"}` : String(short);
}

/** True if moving `delta` minutes from `from` passes or lands on a whole hour. */
function crossesHour(from: number, delta: number) {
	if (delta > 0) {
		return Math.floor((from + delta) / HOUR) > Math.floor(from / HOUR);
	}
	return Math.ceil((from + delta) / HOUR) < Math.ceil(from / HOUR);
}

function arcPath(start: number, end: number) {
	const sweep = wrapDay(end - start);
	if (sweep < 0.5) return "";
	const [x0, y0] = pointAt(start, TRACK_RADIUS);
	const [x1, y1] = pointAt(start + sweep, TRACK_RADIUS);
	const large = sweep > DAY / 2 ? 1 : 0;
	return `M ${x0} ${y0} A ${TRACK_RADIUS} ${TRACK_RADIUS} 0 ${large} 1 ${x1} ${y1}`;
}

export function TimeRing({
	value: valueProp,
	defaultValue,
	onValueChange,
	step: stepProp = 5,
	minDuration,
	maxDuration,
	format = "12h",
	startIcon,
	endIcon,
	startLabel = "Bedtime",
	endLabel = "Wake up",
	sound = true,
	haptics = true,
	size = "md",
	disabled = false,
	name,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	className,
}: TimeRingProps) {
	const step: number = steps.includes(stepProp) ? stepProp : 5;
	// Limits sit on whole steps, and a range never covers the whole day.
	const minRange = clamp(
		Math.ceil((minDuration ?? step) / step) * step || step,
		step,
		DAY - step,
	);
	const maxRange = clamp(
		Math.floor((maxDuration ?? DAY - step) / step) * step,
		minRange,
		DAY - step,
	);

	const normalize = (range: TimeRingValue): TimeRingValue => {
		const start = wrapDay(Math.round(range.start / step) * step || 0);
		const end = wrapDay(Math.round(range.end / step) * step || 0);
		const duration = clamp(wrapDay(end - start), minRange, maxRange);
		return { start, end: wrapDay(start + duration) };
	};

	const controlled = valueProp !== undefined;
	const [internalValue, setInternalValue] = useState<TimeRingValue>(
		() => valueProp ?? defaultValue ?? { start: 23 * HOUR, end: 7 * HOUR },
	);
	const value = normalize(controlled ? valueProp : internalValue);
	const duration = durationOf(value);
	const durationHours = Math.floor(duration / HOUR);
	const durationMinutes = duration % HOUR;
	const startText = formatTime(value.start, format);
	const endText = formatTime(value.end, format);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playTick } = useTiks({ respectReducedMotion: false });
	const { click: playHour, toggle: playThunk } = useTiks({
		theme: deepTheme,
		respectReducedMotion: false,
	});

	const durationId = useId();
	const ringRef = useRef<HTMLDivElement>(null);
	const handleRefs = useRef<Record<Part, HTMLDivElement | null>>({
		start: null,
		end: null,
	});
	const valueRef = useRef(value);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const [dragging, setDragging] = useState<DragPart | null>(null);
	const dragRef = useRef<{
		pointerId: number;
		part: DragPart;
		centerX: number;
		centerY: number;
		scale: number;
		originX: number;
		originY: number;
		/** Minutes between where the handle sits and where it was grabbed. */
		offset: number;
		/** Pointer minutes on the last move, for arc drags. */
		lastPointer: number;
		/** Unsnapped duration for handle drags, or unwrapped start for arc drags. */
		raw: number;
		/** The arc's unwrapped start, snapped. */
		snapped: number;
		moved: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		valueRef.current = value;
	});

	// Both ends are unwrapped minutes, so a spring across midnight takes the short way.
	const startMinutes = useMotionValue(value.start);
	const endMinutes = useMotionValue(value.start + duration);
	const animationsRef = useRef<AnimationPlaybackControls[]>([]);

	const springTo = useCallback(
		(target: MotionValue<number>, minutes: number) => {
			const current = target.get();
			const next = current + wrapDelta(minutes - current);
			if (shouldReduceMotion) {
				target.jump(next);
				return;
			}
			if (next === current && target.getVelocity() === 0) return;
			animationsRef.current.push(
				animate(target, next, { ...snapSpring, restDelta: 0.01 }),
			);
		},
		[shouldReduceMotion],
	);

	useEffect(() => {
		for (const animation of animationsRef.current) animation.stop();
		animationsRef.current = [];
		springTo(startMinutes, value.start);
		springTo(endMinutes, value.end);
	}, [value.start, value.end, springTo, startMinutes, endMinutes]);

	useEffect(
		() => () => {
			for (const animation of animationsRef.current) animation.stop();
		},
		[],
	);

	const path = useTransform(() =>
		arcPath(startMinutes.get(), endMinutes.get()),
	);
	const startRotate = useTransform(startMinutes, (m) => (m / DAY) * 360);
	const endRotate = useTransform(endMinutes, (m) => (m / DAY) * 360);
	const startCounter = useTransform(startRotate, (deg) => -deg);
	const endCounter = useTransform(endRotate, (deg) => -deg);

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const thunk = () => {
		lastCueAtRef.current = performance.now();
		if (silent()) return;
		if (sound) playThunk(false);
		if (haptics) void haptic("medium");
	};

	// Called only for user input, so first render and prop changes stay quiet.
	const cue = (from: number, delta: number, atLimit: boolean) => {
		if (atLimit) {
			thunk();
			return;
		}
		const now = performance.now();
		// Whole hours always sound, so a fast drag still counts the hours.
		if (crossesHour(from, delta)) {
			lastCueAtRef.current = now;
			if (silent()) return;
			if (sound) playHour();
			if (haptics) void haptic("light");
			return;
		}
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (silent()) return;
		if (sound) playTick();
		if (haptics) void haptic("selection");
	};

	const commit = (next: TimeRingValue) => {
		const previous = valueRef.current;
		if (next.start === previous.start && next.end === previous.end) return;
		valueRef.current = next;
		setInternalValue(next);
		onValueChange?.(next);
	};

	/** Moves one handle so the range lasts `nextDuration`, with its cue. */
	const resize = (part: Part, nextDuration: number) => {
		const current = valueRef.current;
		const currentDuration = durationOf(current);
		if (nextDuration === currentDuration) return false;
		const atLimit = nextDuration === minRange || nextDuration === maxRange;
		if (part === "end") {
			commit({ ...current, end: wrapDay(current.start + nextDuration) });
			cue(current.end, nextDuration - currentDuration, atLimit);
		} else {
			commit({ ...current, start: wrapDay(current.end - nextDuration) });
			cue(current.start, currentDuration - nextDuration, atLimit);
		}
		return true;
	};

	/** Snaps an unsnapped value, holding the current step until it's clearly left. */
	const snap = (raw: number, current: number) =>
		Math.abs(raw - current) < step * (0.5 + HYSTERESIS)
			? current
			: Math.round(raw / step) * step;

	const pointerMinutes = (
		event: PointerEvent,
		drag: { centerX: number; centerY: number; scale: number },
	) => {
		const dx = (event.clientX - drag.centerX) / drag.scale;
		const dy = (event.clientY - drag.centerY) / drag.scale;
		// Clockwise from midnight at the top.
		const minutes = wrapDay((Math.atan2(dx, -dy) / (Math.PI * 2)) * DAY);
		return { minutes, dx, dy };
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled || event.button !== 0 || dragRef.current) return;
		const ring = event.currentTarget;
		const rect = ring.getBoundingClientRect();
		const geometry = {
			centerX: rect.left + rect.width / 2,
			centerY: rect.top + rect.height / 2,
			scale: rect.width / VIEW || 1,
		};
		const { minutes, dx, dy } = pointerMinutes(event, geometry);
		const radius = Math.hypot(dx, dy);
		if (Math.abs(radius - TRACK_RADIUS) > TRACK_WIDTH / 2 + HIT_SLOP) return;

		const current = valueRef.current;
		const distanceTo = (handle: number) => {
			const [x, y] = pointAt(handle, TRACK_RADIUS);
			return Math.hypot(dx - (x - CENTER), dy - (y - CENTER));
		};
		const toStart = distanceTo(current.start);
		const toEnd = distanceTo(current.end);
		let part: DragPart;
		if (Math.min(toStart, toEnd) <= HANDLE_HIT) {
			part = toEnd < toStart ? "end" : "start";
		} else if (wrapDay(minutes - current.start) <= durationOf(current)) {
			part = "arc";
		} else {
			// The bare track does nothing.
			return;
		}

		event.preventDefault();
		ring.setPointerCapture(event.pointerId);
		handleRefs.current[part === "end" ? "end" : "start"]?.focus({
			preventScroll: true,
		});
		dragRef.current = {
			pointerId: event.pointerId,
			part,
			...geometry,
			originX: event.clientX,
			originY: event.clientY,
			offset: part === "arc" ? 0 : wrapDelta(current[part] - minutes),
			lastPointer: minutes,
			raw: part === "arc" ? current.start : durationOf(current),
			snapped: current.start,
			moved: false,
		};
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
			setDragging(drag.part);
		}

		const { minutes } = pointerMinutes(event, drag);
		const current = valueRef.current;

		if (drag.part === "arc") {
			// The whole range follows the pointer around, keeping its length.
			drag.raw += wrapDelta(minutes - drag.lastPointer);
			drag.lastPointer = minutes;
			const next = snap(drag.raw, drag.snapped);
			if (next === drag.snapped) return;
			const delta = next - drag.snapped;
			drag.snapped = next;
			const length = durationOf(current);
			commit({
				start: wrapDay(next),
				end: wrapDay(next + length),
			});
			cue(current.start, delta, false);
			return;
		}

		// The handle goes where the pointer is, read from the side it came from,
		// and waits at a limit until the pointer comes back around to it.
		const target = wrapDay(minutes + drag.offset);
		const candidate =
			drag.part === "end"
				? wrapDay(target - current.start)
				: wrapDay(current.end - target);
		drag.raw = clamp(
			drag.raw + wrapDelta(candidate - drag.raw),
			minRange,
			maxRange,
		);
		const currentDuration = durationOf(current);
		resize(
			drag.part,
			clamp(snap(drag.raw, currentDuration), minRange, maxRange),
		);
	};

	const endDrag = (pointerId?: number) => {
		const drag = dragRef.current;
		if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
			return;
		}
		dragRef.current = null;
		const ring = ringRef.current;
		if (ring?.hasPointerCapture(drag.pointerId)) {
			ring.releasePointerCapture(drag.pointerId);
		}
		setDragging(null);
	};

	const handleKeyDown = (part: Part) => (event: KeyboardEvent) => {
		if (disabled) return;
		// Left and right follow the reading direction, like a native range input.
		const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
		const amount = event.shiftKey ? HOUR : step;
		let delta: number;
		switch (event.key) {
			case "ArrowUp":
				delta = amount;
				break;
			case "ArrowDown":
				delta = -amount;
				break;
			case "ArrowRight":
				delta = rtl ? -amount : amount;
				break;
			case "ArrowLeft":
				delta = rtl ? amount : -amount;
				break;
			case "PageUp":
				delta = HOUR;
				break;
			case "PageDown":
				delta = -HOUR;
				break;
			default:
				return;
		}
		event.preventDefault();
		const currentDuration = durationOf(valueRef.current);
		// Moving the start later shortens the range; moving the end later lengthens it.
		const nextDuration = clamp(
			part === "end" ? currentDuration + delta : currentDuration - delta,
			minRange,
			maxRange,
		);
		if (!resize(part, nextDuration) && !event.repeat) thunk();
	};

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const ring = ringRef.current;
		if (!ring) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current) event.preventDefault();
		};
		ring.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => ring.removeEventListener("touchmove", onTouchMove);
	}, []);

	const endDragRef = useRef(endDrag);
	useLayoutEffect(() => {
		endDragRef.current = endDrag;
	});
	useEffect(() => {
		if (disabled) endDragRef.current();
	}, [disabled]);

	// Handles hang off a point at the center, sized in the dial's container
	// units, so turning them never grows the page's scroll area. Min and max
	// match that size so the icon's intrinsic box cannot push a knob outward.
	const handleSize = `${(HANDLE_SIZE / VIEW) * 100}cqw`;
	const handleOffset = `${(-TRACK_RADIUS / VIEW) * 100}cqw`;

	const renderHandle = (part: Part) => {
		const minutes = value[part];
		const label = part === "start" ? startLabel : endLabel;
		const icon =
			part === "start" ? (startIcon ?? <Moon />) : (endIcon ?? <Sun />);
		return (
			<motion.div
				key={part}
				className="pointer-events-none absolute top-1/2 left-1/2 size-0"
				style={{ rotate: part === "start" ? startRotate : endRotate }}
			>
				<div
					ref={(node) => {
						handleRefs.current[part] = node;
					}}
					role="slider"
					tabIndex={disabled ? -1 : 0}
					aria-label={label}
					aria-valuemin={0}
					aria-valuemax={DAY - step}
					aria-valuenow={minutes}
					aria-valuetext={`${label} ${formatTime(minutes, format)}`}
					aria-describedby={durationId}
					aria-disabled={disabled || undefined}
					data-slot={`time-ring-${part}`}
					data-state={dragging === part ? "dragging" : "idle"}
					onKeyDown={handleKeyDown(part)}
					className="-translate-1/2 pointer-events-auto absolute left-0 flex min-h-0 min-w-0 cursor-grab items-center justify-center rounded-full bg-background text-[var(--time-ring-accent)] shadow-[0_1px_2px_rgb(0_0_0/0.16),0_0_0_1px_rgb(0_0_0/0.08)] outline-none transition-transform duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=dragging]:scale-110 group-data-disabled/time-ring:pointer-events-none motion-reduce:transition-none dark:bg-zinc-950 dark:shadow-[0_1px_3px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.14)]"
					style={{
						top: handleOffset,
						width: handleSize,
						height: handleSize,
						minWidth: handleSize,
						minHeight: handleSize,
						maxWidth: handleSize,
						maxHeight: handleSize,
					}}
				>
					<motion.span
						aria-hidden
						className="flex size-[56%] min-h-0 min-w-0 items-center justify-center [&_svg]:size-full [&_svg]:shrink-0"
						style={{ rotate: part === "start" ? startCounter : endCounter }}
					>
						{icon}
					</motion.span>
				</div>
			</motion.div>
		);
	};

	return (
		<div
			role="group"
			aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? "Time range")}
			aria-labelledby={ariaLabelledBy}
			data-slot="time-ring"
			data-size={size}
			data-state={dragging ? "dragging" : "idle"}
			data-disabled={disabled || undefined}
			className={cn(
				"group/time-ring w-full min-w-0 select-none [--time-ring-accent:var(--color-orange-500)] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
			style={{ maxWidth: sizes[size] }}
		>
			<div
				ref={ringRef}
				data-slot="time-ring-dial"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={(event) => endDrag(event.pointerId)}
				onPointerCancel={(event) => endDrag(event.pointerId)}
				onLostPointerCapture={(event) => endDrag(event.pointerId)}
				onContextMenu={(event) => event.preventDefault()}
				className="relative aspect-square w-full touch-none [-webkit-touch-callout:none] [container-type:inline-size] group-data-disabled/time-ring:pointer-events-none group-data-[state=dragging]/time-ring:cursor-grabbing"
			>
				<svg
					aria-hidden
					viewBox={`0 0 ${VIEW} ${VIEW}`}
					className="absolute inset-0 size-full overflow-visible"
				>
					<circle
						data-slot="time-ring-track"
						cx={CENTER}
						cy={CENTER}
						r={TRACK_RADIUS}
						fill="none"
						strokeWidth={TRACK_WIDTH}
						className="stroke-zinc-300 dark:stroke-zinc-600"
					/>
					<g data-slot="time-ring-ticks">
						{Array.from({ length: 24 }, (_, hour) => {
							const major = hour % 3 === 0;
							const [x0, y0] = pointAt(hour * HOUR, TICK_OUTER);
							const [x1, y1] = pointAt(
								hour * HOUR,
								TICK_OUTER - (major ? 3.75 : 2.25),
							);
							return (
								<line
									key={hour}
									x1={x0}
									y1={y0}
									x2={x1}
									y2={y1}
									strokeWidth={major ? 1.35 : 1}
									strokeLinecap="round"
									className={
										major ? "stroke-foreground/50" : "stroke-foreground/28"
									}
								/>
							);
						})}
					</g>
					<g data-slot="time-ring-labels">
						{Array.from({ length: 8 }, (_, index) => {
							const hour = index * 3;
							const [x, y] = pointAt(hour * HOUR, LABEL_RADIUS);
							return (
								<text
									key={hour}
									x={x}
									y={y}
									textAnchor="middle"
									dominantBaseline="central"
									fontSize={hour % 6 === 0 ? 6.5 : 5.75}
									className={cn(
										"fill-foreground/80 font-medium tabular-nums",
										hour % 6 !== 0 && "fill-foreground/58 font-normal",
									)}
								>
									{hourLabel(hour, format)}
								</text>
							);
						})}
					</g>
					<motion.path
						data-slot="time-ring-arc"
						d={path}
						fill="none"
						strokeWidth={ARC_WIDTH}
						strokeLinecap="round"
						className="cursor-grab stroke-[var(--time-ring-accent)] group-data-[state=dragging]/time-ring:cursor-grabbing"
					/>
				</svg>

				{renderHandle("start")}
				{renderHandle("end")}

				<div
					aria-hidden
					data-slot="time-ring-readout"
					className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[2.8cqw] text-center"
				>
					<NumberFlowGroup>
						<div className="flex items-baseline justify-center gap-[0.22em] font-semibold text-[length:9cqw] text-foreground tabular-nums leading-none tracking-[-0.045em]">
							{durationHours ? (
								<span className="flex items-baseline gap-[0.14em]">
									<NumberFlow
										value={durationHours}
										animated={!shouldReduceMotion}
										respectMotionPreference={false}
										transformTiming={digitTiming}
										spinTiming={digitTiming}
									/>
									<span className="font-medium text-[0.42em] text-foreground/55 tracking-[-0.02em]">
										hr
									</span>
								</span>
							) : null}
							{durationMinutes || !durationHours ? (
								<span className="flex items-baseline gap-[0.14em]">
									<NumberFlow
										value={durationMinutes}
										animated={!shouldReduceMotion}
										respectMotionPreference={false}
										transformTiming={digitTiming}
										spinTiming={digitTiming}
									/>
									<span className="font-medium text-[0.42em] text-foreground/55 tracking-[-0.02em]">
										min
									</span>
								</span>
							) : null}
						</div>
					</NumberFlowGroup>
					<p className="whitespace-nowrap font-medium text-[length:3.5cqw] text-foreground/70 tabular-nums leading-none tracking-[-0.01em]">
						{startText} – {endText}
					</p>
				</div>
				<span id={durationId} className="sr-only">
					{formatDuration(duration)}
				</span>
			</div>

			{name ? (
				<>
					<input
						type="hidden"
						name={`${name}[start]`}
						value={value.start}
						disabled={disabled}
					/>
					<input
						type="hidden"
						name={`${name}[end]`}
						value={value.end}
						disabled={disabled}
					/>
				</>
			) : null}
		</div>
	);
}

export default TimeRing;
