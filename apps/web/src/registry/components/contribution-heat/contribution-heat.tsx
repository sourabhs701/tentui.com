"use client";

import {
	AnimatePresence,
	MotionConfig,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

export type ContributionHeatLevel = 0 | 1 | 2 | 3 | 4;
export type ContributionHeatTone = "emerald" | "graphite" | "amber" | "cobalt";
export type ContributionHeatVariant = "card" | "plain";
export type ContributionHeatSize = "sm" | "md" | "lg";

export interface ContributionHeatDay {
	/** ISO calendar date (`YYYY-MM-DD`). */
	date: string;
	/** Non-negative activity count recorded on this day. */
	count: number;
	/** Optional explicit intensity level (`0`–`4`). Auto-derived from thresholds when omitted. */
	level?: ContributionHeatLevel;
	/** Optional short note shown in the day readout (for example, a release or milestone). */
	label?: string;
}

export interface ContributionHeatResolvedDay extends ContributionHeatDay {
	/** Resolved intensity level (`0`–`4`). */
	level: ContributionHeatLevel;
	/** 0-indexed week column in the rendered grid. */
	weekIndex: number;
	/** 0-indexed weekday row (`0`–`6`) in the rendered grid. */
	dayIndex: number;
	/** Whether this date falls outside the requested `[startDate, endDate]` bounds. */
	outside: boolean;
}

export interface ContributionHeatSummary {
	/** Sum of counts across all in-range days. */
	total: number;
	/** Number of in-range days with `count > 0`. */
	activeDays: number;
	/** Total number of in-range calendar days. */
	totalDays: number;
	/** Longest consecutive run of days with `count > 0`. */
	longestStreak: number;
	/** Highest single-day count in the range, or `null` when empty. */
	peakDay: ContributionHeatResolvedDay | null;
	/** First in-range ISO date (`YYYY-MM-DD`). */
	startDate: string;
	/** Last in-range ISO date (`YYYY-MM-DD`). */
	endDate: string;
}

export interface ContributionHeatReadoutState {
	/** Currently inspected day (hovered, keyboard-focused, or pinned), or `null` at rest. */
	activeDay: ContributionHeatResolvedDay | null;
	/** Currently pinned/selected day, or `null` when nothing is pinned. */
	selectedDay: ContributionHeatResolvedDay | null;
	/** Whether `activeDay` is pinned. */
	isPinned: boolean;
	/** Active legend intensity filter (`0`–`4`), or `null` when unfiltered. */
	filteredLevel: ContributionHeatLevel | null;
	/** Period summary metrics for the rendered range. */
	summary: ContributionHeatSummary;
}

export interface ContributionHeatClassNames {
	/** Outer component root container. */
	root?: string;
	/** Header container holding the day-by-day readout and contextual badge. */
	header?: string;
	/** Primary readout text region. */
	readout?: string;
	/** Horizontally scrollable viewport wrapping the calendar grid. */
	gridViewport?: string;
	/** Interactive calendar cell grid container. */
	grid?: string;
	/** Individual day cell button. */
	cell?: string;
	/** Floating optical hover loupe ring. */
	loupe?: string;
	/** Footer row containing summary context and intensity legend. */
	footer?: string;
	/** Legend swatch strip (`Less` ... `More`). */
	legend?: string;
}

export interface ContributionHeatProps
	extends Omit<
		ComponentProps<"section">,
		"children" | "onChange" | "defaultValue"
	> {
	/** Activity records keyed by ISO date (`YYYY-MM-DD`). Missing dates auto-fill as `0`. */
	data: ContributionHeatDay[];
	/** Optional inclusive start ISO date (`YYYY-MM-DD`). */
	startDate?: string;
	/** Optional inclusive end ISO date (`YYYY-MM-DD`). */
	endDate?: string;
	/** Number of weeks to display when `startDate` is omitted. Defaults to the data span (fallback 26). */
	weeks?: number;
	/** First day of each week column: `0` for Sunday (default) or `1` for Monday. */
	weekStartsOn?: 0 | 1;
	/** Optional 4-value threshold tuple `[l1, l2, l3, l4]` mapping positive counts to levels `1`–`4`. */
	thresholds?: [number, number, number, number];
	/** Curated 5-step color ramp. Defaults to `"emerald"`. */
	tone?: ContributionHeatTone;
	/** Container presentation style. Defaults to `"card"`. */
	variant?: ContributionHeatVariant;
	/** Cell geometry and typography scale. Defaults to `"md"`. */
	size?: ContributionHeatSize;
	/** Controlled pinned/selected ISO date (`YYYY-MM-DD`), or `null`. */
	value?: string | null;
	/** Initial pinned/selected ISO date when uncontrolled. */
	defaultValue?: string | null;
	/** Called whenever a day is pinned or unpinned. */
	onValueChange?: (day: ContributionHeatDay | null) => void;
	/** Called as pointer hover or keyboard focus moves between days. */
	onActiveDayChange?: (day: ContributionHeatDay | null) => void;
	/** Show the spring-driven optical hover loupe over the grid. Defaults to `true`. */
	loupe?: boolean;
	/** Show month labels aligned above week columns. Defaults to `true`. */
	showMonthLabels?: boolean;
	/** Show compact weekday labels (`Mon`, `Wed`, `Fri`) beside rows. Defaults to `true`. */
	showWeekdayLabels?: boolean;
	/** Show the interactive `Less`–`More` intensity legend below the grid. Defaults to `true`. */
	showLegend?: boolean;
	/** Show the integrated day-by-day readout header. Defaults to `true`. */
	showReadout?: boolean;
	/** Unit label for counts: a single string or `[singular, plural]`. Defaults to `["contribution", "contributions"]`. */
	unit?: string | [string, string];
	/** Optional idle period label shown beside the total (for example, `"Last 20 weeks"`). */
	summaryLabel?: string;
	/** Custom formatter for day dates in the readout and accessible labels. */
	formatDate?: (date: Date, iso: string) => string;
	/** Custom renderer for the readout bar. */
	renderReadout?: (state: ContributionHeatReadoutState) => ReactNode;
	/** Slot-level class overrides. */
	classNames?: ContributionHeatClassNames;
}

interface SizeMetrics {
	cell: number;
	gap: number;
	radius: number;
	loupeSize: number;
	magnification: number;
	weekdayWidth: number;
	monthText: string;
	readoutText: string;
	metaText: string;
	cardPadding: string;
}

const SIZE_METRICS: Record<ContributionHeatSize, SizeMetrics> = {
	sm: {
		cell: 10,
		gap: 3,
		radius: 2.5,
		loupeSize: 58,
		magnification: 1.72,
		weekdayWidth: 26,
		monthText: "text-[10px]",
		readoutText: "text-xs",
		metaText: "text-[11px]",
		cardPadding: "p-3.5",
	},
	md: {
		cell: 12,
		gap: 3,
		radius: 3,
		loupeSize: 68,
		magnification: 1.68,
		weekdayWidth: 28,
		monthText: "text-[11px]",
		readoutText: "text-[13px]",
		metaText: "text-xs",
		cardPadding: "p-4",
	},
	lg: {
		cell: 14,
		gap: 4,
		radius: 3.5,
		loupeSize: 78,
		magnification: 1.62,
		weekdayWidth: 30,
		monthText: "text-xs",
		readoutText: "text-sm",
		metaText: "text-xs",
		cardPadding: "p-5",
	},
};

interface TonePalette {
	cells: Record<ContributionHeatLevel, string>;
	loupeText: Record<ContributionHeatLevel, string>;
	accentDot: string;
	focusRing: string;
	focalRing: string;
}

const TONE_PALETTES: Record<ContributionHeatTone, TonePalette> = {
	emerald: {
		cells: {
			0: "bg-zinc-100 ring-zinc-950/[0.06] dark:bg-zinc-800/80 dark:ring-white/[0.06]",
			1: "bg-emerald-200/90 ring-emerald-700/15 dark:bg-emerald-950/95 dark:ring-emerald-400/20",
			2: "bg-emerald-400/85 ring-emerald-800/15 dark:bg-emerald-800/95 dark:ring-emerald-400/20",
			3: "bg-emerald-600 ring-emerald-950/15 dark:bg-emerald-600/95 dark:ring-emerald-300/25",
			4: "bg-emerald-800 ring-emerald-950/20 dark:bg-emerald-400 dark:ring-emerald-200/35",
		},
		loupeText: {
			0: "text-zinc-500 dark:text-zinc-400",
			1: "text-emerald-950 dark:text-emerald-200",
			2: "text-emerald-950 dark:text-emerald-50",
			3: "text-white dark:text-white",
			4: "text-white dark:text-emerald-950",
		},
		accentDot: "bg-emerald-600 dark:bg-emerald-400",
		focusRing:
			"focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-400",
		focalRing: "ring-zinc-950/80 dark:ring-white/90",
	},
	graphite: {
		cells: {
			0: "bg-zinc-100 ring-zinc-950/[0.06] dark:bg-zinc-800/75 dark:ring-white/[0.06]",
			1: "bg-zinc-300/90 ring-zinc-950/[0.08] dark:bg-zinc-700/90 dark:ring-white/[0.09]",
			2: "bg-zinc-500/85 ring-zinc-950/12 dark:bg-zinc-500/90 dark:ring-white/12",
			3: "bg-zinc-700 ring-zinc-950/15 dark:bg-zinc-300/90 dark:ring-white/20",
			4: "bg-zinc-950 ring-zinc-950/25 dark:bg-zinc-50 dark:ring-white/30",
		},
		loupeText: {
			0: "text-zinc-500 dark:text-zinc-400",
			1: "text-zinc-800 dark:text-zinc-100",
			2: "text-white dark:text-zinc-950",
			3: "text-white dark:text-zinc-950",
			4: "text-white dark:text-zinc-950",
		},
		accentDot: "bg-zinc-800 dark:bg-zinc-200",
		focusRing: "focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100",
		focalRing: "ring-zinc-950/85 dark:ring-white/90",
	},
	amber: {
		cells: {
			0: "bg-zinc-100 ring-zinc-950/[0.06] dark:bg-zinc-800/80 dark:ring-white/[0.06]",
			1: "bg-amber-200/90 ring-amber-800/15 dark:bg-amber-950/95 dark:ring-amber-400/20",
			2: "bg-amber-400/85 ring-amber-800/15 dark:bg-amber-800/95 dark:ring-amber-400/20",
			3: "bg-amber-600 ring-amber-950/15 dark:bg-amber-600/95 dark:ring-amber-300/25",
			4: "bg-amber-800 ring-amber-950/20 dark:bg-amber-400 dark:ring-amber-200/35",
		},
		loupeText: {
			0: "text-zinc-500 dark:text-zinc-400",
			1: "text-amber-950 dark:text-amber-200",
			2: "text-amber-950 dark:text-amber-50",
			3: "text-white dark:text-white",
			4: "text-white dark:text-amber-950",
		},
		accentDot: "bg-amber-600 dark:bg-amber-400",
		focusRing: "focus-visible:ring-amber-600 dark:focus-visible:ring-amber-400",
		focalRing: "ring-zinc-950/80 dark:ring-white/90",
	},
	cobalt: {
		cells: {
			0: "bg-zinc-100 ring-zinc-950/[0.06] dark:bg-zinc-800/80 dark:ring-white/[0.06]",
			1: "bg-blue-200/90 ring-blue-800/15 dark:bg-blue-950/95 dark:ring-blue-400/20",
			2: "bg-blue-400/85 ring-blue-800/15 dark:bg-blue-800/95 dark:ring-blue-400/20",
			3: "bg-blue-600 ring-blue-950/15 dark:bg-blue-600/95 dark:ring-blue-300/25",
			4: "bg-blue-800 ring-blue-950/20 dark:bg-blue-400 dark:ring-blue-200/35",
		},
		loupeText: {
			0: "text-zinc-500 dark:text-zinc-400",
			1: "text-blue-950 dark:text-blue-200",
			2: "text-blue-950 dark:text-blue-50",
			3: "text-white dark:text-white",
			4: "text-white dark:text-blue-950",
		},
		accentDot: "bg-blue-600 dark:bg-blue-400",
		focusRing: "focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400",
		focalRing: "ring-zinc-950/80 dark:ring-white/90",
	},
};

const LEVELS: readonly ContributionHeatLevel[] = [0, 1, 2, 3, 4];
const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const WEEKDAY_SHORT = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
] as const;

const LOUPE_SPRING = {
	stiffness: 440,
	damping: 36,
	mass: 0.62,
} as const;

const UI_EASE_OUT = [0.23, 1, 0.32, 1] as const;

function parseIsoUtc(iso: string): Date | null {
	const match = ISO_RE.exec(iso.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]) - 1;
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	return date;
}

function toIsoUtc(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function addUtcDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * MS_PER_DAY);
}

function defaultFormatDate(date: Date, includeYear = true): string {
	const weekday = WEEKDAY_SHORT[date.getUTCDay()];
	const month = MONTH_SHORT[date.getUTCMonth()];
	const day = date.getUTCDate();
	const year = date.getUTCFullYear();
	return includeYear
		? `${weekday}, ${month} ${day}, ${year}`
		: `${weekday}, ${month} ${day}`;
}

function formatCompactSpan(startIso: string, endIso: string): string {
	const start = parseIsoUtc(startIso);
	const end = parseIsoUtc(endIso);
	if (!start || !end) return "";
	const sm = MONTH_SHORT[start.getUTCMonth()];
	const em = MONTH_SHORT[end.getUTCMonth()];
	const sy = start.getUTCFullYear();
	const ey = end.getUTCFullYear();
	if (sy === ey) {
		if (sm === em) return `${sm} ${sy}`;
		return `${sm} – ${em} ${ey}`;
	}
	return `${sm} ${sy} – ${em} ${ey}`;
}

function formatCountWithUnit(
	count: number,
	unit: string | [string, string],
): string {
	const [singular, plural] = Array.isArray(unit) ? unit : [unit, `${unit}s`];
	const label = count === 1 ? singular : plural;
	if (count === 0) return `No ${plural}`;
	return `${count.toLocaleString("en-US")} ${label}`;
}

function computeThresholds(
	counts: number[],
	custom?: [number, number, number, number],
): [number, number, number, number] {
	if (custom) return custom;
	const positive = counts
		.filter((c) => Number.isFinite(c) && c > 0)
		.sort((a, b) => a - b);
	if (positive.length === 0) return [1, 2, 4, 7];

	const max = positive[positive.length - 1] ?? 1;
	if (max <= 4) {
		return [1, 2, 3, 4];
	}

	const q = (p: number) => {
		const idx = Math.min(
			positive.length - 1,
			Math.max(0, Math.floor((positive.length - 1) * p)),
		);
		return positive[idx] ?? 1;
	};

	const t1 = 1;
	const t2 = Math.max(t1 + 1, Math.round(q(0.4)));
	const t3 = Math.max(t2 + 1, Math.round(q(0.72)));
	const t4 = Math.max(t3 + 1, Math.round(q(0.9)));
	return [t1, t2, t3, t4];
}

function resolveLevel(
	count: number,
	explicit: ContributionHeatLevel | undefined,
	thresholds: [number, number, number, number],
): ContributionHeatLevel {
	if (explicit !== undefined) {
		return Math.min(
			4,
			Math.max(0, Math.round(explicit)),
		) as ContributionHeatLevel;
	}
	if (count <= 0) return 0;
	if (count >= thresholds[3]) return 4;
	if (count >= thresholds[2]) return 3;
	if (count >= thresholds[1]) return 2;
	return 1;
}

function formatLoupeCount(count: number): string {
	if (count >= 1000) {
		return `${Math.round(count / 100) / 10}k`;
	}
	if (count >= 100) {
		return "99+";
	}
	return String(count);
}

export function ContributionHeat({
	data,
	startDate,
	endDate,
	weeks,
	weekStartsOn = 0,
	thresholds: customThresholds,
	tone = "emerald",
	variant = "card",
	size = "md",
	value: controlledValue,
	defaultValue = null,
	onValueChange,
	onActiveDayChange,
	loupe = true,
	showMonthLabels = true,
	showWeekdayLabels = true,
	showLegend = true,
	showReadout = true,
	unit = ["contribution", "contributions"],
	summaryLabel,
	formatDate,
	renderReadout,
	className,
	classNames,
	"aria-label": ariaLabel = "Contribution activity",
	...props
}: ContributionHeatProps) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const gridId = useId();
	const palette = TONE_PALETTES[tone];
	const metrics = SIZE_METRICS[size];
	const step = metrics.cell + metrics.gap;

	// Build normalized calendar matrix (UTC-safe, deterministic across SSR & clients).
	const calendar = useMemo(() => {
		const byDate = new Map<
			string,
			{ count: number; level?: ContributionHeatLevel; label?: string }
		>();
		const parsedDates: Date[] = [];

		for (const item of data) {
			const parsed = parseIsoUtc(item.date);
			if (!parsed) continue;
			const iso = toIsoUtc(parsed);
			const safeCount = Number.isFinite(item.count)
				? Math.max(0, Math.round(item.count))
				: 0;
			const prev = byDate.get(iso);
			if (prev) {
				byDate.set(iso, {
					count: prev.count + safeCount,
					level: item.level ?? prev.level,
					label: item.label ?? prev.label,
				});
			} else {
				byDate.set(iso, {
					count: safeCount,
					level: item.level,
					label: item.label,
				});
				parsedDates.push(parsed);
			}
		}

		parsedDates.sort((a, b) => a.getTime() - b.getTime());

		const explicitEnd = endDate ? parseIsoUtc(endDate) : null;
		const explicitStart = startDate ? parseIsoUtc(startDate) : null;

		const resolvedEnd =
			explicitEnd ??
			parsedDates[parsedDates.length - 1] ??
			new Date(Date.UTC(2026, 10, 22));

		let resolvedStart: Date;
		if (explicitStart) {
			resolvedStart =
				explicitStart.getTime() <= resolvedEnd.getTime()
					? explicitStart
					: resolvedEnd;
		} else if (weeks !== undefined && Number.isFinite(weeks) && weeks > 0) {
			const clampedWeeks = Math.max(1, Math.min(104, Math.round(weeks)));
			resolvedStart = addUtcDays(resolvedEnd, -(clampedWeeks * 7 - 1));
		} else if (parsedDates.length > 0) {
			resolvedStart = parsedDates[0] ?? addUtcDays(resolvedEnd, -(26 * 7 - 1));
		} else {
			resolvedStart = addUtcDays(resolvedEnd, -(26 * 7 - 1));
		}

		// Align start backwards to weekStartsOn and end forwards to complete final week.
		const startOffset = (resolvedStart.getUTCDay() - weekStartsOn + 7) % 7;
		const gridStart = addUtcDays(resolvedStart, -startOffset);
		const endOffset = (weekStartsOn + 6 - resolvedEnd.getUTCDay() + 7) % 7;
		const gridEnd = addUtcDays(resolvedEnd, endOffset);

		const totalGridDays =
			Math.round((gridEnd.getTime() - gridStart.getTime()) / MS_PER_DAY) + 1;
		const weekCount = Math.max(1, Math.ceil(totalGridDays / 7));

		const rawCounts: number[] = [];
		for (const entry of byDate.values()) {
			rawCounts.push(entry.count);
		}
		const thresholds = computeThresholds(rawCounts, customThresholds);

		const days: ContributionHeatResolvedDay[] = [];
		const dayIndexByIso = new Map<string, number>();
		const levelCounts: Record<ContributionHeatLevel, number> = {
			0: 0,
			1: 0,
			2: 0,
			3: 0,
			4: 0,
		};

		let total = 0;
		let activeDays = 0;
		let totalDays = 0;
		let currentStreak = 0;
		let longestStreak = 0;
		let peakDay: ContributionHeatResolvedDay | null = null;

		for (let i = 0; i < weekCount * 7; i++) {
			const date = addUtcDays(gridStart, i);
			const iso = toIsoUtc(date);
			const weekIndex = Math.floor(i / 7);
			const dayIndex = i % 7;
			const outside =
				date.getTime() < resolvedStart.getTime() ||
				date.getTime() > resolvedEnd.getTime();
			const record = outside ? undefined : byDate.get(iso);
			const count = record?.count ?? 0;
			const level = outside
				? 0
				: resolveLevel(count, record?.level, thresholds);

			const resolvedDay: ContributionHeatResolvedDay = {
				date: iso,
				count,
				level,
				label: record?.label,
				weekIndex,
				dayIndex,
				outside,
			};

			days.push(resolvedDay);
			dayIndexByIso.set(iso, i);

			if (!outside) {
				totalDays += 1;
				levelCounts[level] += 1;
				total += count;
				if (count > 0) {
					activeDays += 1;
					currentStreak += 1;
					if (currentStreak > longestStreak) {
						longestStreak = currentStreak;
					}
					if (!peakDay || count > peakDay.count) {
						peakDay = resolvedDay;
					}
				} else {
					currentStreak = 0;
				}
			}
		}

		// Compute non-colliding month labels aligned to week columns.
		const monthLabels: Array<{ weekIndex: number; label: string }> = [];
		let lastMonth = -1;
		let lastLabelWeek = -99;
		for (let w = 0; w < weekCount; w++) {
			const firstInRange =
				days.slice(w * 7, w * 7 + 7).find((d) => !d.outside) ?? days[w * 7];
			if (!firstInRange) continue;
			const d = parseIsoUtc(firstInRange.date);
			if (!d) continue;
			const month = d.getUTCMonth();
			if (month !== lastMonth) {
				if (w - lastLabelWeek >= 2) {
					monthLabels.push({
						weekIndex: w,
						label: MONTH_SHORT[month] ?? "",
					});
					lastLabelWeek = w;
				}
				lastMonth = month;
			}
		}

		const summary: ContributionHeatSummary = {
			total,
			activeDays,
			totalDays,
			longestStreak,
			peakDay,
			startDate: toIsoUtc(resolvedStart),
			endDate: toIsoUtc(resolvedEnd),
		};

		return {
			days,
			dayIndexByIso,
			weekCount,
			monthLabels,
			levelCounts,
			summary,
		};
	}, [data, startDate, endDate, weeks, weekStartsOn, customThresholds]);

	const gridWidth =
		calendar.weekCount * metrics.cell + (calendar.weekCount - 1) * metrics.gap;
	const gridHeight = 7 * metrics.cell + 6 * metrics.gap;
	const contentWidth =
		gridWidth + (showWeekdayLabels ? metrics.weekdayWidth + 6 : 0);

	// Selection (pinned day) state: controlled or uncontrolled.
	const isControlled = controlledValue !== undefined;
	const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
		defaultValue,
	);
	const selectedIso = isControlled ? controlledValue : uncontrolledValue;

	const selectedDay = useMemo(() => {
		if (!selectedIso) return null;
		const idx = calendar.dayIndexByIso.get(selectedIso);
		if (idx === undefined) return null;
		const found = calendar.days[idx];
		return found && !found.outside ? found : null;
	}, [calendar, selectedIso]);

	const commitSelection = useCallback(
		(nextDay: ContributionHeatResolvedDay | null) => {
			const nextIso = nextDay ? nextDay.date : null;
			if (!isControlled) {
				setUncontrolledValue(nextIso);
			}
			onValueChange?.(
				nextDay
					? {
							date: nextDay.date,
							count: nextDay.count,
							level: nextDay.level,
							...(nextDay.label !== undefined ? { label: nextDay.label } : {}),
						}
					: null,
			);
		},
		[isControlled, onValueChange],
	);

	// Pointer hover, keyboard focus, and legend filter states.
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
	const [loupeVisible, setLoupeVisible] = useState(false);
	const [loupeCenter, setLoupeCenter] = useState<{
		weekIndex: number;
		dayIndex: number;
	} | null>(null);
	const [hoveredLevel, setHoveredLevel] =
		useState<ContributionHeatLevel | null>(null);
	const [pinnedLevel, setPinnedLevel] = useState<ContributionHeatLevel | null>(
		null,
	);

	// Roving tabindex anchor (defaults to selected day or latest in-range day).
	const defaultTabIndex = useMemo(() => {
		if (selectedDay) {
			return selectedDay.weekIndex * 7 + selectedDay.dayIndex;
		}
		for (let i = calendar.days.length - 1; i >= 0; i--) {
			if (!calendar.days[i]?.outside) return i;
		}
		return 0;
	}, [calendar.days, selectedDay]);

	const [rovingIndex, setRovingIndex] = useState<number>(defaultTabIndex);

	useEffect(() => {
		setRovingIndex((prev) => {
			const current = calendar.days[prev];
			if (current && !current.outside) return prev;
			return defaultTabIndex;
		});
	}, [calendar.days, defaultTabIndex]);

	const activeFilteredLevel = hoveredLevel ?? pinnedLevel;

	const activeDay = useMemo(() => {
		if (hoveredIndex !== null) {
			const day = calendar.days[hoveredIndex];
			if (day && !day.outside) return day;
		}
		if (focusedIndex !== null) {
			const day = calendar.days[focusedIndex];
			if (day && !day.outside) return day;
		}
		return selectedDay;
	}, [calendar.days, focusedIndex, hoveredIndex, selectedDay]);

	// Notify consumer whenever the active inspected day changes.
	const lastNotifiedIsoRef = useRef<string | null>(null);
	useEffect(() => {
		const nextIso = activeDay?.date ?? null;
		if (nextIso === lastNotifiedIsoRef.current) return;
		lastNotifiedIsoRef.current = nextIso;
		onActiveDayChange?.(
			activeDay
				? {
						date: activeDay.date,
						count: activeDay.count,
						level: activeDay.level,
						...(activeDay.label !== undefined
							? { label: activeDay.label }
							: {}),
					}
				: null,
		);
	}, [activeDay, onActiveDayChange]);

	// Refs for exact frame-space coordinate mapping (immune to scroll & CSS zoom).
	const frameRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const pointerDownRef = useRef<{
		pointerId: number;
		x: number;
		y: number;
	} | null>(null);
	const isPointerScrubbingRef = useRef(false);
	const suppressNextClickRef = useRef(false);

	// Motion values for the optical hover loupe:
	// - rawGridX / rawGridY are in unzoomed grid pixel coordinates.
	// - frameOffsetX / frameOffsetY convert grid coords -> outer frame coords (compensating for scrollLeft).
	const rawGridX = useMotionValue(0);
	const rawGridY = useMotionValue(0);
	const springGridX = useSpring(rawGridX, LOUPE_SPRING);
	const springGridY = useSpring(rawGridY, LOUPE_SPRING);
	const frameOffsetX = useMotionValue(0);
	const frameOffsetY = useMotionValue(0);

	const loupeX = useTransform(
		[shouldReduceMotion ? rawGridX : springGridX, frameOffsetX],
		([gx, ox]) => (gx as number) + (ox as number) - metrics.loupeSize / 2,
	);
	const loupeY = useTransform(
		[shouldReduceMotion ? rawGridY : springGridY, frameOffsetY],
		([gy, oy]) => (gy as number) + (oy as number) - metrics.loupeSize / 2,
	);
	const loupeTransform = useMotionTemplate`translate3d(${loupeX}px, ${loupeY}px, 0)`;

	const magStep = step * metrics.magnification;
	const magCell = metrics.cell * metrics.magnification;
	const innerCanvasX = useTransform(
		shouldReduceMotion ? rawGridX : springGridX,
		(gx) => metrics.loupeSize / 2 - gx * metrics.magnification,
	);
	const innerCanvasY = useTransform(
		shouldReduceMotion ? rawGridY : springGridY,
		(gy) => metrics.loupeSize / 2 - gy * metrics.magnification,
	);
	const innerCanvasTransform = useMotionTemplate`translate3d(${innerCanvasX}px, ${innerCanvasY}px, 0)`;

	const syncFrameOffset = useCallback(() => {
		const frame = frameRef.current;
		const grid = gridRef.current;
		if (!frame || !grid) return null;
		const frameRect = frame.getBoundingClientRect();
		const gridRect = grid.getBoundingClientRect();
		if (gridRect.width <= 0 || gridRect.height <= 0) return null;
		const scaleX = gridRect.width / gridWidth;
		const scaleY = gridRect.height / gridHeight;
		const offsetX = (gridRect.left - frameRect.left) / scaleX;
		const offsetY = (gridRect.top - frameRect.top) / scaleY;
		frameOffsetX.set(offsetX);
		frameOffsetY.set(offsetY);
		return { gridRect, scaleX, scaleY };
	}, [frameOffsetX, frameOffsetY, gridHeight, gridWidth]);

	const positionLoupeOnCell = useCallback(
		(day: ContributionHeatResolvedDay, snap = false) => {
			if (!loupe) return;
			syncFrameOffset();
			const cx = day.weekIndex * step + metrics.cell / 2;
			const cy = day.dayIndex * step + metrics.cell / 2;
			if (snap || !loupeVisible) {
				rawGridX.jump(cx);
				rawGridY.jump(cy);
				springGridX.jump(cx);
				springGridY.jump(cy);
			} else {
				rawGridX.set(cx);
				rawGridY.set(cy);
			}
			setLoupeCenter({ weekIndex: day.weekIndex, dayIndex: day.dayIndex });
			setLoupeVisible(true);
		},
		[
			loupe,
			loupeVisible,
			metrics.cell,
			rawGridX,
			rawGridY,
			springGridX,
			springGridY,
			step,
			syncFrameOffset,
		],
	);

	const resolvePointToDay = useCallback(
		(clientX: number, clientY: number) => {
			const geom = syncFrameOffset();
			if (!geom) return null;
			const { gridRect, scaleX, scaleY } = geom;
			const localX = (clientX - gridRect.left) / scaleX;
			const localY = (clientY - gridRect.top) / scaleY;

			if (
				localX < -metrics.gap ||
				localY < -metrics.gap ||
				localX > gridWidth + metrics.gap ||
				localY > gridHeight + metrics.gap
			) {
				return null;
			}

			const weekIndex = Math.max(
				0,
				Math.min(calendar.weekCount - 1, Math.floor(localX / step)),
			);
			const dayIndex = Math.max(0, Math.min(6, Math.floor(localY / step)));
			const idx = weekIndex * 7 + dayIndex;
			const day = calendar.days[idx];
			if (!day || day.outside) return null;

			// Gently pull loupe toward active cell center while retaining continuous sub-cell tracking.
			const cellCenterX = weekIndex * step + metrics.cell / 2;
			const cellCenterY = dayIndex * step + metrics.cell / 2;
			const clampedX = Math.max(0, Math.min(gridWidth, localX));
			const clampedY = Math.max(0, Math.min(gridHeight, localY));
			const magneticX = cellCenterX * 0.72 + clampedX * 0.28;
			const magneticY = cellCenterY * 0.72 + clampedY * 0.28;

			return { idx, day, magneticX, magneticY };
		},
		[
			calendar.days,
			calendar.weekCount,
			gridHeight,
			gridWidth,
			metrics.cell,
			metrics.gap,
			step,
			syncFrameOffset,
		],
	);

	const handleGridPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			// Gate continuous hover loupe to fine pointers unless actively pointer-scrubbing.
			if (event.pointerType === "touch" && !isPointerScrubbingRef.current) {
				return;
			}

			// Promote to captured drag-scrub only after 6px movement so normal clicks land natively on cell buttons.
			if (
				pointerDownRef.current &&
				!isPointerScrubbingRef.current &&
				Math.hypot(
					event.clientX - pointerDownRef.current.x,
					event.clientY - pointerDownRef.current.y,
				) > 6
			) {
				isPointerScrubbingRef.current = true;
				suppressNextClickRef.current = true;
				try {
					event.currentTarget.setPointerCapture(
						pointerDownRef.current.pointerId,
					);
				} catch {
					// Ignore synthetic pointer events without an active pointerId.
				}
			}

			const hit = resolvePointToDay(event.clientX, event.clientY);
			if (!hit) {
				if (!isPointerScrubbingRef.current) {
					setHoveredIndex(null);
					setLoupeVisible(false);
				}
				return;
			}

			setHoveredIndex(hit.idx);
			if (loupe) {
				if (!loupeVisible) {
					rawGridX.jump(hit.magneticX);
					rawGridY.jump(hit.magneticY);
					springGridX.jump(hit.magneticX);
					springGridY.jump(hit.magneticY);
				} else {
					rawGridX.set(hit.magneticX);
					rawGridY.set(hit.magneticY);
				}
				setLoupeCenter({
					weekIndex: hit.day.weekIndex,
					dayIndex: hit.day.dayIndex,
				});
				setLoupeVisible(true);
			}
		},
		[
			loupe,
			loupeVisible,
			rawGridX,
			rawGridY,
			resolvePointToDay,
			springGridX,
			springGridY,
		],
	);

	const handleGridPointerLeave = useCallback(() => {
		if (isPointerScrubbingRef.current) return;
		pointerDownRef.current = null;
		setHoveredIndex(null);
		setLoupeVisible(false);
	}, []);

	const handleGridPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.pointerType === "touch") return;
			if (event.button !== 0) return;
			const hit = resolvePointToDay(event.clientX, event.clientY);
			if (!hit) return;
			pointerDownRef.current = {
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			};
			isPointerScrubbingRef.current = false;
			suppressNextClickRef.current = false;
		},
		[resolvePointToDay],
	);

	const finishScrub = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
			const wasScrubbing = isPointerScrubbingRef.current;
			pointerDownRef.current = null;
			isPointerScrubbingRef.current = false;
			if (!wasScrubbing) return;
			try {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}
			} catch {
				// Ignore if capture was already released.
			}
			if (commit) {
				const hit = resolvePointToDay(event.clientX, event.clientY);
				if (hit) {
					commitSelection(hit.day);
				}
			}
			// Reset click suppression on next tick in case browser skips click after capture.
			window.setTimeout(() => {
				suppressNextClickRef.current = false;
			}, 0);
		},
		[commitSelection, resolvePointToDay],
	);

	const handleViewportScroll = useCallback(() => {
		syncFrameOffset();
	}, [syncFrameOffset]);

	const handleCellClick = useCallback(
		(day: ContributionHeatResolvedDay, isTouchLike: boolean) => {
			if (suppressNextClickRef.current) {
				suppressNextClickRef.current = false;
				return;
			}
			const isAlreadySelected = selectedIso === day.date;
			if (isAlreadySelected) {
				commitSelection(null);
				if (isTouchLike) {
					setHoveredIndex(null);
					setLoupeVisible(false);
				}
			} else {
				commitSelection(day);
				setRovingIndex(day.weekIndex * 7 + day.dayIndex);
				if (isTouchLike && loupe) {
					setHoveredIndex(day.weekIndex * 7 + day.dayIndex);
					positionLoupeOnCell(day, true);
				}
			}
		},
		[commitSelection, loupe, positionLoupeOnCell, selectedIso],
	);

	// Safeguard against missed pointerleave on fast flicks or window exits, and hide touch loupe on outside tap.
	useEffect(() => {
		if (!loupeVisible) return;
		const handleOutsideDown = (event: PointerEvent) => {
			if (event.pointerType !== "touch") return;
			if (frameRef.current?.contains(event.target as Node)) return;
			setHoveredIndex(null);
			setLoupeVisible(false);
		};
		const handleWindowPointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch" || isPointerScrubbingRef.current)
				return;
			const rect = gridRef.current?.getBoundingClientRect();
			if (!rect) return;
			const pad = metrics.gap + 2;
			if (
				event.clientX < rect.left - pad ||
				event.clientX > rect.right + pad ||
				event.clientY < rect.top - pad ||
				event.clientY > rect.bottom + pad
			) {
				setHoveredIndex(null);
				setLoupeVisible(false);
			}
		};
		const handleWindowBlur = () => {
			setHoveredIndex(null);
			setLoupeVisible(false);
		};
		window.addEventListener("pointerdown", handleOutsideDown, {
			passive: true,
		});
		window.addEventListener("pointermove", handleWindowPointerMove, {
			passive: true,
		});
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("pointerdown", handleOutsideDown);
			window.removeEventListener("pointermove", handleWindowPointerMove);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [loupeVisible, metrics.gap]);

	// Keyboard navigation: roving tabindex with instant response (no sluggish animation).
	const focusCellByIndex = useCallback(
		(targetIndex: number, stepDir: 1 | -1) => {
			let idx = Math.max(0, Math.min(calendar.days.length - 1, targetIndex));
			while (
				idx >= 0 &&
				idx < calendar.days.length &&
				calendar.days[idx]?.outside
			) {
				idx += stepDir;
			}
			const target = calendar.days[idx];
			if (!target || target.outside) return;
			setRovingIndex(idx);
			setFocusedIndex(idx);
			setHoveredIndex(null);
			setLoupeVisible(false);
			cellRefs.current[idx]?.focus();
		},
		[calendar.days],
	);

	const handleCellKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>, idx: number) => {
			switch (event.key) {
				case "ArrowRight":
					event.preventDefault();
					focusCellByIndex(idx + 7, 1);
					break;
				case "ArrowLeft":
					event.preventDefault();
					focusCellByIndex(idx - 7, -1);
					break;
				case "ArrowDown":
					event.preventDefault();
					focusCellByIndex(idx + 1, 1);
					break;
				case "ArrowUp":
					event.preventDefault();
					focusCellByIndex(idx - 1, -1);
					break;
				case "PageDown":
					event.preventDefault();
					focusCellByIndex(idx + 28, 1);
					break;
				case "PageUp":
					event.preventDefault();
					focusCellByIndex(idx - 28, -1);
					break;
				case "Home":
					event.preventDefault();
					focusCellByIndex(0, 1);
					break;
				case "End":
					event.preventDefault();
					focusCellByIndex(calendar.days.length - 1, -1);
					break;
				case "Escape":
					if (selectedIso !== null || pinnedLevel !== null) {
						event.preventDefault();
						commitSelection(null);
						setPinnedLevel(null);
					}
					break;
				default:
					break;
			}
		},
		[
			calendar.days.length,
			commitSelection,
			focusCellByIndex,
			pinnedLevel,
			selectedIso,
		],
	);

	// 5x5 local neighborhood rendered inside the optical loupe canvas.
	const loupePatch = useMemo(() => {
		if (!loupeCenter) return [];
		const items: ContributionHeatResolvedDay[] = [];
		for (let dw = -2; dw <= 2; dw++) {
			const w = loupeCenter.weekIndex + dw;
			if (w < 0 || w >= calendar.weekCount) continue;
			for (let dd = -2; dd <= 2; dd++) {
				const d = loupeCenter.dayIndex + dd;
				if (d < 0 || d > 6) continue;
				const cell = calendar.days[w * 7 + d];
				if (cell && !cell.outside) {
					items.push(cell);
				}
			}
		}
		return items;
	}, [calendar.days, calendar.weekCount, loupeCenter]);

	const spansMultipleYears =
		calendar.summary.startDate.slice(0, 4) !==
		calendar.summary.endDate.slice(0, 4);

	const formatDayLabel = useCallback(
		(day: ContributionHeatResolvedDay, compact = false) => {
			const date = parseIsoUtc(day.date);
			if (!date) return day.date;
			if (formatDate) return formatDate(date, day.date);
			return defaultFormatDate(date, !compact || spansMultipleYears);
		},
		[formatDate, spansMultipleYears],
	);

	const weekdayLabels = useMemo(() => {
		const order =
			weekStartsOn === 1
				? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
				: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const visibleRows =
			weekStartsOn === 1 ? new Set([0, 2, 4]) : new Set([1, 3, 5]);
		return order.map((label, idx) => (visibleRows.has(idx) ? label : ""));
	}, [weekStartsOn]);

	const readoutState: ContributionHeatReadoutState = {
		activeDay,
		selectedDay,
		isPinned: Boolean(selectedDay && activeDay?.date === selectedDay.date),
		filteredLevel: activeFilteredLevel,
		summary: calendar.summary,
	};

	const isCard = variant === "card";
	const idleRangeText =
		summaryLabel ??
		formatCompactSpan(calendar.summary.startDate, calendar.summary.endDate);

	return (
		<MotionConfig reducedMotion="user">
			<section
				aria-label={ariaLabel}
				data-slot="contribution-heat"
				data-tone={tone}
				data-variant={variant}
				data-size={size}
				className={cn(
					"relative w-fit max-w-full select-none text-foreground",
					isCard &&
						cn(
							"rounded-2xl border border-border/80 bg-card/95 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-card/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.28)]",
							metrics.cardPadding,
						),
					className,
					classNames?.root,
				)}
				{...props}
			>
				{showReadout && (
					<div
						data-slot="contribution-heat-header"
						className={cn(
							"mb-3 flex min-h-6 items-center justify-between gap-x-3",
							classNames?.header,
						)}
						style={{ width: contentWidth, maxWidth: "100%" }}
					>
						<div
							data-slot="contribution-heat-readout"
							aria-live="polite"
							aria-atomic="true"
							className={cn(
								"flex min-w-0 flex-1 items-center gap-2",
								metrics.readoutText,
								classNames?.readout,
							)}
						>
							{renderReadout ? (
								renderReadout(readoutState)
							) : activeDay ? (
								<>
									<span
										aria-hidden="true"
										className={cn(
											"inline-block size-2.5 shrink-0 rounded-[3px] ring-1 ring-inset transition-colors duration-150",
											palette.cells[activeDay.level],
										)}
									/>
									<span className="truncate leading-none">
										<span className="font-semibold text-foreground tabular-nums">
											{formatCountWithUnit(activeDay.count, unit)}
										</span>
										<span
											aria-hidden="true"
											className="mx-1.5 text-muted-foreground/50"
										>
											&middot;
										</span>
										<span className="text-muted-foreground tabular-nums">
											{formatDayLabel(activeDay, true)}
										</span>
										{activeDay.label && (
											<>
												<span
													aria-hidden="true"
													className="mx-1.5 text-muted-foreground/50"
												>
													&middot;
												</span>
												<span className="text-foreground/80">
													{activeDay.label}
												</span>
											</>
										)}
									</span>
								</>
							) : (
								<>
									<span
										aria-hidden="true"
										className={cn(
											"inline-block size-2 shrink-0 rounded-full",
											palette.accentDot,
										)}
									/>
									<span className="truncate leading-none">
										<span className="font-semibold text-foreground tabular-nums">
											{formatCountWithUnit(calendar.summary.total, unit)}
										</span>
										{idleRangeText && (
											<>
												<span
													aria-hidden="true"
													className="mx-1.5 text-muted-foreground/50"
												>
													&middot;
												</span>
												<span className="text-muted-foreground">
													{idleRangeText}
												</span>
											</>
										)}
									</span>
								</>
							)}
						</div>

						<div
							className={cn(
								"flex shrink-0 items-center gap-2",
								metrics.metaText,
							)}
						>
							{pinnedLevel !== null ? (
								<button
									type="button"
									data-slot="contribution-heat-filter-clear"
									onClick={() => setPinnedLevel(null)}
									className={cn(
										"inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-foreground/90 tabular-nums transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97]",
										palette.focusRing,
									)}
									aria-label={`Clear level ${pinnedLevel} filter`}
								>
									<span
										aria-hidden="true"
										className={cn(
											"inline-block size-2 rounded-[2px] ring-1 ring-inset",
											palette.cells[pinnedLevel],
										)}
									/>
									<span>
										L{pinnedLevel} &middot; {calendar.levelCounts[pinnedLevel]}d
									</span>
									<span aria-hidden="true" className="text-muted-foreground">
										&times;
									</span>
								</button>
							) : selectedDay ? (
								<button
									type="button"
									data-slot="contribution-heat-pin-clear"
									onClick={() => {
										commitSelection(null);
										setHoveredIndex(null);
										setLoupeVisible(false);
									}}
									className={cn(
										"inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-foreground/90 transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97]",
										palette.focusRing,
									)}
									aria-label="Unpin selected day"
								>
									<span>Pinned</span>
									<span aria-hidden="true" className="text-muted-foreground">
										&times;
									</span>
								</button>
							) : !activeDay && calendar.summary.longestStreak > 0 ? (
								<span
									data-slot="contribution-heat-streak"
									className="text-muted-foreground tabular-nums"
								>
									{calendar.summary.longestStreak}d streak
								</span>
							) : null}
						</div>
					</div>
				)}

				{/* Outer non-clipping frame so the circular loupe overhangs cleanly on all edges */}
				<div ref={frameRef} className="relative">
					<div
						ref={viewportRef}
						data-slot="contribution-heat-viewport"
						onScroll={handleViewportScroll}
						className={cn(
							"-mx-1 overflow-x-auto px-1 py-1 [scrollbar-width:thin]",
							classNames?.gridViewport,
						)}
					>
						<div className="inline-flex flex-col">
							{showMonthLabels && (
								<div
									aria-hidden="true"
									className="relative mb-1.5 h-4"
									style={{
										marginLeft: showWeekdayLabels
											? metrics.weekdayWidth + 6
											: 0,
										width: gridWidth,
									}}
								>
									{calendar.monthLabels.map((month) => (
										<span
											key={`${month.weekIndex}-${month.label}`}
											className={cn(
												"absolute top-0 font-medium text-muted-foreground/85 leading-none",
												metrics.monthText,
											)}
											style={{ left: month.weekIndex * step }}
										>
											{month.label}
										</span>
									))}
								</div>
							)}

							<div className="flex items-start">
								{showWeekdayLabels && (
									<div
										aria-hidden="true"
										className="mr-1.5 flex shrink-0 flex-col"
										style={{
											gap: metrics.gap,
											width: metrics.weekdayWidth,
										}}
									>
										{weekdayLabels.map((label, rowIdx) => (
											<span
												key={`wd-${rowIdx}`}
												className={cn(
													"flex items-center text-muted-foreground/75 leading-none",
													metrics.monthText,
												)}
												style={{ height: metrics.cell }}
											>
												{label}
											</span>
										))}
									</div>
								)}

								<div
									ref={gridRef}
									id={gridId}
									role="grid"
									aria-label={ariaLabel}
									data-slot="contribution-heat-grid"
									onPointerMove={handleGridPointerMove}
									onPointerLeave={handleGridPointerLeave}
									onMouseLeave={handleGridPointerLeave}
									onPointerDown={handleGridPointerDown}
									onPointerUp={(e) => finishScrub(e, true)}
									onPointerCancel={(e) => finishScrub(e, false)}
									className={cn(
										"relative grid shrink-0 grid-flow-col grid-rows-7",
										classNames?.grid,
									)}
									style={{
										gap: metrics.gap,
										width: gridWidth,
										height: gridHeight,
									}}
								>
									{calendar.days.map((day, idx) => {
										if (day.outside) {
											return (
												<span
													key={day.date}
													aria-hidden="true"
													style={{
														width: metrics.cell,
														height: metrics.cell,
													}}
												/>
											);
										}

										const isSelected = selectedIso === day.date;
										const isActive =
											hoveredIndex === idx || focusedIndex === idx;
										const isDimmed =
											activeFilteredLevel !== null &&
											day.level !== activeFilteredLevel;

										return (
											<button
												key={day.date}
												ref={(el) => {
													cellRefs.current[idx] = el;
												}}
												type="button"
												role="gridcell"
												tabIndex={idx === rovingIndex ? 0 : -1}
												data-slot="contribution-heat-cell"
												data-date={day.date}
												data-level={day.level}
												data-count={day.count}
												data-selected={isSelected ? "true" : undefined}
												aria-selected={isSelected}
												aria-label={`${formatDayLabel(day)}: ${formatCountWithUnit(day.count, unit)}${day.label ? `, ${day.label}` : ""}`}
												onClick={(e) => {
													const isTouchLike =
														e.detail === 0
															? false
															: typeof window !== "undefined" &&
																window.matchMedia("(hover: none)").matches;
													handleCellClick(day, isTouchLike);
												}}
												onFocus={(e) => {
													setRovingIndex(idx);
													if (e.target.matches(":focus-visible")) {
														setFocusedIndex(idx);
														setHoveredIndex(null);
														setLoupeVisible(false);
													}
												}}
												onBlur={() => {
													setFocusedIndex((prev) =>
														prev === idx ? null : prev,
													);
												}}
												onKeyDown={(e) => handleCellKeyDown(e, idx)}
												className={cn(
													"relative block cursor-pointer p-0 ring-1 ring-inset transition-opacity duration-150 ease-out focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
													palette.cells[day.level],
													palette.focusRing,
													isDimmed && "opacity-20",
													isSelected &&
														"z-[2] ring-[1.5px] ring-foreground/85 ring-offset-1 ring-offset-background",
													isActive &&
														!loupe &&
														"z-[2] ring-[1.5px] ring-foreground/65",
													classNames?.cell,
												)}
												style={{
													width: metrics.cell,
													height: metrics.cell,
													borderRadius: metrics.radius,
												}}
											/>
										);
									})}
								</div>
							</div>
						</div>
					</div>

					{/* Optical hover loupe overlay (outside scroll clipper so edges never clip) */}
					{loupe && (
						<AnimatePresence>
							{loupeVisible && loupeCenter && (
								<motion.div
									key="optical-loupe"
									aria-hidden="true"
									data-slot="contribution-heat-loupe"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{
										duration: shouldReduceMotion ? 0.1 : 0.16,
										ease: UI_EASE_OUT,
									}}
									className="pointer-events-none absolute top-0 left-0 z-20 will-change-transform"
									style={{
										width: metrics.loupeSize,
										height: metrics.loupeSize,
										transform: loupeTransform,
									}}
								>
									<motion.div
										initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.9 }}
										animate={{ scale: 1 }}
										exit={shouldReduceMotion ? { scale: 1 } : { scale: 0.92 }}
										transition={{
											duration: shouldReduceMotion ? 0.1 : 0.16,
											ease: UI_EASE_OUT,
										}}
										className={cn(
											"relative h-full w-full overflow-hidden rounded-full bg-background/95 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.24),0_2px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-zinc-950/15 dark:bg-zinc-950/95 dark:shadow-[0_14px_32px_-6px_rgba(0,0,0,0.72),0_2px_8px_-1px_rgba(0,0,0,0.45)] dark:ring-white/20 [@media(prefers-reduced-transparency:reduce)]:bg-background",
											classNames?.loupe,
										)}
									>
										{/* Continuously tracked 5x5 magnified neighborhood */}
										<motion.div
											className="absolute top-0 left-0 will-change-transform"
											style={{
												transform: innerCanvasTransform,
											}}
										>
											{loupePatch.map((patchDay) => {
												const isFocal =
													patchDay.weekIndex === loupeCenter.weekIndex &&
													patchDay.dayIndex === loupeCenter.dayIndex;
												const isDimmed =
													activeFilteredLevel !== null &&
													patchDay.level !== activeFilteredLevel;

												return (
													<div
														key={patchDay.date}
														className={cn(
															"absolute flex items-center justify-center ring-1 ring-inset transition-opacity duration-150",
															palette.cells[patchDay.level],
															isDimmed && "opacity-25",
															isFocal &&
																cn(
																	"z-10 shadow-[0_1px_3px_rgba(0,0,0,0.18)] ring-[1.5px]",
																	palette.focalRing,
																),
														)}
														style={{
															left: patchDay.weekIndex * magStep,
															top: patchDay.dayIndex * magStep,
															width: magCell,
															height: magCell,
															borderRadius: Math.max(
																3,
																Math.round(
																	metrics.radius * metrics.magnification,
																),
															),
														}}
													>
														{isFocal && (
															<span
																className={cn(
																	"font-semibold tabular-nums leading-none tracking-tight",
																	size === "sm"
																		? "text-[9px]"
																		: size === "lg"
																			? "text-[11px]"
																			: "text-[10px]",
																	palette.loupeText[patchDay.level],
																)}
															>
																{formatLoupeCount(patchDay.count)}
															</span>
														)}
													</div>
												);
											})}
										</motion.div>

										{/* Subtle convex optical glass highlight */}
										<div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.42),transparent_56%)] ring-1 ring-white/45 ring-inset dark:bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.12),transparent_56%)] dark:ring-white/10 [@media(prefers-reduced-transparency:reduce)]:hidden" />
									</motion.div>
								</motion.div>
							)}
						</AnimatePresence>
					)}
				</div>

				{showLegend && (
					<div
						data-slot="contribution-heat-footer"
						className={cn(
							"mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-muted-foreground",
							metrics.metaText,
							classNames?.footer,
						)}
						style={{ width: contentWidth, maxWidth: "100%" }}
					>
						<span className="tabular-nums">
							{calendar.summary.activeDays} of {calendar.summary.totalDays}{" "}
							active days
						</span>

						<div
							data-slot="contribution-heat-legend"
							role="group"
							aria-label="Filter by intensity level"
							className={cn(
								"inline-flex items-center gap-1.5",
								classNames?.legend,
							)}
							onMouseLeave={() => setHoveredLevel(null)}
						>
							<span className="text-[11px] text-muted-foreground/80">Less</span>
							<div className="inline-flex items-center gap-1">
								{LEVELS.map((level) => {
									const isLevelPinned = pinnedLevel === level;
									const isLevelHovered = hoveredLevel === level;
									return (
										<button
											key={level}
											type="button"
											data-slot="contribution-heat-legend-swatch"
											data-level={level}
											aria-pressed={isLevelPinned}
											aria-label={`Filter level ${level} days (${calendar.levelCounts[level]} days)`}
											onMouseEnter={() => setHoveredLevel(level)}
											onFocus={() => setHoveredLevel(level)}
											onBlur={() =>
												setHoveredLevel((prev) =>
													prev === level ? null : prev,
												)
											}
											onClick={() =>
												setPinnedLevel((prev) =>
													prev === level ? null : level,
												)
											}
											className={cn(
												"block cursor-pointer p-0 ring-1 ring-inset transition-[transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-95",
												palette.cells[level],
												palette.focusRing,
												(isLevelPinned || isLevelHovered) &&
													"ring-[1.5px] ring-foreground/80",
												activeFilteredLevel !== null &&
													activeFilteredLevel !== level &&
													"opacity-35",
											)}
											style={{
												width: Math.max(10, metrics.cell - 1),
												height: Math.max(10, metrics.cell - 1),
												borderRadius: metrics.radius,
											}}
										/>
									);
								})}
							</div>
							<span className="text-[11px] text-muted-foreground/80">More</span>
						</div>
					</div>
				)}
			</section>
		</MotionConfig>
	);
}
