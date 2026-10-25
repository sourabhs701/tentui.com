"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useTiks } from "@rexa-developer/tiks/react";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { animate, motion, useAnimate, useReducedMotion } from "motion/react";
import {
	type ClipboardEvent,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const digitTiming = {
	duration: 450,
	easing: "cubic-bezier(.2,.8,.2,1)",
} as const;
const pressSpring = { type: "spring", stiffness: 600, damping: 30 } as const;

/** Ms a press is held before it starts repeating. */
const REPEAT_DELAY = 400;
/** Ms between repeats when repeating starts. */
const REPEAT_SLOW = 120;
/** Fastest ms between repeats. */
const REPEAT_FAST = 40;
/** Ms into a hold at which repeats reach `REPEAT_FAST`. */
const REPEAT_RAMP_END = 1500;
/** Repeats before each step becomes `largeStep` steps. */
const ACCELERATE_AFTER = 10;
/** Minimum ms between step sounds and haptics. */
const CUE_THROTTLE_MS = 35;
/** Ms of quiet before the live region announces the value. */
const ANNOUNCE_DELAY = 300;
/** Trackpad travel, in px, per wheel step. */
const WHEEL_STEP_PX = 50;

const sizes = {
	sm: {
		root: "min-h-8 text-sm",
		button: { outline: "size-6", pill: "size-6", ghost: "size-8" },
		verticalButton: "h-6",
		icon: "[&_svg]:size-3.5",
	},
	md: {
		root: "min-h-9 text-base",
		button: { outline: "size-7", pill: "size-8", ghost: "size-9" },
		verticalButton: "h-7",
		icon: "[&_svg]:size-4",
	},
	lg: {
		root: "min-h-11 text-xl",
		button: { outline: "size-9", pill: "size-10", ghost: "size-11" },
		verticalButton: "h-9",
		icon: "[&_svg]:size-5",
	},
} as const;

const variants = {
	outline: {
		root: "rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 dark:bg-input/30 dark:data-invalid:ring-destructive/40",
		button:
			"rounded-[calc(var(--radius)-5px)] text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-input/50",
		input: "",
	},
	pill: {
		root: "rounded-full border border-input bg-background p-1 shadow-xs transition-[color,box-shadow] has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 dark:bg-input/30 dark:data-invalid:ring-destructive/40",
		button:
			"rounded-full bg-primary text-primary-foreground shadow-xs hover:bg-primary/85",
		input: "",
	},
	ghost: {
		root: "rounded-md",
		button:
			"rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
		input: "rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50",
	},
} as const;

type Direction = 1 | -1;
type StepKind = "step" | "accelerate";
type StepResult = "moved" | "limit" | "blocked";

export interface NumberStepperProps {
	/** Controlled value. */
	value?: number;
	/** Initial value when uncontrolled. */
	defaultValue?: number;
	/** Called on every step, typed commit, and key press. */
	onValueChange?: (value: number) => void;
	/** Called when a press is released, a typed value commits, or a key steps. */
	onValueCommit?: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/** Steps moved by `Shift`+arrows, `PageUp`/`PageDown`, and accelerated holds. */
	largeStep?: number;
	/** After 10 repeats, a held button moves `largeStep` steps at a time. */
	accelerate?: boolean;
	/** `Intl.NumberFormat` options for the value, e.g. currency or percent. */
	format?: Intl.NumberFormatOptions;
	/** Locale for formatting and parsing typed or pasted values. */
	locale?: string;
	/** Let the wheel change the value while the input is focused. */
	wheel?: boolean;
	size?: keyof typeof sizes;
	variant?: keyof typeof variants;
	/** `vertical` puts increase above the value and decrease below it. */
	orientation?: "horizontal" | "vertical";
	/** Play a click per step and a pop at the limits. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	/** Submits the value with a native form through a hidden input. */
	name?: string;
	/** Accessible name for the input; the buttons read "Increase {label}". */
	label?: string;
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

type Separators = { group: string; decimal: string };

function getSeparators(locale?: string): Separators {
	const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
	return {
		group: parts.find((part) => part.type === "group")?.value ?? ",",
		decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
	};
}

/** Reduces locale text to digits, `-`, and a `.` decimal point. */
function normalizeNumber(text: string, { group, decimal }: Separators) {
	return text
		.replace(/[\s  ]/g, "")
		.split(group)
		.join("")
		.split(decimal)
		.join(".")
		.replace(/[−‒-—]/g, "-")
		.replace(/[^\d.-]/g, "");
}

function parseNumber(text: string, separators: Separators, percent: boolean) {
	const clean = normalizeNumber(text, separators);
	const negative = clean.startsWith("-");
	const [whole = "", ...fraction] = clean.replace(/-/g, "").split(".");
	const digits = fraction.length ? `${whole}.${fraction.join("")}` : whole;
	if (!/\d/.test(digits)) return Number.NaN;
	const parsed = Number(digits) * (negative ? -1 : 1);
	// Percent values are fractions: typing "15" in a percent field means 0.15.
	return percent ? parsed / 100 : parsed;
}

export function NumberStepper({
	value: valueProp,
	defaultValue = 1,
	onValueChange,
	onValueCommit,
	min = 0,
	max = Number.POSITIVE_INFINITY,
	step = 1,
	largeStep = 10,
	accelerate = true,
	format,
	locale,
	wheel = false,
	size = "md",
	variant = "outline",
	orientation = "horizontal",
	sound = true,
	haptics = true,
	disabled = false,
	readOnly = false,
	name,
	label = "Value",
	className,
}: NumberStepperProps) {
	const horizontal = orientation === "horizontal";
	const inactive = disabled || readOnly;
	const percent = format?.style === "percent";

	// Steps are anchored at `min`, and the top limit is the last step below `max`.
	const anchor = Number.isFinite(min) ? min : 0;
	const decimals = Math.max(decimalsOf(step), decimalsOf(anchor));
	const lower = min;
	const upper = Number.isFinite(max)
		? Math.max(anchor + Math.floor((max - anchor) / step + 1e-9) * step, lower)
		: max;

	const snap = (raw: number) => {
		const clamped = clamp(raw, lower, upper);
		if (!Number.isFinite(clamped)) return clamped;
		// The ratio is rounded first so 0.175 / 0.05 counts as 3.5, not 3.4999….
		const steps = Math.round(Number(((clamped - anchor) / step).toFixed(9)));
		const snapped = anchor + steps * step;
		// Round to the step's precision so 0.1 + 0.2 lands on 0.3.
		return Number(clamp(snapped, lower, upper).toFixed(decimals));
	};

	const controlled = valueProp !== undefined;
	const [internalValue, setInternalValue] = useState(() => snap(defaultValue));
	const value = controlled ? snap(valueProp) : internalValue;

	// Digits roll in the direction the value moved.
	const [shown, setShown] = useState({ value, trend: 1 });
	if (shown.value !== value) {
		setShown({ value, trend: value > shown.value ? 1 : -1 });
	}

	const [draft, setDraftState] = useState<string | null>(null);
	const [holding, setHolding] = useState<Direction | null>(null);
	const [announcement, setAnnouncement] = useState("");

	const formatter = useMemo(
		() => new Intl.NumberFormat(locale, format),
		[locale, format],
	);
	const separators = useMemo(() => getSeparators(locale), [locale]);
	const formatValue = (next: number) => formatter.format(next);
	const valueText = formatValue(value);

	const draftValue =
		draft === null ? null : parseNumber(draft, separators, percent);
	const invalid =
		draft !== null &&
		draft.trim() !== "" &&
		draftValue !== null &&
		(Number.isNaN(draftValue) || snap(draftValue) !== draftValue);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		toggle: playToggle,
		warning: playWarning,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});

	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [valueScope, animateValue] = useAnimate<HTMLDivElement>();
	const buttonRefs = useRef<Record<Direction, HTMLButtonElement | null>>({
		1: null,
		[-1]: null,
	});
	const ringRefs = useRef<Record<Direction, HTMLSpanElement | null>>({
		1: null,
		[-1]: null,
	});
	const valueRef = useRef(value);
	const draftRef = useRef<string | null>(null);
	const lastEmittedRef = useRef(value);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const announcedRef = useRef(valueText);
	const pressRef = useRef(false);
	const pressedButtonRef = useRef<Direction | null>(null);
	const holdRef = useRef<{
		direction: Direction;
		startedAt: number;
		repeats: number;
		accelerated: boolean;
		timer: ReturnType<typeof setTimeout>;
	} | null>(null);

	useLayoutEffect(() => {
		valueRef.current = value;
	});

	const setDraft = (next: string | null) => {
		draftRef.current = next;
		setDraftState(next);
	};

	const cue = (kind: StepKind) => {
		const now = performance.now();
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (kind === "accelerate") {
			if (sound) playToggle(true);
			if (haptics) void haptic("light");
		} else {
			if (sound) playClick();
			if (haptics) void haptic("selection");
		}
	};

	const warn = () => {
		lastCueAtRef.current = performance.now();
		if (sound) playWarning();
		if (haptics) void haptic("warning");
	};

	// The soft wall: a pop, a rigid haptic, and a nudge toward the pressed side.
	const hitWall = (direction: Direction) => {
		lastCueAtRef.current = performance.now();
		if (sound) playPop();
		if (haptics) void haptic("rigid");
		if (shouldReduceMotion || !valueScope.current) return;
		const offsets = [0, 4, -3, 0].map(
			(offset) => offset * (horizontal ? direction : -direction),
		);
		void animateValue(
			valueScope.current,
			horizontal ? { x: offsets } : { y: offsets },
			{ duration: 0.22, ease: "easeOut" },
		);
	};

	const emit = (next: number) => {
		valueRef.current = next;
		lastEmittedRef.current = next;
		if (!controlled) setInternalValue(next);
		onValueChange?.(next);
	};

	/** Resolves a pending typed value and returns the value to build on. */
	const commitDraft = () => {
		const text = draftRef.current;
		const current = valueRef.current;
		if (text === null) return current;
		setDraft(null);
		// An emptied field goes back to the last valid value.
		if (text.trim() === "") return current;
		const parsed = parseNumber(text, separators, percent);
		if (Number.isNaN(parsed)) {
			warn();
			return current;
		}
		const next = snap(parsed);
		if (next !== parsed) warn();
		if (next !== current) {
			emit(next);
			onValueCommit?.(next);
		}
		return next;
	};

	const stepBy = (
		direction: Direction,
		multiplier = 1,
		kind: StepKind = "step",
	): StepResult => {
		const current = commitDraft();
		const next = snap(current + direction * step * multiplier);
		if (next === current) return "blocked";
		emit(next);
		const atLimit = direction > 0 ? next >= upper : next <= lower;
		if (atLimit) {
			hitWall(direction);
			return "limit";
		}
		cue(kind);
		return "moved";
	};

	const jumpTo = (target: number) => {
		const current = commitDraft();
		const next = snap(target);
		if (!Number.isFinite(next) || next === current) return;
		emit(next);
		hitWall(next > current ? 1 : -1);
		onValueCommit?.(next);
	};

	const setRing = (
		direction: Direction,
		opacity: number | number[],
		ms = 150,
	) => {
		const ring = ringRefs.current[direction];
		if (ring)
			animate(ring, { opacity }, { duration: ms / 1000, ease: "easeOut" });
	};

	// Scale is driven here rather than with `whileTap`: a button that reaches
	// its limit turns disabled mid-press and would never see the release.
	const pressButton = (direction: Direction) => {
		pressedButtonRef.current = direction;
		const button = buttonRefs.current[direction];
		if (button) animate(button, { scale: 0.92 }, pressSpring);
	};

	const releaseButton = () => {
		const direction = pressedButtonRef.current;
		if (direction === null) return;
		pressedButtonRef.current = null;
		const button = buttonRefs.current[direction];
		if (button) animate(button, { scale: 1 }, pressSpring);
	};

	const endPress = () => {
		releaseButton();
		const hold = holdRef.current;
		if (hold) {
			clearTimeout(hold.timer);
			setRing(hold.direction, 0);
			holdRef.current = null;
			setHolding(null);
		}
		if (pressRef.current) {
			pressRef.current = false;
			onValueCommit?.(valueRef.current);
		}
	};

	const repeat = () => {
		const hold = holdRef.current;
		if (!hold) return;
		hold.repeats += 1;
		const accelerated = accelerate && hold.repeats > ACCELERATE_AFTER;
		const kind = accelerated && !hold.accelerated ? "accelerate" : "step";
		hold.accelerated = accelerated;
		if (hold.repeats === 1) setHolding(hold.direction);
		const result = stepBy(hold.direction, accelerated ? largeStep : 1, kind);
		if (result !== "moved") {
			endPress();
			return;
		}
		const elapsed = performance.now() - hold.startedAt;
		const ramp = clamp(
			(elapsed - REPEAT_DELAY) / (REPEAT_RAMP_END - REPEAT_DELAY),
			0,
			1,
		);
		const interval = REPEAT_SLOW - (REPEAT_SLOW - REPEAT_FAST) * ramp;
		// The ring flashes on each repeat, so its pulse tracks the repeat rate.
		setRing(hold.direction, shouldReduceMotion ? 0.6 : [0.9, 0.25], interval);
		hold.timer = setTimeout(() => repeatRef.current(), interval);
	};

	// Timers call through refs so they always see the latest props.
	const repeatRef = useRef(repeat);
	const endPressRef = useRef(endPress);
	const wheelStepRef = useRef((steps: number) => {
		void steps;
	});
	useLayoutEffect(() => {
		repeatRef.current = repeat;
		endPressRef.current = endPress;
		wheelStepRef.current = (steps: number) => {
			const result = stepBy(steps > 0 ? 1 : -1, Math.abs(steps));
			if (result !== "blocked") onValueCommit?.(valueRef.current);
		};
	});

	const handlePointerDown = (
		direction: Direction,
		event: PointerEvent<HTMLButtonElement>,
	) => {
		if (inactive || event.button !== 0) return;
		// Touch captures the pointer implicitly; release it so sliding off cancels.
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		endPress();
		pressRef.current = true;
		pressButton(direction);
		if (stepBy(direction) !== "moved") return;
		holdRef.current = {
			direction,
			startedAt: performance.now(),
			repeats: 0,
			accelerated: false,
			timer: setTimeout(() => repeatRef.current(), REPEAT_DELAY),
		};
	};

	// Keyboard and assistive tech activate the buttons with a click of detail 0.
	const handleClick = (
		direction: Direction,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		if (inactive || event.detail !== 0) return;
		if (stepBy(direction) !== "blocked") onValueCommit?.(valueRef.current);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape" && draftRef.current !== null) {
			event.preventDefault();
			setDraft(null);
			return;
		}
		if (event.key === "Enter") {
			if (draftRef.current === null) return;
			event.preventDefault();
			commitDraft();
			return;
		}
		if (inactive) return;
		let direction: Direction | null = null;
		let multiplier = 1;
		switch (event.key) {
			case "ArrowUp":
				direction = 1;
				multiplier = event.shiftKey ? largeStep : 1;
				break;
			case "ArrowDown":
				direction = -1;
				multiplier = event.shiftKey ? largeStep : 1;
				break;
			case "PageUp":
				direction = 1;
				multiplier = largeStep;
				break;
			case "PageDown":
				direction = -1;
				multiplier = largeStep;
				break;
			case "Home":
				if (!Number.isFinite(lower)) return;
				event.preventDefault();
				jumpTo(lower);
				return;
			case "End":
				if (!Number.isFinite(upper)) return;
				event.preventDefault();
				jumpTo(upper);
				return;
			default:
				return;
		}
		event.preventDefault();
		if (stepBy(direction, multiplier) !== "blocked") {
			onValueCommit?.(valueRef.current);
		}
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		if (inactive) return;
		event.preventDefault();
		const input = event.currentTarget;
		const pasted = normalizeNumber(
			event.clipboardData.getData("text"),
			separators,
		).replace(".", separators.decimal);
		const text = input.value;
		const start = input.selectionStart ?? text.length;
		const end = input.selectionEnd ?? text.length;
		setDraft(text.slice(0, start) + pasted + text.slice(end));
	};

	// A controlled value that changes mid-hold stops the repeat.
	useEffect(() => {
		if (holdRef.current && valueProp !== lastEmittedRef.current) {
			endPressRef.current();
		}
	}, [valueProp]);

	useEffect(() => {
		if (inactive) endPressRef.current();
	}, [inactive]);

	// Releasing outside the window never reaches the button.
	useEffect(() => {
		if (holding === null) return;
		const end = () => endPressRef.current();
		window.addEventListener("blur", end);
		return () => window.removeEventListener("blur", end);
	}, [holding]);

	useEffect(
		() => () => {
			if (holdRef.current) clearTimeout(holdRef.current.timer);
		},
		[],
	);

	// Announce once the value settles, not on every repeat. A focused
	// spinbutton already reads its own changes, so skip those.
	useEffect(() => {
		if (valueText === announcedRef.current) return;
		const timer = setTimeout(() => {
			announcedRef.current = valueText;
			if (document.activeElement !== inputRef.current) {
				setAnnouncement(valueText);
			}
		}, ANNOUNCE_DELAY);
		return () => clearTimeout(timer);
	}, [valueText]);

	// Wheel needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const input = inputRef.current;
		if (!input || !wheel || inactive) return;
		let accumulated = 0;
		const onWheel = (event: WheelEvent) => {
			if (document.activeElement !== input || event.deltaY === 0) return;
			event.preventDefault();
			let steps = 0;
			if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= WHEEL_STEP_PX) {
				// One notch, one step.
				steps = -Math.sign(event.deltaY);
				accumulated = 0;
			} else {
				accumulated += event.deltaY;
				steps = -Math.trunc(accumulated / WHEEL_STEP_PX);
				accumulated += steps * WHEEL_STEP_PX;
			}
			if (steps !== 0) wheelStepRef.current(steps);
		};
		input.addEventListener("wheel", onWheel, { passive: false });
		return () => input.removeEventListener("wheel", onWheel);
	}, [wheel, inactive]);

	const atMin = value <= lower;
	const atMax = value >= upper;
	const typing = draft !== null;
	const sizeStyle = sizes[size];
	const variantStyle = variants[variant];
	const widthChars =
		Math.max(
			2,
			...[lower, upper, value]
				.filter(Number.isFinite)
				.map((bound) => formatValue(bound).length),
		) + 1;
	const inputMode =
		lower < 0 ? "text" : decimals > 0 && !percent ? "decimal" : "numeric";

	const renderButton = (direction: Direction) => {
		const increase = direction === 1;
		const blocked = increase ? atMax : atMin;
		const Icon = horizontal
			? increase
				? Plus
				: Minus
			: increase
				? ChevronUp
				: ChevronDown;
		return (
			<button
				ref={(node) => {
					buttonRefs.current[direction] = node;
				}}
				type="button"
				tabIndex={-1}
				aria-label={`${increase ? "Increase" : "Decrease"} ${label}`}
				aria-controls={inputId}
				disabled={inactive || blocked}
				data-slot={`number-stepper-${increase ? "increment" : "decrement"}`}
				data-holding={holding === direction || undefined}
				onPointerDown={(event) => handlePointerDown(direction, event)}
				onPointerUp={endPress}
				onPointerLeave={endPress}
				onPointerCancel={endPress}
				onClick={(event) => handleClick(direction, event)}
				// Keep focus (and any draft) in the input.
				onMouseDown={(event) => event.preventDefault()}
				onContextMenu={(event) => event.preventDefault()}
				className={cn(
					"relative inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 shrink-0 cursor-pointer touch-manipulation select-none items-center justify-center outline-none transition-[opacity,color,background-color] duration-150 disabled:pointer-events-none disabled:opacity-40",
					horizontal
						? sizeStyle.button[variant]
						: cn("w-full", sizeStyle.verticalButton),
					sizeStyle.icon,
					variantStyle.button,
				)}
			>
				<Icon aria-hidden />
				<span
					ref={(node) => {
						ringRefs.current[direction] = node;
					}}
					aria-hidden
					data-slot="number-stepper-ring"
					className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-ring ring-offset-1 ring-offset-background"
				/>
			</button>
		);
	};

	return (
		<div
			dir="ltr"
			data-slot="number-stepper"
			data-variant={variant}
			data-size={size}
			data-orientation={orientation}
			data-state={holding !== null ? "holding" : typing ? "typing" : "idle"}
			data-bound={atMin ? "min" : atMax ? "max" : undefined}
			data-invalid={invalid || undefined}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
			className={cn(
				"inline-flex w-fit items-center font-medium tabular-nums data-disabled:cursor-not-allowed data-disabled:opacity-50",
				horizontal ? "flex-row gap-1" : "min-w-12 flex-col gap-0.5",
				variant === "outline" && (horizontal ? "px-1" : "py-1"),
				sizeStyle.root,
				variantStyle.root,
				className,
			)}
		>
			{renderButton(horizontal ? -1 : 1)}
			<motion.div
				ref={valueScope}
				data-slot="number-stepper-value"
				className="grid place-items-center"
			>
				<input
					ref={inputRef}
					id={inputId}
					type="text"
					role="spinbutton"
					inputMode={inputMode}
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					aria-label={label}
					aria-valuenow={value}
					aria-valuemin={Number.isFinite(lower) ? lower : undefined}
					aria-valuemax={Number.isFinite(upper) ? upper : undefined}
					aria-valuetext={valueText}
					aria-invalid={invalid || undefined}
					disabled={disabled}
					readOnly={readOnly}
					value={draft ?? valueText}
					onChange={(event) => setDraft(event.target.value)}
					// Show the real text where the click lands, ready to edit.
					onPointerDown={() => {
						if (!inactive && draftRef.current === null) setDraft(valueText);
					}}
					onBlur={commitDraft}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					style={{ width: `${widthChars}ch` }}
					className={cn(
						"col-start-1 row-start-1 h-full min-w-0 bg-transparent px-0.5 text-center outline-none disabled:cursor-not-allowed aria-invalid:text-destructive",
						!horizontal && "py-0.5",
						// While NumberFlow shows the value, the input stays invisible.
						!typing &&
							"text-transparent caret-transparent selection:bg-transparent",
						variantStyle.input,
					)}
				/>
				{typing ? null : (
					<NumberFlow
						aria-hidden
						value={value}
						locales={locale}
						format={format as Format | undefined}
						trend={shown.trend}
						animated={!shouldReduceMotion}
						respectMotionPreference={false}
						transformTiming={digitTiming}
						spinTiming={digitTiming}
						className="pointer-events-none col-start-1 row-start-1"
					/>
				)}
			</motion.div>
			{renderButton(horizontal ? 1 : -1)}
			{name ? (
				<input type="hidden" name={name} value={value} disabled={disabled} />
			) : null}
			<span aria-live="polite" aria-atomic className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export default NumberStepper;
