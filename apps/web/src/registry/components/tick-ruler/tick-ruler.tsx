"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	type KeyboardEvent,
	memo,
	type PointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const landingSpring = { type: "spring", stiffness: 420, damping: 38 } as const;
const digitTransition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;

/** Seconds of release velocity that a flick coasts before it snaps. */
const COAST_SECONDS = 0.25;
/** Fastest release, in px/s, so one jumpy pointer event can't fling the range. */
const MAX_VELOCITY = 4000;
/** Furthest the strip travels past a bound, in px. */
const MAX_OVERSHOOT = 40;
/** Minimum ms between step sounds and haptics. */
const TICK_THROTTLE_MS = 35;
/** Pointer travel, in px, below which a press counts as a tap. */
const TAP_SLOP = 5;
/** Ranges with more ticks than this render only the ticks near the needle. */
const WINDOW_THRESHOLD = 400;

const sizes = {
	sm: { spacing: 8, track: "h-14", readout: "text-3xl", unit: "text-sm" },
	md: { spacing: 10, track: "h-16", readout: "text-5xl", unit: "text-base" },
	lg: { spacing: 12, track: "h-20", readout: "text-6xl", unit: "text-lg" },
} as const;

type Orientation = "horizontal" | "vertical";
type RulerState = "idle" | "dragging" | "coasting";

export interface TickRulerProps {
	/** Controlled value. */
	value?: number;
	/** Initial value when uncontrolled; double-click resets to it. */
	defaultValue?: number;
	/** Called every time the needle crosses onto a new step. */
	onValueChange?: (value: number) => void;
	/** Called once the ruler settles after a drag, flick, key, wheel, or preset. */
	onValueCommit?: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/** Steps between medium ticks. */
	majorEvery?: number;
	/** Steps between labelled ticks. */
	labelEvery?: number;
	/** Pixels between ticks. Defaults by `size`. */
	spacing?: number;
	/** Unit shown after the readout, e.g. `min`. */
	unit?: string;
	/** Formats the readout and `aria-valuetext`. */
	format?: (value: number) => string;
	/** Values shown as chips that glide the ruler to them. */
	presets?: number[];
	/** Play a click per step and a pop at the bounds. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	/** Accessible name for the slider. */
	label?: string;
	className?: string;
	size?: keyof typeof sizes;
	orientation?: Orientation;
	/** Show the large value readout above the ruler. */
	showValue?: boolean;
}

function decimalsOf(value: number) {
	const text = String(value);
	if (text.includes("e-")) return Number(text.split("e-")[1]);
	return text.split(".")[1]?.length ?? 0;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Pulls travel past a bound back so it never exceeds `MAX_OVERSHOOT`. */
function rubberBand(position: number, maxPosition: number) {
	if (position < 0) {
		const over = -position;
		return -(MAX_OVERSHOOT * over) / (over + MAX_OVERSHOOT);
	}
	if (position > maxPosition) {
		const over = position - maxPosition;
		return maxPosition + (MAX_OVERSHOOT * over) / (over + MAX_OVERSHOOT);
	}
	return position;
}

type DigitSlot = { char: string; id: number };

let nextDigitId = 0;

/** Aligns `text` to `previous` from the right, keeping ids of unchanged chars. */
function toSlots(text: string, previous: DigitSlot[]): DigitSlot[] {
	const chars = text.split("");
	return chars.map((char, index) => {
		const match = previous[previous.length - chars.length + index];
		if (match?.char === char) return match;
		nextDigitId += 1;
		return { char, id: nextDigitId };
	});
}

function RollingValue({
	text,
	direction,
	animated,
}: {
	text: string;
	direction: number;
	animated: boolean;
}) {
	// Each slot gets a fresh key whenever its character changes. Reusing a key
	// while its previous copy is still exiting can leave the digit hidden.
	const [slots, setSlots] = useState(() => toSlots(text, []));
	const [previousText, setPreviousText] = useState(text);
	if (text !== previousText) {
		setPreviousText(text);
		setSlots((previous) => toSlots(text, previous));
	}

	if (!animated) return <span>{text}</span>;

	return (
		<span className="inline-flex">
			{slots.map(({ char, id }, index) => (
				// Keyed from the right so units digits stay put as the width changes.
				<span key={slots.length - index} className="relative inline-block">
					<AnimatePresence mode="popLayout" initial={false} custom={direction}>
						<motion.span
							key={id}
							custom={direction}
							className="inline-block"
							variants={{
								enter: (d: number) => ({ y: d * 12, opacity: 0 }),
								center: { y: 0, opacity: 1 },
								exit: (d: number) => ({ y: d * -12, opacity: 0 }),
							}}
							initial="enter"
							animate="center"
							exit="exit"
							transition={digitTransition}
						>
							{char}
						</motion.span>
					</AnimatePresence>
				</span>
			))}
		</span>
	);
}

const TickStrip = memo(function TickStrip({
	start,
	end,
	spacing,
	sign,
	orientation,
	majorEvery,
	labelEvery,
	labelAt,
}: {
	start: number;
	end: number;
	spacing: number;
	sign: number;
	orientation: Orientation;
	majorEvery: number;
	labelEvery: number;
	labelAt: (index: number) => string;
}) {
	const horizontal = orientation === "horizontal";
	const ticks = [];
	for (let index = start; index <= end; index++) {
		const kind =
			index % labelEvery === 0
				? "label"
				: index % majorEvery === 0
					? "major"
					: "minor";
		const offset = sign * index * spacing;
		ticks.push(
			<span
				key={index}
				data-kind={kind}
				className={cn(
					"absolute flex items-center gap-1.5",
					horizontal
						? "top-0 -translate-x-1/2 flex-col"
						: "left-0 -translate-y-1/2 flex-row",
				)}
				style={horizontal ? { left: offset } : { top: offset }}
			>
				<span
					className={cn(
						"rounded-full",
						horizontal ? "w-px" : "h-px",
						kind === "minor" && "bg-muted-foreground/35",
						kind === "minor" && (horizontal ? "h-3" : "w-3"),
						kind === "major" && "bg-muted-foreground/60",
						kind === "major" && (horizontal ? "h-5" : "w-5"),
						kind === "label" && "bg-foreground/80",
						kind === "label" &&
							(horizontal ? "h-7 w-[1.5px]" : "h-[1.5px] w-7"),
					)}
				/>
				{kind === "label" ? (
					<span className="font-medium text-[11px] text-muted-foreground tabular-nums leading-none">
						{labelAt(index)}
					</span>
				) : null}
			</span>,
		);
	}
	return <>{ticks}</>;
});

export function TickRuler({
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	min = 0,
	max = 100,
	step = 1,
	majorEvery = 5,
	labelEvery = 10,
	spacing: spacingProp,
	unit,
	format,
	presets,
	sound = true,
	haptics = true,
	disabled = false,
	label = "Value",
	className,
	size = "md",
	orientation = "horizontal",
	showValue = true,
}: TickRulerProps) {
	const sizeStyle = sizes[size];
	const spacing = spacingProp ?? sizeStyle.spacing;
	const horizontal = orientation === "horizontal";
	const decimals = Math.max(decimalsOf(step), decimalsOf(min));
	const maxIndex = Math.max(0, Math.round((max - min) / step));
	const maxPosition = maxIndex * spacing;

	const indexToValue = useCallback(
		(index: number) => Number((min + index * step).toFixed(decimals)),
		[min, step, decimals],
	);
	const valueToIndex = useCallback(
		(value: number) => clamp(Math.round((value - min) / step), 0, maxIndex),
		[min, step, maxIndex],
	);
	const formatValue = useCallback(
		(value: number) => (format ? format(value) : value.toFixed(decimals)),
		[format, decimals],
	);

	const initialIndex = valueToIndex(valueProp ?? defaultValue ?? min);
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [direction, setDirection] = useState(1);
	const [sign, setSign] = useState(horizontal ? 1 : -1);
	const [range, setRange] = useState(() =>
		maxIndex + 1 <= WINDOW_THRESHOLD
			? { start: 0, end: maxIndex }
			: {
					start: Math.max(0, initialIndex - 60),
					end: Math.min(maxIndex, initialIndex + 60),
				},
	);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const { click: playClick, pop: playPop } = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const position = useMotionValue(initialIndex * spacing);
	const stripOffset = useMotionValue(0);
	const centerRef = useRef(0);
	const indexRef = useRef(initialIndex);
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const silentRef = useRef(false);
	const interactingRef = useRef(false);
	const lastTickAtRef = useRef(Number.NEGATIVE_INFINITY);
	const chunkRef = useRef(-1);
	const wheelRef = useRef({ accumulated: 0, target: initialIndex });
	const dragRef = useRef<{
		pointerId: number;
		start: number;
		startPosition: number;
		moved: boolean;
		scale: number;
	} | null>(null);

	// Latest values for the imperative listeners below, so they never re-bind.
	const latest = useRef({
		sound,
		haptics,
		onValueChange,
		onValueCommit,
		indexToValue,
		maxIndex,
		maxPosition,
		spacing,
		sign,
		labelEvery,
	});
	useLayoutEffect(() => {
		latest.current = {
			sound,
			haptics,
			onValueChange,
			onValueCommit,
			indexToValue,
			maxIndex,
			maxPosition,
			spacing,
			sign,
			labelEvery,
		};
	});

	const setRulerState = useCallback((state: RulerState) => {
		if (rootRef.current) rootRef.current.dataset.state = state;
	}, []);

	const updateRange = useCallback((pos: number) => {
		const { maxIndex, spacing } = latest.current;
		if (maxIndex + 1 <= WINDOW_THRESHOLD) {
			if (chunkRef.current !== 0) {
				chunkRef.current = 0;
				setRange({ start: 0, end: maxIndex });
			}
			return;
		}
		const visible = Math.ceil((centerRef.current * 2) / spacing) || 60;
		const chunkSize = Math.max(40, visible);
		const chunk = Math.floor(pos / spacing / chunkSize);
		if (chunk === chunkRef.current) return;
		chunkRef.current = chunk;
		setRange({
			start: Math.max(0, (chunk - 1) * chunkSize),
			end: Math.min(maxIndex, (chunk + 2) * chunkSize),
		});
	}, []);

	// The one place that reacts to movement: transforms, ticks, and feedback.
	useEffect(() => {
		const sync = (pos: number) => {
			const {
				sign,
				spacing,
				maxIndex,
				indexToValue,
				labelEvery,
				sound,
				haptics,
				onValueChange,
			} = latest.current;
			stripOffset.set(centerRef.current - sign * pos);
			updateRange(pos);

			const index = clamp(Math.round(pos / spacing), 0, maxIndex);
			const previous = indexRef.current;
			if (index === previous) return;
			indexRef.current = index;
			setCurrentIndex(index);
			setDirection(index > previous ? 1 : -1);
			if (silentRef.current) return;

			onValueChange?.(indexToValue(index));
			const now = performance.now();
			const atBound = index === 0 || index === maxIndex;
			// Bounds always sound so a fast flick still ends on the pop.
			if (!atBound && now - lastTickAtRef.current < TICK_THROTTLE_MS) return;
			lastTickAtRef.current = now;
			if (atBound) {
				if (sound) playPop();
				if (haptics) void haptic("rigid");
			} else {
				if (sound) playClick();
				if (haptics)
					void haptic(index % labelEvery === 0 ? "light" : "selection");
			}
		};
		sync(position.get());
		return position.on("change", sync);
	}, [haptic, playClick, playPop, position, stripOffset, updateRange]);

	// Track size and direction.
	useLayoutEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		const measure = () => {
			const rtl = getComputedStyle(track).direction === "rtl";
			const nextSign = horizontal ? (rtl ? -1 : 1) : -1;
			latest.current.sign = nextSign;
			setSign(nextSign);
			centerRef.current =
				(horizontal ? track.offsetWidth : track.offsetHeight) / 2;
			chunkRef.current = -1;
			stripOffset.set(centerRef.current - nextSign * position.get());
			updateRange(position.get());
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		return () => observer.disconnect();
	}, [horizontal, position, stripOffset, updateRange]);

	// Spacing or range changes keep the current step under the needle.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the range changes too
	useEffect(() => {
		chunkRef.current = -1;
		position.jump(indexRef.current * spacing);
	}, [position, spacing, maxIndex]);

	const stop = useCallback(() => {
		animationRef.current?.stop();
		animationRef.current = null;
	}, []);

	const settle = useCallback(
		(
			targetIndex: number,
			{
				velocity = 0,
				silent = false,
				onLand,
			}: { velocity?: number; silent?: boolean; onLand?: () => void } = {},
		) => {
			stop();
			const target = clamp(targetIndex, 0, latest.current.maxIndex);
			const targetPosition = target * latest.current.spacing;
			silentRef.current = silent;
			const finish = () => {
				animationRef.current = null;
				silentRef.current = false;
				setRulerState("idle");
				if (!silent) {
					latest.current.onValueCommit?.(latest.current.indexToValue(target));
					onLand?.();
				}
			};
			if (shouldReduceMotion || position.get() === targetPosition) {
				position.jump(targetPosition);
				finish();
				return;
			}
			setRulerState("coasting");
			animationRef.current = animate(position, targetPosition, {
				...landingSpring,
				velocity,
				restDelta: 0.01,
				onComplete: finish,
			});
		},
		[position, setRulerState, shouldReduceMotion, stop],
	);

	// Controlled value: glide there silently unless the user is interacting.
	useEffect(() => {
		if (valueProp === undefined || interactingRef.current) return;
		const target = valueToIndex(valueProp);
		if (target === indexRef.current && !animationRef.current) return;
		if (animationRef.current && !silentRef.current) return;
		settle(target, { silent: true });
	}, [valueProp, valueToIndex, settle]);

	useEffect(() => stop, [stop]);

	const pointerAxis = (event: PointerEvent) =>
		horizontal ? event.clientX : event.clientY;

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled || event.button !== 0) return;
		const track = event.currentTarget;
		track.setPointerCapture(event.pointerId);
		track.focus({ preventScroll: true });
		stop();
		silentRef.current = false;
		interactingRef.current = true;
		const rect = track.getBoundingClientRect();
		// CSS zoom and transforms scale client coordinates; work in local px.
		const scale = horizontal
			? rect.width / (track.offsetWidth || 1)
			: rect.height / (track.offsetHeight || 1);
		dragRef.current = {
			pointerId: event.pointerId,
			start: pointerAxis(event),
			startPosition: position.get(),
			moved: false,
			scale: scale || 1,
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const delta = (pointerAxis(event) - drag.start) / drag.scale;
		if (!drag.moved) {
			if (Math.abs(delta) < TAP_SLOP) return;
			drag.moved = true;
			setRulerState("dragging");
		}
		const raw = drag.startPosition - sign * delta;
		position.set(rubberBand(raw, maxPosition));
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragRef.current = null;
		interactingRef.current = false;
		const track = event.currentTarget;
		if (track.hasPointerCapture(event.pointerId)) {
			track.releasePointerCapture(event.pointerId);
		}

		if (!drag.moved) {
			// Tap: glide to the tick under the pointer.
			const rect = track.getBoundingClientRect();
			const local =
				(pointerAxis(event) - (horizontal ? rect.left : rect.top)) / drag.scale;
			const offset = sign * (local - centerRef.current);
			settle(Math.round((position.get() + offset) / spacing));
			return;
		}

		const velocity = clamp(position.getVelocity(), -MAX_VELOCITY, MAX_VELOCITY);
		const current = position.get();
		const coast = shouldReduceMotion ? 0 : velocity * COAST_SECONDS;
		const target = clamp(current + coast, 0, maxPosition);
		settle(Math.round(target / spacing), { velocity });
	};

	const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return;
		dragRef.current = null;
		interactingRef.current = false;
		settle(Math.round(clamp(position.get(), 0, maxPosition) / spacing));
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;
		const stepBy = event.shiftKey ? 10 : 1;
		const flip = horizontal && sign < 0 ? -1 : 1;
		// Repeated keys build on the pending target, not the moving needle.
		const from = animationRef.current
			? wheelRef.current.target
			: indexRef.current;
		let target: number | null = null;
		switch (event.key) {
			case "ArrowRight":
				target = from + stepBy * flip;
				break;
			case "ArrowLeft":
				target = from - stepBy * flip;
				break;
			case "ArrowUp":
				target = from + stepBy;
				break;
			case "ArrowDown":
				target = from - stepBy;
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
				target = maxIndex;
				break;
			default:
				return;
		}
		event.preventDefault();
		target = clamp(target, 0, maxIndex);
		wheelRef.current.target = target;
		settle(target);
	};

	// Wheel needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const track = trackRef.current;
		if (!track || disabled) return;
		const onWheel = (event: WheelEvent) => {
			const { sign, maxIndex, spacing } = latest.current;
			const along = horizontal ? event.deltaX : event.deltaY;
			const across = horizontal ? event.deltaY : event.deltaX;
			let delta = 0;
			if (Math.abs(along) >= Math.abs(across)) {
				delta = sign * along;
			} else if (horizontal && document.activeElement === track) {
				// A plain mouse wheel only drives a focused horizontal ruler.
				delta = -across;
			} else {
				return;
			}
			event.preventDefault();
			const wheel = wheelRef.current;
			if (!animationRef.current) wheel.target = indexRef.current;
			let steps = 0;
			if (event.deltaMode !== 0 || Math.abs(delta) >= 50) {
				// One notch, one step.
				steps = Math.sign(delta);
				wheel.accumulated = 0;
			} else {
				wheel.accumulated += delta;
				steps = Math.trunc(wheel.accumulated / spacing);
				wheel.accumulated -= steps * spacing;
			}
			if (steps === 0) return;
			const target = clamp(wheel.target + steps, 0, maxIndex);
			if (target === wheel.target) return;
			wheel.target = target;
			settle(target);
		};
		track.addEventListener("wheel", onWheel, { passive: false });
		return () => track.removeEventListener("wheel", onWheel);
	}, [disabled, horizontal, settle]);

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.moved) event.preventDefault();
		};
		track.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => track.removeEventListener("touchmove", onTouchMove);
	}, []);

	const currentValue = indexToValue(currentIndex);
	const valueText = format
		? format(currentValue)
		: `${formatValue(currentValue)}${unit ? ` ${unit}` : ""}`;
	const labelAt = useCallback(
		(index: number) => indexToValue(index).toFixed(decimals),
		[indexToValue, decimals],
	);
	const defaultIndex = valueToIndex(defaultValue ?? min);

	return (
		<div
			ref={rootRef}
			data-slot="tick-ruler"
			data-state="idle"
			data-orientation={orientation}
			data-disabled={disabled || undefined}
			data-bound={
				currentIndex === 0
					? "min"
					: currentIndex === maxIndex
						? "max"
						: undefined
			}
			className={cn(
				"group/ruler flex select-none gap-4 [--tick-ruler-accent:var(--color-orange-500)] data-disabled:opacity-50",
				horizontal ? "w-full flex-col items-center" : "flex-row items-center",
				className,
			)}
		>
			{showValue ? (
				<div
					aria-hidden
					data-slot="tick-ruler-value"
					className={cn(
						"flex items-baseline gap-1.5 font-semibold text-foreground tabular-nums tracking-tight",
						sizeStyle.readout,
					)}
				>
					<RollingValue
						text={formatValue(currentValue)}
						direction={direction}
						animated={!shouldReduceMotion}
					/>
					{unit && !format ? (
						<span
							className={cn(
								"font-medium text-muted-foreground tracking-normal",
								sizeStyle.unit,
							)}
						>
							{unit}
						</span>
					) : null}
				</div>
			) : null}

			<div
				ref={trackRef}
				role="slider"
				tabIndex={disabled ? -1 : 0}
				aria-label={label}
				aria-orientation={orientation}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={currentValue}
				aria-valuetext={valueText}
				aria-disabled={disabled || undefined}
				data-slot="tick-ruler-track"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onKeyDown={handleKeyDown}
				onDoubleClick={() => {
					if (!disabled) settle(defaultIndex);
				}}
				className={cn(
					"relative cursor-grab overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-data-disabled/ruler:pointer-events-none group-data-[state=dragging]/ruler:cursor-grabbing",
					horizontal
						? cn(
								"w-full touch-pan-y [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]",
								sizeStyle.track,
							)
						: "h-64 w-20 touch-none [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]",
				)}
			>
				<motion.div
					aria-hidden
					className={cn(
						"absolute will-change-transform",
						horizontal ? "top-2 left-0" : "top-0 left-3",
					)}
					style={horizontal ? { x: stripOffset } : { y: stripOffset }}
				>
					<TickStrip
						start={range.start}
						end={range.end}
						spacing={spacing}
						sign={sign}
						orientation={orientation}
						majorEvery={majorEvery}
						labelEvery={labelEvery}
						labelAt={labelAt}
					/>
				</motion.div>

				<span
					aria-hidden
					data-slot="tick-ruler-needle"
					className={cn(
						"pointer-events-none absolute rounded-full bg-[var(--tick-ruler-accent)] transition-[transform,box-shadow] duration-200 ease-out group-hover/ruler:scale-110 group-data-[state=dragging]/ruler:scale-115 group-data-[state=dragging]/ruler:shadow-[0_0_12px_2px_var(--tick-ruler-accent)]",
						horizontal
							? "top-1 left-1/2 h-9 w-[3px] origin-top -translate-x-1/2"
							: "top-1/2 left-1 h-[3px] w-11 origin-left -translate-y-1/2",
					)}
				/>
			</div>

			{presets?.length ? (
				<div
					data-slot="tick-ruler-presets"
					className={cn(
						"flex flex-wrap gap-2",
						horizontal ? "justify-center" : "flex-col",
					)}
				>
					{presets.map((preset) => {
						const active = valueToIndex(preset) === currentIndex;
						return (
							<button
								key={preset}
								type="button"
								disabled={disabled}
								data-active={active || undefined}
								onClick={() =>
									settle(valueToIndex(preset), {
										onLand: () => {
											if (haptics) void haptic("nudge");
										},
									})
								}
								className="h-8 cursor-pointer rounded-full border border-border bg-background px-3.5 font-medium text-muted-foreground text-sm tabular-nums shadow-xs outline-none transition-[color,background-color,border-color] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none data-active:border-transparent data-active:bg-foreground data-active:text-background dark:border-input dark:bg-input/30 dark:data-active:bg-foreground"
							>
								{format ? format(preset) : formatValue(preset)}
								{unit && !format ? ` ${unit}` : null}
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

export default TickRuler;
