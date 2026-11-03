"use client";

import type { TiksTheme } from "@rexa-developer/tiks";
import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** The handle springs back to rest with a little overshoot. */
const returnSpring = {
	type: "spring",
	bounce: 0.35,
	visualDuration: 0.4,
} as const;
/** A loose pendulum, so a release swings the chain a few times before it settles. */
const swingSpring = {
	type: "spring",
	stiffness: 140,
	damping: 4.5,
	restDelta: 0.01,
} as const;
/** Under reduced motion the handle eases straight back, without a spring. */
const reducedReturn = { duration: 0.15, ease: "easeOut" } as const;

/** Minimum ms between bead ticks, so a fast pull never buzzes. */
const CUE_THROTTLE_MS = 35;
/** Pointer travel, in px, before a press becomes a pull. */
const DRAG_SLOP = 3;
/** The switch re-arms once the handle is back within this many px of rest. */
const REARM_PX = 4;
/** The handle's hit target is never smaller than this, in px. */
const MIN_HIT_PX = 44;
/** Furthest the handle stretches past `travel`, as a fraction of it. */
const BAND_RATIO = 0.25;
/** Furthest the handle follows the pointer sideways, in px. */
const MAX_SWAY_PX = 12;
/** Furthest the chain swings either way, in degrees. */
const MAX_SWING_DEG = 7;
/** A tug pulls this far past `threshold`, as a fraction of `travel`. */
const TUG_OVERSHOOT = 0.2;
/**
 * Px per second a click, tap, or key press pulls the handle down. Steady and
 * slow enough that each bead it feeds out still gets its own tick.
 */
const TUG_SPEED = 160;

/** Deep and firm: the switch flipping on. */
const flipOnTheme: TiksTheme = {
	name: "pull-cord-on",
	baseFreq: 340,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 3000,
	filterQ: 2,
	attack: 0.002,
	decay: 1.4,
	brightness: 2000,
};
/** A touch higher and shorter: the switch flipping off. */
const flipOffTheme: TiksTheme = {
	...flipOnTheme,
	name: "pull-cord-off",
	baseFreq: 400,
	decay: 1.2,
};
/** Low and short: the chain hitting the end of its travel. */
const thunkTheme: TiksTheme = {
	...flipOnTheme,
	name: "pull-cord-thunk",
	baseFreq: 200,
	decay: 0.6,
};

/** All lengths in px. `housing` and `handle` are `[width, height]`. */
const sizes = {
	sm: {
		bead: 4,
		housing: [14, 8],
		handle: [8, 22],
		mount: 88,
		panel: "h-12 w-32 rounded-xl",
		strip: "w-16",
		icon: "[&_svg:not([class*='size-'])]:size-5",
		label: "text-xs",
	},
	md: {
		bead: 5,
		housing: [18, 10],
		handle: [10, 28],
		mount: 96,
		panel: "h-14 w-38 rounded-2xl",
		strip: "w-20",
		icon: "[&_svg:not([class*='size-'])]:size-6",
		label: "text-sm",
	},
	lg: {
		bead: 6,
		housing: [22, 12],
		handle: [12, 34],
		mount: 104,
		panel: "h-16 w-44 rounded-2xl",
		strip: "w-24",
		icon: "[&_svg:not([class*='size-'])]:size-7",
		label: "text-sm",
	},
} as const;

type Size = keyof typeof sizes;

export interface PullCordProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultChecked" | "onChange" | "ref"
	> {
	/** Controlled state. */
	checked?: boolean;
	/** Initial state when uncontrolled. */
	defaultChecked?: boolean;
	/** Called when a pull, click, or key press flips the switch. */
	onCheckedChange?: (checked: boolean) => void;
	/** The switch's accessible name; shown under the cord with `showLabel`. */
	label?: string;
	/** Show `label` under the cord. */
	showLabel?: boolean;
	/** Px the handle pulls freely before the chain resists. */
	travel?: number;
	/** How far to pull before a release flips the switch, as a fraction of `travel`. */
	threshold?: number;
	/** Px of chain hanging between the housing and the handle at rest. */
	chainLength?: number;
	/** Px between bead centers; one tick plays per bead. */
	beadSpacing?: number;
	/** Replaces the default pull handle, e.g. an icon. */
	handle?: ReactNode;
	/** The lit surface above the housing. Defaults to a small lamp panel. Style it with the root's `data-state`. */
	children?: ReactNode;
	/** `minimal` drops the lit surface and shows only the housing, chain, and handle. */
	variant?: "default" | "minimal";
	size?: Size;
	/** Play a tick per bead, a click on the flip, and a thunk at the end of travel. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	disabled?: boolean;
	/** Submits `on` with a native form while checked, like a checkbox. */
	name?: string;
	className?: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function finite(value: number, fallback: number) {
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Square-root resistance: follows the pointer 1:1 at first, then eases towards
 * `max` px and never passes it.
 */
function resist(over: number, max: number) {
	if (over <= 0 || max <= 0) return 0;
	return max * (1 - Math.exp(1 - Math.sqrt(1 + (2 * over) / max)));
}

export function PullCord({
	checked: checkedProp,
	defaultChecked = false,
	onCheckedChange,
	label,
	showLabel = false,
	travel: travelProp = 56,
	threshold: thresholdProp = 0.6,
	chainLength: chainLengthProp = 120,
	beadSpacing: beadSpacingProp = 10,
	handle,
	children,
	variant = "default",
	size = "md",
	sound = true,
	haptics = true,
	disabled = false,
	name,
	className,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: PullCordProps) {
	const sizeStyle = sizes[size];
	const { bead } = sizeStyle;
	const [housingWidth, housingHeight] = sizeStyle.housing;
	const [handleWidth, handleHeight] = sizeStyle.handle;
	const travel = Math.max(finite(travelProp, 56), 8);
	const threshold = clamp(finite(thresholdProp, 0.6), 0.05, 1);
	const spacing = Math.max(finite(beadSpacingProp, 10), bead + 1);
	const chainLength = Math.max(finite(chainLengthProp, 120), spacing * 2);
	const band = travel * BAND_RATIO;

	const controlled = checkedProp !== undefined;
	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const checked = controlled ? checkedProp : internalChecked;
	const [pulling, setPulling] = useState(false);

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playTick } = useTiks({ respectReducedMotion: false });
	const { toggle: playFlipOn } = useTiks({
		theme: flipOnTheme,
		respectReducedMotion: false,
	});
	const { toggle: playFlipOff } = useTiks({
		theme: flipOffTheme,
		respectReducedMotion: false,
	});
	const { toggle: playThunk } = useTiks({
		theme: thunkTheme,
		respectReducedMotion: false,
	});

	const labelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const mountRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLButtonElement>(null);

	// Px the handle is pulled below rest. Negative while it overshoots on the way back.
	const pull = useMotionValue(0);
	// Degrees the chain swings around the housing, clockwise.
	const swing = useMotionValue(0);
	// Px the housing is nudged down by a passing bead.
	const nudge = useMotionValue(0);

	const pullAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const swingAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const nudgeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const checkedRef = useRef(checked);
	const phaseRef = useRef<"idle" | "drag" | "tug">("idle");
	// A flip disarms the switch until the chain is back near rest.
	const armedRef = useRef(true);
	const beadRef = useRef(0);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const pressMovedRef = useRef(false);
	const sessionRef = useRef<{
		pointerId: number;
		originX: number;
		originY: number;
		startPull: number;
		startSway: number;
		scale: number;
		moved: boolean;
		banded: boolean;
	} | null>(null);

	/** How many beads have come out of the housing at a given pull. */
	const beadsOut = (p: number) =>
		Math.floor((chainLength + p - spacing / 2) / spacing);

	useLayoutEffect(() => {
		checkedRef.current = checked;
		// At rest, follow `chainLength` and `beadSpacing` so the next pull doesn't tick early.
		if (phaseRef.current === "idle" && !sessionRef.current) {
			beadRef.current = beadsOut(pull.get());
		}
	});

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const nudgeHousing = (px: number) => {
		if (shouldReduceMotion) return;
		nudgeAnimationRef.current?.stop();
		nudge.jump(px);
		nudgeAnimationRef.current = animate(nudge, 0, {
			duration: 0.1,
			ease: "easeOut",
		});
	};

	// Called only for user input, so first render and prop changes stay quiet.
	const tick = () => {
		const now = performance.now();
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		nudgeHousing(1);
		if (silent()) return;
		if (sound) playTick();
		if (haptics) void haptic("selection");
	};

	const thunk = () => {
		nudgeHousing(1.5);
		if (silent()) return;
		if (sound) playThunk(false);
		if (haptics) void haptic("rigid");
	};

	useMotionValueEvent(pull, "change", (p) => {
		if (p < REARM_PX) armedRef.current = true;
		const out = beadsOut(p);
		if (out === beadRef.current) return;
		beadRef.current = out;
		// Beads tick on the way out; the chain slides back in quietly.
		if (phaseRef.current !== "idle") tick();
	});

	const flip = () => {
		if (!armedRef.current) return;
		// Re-arms once the chain is back at rest; an instant flip never left it.
		armedRef.current = pull.get() < REARM_PX;
		const next = !checkedRef.current;
		if (!controlled) {
			checkedRef.current = next;
			setInternalChecked(next);
		}
		onCheckedChange?.(next);
		if (silent()) return;
		if (sound) (next ? playFlipOn : playFlipOff)(false);
		if (haptics) void haptic("medium");
	};

	const stopPull = () => {
		pullAnimationRef.current?.stop();
		pullAnimationRef.current = null;
	};

	const stopSwing = () => {
		swingAnimationRef.current?.stop();
		swingAnimationRef.current = null;
	};

	/** Swings the chain after a release, harder for a longer or faster pull. */
	const kickSwing = (pulled: number) => {
		stopSwing();
		const current = swing.get();
		if (Math.abs(current) > 0.25) {
			// The pointer swayed the chain: let it swing from there, keeping its velocity.
			swingAnimationRef.current = animate(swing, 0, swingSpring);
			return;
		}
		const root = rootRef.current;
		const rtl = root ? getComputedStyle(root).direction === "rtl" : false;
		const speed = Math.abs(pull.getVelocity());
		const strength = clamp(pulled / travel + speed / 2000, 0, 1.5);
		const amplitude =
			(rtl ? -1 : 1) * Math.min(1 + 2.5 * strength, MAX_SWING_DEG);
		// A spring from rest with a velocity kick never starts, so swing out first.
		const controls = animate(swing, amplitude, {
			duration: 0.14,
			ease: "easeOut",
		});
		swingAnimationRef.current = controls;
		void controls.then(() => {
			if (swingAnimationRef.current !== controls) return;
			swingAnimationRef.current = animate(swing, 0, swingSpring);
		});
	};

	/** Returns the handle to rest; `released` lets go of a pull, so the chain swings. */
	const returnToRest = (released: boolean) => {
		phaseRef.current = "idle";
		const pulled = pull.get();
		stopPull();
		if (shouldReduceMotion) {
			stopSwing();
			swing.jump(0);
			pullAnimationRef.current = animate(pull, 0, reducedReturn);
			return;
		}
		pullAnimationRef.current = animate(pull, 0, returnSpring);
		if (released) kickSwing(pulled);
		else if (swing.get() !== 0) {
			stopSwing();
			swingAnimationRef.current = animate(swing, 0, swingSpring);
		}
	};

	/** The pull a click, tap, or key press plays: down past the threshold, flip, back. */
	const tug = () => {
		if (phaseRef.current !== "idle") return;
		if (shouldReduceMotion) {
			flip();
			return;
		}
		phaseRef.current = "tug";
		stopPull();
		const from = pull.get();
		const depth = Math.max(
			travel * Math.min(1, threshold + TUG_OVERSHOOT),
			from,
		);
		const controls = animate(pull, depth, {
			duration: Math.max((depth - from) / TUG_SPEED, 0.05),
			ease: "linear",
		});
		pullAnimationRef.current = controls;
		void controls.then(() => {
			if (pullAnimationRef.current !== controls) return;
			flip();
			returnToRest(true);
		});
	};

	const releaseCapture = (pointerId: number) => {
		const button = handleRef.current;
		if (button?.hasPointerCapture(pointerId)) {
			button.releasePointerCapture(pointerId);
		}
	};

	const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		// Ignore second fingers and non-primary buttons.
		if (disabled || !event.isPrimary || event.button !== 0) return;
		if (sessionRef.current) return;
		const mount = mountRef.current;
		const rect = mount?.getBoundingClientRect();
		// CSS zoom and transforms scale client coordinates; work in local px.
		const scale =
			rect && mount ? rect.height / (mount.offsetHeight || 1) || 1 : 1;
		event.currentTarget.setPointerCapture(event.pointerId);
		// Catch the handle wherever it is, even mid-swing or mid-tug.
		stopPull();
		stopSwing();
		phaseRef.current = "idle";
		const length = chainLength + Math.max(pull.get(), 0) + handleHeight / 2;
		sessionRef.current = {
			pointerId: event.pointerId,
			originX: event.clientX,
			originY: event.clientY,
			startPull: Math.max(pull.get(), 0),
			startSway: Math.tan((swing.get() * Math.PI) / 180) * length,
			scale,
			moved: false,
			banded: false,
		};
		pressMovedRef.current = false;
	};

	const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		const session = sessionRef.current;
		if (!session || session.pointerId !== event.pointerId) return;
		const dx = (event.clientX - session.originX) / session.scale;
		const dy = (event.clientY - session.originY) / session.scale;
		if (!session.moved) {
			if (Math.hypot(dx, dy) < DRAG_SLOP) return;
			session.moved = true;
			pressMovedRef.current = true;
			phaseRef.current = "drag";
			setPulling(true);
		}

		// Pulling up does nothing; past `travel` the chain resists.
		const raw = session.startPull + dy;
		const next =
			raw <= 0 ? 0 : raw <= travel ? raw : travel + resist(raw - travel, band);
		pull.set(next);
		if (raw >= travel) {
			// One thunk per pull into the end of travel, not one per move.
			if (!session.banded) thunk();
			session.banded = true;
		} else if (raw < travel - spacing) {
			session.banded = false;
		}

		if (shouldReduceMotion) return;
		const sway = session.startSway + dx;
		const offset = Math.sign(sway) * resist(Math.abs(sway), MAX_SWAY_PX);
		const length = chainLength + next + handleHeight / 2;
		const angle = (Math.atan2(offset, length) * 180) / Math.PI;
		swing.set(clamp(angle, -MAX_SWING_DEG, MAX_SWING_DEG));
	};

	const endPull = (pointerId: number, released: boolean) => {
		const session = sessionRef.current;
		if (!session || session.pointerId !== pointerId) return;
		sessionRef.current = null;
		releaseCapture(pointerId);
		if (!session.moved) {
			// A press without a pull: the click that follows plays the tug.
			returnToRest(false);
			return;
		}
		setPulling(false);
		phaseRef.current = "idle";
		// Like a real lamp, the switch clicks as you let go.
		if (released && pull.get() >= threshold * travel) flip();
		returnToRest(released);
	};

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (disabled || sessionRef.current) return;
		// A pointer press that became a pull already did its work. Keyboard clicks have no detail.
		if (event.detail !== 0 && pressMovedRef.current) {
			pressMovedRef.current = false;
			return;
		}
		tug();
	};

	// Window and document listeners call through a ref so they see the latest state.
	const cancelRef = useRef(() => {});
	useLayoutEffect(() => {
		cancelRef.current = () => {
			const session = sessionRef.current;
			if (session) endPull(session.pointerId, false);
		};
	});

	// Losing the window or the tab mid-pull lets go without flipping.
	useEffect(() => {
		const cancel = () => cancelRef.current();
		const onVisibility = () => {
			if (document.visibilityState === "hidden") cancel();
		};
		window.addEventListener("blur", cancel);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("blur", cancel);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, []);

	// iOS can still scroll the page under a captured pointer; block it mid-pull.
	useEffect(() => {
		const button = handleRef.current;
		if (!button) return;
		const onTouchMove = (event: TouchEvent) => {
			if (sessionRef.current?.moved) event.preventDefault();
		};
		button.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => button.removeEventListener("touchmove", onTouchMove);
	}, []);

	useEffect(() => {
		if (disabled) cancelRef.current();
	}, [disabled]);

	useEffect(() => {
		if (!shouldReduceMotion) return;
		swingAnimationRef.current?.stop();
		swing.jump(0);
		nudge.jump(0);
	}, [shouldReduceMotion, swing, nudge]);

	useEffect(
		() => () => {
			pullAnimationRef.current?.stop();
			swingAnimationRef.current?.stop();
			nudgeAnimationRef.current?.stop();
		},
		[],
	);

	const state = checked ? "checked" : "unchecked";
	const labelledBy =
		ariaLabelledBy ?? (showLabel && label ? labelId : undefined);
	const padTop = Math.max(0, (MIN_HIT_PX - handleHeight) / 2);
	const hitWidth = Math.max(MIN_HIT_PX, handleWidth + 24);
	// Room below the resting handle for a full pull, so nothing overflows.
	const reach = travel + band;
	const mountHeight =
		housingHeight + chainLength + handleHeight + padTop + reach;
	// Chain kept inside the housing, fed out as the handle is pulled.
	const hidden = reach + spacing;
	const beadCount = Math.ceil((chainLength + hidden) / spacing);
	const beadOffsets = Array.from(
		{ length: beadCount },
		(_, index) => chainLength - spacing / 2 - index * spacing,
	);
	const clipWidth = hitWidth + 24;

	return (
		<div
			ref={rootRef}
			data-slot="pull-cord"
			data-state={state}
			data-variant={variant}
			data-size={size}
			data-pulling={pulling || undefined}
			data-disabled={disabled || undefined}
			className={cn(
				"group/pull-cord inline-flex w-fit select-none flex-col items-center [-webkit-tap-highlight-color:transparent] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{variant === "default" ? (
				<div
					data-slot="pull-cord-surface"
					data-state={state}
					className="relative"
				>
					{children ?? <LampPanel size={size} />}
				</div>
			) : null}

			<div
				ref={mountRef}
				data-slot="pull-cord-mount"
				className="relative"
				style={{ width: sizeStyle.mount, height: mountHeight }}
			>
				<motion.div
					aria-hidden
					data-slot="pull-cord-housing"
					className={cn(
						"absolute top-0 left-1/2 z-10 border border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800",
						variant === "default"
							? "-mt-px rounded-b-[5px] border-t-0"
							: "rounded-[5px]",
					)}
					style={{
						width: housingWidth,
						height: housingHeight,
						x: "-50%",
						y: nudge,
					}}
				/>

				{/* The chain pivots where it leaves the housing. */}
				<motion.div
					className="absolute left-1/2 size-0"
					style={{
						top: housingHeight - 1,
						rotate: swing,
						originX: 0,
						originY: 0,
					}}
				>
					{/* Hides the chain still inside the housing. */}
					<div
						className="absolute top-0 overflow-hidden"
						style={{
							left: -clipWidth / 2,
							width: clipWidth,
							height: chainLength + handleHeight + padTop * 2 + reach + 24,
						}}
					>
						<motion.div
							className="absolute inset-x-0 top-0"
							style={{ y: pull }}
						>
							<span aria-hidden data-slot="pull-cord-chain">
								<span
									className="absolute left-1/2 w-px -translate-x-1/2 bg-zinc-300 dark:bg-zinc-600"
									style={{ top: -hidden, height: hidden + chainLength }}
								/>
								{beadOffsets.map((offset) => (
									<span
										key={offset}
										data-slot="pull-cord-bead"
										className="absolute left-1/2 rounded-full bg-zinc-400 dark:bg-zinc-500"
										style={{
											top: offset - bead / 2,
											width: bead,
											height: bead,
											marginLeft: -bead / 2,
										}}
									/>
								))}
							</span>

							{/* The whole hit area is the switch, so a click focuses it natively and never shows a focus ring. */}
							<button
								ref={handleRef}
								type="button"
								role="switch"
								aria-checked={checked}
								aria-label={
									labelledBy ? undefined : (ariaLabel ?? label ?? "Pull cord")
								}
								aria-labelledby={labelledBy}
								disabled={disabled}
								data-slot="pull-cord-handle"
								data-state={state}
								onPointerDown={handlePointerDown}
								onPointerMove={handlePointerMove}
								onPointerUp={(event) => endPull(event.pointerId, true)}
								onPointerCancel={(event) => endPull(event.pointerId, false)}
								onLostPointerCapture={(event) =>
									endPull(event.pointerId, false)
								}
								onClick={handleClick}
								onContextMenu={(event) => {
									if (sessionRef.current) event.preventDefault();
								}}
								className="group/pull-cord-handle absolute left-1/2 flex -translate-x-1/2 cursor-grab touch-none flex-col items-center outline-none [-webkit-touch-callout:none] disabled:cursor-not-allowed group-data-pulling/pull-cord:cursor-grabbing"
								style={{
									top: chainLength - padTop,
									width: hitWidth,
									minHeight: MIN_HIT_PX,
									paddingTop: padTop,
									paddingBottom: padTop,
								}}
							>
								<span
									className={cn(
										"flex text-foreground group-focus-visible/pull-cord-handle:ring-3 group-focus-visible/pull-cord-handle:ring-ring/50 group-focus-visible/pull-cord-handle:ring-offset-2 group-focus-visible/pull-cord-handle:ring-offset-background",
										handle ? cn("rounded-md", sizeStyle.icon) : "rounded-full",
									)}
								>
									{handle ?? (
										<DefaultHandle width={handleWidth} height={handleHeight} />
									)}
								</span>
							</button>
						</motion.div>
					</div>
				</motion.div>
			</div>

			{showLabel && label ? (
				<span
					id={labelId}
					data-slot="pull-cord-label"
					className={cn("font-medium text-foreground", sizeStyle.label)}
				>
					{label}
				</span>
			) : null}
			{name && checked ? (
				<input type="hidden" name={name} value="on" disabled={disabled} />
			) : null}
		</div>
	);
}

/** A small pull-bar: a gray ferrule over a capsule in the foreground color. */
function DefaultHandle({ width, height }: { width: number; height: number }) {
	const ferrule = Math.max(3, Math.round(height * 0.14));
	return (
		<span aria-hidden className="flex flex-col items-center">
			<span
				className="rounded-t-[2px] bg-zinc-400 dark:bg-zinc-500"
				style={{ width: width - 4, height: ferrule }}
			/>
			<span
				className="rounded-full bg-foreground"
				style={{ width, height: height - ferrule }}
			/>
		</span>
	);
}

/** The default lit surface: a panel with a light strip that glows warm when checked. */
function LampPanel({ size }: { size: Size }) {
	const sizeStyle = sizes[size];
	return (
		<div
			aria-hidden
			data-slot="pull-cord-lamp"
			className={cn(
				"flex items-center justify-center border border-border bg-card shadow-xs transition-colors duration-200 group-data-[state=checked]/pull-cord:border-amber-200 group-data-[state=checked]/pull-cord:bg-amber-50 motion-reduce:transition-none dark:group-data-[state=checked]/pull-cord:border-amber-300/25 dark:group-data-[state=checked]/pull-cord:bg-amber-300/10",
				sizeStyle.panel,
			)}
		>
			<span
				className={cn(
					"h-1.5 rounded-full bg-zinc-200 transition-[background-color,box-shadow] duration-200 group-data-[state=checked]/pull-cord:bg-amber-400 group-data-[state=checked]/pull-cord:shadow-[0_0_12px_2px_rgb(251_191_36/0.35)] motion-reduce:transition-none dark:bg-zinc-700 dark:group-data-[state=checked]/pull-cord:bg-amber-300 dark:group-data-[state=checked]/pull-cord:shadow-[0_0_12px_2px_rgb(252_211_77/0.25)]",
					sizeStyle.strip,
				)}
			/>
		</div>
	);
}

export default PullCord;
