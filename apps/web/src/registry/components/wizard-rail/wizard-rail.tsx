"use client";

import {
	Check,
	ChevronLeft,
	ChevronRight,
	Loader2,
	RotateCcw,
} from "lucide-react";
import {
	AnimatePresence,
	MotionConfig,
	motion,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

export type WizardRailVariant = "default" | "minimal" | "segmented";
export type WizardRailSize = "sm" | "md";

export interface WizardRailStep {
	/** Unique identifier for the step. */
	id: string;
	/** Concise display title shown on the rail. */
	title: string;
	/** Optional subtitle shown beneath the title on wider containers. */
	description?: string;
	/** Optional icon rendered inside the step node while active or upcoming. */
	icon?: ReactNode;
	/** Optional panel content displayed when this step is active. */
	content?: ReactNode;
	/** Marks the step as optional, enabling a Skip action when active. */
	optional?: boolean;
	/** Prevents navigating to or through this step. */
	disabled?: boolean;
	/** Overrides the primary Next/Complete button label on this step. */
	nextLabel?: string;
}

export interface WizardRailClassNames {
	/** Outer wizard root container. */
	root?: string;
	/** Navigation landmark wrapping the step rail. */
	rail?: string;
	/** Background connector track spanning between step centers. */
	track?: string;
	/** Animated foreground connector bar showing current progress. */
	connector?: string;
	/** Individual step button along the rail. */
	step?: string;
	/** Circular step indicator node holding the number, icon, or checkmark. */
	indicator?: string;
	/** Step title text beneath or inside each step item. */
	label?: string;
	/** Animated content panel displaying the active step body. */
	panel?: string;
	/** Bottom action bar containing Back, step count, Skip, and Next controls. */
	actions?: string;
	/** Back navigation button. */
	backButton?: string;
	/** Primary Continue / Complete action button. */
	nextButton?: string;
}

export interface WizardRailProps
	extends Omit<ComponentProps<"div">, "children" | "onChange"> {
	/** Ordered list of wizard steps. */
	steps: WizardRailStep[];
	/** Controlled 0-based active step index. */
	activeStep?: number;
	/** Initial 0-based active step index when uncontrolled. Defaults to `0`. */
	defaultStep?: number;
	/** Called whenever the active step changes. */
	onStepChange?: (stepIndex: number, step: WizardRailStep) => void;
	/**
	 * Sync or async guard run before advancing from the current step.
	 * Return `false` to prevent advancing and trigger inline validation feedback.
	 */
	onBeforeNext?: (
		stepIndex: number,
		step: WizardRailStep,
	) => boolean | Promise<boolean>;
	/** Called when the user completes the final step. */
	onComplete?: () => void | Promise<void>;
	/** Called when the user restarts the wizard from the completed state. */
	onReset?: () => void;
	/** Controlled completion state. */
	completed?: boolean;
	/** Optional view rendered in the panel once all steps are completed. */
	completedContent?: ReactNode;
	/**
	 * When `true` (default), clicking unvisited future steps is locked until
	 * earlier steps are reached, while visited steps stay clickable.
	 * Set to `false` to allow jumping to any non-disabled step.
	 */
	linear?: boolean;
	/** Visual presentation style. Defaults to `"default"`. */
	variant?: WizardRailVariant;
	/** Control density. Defaults to `"md"`. */
	size?: WizardRailSize;
	/** Whether to render the built-in Back / Next action bar. Defaults to `true`. */
	showActions?: boolean;
	/** Whether to display the tabular step counter in the action bar. Defaults to `true`. */
	showStepCount?: boolean;
	/** Whether to display step descriptions below titles on wider containers. Defaults to `true`. */
	showDescriptions?: boolean;
	/** Label for the Back button. Defaults to `"Back"`. */
	backLabel?: string;
	/** Default label for the Next button. Defaults to `"Continue"`. */
	nextLabel?: string;
	/** Label for the primary button on the final step. Defaults to `"Complete"`. */
	completeLabel?: string;
	/** Label for the optional Skip button. Defaults to `"Skip"`. */
	skipLabel?: string;
	/** Label for the Restart button shown after completion. Defaults to `"Start over"`. */
	resetLabel?: string;
	/** Inline validation message shown below the active step content. */
	errorMessage?: string;
	/** Accessible label for the step navigation landmark. Defaults to `"Wizard steps"`. */
	"aria-label"?: string;
	/** Granular Tailwind class overrides for internal slots. */
	classNames?: WizardRailClassNames;
}

const CONNECTOR_SPRING = {
	type: "spring" as const,
	visualDuration: 0.34,
	bounce: 0,
};

const HALO_SPRING = {
	type: "spring" as const,
	visualDuration: 0.28,
	bounce: 0,
};

const CHECK_SPRING = {
	type: "spring" as const,
	visualDuration: 0.24,
	bounce: 0,
};

const CONTENT_EASE = [0.23, 1, 0.32, 1] as const;

function clampStepIndex(index: number, count: number): number {
	if (count <= 0) return 0;
	return Math.min(Math.max(0, Math.trunc(index)), count - 1);
}

function findNextEnabledStep(
	steps: WizardRailStep[],
	fromIndex: number,
	delta: 1 | -1,
): number | null {
	let candidate = fromIndex + delta;
	while (candidate >= 0 && candidate < steps.length) {
		if (!steps[candidate]?.disabled) return candidate;
		candidate += delta;
	}
	return null;
}

interface AnimatedPanelHeightProps {
	children: ReactNode;
	reducedMotion: boolean;
	className?: string;
}

function AnimatedPanelHeight({
	children,
	reducedMotion,
	className,
}: AnimatedPanelHeightProps) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | "auto">("auto");
	const hasMeasuredRef = useRef(false);

	useEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		const measure = () => {
			const nextHeight = Math.ceil(el.getBoundingClientRect().height);
			if (nextHeight > 0) {
				setHeight(nextHeight);
				hasMeasuredRef.current = true;
			}
		};

		measure();

		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<motion.div
			animate={{ height }}
			className="relative overflow-hidden"
			initial={false}
			transition={
				reducedMotion || !hasMeasuredRef.current
					? { duration: 0 }
					: { duration: 0.24, ease: CONTENT_EASE }
			}
		>
			<div className={className} ref={innerRef}>
				{children}
			</div>
		</motion.div>
	);
}

interface CheckGlyphProps {
	reducedMotion: boolean;
	size: WizardRailSize;
}

function CheckGlyph({ reducedMotion, size }: CheckGlyphProps) {
	const dimension = size === "sm" ? 13 : 14;
	return (
		<svg
			aria-hidden="true"
			className="block shrink-0"
			fill="none"
			height={dimension}
			viewBox="0 0 16 16"
			width={dimension}
		>
			<motion.path
				animate={{ pathLength: 1, opacity: 1 }}
				d="M3.5 8.5L6.5 11.5L12.5 4.75"
				initial={
					reducedMotion
						? { pathLength: 1, opacity: 1 }
						: { pathLength: 0, opacity: 0.4 }
				}
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				transition={reducedMotion ? { duration: 0.12 } : CHECK_SPRING}
			/>
		</svg>
	);
}

export function WizardRail({
	steps,
	activeStep: controlledStep,
	defaultStep = 0,
	onStepChange,
	onBeforeNext,
	onComplete,
	onReset,
	completed: controlledCompleted,
	completedContent,
	linear = true,
	variant = "default",
	size = "md",
	showActions = true,
	showStepCount = true,
	showDescriptions = true,
	backLabel = "Back",
	nextLabel = "Continue",
	completeLabel = "Complete",
	skipLabel = "Skip",
	resetLabel = "Start over",
	errorMessage,
	"aria-label": ariaLabel = "Wizard steps",
	className,
	classNames,
	...props
}: WizardRailProps) {
	const stepCount = steps.length;
	const instanceId = useId();
	const haloLayoutId = `wizard-rail-halo-${instanceId}`;
	const panelId = `wizard-rail-panel-${instanceId}`;
	const prefersReducedMotion = useReducedMotion();
	const reducedMotion = Boolean(prefersReducedMotion);

	const isStepControlled = controlledStep !== undefined;
	const isCompletedControlled = controlledCompleted !== undefined;

	const [internalStep, setInternalStep] = useState(() =>
		clampStepIndex(defaultStep, stepCount),
	);
	const [internalCompleted, setInternalCompleted] = useState(false);

	const currentStepIndex = clampStepIndex(
		isStepControlled ? controlledStep : internalStep,
		stepCount,
	);
	const isCompleted = isCompletedControlled
		? controlledCompleted
		: internalCompleted;

	const [highestVisited, setHighestVisited] = useState(() =>
		clampStepIndex(isStepControlled ? controlledStep : defaultStep, stepCount),
	);
	const [direction, setDirection] = useState<1 | -1>(1);
	const [isPending, setIsPending] = useState(false);
	const [hoveredStep, setHoveredStep] = useState<number | null>(null);
	const [isShaking, setIsShaking] = useState(false);
	const [internalError, setInternalError] = useState<string | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const [segmentedRatios, setSegmentedRatios] = useState<number[] | null>(null);

	const stepButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const segmentedTrackRef = useRef<HTMLDivElement>(null);
	const prevStepRef = useRef(currentStepIndex);
	const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const triggerShake = useCallback(() => {
		if (reducedMotion) return;
		if (shakeTimerRef.current) {
			clearTimeout(shakeTimerRef.current);
		}
		setIsShaking(true);
		shakeTimerRef.current = setTimeout(() => {
			setIsShaking(false);
			shakeTimerRef.current = null;
		}, 300);
	}, [reducedMotion]);

	useEffect(() => {
		return () => {
			if (shakeTimerRef.current) {
				clearTimeout(shakeTimerRef.current);
			}
		};
	}, []);

	// Sync direction & highestVisited when activeStep is driven externally.
	useEffect(() => {
		if (currentStepIndex !== prevStepRef.current) {
			setDirection(currentStepIndex >= prevStepRef.current ? 1 : -1);
			prevStepRef.current = currentStepIndex;
			setInternalError(null);
		}
		setHighestVisited((prev) =>
			Math.min(Math.max(prev, currentStepIndex), Math.max(0, stepCount - 1)),
		);
	}, [currentStepIndex, stepCount]);

	// Keep internal step clamped if `steps` shrinks dynamically.
	useEffect(() => {
		if (!isStepControlled) {
			setInternalStep((prev) => clampStepIndex(prev, stepCount));
		}
	}, [isStepControlled, stepCount]);

	const isSegmented = variant === "segmented";
	const isMinimal = variant === "minimal";

	// Measure exact pill centers in segmented mode so the growing rail lands dead center.
	useLayoutEffect(() => {
		if (!isSegmented || stepCount <= 1) {
			setSegmentedRatios(null);
			return;
		}

		const measure = () => {
			const track = segmentedTrackRef.current;
			if (!track) return;
			const trackRect = track.getBoundingClientRect();
			if (trackRect.width <= 0) return;

			const ratios: number[] = [];
			for (let i = 0; i < stepCount; i += 1) {
				const btn = stepButtonRefs.current[i];
				if (!btn) {
					ratios.push(i / (stepCount - 1));
					continue;
				}
				const rect = btn.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const ratio = (centerX - trackRect.left) / trackRect.width;
				ratios.push(Math.min(1, Math.max(0, ratio)));
			}
			setSegmentedRatios(ratios);
		};

		measure();
		if (typeof ResizeObserver === "undefined") return;
		const track = segmentedTrackRef.current;
		if (!track) return;
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		for (let i = 0; i < stepCount; i += 1) {
			const btn = stepButtonRefs.current[i];
			if (btn) observer.observe(btn);
		}
		return () => observer.disconnect();
	}, [isSegmented, stepCount, currentStepIndex, isCompleted, size]);

	const activeStepObj = steps[currentStepIndex];
	const nextEnabledIndex = useMemo(
		() => findNextEnabledStep(steps, currentStepIndex, 1),
		[steps, currentStepIndex],
	);
	const prevEnabledIndex = useMemo(
		() => findNextEnabledStep(steps, currentStepIndex, -1),
		[steps, currentStepIndex],
	);

	const isLastStep = nextEnabledIndex === null;
	const isFirstStep = prevEnabledIndex === null;

	const hasAnyContent = useMemo(
		() =>
			steps.some((step) => step.content !== undefined) ||
			completedContent !== undefined,
		[steps, completedContent],
	);

	const resolvedError = errorMessage ?? internalError;

	const commitStep = useCallback(
		(targetIndex: number, nextDirection: 1 | -1) => {
			if (stepCount === 0) return;
			const clamped = clampStepIndex(targetIndex, stepCount);
			const targetStep = steps[clamped];
			if (!targetStep || targetStep.disabled) return;

			setDirection(nextDirection);
			prevStepRef.current = clamped;
			setInternalError(null);
			setHighestVisited((prev) => Math.max(prev, clamped));

			if (!isCompletedControlled) {
				setInternalCompleted(false);
			}
			if (!isStepControlled) {
				setInternalStep(clamped);
			}

			setAnnouncement(
				`Step ${clamped + 1} of ${stepCount}: ${targetStep.title}`,
			);
			onStepChange?.(clamped, targetStep);
		},
		[stepCount, steps, isCompletedControlled, isStepControlled, onStepChange],
	);

	const isStepReachable = useCallback(
		(index: number) => {
			const step = steps[index];
			if (!step || step.disabled) return false;
			if (!linear) return true;
			if (isCompleted) return true;
			return index <= highestVisited;
		},
		[steps, linear, isCompleted, highestVisited],
	);

	const handleStepSelect = useCallback(
		(index: number) => {
			if (isPending) return;
			if (!isStepReachable(index)) return;
			if (!isCompleted && index === currentStepIndex) return;
			const nextDir: 1 | -1 = index >= currentStepIndex ? 1 : -1;
			commitStep(index, nextDir);
		},
		[isPending, isStepReachable, isCompleted, currentStepIndex, commitStep],
	);

	const handleBack = useCallback(() => {
		if (isPending) return;
		if (isCompleted) {
			const lastIndex = Math.max(0, stepCount - 1);
			commitStep(lastIndex, -1);
			return;
		}
		if (prevEnabledIndex === null) return;
		commitStep(prevEnabledIndex, -1);
	}, [isPending, isCompleted, stepCount, prevEnabledIndex, commitStep]);

	const handleNext = useCallback(async () => {
		if (isPending || !activeStepObj) return;

		if (onBeforeNext) {
			setIsPending(true);
			try {
				const allowed = await onBeforeNext(currentStepIndex, activeStepObj);
				if (!allowed) {
					triggerShake();
					if (!errorMessage) {
						setInternalError("Please complete this step before continuing.");
					}
					return;
				}
			} finally {
				setIsPending(false);
			}
		}

		setInternalError(null);

		if (isLastStep) {
			setIsPending(true);
			try {
				await onComplete?.();
				if (!isCompletedControlled) {
					setInternalCompleted(true);
				}
				setHighestVisited(Math.max(0, stepCount - 1));
				setAnnouncement("All steps completed");
			} finally {
				setIsPending(false);
			}
			return;
		}

		if (nextEnabledIndex !== null) {
			commitStep(nextEnabledIndex, 1);
		}
	}, [
		isPending,
		activeStepObj,
		onBeforeNext,
		currentStepIndex,
		triggerShake,
		errorMessage,
		isLastStep,
		onComplete,
		isCompletedControlled,
		stepCount,
		nextEnabledIndex,
		commitStep,
	]);

	const handleSkip = useCallback(() => {
		if (isPending || !activeStepObj?.optional) return;
		setInternalError(null);
		if (isLastStep) {
			void handleNext();
			return;
		}
		if (nextEnabledIndex !== null) {
			commitStep(nextEnabledIndex, 1);
		}
	}, [
		isPending,
		activeStepObj,
		isLastStep,
		handleNext,
		nextEnabledIndex,
		commitStep,
	]);

	const handleReset = useCallback(() => {
		if (isPending) return;
		setDirection(-1);
		setInternalError(null);
		setHighestVisited(0);
		prevStepRef.current = 0;
		if (!isCompletedControlled) {
			setInternalCompleted(false);
		}
		if (!isStepControlled) {
			setInternalStep(0);
		}
		const firstStep = steps[0];
		if (firstStep) {
			setAnnouncement(
				`Restarted at step 1 of ${stepCount}: ${firstStep.title}`,
			);
			onStepChange?.(0, firstStep);
		}
		onReset?.();
	}, [
		isPending,
		isCompletedControlled,
		isStepControlled,
		steps,
		stepCount,
		onStepChange,
		onReset,
	]);

	const handleRailKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>, index: number) => {
			if (stepCount <= 1) return;

			let targetIndex: number | null = null;
			if (event.key === "ArrowRight") {
				targetIndex = (index + 1) % stepCount;
			} else if (event.key === "ArrowLeft") {
				targetIndex = (index - 1 + stepCount) % stepCount;
			} else if (event.key === "Home") {
				targetIndex = 0;
			} else if (event.key === "End") {
				targetIndex = stepCount - 1;
			}

			if (targetIndex === null) return;
			event.preventDefault();
			stepButtonRefs.current[targetIndex]?.focus();
		},
		[stepCount],
	);

	if (stepCount === 0) return null;

	const getRatioForIndex = (index: number) => {
		if (stepCount <= 1) return 1;
		if (
			isSegmented &&
			segmentedRatios &&
			segmentedRatios[index] !== undefined
		) {
			return segmentedRatios[index];
		}
		return index / (stepCount - 1);
	};

	const progress =
		stepCount <= 1 ? 1 : isCompleted ? 1 : getRatioForIndex(currentStepIndex);

	const hoverPreviewProgress =
		hoveredStep !== null &&
		stepCount > 1 &&
		!isCompleted &&
		hoveredStep > currentStepIndex &&
		isStepReachable(hoveredStep)
			? getRatioForIndex(hoveredStep)
			: 0;

	const indicatorPx = size === "sm" ? 28 : 32;
	const trackInset = `calc(100% / ${stepCount * 2})`;

	const primaryButtonLabel =
		activeStepObj?.nextLabel ?? (isLastStep ? completeLabel : nextLabel);

	const canReset = !isCompletedControlled || Boolean(onReset);

	return (
		<MotionConfig reducedMotion="user">
			<div
				className={cn(
					"@container w-full select-none",
					variant === "default" &&
						"rounded-2xl border border-border/80 bg-card/90 shadow-xs",
					variant === "segmented" &&
						"rounded-2xl border border-border/80 bg-card/90 shadow-xs",
					className,
					classNames?.root,
				)}
				data-completed={isCompleted ? "true" : "false"}
				data-size={size}
				data-slot="wizard-rail"
				data-variant={variant}
				{...props}
			>
				{/* Screen-reader live region for step progression */}
				<span aria-live="polite" className="sr-only">
					{announcement}
				</span>

				{/* Horizontal Step Rail */}
				<nav
					aria-label={ariaLabel}
					className={cn(
						"relative",
						variant === "default" &&
							cn(
								"@[440px]:px-6 px-4 pt-5 pb-4",
								(hasAnyContent || showActions) && "border-border/70 border-b",
							),
						variant === "segmented" &&
							cn(
								"@[440px]:px-5 px-3.5 py-4",
								(hasAnyContent || showActions) && "border-border/70 border-b",
							),
						isMinimal && "px-1 py-2",
						classNames?.rail,
					)}
					data-slot="wizard-rail-nav"
				>
					{isSegmented ? (
						<div className="relative">
							{/* Continuous hairline connector behind segmented pills */}
							{stepCount > 1 ? (
								<div
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute top-1/2 right-4 left-4 z-0 h-[1.5px] -translate-y-1/2 overflow-hidden rounded-full bg-border",
										classNames?.track,
									)}
									data-slot="wizard-rail-track"
									ref={segmentedTrackRef}
								>
									<motion.div
										animate={{
											opacity: hoverPreviewProgress > progress ? 1 : 0,
											scaleX: Math.max(progress, hoverPreviewProgress),
										}}
										className="absolute inset-0 origin-left rounded-full bg-foreground/22"
										initial={false}
										transition={
											reducedMotion
												? { duration: 0.1 }
												: { duration: 0.18, ease: CONTENT_EASE }
										}
									/>
									<motion.div
										animate={{ scaleX: progress }}
										className={cn(
											"absolute inset-0 origin-left rounded-full bg-foreground",
											classNames?.connector,
										)}
										data-slot="wizard-rail-connector"
										initial={false}
										transition={
											reducedMotion ? { duration: 0.12 } : CONNECTOR_SPRING
										}
									/>
								</div>
							) : null}

							<ol className="relative z-10 flex items-center justify-between @[440px]:gap-2 gap-1.5">
								{steps.map((step, index) => {
									const state = isCompleted
										? "completed"
										: index < currentStepIndex
											? "completed"
											: index === currentStepIndex
												? "active"
												: "upcoming";
									const reachable = isStepReachable(index);
									const isActive = state === "active";
									const isDone = state === "completed";

									return (
										<li className="flex shrink-0 items-center" key={step.id}>
											<button
												aria-controls={hasAnyContent ? panelId : undefined}
												aria-current={isActive ? "step" : undefined}
												aria-disabled={!reachable || undefined}
												aria-label={`Step ${index + 1} of ${stepCount}: ${step.title}, ${state}`}
												className={cn(
													"group relative inline-flex items-center gap-2 rounded-full border transition-[color,background-color,border-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
													size === "sm"
														? "h-8 @[440px]:px-2.5 px-2 text-xs"
														: "h-9 @[440px]:px-3 px-2.5 text-xs",
													isActive &&
														"border-foreground bg-card text-foreground shadow-xs",
													isDone &&
														"border-foreground/20 bg-card text-foreground",
													state === "upcoming" &&
														"border-border bg-card text-muted-foreground",
													reachable &&
														!isActive &&
														"cursor-pointer active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:border-foreground/45 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
													!reachable && "cursor-default opacity-65",
													"motion-reduce:active:scale-100",
													classNames?.step,
												)}
												data-slot="wizard-rail-step"
												data-state={state}
												data-step-index={index}
												onClick={() => handleStepSelect(index)}
												onKeyDown={(e) => handleRailKeyDown(e, index)}
												onMouseEnter={() => {
													if (reachable) setHoveredStep(index);
												}}
												onMouseLeave={() => {
													setHoveredStep((prev) =>
														prev === index ? null : prev,
													);
												}}
												ref={(node) => {
													stepButtonRefs.current[index] = node;
												}}
												type="button"
											>
												{isActive ? (
													<motion.span
														aria-hidden="true"
														className="pointer-events-none absolute -inset-[3px] rounded-full ring-2 ring-foreground/12 dark:ring-foreground/18"
														layoutId={haloLayoutId}
														transition={
															reducedMotion ? { duration: 0.1 } : HALO_SPRING
														}
													/>
												) : null}

												<span
													className={cn(
														"flex shrink-0 items-center justify-center rounded-full font-medium tabular-nums transition-colors duration-150",
														size === "sm"
															? "size-4.5 text-[10px]"
															: "size-5 text-[11px]",
														isDone && "bg-foreground text-background",
														isActive && "bg-foreground text-background",
														state === "upcoming" &&
															"bg-muted text-muted-foreground",
														classNames?.indicator,
													)}
													data-slot="wizard-rail-indicator"
												>
													{isDone ? (
														<CheckGlyph
															reducedMotion={reducedMotion}
															size="sm"
														/>
													) : (
														(step.icon ?? index + 1)
													)}
												</span>

												<span
													className={cn(
														"max-w-[7.5rem] truncate font-medium tracking-tight",
														!isActive && "@[460px]:inline hidden",
														classNames?.label,
													)}
												>
													{step.title}
												</span>
											</button>
										</li>
									);
								})}
							</ol>
						</div>
					) : (
						<div className="relative">
							{/* Continuous center-to-center horizontal rail track */}
							{stepCount > 1 ? (
								<div
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute z-0 h-[1.5px] -translate-y-1/2 overflow-hidden rounded-full bg-border",
										classNames?.track,
									)}
									data-slot="wizard-rail-track"
									style={{
										left: trackInset,
										right: trackInset,
										top: `${indicatorPx / 2 + 4}px`,
									}}
								>
									{/* Subtle fine-pointer hover preview along the rail */}
									<motion.div
										animate={{
											opacity: hoverPreviewProgress > progress ? 1 : 0,
											scaleX: Math.max(progress, hoverPreviewProgress),
										}}
										className="absolute inset-0 origin-left rounded-full bg-foreground/22"
										initial={false}
										transition={
											reducedMotion
												? { duration: 0.1 }
												: { duration: 0.18, ease: CONTENT_EASE }
										}
									/>

									{/* Primary growing connector */}
									<motion.div
										animate={{ scaleX: progress }}
										className={cn(
											"absolute inset-0 origin-left rounded-full bg-foreground",
											classNames?.connector,
										)}
										data-slot="wizard-rail-connector"
										initial={false}
										transition={
											reducedMotion ? { duration: 0.12 } : CONNECTOR_SPRING
										}
									/>
								</div>
							) : null}

							<ol
								className="relative z-10 grid items-start"
								style={{
									gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))`,
								}}
							>
								{steps.map((step, index) => {
									const state = isCompleted
										? "completed"
										: index < currentStepIndex
											? "completed"
											: index === currentStepIndex
												? "active"
												: "upcoming";
									const reachable = isStepReachable(index);
									const isActive = state === "active";
									const isDone = state === "completed";

									return (
										<li
											className="flex min-w-0 flex-col items-center"
											key={step.id}
										>
											<button
												aria-controls={hasAnyContent ? panelId : undefined}
												aria-current={isActive ? "step" : undefined}
												aria-disabled={!reachable || undefined}
												aria-label={`Step ${index + 1} of ${stepCount}: ${step.title}, ${state}`}
												className={cn(
													"group flex w-full min-w-0 flex-col items-center rounded-xl px-1 py-1 text-center transition-[opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
													isMinimal
														? "focus-visible:ring-offset-background"
														: "focus-visible:ring-offset-card",
													reachable &&
														!isActive &&
														"cursor-pointer active:scale-[0.97]",
													!reachable && "cursor-default",
													"motion-reduce:active:scale-100",
													classNames?.step,
												)}
												data-slot="wizard-rail-step"
												data-state={state}
												data-step-index={index}
												onClick={() => handleStepSelect(index)}
												onKeyDown={(e) => handleRailKeyDown(e, index)}
												onMouseEnter={() => {
													if (reachable) setHoveredStep(index);
												}}
												onMouseLeave={() => {
													setHoveredStep((prev) =>
														prev === index ? null : prev,
													);
												}}
												ref={(node) => {
													stepButtonRefs.current[index] = node;
												}}
												type="button"
											>
												{/* Node indicator circle */}
												<motion.span
													animate={
														isActive && isShaking && !reducedMotion
															? { x: [0, -4, 4, -2, 0] }
															: { x: 0 }
													}
													className={cn(
														"relative flex shrink-0 items-center justify-center rounded-full border font-medium tabular-nums transition-[color,background-color,border-color,box-shadow] duration-150",
														size === "sm"
															? "size-7 text-[11px]"
															: "size-8 text-xs",
														isMinimal
															? "ring-4 ring-background"
															: "ring-4 ring-card",
														isDone &&
															"border-foreground bg-foreground text-background",
														isActive &&
															"border-foreground bg-background text-foreground shadow-xs",
														state === "upcoming" &&
															"border-border bg-background text-muted-foreground",
														reachable &&
															state === "upcoming" &&
															"[@media(hover:hover)_and_(pointer:fine)]:group-hover:border-foreground/50 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-foreground",
														reachable &&
															isDone &&
															"[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-85",
														step.disabled && "opacity-45",
														classNames?.indicator,
													)}
													data-slot="wizard-rail-indicator"
													transition={{ duration: 0.28, ease: CONTENT_EASE }}
												>
													{isActive ? (
														<motion.span
															aria-hidden="true"
															className="pointer-events-none absolute -inset-[4px] rounded-full ring-2 ring-foreground/15 dark:ring-foreground/22"
															layoutId={haloLayoutId}
															transition={
																reducedMotion ? { duration: 0.1 } : HALO_SPRING
															}
														/>
													) : null}

													<AnimatePresence initial={false} mode="wait">
														{isDone ? (
															<motion.span
																animate={{ opacity: 1, scale: 1 }}
																className="flex items-center justify-center"
																exit={
																	reducedMotion
																		? { opacity: 0 }
																		: { opacity: 0, scale: 0.85 }
																}
																initial={
																	reducedMotion
																		? { opacity: 1 }
																		: { opacity: 0, scale: 0.85 }
																}
																key="done"
																transition={{ duration: 0.14 }}
															>
																<CheckGlyph
																	reducedMotion={reducedMotion}
																	size={size}
																/>
															</motion.span>
														) : (
															<motion.span
																animate={{ opacity: 1, scale: 1 }}
																className="flex items-center justify-center"
																exit={
																	reducedMotion
																		? { opacity: 0 }
																		: { opacity: 0, scale: 0.85 }
																}
																initial={
																	reducedMotion
																		? { opacity: 1 }
																		: { opacity: 0, scale: 0.85 }
																}
																key="index"
																transition={{ duration: 0.14 }}
															>
																{step.icon ?? index + 1}
															</motion.span>
														)}
													</AnimatePresence>
												</motion.span>

												{/* Step label & optional description */}
												<span
													className={cn(
														"mt-2 block w-full truncate px-0.5 font-medium tracking-tight transition-colors duration-150",
														size === "sm"
															? "@[420px]:text-xs text-[11px]"
															: "@[420px]:text-[13px] text-[11px]",
														isActive && "text-foreground",
														isDone && "text-foreground/85",
														state === "upcoming" && "text-muted-foreground",
														reachable &&
															!isActive &&
															"[@media(hover:hover)_and_(pointer:fine)]:group-hover:text-foreground",
														classNames?.label,
													)}
												>
													{step.title}
												</span>

												{showDescriptions && step.description ? (
													<span className="mt-0.5 @[460px]:block hidden w-full truncate px-1 text-[11px] text-muted-foreground/85 leading-snug">
														{step.description}
													</span>
												) : null}
											</button>
										</li>
									);
								})}
							</ol>
						</div>
					)}
				</nav>

				{/* Directional Step Content Panel */}
				{hasAnyContent ? (
					<AnimatedPanelHeight
						className={cn(
							variant === "default" && "@[440px]:px-6 px-4 @[440px]:py-5 py-4",
							variant === "segmented" &&
								"@[440px]:px-5 px-4 @[440px]:py-5 py-4",
							isMinimal && "px-1 py-4",
							classNames?.panel,
						)}
						reducedMotion={reducedMotion}
					>
						<div data-slot="wizard-rail-panel" id={panelId}>
							<AnimatePresence
								custom={direction}
								initial={false}
								mode="popLayout"
							>
								<motion.div
									animate={{
										opacity: 1,
										x: 0,
										filter: "blur(0px)",
									}}
									className="w-full"
									custom={direction}
									exit={
										reducedMotion
											? { opacity: 0 }
											: {
													opacity: 0,
													x: direction * -14,
													filter: "blur(2px)",
												}
									}
									initial={
										reducedMotion
											? { opacity: 0 }
											: {
													opacity: 0,
													x: direction * 14,
													filter: "blur(2px)",
												}
									}
									key={
										isCompleted
											? "__completed__"
											: (activeStepObj?.id ?? currentStepIndex)
									}
									transition={{
										duration: reducedMotion ? 0.14 : 0.22,
										ease: CONTENT_EASE,
									}}
								>
									{isCompleted
										? (completedContent ?? (
												<div className="flex flex-col items-center justify-center py-4 text-center">
													<span className="mb-2.5 flex size-9 items-center justify-center rounded-full bg-foreground text-background">
														<Check className="size-4" strokeWidth={2.25} />
													</span>
													<p className="font-medium text-foreground text-sm tracking-tight">
														All steps complete
													</p>
													<p className="mt-0.5 text-muted-foreground text-xs">
														Every stage in this workflow is finished.
													</p>
												</div>
											))
										: (activeStepObj?.content ?? null)}
								</motion.div>
							</AnimatePresence>

							{/* Inline validation error */}
							<AnimatePresence initial={false}>
								{resolvedError ? (
									<motion.p
										animate={{ opacity: 1, y: 0 }}
										className="mt-3 text-destructive text-xs leading-relaxed"
										exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
										initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
										role="alert"
										transition={{ duration: 0.16, ease: CONTENT_EASE }}
									>
										{resolvedError}
									</motion.p>
								) : null}
							</AnimatePresence>
						</div>
					</AnimatedPanelHeight>
				) : resolvedError ? (
					<div
						className={cn("@[440px]:px-6 px-4 pt-2 pb-1", isMinimal && "px-1")}
					>
						<p className="text-destructive text-xs" role="alert">
							{resolvedError}
						</p>
					</div>
				) : null}

				{/* Back / Step Counter / Skip / Next Footer */}
				{showActions ? (
					<div
						className={cn(
							"flex items-center justify-between gap-2",
							variant === "default" &&
								"border-border/70 border-t @[440px]:px-6 px-4 @[440px]:py-3.5 py-3",
							variant === "segmented" &&
								"border-border/70 border-t @[440px]:px-5 px-4 @[440px]:py-3.5 py-3",
							isMinimal && "px-1 pt-3",
							classNames?.actions,
						)}
						data-slot="wizard-rail-actions"
					>
						<button
							className={cn(
								"group inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-background font-medium text-foreground transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-[13px]",
								isFirstStep && !isCompleted
									? "pointer-events-none opacity-40"
									: "cursor-pointer active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground",
								"motion-reduce:active:scale-100",
								classNames?.backButton,
							)}
							data-slot="wizard-rail-back"
							disabled={(isFirstStep && !isCompleted) || isPending}
							onClick={handleBack}
							type="button"
						>
							<ChevronLeft
								aria-hidden="true"
								className={cn(
									"size-3.5 shrink-0 transition-transform duration-150 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-0.5",
								)}
							/>
							<span>{backLabel}</span>
						</button>

						{showStepCount ? (
							<span
								aria-hidden="true"
								className="@[360px]:inline-flex hidden text-muted-foreground text-xs tabular-nums"
							>
								{isCompleted
									? `${stepCount} / ${stepCount} · Done`
									: `Step ${currentStepIndex + 1} of ${stepCount}`}
							</span>
						) : null}

						<div className="flex shrink-0 items-center gap-1.5">
							{!isCompleted && activeStepObj?.optional ? (
								<button
									className={cn(
										"inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg px-2.5 font-medium text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
										size === "sm" ? "h-8 text-xs" : "h-9 text-[13px]",
										"motion-reduce:active:scale-100",
									)}
									data-slot="wizard-rail-skip"
									disabled={isPending}
									onClick={handleSkip}
									type="button"
								>
									{skipLabel}
								</button>
							) : null}

							{isCompleted ? (
								canReset ? (
									<button
										className={cn(
											"inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-foreground font-medium text-background transition-[opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-90",
											size === "sm"
												? "h-8 px-3 text-xs"
												: "h-9 px-3.5 text-[13px]",
											"motion-reduce:active:scale-100",
											classNames?.nextButton,
										)}
										data-slot="wizard-rail-reset"
										disabled={isPending}
										onClick={handleReset}
										type="button"
									>
										<RotateCcw
											aria-hidden="true"
											className="size-3.5 shrink-0"
										/>
										<span>{resetLabel}</span>
									</button>
								) : null
							) : (
								<button
									className={cn(
										"group inline-flex min-w-[6.25rem] shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg bg-foreground font-medium text-background transition-[opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-65 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-90",
										size === "sm"
											? "h-8 px-3 text-xs"
											: "h-9 px-3.5 text-[13px]",
										"motion-reduce:active:scale-100",
										classNames?.nextButton,
									)}
									data-slot="wizard-rail-next"
									disabled={isPending}
									onClick={() => void handleNext()}
									type="button"
								>
									<AnimatePresence initial={false} mode="wait">
										<motion.span
											animate={{ opacity: 1, y: 0 }}
											className="inline-flex items-center gap-1"
											exit={
												reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
											}
											initial={
												reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
											}
											key={
												isPending
													? "pending"
													: `${isLastStep ? "complete" : "next"}-${primaryButtonLabel}`
											}
											transition={{ duration: 0.14, ease: CONTENT_EASE }}
										>
											{isPending ? (
												<Loader2
													aria-hidden="true"
													className="size-3.5 shrink-0 animate-spin"
												/>
											) : null}
											<span>{primaryButtonLabel}</span>
											{!isPending ? (
												isLastStep ? (
													<Check
														aria-hidden="true"
														className="size-3.5 shrink-0"
														strokeWidth={2.25}
													/>
												) : (
													<ChevronRight
														aria-hidden="true"
														className={cn(
															"size-3.5 shrink-0 transition-transform duration-150 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5",
														)}
													/>
												)
											) : null}
										</motion.span>
									</AnimatePresence>
								</button>
							)}
						</div>
					</div>
				) : null}
			</div>
		</MotionConfig>
	);
}
