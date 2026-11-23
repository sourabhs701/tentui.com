"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

export type TypingIndicatorVariant = "ink" | "dots" | "wave";
export type TypingIndicatorSurface = "plain" | "bubble" | "pill";
export type TypingIndicatorSize = "sm" | "md" | "lg";
export type TypingIndicatorSpeed = "calm" | "normal" | "brisk";

export type TypingIndicatorUser =
	| string
	| {
			/** Display name shown in the presence label and avatar fallback. */
			name: string;
			/** Optional avatar image URL. */
			avatar?: string;
			/** Optional initials override (defaults to up to two initials from `name`). */
			initials?: string;
			/** Optional accent color for the fallback avatar badge. */
			color?: string;
	  };

export type TypingIndicatorProps = {
	/**
	 * Visual style of the animated typing mark.
	 * @default "ink"
	 */
	variant?: TypingIndicatorVariant;
	/**
	 * Container treatment around the mark and optional label.
	 * @default "plain"
	 */
	surface?: TypingIndicatorSurface;
	/**
	 * Optical size of the mark, spacing, avatars, and label.
	 * @default "md"
	 */
	size?: TypingIndicatorSize;
	/**
	 * Rhythm of the typing animation.
	 * @default "normal"
	 */
	speed?: TypingIndicatorSpeed;
	/**
	 * Whether someone is currently typing. Switching to `false` smoothly settles
	 * the indicator out and stops the animation loop.
	 * @default true
	 */
	active?: boolean;
	/**
	 * Explicit status copy rendered beside the mark (e.g. `"Maya is typing"`).
	 * Overrides the automatic phrasing generated from `users`.
	 */
	label?: ReactNode;
	/**
	 * Active typists used to render compact overlapping avatars and automatic
	 * presence copy such as `"Maya and Sam are typing"`.
	 */
	users?: TypingIndicatorUser[];
	/**
	 * Maximum number of user names listed before grouping into `"and N others"`.
	 * @default 2
	 */
	maxUsers?: number;
	/**
	 * Render compact overlapping avatars when `users` is supplied.
	 * @default true
	 */
	showAvatars?: boolean;
	/**
	 * Placement of the animated mark relative to the label.
	 * @default "start"
	 */
	markPosition?: "start" | "end";
	/**
	 * Screen reader announcement override when `active` is `true`.
	 * Defaults to the formatted `users` copy, string `label`, or `"Typing"`.
	 */
	ariaLabel?: string;
	/**
	 * Enable or disable continuous motion. Also respects `prefers-reduced-motion`.
	 * @default true
	 */
	animated?: boolean;
	/**
	 * Optional click handler. When provided, the indicator renders as a focusable
	 * button with subtle press feedback.
	 */
	onClick?: MouseEventHandler<HTMLButtonElement>;
	/** Additional classes merged onto the root container. */
	className?: string;
	/** Additional classes merged onto the animated mark wrapper. */
	markClassName?: string;
	/** Additional classes merged onto the label wrapper. */
	labelClassName?: string;
};

type NormalizedUser = {
	name: string;
	avatar?: string;
	initials: string;
	color?: string;
};

type Point = { x: number; y: number };
type CubicSegment = [Point, Point, Point, Point];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const SPEED_MULTIPLIER: Record<TypingIndicatorSpeed, number> = {
	calm: 0.75,
	normal: 1,
	brisk: 1.35,
};

const INK_PERIOD_MS = 1650;
const DOTS_PERIOD_MS = 1240;
const WAVE_PERIOD_MS = 1140;

const INK_INITIAL_PHASE = 0.42;
const DOTS_INITIAL_PHASE = 0.28;
const WAVE_INITIAL_PHASE = 0.24;

const DOT_KEYS = ["dot-0", "dot-1", "dot-2"] as const;
const WAVE_KEYS = ["bar-0", "bar-1", "bar-2", "bar-3"] as const;

const REDUCED_DOT_OPACITIES = [0.92, 0.62, 0.36] as const;
const REDUCED_WAVE_SCALES = [0.55, 0.88, 0.68, 0.42] as const;
const REDUCED_WAVE_OPACITIES = [0.62, 0.92, 0.74, 0.46] as const;

// Six C1-continuous cubic Bézier segments forming an organic handwritten ink wave.
const INK_SEGMENTS: CubicSegment[] = [
	[
		{ x: 3.0, y: 10.4 },
		{ x: 5.0, y: 10.4 },
		{ x: 6.2, y: 4.0 },
		{ x: 8.6, y: 4.0 },
	],
	[
		{ x: 8.6, y: 4.0 },
		{ x: 11.0, y: 4.0 },
		{ x: 11.4, y: 11.4 },
		{ x: 13.8, y: 11.4 },
	],
	[
		{ x: 13.8, y: 11.4 },
		{ x: 16.2, y: 11.4 },
		{ x: 16.8, y: 3.4 },
		{ x: 19.4, y: 3.4 },
	],
	[
		{ x: 19.4, y: 3.4 },
		{ x: 22.0, y: 3.4 },
		{ x: 22.4, y: 11.2 },
		{ x: 24.8, y: 11.2 },
	],
	[
		{ x: 24.8, y: 11.2 },
		{ x: 27.2, y: 11.2 },
		{ x: 27.8, y: 5.4 },
		{ x: 30.0, y: 5.4 },
	],
	[
		{ x: 30.0, y: 5.4 },
		{ x: 31.6, y: 5.4 },
		{ x: 32.0, y: 9.4 },
		{ x: 33.4, y: 9.4 },
	],
];

const INK_PATH_D = INK_SEGMENTS.map(([p0, p1, p2, p3], index) =>
	index === 0
		? `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`
		: `C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`,
).join(" ");

function evaluateCubic(segment: CubicSegment, t: number): Point {
	const [p0, p1, p2, p3] = segment;
	const mt = 1 - t;
	const mt2 = mt * mt;
	const t2 = t * t;
	return {
		x:
			mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
		y:
			mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
	};
}

function buildInkArcLengthLut(stepsPerSegment = 40, lutSize = 100): Point[] {
	const densePoints: Point[] = [];
	const cumulativeLengths: number[] = [];
	let total = 0;

	for (const segment of INK_SEGMENTS) {
		for (let i = 0; i <= stepsPerSegment; i++) {
			if (densePoints.length > 0 && i === 0) continue;
			const point = evaluateCubic(segment, i / stepsPerSegment);
			if (densePoints.length > 0) {
				const prev = densePoints[densePoints.length - 1]!;
				total += Math.hypot(point.x - prev.x, point.y - prev.y);
			}
			densePoints.push(point);
			cumulativeLengths.push(total);
		}
	}

	const lut: Point[] = [];
	let cursor = 0;
	for (let i = 0; i <= lutSize; i++) {
		const target = (i / lutSize) * total;
		while (
			cursor < cumulativeLengths.length - 2 &&
			cumulativeLengths[cursor + 1]! < target
		) {
			cursor += 1;
		}
		const lenA = cumulativeLengths[cursor]!;
		const lenB = cumulativeLengths[cursor + 1] ?? lenA;
		const frac = lenB > lenA ? (target - lenA) / (lenB - lenA) : 0;
		const ptA = densePoints[cursor]!;
		const ptB = densePoints[cursor + 1] ?? ptA;
		lut.push({
			x: ptA.x + (ptB.x - ptA.x) * frac,
			y: ptA.y + (ptB.y - ptA.y) * frac,
		});
	}
	return lut;
}

const INK_LUT = buildInkArcLengthLut();

function sampleInkPoint(percent: number): Point {
	const clamped = Math.max(0, Math.min(100, percent));
	const idx = Math.floor(clamped);
	const next = Math.min(INK_LUT.length - 1, idx + 1);
	const frac = clamped - idx;
	const a = INK_LUT[idx]!;
	const b = INK_LUT[next]!;
	return {
		x: a.x + (b.x - a.x) * frac,
		y: a.y + (b.y - a.y) * frac,
	};
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, x: number) {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function easeOutCubic(t: number) {
	const u = 1 - clamp01(t);
	return 1 - u * u * u;
}

function easeInOutSine(t: number) {
	return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
}

function evaluateInkFrame(u: number) {
	let head = 100;
	let tail = 100;

	if (u <= 0.58) {
		const p = u / 0.58;
		head = 100 * (0.28 * p + 0.72 * easeInOutSine(p));
		tail = 26 * p * p;
	} else if (u <= 0.9) {
		const q = (u - 0.58) / 0.32;
		head = 100;
		tail = 26 + 74 * easeOutCubic(q);
	}

	const span = Math.max(0, head - tail);
	const strokeOpacity = smoothstep(0.6, 8.5, span);
	const nibOpacity =
		smoothstep(0.01, 0.08, u) * (1 - smoothstep(0.54, 0.66, u));
	const writeProgress = clamp01(u / 0.58);
	const nibScale = 0.86 + 0.22 * Math.sin(writeProgress * Math.PI);
	const nibPoint = sampleInkPoint(head);

	return {
		head,
		tail,
		span,
		strokeOpacity,
		nibOpacity,
		nibScale,
		nibPoint,
	};
}

const DOT_STAGGER = 0.16;
const DOT_IMPULSE_WINDOW = 0.5;
const DOT_PEAK_AT = 0.38;

function evaluateDotFrame(u: number, index: number, liftPx: number) {
	const local = (((u - index * DOT_STAGGER) % 1) + 1) % 1;
	if (local >= DOT_IMPULSE_WINDOW) {
		return { y: 0, scale: 0.94, opacity: 0.36 };
	}

	const t = local / DOT_IMPULSE_WINDOW;
	const k =
		t < DOT_PEAK_AT
			? easeOutCubic(t / DOT_PEAK_AT)
			: 1 - easeInOutSine((t - DOT_PEAK_AT) / (1 - DOT_PEAK_AT));

	return {
		y: -liftPx * k,
		scale: 0.94 + 0.2 * k,
		opacity: 0.36 + 0.64 * k,
	};
}

const WAVE_BAR_BOUNDS: readonly [number, number][] = [
	[0.28, 0.78],
	[0.34, 1.0],
	[0.3, 0.88],
	[0.24, 0.68],
];
const WAVE_STAGGER = 0.13;

function evaluateWaveFrame(u: number, index: number) {
	const [minScale, maxScale] = WAVE_BAR_BOUNDS[index]!;
	const local = (((u - index * WAVE_STAGGER) % 1) + 1) % 1;
	const raw = 0.5 - 0.5 * Math.cos(local * Math.PI * 2);
	const shaped = raw ** 1.35;
	return {
		scaleY: minScale + (maxScale - minScale) * shaped,
		opacity: 0.4 + 0.6 * shaped,
	};
}

function subscribeReducedMotion(onStoreChange: () => void) {
	if (typeof window === "undefined") return () => {};
	const media = window.matchMedia(REDUCED_MOTION_QUERY);
	media.addEventListener("change", onStoreChange);
	return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
	if (typeof window === "undefined") return false;
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
	return false;
}

function deriveInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
	return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function normalizeUsers(
	users: TypingIndicatorUser[] | undefined,
): NormalizedUser[] {
	if (!users || users.length === 0) return [];
	const normalized: NormalizedUser[] = [];
	for (const entry of users) {
		if (typeof entry === "string") {
			const trimmed = entry.trim();
			if (!trimmed) continue;
			normalized.push({ name: trimmed, initials: deriveInitials(trimmed) });
		} else {
			const trimmed = entry.name.trim();
			if (!trimmed) continue;
			normalized.push({
				name: trimmed,
				avatar: entry.avatar,
				initials: entry.initials?.trim() || deriveInitials(trimmed),
				color: entry.color,
			});
		}
	}
	return normalized;
}

function formatUsersLabel(users: NormalizedUser[], maxUsers: number): string {
	const count = users.length;
	if (count === 0) return "";
	if (count === 1) return `${users[0]!.name} is typing`;
	const limit = Math.max(1, maxUsers);
	if (count === 2 && limit >= 2) {
		return `${users[0]!.name} and ${users[1]!.name} are typing`;
	}
	if (count <= limit) {
		const head = users
			.slice(0, count - 1)
			.map((u) => u.name)
			.join(", ");
		return `${head}, and ${users[count - 1]!.name} are typing`;
	}
	const shown = users
		.slice(0, limit)
		.map((u) => u.name)
		.join(", ");
	const remaining = count - limit;
	return `${shown}, and ${remaining} ${remaining === 1 ? "other" : "others"} are typing`;
}

const SIZE_CONFIG: Record<
	TypingIndicatorSize,
	{
		markHeightClass: string;
		inkClass: string;
		inkStrokeWidth: number;
		inkNibRadius: number;
		dotSize: number;
		dotGap: number;
		dotLift: number;
		waveHeight: number;
		waveBarWidth: number;
		waveGap: number;
		textClass: string;
		gapClass: string;
		avatarClass: string;
		bubbleClass: string;
		pillClass: string;
	}
> = {
	sm: {
		markHeightClass: "h-3.5",
		inkClass: "h-3.5 w-7",
		inkStrokeWidth: 2.15,
		inkNibRadius: 1.55,
		dotSize: 4.5,
		dotGap: 3.5,
		dotLift: 2.4,
		waveHeight: 12,
		waveBarWidth: 2,
		waveGap: 2.5,
		textClass: "text-xs leading-4",
		gapClass: "gap-1.5",
		avatarClass: "size-4 text-[9px]",
		bubbleClass: "rounded-2xl rounded-es-[5px] px-2.5 py-1.5",
		pillClass: "rounded-full px-2.5 py-1",
	},
	md: {
		markHeightClass: "h-4",
		inkClass: "h-4 w-9",
		inkStrokeWidth: 2.05,
		inkNibRadius: 1.65,
		dotSize: 5.5,
		dotGap: 4.5,
		dotLift: 3.2,
		waveHeight: 14,
		waveBarWidth: 2,
		waveGap: 3,
		textClass: "text-[13px] leading-4",
		gapClass: "gap-2",
		avatarClass: "size-5 text-[10px]",
		bubbleClass: "rounded-2xl rounded-es-[6px] px-3.5 py-2",
		pillClass: "rounded-full px-3 py-1.5",
	},
	lg: {
		markHeightClass: "h-5",
		inkClass: "h-5 w-11",
		inkStrokeWidth: 2.0,
		inkNibRadius: 1.7,
		dotSize: 6.5,
		dotGap: 5.5,
		dotLift: 3.8,
		waveHeight: 16,
		waveBarWidth: 2.5,
		waveGap: 3.5,
		textClass: "text-sm leading-5",
		gapClass: "gap-2.5",
		avatarClass: "size-6 text-[11px]",
		bubbleClass: "rounded-[20px] rounded-es-[7px] px-4 py-2.5",
		pillClass: "rounded-full px-3.5 py-1.5",
	},
};

const AVATAR_FALLBACK_BG = [
	"bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900",
	"bg-sky-600 text-white dark:bg-sky-500 dark:text-zinc-950",
	"bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950",
	"bg-amber-600 text-white dark:bg-amber-500 dark:text-zinc-950",
] as const;

const SURFACE_CLASSES: Record<TypingIndicatorSurface, string> = {
	plain: "",
	bubble:
		"border border-border/60 bg-muted/75 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-border/50 dark:bg-muted/60 dark:shadow-none",
	pill: "border border-border/70 bg-background/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-border/60 dark:bg-muted/50 dark:shadow-none",
};

const AVATAR_RING_CLASSES: Record<TypingIndicatorSurface, string> = {
	plain: "ring-background",
	bubble: "ring-muted",
	pill: "ring-background dark:ring-muted",
};

export function TypingIndicator({
	variant = "ink",
	surface = "plain",
	size = "md",
	speed = "normal",
	active = true,
	label,
	users,
	maxUsers = 2,
	showAvatars = true,
	markPosition = "start",
	ariaLabel,
	animated = true,
	onClick,
	className,
	markClassName,
	labelClassName,
}: TypingIndicatorProps) {
	const rootRef = useRef<HTMLDivElement & HTMLButtonElement>(null);
	const activeStrokeRef = useRef<SVGPathElement>(null);
	const nibRef = useRef<SVGCircleElement>(null);
	const nibHaloRef = useRef<SVGCircleElement>(null);
	const dotRefs = useRef<(HTMLSpanElement | null)[]>([null, null, null]);
	const waveRefs = useRef<(HTMLSpanElement | null)[]>([null, null, null, null]);
	const phaseRef = useRef(0);
	const liveId = useId();

	const prefersReducedMotion = useSyncExternalStore(
		subscribeReducedMotion,
		getReducedMotionSnapshot,
		getReducedMotionServerSnapshot,
	);
	const [inView, setInView] = useState(true);
	const [tabVisible, setTabVisible] = useState(true);

	const normalizedUsers = useMemo(() => normalizeUsers(users), [users]);
	const autoLabel = useMemo(
		() => formatUsersLabel(normalizedUsers, maxUsers),
		[normalizedUsers, maxUsers],
	);

	const resolvedLabel: ReactNode =
		label !== undefined ? label : autoLabel || null;
	const hasVisibleLabel =
		resolvedLabel !== null &&
		resolvedLabel !== undefined &&
		resolvedLabel !== "";

	const announcement = useMemo(() => {
		if (!active) return "";
		if (ariaLabel) return ariaLabel;
		if (typeof label === "string" && label.trim()) return label.trim();
		if (autoLabel) return autoLabel;
		return "Typing";
	}, [active, ariaLabel, autoLabel, label]);

	const isStaticMotion = prefersReducedMotion || !animated;
	const shouldAnimate = active && !isStaticMotion && inView && tabVisible;

	const metrics = SIZE_CONFIG[size];

	// Pause motion automatically when scrolled off screen or in a background tab.
	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;

		const handleVisibility = () => {
			setTabVisible(document.visibilityState !== "hidden");
		};
		handleVisibility();
		document.addEventListener("visibilitychange", handleVisibility);

		if (typeof IntersectionObserver === "undefined") {
			return () => {
				document.removeEventListener("visibilitychange", handleVisibility);
			};
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				setInView(entry?.isIntersecting ?? true);
			},
			{ threshold: 0.01 },
		);
		observer.observe(node);

		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, []);

	// Single GPU-friendly rAF loop driving the active mark without React re-renders.
	useEffect(() => {
		const speedFactor = SPEED_MULTIPLIER[speed];

		const applyStaticPosture = () => {
			if (variant === "ink") {
				const frame = evaluateInkFrame(INK_INITIAL_PHASE);
				const stroke = activeStrokeRef.current;
				if (stroke) {
					stroke.setAttribute(
						"stroke-dasharray",
						`${frame.span.toFixed(2)} 200`,
					);
					stroke.setAttribute(
						"stroke-dashoffset",
						`${(-frame.tail).toFixed(2)}`,
					);
					stroke.style.opacity = frame.strokeOpacity.toFixed(3);
				}
				const nib = nibRef.current;
				if (nib) {
					nib.setAttribute("cx", frame.nibPoint.x.toFixed(2));
					nib.setAttribute("cy", frame.nibPoint.y.toFixed(2));
					nib.setAttribute(
						"r",
						(metrics.inkNibRadius * frame.nibScale).toFixed(2),
					);
					nib.style.opacity = frame.nibOpacity.toFixed(3);
				}
				const halo = nibHaloRef.current;
				if (halo) {
					halo.setAttribute("cx", frame.nibPoint.x.toFixed(2));
					halo.setAttribute("cy", frame.nibPoint.y.toFixed(2));
					halo.setAttribute(
						"r",
						(metrics.inkNibRadius * 1.75 * frame.nibScale).toFixed(2),
					);
					halo.style.opacity = (frame.nibOpacity * 0.22).toFixed(3);
				}
			} else if (variant === "dots") {
				for (let index = 0; index < 3; index++) {
					const dot = dotRefs.current[index];
					if (!dot) continue;
					dot.style.transform = "translate3d(0, 0, 0)";
					dot.style.opacity = String(REDUCED_DOT_OPACITIES[index] ?? 0.6);
				}
			} else {
				for (let index = 0; index < 4; index++) {
					const bar = waveRefs.current[index];
					if (!bar) continue;
					bar.style.transform = `scaleY(${REDUCED_WAVE_SCALES[index]!.toFixed(3)})`;
					bar.style.opacity = String(REDUCED_WAVE_OPACITIES[index] ?? 0.7);
				}
			}
		};

		const applyFrame = (elapsedMs: number) => {
			if (variant === "ink") {
				const u =
					(INK_INITIAL_PHASE + (elapsedMs * speedFactor) / INK_PERIOD_MS) % 1;
				const frame = evaluateInkFrame(u);
				const stroke = activeStrokeRef.current;
				if (stroke) {
					stroke.setAttribute(
						"stroke-dasharray",
						`${frame.span.toFixed(2)} 200`,
					);
					stroke.setAttribute(
						"stroke-dashoffset",
						`${(-frame.tail).toFixed(2)}`,
					);
					stroke.style.opacity = frame.strokeOpacity.toFixed(3);
				}
				const nib = nibRef.current;
				if (nib) {
					nib.setAttribute("cx", frame.nibPoint.x.toFixed(2));
					nib.setAttribute("cy", frame.nibPoint.y.toFixed(2));
					nib.setAttribute(
						"r",
						(metrics.inkNibRadius * frame.nibScale).toFixed(2),
					);
					nib.style.opacity = frame.nibOpacity.toFixed(3);
				}
				const halo = nibHaloRef.current;
				if (halo) {
					halo.setAttribute("cx", frame.nibPoint.x.toFixed(2));
					halo.setAttribute("cy", frame.nibPoint.y.toFixed(2));
					halo.setAttribute(
						"r",
						(metrics.inkNibRadius * 1.75 * frame.nibScale).toFixed(2),
					);
					halo.style.opacity = (frame.nibOpacity * 0.22).toFixed(3);
				}
			} else if (variant === "dots") {
				const u =
					(DOTS_INITIAL_PHASE + (elapsedMs * speedFactor) / DOTS_PERIOD_MS) % 1;
				for (let index = 0; index < 3; index++) {
					const dot = dotRefs.current[index];
					if (!dot) continue;
					const frame = evaluateDotFrame(u, index, metrics.dotLift);
					dot.style.transform = `translate3d(0, ${frame.y.toFixed(2)}px, 0) scale(${frame.scale.toFixed(3)})`;
					dot.style.opacity = frame.opacity.toFixed(3);
				}
			} else {
				const u =
					(WAVE_INITIAL_PHASE + (elapsedMs * speedFactor) / WAVE_PERIOD_MS) % 1;
				for (let index = 0; index < 4; index++) {
					const bar = waveRefs.current[index];
					if (!bar) continue;
					const frame = evaluateWaveFrame(u, index);
					bar.style.transform = `scaleY(${frame.scaleY.toFixed(3)})`;
					bar.style.opacity = frame.opacity.toFixed(3);
				}
			}
		};

		if (!shouldAnimate) {
			phaseRef.current = 0;
			if (isStaticMotion) {
				applyStaticPosture();
			} else {
				applyFrame(0);
			}
			return;
		}

		let rafId = 0;
		let lastTime: number | null = null;

		const tick = (now: number) => {
			if (lastTime === null) {
				lastTime = now;
			} else {
				const dt = Math.min(Math.max(0, now - lastTime), 64);
				phaseRef.current += dt;
				lastTime = now;
			}
			applyFrame(phaseRef.current);
			rafId = window.requestAnimationFrame(tick);
		};

		applyFrame(phaseRef.current);
		rafId = window.requestAnimationFrame(tick);

		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, [
		isStaticMotion,
		metrics.dotLift,
		metrics.inkNibRadius,
		shouldAnimate,
		speed,
		variant,
	]);

	// Compute deterministic initial frame for SSR and zero-flash first paint.
	const initialInk = useMemo(() => evaluateInkFrame(INK_INITIAL_PHASE), []);
	const initialDots = useMemo(
		() =>
			[0, 1, 2].map((index) =>
				evaluateDotFrame(DOTS_INITIAL_PHASE, index, metrics.dotLift),
			),
		[metrics.dotLift],
	);
	const initialWave = useMemo(
		() =>
			[0, 1, 2, 3].map((index) => evaluateWaveFrame(WAVE_INITIAL_PHASE, index)),
		[],
	);

	const visibleAvatars =
		showAvatars && normalizedUsers.length > 0
			? normalizedUsers.slice(0, Math.min(3, Math.max(1, maxUsers)))
			: [];

	const reducedMotionPulseClass =
		active && animated && prefersReducedMotion
			? "animate-[pulse_1.8s_ease-in-out_infinite]"
			: undefined;

	const markElement = (
		<span
			data-slot="typing-indicator-mark"
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center text-foreground/85",
				metrics.markHeightClass,
				reducedMotionPulseClass,
				markClassName,
			)}
		>
			{variant === "ink" ? (
				<svg
					viewBox="0 0 36 16"
					fill="none"
					className={cn(
						"block overflow-visible rtl:-scale-x-100",
						metrics.inkClass,
					)}
				>
					<path
						d={INK_PATH_D}
						pathLength={100}
						stroke="currentColor"
						strokeWidth={metrics.inkStrokeWidth - 0.2}
						strokeLinecap="round"
						strokeLinejoin="round"
						opacity={0.14}
					/>
					<path
						ref={activeStrokeRef}
						d={INK_PATH_D}
						pathLength={100}
						stroke="currentColor"
						strokeWidth={metrics.inkStrokeWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={`${initialInk.span.toFixed(2)} 200`}
						strokeDashoffset={(-initialInk.tail).toFixed(2)}
						style={{ opacity: initialInk.strokeOpacity }}
					/>
					<circle
						ref={nibHaloRef}
						cx={initialInk.nibPoint.x}
						cy={initialInk.nibPoint.y}
						r={metrics.inkNibRadius * 1.75 * initialInk.nibScale}
						fill="currentColor"
						style={{ opacity: initialInk.nibOpacity * 0.22 }}
					/>
					<circle
						ref={nibRef}
						cx={initialInk.nibPoint.x}
						cy={initialInk.nibPoint.y}
						r={metrics.inkNibRadius * initialInk.nibScale}
						fill="currentColor"
						style={{ opacity: initialInk.nibOpacity }}
					/>
				</svg>
			) : variant === "dots" ? (
				<span
					className="inline-flex items-center"
					style={{
						gap: `${metrics.dotGap}px`,
						height: `${metrics.dotSize + metrics.dotLift * 2}px`,
					}}
				>
					{initialDots.map((dot, index) => (
						<span
							key={DOT_KEYS[index]}
							ref={(node) => {
								dotRefs.current[index] = node;
							}}
							data-slot="typing-indicator-dot"
							className="block rounded-full bg-current will-change-transform"
							style={{
								width: `${metrics.dotSize}px`,
								height: `${metrics.dotSize}px`,
								transform: isStaticMotion
									? "translate3d(0, 0, 0)"
									: `translate3d(0, ${dot.y.toFixed(2)}px, 0) scale(${dot.scale.toFixed(3)})`,
								opacity: isStaticMotion
									? (REDUCED_DOT_OPACITIES[index] ?? 0.6)
									: dot.opacity,
							}}
						/>
					))}
				</span>
			) : (
				<span
					className="inline-flex items-center"
					style={{
						gap: `${metrics.waveGap}px`,
						height: `${metrics.waveHeight}px`,
					}}
				>
					{initialWave.map((bar, index) => (
						<span
							key={WAVE_KEYS[index]}
							ref={(node) => {
								waveRefs.current[index] = node;
							}}
							data-slot="typing-indicator-bar"
							className="block h-full origin-center rounded-full bg-current will-change-transform"
							style={{
								width: `${metrics.waveBarWidth}px`,
								transform: `scaleY(${(isStaticMotion ? REDUCED_WAVE_SCALES[index]! : bar.scaleY).toFixed(3)})`,
								opacity: isStaticMotion
									? (REDUCED_WAVE_OPACITIES[index] ?? 0.7)
									: bar.opacity,
							}}
						/>
					))}
				</span>
			)}
		</span>
	);

	const avatarsElement =
		visibleAvatars.length > 0 ? (
			<span
				data-slot="typing-indicator-avatars"
				aria-hidden="true"
				className="inline-flex shrink-0 items-center -space-x-1.5"
			>
				{visibleAvatars.map((user, index) => {
					const fallbackClass =
						AVATAR_FALLBACK_BG[index % AVATAR_FALLBACK_BG.length]!;
					const customStyle: CSSProperties | undefined = user.color
						? { backgroundColor: user.color, color: "#ffffff" }
						: undefined;
					return (
						<span
							key={user.name}
							className={cn(
								"relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium ring-2",
								metrics.avatarClass,
								AVATAR_RING_CLASSES[surface],
								!user.color && !user.avatar && fallbackClass,
							)}
							style={customStyle}
						>
							{user.avatar ? (
								// biome-ignore lint/performance/noImgElement: standalone registry component cannot depend on next/image
								<img
									src={user.avatar}
									alt=""
									loading="eager"
									decoding="async"
									className="size-full object-cover"
								/>
							) : (
								user.initials
							)}
						</span>
					);
				})}
			</span>
		) : null;

	const labelElement = hasVisibleLabel ? (
		<span
			data-slot="typing-indicator-label"
			className={cn(
				"min-w-0 truncate font-normal text-muted-foreground tracking-[-0.005em]",
				metrics.textClass,
				labelClassName,
			)}
		>
			{resolvedLabel}
		</span>
	) : null;

	const surfaceSizingClass =
		surface === "bubble"
			? metrics.bubbleClass
			: surface === "pill"
				? metrics.pillClass
				: "";

	const sharedClassName = cn(
		"inline-flex max-w-full items-center transition-[opacity,transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity",
		metrics.gapClass,
		surfaceSizingClass,
		SURFACE_CLASSES[surface],
		active
			? "translate-y-0 scale-100 opacity-100"
			: "pointer-events-none translate-y-0.5 scale-[0.96] opacity-0 motion-reduce:translate-y-0 motion-reduce:scale-100",
		onClick &&
			"min-h-8 pointer-coarse:min-h-11 cursor-pointer outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/90",
		className,
	);

	const content = (
		<>
			{avatarsElement}
			{markPosition === "start" ? (
				<>
					{markElement}
					{labelElement}
				</>
			) : (
				<>
					{labelElement}
					{markElement}
				</>
			)}
		</>
	);

	if (onClick) {
		return (
			<button
				ref={rootRef}
				type="button"
				onClick={onClick}
				disabled={!active}
				tabIndex={active ? 0 : -1}
				aria-label={announcement || undefined}
				aria-describedby={liveId}
				data-slot="typing-indicator"
				data-variant={variant}
				data-surface={surface}
				data-size={size}
				data-state={active ? "typing" : "idle"}
				className={sharedClassName}
			>
				{content}
				<span
					id={liveId}
					role="status"
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
				>
					{announcement}
				</span>
			</button>
		);
	}

	return (
		<div
			ref={rootRef}
			role="status"
			aria-live="polite"
			aria-atomic="true"
			aria-hidden={!active}
			data-slot="typing-indicator"
			data-variant={variant}
			data-surface={surface}
			data-size={size}
			data-state={active ? "typing" : "idle"}
			className={sharedClassName}
		>
			{content}
			{!hasVisibleLabel ? (
				<span className="sr-only">{announcement}</span>
			) : null}
		</div>
	);
}
