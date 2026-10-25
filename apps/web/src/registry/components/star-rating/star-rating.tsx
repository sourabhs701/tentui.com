"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { Star } from "lucide-react";
import {
	AnimatePresence,
	type AnimationPlaybackControlsWithThen,
	animate,
	motion,
	type Transition,
	useReducedMotion,
} from "motion/react";
import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const riseSpring = { type: "spring", stiffness: 500, damping: 18 } as const;
const pressSpring = { type: "spring", stiffness: 600, damping: 30 } as const;

/** Ms the fill takes to slide to the pointer. */
const FILL_MS = 150;
/** Ms between stars rising on a higher pick. */
const RISE_STAGGER_MS = 35;
/** Ms between stars draining on a clear. */
const DRAIN_STAGGER_MS = 25;
/** Minimum ms between star sounds and haptics. */
const CUE_THROTTLE_MS = 35;
/** Px a touch travels before it counts as a sweep or a scroll. */
const TOUCH_SLOP = 8;
/** Most stars a row can hold. */
const MAX_STARS = 10;

const sizes = {
	sm: { cell: "w-6", star: "size-5", caption: "text-xs" },
	md: { cell: "w-8", star: "size-7", caption: "text-sm" },
	lg: { cell: "w-10", star: "size-9", caption: "text-base" },
} as const;

type Gesture = {
	pointerId: number;
	touch: boolean;
	startX: number;
	startY: number;
	/** Value when the press began. */
	start: number;
	/** Value under the pointer when it went down. */
	pressed: number;
	/** Value the drag currently shows. */
	current: number;
	/** Touch waits for `TOUCH_SLOP` px of travel to tell a sweep from a scroll. */
	intent: "pending" | "rate";
	sweeping: boolean;
	star: number;
};

export interface StarRatingProps {
	/** Controlled value, from 0 (empty) to `max`. */
	value?: number;
	/** Initial value when uncontrolled. */
	defaultValue?: number;
	/** Called on every change, including each step of a sweep. */
	onValueChange?: (value: number) => void;
	/** Called once a pick lands: on release, a key press, or a clear. */
	onValueCommit?: (value: number) => void;
	/** Number of stars, up to 10. */
	max?: number;
	/** Let the left half of a star rate x.5. */
	allowHalf?: boolean;
	/** Tapping the current value again, `Backspace` or `Delete` clears it. */
	clearable?: boolean;
	/** Show the value as a single image without interaction. */
	readOnly?: boolean;
	disabled?: boolean;
	/** Caption per star, e.g. "Poor" to "Excellent". With `allowHalf`, pass one per half step to label halves too. */
	labels?: string[];
	size?: keyof typeof sizes;
	/** Play a click per star crossed and a pop when a pick lands. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Submits the value with a native form through a hidden input. */
	name?: string;
	/** Accessible name for the group. */
	"aria-label"?: string;
	className?: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Snaps to the step on a whole-number grid so halves never drift. */
function snapTo(value: number, step: number, max: number) {
	if (!Number.isFinite(value)) return 0;
	const steps = Math.round(value / step);
	return clamp(steps * step, 0, max);
}

function formatCount(value: number) {
	return String(Number(value.toFixed(2)));
}

function starsLabel(value: number) {
	return `${formatCount(value)} ${value === 1 ? "star" : "stars"}`;
}

/** How much of star `index` (0-based) a value fills, from 0 to 1. */
function fillOf(value: number, index: number) {
	return clamp(value - index, 0, 1);
}

export function StarRating({
	value: valueProp,
	defaultValue = 0,
	onValueChange,
	onValueCommit,
	max: maxProp = 5,
	allowHalf = false,
	clearable = true,
	readOnly = false,
	disabled = false,
	labels,
	size = "md",
	sound = true,
	haptics = true,
	name,
	"aria-label": ariaLabel = "Rating",
	className,
}: StarRatingProps) {
	const max = clamp(Math.round(maxProp), 1, MAX_STARS);
	const step = allowHalf ? 0.5 : 1;
	const steps = Math.round(max / step);
	const interactive = !readOnly && !disabled;

	// Read-only shows any fraction; inputs snap to whole or half stars.
	const snap = (raw: number) =>
		readOnly ? clamp(Number(raw.toFixed(2)), 0, max) : snapTo(raw, step, max);

	const controlled = valueProp !== undefined;
	const [internalValue, setInternalValue] = useState(() => snap(defaultValue));
	const value = controlled ? snap(valueProp) : internalValue;

	const [drag, setDrag] = useState<number | null>(null);
	const [hover, setHover] = useState<number | null>(null);
	const [phase, setPhase] = useState<"idle" | "pressed" | "sweeping">("idle");
	const [drainFrom, setDrainFrom] = useState(0);

	// The drag wins over the value prop while sweeping.
	const display = drag ?? hover ?? value;
	const previewing = drag === null && hover !== null && hover !== value;
	const draining = display === 0 && drainFrom > 0;

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		success: playSuccess,
		toggle: playToggle,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const rowRef = useRef<HTMLDivElement>(null);
	const starRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const radioRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const starAnimations = useRef<(AnimationPlaybackControlsWithThen | null)[]>(
		[],
	);
	const mountedRef = useRef(true);
	const valueRef = useRef(value);
	const gestureRef = useRef<Gesture | null>(null);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	// After a click, hold the hover preview until the pointer reaches another value.
	const hoverHoldRef = useRef<number | null>(null);

	useLayoutEffect(() => {
		if (!gestureRef.current) valueRef.current = value;
	});

	useEffect(() => {
		mountedRef.current = true;
		const animations = starAnimations.current;
		return () => {
			mountedRef.current = false;
			for (const animation of animations) animation?.stop();
		};
	}, []);

	const crossCue = () => {
		const now = performance.now();
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (sound) playClick();
		if (haptics) void haptic("selection");
	};

	const commitCue = (next: number) => {
		lastCueAtRef.current = performance.now();
		if (next === 0) {
			if (sound) playToggle(false);
			if (haptics) void haptic("soft");
		} else if (next === max) {
			if (sound) playSuccess();
			if (haptics) void haptic("success");
		} else {
			if (sound) playPop();
			if (haptics) void haptic("success");
		}
	};

	const scaleStar = (index: number, scale: number, transition: Transition) => {
		const star = starRefs.current[index];
		if (!star) return null;
		const animation = animate(star, { scale }, transition);
		starAnimations.current[index] = animation;
		return animation;
	};

	const dip = (index: number) => {
		if (!shouldReduceMotion) scaleStar(index, 0.9, pressSpring);
	};

	const undip = (index: number) => {
		if (!shouldReduceMotion) scaleStar(index, 1, pressSpring);
	};

	// Rise to 1.2, then let the spring settle it back.
	const rise = (index: number, delay: number) => {
		const up = scaleStar(index, 1.2, {
			duration: 0.09,
			delay,
			ease: "easeOut",
		});
		void up?.then(() => {
			// Skip the settle if a newer animation took the star over.
			if (!mountedRef.current || starAnimations.current[index] !== up) return;
			scaleStar(index, 1, riseSpring);
		});
	};

	const nudge = (index: number) => {
		const out = scaleStar(index, 1.08, { duration: 0.07, ease: "easeOut" });
		void out?.then(() => {
			if (!mountedRef.current || starAnimations.current[index] !== out) return;
			scaleStar(index, 1, pressSpring);
		});
	};

	/** Animates the stars for a pick that moved the value from `prev` to `next`. */
	const celebrate = (prev: number, next: number) => {
		if (shouldReduceMotion) return;
		if (next === 0) {
			setDrainFrom(Math.ceil(prev));
			return;
		}
		if (next > prev) {
			let order = 0;
			for (let index = 0; index < Math.ceil(next); index++) {
				if (fillOf(next, index) <= fillOf(prev, index)) continue;
				rise(index, (order * RISE_STAGGER_MS) / 1000);
				order += 1;
			}
		} else if (next < prev) {
			nudge(Math.ceil(next) - 1);
		}
	};

	const emit = (next: number) => {
		if (next > 0 && drainFrom !== 0) setDrainFrom(0);
		if (next === valueRef.current) return;
		valueRef.current = next;
		if (!controlled) setInternalValue(next);
		onValueChange?.(next);
	};

	const focusValue = (next: number) => {
		const index = Math.max(Math.round(next / step) - 1, 0);
		radioRefs.current[index]?.focus({ preventScroll: true });
	};

	/** A pick from a tap, release, `Space`, or assistive tech. */
	const pick = (next: number, start: number) => {
		emit(next);
		if (next === start) return;
		commitCue(next);
		celebrate(start, next);
		onValueCommit?.(next);
	};

	/** A step from the keyboard: a click per star, no commit cue. */
	const moveTo = (next: number) => {
		const current = valueRef.current;
		if (next === current) return;
		emit(next);
		if (next === 0) commitCue(0);
		else crossCue();
		celebrate(current, next);
		onValueCommit?.(next);
		focusValue(next);
	};

	const isRtl = () =>
		rowRef.current
			? getComputedStyle(rowRef.current).direction === "rtl"
			: false;

	/** Stars from the row's start edge to `clientX`, from 0 to `max`. */
	const positionAt = (clientX: number) => {
		const row = rowRef.current;
		if (!row) return 0;
		const rect = row.getBoundingClientRect();
		const offset = isRtl() ? rect.right - clientX : clientX - rect.left;
		return clamp((offset / rect.width) * max, 0, max);
	};

	const valueAt = (clientX: number) => {
		// The left half of a star rates x.5; anywhere on a star rates at least one step.
		const position = positionAt(clientX);
		return clamp(Math.ceil(position / step - 1e-9) * step, step, max);
	};

	const starAt = (clientX: number) =>
		clamp(Math.floor(positionAt(clientX)), 0, max - 1);

	const endGesture = (gesture: Gesture) => {
		gestureRef.current = null;
		undip(gesture.star);
		setDrag(null);
		setPhase("idle");
	};

	const startRating = (gesture: Gesture, target: HTMLElement, next: number) => {
		gesture.intent = "rate";
		if (!target.hasPointerCapture(gesture.pointerId)) {
			target.setPointerCapture(gesture.pointerId);
		}
		gesture.current = next;
		setDrag(next);
		emit(next);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!interactive || gestureRef.current) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const touch = event.pointerType === "touch";
		const pressed = valueAt(event.clientX);
		const gesture: Gesture = {
			pointerId: event.pointerId,
			touch,
			startX: event.clientX,
			startY: event.clientY,
			start: valueRef.current,
			pressed,
			current: valueRef.current,
			intent: "pending",
			sweeping: false,
			star: starAt(event.clientX),
		};
		gestureRef.current = gesture;
		hoverHoldRef.current = null;
		setHover(null);
		setPhase("pressed");
		dip(gesture.star);
		// Touch waits to see if the page should scroll instead.
		if (!touch) startRating(gesture, event.currentTarget, pressed);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture) {
			if (!interactive || event.pointerType !== "mouse") return;
			const next = valueAt(event.clientX);
			if (hoverHoldRef.current !== null) {
				if (next === hoverHoldRef.current) return;
				hoverHoldRef.current = null;
			}
			setHover(next);
			return;
		}
		if (event.pointerId !== gesture.pointerId) return;
		const dx = event.clientX - gesture.startX;
		const dy = event.clientY - gesture.startY;
		if (gesture.intent === "pending") {
			// A vertical swipe belongs to the page.
			if (Math.abs(dy) > TOUCH_SLOP && Math.abs(dy) > Math.abs(dx)) {
				endGesture(gesture);
				return;
			}
			if (Math.abs(dx) <= TOUCH_SLOP) return;
			startRating(gesture, event.currentTarget, gesture.pressed);
		}
		const next = valueAt(event.clientX);
		if (next !== gesture.current) {
			if (Math.ceil(next) !== Math.ceil(gesture.current)) crossCue();
			gesture.current = next;
			gesture.sweeping = true;
			setDrag(next);
			setPhase("sweeping");
			emit(next);
		}
		const star = starAt(event.clientX);
		if (star !== gesture.star) {
			undip(gesture.star);
			gesture.star = star;
			dip(star);
		}
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture || event.pointerId !== gesture.pointerId) return;
		endGesture(gesture);
		let next = gesture.intent === "pending" ? gesture.pressed : gesture.current;
		// Tapping the current value again clears it.
		if (
			clearable &&
			!gesture.sweeping &&
			gesture.start > 0 &&
			gesture.pressed === gesture.start
		) {
			next = 0;
		}
		if (!gesture.touch) hoverHoldRef.current = valueAt(event.clientX);
		pick(next, gesture.start);
		focusValue(next);
	};

	const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture || event.pointerId !== gesture.pointerId) return;
		endGesture(gesture);
		// The browser took over, so the press never landed.
		emit(gesture.start);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!interactive || gestureRef.current) return;
		const current = valueRef.current;
		const forward = isRtl() ? -1 : 1;
		const stepTo = (delta: number) => clamp(current + delta, step, max);
		let next: number;
		switch (event.key) {
			case "ArrowRight":
				next = stepTo(step * forward);
				break;
			case "ArrowLeft":
				next = stepTo(-step * forward);
				break;
			case "ArrowUp":
				next = stepTo(step);
				break;
			case "ArrowDown":
				next = stepTo(-step);
				break;
			case "Home":
				next = step;
				break;
			case "End":
				next = max;
				break;
			case "Backspace":
			case "Delete":
				if (!clearable || current === 0) return;
				next = 0;
				break;
			case " ": {
				const target = event.target as HTMLElement;
				const radioValue = Number(target.dataset.value);
				if (!Number.isFinite(radioValue)) return;
				event.preventDefault();
				pick(radioValue, current);
				return;
			}
			default:
				return;
		}
		event.preventDefault();
		moveTo(snapTo(next, step, max));
	};

	// Screen readers activate radios with a click of detail 0.
	const handleRadioClick = (
		radioValue: number,
		event: MouseEvent<HTMLSpanElement>,
	) => {
		if (!interactive || event.detail !== 0) return;
		pick(radioValue, valueRef.current);
	};

	// Disabling mid-press drops the press.
	useEffect(() => {
		if (interactive) return;
		const gesture = gestureRef.current;
		if (!gesture) return;
		gestureRef.current = null;
		setDrag(null);
		setPhase("idle");
	}, [interactive]);

	const sizeStyle = sizes[size];
	const fillMs = shouldReduceMotion ? 0 : FILL_MS;
	const litBeforeDrain = draining ? drainFrom : 0;

	const caption = (() => {
		if (!labels?.length || display <= 0) return "";
		const index =
			allowHalf && labels.length >= steps
				? Math.round(display / step) - 1
				: Math.ceil(display) - 1;
		return labels[clamp(index, 0, labels.length - 1)] ?? "";
	})();

	const renderStar = (index: number) => {
		const fill = fillOf(display, index);
		const delay =
			index < litBeforeDrain
				? ((litBeforeDrain - 1 - index) * DRAIN_STAGGER_MS) / 1000
				: 0;
		return (
			<span
				ref={(node) => {
					starRefs.current[index] = node;
				}}
				aria-hidden
				data-slot="star-rating-icon"
				data-fill={fill === 1 ? "full" : fill > 0 ? "half" : "empty"}
				className={cn("relative block", sizeStyle.star)}
			>
				<Star
					strokeWidth={1.5}
					className="absolute inset-0 size-full fill-current text-muted-foreground/25"
				/>
				<motion.span
					initial={false}
					animate={{ "--star-rating-empty": `${(1 - fill) * 100}%` }}
					transition={{
						duration: fillMs / 1000,
						delay: shouldReduceMotion ? 0 : delay,
						ease: "easeOut",
					}}
					className={cn(
						"absolute inset-0 text-amber-400 transition-opacity duration-150 [clip-path:inset(0_var(--star-rating-empty)_0_0)] rtl:[clip-path:inset(0_0_0_var(--star-rating-empty))]",
						previewing && "opacity-70",
					)}
				>
					<Star strokeWidth={1.5} className="size-full fill-current" />
				</motion.span>
			</span>
		);
	};

	const renderRadio = (radioValue: number, half: "start" | "end" | null) => {
		const index = Math.round(radioValue / step) - 1;
		const checked = value === radioValue;
		const tabbable = interactive && (checked || (value === 0 && index === 0));
		return (
			<span
				key={radioValue}
				ref={(node) => {
					radioRefs.current[index] = node;
				}}
				role="radio"
				aria-checked={checked}
				aria-label={starsLabel(radioValue)}
				aria-disabled={disabled || undefined}
				tabIndex={tabbable ? 0 : -1}
				data-value={radioValue}
				data-slot="star-rating-radio"
				onClick={(event) => handleRadioClick(radioValue, event)}
				className={cn(
					"absolute inset-y-0 outline-none",
					half === null && "inset-x-0",
					half === "start" && "start-0 w-1/2",
					half === "end" && "end-0 w-1/2",
				)}
			/>
		);
	};

	const stars = Array.from({ length: max }, (_, index) => index);
	const captionNode = labels?.length ? (
		<div
			data-slot="star-rating-caption"
			className={cn("grid min-h-5 text-muted-foreground", sizeStyle.caption)}
		>
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					key={caption}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
					className="col-start-1 row-start-1"
				>
					{caption || "\u00A0"}
				</motion.span>
			</AnimatePresence>
		</div>
	) : null;
	const hiddenInput = name ? (
		<input
			type="hidden"
			name={name}
			value={value > 0 ? value : ""}
			disabled={disabled}
		/>
	) : null;

	if (readOnly) {
		return (
			<div
				data-slot="star-rating"
				data-state="read-only"
				data-size={size}
				className={cn("inline-flex flex-col items-start gap-1", className)}
			>
				<div
					role="img"
					aria-label={`Rated ${formatCount(value)} out of ${max}`}
					className="flex"
				>
					{stars.map((index) => (
						<span
							key={index}
							className={cn("grid place-items-center", sizeStyle.cell)}
						>
							{renderStar(index)}
						</span>
					))}
				</div>
				{captionNode}
				{hiddenInput}
			</div>
		);
	}

	const state =
		phase !== "idle"
			? phase
			: previewing
				? "hover-preview"
				: disabled
					? "disabled"
					: value > 0
						? "selected"
						: "empty";

	return (
		<div
			data-slot="star-rating"
			data-state={state}
			data-size={size}
			data-half={(value % 1 !== 0 && value > 0) || undefined}
			data-disabled={disabled || undefined}
			className={cn(
				"inline-flex flex-col items-start gap-1 data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
		>
			<div
				ref={rowRef}
				role="radiogroup"
				aria-label={ariaLabel}
				aria-disabled={disabled || undefined}
				data-slot="star-rating-stars"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onPointerLeave={() => {
					hoverHoldRef.current = null;
					setHover(null);
				}}
				onKeyDown={handleKeyDown}
				onContextMenu={(event) => event.preventDefault()}
				className={cn(
					"flex touch-pan-y select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
					interactive && "cursor-pointer",
				)}
			>
				{stars.map((index) => (
					<span
						key={index}
						data-slot="star-rating-star"
						className={cn(
							"relative grid h-11 place-items-center rounded-md has-[[role=radio]:focus-visible]:ring-3 has-[[role=radio]:focus-visible]:ring-ring/50",
							sizeStyle.cell,
						)}
					>
						{renderStar(index)}
						{allowHalf ? (
							<>
								{renderRadio(index + 0.5, "start")}
								{renderRadio(index + 1, "end")}
							</>
						) : (
							renderRadio(index + 1, null)
						)}
					</span>
				))}
			</div>
			{captionNode}
			{hiddenInput}
		</div>
	);
}

export default StarRating;
