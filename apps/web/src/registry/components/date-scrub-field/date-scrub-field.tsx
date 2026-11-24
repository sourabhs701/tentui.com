"use client";

import NumberFlow from "@number-flow/react";
import { useTiks } from "@rexa-developer/tiks/react";
import { Calendar } from "lucide-react";
import {
	AnimatePresence,
	animate,
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type FocusEvent,
	type KeyboardEvent,
	type PointerEvent,
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

export type DatePart = "month" | "day" | "year";
export type DateOrder = "mdy" | "dmy" | "ymd";
export type DateScrubSize = "sm" | "md" | "lg";
export type DateScrubVariant = "outline" | "filled" | "ghost";
export type MonthFormat = "short" | "2-digit" | "numeric";

/** Calendar date accepted as either a `Date` instance or an ISO `YYYY-MM-DD` string. */
export type DateValue = Date | string;

export interface DateScrubFieldProps {
	/** Controlled date value (`Date` or `YYYY-MM-DD`). */
	value?: DateValue;
	/** Initial date value when uncontrolled (`Date` or `YYYY-MM-DD`). Defaults to `"2026-05-14"`. */
	defaultValue?: DateValue;
	/** Called continuously as the date changes during scrubbing, keyboard stepping, or typing. */
	onValueChange?: (date: Date, iso: string) => void;
	/** Called once a scrub releases, a keyboard step finishes, or a typed segment commits. */
	onValueCommit?: (date: Date, iso: string) => void;
	/** Earliest selectable date (`Date` or `YYYY-MM-DD`). */
	min?: DateValue;
	/** Latest selectable date (`Date` or `YYYY-MM-DD`). */
	max?: DateValue;
	/** Segment order: `"mdy"` (May 14, 2026), `"dmy"` (14 May 2026), or `"ymd"` (2026-05-14). */
	order?: DateOrder;
	/** Format for the month segment (`"short"`, `"2-digit"`, or `"numeric"`). Defaults to `"short"`. */
	monthFormat?: MonthFormat;
	/** BCP 47 locale for month names, weekday names, and screen-reader announcements. Defaults to `"en-US"`. */
	locale?: string;
	/** Horizontal pointer travel in pixels per scrub step. Defaults to `18`. */
	sensitivity?: number;
	/** Roll day across month/year boundaries when scrubbing past month edges. Defaults to `true`. */
	rollover?: boolean;
	/** Show the leading calendar icon. Defaults to `true`. */
	showIcon?: boolean;
	/** Show the live abbreviated weekday suffix (e.g. `Thu`). Defaults to `true`. */
	showWeekday?: boolean;
	/** Show the floating vernier ruler loupe above the active segment while scrubbing. Defaults to `true`. */
	showLoupe?: boolean;
	/** Allow scrolling the mouse wheel over a focused segment to step it. Defaults to `false`. */
	wheel?: boolean;
	/** Size preset (`"sm"`, `"md"`, or `"lg"`). Defaults to `"md"`. */
	size?: DateScrubSize;
	/** Surface variant (`"outline"`, `"filled"`, or `"ghost"`). Defaults to `"outline"`. */
	variant?: DateScrubVariant;
	/** Play mechanical tick sounds on steps and a soft pop at limits. Defaults to `true`. */
	sound?: boolean;
	/** Trigger haptic cues on supported devices. Defaults to `true`. */
	haptics?: boolean;
	/** Disable pointer scrubbing, typing, and keyboard interaction. */
	disabled?: boolean;
	/** Keep the field readable and focusable while preventing edits. */
	readOnly?: boolean;
	/** Submits the ISO `YYYY-MM-DD` string in a native form via a hidden input. */
	name?: string;
	/** Accessible group label for the date field. Defaults to `"Date"`. */
	label?: string;
	/** Additional class names for the outer field wrapper. */
	className?: string;
}

interface CalendarDate {
	year: number;
	month: number;
	day: number;
}

const DEFAULT_CALENDAR_DATE: CalendarDate = { year: 2026, month: 5, day: 14 };
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;
const DRAG_THRESHOLD_PX = 4;
const TOUCH_VERTICAL_CANCEL_PX = 10;
const CUE_THROTTLE_MS = 35;
const ANNOUNCE_DELAY_MS = 320;
const TYPE_BUFFER_TIMEOUT_MS = 900;
const WHEEL_STEP_PX = 45;
const LOUPE_HALF_WIDTH = 74;
const LOUPE_VIEWPORT_MARGIN = 12;
const VERNIER_PERIOD_PX = 40;
const VERNIER_TICK_COUNT = 26;

const DIGIT_TIMING = {
	duration: 240,
	easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

const LOUPE_SPRING = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: 0.7,
} as const;

const RUBBER_RELEASE_SPRING = {
	type: "spring",
	stiffness: 540,
	damping: 30,
} as const;

const PART_SENSITIVITY_FACTOR: Record<DatePart, number> = {
	month: 1.35,
	day: 1,
	year: 1.15,
};

const PART_ORDER: Record<DateOrder, readonly [DatePart, DatePart, DatePart]> = {
	mdy: ["month", "day", "year"],
	dmy: ["day", "month", "year"],
	ymd: ["year", "month", "day"],
};

const SIZES = {
	sm: {
		root: "min-h-8 gap-1 px-2 text-xs rounded-lg",
		icon: "size-3.5",
		segment: "px-1.5 py-0.5 rounded-md",
		weekday: "text-[11px] pl-1.5",
		divider: "h-3",
	},
	md: {
		root: "min-h-10 gap-1.5 px-2.5 text-sm rounded-xl",
		icon: "size-4",
		segment: "px-2 py-1 rounded-lg",
		weekday: "text-xs pl-2",
		divider: "h-3.5",
	},
	lg: {
		root: "min-h-12 gap-2 px-3.5 text-base rounded-xl",
		icon: "size-[18px]",
		segment: "px-2.5 py-1.5 rounded-lg",
		weekday: "text-xs pl-2.5",
		divider: "h-4",
	},
} as const;

const VARIANTS = {
	outline:
		"border border-input bg-background shadow-xs dark:bg-input/30 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
	filled:
		"border border-transparent bg-muted/70 dark:bg-muted/45 has-[:focus-visible]:border-ring/60 has-[:focus-visible]:bg-background has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
	ghost:
		"border border-transparent bg-transparent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
} as const;

function isLeapYear(year: number) {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number) {
	switch (month) {
		case 2:
			return isLeapYear(year) ? 29 : 28;
		case 4:
		case 6:
		case 9:
		case 11:
			return 30;
		default:
			return 31;
	}
}

function clampNumber(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function rubberband(overshoot: number, dimension = 44, constant = 0.55) {
	const abs = Math.abs(overshoot);
	const damped = (abs * dimension * constant) / (dimension + constant * abs);
	return Math.sign(overshoot) * Math.min(damped, 10);
}

function parseDateValue(input?: DateValue): CalendarDate | null {
	if (!input) return null;
	if (input instanceof Date) {
		if (Number.isNaN(input.getTime())) return null;
		return {
			year: clampNumber(
				input.getFullYear(),
				MIN_SUPPORTED_YEAR,
				MAX_SUPPORTED_YEAR,
			),
			month: input.getMonth() + 1,
			day: input.getDate(),
		};
	}
	const trimmed = input.trim();
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
	if (match) {
		const year = clampNumber(
			Number(match[1]),
			MIN_SUPPORTED_YEAR,
			MAX_SUPPORTED_YEAR,
		);
		const month = clampNumber(Number(match[2]), 1, 12);
		const day = clampNumber(Number(match[3]), 1, daysInMonth(year, month));
		return { year, month, day };
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return null;
	return {
		year: clampNumber(
			parsed.getFullYear(),
			MIN_SUPPORTED_YEAR,
			MAX_SUPPORTED_YEAR,
		),
		month: parsed.getMonth() + 1,
		day: parsed.getDate(),
	};
}

function compareDates(a: CalendarDate, b: CalendarDate) {
	if (a.year !== b.year) return a.year - b.year;
	if (a.month !== b.month) return a.month - b.month;
	return a.day - b.day;
}

function equalDates(a: CalendarDate, b: CalendarDate) {
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

function clampCalendarDate(
	date: CalendarDate,
	min: CalendarDate | null,
	max: CalendarDate | null,
): CalendarDate {
	const year = clampNumber(date.year, MIN_SUPPORTED_YEAR, MAX_SUPPORTED_YEAR);
	const month = clampNumber(date.month, 1, 12);
	const day = clampNumber(date.day, 1, daysInMonth(year, month));
	let normalized: CalendarDate = { year, month, day };
	if (min && compareDates(normalized, min) < 0) normalized = min;
	if (max && compareDates(normalized, max) > 0) normalized = max;
	return normalized;
}

function toLocalDate(date: CalendarDate) {
	return new Date(date.year, date.month - 1, date.day);
}

function toIsoDate(date: CalendarDate) {
	return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function stepCalendarPart(
	current: CalendarDate,
	part: DatePart,
	delta: number,
	rollover: boolean,
	min: CalendarDate | null,
	max: CalendarDate | null,
): {
	next: CalendarDate;
	changed: boolean;
	hitLimit: boolean;
	crossedBoundary: boolean;
} {
	if (delta === 0) {
		return {
			next: current,
			changed: false,
			hitLimit: false,
			crossedBoundary: false,
		};
	}

	let candidate: CalendarDate;
	let hitLimit = false;
	let crossedBoundary = false;

	if (part === "day") {
		if (rollover) {
			const shifted = new Date(
				Date.UTC(current.year, current.month - 1, current.day + delta),
			);
			candidate = {
				year: shifted.getUTCFullYear(),
				month: shifted.getUTCMonth() + 1,
				day: shifted.getUTCDate(),
			};
			crossedBoundary =
				candidate.month !== current.month || candidate.year !== current.year;
		} else {
			const maxDay = daysInMonth(current.year, current.month);
			const nextDay = clampNumber(current.day + delta, 1, maxDay);
			if (nextDay === current.day) hitLimit = true;
			candidate = { ...current, day: nextDay };
		}
	} else if (part === "month") {
		if (rollover) {
			const totalMonths = current.year * 12 + (current.month - 1) + delta;
			const nextYear = Math.floor(totalMonths / 12);
			const nextMonth = (((totalMonths % 12) + 12) % 12) + 1;
			const nextDay = Math.min(current.day, daysInMonth(nextYear, nextMonth));
			candidate = { year: nextYear, month: nextMonth, day: nextDay };
			crossedBoundary = candidate.year !== current.year;
		} else {
			const nextMonth = clampNumber(current.month + delta, 1, 12);
			if (nextMonth === current.month) hitLimit = true;
			const nextDay = Math.min(
				current.day,
				daysInMonth(current.year, nextMonth),
			);
			candidate = { year: current.year, month: nextMonth, day: nextDay };
		}
	} else {
		const nextYear = clampNumber(
			current.year + delta,
			MIN_SUPPORTED_YEAR,
			MAX_SUPPORTED_YEAR,
		);
		if (nextYear === current.year) hitLimit = true;
		const nextDay = Math.min(current.day, daysInMonth(nextYear, current.month));
		candidate = { year: nextYear, month: current.month, day: nextDay };
	}

	const clamped = clampCalendarDate(candidate, min, max);
	if (!equalDates(clamped, candidate)) {
		hitLimit = true;
	}
	const changed = !equalDates(clamped, current);
	return {
		next: clamped,
		changed,
		hitLimit: hitLimit || !changed,
		crossedBoundary: changed && crossedBoundary,
	};
}

function formatPartLabel(
	date: CalendarDate,
	part: DatePart,
	monthFormat: MonthFormat,
	shortMonths: readonly string[],
) {
	if (part === "month") {
		if (monthFormat === "short") return shortMonths[date.month - 1] ?? "";
		if (monthFormat === "2-digit") return String(date.month).padStart(2, "0");
		return String(date.month);
	}
	if (part === "day") {
		return monthFormat === "2-digit"
			? String(date.day).padStart(2, "0")
			: String(date.day);
	}
	return String(date.year).padStart(4, "0");
}

function getAdjacentPartLabel(
	date: CalendarDate,
	part: DatePart,
	delta: -1 | 1,
	monthFormat: MonthFormat,
	shortMonths: readonly string[],
	rollover: boolean,
) {
	if (part === "month") {
		const raw = date.month + delta;
		const nextMonth = rollover
			? ((((raw - 1) % 12) + 12) % 12) + 1
			: clampNumber(raw, 1, 12);
		if (!rollover && raw !== nextMonth) return "·";
		return formatPartLabel(
			{ ...date, month: nextMonth },
			"month",
			monthFormat,
			shortMonths,
		);
	}
	if (part === "day") {
		if (rollover) {
			const shifted = new Date(
				Date.UTC(date.year, date.month - 1, date.day + delta),
			);
			return formatPartLabel(
				{
					year: shifted.getUTCFullYear(),
					month: shifted.getUTCMonth() + 1,
					day: shifted.getUTCDate(),
				},
				"day",
				monthFormat,
				shortMonths,
			);
		}
		const maxDay = daysInMonth(date.year, date.month);
		const raw = date.day + delta;
		if (raw < 1 || raw > maxDay) return "·";
		return formatPartLabel(
			{ ...date, day: raw },
			"day",
			monthFormat,
			shortMonths,
		);
	}
	const nextYear = date.year + delta;
	if (nextYear < MIN_SUPPORTED_YEAR || nextYear > MAX_SUPPORTED_YEAR) {
		return "·";
	}
	return String(nextYear).padStart(4, "0");
}

function getSeparator(
	order: DateOrder,
	monthFormat: MonthFormat,
	index: number,
): { text: string; compact?: boolean } | null {
	if (index >= 2) return null;
	if (monthFormat === "short") {
		if (order === "mdy") {
			return index === 1 ? { text: ",", compact: true } : null;
		}
		if (order === "ymd") {
			return { text: "·" };
		}
		return null;
	}
	return { text: order === "ymd" ? "-" : "/" };
}

interface VernierLoupeProps {
	part: DatePart;
	prevLabel: string;
	currentLabel: string;
	nextLabel: string;
	prevDisabled: boolean;
	nextDisabled: boolean;
	atLimit: boolean;
	modifier: "fine" | "coarse" | null;
	vernierOffset: MotionValue<number>;
	rubberX: MotionValue<number>;
	shiftX: number;
	reducedMotion: boolean;
}

function VernierLoupe({
	part,
	prevLabel,
	currentLabel,
	nextLabel,
	prevDisabled,
	nextDisabled,
	atLimit,
	modifier,
	vernierOffset,
	rubberX,
	shiftX,
	reducedMotion,
}: VernierLoupeProps) {
	const tickX = useTransform(vernierOffset, (value) => {
		const wrapped =
			((value % VERNIER_PERIOD_PX) + VERNIER_PERIOD_PX) % VERNIER_PERIOD_PX;
		return wrapped - VERNIER_PERIOD_PX;
	});
	const containerX = useTransform(rubberX, (value) =>
		reducedMotion ? shiftX : value * 0.65 + shiftX,
	);

	return (
		<motion.div
			aria-hidden
			data-slot="date-scrub-loupe"
			data-part={part}
			data-limit={atLimit || undefined}
			initial={
				reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 6 }
			}
			animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
			exit={
				reducedMotion
					? { opacity: 0 }
					: {
							opacity: 0,
							scale: 0.95,
							y: 4,
							transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] },
						}
			}
			transition={reducedMotion ? { duration: 0.12 } : LOUPE_SPRING}
			style={{
				x: containerX,
				transformOrigin: "bottom center",
			}}
			className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2.5 w-[148px] -translate-x-1/2 select-none overflow-hidden rounded-xl border border-border/80 bg-popover/95 px-2.5 pt-2 pb-1.5 text-popover-foreground shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:ring-white/10"
		>
			<div className="mb-1 flex items-center justify-between gap-1 font-medium text-[10px] text-muted-foreground/80 uppercase tracking-[0.06em]">
				<span>{part}</span>
				<span className="tabular-nums">
					{modifier === "coarse"
						? "Fast"
						: modifier === "fine"
							? "Fine"
							: atLimit
								? "Limit"
								: "Drag"}
				</span>
			</div>

			<div
				className="grid grid-cols-3 items-baseline text-center tabular-nums"
				style={{
					maskImage:
						"linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
					WebkitMaskImage:
						"linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
				}}
			>
				<span
					className={cn(
						"truncate font-medium text-[11px] text-muted-foreground transition-opacity duration-100",
						prevDisabled ? "opacity-25" : "opacity-65",
					)}
				>
					{prevLabel}
				</span>
				<span className="truncate font-semibold text-foreground text-xs">
					{currentLabel}
				</span>
				<span
					className={cn(
						"truncate font-medium text-[11px] text-muted-foreground transition-opacity duration-100",
						nextDisabled ? "opacity-25" : "opacity-65",
					)}
				>
					{nextLabel}
				</span>
			</div>

			<div className="relative mt-1.5 h-3.5 overflow-hidden">
				<div
					className="absolute inset-0 overflow-hidden"
					style={{
						maskImage:
							"linear-gradient(90deg, transparent 0%, black 22%, black 78%, transparent 100%)",
						WebkitMaskImage:
							"linear-gradient(90deg, transparent 0%, black 22%, black 78%, transparent 100%)",
					}}
				>
					<motion.div
						style={{ x: reducedMotion ? 0 : tickX }}
						className="flex h-full items-end gap-[7px] pl-1 will-change-transform"
					>
						{Array.from({ length: VERNIER_TICK_COUNT }, (_, index) => {
							const major = index % 5 === 0;
							return (
								<span
									key={index}
									className={cn(
										"w-px shrink-0 rounded-full",
										major ? "h-2.5 bg-foreground/45" : "h-1.5 bg-foreground/20",
									)}
								/>
							);
						})}
					</motion.div>
				</div>
				<span
					className={cn(
						"absolute bottom-0 left-1/2 h-3 w-[1.5px] -translate-x-1/2 rounded-full transition-colors duration-150",
						atLimit ? "bg-destructive" : "bg-foreground",
					)}
				/>
			</div>
		</motion.div>
	);
}

interface SegmentPillProps {
	part: DatePart;
	value: CalendarDate;
	trend: 1 | -1;
	monthFormat: MonthFormat;
	shortMonths: readonly string[];
	draft: string | null;
	active: boolean;
	focused: boolean;
	disabled: boolean;
	readOnly: boolean;
	rubberX: MotionValue<number>;
	sizeClass: string;
	reducedMotion: boolean;
	ariaMin: number;
	ariaMax: number;
	ariaValueText: string;
	segmentRef: (node: HTMLDivElement | null) => void;
	onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	onFocus: (event: FocusEvent<HTMLDivElement>) => void;
	onBlur: () => void;
	loupe: React.ReactNode;
}

function SegmentPill({
	part,
	value,
	trend,
	monthFormat,
	shortMonths,
	draft,
	active,
	focused,
	disabled,
	readOnly,
	rubberX,
	sizeClass,
	reducedMotion,
	ariaMin,
	ariaMax,
	ariaValueText,
	segmentRef,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onKeyDown,
	onFocus,
	onBlur,
	loupe,
}: SegmentPillProps) {
	const numericValue =
		part === "month" ? value.month : part === "day" ? value.day : value.year;
	const isShortMonth = part === "month" && monthFormat === "short";
	const padDigits = part === "year" ? 4 : monthFormat === "2-digit" ? 2 : 1;

	const ariaLabel =
		part === "month" ? "Month" : part === "day" ? "Day" : "Year";

	return (
		<div className="relative inline-flex items-center">
			<AnimatePresence>{loupe}</AnimatePresence>
			<motion.div
				ref={segmentRef}
				role="spinbutton"
				tabIndex={disabled ? -1 : 0}
				aria-label={ariaLabel}
				aria-valuenow={numericValue}
				aria-valuemin={ariaMin}
				aria-valuemax={ariaMax}
				aria-valuetext={ariaValueText}
				aria-disabled={disabled || undefined}
				aria-readonly={readOnly || undefined}
				data-slot="date-scrub-segment"
				data-part={part}
				data-scrubbing={active || undefined}
				data-focused={focused || undefined}
				data-typing={draft !== null || undefined}
				style={{ x: active && !reducedMotion ? rubberX : 0 }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				onKeyDown={onKeyDown}
				onFocus={onFocus}
				onBlur={onBlur}
				onContextMenu={(event) => {
					if (!disabled && !readOnly) event.preventDefault();
				}}
				className={cn(
					"relative inline-flex pointer-coarse:min-h-10 touch-pan-y select-none items-center justify-center font-medium tabular-nums outline-none transition-[background-color,color,box-shadow,transform] duration-150",
					!disabled && !readOnly && "cursor-ew-resize active:scale-[0.97]",
					disabled && "cursor-not-allowed",
					readOnly && !disabled && "cursor-default",
					sizeClass,
					active
						? "bg-foreground text-background shadow-xs"
						: focused
							? "bg-accent text-accent-foreground ring-1 ring-ring/45"
							: !disabled && !readOnly
								? "text-foreground pointer-fine:hover:bg-muted/85"
								: "text-foreground",
				)}
			>
				{draft !== null ? (
					<span
						className="inline-flex min-w-[2ch] justify-center"
						style={
							part === "year"
								? { minWidth: "4ch" }
								: isShortMonth
									? { minWidth: "3ch" }
									: { minWidth: "2ch" }
						}
					>
						{draft}
					</span>
				) : isShortMonth ? (
					<span className="relative inline-grid place-items-center overflow-hidden">
						{shortMonths.map((monthLabel) => (
							<span
								key={monthLabel}
								aria-hidden
								className="pointer-events-none invisible col-start-1 row-start-1 whitespace-nowrap"
							>
								{monthLabel}
							</span>
						))}
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={value.month}
								initial={
									reducedMotion
										? { opacity: 0.7 }
										: { y: trend > 0 ? "75%" : "-75%", opacity: 0 }
								}
								animate={{ y: "0%", opacity: 1 }}
								exit={
									reducedMotion
										? { opacity: 0 }
										: { y: trend > 0 ? "-75%" : "75%", opacity: 0 }
								}
								transition={
									reducedMotion
										? { duration: 0.08 }
										: { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
								}
								className="col-start-1 row-start-1 whitespace-nowrap"
							>
								{shortMonths[value.month - 1]}
							</motion.span>
						</AnimatePresence>
					</span>
				) : (
					<span className="inline-grid place-items-center">
						<span
							aria-hidden
							className="pointer-events-none invisible col-start-1 row-start-1"
						>
							{part === "year" ? "8888" : "88"}
						</span>
						<NumberFlow
							aria-hidden
							value={numericValue}
							format={{
								useGrouping: false,
								minimumIntegerDigits: padDigits,
							}}
							trend={trend}
							animated={!reducedMotion}
							respectMotionPreference={false}
							transformTiming={DIGIT_TIMING}
							spinTiming={DIGIT_TIMING}
							className="pointer-events-none col-start-1 row-start-1"
						/>
					</span>
				)}
			</motion.div>
		</div>
	);
}

export function DateScrubField({
	value: valueProp,
	defaultValue,
	onValueChange,
	onValueCommit,
	min: minProp,
	max: maxProp,
	order = "mdy",
	monthFormat = "short",
	locale = "en-US",
	sensitivity = 18,
	rollover = true,
	showIcon = true,
	showWeekday = true,
	showLoupe = true,
	wheel = false,
	size = "md",
	variant = "outline",
	sound = true,
	haptics = true,
	disabled = false,
	readOnly = false,
	name,
	label = "Date",
	className,
}: DateScrubFieldProps) {
	const inactive = disabled || readOnly;
	const minDate = useMemo(() => parseDateValue(minProp), [minProp]);
	const maxDate = useMemo(() => parseDateValue(maxProp), [maxProp]);

	const controlled = valueProp !== undefined;
	const [internalDate, setInternalDate] = useState<CalendarDate>(() =>
		clampCalendarDate(
			parseDateValue(defaultValue) ?? DEFAULT_CALENDAR_DATE,
			minDate,
			maxDate,
		),
	);

	const date = useMemo(() => {
		if (!controlled) {
			return clampCalendarDate(internalDate, minDate, maxDate);
		}
		return clampCalendarDate(
			parseDateValue(valueProp) ?? DEFAULT_CALENDAR_DATE,
			minDate,
			maxDate,
		);
	}, [controlled, valueProp, internalDate, minDate, maxDate]);

	const [trends, setTrends] = useState<Record<DatePart, 1 | -1>>({
		month: 1,
		day: 1,
		year: 1,
	});
	const [scrubbingPart, setScrubbingPart] = useState<DatePart | null>(null);
	const [focusedPart, setFocusedPart] = useState<DatePart | null>(null);
	const [atLimit, setAtLimit] = useState(false);
	const [modifier, setModifier] = useState<"fine" | "coarse" | null>(null);
	const [loupeShiftX, setLoupeShiftX] = useState(0);
	const [draft, setDraft] = useState<{ part: DatePart; text: string } | null>(
		null,
	);
	const [announcement, setAnnouncement] = useState("");

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		toggle: playToggle,
	} = useTiks({ respectReducedMotion: false });

	const groupId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const segmentRefs = useRef<Record<DatePart, HTMLDivElement | null>>({
		month: null,
		day: null,
		year: null,
	});
	const dateRef = useRef(date);
	const draftRef = useRef<{ part: DatePart; text: string } | null>(null);
	const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const announcedIsoRef = useRef(toIsoDate(date));

	const vernierOffset = useMotionValue(0);
	const rubberX = useMotionValue(0);

	const dragRef = useRef<{
		pointerId: number;
		part: DatePart;
		startX: number;
		startY: number;
		lastX: number;
		accumulatedPx: number;
		overshootPx: number;
		hasDragged: boolean;
		didChange: boolean;
		wallHit: boolean;
		cancelled: boolean;
	} | null>(null);

	useLayoutEffect(() => {
		dateRef.current = date;
	});

	const shortMonths = useMemo(() => {
		const formatter = new Intl.DateTimeFormat(locale, {
			month: "short",
			timeZone: "UTC",
		});
		return Array.from({ length: 12 }, (_, index) =>
			formatter.format(new Date(Date.UTC(2026, index, 15))),
		);
	}, [locale]);

	const weekdayFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				weekday: "short",
				timeZone: "UTC",
			}),
		[locale],
	);

	const fullDateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				weekday: "long",
				month: "long",
				day: "numeric",
				year: "numeric",
				timeZone: "UTC",
			}),
		[locale],
	);

	const shortWeekdays = useMemo(
		() =>
			Array.from({ length: 7 }, (_, index) =>
				weekdayFormatter.format(new Date(Date.UTC(2026, 0, 4 + index))),
			),
		[weekdayFormatter],
	);

	const weekdayText = useMemo(
		() =>
			weekdayFormatter.format(
				new Date(Date.UTC(date.year, date.month - 1, date.day)),
			),
		[weekdayFormatter, date.year, date.month, date.day],
	);

	const fullDateText = useMemo(
		() =>
			fullDateFormatter.format(
				new Date(Date.UTC(date.year, date.month - 1, date.day)),
			),
		[fullDateFormatter, date.year, date.month, date.day],
	);

	const parts = PART_ORDER[order];
	const isoValue = toIsoDate(date);

	const playCue = useCallback(
		(kind: "step" | "boundary" | "limit") => {
			const now = performance.now();
			if (kind !== "limit" && now - lastCueAtRef.current < CUE_THROTTLE_MS) {
				return;
			}
			lastCueAtRef.current = now;
			if (kind === "limit") {
				if (sound) playPop();
				if (haptics) void haptic("rigid");
			} else if (kind === "boundary") {
				if (sound) playToggle(true);
				if (haptics) void haptic("light");
			} else {
				if (sound) playClick();
				if (haptics) void haptic("selection");
			}
		},
		[sound, haptics, playClick, playPop, playToggle, haptic],
	);

	const clearDraftTimer = useCallback(() => {
		if (draftTimerRef.current) {
			clearTimeout(draftTimerRef.current);
			draftTimerRef.current = null;
		}
	}, []);

	const updateDraft = useCallback(
		(next: { part: DatePart; text: string } | null) => {
			draftRef.current = next;
			setDraft(next);
		},
		[],
	);

	const emitDate = useCallback(
		(next: CalendarDate, changedPart?: DatePart, direction?: 1 | -1) => {
			const prev = dateRef.current;
			if (equalDates(next, prev)) return false;

			setTrends((current) => ({
				month:
					next.month !== prev.month
						? next.month > prev.month
							? 1
							: -1
						: changedPart === "month" && direction
							? direction
							: current.month,
				day:
					next.day !== prev.day
						? next.day > prev.day
							? 1
							: -1
						: changedPart === "day" && direction
							? direction
							: current.day,
				year:
					next.year !== prev.year
						? next.year > prev.year
							? 1
							: -1
						: changedPart === "year" && direction
							? direction
							: current.year,
			}));

			dateRef.current = next;
			if (!controlled) setInternalDate(next);
			onValueChange?.(toLocalDate(next), toIsoDate(next));
			return true;
		},
		[controlled, onValueChange],
	);

	const commitCurrentDraft = useCallback(
		(notifyCommit = true) => {
			clearDraftTimer();
			const activeDraft = draftRef.current;
			if (!activeDraft) return;
			updateDraft(null);

			const numeric = Number.parseInt(activeDraft.text, 10);
			if (Number.isNaN(numeric)) return;

			const current = dateRef.current;
			let candidate: CalendarDate = current;
			if (activeDraft.part === "month") {
				const clampedMonth = clampNumber(numeric, 1, 12);
				candidate = {
					year: current.year,
					month: clampedMonth,
					day: Math.min(current.day, daysInMonth(current.year, clampedMonth)),
				};
			} else if (activeDraft.part === "day") {
				const maxDay = daysInMonth(current.year, current.month);
				candidate = {
					...current,
					day: clampNumber(numeric, 1, maxDay),
				};
			} else {
				const resolvedYear =
					activeDraft.text.length <= 2 ? 2000 + numeric : numeric;
				const clampedYear = clampNumber(
					resolvedYear,
					MIN_SUPPORTED_YEAR,
					MAX_SUPPORTED_YEAR,
				);
				candidate = {
					year: clampedYear,
					month: current.month,
					day: Math.min(current.day, daysInMonth(clampedYear, current.month)),
				};
			}

			const clamped = clampCalendarDate(candidate, minDate, maxDate);
			if (emitDate(clamped, activeDraft.part)) {
				playCue("step");
				if (notifyCommit) {
					onValueCommit?.(toLocalDate(clamped), toIsoDate(clamped));
				}
			}
		},
		[
			clearDraftTimer,
			updateDraft,
			minDate,
			maxDate,
			emitDate,
			playCue,
			onValueCommit,
		],
	);

	const stepPart = useCallback(
		(part: DatePart, delta: number, commitAfter = false) => {
			if (inactive) return { changed: false, hitLimit: false };
			if (draftRef.current) commitCurrentDraft(false);

			const result = stepCalendarPart(
				dateRef.current,
				part,
				delta,
				rollover,
				minDate,
				maxDate,
			);

			if (result.changed) {
				emitDate(result.next, part, delta > 0 ? 1 : -1);
				playCue(
					result.hitLimit
						? "limit"
						: result.crossedBoundary
							? "boundary"
							: "step",
				);
				if (commitAfter) {
					onValueCommit?.(toLocalDate(result.next), toIsoDate(result.next));
				}
			} else if (result.hitLimit) {
				playCue("limit");
			}

			return { changed: result.changed, hitLimit: result.hitLimit };
		},
		[
			inactive,
			commitCurrentDraft,
			rollover,
			minDate,
			maxDate,
			emitDate,
			playCue,
			onValueCommit,
		],
	);

	const computeLoupeShift = useCallback((part: DatePart) => {
		const node = segmentRefs.current[part];
		if (!node || typeof window === "undefined") {
			setLoupeShiftX(0);
			return;
		}
		const rect = node.getBoundingClientRect();
		const center = rect.left + rect.width / 2;
		const minCenter = LOUPE_HALF_WIDTH + LOUPE_VIEWPORT_MARGIN;
		const maxCenter =
			window.innerWidth - LOUPE_HALF_WIDTH - LOUPE_VIEWPORT_MARGIN;
		if (center < minCenter) {
			setLoupeShiftX(minCenter - center);
		} else if (center > maxCenter) {
			setLoupeShiftX(maxCenter - center);
		} else {
			setLoupeShiftX(0);
		}
	}, []);

	const restoreGlobalCursor = useCallback(() => {
		if (typeof document !== "undefined") {
			document.documentElement.style.removeProperty("cursor");
			document.documentElement.style.removeProperty("user-select");
		}
	}, []);

	const endScrub = useCallback(
		(focusOnClick: boolean) => {
			const drag = dragRef.current;
			if (!drag) return;
			dragRef.current = null;
			restoreGlobalCursor();
			setScrubbingPart(null);
			setAtLimit(false);
			setModifier(null);

			if (!shouldReduceMotion) {
				void animate(rubberX, 0, RUBBER_RELEASE_SPRING);
			} else {
				rubberX.set(0);
			}

			if (!drag.hasDragged && !drag.cancelled && focusOnClick) {
				segmentRefs.current[drag.part]?.focus();
				return;
			}

			if (drag.hasDragged && drag.didChange) {
				onValueCommit?.(
					toLocalDate(dateRef.current),
					toIsoDate(dateRef.current),
				);
			}
		},
		[restoreGlobalCursor, shouldReduceMotion, rubberX, onValueCommit],
	);

	const handleSegmentPointerDown = (
		part: DatePart,
		event: PointerEvent<HTMLDivElement>,
	) => {
		if (inactive || event.button !== 0 || dragRef.current !== null) return;
		if (draftRef.current) commitCurrentDraft(true);

		event.preventDefault();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events in tests may not register a pointerId.
		}

		dragRef.current = {
			pointerId: event.pointerId,
			part,
			startX: event.clientX,
			startY: event.clientY,
			lastX: event.clientX,
			accumulatedPx: 0,
			overshootPx: 0,
			hasDragged: false,
			didChange: false,
			wallHit: false,
			cancelled: false,
		};
	};

	const handleSegmentPointerMove = (
		part: DatePart,
		event: PointerEvent<HTMLDivElement>,
	) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId || drag.part !== part) {
			return;
		}

		const totalDx = event.clientX - drag.startX;
		const totalDy = event.clientY - drag.startY;

		if (!drag.hasDragged) {
			if (
				event.pointerType === "touch" &&
				Math.abs(totalDy) > TOUCH_VERTICAL_CANCEL_PX &&
				Math.abs(totalDy) > Math.abs(totalDx) * 1.2
			) {
				drag.cancelled = true;
				try {
					if (event.currentTarget.hasPointerCapture(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId);
					}
				} catch {
					// Ignore synthetic release errors.
				}
				endScrub(false);
				return;
			}

			if (Math.abs(totalDx) < DRAG_THRESHOLD_PX) return;

			drag.hasDragged = true;
			drag.lastX = event.clientX;
			computeLoupeShift(part);
			setScrubbingPart(part);
			segmentRefs.current[part]?.focus({ preventScroll: true });
			if (typeof document !== "undefined") {
				document.documentElement.style.cursor = "ew-resize";
				document.documentElement.style.userSelect = "none";
			}
			return;
		}

		const dx = event.clientX - drag.lastX;
		drag.lastX = event.clientX;
		if (dx === 0) return;

		const activeModifier = event.shiftKey
			? "coarse"
			: event.altKey
				? "fine"
				: null;
		setModifier(activeModifier);

		const baseSensitivity =
			Math.max(6, sensitivity) * PART_SENSITIVITY_FACTOR[part];
		const stepPx =
			activeModifier === "coarse"
				? baseSensitivity * 0.45
				: activeModifier === "fine"
					? baseSensitivity * 2.1
					: baseSensitivity;

		if (drag.overshootPx !== 0) {
			if (Math.sign(dx) === Math.sign(drag.overshootPx)) {
				drag.overshootPx += dx;
				if (!shouldReduceMotion) {
					rubberX.set(rubberband(drag.overshootPx));
				}
				setAtLimit(true);
				return;
			}
			const nextOvershoot = drag.overshootPx + dx;
			if (Math.sign(nextOvershoot) === Math.sign(drag.overshootPx)) {
				drag.overshootPx = nextOvershoot;
				if (!shouldReduceMotion) {
					rubberX.set(rubberband(drag.overshootPx));
				}
				return;
			}
			drag.overshootPx = 0;
			drag.wallHit = false;
			setAtLimit(false);
			rubberX.set(0);
			drag.accumulatedPx += nextOvershoot;
		} else {
			drag.accumulatedPx += dx;
		}

		vernierOffset.set(vernierOffset.get() + dx);

		while (Math.abs(drag.accumulatedPx) >= stepPx) {
			const dir: 1 | -1 = drag.accumulatedPx > 0 ? 1 : -1;
			drag.accumulatedPx -= dir * stepPx;

			const result = stepCalendarPart(
				dateRef.current,
				part,
				dir,
				rollover,
				minDate,
				maxDate,
			);

			if (result.changed) {
				drag.didChange = true;
				drag.wallHit = false;
				setAtLimit(false);
				emitDate(result.next, part, dir);
				playCue(
					result.hitLimit
						? "limit"
						: result.crossedBoundary
							? "boundary"
							: "step",
				);
			} else {
				drag.overshootPx += dir * stepPx + drag.accumulatedPx;
				drag.accumulatedPx = 0;
				setAtLimit(true);
				if (!shouldReduceMotion) {
					rubberX.set(rubberband(drag.overshootPx));
				}
				if (!drag.wallHit) {
					drag.wallHit = true;
					playCue("limit");
				}
				break;
			}
		}
	};

	const handleSegmentPointerUp = (
		part: DatePart,
		event: PointerEvent<HTMLDivElement>,
	) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId || drag.part !== part) {
			return;
		}
		try {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
		} catch {
			// Ignore synthetic release errors.
		}
		endScrub(true);
	};

	const handleSegmentPointerCancel = (
		part: DatePart,
		event: PointerEvent<HTMLDivElement>,
	) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId || drag.part !== part) {
			return;
		}
		drag.cancelled = true;
		endScrub(false);
	};

	const focusAdjacentPart = useCallback(
		(current: DatePart, offset: -1 | 1) => {
			const currentIndex = parts.indexOf(current);
			const target = parts[currentIndex + offset];
			if (target) {
				segmentRefs.current[target]?.focus();
			}
		},
		[parts],
	);

	const handleSegmentKeyDown = (
		part: DatePart,
		event: KeyboardEvent<HTMLDivElement>,
	) => {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			commitCurrentDraft(true);
			focusAdjacentPart(part, -1);
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			commitCurrentDraft(true);
			focusAdjacentPart(part, 1);
			return;
		}
		if (event.key === "Escape" && draftRef.current) {
			event.preventDefault();
			clearDraftTimer();
			updateDraft(null);
			return;
		}
		if (event.key === "Enter" && draftRef.current) {
			event.preventDefault();
			commitCurrentDraft(true);
			return;
		}
		if (inactive) return;

		if (event.key === "ArrowUp" || event.key === "PageUp") {
			event.preventDefault();
			const large = event.shiftKey || event.key === "PageUp";
			const step = large ? (part === "day" ? 7 : part === "year" ? 10 : 3) : 1;
			stepPart(part, step, true);
			return;
		}
		if (event.key === "ArrowDown" || event.key === "PageDown") {
			event.preventDefault();
			const large = event.shiftKey || event.key === "PageDown";
			const step = large
				? part === "day"
					? -7
					: part === "year"
						? -10
						: -3
				: -1;
			stepPart(part, step, true);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			commitCurrentDraft(false);
			const current = dateRef.current;
			const target =
				part === "month"
					? { ...current, month: 1, day: Math.min(current.day, 31) }
					: part === "day"
						? { ...current, day: 1 }
						: {
								year: minDate?.year ?? MIN_SUPPORTED_YEAR,
								month: current.month,
								day: Math.min(
									current.day,
									daysInMonth(
										minDate?.year ?? MIN_SUPPORTED_YEAR,
										current.month,
									),
								),
							};
			const clamped = clampCalendarDate(target, minDate, maxDate);
			if (emitDate(clamped, part, -1)) {
				playCue("limit");
				onValueCommit?.(toLocalDate(clamped), toIsoDate(clamped));
			}
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			commitCurrentDraft(false);
			const current = dateRef.current;
			const target =
				part === "month"
					? { ...current, month: 12, day: Math.min(current.day, 31) }
					: part === "day"
						? { ...current, day: daysInMonth(current.year, current.month) }
						: {
								year: maxDate?.year ?? MAX_SUPPORTED_YEAR,
								month: current.month,
								day: Math.min(
									current.day,
									daysInMonth(
										maxDate?.year ?? MAX_SUPPORTED_YEAR,
										current.month,
									),
								),
							};
			const clamped = clampCalendarDate(target, minDate, maxDate);
			if (emitDate(clamped, part, 1)) {
				playCue("limit");
				onValueCommit?.(toLocalDate(clamped), toIsoDate(clamped));
			}
			return;
		}
		if (event.key === "Backspace") {
			event.preventDefault();
			if (draftRef.current && draftRef.current.part === part) {
				const trimmed = draftRef.current.text.slice(0, -1);
				if (trimmed.length === 0) {
					clearDraftTimer();
					updateDraft(null);
				} else {
					updateDraft({ part, text: trimmed });
				}
			}
			return;
		}

		// Direct digit typing on the focused segment.
		if (
			/^\d$/.test(event.key) &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		) {
			event.preventDefault();
			clearDraftTimer();
			const existing =
				draftRef.current && draftRef.current.part === part
					? draftRef.current.text
					: "";
			const nextText = `${existing}${event.key}`;
			const numeric = Number.parseInt(nextText, 10);

			if (part === "month") {
				if (nextText.length === 1 && numeric >= 2) {
					updateDraft(null);
					const current = dateRef.current;
					const candidate = clampCalendarDate(
						{
							year: current.year,
							month: numeric,
							day: Math.min(current.day, daysInMonth(current.year, numeric)),
						},
						minDate,
						maxDate,
					);
					if (emitDate(candidate, "month")) {
						playCue("step");
						onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
					}
					focusAdjacentPart(part, 1);
					return;
				}
				if (nextText.length >= 2) {
					updateDraft(null);
					const clampedMonth = clampNumber(numeric, 1, 12);
					const current = dateRef.current;
					const candidate = clampCalendarDate(
						{
							year: current.year,
							month: clampedMonth,
							day: Math.min(
								current.day,
								daysInMonth(current.year, clampedMonth),
							),
						},
						minDate,
						maxDate,
					);
					if (emitDate(candidate, "month")) {
						playCue("step");
						onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
					}
					focusAdjacentPart(part, 1);
					return;
				}
				updateDraft({ part, text: nextText });
				draftTimerRef.current = setTimeout(
					() => commitCurrentDraft(true),
					TYPE_BUFFER_TIMEOUT_MS,
				);
				return;
			}

			if (part === "day") {
				const maxDay = daysInMonth(dateRef.current.year, dateRef.current.month);
				if (nextText.length === 1 && numeric >= 4) {
					updateDraft(null);
					const candidate = clampCalendarDate(
						{ ...dateRef.current, day: clampNumber(numeric, 1, maxDay) },
						minDate,
						maxDate,
					);
					if (emitDate(candidate, "day")) {
						playCue("step");
						onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
					}
					focusAdjacentPart(part, 1);
					return;
				}
				if (nextText.length >= 2) {
					updateDraft(null);
					const candidate = clampCalendarDate(
						{ ...dateRef.current, day: clampNumber(numeric, 1, maxDay) },
						minDate,
						maxDate,
					);
					if (emitDate(candidate, "day")) {
						playCue("step");
						onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
					}
					focusAdjacentPart(part, 1);
					return;
				}
				updateDraft({ part, text: nextText });
				draftTimerRef.current = setTimeout(
					() => commitCurrentDraft(true),
					TYPE_BUFFER_TIMEOUT_MS,
				);
				return;
			}

			// Year segment accepts up to 4 digits.
			if (nextText.length >= 4) {
				updateDraft(null);
				const clampedYear = clampNumber(
					numeric,
					MIN_SUPPORTED_YEAR,
					MAX_SUPPORTED_YEAR,
				);
				const candidate = clampCalendarDate(
					{
						year: clampedYear,
						month: dateRef.current.month,
						day: Math.min(
							dateRef.current.day,
							daysInMonth(clampedYear, dateRef.current.month),
						),
					},
					minDate,
					maxDate,
				);
				if (emitDate(candidate, "year")) {
					playCue("step");
					onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
				}
				focusAdjacentPart(part, 1);
				return;
			}
			updateDraft({ part, text: nextText });
			draftTimerRef.current = setTimeout(
				() => commitCurrentDraft(true),
				TYPE_BUFFER_TIMEOUT_MS,
			);
			return;
		}

		// Quick letter jump for short month names (e.g. "m" -> Mar/May, "o" -> Oct).
		if (
			part === "month" &&
			/^[a-zA-Z]$/.test(event.key) &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		) {
			const letter = event.key.toLowerCase();
			const start = dateRef.current.month;
			for (let offset = 1; offset <= 12; offset++) {
				const candidateIndex = (start - 1 + offset) % 12;
				if (shortMonths[candidateIndex]?.toLowerCase().startsWith(letter)) {
					event.preventDefault();
					const nextMonth = candidateIndex + 1;
					const candidate = clampCalendarDate(
						{
							year: dateRef.current.year,
							month: nextMonth,
							day: Math.min(
								dateRef.current.day,
								daysInMonth(dateRef.current.year, nextMonth),
							),
						},
						minDate,
						maxDate,
					);
					if (emitDate(candidate, "month")) {
						playCue("step");
						onValueCommit?.(toLocalDate(candidate), toIsoDate(candidate));
					}
					break;
				}
			}
		}
	};

	// Clean up global cursor and timers if unmounted or disabled mid-scrub.
	useEffect(() => {
		if (inactive && dragRef.current) {
			endScrub(false);
		}
	}, [inactive, endScrub]);

	useEffect(() => {
		const onWindowBlur = () => {
			if (dragRef.current) endScrub(false);
		};
		window.addEventListener("blur", onWindowBlur);
		return () => {
			window.removeEventListener("blur", onWindowBlur);
			clearDraftTimer();
			restoreGlobalCursor();
		};
	}, [endScrub, clearDraftTimer, restoreGlobalCursor]);

	// Optional non-passive wheel stepping while a segment is focused.
	const wheelStepRef = useRef((part: DatePart, steps: number) => {
		void part;
		void steps;
	});
	useLayoutEffect(() => {
		wheelStepRef.current = (part: DatePart, steps: number) => {
			stepPart(part, steps, true);
		};
	});

	useEffect(() => {
		const root = rootRef.current;
		if (!root || !wheel || inactive) return;
		let accumulated = 0;
		const onWheel = (event: WheelEvent) => {
			const activeEl = document.activeElement;
			const activePart = (["month", "day", "year"] as const).find(
				(part) => segmentRefs.current[part] === activeEl,
			);
			if (!activePart || event.deltaY === 0) return;
			event.preventDefault();
			let steps = 0;
			if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= WHEEL_STEP_PX) {
				steps = -Math.sign(event.deltaY);
				accumulated = 0;
			} else {
				accumulated += event.deltaY;
				steps = -Math.trunc(accumulated / WHEEL_STEP_PX);
				accumulated += steps * WHEEL_STEP_PX;
			}
			if (steps !== 0) wheelStepRef.current(activePart, steps);
		};
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	}, [wheel, inactive]);

	// Announce settled date changes politely for assistive technologies.
	useEffect(() => {
		if (isoValue === announcedIsoRef.current) return;
		const timer = setTimeout(() => {
			announcedIsoRef.current = isoValue;
			setAnnouncement(fullDateText);
		}, ANNOUNCE_DELAY_MS);
		return () => clearTimeout(timer);
	}, [isoValue, fullDateText]);

	const sizeStyle = SIZES[size];
	const variantStyle = VARIANTS[variant];

	const getPartBounds = (part: DatePart) => {
		if (part === "month") return { min: 1, max: 12 };
		if (part === "day") {
			return { min: 1, max: daysInMonth(date.year, date.month) };
		}
		return {
			min: minDate?.year ?? MIN_SUPPORTED_YEAR,
			max: maxDate?.year ?? MAX_SUPPORTED_YEAR,
		};
	};

	return (
		<div
			ref={rootRef}
			id={groupId}
			role="group"
			aria-label={label}
			aria-disabled={disabled || undefined}
			data-slot="date-scrub-field"
			data-variant={variant}
			data-size={size}
			data-order={order}
			data-state={
				scrubbingPart ? "scrubbing" : focusedPart ? "focused" : "idle"
			}
			data-scrubbing-part={scrubbingPart ?? undefined}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
			className={cn(
				"relative inline-flex w-fit max-w-full items-center transition-[border-color,box-shadow,background-color] duration-150 data-disabled:cursor-not-allowed data-disabled:opacity-50",
				sizeStyle.root,
				variantStyle,
				className,
			)}
		>
			{showIcon ? (
				<Calendar
					aria-hidden
					data-slot="date-scrub-icon"
					className={cn(
						"shrink-0 transition-colors duration-150",
						sizeStyle.icon,
						scrubbingPart || focusedPart
							? "text-foreground"
							: "text-muted-foreground/75",
					)}
				/>
			) : null}

			<div
				data-slot="date-scrub-segments"
				className="inline-flex items-center gap-0.5"
			>
				{parts.map((part, index) => {
					const separator = getSeparator(order, monthFormat, index);
					const bounds = getPartBounds(part);
					const isScrubbing = scrubbingPart === part;
					const isFocused = focusedPart === part;
					const activeDraft = draft?.part === part ? draft.text : null;
					const currentLabel = formatPartLabel(
						date,
						part,
						monthFormat,
						shortMonths,
					);

					let loupeNode: React.ReactNode = null;
					if (isScrubbing && showLoupe) {
						const prevStep = stepCalendarPart(
							date,
							part,
							-1,
							rollover,
							minDate,
							maxDate,
						);
						const nextStep = stepCalendarPart(
							date,
							part,
							1,
							rollover,
							minDate,
							maxDate,
						);
						loupeNode = (
							<VernierLoupe
								key={part}
								part={part}
								prevLabel={getAdjacentPartLabel(
									date,
									part,
									-1,
									monthFormat,
									shortMonths,
									rollover,
								)}
								currentLabel={currentLabel}
								nextLabel={getAdjacentPartLabel(
									date,
									part,
									1,
									monthFormat,
									shortMonths,
									rollover,
								)}
								prevDisabled={!prevStep.changed}
								nextDisabled={!nextStep.changed}
								atLimit={atLimit}
								modifier={modifier}
								vernierOffset={vernierOffset}
								rubberX={rubberX}
								shiftX={loupeShiftX}
								reducedMotion={shouldReduceMotion}
							/>
						);
					}

					return (
						<div key={part} className="inline-flex items-center">
							<SegmentPill
								part={part}
								value={date}
								trend={trends[part]}
								monthFormat={monthFormat}
								shortMonths={shortMonths}
								draft={activeDraft}
								active={isScrubbing}
								focused={isFocused}
								disabled={disabled}
								readOnly={readOnly}
								rubberX={rubberX}
								sizeClass={sizeStyle.segment}
								reducedMotion={shouldReduceMotion}
								ariaMin={bounds.min}
								ariaMax={bounds.max}
								ariaValueText={currentLabel}
								segmentRef={(node) => {
									segmentRefs.current[part] = node;
								}}
								onPointerDown={(event) => handleSegmentPointerDown(part, event)}
								onPointerMove={(event) => handleSegmentPointerMove(part, event)}
								onPointerUp={(event) => handleSegmentPointerUp(part, event)}
								onPointerCancel={(event) =>
									handleSegmentPointerCancel(part, event)
								}
								onKeyDown={(event) => handleSegmentKeyDown(part, event)}
								onFocus={() => setFocusedPart(part)}
								onBlur={() => {
									setFocusedPart((current) =>
										current === part ? null : current,
									);
									if (draftRef.current?.part === part) {
										commitCurrentDraft(true);
									}
								}}
								loupe={loupeNode}
							/>
							{separator ? (
								<span
									aria-hidden
									data-slot="date-scrub-separator"
									className={cn(
										"select-none text-muted-foreground/55",
										separator.compact ? "mr-1 -ml-0.5" : "px-0.5",
									)}
								>
									{separator.text}
								</span>
							) : null}
						</div>
					);
				})}
			</div>

			{showWeekday ? (
				<div
					aria-hidden
					data-slot="date-scrub-weekday"
					className={cn(
						"ml-0.5 inline-flex shrink-0 items-center border-border/75 border-l font-medium text-muted-foreground/80 tabular-nums",
						sizeStyle.weekday,
					)}
				>
					<span className="inline-grid place-items-center text-center">
						{shortWeekdays.map((dayLabel) => (
							<span
								key={dayLabel}
								aria-hidden
								className="pointer-events-none invisible col-start-1 row-start-1 whitespace-nowrap"
							>
								{dayLabel}
							</span>
						))}
						<span className="col-start-1 row-start-1 whitespace-nowrap">
							{weekdayText}
						</span>
					</span>
				</div>
			) : null}

			{name ? (
				<input type="hidden" name={name} value={isoValue} disabled={disabled} />
			) : null}

			<span aria-live="polite" aria-atomic className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export default DateScrubField;
