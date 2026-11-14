"use client";

import { createTiks, type TiksApi } from "@rexa-developer/tiks";
import { ArrowUp } from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	type MotionValue,
	motionValue,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Data updates roll on a soft spring that settles with under 3% overshoot.
const DATA_ROLL = { type: "spring", duration: 0.65, bounce: 0.2 } as const;
// Scrubbing rolls fast and direct, with no settle.
const SCRUB_ROLL = { type: "spring", duration: 0.14, bounce: 0 } as const;
/** Ms between changed columns, least significant first, on data updates. */
const CASCADE_STAGGER = 30;
/** Ms for a column or symbol to open or close when the length changes. */
const SLIDE = { data: 420, scrub: 140 } as const;
const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Reduced motion swaps digits with a short cross-fade instead. */
const CROSS_FADE = 100;
/** Distance, in digits, a column may land short of its target and still count. */
const TARGET_SLACK = 0.35;
/** Digits per second where the motion blur starts, and where it peaks. */
const BLUR_FROM = 15;
const BLUR_FULL = 45;
/** Vertical blur, in px, of each step. Quantized so filters are shared. */
const BLUR_LEVELS = [0.5, 1, 1.5] as const;
/** Height, in em, the drum reaches past the line box so its mask fades there. */
const DRUM_OVERHANG = 0.06;
/** Length, in em, of the drum's soft top and bottom edges. Ends above the glyphs. */
const DRUM_FADE = 0.26;

/** Ms between roll clicks, and the most clicks one data update can play. */
const ROLL_CLICK_THROTTLE = 30;
const ROLL_CLICK_LIMIT = 6;
/** Ms between scrub ticks. */
const SCRUB_TICK_THROTTLE = 40;
/** Ms of quiet before the live region reads a new value. */
const ANNOUNCE_DELAY = 1000;

/** The sparkline is 40 px tall; the line keeps 4 px clear for the 6 px dot. */
const SPARK_HEIGHT = 40;
const SPARK_PAD_Y = 4;
const SPARK_PAD_X = 3;
/** Ms for the line to ease in a new point or a changed value. */
const SPARK_SHIFT = 450;
/** Pointer travel, in px, before a touch becomes a horizontal scrub. */
const TOUCH_SLOP = 4;

const ROLL_CLICK = {
	name: "rolling-stat-roll",
	baseFreq: 520,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 2600,
	filterQ: 1.1,
	attack: 0.001,
	decay: 0.55,
	brightness: 3200,
} as const;

const SCRUB_TICK = {
	name: "rolling-stat-scrub",
	baseFreq: 660,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 4200,
	filterQ: 1.6,
	attack: 0.001,
	decay: 0.45,
	brightness: 5000,
} as const;

const sizes = {
	sm: {
		figure: "text-3xl",
		delta: "text-xs [&_svg]:size-3",
		spark: "mt-3",
	},
	md: {
		figure: "text-4xl @[20rem]:text-5xl",
		delta: "text-xs [&_svg]:size-3",
		spark: "mt-4",
	},
	lg: {
		figure: "text-5xl @[24rem]:text-6xl",
		delta: "text-sm [&_svg]:size-3.5",
		spark: "mt-5",
	},
} as const;

const variants = {
	card: "rounded-xl border bg-card p-5 text-card-foreground shadow-xs",
	plain: "",
} as const;

const tints = {
	good: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
	bad: "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
	flat: "bg-muted text-foreground/70",
} as const;

type Direction = 1 | -1;
type RollMode = "data" | "scrub";

export type RollingStatPoint = number | { value: number; label?: string };

export interface RollingStatScrubPoint {
	/** Index of the point in `history`. */
	index: number;
	value: number;
	label?: string;
}

export interface RollingStatProps
	extends Omit<ComponentProps<"div">, "children" | "prefix"> {
	/** The live value. Defaults to the last `history` point. */
	value?: number;
	/** Past values, oldest first. Labels show while scrubbing, e.g. "Tue, 11 Nov". */
	history?: RollingStatPoint[];
	/** Names the figure, e.g. "Monthly revenue". */
	label?: string;
	/** `Intl.NumberFormat` options, e.g. currency, percent, or compact. */
	format?: Intl.NumberFormatOptions;
	/** Locale for digits and separators. */
	locale?: string;
	/** Text before the number that never rolls. */
	prefix?: string;
	/** Text after the number that never rolls, e.g. " ms". */
	suffix?: string;
	/**
	 * The change chip. `"auto"` compares the value with the first `history`
	 * point as a percent. A number is shown as is, and while scrubbing the chip
	 * shows the change from the first point in the same units. Defaults to
	 * `"auto"` when `history` has 2 or more points.
	 */
	delta?: number | "auto";
	/** `Intl.NumberFormat` options for the chip. Defaults to a percent with one decimal for `"auto"`, else `format`. */
	deltaFormat?: Intl.NumberFormatOptions;
	/** For metrics where down is good, such as latency or churn. Swaps the tints only. */
	invertTrend?: boolean;
	size?: keyof typeof sizes;
	variant?: keyof typeof variants;
	/** Show a "Live" pill while the figure shows the live value. */
	live?: boolean;
	/** Let pointer, touch, and keys scrub the sparkline. Defaults to `true` with 2 or more points. */
	scrubbable?: boolean;
	/** Called with the point under the scrub, and `null` back at the live value. */
	onScrub?: (point: RollingStatScrubPoint | null) => void;
	/** Play a soft click as digits land on data updates, and a tick per scrubbed point. */
	sound?: boolean;
	/** Tick per point while scrubbing by touch, on supported devices. */
	haptics?: boolean;
	/** Read value changes in a polite live region, at most once a second. */
	announce?: boolean;
	/** Set `false` to swap digits with a cross-fade, as with reduced motion. */
	animated?: boolean;
}

function mod(value: number, by: number) {
	return ((value % by) + by) % by;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function isHidden() {
	return (
		typeof document !== "undefined" && document.visibilityState === "hidden"
	);
}

/* ------------------------------ Formatting ------------------------------ */

type Glyph = {
	/** Stable across values: digits are keyed by place, so units stay units. */
	key: string;
	char: string;
	/** 0-9 for a rolling digit, `null` for a symbol that never rolls. */
	digit: number | null;
	/** Place value of a digit: 0 for ones, -1 for tenths. */
	place: number;
	/** `prefix` or `suffix` text, drawn smaller. */
	unit?: boolean;
};

type Item = Glyph & { exiting?: boolean };

/** The ten digits of a formatter's numbering system, e.g. Arabic-Indic. */
function digitsOf(formatter: Intl.NumberFormat, locale?: string) {
	const { numberingSystem } = formatter.resolvedOptions();
	const single = new Intl.NumberFormat(locale, {
		numberingSystem,
		useGrouping: false,
	});
	return Array.from({ length: 10 }, (_, digit) => single.format(digit));
}

/**
 * Splits a formatted value into glyphs. Integer digits and group separators
 * are keyed by place from the right, fraction digits from the decimal point,
 * and symbols by type and side, so a new leading digit adds a column without
 * re-keying the rest.
 */
function toGlyphs(
	parts: Intl.NumberFormatPart[],
	digits: string[],
	prefix?: string,
	suffix?: string,
): Glyph[] {
	const glyphs: Glyph[] = [];
	if (prefix) {
		glyphs.push({
			key: "prefix",
			char: prefix,
			digit: null,
			place: 0,
			unit: true,
		});
	}
	let integers = 0;
	for (const part of parts) {
		if (part.type === "integer") integers += [...part.value].length;
	}
	let fractions = 0;
	let side = "start";
	const seen = new Map<string, number>();
	for (const part of parts) {
		if (part.type === "integer" || part.type === "fraction") {
			side = "end";
			for (const char of part.value) {
				const index = digits.indexOf(char);
				if (part.type === "integer") {
					integers -= 1;
					glyphs.push({
						key: `i${integers}`,
						char,
						digit: index < 0 ? null : index,
						place: integers,
					});
				} else {
					fractions += 1;
					glyphs.push({
						key: `f${fractions}`,
						char,
						digit: index < 0 ? null : index,
						place: -fractions,
					});
				}
			}
			continue;
		}
		let key: string;
		if (part.type === "group") key = `g${integers}`;
		else if (part.type === "decimal") key = "decimal";
		else if (part.type === "minusSign" || part.type === "plusSign")
			key = "sign";
		else {
			const id = `${side}-${part.type}`;
			const count = seen.get(id) ?? 0;
			seen.set(id, count + 1);
			key = `${id}-${count}`;
		}
		if (part.type === "nan" || part.type === "infinity") side = "end";
		// A true minus sign: the hyphen most locales use reads thin and short.
		const char =
			part.type === "minusSign" && part.value === "-" ? "\u2212" : part.value;
		glyphs.push({ key, char, digit: null, place: 0 });
	}
	if (suffix) {
		glyphs.push({
			key: "suffix",
			char: suffix,
			digit: null,
			place: 0,
			unit: true,
		});
	}
	return glyphs;
}

/** Keeps leaving glyphs in place, before the next glyph that stays. */
function mergeGlyphs(previous: Item[], next: Glyph[]): Item[] {
	const keys = new Set(next.map((glyph) => glyph.key));
	const leavingBefore = new Map<string, Item[]>();
	let leaving: Item[] = [];
	for (const item of previous) {
		if (keys.has(item.key)) {
			if (leaving.length > 0) leavingBefore.set(item.key, leaving);
			leaving = [];
		} else {
			leaving.push({ ...item, exiting: true });
		}
	}
	const merged: Item[] = [];
	for (const glyph of next) {
		const before = leavingBefore.get(glyph.key);
		if (before) merged.push(...before);
		merged.push(glyph);
	}
	merged.push(...leaving);
	return merged;
}

/* ----------------------------- Digit engine ----------------------------- */

/** Ids of the shared vertical blur filters. */
const BlurContext = createContext("");

/**
 * Opens a glyph from zero width when it joins after the first render, and
 * closes it when it leaves, so neighbours slide instead of jumping.
 */
function useSlide(
	ref: RefObject<HTMLSpanElement | null>,
	{
		appear,
		exiting,
		mode,
		reduced,
		onExited,
	}: {
		appear: boolean;
		exiting: boolean;
		mode: RollMode;
		reduced: boolean;
		onExited: () => void;
	},
) {
	const onExitedRef = useRef(onExited);
	useLayoutEffect(() => {
		onExitedRef.current = onExited;
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on mount
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || !appear) return;
		if (reduced) {
			const fade = element.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: CROSS_FADE,
				easing: "ease-out",
			});
			return () => fade.cancel();
		}
		const width = element.getBoundingClientRect().width;
		element.style.overflowX = "clip";
		const animation = element.animate(
			[
				{ width: "0px", opacity: 0 },
				{ width: `${width}px`, opacity: 1 },
			],
			{ duration: SLIDE[mode], easing: SLIDE_EASE },
		);
		animation.onfinish = () => {
			element.style.overflowX = "";
		};
		// Strict mode runs this twice; the second run must measure the full width.
		return () => {
			animation.cancel();
			element.style.overflowX = "";
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follows `exiting` only
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || !exiting) return;
		const width = element.getBoundingClientRect().width;
		element.style.overflowX = "clip";
		const animation = element.animate(
			[
				{ width: `${width}px`, opacity: 1 },
				{ width: "0px", opacity: 0 },
			],
			{ duration: SLIDE[mode], easing: SLIDE_EASE, fill: "forwards" },
		);
		animation.onfinish = () => onExitedRef.current();
		return () => {
			// Back before it finished leaving: open again from where it is.
			const from = element.getBoundingClientRect().width;
			const opacity = getComputedStyle(element).opacity;
			animation.onfinish = null;
			animation.cancel();
			if (!element.isConnected) return;
			const to = element.getBoundingClientRect().width;
			const reopen = element.animate(
				[
					{ width: `${from}px`, opacity },
					{ width: `${to}px`, opacity: 1 },
				],
				{ duration: SLIDE[mode], easing: SLIDE_EASE },
			);
			reopen.onfinish = () => {
				element.style.overflowX = "";
			};
		};
	}, [exiting]);
}

interface ColumnProps {
	digit: number;
	digits: string[];
	direction: Direction;
	mode: RollMode;
	delay: number;
	reduced: boolean;
	/** Blur fast spins. Off for small text, where it reads as mush. */
	blur: boolean;
	appear: boolean;
	exiting: boolean;
	onExited: () => void;
	onDetent?: () => void;
}

/**
 * One digit place. At rest it is plain text. While it rolls, a masked drum of
 * four cells is drawn over it from a continuous position, so a roll can be
 * retargeted mid-flight without a jump.
 */
function DigitColumn({
	digit,
	digits,
	direction,
	mode,
	delay,
	reduced,
	blur,
	appear,
	exiting,
	onExited,
	onDetent,
}: ColumnProps) {
	const blurId = useContext(BlurContext);
	const slotRef = useRef<HTMLSpanElement>(null);
	const staticRef = useRef<HTMLSpanElement>(null);
	const drumRef = useRef<HTMLSpanElement>(null);
	const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const positionRef = useRef<MotionValue<number> | null>(null);
	positionRef.current ??= motionValue(digit);
	const roll = useRef({
		/** Integer position the column is heading to; its digit is `mod(target, 10)`. */
		target: digit,
		cell: 0,
		blur: 0,
		detent: digit,
		animation: null as AnimationPlaybackControls | null,
		timer: 0 as ReturnType<typeof setTimeout> | 0,
		mounted: false,
		interrupted: false,
	});
	const onDetentRef = useRef(onDetent);
	const digitsRef = useRef(digits);
	useLayoutEffect(() => {
		onDetentRef.current = onDetent;
		digitsRef.current = digits;
	});

	useSlide(slotRef, { appear, exiting, mode, reduced, onExited });

	const showDrum = (shown: boolean) => {
		const drum = drumRef.current;
		const text = staticRef.current;
		if (!drum || !text) return;
		drum.style.display = shown ? "block" : "";
		text.style.visibility = shown ? "hidden" : "";
		if (shown) {
			roll.current.cell = text.offsetHeight;
		} else {
			drum.style.filter = "";
			roll.current.blur = 0;
		}
	};

	const draw = (position: number) => {
		const state = roll.current;
		const base = Math.floor(position);
		cellRefs.current.forEach((cell, index) => {
			if (!cell) return;
			const place = base - 1 + index;
			cell.textContent = digitsRef.current[mod(place, 10)] ?? "";
			cell.style.transform = `translateY(${((place - position) * state.cell).toFixed(2)}px)`;
		});
		const speed = Math.abs(positionRef.current?.getVelocity() ?? 0);
		const strength = clamp((speed - BLUR_FROM) / (BLUR_FULL - BLUR_FROM), 0, 1);
		const level =
			!blur || speed < BLUR_FROM
				? 0
				: Math.ceil(strength * (BLUR_LEVELS.length - 1)) + 1;
		if (level !== state.blur && drumRef.current) {
			state.blur = level;
			drumRef.current.style.filter = level ? `url(#${blurId}-${level})` : "";
		}
		const detent = Math.round(position);
		if (detent !== state.detent) {
			state.detent = detent;
			onDetentRef.current?.();
		}
	};

	const rollTo = (target: number, rollMode: RollMode, wait: number) => {
		const state = roll.current;
		const position = positionRef.current;
		if (!position) return;
		state.target = target;
		if (state.timer) clearTimeout(state.timer);
		state.timer = 0;
		// The drum takes over at once, so the new digit never shows early while
		// the column waits its turn in the cascade.
		showDrum(true);
		draw(position.get());
		const start = () => {
			state.timer = 0;
			state.animation?.stop();
			state.animation = animate(position, target, {
				...(rollMode === "scrub" ? SCRUB_ROLL : DATA_ROLL),
				restDelta: 0.002,
				restSpeed: 0.05,
				onComplete: () => {
					if (state.target !== target) return;
					state.animation = null;
					// Settle back into plain, crisp text. The detent is set first so the
					// jump back to 0-9 doesn't count as a digit landing.
					state.target = mod(target, 10);
					state.detent = state.target;
					position.jump(state.target);
					showDrum(false);
				},
			});
		};
		if (wait > 0) state.timer = setTimeout(start, wait);
		else start();
	};

	const crossFade = (from: number) => {
		const drum = drumRef.current;
		const text = staticRef.current;
		const state = roll.current;
		state.target = digit;
		state.detent = digit;
		positionRef.current?.jump(digit);
		// A fade still running from the last change gives way to this one.
		for (const animation of [
			...(drum?.getAnimations() ?? []),
			...(text?.getAnimations() ?? []),
		]) {
			animation.cancel();
		}
		showDrum(false);
		if (!drum || !text || mode === "scrub") return;
		// The old digit fades out on the drum while the new one fades in.
		showDrum(true);
		text.style.visibility = "";
		cellRefs.current.forEach((cell, index) => {
			if (!cell) return;
			cell.textContent = index === 1 ? (digitsRef.current[from] ?? "") : "";
			cell.style.transform = "";
		});
		drum.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: CROSS_FADE,
			easing: "ease-out",
		}).onfinish = () => showDrum(false);
		text.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: CROSS_FADE,
			easing: "ease-out",
		});
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: subscribes once
	useLayoutEffect(() => {
		const position = positionRef.current;
		if (!position) return;
		const unsubscribe = position.on("change", draw);
		const state = roll.current;
		// Remounted mid-roll (React's strict mode does this on mount): finish it.
		if (state.interrupted) {
			state.interrupted = false;
			rollTo(state.target, "data", 0);
		}
		return () => {
			unsubscribe();
			state.interrupted = Boolean(state.animation || state.timer);
			state.animation?.stop();
			state.animation = null;
			if (state.timer) clearTimeout(state.timer);
			state.timer = 0;
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follows the digit and exit only
	useLayoutEffect(() => {
		const state = roll.current;
		const position = positionRef.current;
		if (!position) return;
		if (!state.mounted) {
			state.mounted = true;
			if (appear && !reduced) {
				// A new leading column rolls in one step as it opens.
				state.detent = digit - direction;
				position.jump(digit - direction);
				rollTo(digit, mode, delay);
			}
			return;
		}
		if (reduced) {
			if (!exiting && mod(state.target, 10) !== digit) {
				crossFade(mod(state.target, 10));
			}
			return;
		}
		if (exiting) {
			// A leaving column rolls one more step as it closes.
			rollTo(state.target + direction, mode, 0);
			return;
		}
		if (mod(state.target, 10) === digit) return;
		// The shortest path from where the column is, in the value's direction.
		const current = position.get();
		let target =
			direction > 0
				? Math.ceil(current - TARGET_SLACK)
				: Math.floor(current + TARGET_SLACK);
		while (mod(target, 10) !== digit) target += direction;
		rollTo(target, mode, delay);
	}, [digit, exiting]);

	return (
		<span
			ref={slotRef}
			data-slot="rolling-stat-digit"
			className="relative inline-flex justify-end"
		>
			<span ref={staticRef}>{digits[digit]}</span>
			<span
				ref={drumRef}
				className="pointer-events-none absolute inset-x-0 hidden overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_var(--rs-fade),#000_calc(100%_-_var(--rs-fade)),transparent)]"
				style={
					{
						top: `-${DRUM_OVERHANG}em`,
						bottom: `-${DRUM_OVERHANG}em`,
						"--rs-fade": `${DRUM_FADE}em`,
					} as CSSProperties
				}
			>
				{[0, 1, 2, 3].map((index) => (
					<span
						key={index}
						ref={(node) => {
							cellRefs.current[index] = node;
						}}
						className="absolute inset-x-0 block text-left"
						style={{ top: `${DRUM_OVERHANG}em` }}
					/>
				))}
			</span>
		</span>
	);
}

/** A symbol that never rolls. It slides open or closed and fades if it changes. */
function StaticGlyph({
	glyph,
	smallUnits,
	mode,
	reduced,
	appear,
	exiting,
	onExited,
}: {
	glyph: Glyph;
	smallUnits: boolean;
	mode: RollMode;
	reduced: boolean;
	appear: boolean;
	exiting: boolean;
	onExited: () => void;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const shown = useRef({ char: glyph.char, width: 0 });
	useSlide(ref, { appear, exiting, mode, reduced, onExited });

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const previous = shown.current;
		const width = element.getBoundingClientRect().width;
		if (previous.char !== glyph.char && previous.width > 0 && !exiting) {
			// "+" to "-", "K" to "M": fade the new symbol in at the new width.
			const frames: Keyframe[] = reduced
				? [{ opacity: 0 }, { opacity: 1 }]
				: [
						{ opacity: 0, width: `${previous.width}px` },
						{ opacity: 1, width: `${width}px` },
					];
			element.animate(frames, {
				duration: reduced ? CROSS_FADE : SLIDE[mode],
				easing: SLIDE_EASE,
			});
		}
		shown.current = { char: glyph.char, width };
	}, [glyph.char, exiting, mode, reduced]);

	return (
		<span
			ref={ref}
			className={cn(
				"inline-flex justify-end",
				glyph.unit &&
					smallUnits &&
					"font-medium text-[0.45em] text-muted-foreground tracking-normal",
			)}
		>
			{glyph.char}
		</span>
	);
}

/**
 * A formatted number whose digits roll like a counter. Each place rolls on its
 * own, in the direction the value moved; on data updates the changed places
 * start one after another from the right, so a carry visibly ripples left.
 */
function RollingNumber({
	value,
	formatter,
	digits,
	prefix,
	suffix,
	mode,
	reduced,
	smallUnits = false,
	blur = true,
	onDetent,
	className,
}: {
	value: number;
	formatter: Intl.NumberFormat;
	digits: string[];
	prefix?: string;
	suffix?: string;
	mode: RollMode;
	reduced: boolean;
	/** Draw `prefix` and `suffix` as small, muted units. */
	smallUnits?: boolean;
	/** Blur digits that spin far and fast. */
	blur?: boolean;
	onDetent?: () => void;
	className?: string;
}) {
	const glyphs = useMemo(
		() => toGlyphs(formatter.formatToParts(value), digits, prefix, suffix),
		[formatter, value, digits, prefix, suffix],
	);
	const text = glyphs.map((glyph) => glyph.char).join("");

	const [roll, setRoll] = useState(() => ({
		text,
		value,
		items: glyphs as Item[],
		direction: 1 as Direction,
		mode,
		delays: new Map<string, number>(),
	}));
	if (roll.text !== text) {
		// Direction follows the magnitude, so -1,099 to -1,100 carries like 1,099
		// to 1,100.
		const direction: Direction =
			Math.abs(value) >= Math.abs(roll.value) ? 1 : -1;
		const before = new Map(
			roll.items
				.filter((item) => !item.exiting && item.digit !== null)
				.map((item) => [item.key, item.digit]),
		);
		const changed = glyphs
			.filter(
				(glyph) =>
					glyph.digit !== null && before.get(glyph.key) !== glyph.digit,
			)
			.sort((a, b) => a.place - b.place);
		const delays = new Map<string, number>();
		if (mode === "data" && !reduced) {
			changed.forEach((glyph, order) => {
				delays.set(glyph.key, order * CASCADE_STAGGER);
			});
		}
		setRoll({
			text,
			value,
			items: reduced ? glyphs : mergeGlyphs(roll.items, glyphs),
			direction,
			mode,
			delays,
		});
	}

	const [appear, setAppear] = useState(false);
	useEffect(() => setAppear(true), []);

	const removeItem = (key: string) => {
		setRoll((current) => ({
			...current,
			items: current.items.filter(
				(item) => !(item.exiting && item.key === key),
			),
		}));
	};

	return (
		<span
			aria-hidden
			className={cn("inline-flex items-baseline whitespace-pre", className)}
		>
			{roll.items.map((item) =>
				item.digit !== null ? (
					<DigitColumn
						key={item.key}
						digit={item.digit}
						digits={digits}
						direction={roll.direction}
						mode={roll.mode}
						delay={roll.delays.get(item.key) ?? 0}
						reduced={reduced}
						blur={blur}
						appear={appear}
						exiting={Boolean(item.exiting)}
						onExited={() => removeItem(item.key)}
						onDetent={onDetent}
					/>
				) : (
					<StaticGlyph
						key={item.key}
						glyph={item}
						smallUnits={smallUnits}
						mode={roll.mode}
						reduced={reduced}
						appear={appear}
						exiting={Boolean(item.exiting)}
						onExited={() => removeItem(item.key)}
					/>
				),
			)}
		</span>
	);
}

/* ------------------------------- Sparkline ------------------------------- */

type Domain = { min: number; max: number };

function domainOf(values: number[]): Domain {
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (!Number.isFinite(min)) return { min: 0, max: 1 };
	// A flat line sits in the middle.
	if (min === max) return { min: min - 1, max: max + 1 };
	return { min, max };
}

function yOf(value: number, { min, max }: Domain) {
	return (
		SPARK_PAD_Y +
		(1 - (value - min) / (max - min)) * (SPARK_HEIGHT - 2 * SPARK_PAD_Y)
	);
}

function xOf(index: number, count: number, width: number) {
	const span = width - 2 * SPARK_PAD_X;
	return count <= 1 ? width / 2 : SPARK_PAD_X + (index * span) / (count - 1);
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A monotone cubic through the points, so the line never overshoots a value. */
function linePath(xs: number[], ys: number[]) {
	const count = xs.length;
	if (count === 0) return "";
	if (count === 1) return `M${round(xs[0])},${round(ys[0])}`;
	const slopes: number[] = [];
	for (let index = 0; index < count - 1; index++) {
		slopes.push((ys[index + 1] - ys[index]) / (xs[index + 1] - xs[index] || 1));
	}
	const tangents = xs.map((_, index) => {
		if (index === 0) return slopes[0];
		if (index === count - 1) return slopes[count - 2];
		const left = slopes[index - 1];
		const right = slopes[index];
		if (left * right <= 0) return 0;
		const dl = xs[index] - xs[index - 1];
		const dr = xs[index + 1] - xs[index];
		return (3 * (dl + dr)) / ((2 * dr + dl) / left + (dr + 2 * dl) / right);
	});
	let path = `M${round(xs[0])},${round(ys[0])}`;
	for (let index = 0; index < count - 1; index++) {
		const third = (xs[index + 1] - xs[index]) / 3;
		path += `C${round(xs[index] + third)},${round(ys[index] + tangents[index] * third)},${round(xs[index + 1] - third)},${round(ys[index + 1] - tangents[index + 1] * third)},${round(xs[index + 1])},${round(ys[index + 1])}`;
	}
	return path;
}

function areaPath(line: string, xs: number[]) {
	if (xs.length < 2) return "";
	return `${line}L${round(xs[xs.length - 1])},${SPARK_HEIGHT}L${round(xs[0])},${SPARK_HEIGHT}Z`;
}

function shapeOf(values: number[], width: number, domain = domainOf(values)) {
	const xs = values.map((_, index) => xOf(index, values.length, width));
	const ys = values.map((value) => yOf(value, domain));
	const line = linePath(xs, ys);
	return { line, area: areaPath(line, xs), xs, ys };
}

function sameValues(a: number[], b: number[]) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

interface SparklineProps {
	values: number[];
	index: number | null;
	reduced: boolean;
	scrubbable: boolean;
	ariaLabel: string;
	valueText: string;
	onScrub: (index: number | null, touch: boolean) => void;
}

/**
 * The history line. Pointer, touch, and keys scrub it point by point; a new
 * point draws in at the right edge as the line eases one step left.
 */
function Sparkline({
	values,
	index,
	reduced,
	scrubbable,
	ariaLabel,
	valueText,
	onScrub,
}: SparklineProps) {
	const gradientId = `${useId().replace(/[^\w-]/g, "")}-fill`;
	const rootRef = useRef<HTMLDivElement>(null);
	const lineRef = useRef<SVGPathElement>(null);
	const restRef = useRef<SVGPathElement>(null);
	const areaRef = useRef<SVGPathElement>(null);
	const [measured, setMeasured] = useState(0);
	const width = measured || 240;
	const count = values.length;
	const domain = domainOf(values);
	const shape = shapeOf(values, width, domain);
	const scrubX = index === null ? null : shape.xs[index];
	const scrubY = index === null ? null : shape.ys[index];
	// The dot and hairline fade out where they were, not at the origin.
	// Parked inside the line until the first scrub, so it never overhangs.
	const [marker, setMarker] = useState({ x: 2 * SPARK_PAD_X, y: SPARK_PAD_Y });
	if (
		scrubX !== null &&
		scrubY !== null &&
		(scrubX !== marker.x || scrubY !== marker.y)
	) {
		setMarker({ x: scrubX, y: scrubY });
	}

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		setMeasured(Math.round(root.getBoundingClientRect().width));
		const observer = new ResizeObserver(([entry]) => {
			setMeasured(Math.round(entry.contentRect.width));
		});
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	const shownRef = useRef({ values, width });
	const tweenRef = useRef<AnimationPlaybackControls | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: eases between drawn values
	useLayoutEffect(() => {
		const previous = shownRef.current;
		shownRef.current = { values, width };
		if (previous.width !== width || sameValues(previous.values, values)) return;
		tweenRef.current?.stop();
		const from = previous.values;
		const n = values.length;
		const shifted =
			n === from.length &&
			n > 1 &&
			sameValues(from.slice(1), values.slice(0, -1));
		const grown =
			n === from.length + 1 && sameValues(from, values.slice(0, -1));
		const tweened = n === from.length;
		if (reduced || n < 2 || !(shifted || grown || tweened)) return;
		const fromDomain = domainOf(from);
		const toDomain = domainOf(values);
		const draw = (t: number) => {
			const domainAt = {
				min: fromDomain.min + (toDomain.min - fromDomain.min) * t,
				max: fromDomain.max + (toDomain.max - fromDomain.max) * t,
			};
			let xs: number[];
			let ys: number[];
			if (shifted) {
				// The old line plus the new point, sliding one step left.
				const all = [...from, values[n - 1]];
				const step = (width - 2 * SPARK_PAD_X) / (n - 1);
				xs = all.map((_, i) => SPARK_PAD_X + (i - t) * step);
				ys = all.map((value) => yOf(value, domainAt));
			} else if (grown) {
				// Old points spread to the new spacing while the new one draws in.
				const reveal = values.map((_, i) => {
					const before = i < from.length ? xOf(i, from.length, width) : null;
					const after = xOf(i, n, width);
					return before === null ? after : before + (after - before) * t;
				});
				const last = reveal[n - 2];
				reveal[n - 1] = last + (reveal[n - 1] - last) * t;
				const lastY = from[from.length - 1];
				xs = reveal;
				ys = values.map((value, i) =>
					yOf(i === n - 1 ? lastY + (value - lastY) * t : value, domainAt),
				);
			} else {
				xs = values.map((_, i) => xOf(i, n, width));
				ys = values.map((value, i) =>
					yOf(from[i] + (value - from[i]) * t, domainAt),
				);
			}
			const line = linePath(xs, ys);
			lineRef.current?.setAttribute("d", line);
			restRef.current?.setAttribute("d", line);
			areaRef.current?.setAttribute("d", areaPath(line, xs));
		};
		draw(0);
		tweenRef.current = animate(0, 1, {
			duration: SPARK_SHIFT / 1000,
			ease: [0.22, 1, 0.36, 1],
			onUpdate: draw,
			onComplete: () => {
				tweenRef.current = null;
				draw(1);
			},
		});
	}, [values, width]);
	useEffect(() => () => tweenRef.current?.stop(), []);

	// Pointer scrubbing. Touch waits for a horizontal drag, so a vertical swipe
	// still scrolls the page (`touch-action: pan-y`).
	const pointerRef = useRef<{
		id: number;
		touch: boolean;
		startX: number;
		started: boolean;
		rect: DOMRect;
	} | null>(null);

	const indexAt = (clientX: number, rect: DOMRect) => {
		const span = rect.width - 2 * SPARK_PAD_X;
		const ratio = (clientX - rect.left - SPARK_PAD_X) / (span || 1);
		return clamp(Math.round(ratio * (count - 1)), 0, count - 1);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!scrubbable || count < 2) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const touch = event.pointerType === "touch";
		const rect = event.currentTarget.getBoundingClientRect();
		pointerRef.current = {
			id: event.pointerId,
			touch,
			startX: event.clientX,
			started: !touch,
			rect,
		};
		if (!touch) {
			event.currentTarget.setPointerCapture(event.pointerId);
			onScrub(indexAt(event.clientX, rect), false);
		}
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!scrubbable || count < 2) return;
		const pointer = pointerRef.current;
		if (event.pointerType === "touch") {
			if (!pointer || pointer.id !== event.pointerId) return;
			if (!pointer.started) {
				if (Math.abs(event.clientX - pointer.startX) < TOUCH_SLOP) return;
				// Touch is captured implicitly, so the drag can leave the line.
				pointer.started = true;
			}
			onScrub(indexAt(event.clientX, pointer.rect), true);
			return;
		}
		// Mouse and pen scrub on hover as well as while pressed.
		const rect = pointer?.rect ?? event.currentTarget.getBoundingClientRect();
		onScrub(indexAt(event.clientX, rect), false);
	};

	const endPointer = (event: PointerEvent<HTMLDivElement>) => {
		const pointer = pointerRef.current;
		if (!pointer || pointer.id !== event.pointerId) return;
		pointerRef.current = null;
		// A mouse released over the line keeps scrubbing on hover.
		if (pointer.touch || event.type === "pointercancel") onScrub(null, false);
	};

	const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
		if (pointerRef.current?.id === event.pointerId) return;
		if (event.pointerType !== "touch") onScrub(null, false);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!scrubbable || count < 2) return;
		const current = index ?? count - 1;
		let next: number | null = null;
		switch (event.key) {
			case "ArrowLeft":
			case "ArrowDown":
				next = current - 1;
				break;
			case "ArrowRight":
			case "ArrowUp":
				next = current + 1;
				break;
			case "PageDown":
				next = current - Math.max(1, Math.round(count / 10));
				break;
			case "PageUp":
				next = current + Math.max(1, Math.round(count / 10));
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = count - 1;
				break;
			case "Escape":
				if (index === null) return;
				event.preventDefault();
				onScrub(null, false);
				return;
			default:
				return;
		}
		event.preventDefault();
		onScrub(clamp(next, 0, count - 1), false);
	};

	const scrubbing = scrubX !== null;
	return (
		<div
			ref={rootRef}
			data-slot="rolling-stat-sparkline"
			data-scrubbing={scrubbing || undefined}
			{...(scrubbable
				? {
						role: "slider",
						tabIndex: 0,
						"aria-label": ariaLabel,
						"aria-orientation": "horizontal" as const,
						"aria-valuemin": 0,
						"aria-valuemax": count - 1,
						"aria-valuenow": index ?? count - 1,
						"aria-valuetext": valueText,
					}
				: { "aria-hidden": true })}
			dir="ltr"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={endPointer}
			onPointerCancel={endPointer}
			onPointerLeave={handlePointerLeave}
			onKeyDown={handleKeyDown}
			onBlur={() => onScrub(null, false)}
			className={cn(
				"relative h-10 touch-pan-y select-none rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				scrubbable && "cursor-crosshair",
			)}
		>
			<svg
				aria-hidden
				viewBox={`0 0 ${width} ${SPARK_HEIGHT}`}
				preserveAspectRatio="none"
				className="absolute inset-0 size-full overflow-visible"
			>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="currentColor" stopOpacity="0.08" />
						<stop offset="1" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
					<clipPath id={`${gradientId}-past`}>
						<rect
							x={-SPARK_PAD_X}
							y={-SPARK_PAD_Y}
							width={(scrubX ?? width + SPARK_PAD_X) + SPARK_PAD_X}
							height={SPARK_HEIGHT + 2 * SPARK_PAD_Y}
						/>
					</clipPath>
					<clipPath id={`${gradientId}-future`}>
						<rect
							x={scrubX ?? width + SPARK_PAD_X}
							y={-SPARK_PAD_Y}
							width={width + SPARK_PAD_X}
							height={SPARK_HEIGHT + 2 * SPARK_PAD_Y}
						/>
					</clipPath>
				</defs>
				<path
					ref={areaRef}
					d={shape.area}
					fill={`url(#${gradientId})`}
					clipPath={`url(#${gradientId}-past)`}
				/>
				{/* Past the scrubbed point the line dims. */}
				<path
					ref={restRef}
					d={shape.line}
					fill="none"
					stroke="currentColor"
					strokeOpacity={0.22}
					strokeWidth={1.5}
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
					clipPath={`url(#${gradientId}-future)`}
				/>
				<path
					ref={lineRef}
					d={shape.line}
					fill="none"
					stroke="currentColor"
					strokeOpacity={0.7}
					strokeWidth={1.5}
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
					clipPath={`url(#${gradientId}-past)`}
				/>
			</svg>
			<span
				aria-hidden
				data-slot="rolling-stat-hairline"
				className={cn(
					"pointer-events-none absolute inset-y-0 left-0 w-px bg-foreground/20 transition-opacity duration-150",
					scrubbing ? "opacity-100" : "opacity-0",
				)}
				style={{
					transform: `translateX(${Math.round(marker.x - 0.5)}px)`,
				}}
			/>
			<span
				aria-hidden
				data-slot="rolling-stat-dot"
				className={cn(
					"pointer-events-none absolute top-0 left-0 size-1.5 rounded-full bg-foreground ring-2 ring-background transition-opacity duration-150",
					scrubbing ? "opacity-100" : "opacity-0",
				)}
				style={{
					transform: `translate(${marker.x - 3}px, ${marker.y - 3}px)`,
				}}
			/>
		</div>
	);
}

/* --------------------------------- Stat --------------------------------- */

const EMPTY: RollingStatPoint[] = [];
const AUTO_DELTA_FORMAT: Intl.NumberFormatOptions = {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
};

function useFormatter(
	locale: string | undefined,
	format?: Intl.NumberFormatOptions,
) {
	const key = JSON.stringify(format ?? null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by content, so inline objects don't rebuild it
	return useMemo(() => {
		const formatter = new Intl.NumberFormat(locale, format);
		return { formatter, digits: digitsOf(formatter, locale) };
	}, [locale, key]);
}

/**
 * A KPI figure whose digits roll like a precise odometer, over a sparkline you
 * can scrub: drag or hover across the line and the figure and its change roll
 * back through history, then glide back to the live value on release.
 */
export function RollingStat({
	value: valueProp,
	history = EMPTY,
	label,
	format,
	locale,
	prefix,
	suffix,
	delta: deltaProp,
	deltaFormat,
	invertTrend = false,
	size = "md",
	variant = "card",
	live = false,
	scrubbable: scrubbableProp,
	onScrub,
	sound = false,
	haptics = true,
	announce = false,
	animated = true,
	className,
	...props
}: RollingStatProps) {
	const points = useMemo(
		() =>
			history.map((point, index) =>
				typeof point === "number"
					? { index, value: point, label: undefined as string | undefined }
					: { index, value: point.value, label: point.label },
			),
		[history],
	);
	const values = useMemo(() => points.map((point) => point.value), [points]);
	const liveValue = valueProp ?? points.at(-1)?.value ?? 0;
	const scrubbable = (scrubbableProp ?? true) && points.length >= 2;

	const [scrubIndex, setScrubIndex] = useState<number | null>(null);
	const index =
		scrubIndex === null || points.length < 2
			? null
			: Math.min(scrubIndex, points.length - 1);
	const scrubbing = index !== null;
	const point = index === null ? null : points[index];
	const shownValue = point ? point.value : liveValue;
	const mode: RollMode = scrubbing ? "scrub" : "data";

	const prefersReduced = useReducedMotion() ?? false;
	const reduced = !animated || prefersReduced;

	const { formatter, digits } = useFormatter(locale, format);
	const deltaMode = deltaProp ?? (points.length >= 2 ? "auto" : undefined);
	const deltaFormatter = useFormatter(
		locale,
		deltaFormat ?? (deltaMode === "auto" ? AUTO_DELTA_FORMAT : format),
	);

	const first = points[0]?.value;
	const deltaOf = (target: number, fromHistory: boolean) => {
		if (deltaMode === undefined) return null;
		if (deltaMode === "auto") {
			return first ? (target - first) / Math.abs(first) : null;
		}
		return fromHistory && first !== undefined ? target - first : deltaMode;
	};
	const deltaValue = deltaOf(shownValue, scrubbing);
	const liveDelta = deltaOf(liveValue, false);
	const trendOf = (change: number | null) => {
		if (change === null) return 0;
		const zero = deltaFormatter.formatter.format(0);
		if (deltaFormatter.formatter.format(Math.abs(change)) === zero) return 0;
		return Math.sign(change);
	};
	const trend = trendOf(deltaValue);
	const tone =
		trend === 0 ? "flat" : trend * (invertTrend ? -1 : 1) > 0 ? "good" : "bad";
	const deltaUnits = deltaMode === "auto" ? {} : { prefix, suffix };

	const formatText = (target: number) =>
		`${prefix ?? ""}${formatter.format(target)}${suffix ?? ""}`;
	const formatDelta = (change: number | null) => {
		if (change === null) return "";
		const amount = `${deltaUnits.prefix ?? ""}${deltaFormatter.formatter.format(Math.abs(change))}${deltaUnits.suffix ?? ""}`;
		const direction = trendOf(change);
		return direction === 0
			? "no change"
			: `${direction > 0 ? "up" : "down"} ${amount}`;
	};
	const liveText = formatText(liveValue);
	const shownText = formatText(shownValue);
	const ariaLabel = [
		label ? `${label}: ${liveText}` : liveText,
		formatDelta(liveDelta),
	]
		.filter(Boolean)
		.join(", ");

	const { trigger: haptic } = useWebHaptics();
	// Sound is off by default, so the audio engine only starts once it's on.
	const soundsRef = useRef<{ roll: TiksApi; scrub: TiksApi } | null>(null);
	useEffect(() => {
		if (!sound || soundsRef.current) return;
		soundsRef.current = {
			roll: createTiks({ theme: ROLL_CLICK, respectReducedMotion: false }),
			scrub: createTiks({ theme: SCRUB_TICK, respectReducedMotion: false }),
		};
	}, [sound]);

	// One budget of clicks per data update; scrubbing and release stay quiet.
	const clicks = useRef({ budget: 0, lastAt: Number.NEGATIVE_INFINITY });
	const lastLiveRef = useRef(liveValue);
	useEffect(() => {
		if (lastLiveRef.current === liveValue) return;
		lastLiveRef.current = liveValue;
		clicks.current.budget = scrubbing ? 0 : ROLL_CLICK_LIMIT;
	}, [liveValue, scrubbing]);
	useEffect(() => {
		if (scrubbing) clicks.current.budget = 0;
	}, [scrubbing]);
	const handleDetent = () => {
		const state = clicks.current;
		if (!sound || state.budget <= 0 || isHidden()) return;
		const now = performance.now();
		if (now - state.lastAt < ROLL_CLICK_THROTTLE) return;
		state.lastAt = now;
		state.budget -= 1;
		soundsRef.current?.roll.click();
	};

	const indexRef = useRef<number | null>(null);
	const tickAtRef = useRef(Number.NEGATIVE_INFINITY);
	const pointsRef = useRef(points);
	useLayoutEffect(() => {
		indexRef.current = index;
		pointsRef.current = points;
	});
	const scrubTo = (next: number | null, touch: boolean) => {
		if (next === indexRef.current) return;
		indexRef.current = next;
		setScrubIndex(next);
		const target = next === null ? null : pointsRef.current[next];
		onScrub?.(target ? { ...target } : null);
		if (next === null || isHidden()) return;
		const now = performance.now();
		if (now - tickAtRef.current < SCRUB_TICK_THROTTLE) return;
		tickAtRef.current = now;
		if (sound) soundsRef.current?.scrub.click();
		if (haptics && touch) void haptic("selection");
	};
	const scrubToRef = useRef(scrubTo);
	useLayoutEffect(() => {
		scrubToRef.current = scrubTo;
	});

	// Leaving the window or hiding the tab mid-scrub returns to live.
	useEffect(() => {
		if (!scrubbing) return;
		const end = () => scrubToRef.current(null, false);
		const onVisibility = () => {
			if (isHidden()) end();
		};
		window.addEventListener("blur", end);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("blur", end);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [scrubbing]);

	const [announcement, setAnnouncement] = useState("");
	const announcedRef = useRef(liveText);
	useEffect(() => {
		if (!announce || liveText === announcedRef.current) return;
		const timer = setTimeout(() => {
			announcedRef.current = liveText;
			setAnnouncement(label ? `${label}: ${liveText}` : liveText);
		}, ANNOUNCE_DELAY);
		return () => clearTimeout(timer);
	}, [announce, liveText, label]);

	const pulseRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const pulse = pulseRef.current;
		if (!live || reduced || !pulse) return;
		const animation = pulse.animate(
			[
				{ transform: "scale(1)", opacity: 0.45 },
				{ transform: "scale(2.6)", opacity: 0 },
			],
			{
				duration: 2000,
				iterations: Number.POSITIVE_INFINITY,
				easing: "ease-out",
			},
		);
		return () => animation.cancel();
	}, [live, reduced]);

	const blurId = `${useId().replace(/[^\w-]/g, "")}-blur`;
	const sizeStyle = sizes[size];
	const pointLabel = point?.label;
	// The last point label stays while it fades back out to `label`.
	const [heldLabel, setHeldLabel] = useState(pointLabel);
	if (pointLabel && pointLabel !== heldLabel) setHeldLabel(pointLabel);
	const lastPoint = points.at(-1);
	const slider = point ?? lastPoint;
	const valueText = slider
		? `${slider.label ?? `Point ${slider.index + 1} of ${points.length}`}: ${formatText(slider.value)}`
		: "";

	return (
		<BlurContext.Provider value={blurId}>
			<div
				role="group"
				aria-label={ariaLabel}
				data-slot="rolling-stat"
				data-variant={variant}
				data-size={size}
				data-state={scrubbing ? "scrubbing" : "live"}
				data-trend={tone}
				className={cn(
					"@container relative flex w-full min-w-0 flex-col",
					variants[variant],
					className,
				)}
				{...props}
			>
				<svg aria-hidden className="pointer-events-none absolute size-0">
					<defs>
						{BLUR_LEVELS.map((amount, level) => (
							<filter
								key={amount}
								id={`${blurId}-${level + 1}`}
								x="-5%"
								y="-25%"
								width="110%"
								height="150%"
							>
								<feGaussianBlur stdDeviation={`0 ${amount}`} />
							</filter>
						))}
					</defs>
				</svg>
				<div className="flex min-h-5 items-center justify-between gap-3">
					<span
						data-slot="rolling-stat-label"
						className="grid min-w-0 text-muted-foreground text-sm"
					>
						<span
							className={cn(
								"col-start-1 row-start-1 truncate transition-opacity duration-150",
								pointLabel ? "opacity-0" : "opacity-100",
							)}
						>
							{label}
						</span>
						<span
							aria-hidden
							className={cn(
								"col-start-1 row-start-1 truncate transition-opacity duration-150",
								pointLabel ? "opacity-100" : "opacity-0",
							)}
						>
							{heldLabel}
						</span>
					</span>
					{live ? (
						<span
							data-slot="rolling-stat-live"
							aria-hidden={scrubbing || undefined}
							className={cn(
								"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-[11px] text-muted-foreground leading-4 transition-opacity duration-200",
								scrubbing ? "opacity-0" : "opacity-100",
							)}
						>
							<span className="relative size-1.5">
								<span
									ref={pulseRef}
									className="absolute inset-0 rounded-full bg-emerald-500"
								/>
								<span className="absolute inset-0 rounded-full bg-emerald-500" />
							</span>
							Live
						</span>
					) : null}
				</div>
				<div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
					<span
						dir="ltr"
						data-slot="rolling-stat-value"
						className={cn(
							"font-semibold text-foreground tabular-nums tracking-tight",
							sizeStyle.figure,
							// After the size, which would reset it. The drum's cells are
							// one line apart, so the extra leading spaces the digits out.
							"leading-[1.15]",
						)}
					>
						<RollingNumber
							value={shownValue}
							formatter={formatter}
							digits={digits}
							prefix={prefix}
							suffix={suffix}
							mode={mode}
							reduced={reduced}
							smallUnits
							onDetent={handleDetent}
						/>
						<span className="sr-only">{shownText}</span>
					</span>
					{deltaValue !== null ? (
						<span
							data-slot="rolling-stat-delta"
							data-trend={tone}
							className={cn(
								"inline-flex shrink-0 items-center gap-0.5 rounded-full py-0.5 ps-1.5 pe-2 font-medium tabular-nums leading-5 transition-[color,background-color] duration-180",
								tints[tone],
								sizeStyle.delta,
							)}
						>
							<ArrowUp
								aria-hidden
								strokeWidth={2.5}
								// A media query, not `reduced`, so server and client markup agree.
								className={cn(
									"shrink-0 transition-transform duration-180 ease-out motion-reduce:transition-none",
									!animated && "transition-none",
								)}
								style={{
									transform: `rotate(${trend > 0 ? 0 : trend < 0 ? 180 : 90}deg)`,
								}}
							/>
							<span dir="ltr">
								<RollingNumber
									value={Math.abs(deltaValue)}
									formatter={deltaFormatter.formatter}
									digits={deltaFormatter.digits}
									prefix={deltaUnits.prefix}
									suffix={deltaUnits.suffix}
									mode={mode}
									reduced={reduced}
									blur={false}
								/>
							</span>
							<span className="sr-only">{formatDelta(deltaValue)}</span>
						</span>
					) : null}
				</div>
				{points.length >= 2 ? (
					<div className={cn("text-foreground", sizeStyle.spark)}>
						<Sparkline
							values={values}
							index={index}
							reduced={reduced}
							scrubbable={scrubbable}
							ariaLabel={label ? `${label} history` : "History"}
							valueText={valueText}
							onScrub={scrubTo}
						/>
					</div>
				) : null}
				{announce ? (
					<span aria-live="polite" aria-atomic className="sr-only">
						{announcement}
					</span>
				) : null}
			</div>
		</BlurContext.Provider>
	);
}

export default RollingStat;
