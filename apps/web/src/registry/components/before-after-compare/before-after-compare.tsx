"use client";

import {
	type AnimationPlaybackControls,
	animate,
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
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { cn } from "@/lib/utils";

/** Critically damped spring for click-to-jump and external controlled updates. */
const jumpSpring = {
	type: "spring",
	visualDuration: 0.3,
	bounce: 0,
} as const;

/** Gentle momentum carry after a quick flick. */
const glideSpring = {
	type: "spring",
	stiffness: 280,
	damping: 32,
	mass: 0.9,
} as const;

/** Quick return after overdragging past 0% or 100%. */
const edgeReturnSpring = {
	type: "spring",
	stiffness: 360,
	damping: 24,
} as const;

/** Responsive scale feedback on press. */
const pressSpring = {
	type: "spring",
	stiffness: 520,
	damping: 34,
} as const;

/** Pointer travel in px before mouse stage press becomes a direct drag. */
const MOUSE_DRAG_SLOP = 3;
/** Touch travel in px before deciding between comparison drag and page scroll. */
const TOUCH_DRAG_SLOP = 6;
/** Maximum rubber-band travel in px when dragging past 0% or 100%. */
const MAX_EDGE_NUDGE_PX = 4;
/** Window of recent pointer samples used for release velocity, in ms. */
const VELOCITY_WINDOW_MS = 65;
/** Ignore stale velocity if pointer paused before release, in ms. */
const STALE_VELOCITY_MS = 45;
/** Minimum release speed in %/s to trigger a gentle momentum carry. */
const FLICK_THRESHOLD_PCT_S = 95;
/** Cap on post-release glide travel in percentage points. */
const MAX_FLICK_TRAVEL_PCT = 8;
/** Distance in px over which corner labels fade before the divider reaches them. */
const LABEL_FADE_BAND_PX = 28;
const LABEL_FADE_MARGIN_PX = 4;

export type BeforeAfterCompareOrientation = "horizontal" | "vertical";

export interface BeforeAfterCompareHandleRenderState {
	/** Current split position from 0 to 100. */
	position: number;
	/** Active slider orientation. */
	orientation: BeforeAfterCompareOrientation;
	/** Whether the user is actively dragging the comparison handle or stage. */
	isDragging: boolean;
}

export interface BeforeAfterCompareClassNames {
	/** Clipped inner viewport frame wrapping both compared layers. */
	stage?: string;
	/** Clipped top comparison layer (`before`). */
	before?: string;
	/** Unclipped base comparison layer (`after`). */
	after?: string;
	/** Hairline divider centered along the split boundary. */
	divider?: string;
	/** Interactive `role="slider"` handle wrapper. */
	handle?: string;
	/** Corner badge for the `before` layer. */
	beforeLabel?: string;
	/** Corner badge for the `after` layer. */
	afterLabel?: string;
}

export interface BeforeAfterCompareProps
	extends Omit<ComponentProps<"div">, "children" | "defaultValue"> {
	/** Content revealed from the start edge (left in horizontal, top in vertical). */
	before: ReactNode;
	/** Base content revealed from the end edge (right in horizontal, bottom in vertical). */
	after: ReactNode;
	/** Controlled split position from 0 to 100. */
	value?: number;
	/** Initial split position when uncontrolled. Defaults to 50. */
	defaultValue?: number;
	/** Called continuously when the split position changes. */
	onValueChange?: (value: number) => void;
	/** Called once a drag settles, a click-to-jump lands, or a keyboard change finishes. */
	onValueCommit?: (value: number) => void;
	/** Split direction. Defaults to `"horizontal"`. */
	orientation?: BeforeAfterCompareOrientation;
	/** Optional corner badge rendered on the `before` side. */
	beforeLabel?: ReactNode;
	/** Optional corner badge rendered on the `after` side. */
	afterLabel?: ReactNode;
	/** Custom handle node or render prop inside the accessible `role="slider"` control. */
	handle?:
		| ReactNode
		| ((state: BeforeAfterCompareHandleRenderState) => ReactNode);
	/** Keyboard arrow increment in percentage points. Defaults to 5. */
	step?: number;
	/** Large step for `Shift` + Arrow and `PageUp` / `PageDown`. Defaults to 10. */
	largeStep?: number;
	/** Accessible label applied to the `role="slider"` handle when `aria-label` is omitted. */
	label?: string;
	/** Formats the `aria-valuetext` announced by screen readers. */
	formatValueText?: (value: number) => string;
	/** Disables pointer and keyboard interaction. */
	disabled?: boolean;
	/** Optional class overrides for inner slots. */
	classNames?: BeforeAfterCompareClassNames;
}

interface GestureSample {
	t: number;
	pct: number;
}

interface ActiveGesture {
	pointerId: number;
	pointerType: string;
	source: "handle" | "stage";
	target: HTMLElement;
	startClientX: number;
	startClientY: number;
	grabOffsetPx: number;
	committed: boolean;
	samples: GestureSample[];
}

interface LabelBounds {
	stageSize: number;
	beforeEnd: number;
	afterStart: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function decimalsOf(value: number) {
	if (!Number.isFinite(value)) return 0;
	const text = String(value);
	if (text.includes("e-")) return Number(text.split("e-")[1]);
	return text.split(".")[1]?.length ?? 0;
}

function roundToPrecision(value: number, decimals: number) {
	const clamped = clamp(value, 0, 100);
	if (decimals <= 0) return Math.round(clamped);
	const factor = 10 ** decimals;
	return Math.round(clamped * factor) / factor;
}

/** Smooth square-root resistance so overdragging gently cushions instead of hitting a wall. */
function resist(over: number, max: number) {
	if (over <= 0 || max <= 0) return 0;
	return max * (1 - Math.exp(1 - Math.sqrt(1 + (2 * over) / max)));
}

function defaultLabelText(node: ReactNode): string | null {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	return null;
}

const mediaLayerClasses =
	"pointer-events-none relative col-start-1 row-start-1 size-full overflow-hidden [&>img]:[-webkit-user-drag:none] [&>img]:pointer-events-none [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:select-none [&>img]:object-cover [&>img]:object-center [&>picture]:pointer-events-none [&>picture]:absolute [&>picture]:inset-0 [&>picture]:size-full [&>picture]:select-none [&>picture>img]:size-full [&>picture>img]:object-cover [&>picture>img]:object-center [&>video]:pointer-events-none [&>video]:absolute [&>video]:inset-0 [&>video]:size-full [&>video]:select-none [&>video]:object-cover [&>video]:object-center";

const labelBadgeClasses =
	"pointer-events-none absolute z-20 inline-flex items-center rounded-full bg-zinc-950/65 px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.01em] text-white/95 ring-1 ring-white/15 shadow-xs backdrop-blur-md [@media(prefers-reduced-transparency:reduce)]:bg-zinc-950/95 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none";

function DefaultHandle({
	isHorizontal,
	isDragging,
	shouldReduceMotion,
}: {
	isHorizontal: boolean;
	isDragging: boolean;
	shouldReduceMotion: boolean;
}) {
	const offset = isDragging && !shouldReduceMotion ? 1 : 0;

	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex items-center justify-center rounded-full bg-white/88 text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.78)] ring-1 ring-black/12 backdrop-blur-md transition-[background-color,box-shadow] duration-150 dark:bg-zinc-950/84 dark:text-zinc-100 dark:shadow-[0_2px_12px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.15)] dark:ring-white/18 [@media(hover:hover)_and_(pointer:fine)]:group-hover/handle:bg-white/96 [@media(hover:hover)_and_(pointer:fine)]:dark:group-hover/handle:bg-zinc-950/95 [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none [@media(prefers-reduced-transparency:reduce)]:dark:bg-zinc-950",
				isHorizontal ? "h-10 w-6 gap-0.5" : "h-6 w-10 flex-col gap-0.5",
			)}
		>
			{isHorizontal ? (
				<>
					<svg
						viewBox="0 0 8 12"
						className="size-2.5 transition-transform duration-150"
						style={{
							transform: offset ? `translateX(-${offset}px)` : undefined,
						}}
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M5.5 2.25 2 6l3.5 3.75" />
					</svg>
					<svg
						viewBox="0 0 8 12"
						className="size-2.5 transition-transform duration-150"
						style={{
							transform: offset ? `translateX(${offset}px)` : undefined,
						}}
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M2.5 2.25 6 6l-3.5 3.75" />
					</svg>
				</>
			) : (
				<>
					<svg
						viewBox="0 0 12 8"
						className="size-2.5 transition-transform duration-150"
						style={{
							transform: offset ? `translateY(-${offset}px)` : undefined,
						}}
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M2.25 5.5 6 2l3.75 3.5" />
					</svg>
					<svg
						viewBox="0 0 12 8"
						className="size-2.5 transition-transform duration-150"
						style={{
							transform: offset ? `translateY(${offset}px)` : undefined,
						}}
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M2.25 2.5 6 6l3.75-3.5" />
					</svg>
				</>
			)}
		</span>
	);
}

/**
 * Draggable comparison slider revealing one image or live React UI tree over another.
 */
export function BeforeAfterCompare({
	before,
	after,
	value,
	defaultValue = 50,
	onValueChange,
	onValueCommit,
	orientation = "horizontal",
	beforeLabel,
	afterLabel,
	handle,
	step = 5,
	largeStep = 10,
	label = "Before and after comparison",
	formatValueText,
	disabled = false,
	className,
	classNames,
	"aria-label": ariaLabelProp,
	"aria-labelledby": ariaLabelledByProp,
	...props
}: BeforeAfterCompareProps) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const isHorizontal = orientation === "horizontal";

	const safeStep = Number.isFinite(step) && step > 0 ? step : 5;
	const safeLargeStep =
		Number.isFinite(largeStep) && largeStep > 0 ? largeStep : safeStep * 2;
	const decimals = Math.min(decimalsOf(safeStep), 2);
	const initialValue = clamp(
		Number.isFinite(value ?? defaultValue) ? (value ?? defaultValue) : 50,
		0,
		100,
	);

	const pos = useMotionValue(initialValue);
	const clampedPos = useTransform(pos, (v) => clamp(v, 0, 100));
	const edgeOffset = useMotionValue(0);

	const clipPath = useTransform(clampedPos, (v) =>
		isHorizontal
			? `inset(0 ${(100 - v).toFixed(4)}% 0 0)`
			: `inset(0 0 ${(100 - v).toFixed(4)}% 0)`,
	);
	const positionPercent = useTransform(clampedPos, (v) => `${v.toFixed(4)}%`);

	const beforeLabelOpacity = useMotionValue(
		initialValue >= 14 ? 1 : clamp((initialValue - 2) / 12, 0, 1),
	);
	const afterLabelOpacity = useMotionValue(
		initialValue <= 86 ? 1 : clamp((98 - initialValue) / 12, 0, 1),
	);

	const [ariaValue, setAriaValue] = useState(() =>
		roundToPrecision(initialValue, decimals),
	);
	const [isDragging, setIsDragging] = useState(false);

	const stageRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLDivElement>(null);
	const beforeLabelRef = useRef<HTMLSpanElement>(null);
	const afterLabelRef = useRef<HTMLSpanElement>(null);

	const gestureRef = useRef<ActiveGesture | null>(null);
	const posAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const edgeAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const controlledValueRef = useRef(value);
	controlledValueRef.current = value;
	const lastEmittedRef = useRef<number | null>(null);
	const boundsRef = useRef<LabelBounds>({
		stageSize: 0,
		beforeEnd: 0,
		afterStart: 0,
	});

	const onValueChangeRef = useRef(onValueChange);
	onValueChangeRef.current = onValueChange;
	const onValueCommitRef = useRef(onValueCommit);
	onValueCommitRef.current = onValueCommit;

	const stopPositionAnimation = useCallback(() => {
		posAnimRef.current?.stop();
		posAnimRef.current = null;
	}, []);

	const stopEdgeAnimation = useCallback(() => {
		edgeAnimRef.current?.stop();
		edgeAnimRef.current = null;
	}, []);

	const updateLabelOpacities = useCallback(
		(pct: number) => {
			const { stageSize, beforeEnd, afterStart } = boundsRef.current;

			if (stageSize <= 0) {
				beforeLabelOpacity.set(pct >= 14 ? 1 : clamp((pct - 2) / 12, 0, 1));
				afterLabelOpacity.set(pct <= 86 ? 1 : clamp((98 - pct) / 12, 0, 1));
				return;
			}

			const dividerPx = (pct / 100) * stageSize;

			if (beforeEnd > 0) {
				const fadeStart = beforeEnd - LABEL_FADE_MARGIN_PX;
				beforeLabelOpacity.set(
					clamp((dividerPx - fadeStart) / LABEL_FADE_BAND_PX, 0, 1),
				);
			} else {
				beforeLabelOpacity.set(1);
			}

			if (afterStart > 0) {
				const fadeEnd = afterStart + LABEL_FADE_MARGIN_PX;
				afterLabelOpacity.set(
					clamp((fadeEnd - dividerPx) / LABEL_FADE_BAND_PX, 0, 1),
				);
			} else {
				afterLabelOpacity.set(1);
			}
		},
		[afterLabelOpacity, beforeLabelOpacity],
	);

	const hasBeforeLabel = beforeLabel != null;
	const hasAfterLabel = afterLabel != null;

	const measureBounds = useCallback(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const stageRect = stage.getBoundingClientRect();
		const stageSize = isHorizontal ? stageRect.width : stageRect.height;

		let beforeEnd = 0;
		const beforeEl = hasBeforeLabel ? beforeLabelRef.current : null;
		if (beforeEl) {
			const rect = beforeEl.getBoundingClientRect();
			beforeEnd = isHorizontal
				? rect.right - stageRect.left
				: rect.bottom - stageRect.top;
		}

		let afterStart = 0;
		const afterEl = hasAfterLabel ? afterLabelRef.current : null;
		if (afterEl) {
			const rect = afterEl.getBoundingClientRect();
			afterStart = isHorizontal
				? rect.left - stageRect.left
				: rect.top - stageRect.top;
		}

		boundsRef.current = { stageSize, beforeEnd, afterStart };
		updateLabelOpacities(clampedPos.get());
	}, [
		clampedPos,
		hasAfterLabel,
		hasBeforeLabel,
		isHorizontal,
		updateLabelOpacities,
	]);

	useLayoutEffect(() => {
		measureBounds();
	}, [measureBounds]);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			measureBounds();
		});
		observer.observe(stage);
		if (hasBeforeLabel && beforeLabelRef.current) {
			observer.observe(beforeLabelRef.current);
		}
		if (hasAfterLabel && afterLabelRef.current) {
			observer.observe(afterLabelRef.current);
		}
		return () => observer.disconnect();
	}, [hasAfterLabel, hasBeforeLabel, measureBounds]);

	useEffect(() => {
		return () => {
			stopPositionAnimation();
			stopEdgeAnimation();
		};
	}, [stopEdgeAnimation, stopPositionAnimation]);

	const emitValueChange = useCallback(
		(rawPct: number) => {
			const rounded = roundToPrecision(rawPct, decimals);
			if (lastEmittedRef.current === rounded) return;
			lastEmittedRef.current = rounded;
			onValueChangeRef.current?.(rounded);
		},
		[decimals],
	);

	const emitValueCommit = useCallback(
		(rawPct: number) => {
			const rounded = roundToPrecision(rawPct, decimals);
			onValueCommitRef.current?.(rounded);
		},
		[decimals],
	);

	useMotionValueEvent(pos, "change", (raw) => {
		const latest = clamp(raw, 0, 100);
		updateLabelOpacities(latest);
		const rounded = roundToPrecision(latest, decimals);
		setAriaValue((prev) => (prev === rounded ? prev : rounded));
		if (gestureRef.current?.committed || posAnimRef.current) {
			emitValueChange(latest);
		}
	});

	const animatePositionTo = useCallback(
		(
			targetPct: number,
			options: {
				spring: typeof jumpSpring | typeof glideSpring;
				velocity?: number;
				commitOnComplete?: boolean;
				emitImmediate?: boolean;
			},
		) => {
			const clampedTarget = clamp(targetPct, 0, 100);
			stopPositionAnimation();

			if (options.emitImmediate) {
				emitValueChange(clampedTarget);
			}

			if (shouldReduceMotion) {
				pos.set(clampedTarget);
				updateLabelOpacities(clampedTarget);
				const rounded = roundToPrecision(clampedTarget, decimals);
				setAriaValue((prev) => (prev === rounded ? prev : rounded));
				emitValueChange(clampedTarget);
				if (options.commitOnComplete) {
					emitValueCommit(clampedTarget);
				}
				return;
			}

			const transitionConfig =
				options.velocity !== undefined
					? { ...options.spring, velocity: options.velocity }
					: options.spring;

			posAnimRef.current = animate(pos, clampedTarget, {
				...transitionConfig,
				onComplete: () => {
					posAnimRef.current = null;
					const finalControlled = controlledValueRef.current;
					if (
						finalControlled !== undefined &&
						Math.abs(clamp(finalControlled, 0, 100) - clampedTarget) > 0.05 &&
						!gestureRef.current
					) {
						animate(pos, clamp(finalControlled, 0, 100), jumpSpring);
						return;
					}
					if (options.commitOnComplete) {
						emitValueCommit(pos.get());
					}
				},
			});
		},
		[
			decimals,
			emitValueChange,
			emitValueCommit,
			pos,
			shouldReduceMotion,
			stopPositionAnimation,
			updateLabelOpacities,
		],
	);

	// Sync external controlled `value` updates while ignoring echoes of our own emission.
	useEffect(() => {
		if (value === undefined) return;
		const target = clamp(Number.isFinite(value) ? value : 50, 0, 100);
		const roundedTarget = roundToPrecision(target, decimals);
		if (gestureRef.current?.committed) return;
		if (lastEmittedRef.current === roundedTarget && posAnimRef.current) {
			return;
		}
		if (Math.abs(pos.get() - target) < 0.05) {
			lastEmittedRef.current = roundedTarget;
			return;
		}
		lastEmittedRef.current = roundedTarget;
		stopPositionAnimation();
		if (shouldReduceMotion) {
			pos.set(target);
			return;
		}
		posAnimRef.current = animate(pos, target, {
			...jumpSpring,
			onComplete: () => {
				posAnimRef.current = null;
			},
		});
	}, [decimals, pos, shouldReduceMotion, stopPositionAnimation, value]);

	const releaseEdgeOffset = useCallback(() => {
		stopEdgeAnimation();
		if (shouldReduceMotion || edgeOffset.get() === 0) {
			edgeOffset.set(0);
			return;
		}
		edgeAnimRef.current = animate(edgeOffset, 0, {
			...edgeReturnSpring,
			onComplete: () => {
				edgeAnimRef.current = null;
			},
		});
	}, [edgeOffset, shouldReduceMotion, stopEdgeAnimation]);

	const computeRawPx = useCallback(
		(clientX: number, clientY: number, grabOffsetPx: number) => {
			const stage = stageRef.current;
			if (!stage) return null;
			const rect = stage.getBoundingClientRect();
			const size = isHorizontal ? rect.width : rect.height;
			if (size <= 0) return null;
			const coord = isHorizontal ? clientX - rect.left : clientY - rect.top;
			const rawPx = coord - grabOffsetPx;
			return { rawPx, size, rawPct: (rawPx / size) * 100 };
		},
		[isHorizontal],
	);

	const applyCommittedMove = useCallback(
		(clientX: number, clientY: number, gesture: ActiveGesture) => {
			const coords = computeRawPx(clientX, clientY, gesture.grabOffsetPx);
			if (!coords) return;

			const { rawPx, size, rawPct } = coords;
			const clamped = clamp(rawPct, 0, 100);
			pos.set(clamped);
			emitValueChange(clamped);

			if (shouldReduceMotion) {
				edgeOffset.set(0);
			} else if (rawPx < 0) {
				edgeOffset.set(-resist(-rawPx, MAX_EDGE_NUDGE_PX));
			} else if (rawPx > size) {
				edgeOffset.set(resist(rawPx - size, MAX_EDGE_NUDGE_PX));
			} else if (edgeOffset.get() !== 0) {
				edgeOffset.set(0);
			}

			const now = performance.now();
			gesture.samples.push({ t: now, pct: clamped });
			const cutoff = now - VELOCITY_WINDOW_MS;
			while (gesture.samples.length > 2 && gesture.samples[0]!.t < cutoff) {
				gesture.samples.shift();
			}
		},
		[computeRawPx, edgeOffset, emitValueChange, pos, shouldReduceMotion],
	);

	const finishGesture = useCallback(
		(event: PointerEvent<HTMLElement>, cancelled: boolean) => {
			const gesture = gestureRef.current;
			if (!gesture || event.pointerId !== gesture.pointerId) return;

			if (gesture.target.hasPointerCapture(gesture.pointerId)) {
				gesture.target.releasePointerCapture(gesture.pointerId);
			}
			gestureRef.current = null;
			setIsDragging(false);
			releaseEdgeOffset();

			if (!gesture.committed) {
				if (cancelled) return;
				const coords = computeRawPx(event.clientX, event.clientY, 0);
				if (!coords) return;
				const targetPct = clamp(coords.rawPct, 0, 100);
				if (gesture.pointerType === "touch") {
					animatePositionTo(targetPct, {
						spring: jumpSpring,
						commitOnComplete: true,
					});
				} else {
					emitValueCommit(targetPct);
				}
				return;
			}

			if (cancelled) return;

			const now = performance.now();
			const samples = gesture.samples;
			const last = samples[samples.length - 1];
			const first = samples[0];
			let velocityPctPerSec = 0;

			if (
				last &&
				first &&
				samples.length >= 2 &&
				now - last.t < STALE_VELOCITY_MS
			) {
				const dt = last.t - first.t;
				if (dt > 4) {
					velocityPctPerSec = ((last.pct - first.pct) / dt) * 1000;
				}
			}

			const current = clamp(pos.get(), 0, 100);
			const pinnedAtStart = current <= 0.1 && velocityPctPerSec < 0;
			const pinnedAtEnd = current >= 99.9 && velocityPctPerSec > 0;

			if (
				!shouldReduceMotion &&
				Math.abs(velocityPctPerSec) > FLICK_THRESHOLD_PCT_S &&
				!pinnedAtStart &&
				!pinnedAtEnd
			) {
				const projectedDelta = clamp(
					velocityPctPerSec * 0.032,
					-MAX_FLICK_TRAVEL_PCT,
					MAX_FLICK_TRAVEL_PCT,
				);
				const glideTarget = clamp(current + projectedDelta, 0, 100);
				animatePositionTo(glideTarget, {
					spring: glideSpring,
					velocity: clamp(velocityPctPerSec, -400, 400),
					commitOnComplete: true,
				});
				return;
			}

			emitValueCommit(current);

			const controlled = controlledValueRef.current;
			if (
				controlled !== undefined &&
				Math.abs(clamp(controlled, 0, 100) - current) > 0.5
			) {
				animatePositionTo(controlled, { spring: jumpSpring });
			}
		},
		[
			animatePositionTo,
			computeRawPx,
			emitValueCommit,
			pos,
			releaseEdgeOffset,
			shouldReduceMotion,
		],
	);

	const handleHandlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (gestureRef.current) return;

		event.stopPropagation();
		const stage = stageRef.current;
		if (!stage) return;

		stopPositionAnimation();
		stopEdgeAnimation();

		const rect = stage.getBoundingClientRect();
		const size = isHorizontal ? rect.width : rect.height;
		const dividerPx = (clampedPos.get() / 100) * size;
		const coord = isHorizontal
			? event.clientX - rect.left
			: event.clientY - rect.top;

		const target = event.currentTarget;
		target.setPointerCapture(event.pointerId);

		gestureRef.current = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			source: "handle",
			target,
			startClientX: event.clientX,
			startClientY: event.clientY,
			grabOffsetPx: coord - dividerPx,
			committed: true,
			samples: [{ t: performance.now(), pct: clampedPos.get() }],
		};

		setIsDragging(true);
	};

	const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (gestureRef.current) return;

		const stage = stageRef.current;
		if (!stage) return;

		const coords = computeRawPx(event.clientX, event.clientY, 0);
		if (!coords) return;

		const target = event.currentTarget;
		const isTouch = event.pointerType === "touch";

		if (!isTouch) {
			target.setPointerCapture(event.pointerId);
			animatePositionTo(clamp(coords.rawPct, 0, 100), {
				spring: jumpSpring,
			});
		}

		gestureRef.current = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			source: "stage",
			target,
			startClientX: event.clientX,
			startClientY: event.clientY,
			grabOffsetPx: 0,
			committed: false,
			samples: [{ t: performance.now(), pct: clampedPos.get() }],
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (!gesture || event.pointerId !== gesture.pointerId) return;

		if (!gesture.committed) {
			const dx = event.clientX - gesture.startClientX;
			const dy = event.clientY - gesture.startClientY;
			const dist = Math.hypot(dx, dy);

			if (gesture.pointerType === "touch") {
				if (dist < TOUCH_DRAG_SLOP) return;
				const primary = isHorizontal ? Math.abs(dx) : Math.abs(dy);
				const cross = isHorizontal ? Math.abs(dy) : Math.abs(dx);
				if (cross > primary) {
					// Yield to native vertical/horizontal page scrolling.
					gestureRef.current = null;
					return;
				}
				gesture.target.setPointerCapture(gesture.pointerId);
			} else if (dist < MOUSE_DRAG_SLOP) {
				return;
			}

			stopPositionAnimation();
			stopEdgeAnimation();
			gesture.committed = true;
			setIsDragging(true);
		}

		applyCommittedMove(event.clientX, event.clientY, gesture);
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		finishGesture(event, false);
	};

	const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		finishGesture(event, true);
	};

	const handleDoubleClick = () => {
		if (disabled) return;
		const resetTarget = clamp(
			Number.isFinite(defaultValue) ? defaultValue : 50,
			0,
			100,
		);
		animatePositionTo(resetTarget, {
			spring: jumpSpring,
			commitOnComplete: true,
			emitImmediate: true,
		});
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;

		const delta = event.shiftKey ? safeLargeStep : safeStep;
		const current = clampedPos.get();
		let next: number | null = null;

		switch (event.key) {
			case "ArrowLeft":
				next = current - delta;
				break;
			case "ArrowRight":
				next = current + delta;
				break;
			case "ArrowUp":
				next = isHorizontal ? current + delta : current - delta;
				break;
			case "ArrowDown":
				next = isHorizontal ? current - delta : current + delta;
				break;
			case "PageUp":
				next = isHorizontal ? current + safeLargeStep : current - safeLargeStep;
				break;
			case "PageDown":
				next = isHorizontal ? current - safeLargeStep : current + safeLargeStep;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = 100;
				break;
			default:
				return;
		}

		event.preventDefault();
		event.stopPropagation();
		stopPositionAnimation();
		stopEdgeAnimation();
		edgeOffset.set(0);

		const clampedNext = roundToPrecision(clamp(next, 0, 100), decimals);
		pos.set(clampedNext);
		updateLabelOpacities(clampedNext);
		setAriaValue((prev) => (prev === clampedNext ? prev : clampedNext));
		emitValueChange(clampedNext);
		emitValueCommit(clampedNext);
	};

	const beforeText = defaultLabelText(beforeLabel);
	const afterText = defaultLabelText(afterLabel);
	const resolvedValueText = formatValueText
		? formatValueText(ariaValue)
		: beforeText && afterText
			? `${ariaValue}% ${beforeText}, ${roundToPrecision(100 - ariaValue, decimals)}% ${afterText}`
			: `${ariaValue}%`;

	const accessibleLabel = ariaLabelledByProp
		? undefined
		: (ariaLabelProp ?? label);

	const resolvedHandle =
		typeof handle === "function"
			? handle({
					position: ariaValue,
					orientation,
					isDragging,
				})
			: handle;

	return (
		<div
			data-slot="before-after-compare"
			data-orientation={orientation}
			data-disabled={disabled ? "true" : undefined}
			className={cn(
				"group/compare relative aspect-16/10 w-full select-none rounded-2xl border-0",
				disabled && "pointer-events-none opacity-60",
				className,
			)}
			{...props}
		>
			<div
				ref={stageRef}
				data-slot="stage"
				onPointerDown={handleStagePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				className={cn(
					"relative grid size-full grid-cols-1 grid-rows-1 overflow-hidden rounded-[inherit] bg-muted/30 after:pointer-events-none after:absolute after:inset-0 after:z-30 after:rounded-[inherit] after:ring-1 after:ring-foreground/10 after:ring-inset",
					isHorizontal ? "touch-pan-y" : "touch-pan-x",
					!disabled && (isHorizontal ? "cursor-ew-resize" : "cursor-ns-resize"),
					classNames?.stage,
				)}
			>
				<div
					data-slot="after"
					className={cn(mediaLayerClasses, classNames?.after)}
				>
					{after}
				</div>

				<motion.div
					data-slot="before"
					className={cn("z-10", mediaLayerClasses, classNames?.before)}
					style={{
						clipPath,
						willChange: isDragging ? "clip-path" : undefined,
					}}
				>
					{before}
				</motion.div>

				{beforeLabel != null ? (
					<motion.span
						ref={beforeLabelRef}
						aria-hidden="true"
						data-slot="before-label"
						style={{ opacity: beforeLabelOpacity }}
						className={cn(
							labelBadgeClasses,
							"top-3 left-3",
							classNames?.beforeLabel,
						)}
					>
						{beforeLabel}
					</motion.span>
				) : null}

				{afterLabel != null ? (
					<motion.span
						ref={afterLabelRef}
						aria-hidden="true"
						data-slot="after-label"
						style={{ opacity: afterLabelOpacity }}
						className={cn(
							labelBadgeClasses,
							isHorizontal ? "top-3 right-3" : "bottom-3 left-3",
							classNames?.afterLabel,
						)}
					>
						{afterLabel}
					</motion.span>
				) : null}

				<motion.div
					aria-hidden="true"
					data-slot="divider"
					style={
						isHorizontal ? { left: positionPercent } : { top: positionPercent }
					}
					className={cn(
						"pointer-events-none absolute z-20 bg-white/95 shadow-[0_0_0_0.5px_rgba(0,0,0,0.28),0_0_12px_rgba(0,0,0,0.24)]",
						isHorizontal
							? "top-0 bottom-0 w-[1.5px] -translate-x-1/2"
							: "right-0 left-0 h-[1.5px] -translate-y-1/2",
						classNames?.divider,
					)}
				/>
			</div>

			<div className="pointer-events-none absolute inset-0 z-30">
				<motion.div
					style={
						isHorizontal ? { left: positionPercent } : { top: positionPercent }
					}
					className={cn(
						"pointer-events-none absolute -translate-x-1/2 -translate-y-1/2",
						isHorizontal ? "top-1/2" : "left-1/2",
					)}
				>
					<motion.div
						ref={handleRef}
						role="slider"
						tabIndex={disabled ? -1 : 0}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={ariaValue}
						aria-valuetext={resolvedValueText}
						aria-orientation={orientation}
						aria-label={accessibleLabel}
						aria-labelledby={ariaLabelledByProp}
						aria-disabled={disabled || undefined}
						data-slot="handle"
						data-dragging={isDragging ? "true" : undefined}
						style={isHorizontal ? { x: edgeOffset } : { y: edgeOffset }}
						animate={{
							scale: isDragging && !shouldReduceMotion ? 0.95 : 1,
						}}
						transition={shouldReduceMotion ? { duration: 0 } : pressSpring}
						onPointerDown={handleHandlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerCancel={handlePointerCancel}
						onDoubleClick={handleDoubleClick}
						onKeyDown={handleKeyDown}
						className={cn(
							"group/handle pointer-events-auto relative flex touch-none items-center justify-center rounded-full outline-none before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							!disabled &&
								(isHorizontal ? "cursor-ew-resize" : "cursor-ns-resize"),
							classNames?.handle,
						)}
					>
						{resolvedHandle ?? (
							<DefaultHandle
								isHorizontal={isHorizontal}
								isDragging={isDragging}
								shouldReduceMotion={shouldReduceMotion}
							/>
						)}
					</motion.div>
				</motion.div>
			</div>
		</div>
	);
}
