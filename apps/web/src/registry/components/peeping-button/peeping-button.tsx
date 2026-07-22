"use client";

import {
	MotionConfig,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "motion/react";
import {
	type ComponentPropsWithoutRef,
	type FocusEvent,
	forwardRef,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { cn } from "@/lib/utils";

export interface PeepingButtonProps extends ComponentPropsWithoutRef<"button"> {
	/** Classes applied to the hinged, visible face of the button. */
	coverClassName?: string;
	/** Delay before each peek, or a random range in milliseconds. */
	peekDelay?: number | readonly [min: number, max: number];
	/** How long the eyes remain visible in milliseconds. */
	peekDuration?: number;
	/** Disable the automatic peeking behavior while keeping a usable button. */
	autoPeek?: boolean;
}

const DEFAULT_PEEK_DELAY = [2800, 5200] as const;
const DEFAULT_PEEK_DURATION = 2200;

function resolvePeekDelay(min: number, max: number) {
	return min + Math.random() * (max - min);
}

export const PeepingButton = forwardRef<HTMLButtonElement, PeepingButtonProps>(
	(
		{
			autoPeek = true,
			children,
			className,
			coverClassName,
			disabled,
			onBlur,
			onFocus,
			onPointerEnter,
			onPointerLeave,
			peekDelay = DEFAULT_PEEK_DELAY,
			peekDuration = DEFAULT_PEEK_DURATION,
			type = "button",
			...props
		},
		ref,
	) => {
		const eyesRef = useRef<HTMLSpanElement>(null);
		const [autoOpen, setAutoOpen] = useState(false);
		const [isEngaged, setIsEngaged] = useState(false);
		const [isPageVisible, setIsPageVisible] = useState(true);
		const reduceMotion = useReducedMotion();

		const pupilX = useMotionValue(0);
		const pupilY = useMotionValue(0);
		const smoothPupilX = useSpring(pupilX, {
			duration: 0.35,
			bounce: 0.16,
		});
		const smoothPupilY = useSpring(pupilY, {
			duration: 0.35,
			bounce: 0.16,
		});
		const pupilTransform = useMotionTemplate`translate3d(calc(-50% + ${smoothPupilX}px), calc(-50% + ${smoothPupilY}px), 0)`;
		const peekDelayStart =
			typeof peekDelay === "number" ? peekDelay : peekDelay[0];
		const peekDelayEnd =
			typeof peekDelay === "number" ? peekDelay : peekDelay[1];
		const peekDelayMin = Math.min(peekDelayStart, peekDelayEnd);
		const peekDelayMax = Math.max(peekDelayStart, peekDelayEnd);

		const canPeek =
			autoPeek && !disabled && isPageVisible && reduceMotion !== true;
		const isOpen = canPeek && autoOpen && !isEngaged;

		useEffect(() => {
			function handleVisibilityChange() {
				const visible = document.visibilityState === "visible";
				setIsPageVisible(visible);
				if (!visible) setAutoOpen(false);
			}

			handleVisibilityChange();
			document.addEventListener("visibilitychange", handleVisibilityChange);
			return () =>
				document.removeEventListener(
					"visibilitychange",
					handleVisibilityChange,
				);
		}, []);

		useEffect(() => {
			if (!canPeek || isEngaged) {
				setAutoOpen(false);
				return;
			}

			const timeout = window.setTimeout(
				() => setAutoOpen((open) => !open),
				autoOpen ? peekDuration : resolvePeekDelay(peekDelayMin, peekDelayMax),
			);

			return () => window.clearTimeout(timeout);
		}, [
			autoOpen,
			canPeek,
			isEngaged,
			peekDelayMax,
			peekDelayMin,
			peekDuration,
		]);

		const pointEyesAt = useCallback(
			(clientX: number, clientY: number) => {
				const eyes = eyesRef.current;
				if (!eyes) return;

				const bounds = eyes.getBoundingClientRect();
				const deltaX = clientX - (bounds.left + bounds.width / 2);
				const deltaY = clientY - (bounds.top + bounds.height / 2);
				const distance = Math.hypot(deltaX, deltaY);
				const strength = Math.min(distance / 240, 1);
				const angle = Math.atan2(deltaY, deltaX);

				pupilX.set(Math.cos(angle) * 2.25 * strength);
				pupilY.set(Math.sin(angle) * 1.75 * strength);
			},
			[pupilX, pupilY],
		);

		useEffect(() => {
			if (!isOpen) {
				pupilX.set(0);
				pupilY.set(0);
				return;
			}

			function handlePointerMove(event: PointerEvent) {
				if (event.pointerType === "touch") return;
				pointEyesAt(event.clientX, event.clientY);
			}

			window.addEventListener("pointermove", handlePointerMove, {
				passive: true,
			});
			return () => window.removeEventListener("pointermove", handlePointerMove);
		}, [isOpen, pointEyesAt, pupilX, pupilY]);

		function handlePointerEnter(event: ReactPointerEvent<HTMLButtonElement>) {
			onPointerEnter?.(event);
			if (!event.defaultPrevented && event.pointerType !== "touch") {
				setIsEngaged(true);
			}
		}

		function handlePointerLeave(event: ReactPointerEvent<HTMLButtonElement>) {
			onPointerLeave?.(event);
			if (!event.defaultPrevented) setIsEngaged(false);
		}

		function handleFocus(event: FocusEvent<HTMLButtonElement>) {
			onFocus?.(event);
			if (!event.defaultPrevented) setIsEngaged(true);
		}

		function handleBlur(event: FocusEvent<HTMLButtonElement>) {
			onBlur?.(event);
			if (!event.defaultPrevented) setIsEngaged(false);
		}

		return (
			<MotionConfig reducedMotion="user">
				<button
					ref={ref}
					type={type}
					data-slot="peeping-button"
					data-peeking={isOpen ? "true" : "false"}
					disabled={disabled}
					onBlur={handleBlur}
					onFocus={handleFocus}
					onPointerEnter={handlePointerEnter}
					onPointerLeave={handlePointerLeave}
					className={cn(
						"group/peeping-button relative inline-grid min-w-36 touch-manipulation select-none place-items-center rounded-lg bg-muted text-sm outline-none",
						"transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
						"focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
						className,
					)}
					{...props}
				>
					<span
						ref={eyesRef}
						aria-hidden="true"
						className="pointer-events-none absolute right-[0.9em] bottom-[0.55em] flex items-center gap-[0.35em]"
					>
						{["left", "right"].map((eye) => (
							<motion.span
								key={eye}
								className="relative size-[0.72em] overflow-hidden rounded-full bg-foreground"
								animate={
									reduceMotion === true || !isOpen
										? { transform: "scaleY(1)" }
										: {
												transform: [
													"scaleY(1)",
													"scaleY(1)",
													"scaleY(0.12)",
													"scaleY(1)",
												],
											}
								}
								transition={{
									duration: 4,
									times: [0, 0.92, 0.96, 1],
									repeat: Number.POSITIVE_INFINITY,
									ease: "linear",
								}}
							>
								<motion.span
									className="absolute top-1/2 left-1/2 size-[0.34em] rounded-full bg-background"
									style={{ transform: pupilTransform }}
								/>
							</motion.span>
						))}
					</span>

					<motion.span
						className={cn(
							"pointer-events-none absolute inset-0 flex origin-[1.25em_50%] items-center justify-center rounded-[inherit] border border-border bg-card px-5 py-3 font-medium text-card-foreground shadow-xs",
							coverClassName,
						)}
						animate={{
							transform: isOpen ? "rotate(-11deg)" : "rotate(0deg)",
						}}
						transition={
							isOpen
								? { type: "spring", duration: 0.45, bounce: 0.18 }
								: {
										duration: 0.2,
										ease: [0.23, 1, 0.32, 1],
									}
						}
					>
						{children}
					</motion.span>

					<span
						aria-hidden="true"
						className="invisible block px-5 py-3 font-medium"
					>
						{children}
					</span>
				</button>
			</MotionConfig>
		);
	},
);

PeepingButton.displayName = "PeepingButton";

export default PeepingButton;
