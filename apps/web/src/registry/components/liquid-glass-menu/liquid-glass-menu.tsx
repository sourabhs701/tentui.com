"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	createContext,
	type ReactNode,
	type Ref,
	type RefObject,
	use,
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

// Layout, in px, on a 4 px grid. Item corners are concentric with the
// panel's: item radius = panel radius - panel padding.
const PANEL_RADIUS = 24;
const PANEL_PADDING = 8;
const ITEM_RADIUS = PANEL_RADIUS - PANEL_PADDING;
/** How far the panel reaches past a trigger it swallows, all round. */
const ABSORB_INSET = 4;
/** Gap to a trigger the panel doesn't swallow. */
const SIDE_OFFSET = 8;

// Motion. Progress runs from 0 (glass the shape of the trigger) to 1 (the
// panel). Only the glass changes shape; the popup itself never moves, so it
// lands exactly where Base UI placed it.
/** Critically damped: settles in about 300 ms with no overshoot. */
const openSpring = {
	type: "spring",
	stiffness: 520,
	damping: 46,
	restDelta: 0.002,
	restSpeed: 0.02,
} as const;
/** The drain: a smooth shrink that eases into the trigger without lingering. */
const CLOSE_MS = 240;
const CLOSE_EASE = [0.4, 0, 0.2, 1] as const;
/** Progress from which the lens may show on the growing panel. */
const SETTLED_AT = 0.96;
/** Critically damped, about 150 ms between neighbouring items. */
const lensSpring = { type: "spring", stiffness: 600, damping: 49 } as const;

/** The frost behind the glass: a calm blur and a little saturation. */
const GLASS_BLUR = "blur(24px) saturate(150%)";

// Refraction: a displacement map that bends the backdrop at the panel's rim.
/** Width of the bent band at the panel's rim, in px. */
const PANEL_BEZEL = 16;
/** Furthest the backdrop is pulled in at the very rim, in px. */
const PANEL_BEND = 6;
/** The bend swells in once the panel is at rest, in s. */
const REFRACT_SWELL = 0.24;

// The glass. The trigger and the panel share it, so one can become the other
// without a seam. Light and dark are tuned separately, not inverted.
/** Clear enough to show the backdrop, opaque enough for AA text over it. */
const GLASS_FILL = "bg-[rgb(255_255_255/0.6)] dark:bg-[rgb(36_36_42/0.76)]";
/** No `backdrop-filter`, or reduced transparency: frosted, but solid. */
const SOLID_FILL =
	"bg-[linear-gradient(to_bottom,#fdfdfd,#f4f4f6)] dark:bg-[linear-gradient(to_bottom,#2c2c31,#232327)]";
/**
 * A 0.5 px specular hairline that is brightest along the top and fades down
 * the sides, a faint contour to hold the edge on light pages, and a small,
 * soft lift.
 */
const GLASS_EDGE =
	"shadow-[inset_0_0.5px_0_rgb(255_255_255/0.9),inset_0_0_0_0.5px_rgb(255_255_255/0.3),0_0_0_0.5px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_-4px_rgb(0_0_0/0.1)] dark:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.24),inset_0_0_0_0.5px_rgb(255_255_255/0.07),0_0_0_0.5px_rgb(0_0_0/0.5),0_1px_2px_rgb(0_0_0/0.3),0_4px_12px_-4px_rgb(0_0_0/0.4)]";
/** The panel's wider ambient shadow, which grows in with it. */
const PANEL_SHADOW =
	"shadow-[0_12px_32px_-12px_rgb(0_0_0/0.14)] dark:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.55)]";
/** The lens: a faint, clear tint with the same top-weighted hairline. */
const LENS_GLASS =
	"bg-[rgb(118_118_128/0.08)] shadow-[inset_0_0.5px_0_rgb(255_255_255/0.9),inset_0_0_0_0.5px_rgb(0_0_0/0.03)] dark:bg-[rgb(255_255_255/0.07)] dark:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.16),inset_0_0_0_0.5px_rgb(255_255_255/0.025)]";
const LENS_SOLID =
	"bg-[rgb(0_0_0/0.045)] shadow-[inset_0_0.5px_0_rgb(255_255_255/0.9),inset_0_0_0_0.5px_rgb(0_0_0/0.04)] dark:bg-[rgb(255_255_255/0.07)] dark:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.16),inset_0_0_0_0.5px_rgb(255_255_255/0.025)]";
/** Pressed: the lens dips a touch, like a soft key. */
const LENS_PRESSED = "group-has-[[data-highlighted]:active]/lgm:scale-[0.985]";
const LENS_PRESSED_GLASS =
	"group-has-[[data-highlighted]:active]/lgm:bg-[rgb(118_118_128/0.13)] dark:group-has-[[data-highlighted]:active]/lgm:bg-[rgb(255_255_255/0.1)]";
const LENS_PRESSED_SOLID =
	"group-has-[[data-highlighted]:active]/lgm:bg-[rgb(0_0_0/0.07)] dark:group-has-[[data-highlighted]:active]/lgm:bg-[rgb(255_255_255/0.1)]";

// A clear glass pop on open, a lower and shorter one on close, and a tiny
// tick on select.
const OPEN_SOUND = {
	name: "liquid-glass-menu-open",
	baseFreq: 620,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 5200,
	filterQ: 4,
	attack: 0.003,
	decay: 1.1,
	brightness: 5000,
} as const;
const CLOSE_SOUND = {
	...OPEN_SOUND,
	name: "liquid-glass-menu-close",
	baseFreq: 470,
	decay: 0.75,
} as const;
const TICK_SOUND = {
	...OPEN_SOUND,
	name: "liquid-glass-menu-tick",
	filterFreq: 4200,
	filterQ: 2,
	decay: 0.8,
} as const;

type Feedback = "open" | "close" | "select";

/**
 * - `pending`: mounted, waiting a frame for Base UI to place it.
 * - `morph`: the glass grows out of the trigger and the items sharpen.
 * - `open`: at rest. No clip, no blur on the items, nothing animating.
 * - `drain`: shrinking back into the trigger.
 * - `static`: `morph={false}` or reduced motion; CSS transitions only.
 */
type Phase = "idle" | "pending" | "morph" | "open" | "drain" | "static";

interface GlassSupport {
	/** Translucent glass; false under reduced transparency or without `backdrop-filter`. */
	glass: boolean;
	/** SVG displacement through `backdrop-filter: url()`, Chromium only. */
	refract: boolean;
}

interface LiquidGlassMenuContextValue {
	open: boolean;
	morph: boolean;
	support: GlassSupport;
	triggerRef: RefObject<HTMLButtonElement | null>;
	/** The default round trigger is in use, so the panel swallows it. */
	roundTriggerRef: RefObject<boolean>;
	/** Opened at mount by `defaultOpen` or `open`: shown at rest, no morph. */
	openAtMountRef: RefObject<boolean>;
	/** A mouse press that started on the trigger and hasn't come up yet. */
	triggerPressRef: RefObject<boolean>;
	feedback: (kind: Feedback) => void;
}

const LiquidGlassMenuContext =
	createContext<LiquidGlassMenuContextValue | null>(null);

function useLiquidGlassMenu() {
	const context = use(LiquidGlassMenuContext);
	if (!context) {
		throw new Error(
			"LiquidGlassMenu parts must be used inside <LiquidGlassMenu>.",
		);
	}
	return context;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

function setRefs<T>(value: T, ...refs: Array<Ref<T> | undefined>) {
	for (const ref of refs) {
		if (typeof ref === "function") ref(value);
		else if (ref) ref.current = value;
	}
}

type ClassName<State> = string | ((state: State) => string | undefined);

/** Prepends classes to Base UI's `className`, which may be a function of state. */
function withClasses<State>(base: string, className?: ClassName<State>) {
	if (typeof className === "function") {
		return (state: State) => cn(base, className(state));
	}
	return cn(base, className);
}

function supportsBackdrop() {
	return (
		CSS.supports("backdrop-filter", "blur(1px)") ||
		CSS.supports("-webkit-backdrop-filter", "blur(1px)")
	);
}

/**
 * Glass needs `backdrop-filter`; refraction also needs SVG filters inside it,
 * which only Chromium draws. Safari and Firefox parse `url()` there but drop
 * the whole filter, so a parse check alone isn't enough: `userAgentData` is
 * the Chromium-only signal.
 */
function useGlassSupport(refraction: "auto" | "off"): GlassSupport {
	const [support, setSupport] = useState<GlassSupport>({
		glass: true,
		refract: false,
	});
	useEffect(() => {
		const transparency = window.matchMedia(
			"(prefers-reduced-transparency: reduce)",
		);
		const update = () => {
			const glass = supportsBackdrop() && !transparency.matches;
			const refract =
				glass &&
				refraction === "auto" &&
				CSS.supports("backdrop-filter", "url(#a)") &&
				"userAgentData" in navigator;
			setSupport((current) =>
				current.glass === glass && current.refract === refract
					? current
					: { glass, refract },
			);
		};
		update();
		transparency.addEventListener("change", update);
		return () => transparency.removeEventListener("change", update);
	}, [refraction]);
	return support;
}

/**
 * A displacement map for a rounded rect, and the filter `scale` that goes with
 * it. Within `bezel` of the rim it points inward by up to `bend` px, easing in
 * toward the edge, so the glass samples from further in and the backdrop bends
 * like it does at the edge of a lens. Flat everywhere else.
 */
function displacementMap(
	width: number,
	height: number,
	radius: number,
	bezel: number,
	bend: number,
) {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const scale = Math.ceil(bend * 2);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return { href: "", scale };
	const image = context.createImageData(width, height);
	const r = Math.min(radius, halfWidth, halfHeight);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const px = x + 0.5 - halfWidth;
			const py = y + 0.5 - halfHeight;
			const qx = Math.abs(px) - (halfWidth - r);
			const qy = Math.abs(py) - (halfHeight - r);
			const ox = Math.max(qx, 0);
			const oy = Math.max(qy, 0);
			const corner = Math.hypot(ox, oy);
			const depth = r - corner - Math.min(Math.max(qx, qy), 0);
			let nx = 0;
			let ny = 0;
			if (corner > 0) {
				nx = ox / corner;
				ny = oy / corner;
			} else if (qx > qy) nx = 1;
			else ny = 1;
			// Smoothstep, so the bend has no crease where the bezel starts.
			const t = clamp(1 - depth / bezel, 0, 1);
			const rim = bend * t * t * (3 - 2 * t);
			const dx = -rim * nx * Math.sign(px);
			const dy = -rim * ny * Math.sign(py);
			const i = (y * width + x) * 4;
			image.data[i] = 128 + (127 * dx) / bend;
			image.data[i + 1] = 128 + (127 * dy) / bend;
			image.data[i + 2] = 128;
			image.data[i + 3] = 255;
		}
	}
	context.putImageData(image, 0, 0);
	return { href: canvas.toDataURL(), scale };
}

export interface LiquidGlassMenuProps extends MenuPrimitive.Root.Props {
	/**
	 * Flow the trigger into the panel as one blob of glass, and back on close.
	 * `false` gives a plain scale-and-fade popover.
	 */
	morph?: boolean;
	/**
	 * Bend the backdrop at the rim of the glass and the lens where the browser
	 * can (Chromium). Elsewhere, and with `"off"`, the glass is a clean blur.
	 */
	refraction?: "auto" | "off";
	/** Play a glass pop on open and close, and a tick on select. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
}

export function LiquidGlassMenu({
	morph = true,
	refraction = "auto",
	sound = true,
	haptics = true,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	...props
}: LiquidGlassMenuProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const controlled = openProp !== undefined;
	const open = controlled ? openProp : internalOpen;
	const support = useGlassSupport(refraction);

	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const roundTriggerRef = useRef(false);
	const openAtMountRef = useRef(open);
	const triggerPressRef = useRef(false);

	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { pop: playOpen } = useTiks({
		theme: OPEN_SOUND,
		respectReducedMotion: false,
	});
	const { pop: playClose } = useTiks({
		theme: CLOSE_SOUND,
		respectReducedMotion: false,
	});
	const { click: playTick } = useTiks({
		theme: TICK_SOUND,
		respectReducedMotion: false,
	});

	const latest = useRef({
		sound,
		haptics,
		playOpen,
		playClose,
		playTick,
		haptic,
	});
	useLayoutEffect(() => {
		latest.current = { sound, haptics, playOpen, playClose, playTick, haptic };
	});

	// Called only for user input, so mounting and the `open` prop stay quiet.
	const feedback = useCallback((kind: Feedback) => {
		if (document.visibilityState === "hidden") return;
		const current = latest.current;
		if (current.sound) {
			if (kind === "open") current.playOpen();
			else if (kind === "close") current.playClose();
			else current.playTick();
		}
		if (current.haptics) {
			void current.haptic(
				kind === "open" ? "light" : kind === "close" ? "soft" : "selection",
			);
		}
	}, []);

	const handleOpenChange: NonNullable<
		MenuPrimitive.Root.Props["onOpenChange"]
	> = (next, details) => {
		onOpenChange?.(next, details);
		if (details.isCanceled) return;
		if (!controlled) setInternalOpen(next);
		// An item press already ticked; imperative calls aren't user input.
		if (
			details.reason === "item-press" ||
			details.reason === "imperative-action" ||
			details.reason === "none"
		) {
			return;
		}
		feedback(next ? "open" : "close");
	};

	// Only the first opening can skip the morph.
	useLayoutEffect(() => {
		if (!open) openAtMountRef.current = false;
	}, [open]);

	const context = useMemo<LiquidGlassMenuContextValue>(
		() => ({
			open,
			morph,
			support,
			triggerRef,
			roundTriggerRef,
			openAtMountRef,
			triggerPressRef,
			feedback,
		}),
		[open, morph, support, feedback],
	);

	return (
		<LiquidGlassMenuContext value={context}>
			<MenuPrimitive.Root
				data-slot="liquid-glass-menu"
				open={open}
				onOpenChange={handleOpenChange}
				{...props}
			/>
		</LiquidGlassMenuContext>
	);
}

function PlusIcon() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			className="size-5"
		>
			<path d="M10 4.5v11M4.5 10h11" />
		</svg>
	);
}

type TriggerBaseProps = Omit<
	MenuPrimitive.Trigger.Props,
	"children" | "aria-label" | "aria-labelledby"
>;

/** The default trigger has no text, so it needs `aria-label` or `aria-labelledby`. */
export type LiquidGlassMenuTriggerProps = TriggerBaseProps &
	(
		| {
				children: ReactNode;
				"aria-label"?: string;
				"aria-labelledby"?: string;
		  }
		| {
				children?: undefined;
				"aria-label": string;
				"aria-labelledby"?: string;
		  }
		| {
				children?: undefined;
				"aria-label"?: string;
				"aria-labelledby": string;
		  }
	);

/**
 * A round glass button with a plus by default. Pass `render` to use your own
 * element; it keeps the menu behaviour and drops the glass styling.
 */
export function LiquidGlassMenuTrigger({
	className,
	children,
	render,
	ref,
	onPointerDown,
	onKeyDown,
	onBlur,
	...props
}: LiquidGlassMenuTriggerProps) {
	const context = useLiquidGlassMenu();
	const reducedMotion = useReducedMotion() ?? false;
	const round = render === undefined;
	useLayoutEffect(() => {
		context.roundTriggerRef.current = round;
	});

	return (
		<MenuPrimitive.Trigger
			data-slot="liquid-glass-menu-trigger"
			data-solid={!context.support.glass || undefined}
			data-lgm-morph={(context.morph && !reducedMotion) || undefined}
			ref={(element: HTMLButtonElement | null) => {
				context.triggerRef.current = element;
				setRefs(element, ref as Ref<HTMLButtonElement> | undefined);
			}}
			render={render}
			onPointerDown={(event) => {
				// Pointer use: no focus ring, even when focus comes back from the menu.
				event.currentTarget.dataset.lgmPointer = "";
				if (event.pointerType === "mouse" && event.button === 0) {
					// Cleared after the mouseup has reached the items.
					context.triggerPressRef.current = true;
					const release = () =>
						setTimeout(() => {
							context.triggerPressRef.current = false;
						}, 0);
					document.addEventListener("pointerup", release, {
						once: true,
						capture: true,
					});
				}
				onPointerDown?.(event);
			}}
			onKeyDown={(event) => {
				delete event.currentTarget.dataset.lgmPointer;
				onKeyDown?.(event);
			}}
			onBlur={(event) => {
				// Focus leaving for good, not into the open menu.
				if (!event.currentTarget.hasAttribute("data-popup-open")) {
					delete event.currentTarget.dataset.lgmPointer;
				}
				onBlur?.(event);
			}}
			className={
				round
					? withClasses(
							cn(
								"group/lgm-trigger relative inline-grid size-11 shrink-0 cursor-pointer select-none place-items-center rounded-full text-foreground outline-none [-webkit-tap-highlight-color:transparent]",
								"transition-[scale] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
								"focus-visible:not-data-lgm-pointer:ring-2 focus-visible:not-data-lgm-pointer:ring-ring focus-visible:not-data-lgm-pointer:ring-offset-2 focus-visible:not-data-lgm-pointer:ring-offset-background",
								"disabled:pointer-events-none disabled:opacity-50",
							),
							className,
						)
					: className
			}
			{...props}
		>
			{round ? (
				<>
					{/* The same glass as the panel. While the panel has swallowed the
					    button it hides, at once when the panel is its exact double;
					    the icon dissolves under the growing glass. */}
					<span
						aria-hidden
						data-slot="liquid-glass-menu-trigger-glass"
						className={cn(
							"pointer-events-none absolute inset-0 rounded-[inherit] transition-[opacity,background-color] duration-150 ease-out motion-reduce:transition-none",
							context.support.glass
								? cn(
										GLASS_FILL,
										"group-hover/lgm-trigger:bg-[rgb(255_255_255/0.7)] dark:group-hover/lgm-trigger:bg-[rgb(46_46_52/0.78)]",
									)
								: cn(
										SOLID_FILL,
										"group-hover/lgm-trigger:bg-[linear-gradient(to_bottom,#fff,#f8f8fa)] dark:group-hover/lgm-trigger:bg-[linear-gradient(to_bottom,#323237,#29292d)]",
									),
							GLASS_EDGE,
							"group-data-lgm-hidden/lgm-trigger:opacity-0 group-data-lgm-morph/lgm-trigger:transition-[background-color]",
						)}
						style={
							context.support.glass
								? {
										backdropFilter: GLASS_BLUR,
										WebkitBackdropFilter: GLASS_BLUR,
									}
								: undefined
						}
					/>
					<span
						data-slot="liquid-glass-menu-trigger-icon"
						className="relative grid place-items-center transition-opacity duration-150 ease-out group-data-lgm-hidden/lgm-trigger:opacity-0 group-data-lgm-hidden/lgm-trigger:duration-[60ms] motion-reduce:transition-none"
					>
						{children ?? <PlusIcon />}
					</span>
				</>
			) : (
				children
			)}
		</MenuPrimitive.Trigger>
	);
}

type PositionerProps = MenuPrimitive.Positioner.Props;

export interface LiquidGlassMenuContentProps extends MenuPrimitive.Popup.Props {
	/** Which side of the trigger the panel opens on. Defaults to `"bottom"`. */
	side?: PositionerProps["side"];
	/** How the panel lines up with the trigger along that side. Defaults to `"start"`. */
	align?: PositionerProps["align"];
	/**
	 * Gap to the trigger, in px. Defaults to covering the round trigger, so the
	 * panel grows out of it, or 8 px from any other trigger.
	 */
	sideOffset?: PositionerProps["sideOffset"];
	/** Shift along the aligned edge, in px. */
	alignOffset?: PositionerProps["alignOffset"];
	/** Space kept from the edge of the viewport, in px. Defaults to 8. */
	collisionPadding?: PositionerProps["collisionPadding"];
}

/** Where the glass starts, relative to the popup, in px. */
interface Shape {
	x: number;
	y: number;
	width: number;
	height: number;
	radius: number;
}

/** Half-px steps: crisp at 2x, and no shimmer from tiny fractions. */
function snap(value: number) {
	return Math.round(value * 2) / 2;
}

/**
 * The glass panel. With the default round trigger and `morph` on, it is placed
 * over the trigger and grows out of it; otherwise it sits `sideOffset` away.
 */
export function LiquidGlassMenuContent({
	side = "bottom",
	align = "start",
	sideOffset,
	alignOffset,
	collisionPadding = 8,
	className,
	children,
	ref,
	...props
}: LiquidGlassMenuContentProps) {
	const context = useLiquidGlassMenu();
	const { open, morph, support, triggerRef, roundTriggerRef, openAtMountRef } =
		context;
	const reducedMotion = useReducedMotion() ?? false;
	const morphing = morph && !reducedMotion;
	const mode = !morph ? "pop" : reducedMotion ? "fade" : "morph";

	const ids = useId().replace(/[^\w-]/g, "");
	const panelFilterId = `liquid-glass-menu-${ids}-panel`;

	const popupRef = useRef<HTMLDivElement | null>(null);
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const shellRef = useRef<HTMLSpanElement | null>(null);
	const ambientRef = useRef<HTMLSpanElement | null>(null);
	const lensRef = useRef<HTMLSpanElement | null>(null);
	const panelMapRef = useRef<SVGFEImageElement | null>(null);
	const panelFilterRef = useRef<SVGFilterElement | null>(null);
	const panelDisplaceRef = useRef<SVGFEDisplacementMapElement | null>(null);
	const [popup, setPopup] = useState<HTMLDivElement | null>(null);

	const progress = useMotionValue(0);
	const lensX = useMotionValue(0);
	const lensY = useMotionValue(0);
	const lensWidth = useMotionValue(0);
	const lensHeight = useMotionValue(0);

	const phaseRef = useRef<Phase>("idle");
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const lensAnimationRef = useRef<AnimationPlaybackControls[]>([]);
	const swellRef = useRef<AnimationPlaybackControls | null>(null);
	const holdRef = useRef<Animation | null>(null);
	const frameRef = useRef(0);
	const lensShownRef = useRef(false);
	const lensHideRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const lensItemRef = useRef<HTMLElement | null>(null);
	/** Whether the panel covers the trigger; measured when it opens. */
	const absorbedRef = useRef(false);
	/** The trigger's shape inside the panel, where the glass grows from. */
	const fromRef = useRef<Shape | null>(null);
	const panelScaleRef = useRef(0);

	const latest = useRef({ morphing, refract: support.refract, reducedMotion });
	useLayoutEffect(() => {
		latest.current = { morphing, refract: support.refract, reducedMotion };
	});

	const clearTimers = () => {
		cancelAnimationFrame(frameRef.current);
		clearTimeout(lensHideRef.current);
	};

	/** The rim only bends at rest: Chromium feeds `url()` filters a stale
	 * backdrop while their element changes. It swells in from no bend. */
	const refract = (on: boolean) => {
		const shell = shellRef.current;
		const displace = panelDisplaceRef.current;
		if (!shell || !displace || !latest.current.refract) return;
		swellRef.current?.stop();
		if (!on) {
			shell.style.backdropFilter = GLASS_BLUR;
			return;
		}
		const target = panelScaleRef.current;
		displace.setAttribute("scale", "0");
		shell.style.backdropFilter = `${GLASS_BLUR} url(#${panelFilterId})`;
		if (latest.current.reducedMotion) {
			displace.setAttribute("scale", String(target));
			return;
		}
		swellRef.current = animate(0, target, {
			duration: REFRACT_SWELL,
			ease: "easeOut",
			onUpdate: (value) => displace.setAttribute("scale", String(round(value))),
		});
	};

	const setPhase = (phase: Phase) => {
		phaseRef.current = phase;
		const element = popupRef.current;
		if (!element) return;
		element.dataset.lgmPhase = phase;
		const resting = phase === "open" || phase === "static";
		if (resting) element.dataset.lgmRest = "";
		else if (phase !== "morph") delete element.dataset.lgmRest;
		refract(resting);
	};

	const hideTrigger = (hidden: boolean) => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		if (hidden && absorbedRef.current) trigger.dataset.lgmHidden = "";
		else delete trigger.dataset.lgmHidden;
	};

	/** Writes the glass's shape for the current progress. */
	const paint = () => {
		const element = popupRef.current;
		const shell = shellRef.current;
		const viewport = viewportRef.current;
		const from = fromRef.current;
		if (!element || !shell || !viewport || !from) return;
		const width = element.offsetWidth;
		const height = element.offsetHeight;
		if (!width || !height) return;
		const value = clamp(progress.get(), 0, 1);
		const rest = 1 - value;
		const w = from.width + (width - from.width) * value;
		const h = from.height + (height - from.height) * value;
		const left = snap(from.x * rest);
		const top = snap(from.y * rest);
		const right = snap(width - from.x * rest - w);
		const bottom = snap(height - from.y * rest - h);
		const radius = round(
			Math.min(
				from.radius + (PANEL_RADIUS - from.radius) * value,
				w / 2,
				h / 2,
			),
		);
		const inset = `${top}px ${right}px ${bottom}px ${left}px`;
		shell.style.inset = inset;
		shell.style.borderRadius = `${radius}px`;
		// The rows only show inside the glass, never as ghosts around it.
		viewport.style.clipPath = `inset(${inset} round ${radius}px)`;
		if (ambientRef.current) {
			ambientRef.current.style.opacity = String(round(value));
		}
		// A swallowed trigger is replaced by its double; beside one, the glass
		// fades in as it leaves it.
		shell.style.opacity = absorbedRef.current
			? ""
			: String(round(clamp(value / 0.25, 0, 1)));
	};

	const clearPaint = () => {
		const shell = shellRef.current;
		if (shell) {
			shell.style.inset = "";
			shell.style.borderRadius = "";
			shell.style.opacity = "";
		}
		if (viewportRef.current) viewportRef.current.style.clipPath = "";
		if (ambientRef.current) ambientRef.current.style.opacity = "";
	};

	const paintRef = useRef(paint);
	useLayoutEffect(() => {
		paintRef.current = paint;
	});

	useEffect(() => progress.on("change", () => paintRef.current()), [progress]);

	// The lens is written by hand rather than through `motion.*`, which would
	// add window listeners for layout projection.
	useLayoutEffect(() => {
		const paintLens = () => {
			const lens = lensRef.current;
			if (!lens) return;
			lens.style.transform = `translate(${round(lensX.get())}px, ${round(lensY.get())}px)`;
			lens.style.width = `${round(lensWidth.get())}px`;
			lens.style.height = `${round(lensHeight.get())}px`;
		};
		const stops = [lensX, lensY, lensWidth, lensHeight].map((value) =>
			value.on("change", paintLens),
		);
		paintLens();
		return () => {
			for (const stop of stops) stop();
		};
	}, [lensX, lensY, lensWidth, lensHeight]);

	const updatePanelMap = () => {
		const element = popupRef.current;
		const map = panelMapRef.current;
		const filter = panelFilterRef.current;
		if (!element || !map || !filter) return;
		const width = element.offsetWidth;
		const height = element.offsetHeight;
		if (!width || !height) return;
		const { href, scale } = displacementMap(
			width,
			height,
			PANEL_RADIUS,
			PANEL_BEZEL,
			PANEL_BEND,
		);
		for (const node of [filter, map]) {
			node.setAttribute("width", String(width));
			node.setAttribute("height", String(height));
		}
		map.setAttribute("href", href);
		panelScaleRef.current = scale;
	};

	/** Moves the lens onto the highlighted item, or hides it. */
	const updateLens = () => {
		const viewport = viewportRef.current;
		const element = popupRef.current;
		const lens = lensRef.current;
		if (!viewport || !element || !lens) return;
		const item = viewport.querySelector<HTMLElement>("[data-highlighted]");
		const visible = Boolean(item) && "lgmRest" in element.dataset;
		clearTimeout(lensHideRef.current);
		if (!item || !visible) {
			// The highlight clears for a moment between rows; only hide for real
			// if nothing takes it, so the lens glides rather than blinks.
			const hide = () => {
				lens.dataset.visible = "false";
				lensShownRef.current = false;
				lensItemRef.current = null;
			};
			if (item || !lensShownRef.current) hide();
			else lensHideRef.current = setTimeout(hide, 80);
			return;
		}
		lens.dataset.visible = "true";
		if (item === lensItemRef.current && lensShownRef.current) return;
		lensItemRef.current = item;
		const box = viewport.getBoundingClientRect();
		const rect = item.getBoundingClientRect();
		const scale = box.width / (viewport.offsetWidth || box.width) || 1;
		const x = Math.round((rect.left - box.left) / scale + viewport.scrollLeft);
		const y = Math.round((rect.top - box.top) / scale + viewport.scrollTop);
		const width = Math.round(rect.width / scale);
		const height = Math.round(rect.height / scale);

		for (const animation of lensAnimationRef.current) animation.stop();
		// A lens that is just appearing fades in where it is needed.
		const jump = !lensShownRef.current || latest.current.reducedMotion;
		lensShownRef.current = true;
		if (jump) {
			lensX.jump(x);
			lensY.jump(y);
			lensWidth.jump(width);
			lensHeight.jump(height);
			return;
		}
		lensAnimationRef.current = [
			animate(lensX, x, lensSpring),
			animate(lensY, y, lensSpring),
			animate(lensWidth, width, lensSpring),
			animate(lensHeight, height, lensSpring),
		];
	};

	const updateLensRef = useRef(updateLens);
	useLayoutEffect(() => {
		updateLensRef.current = updateLens;
	});

	/** Whether the placed panel covers the trigger, and where the glass starts. */
	const measure = (element: HTMLElement, trigger: HTMLElement) => {
		const anchor = trigger.getBoundingClientRect();
		const place = element.getBoundingClientRect();
		const width = element.offsetWidth;
		const height = element.offsetHeight;
		absorbedRef.current =
			anchor.left >= place.left - 1 &&
			anchor.right <= place.right + 1 &&
			anchor.top >= place.top - 1 &&
			anchor.bottom <= place.bottom + 1;
		const x = anchor.left - place.left;
		const y = anchor.top - place.top;
		if (absorbedRef.current) {
			const radius = Math.min(
				Number.parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 0,
				Math.min(anchor.width, anchor.height) / 2,
			);
			fromRef.current = {
				x,
				y,
				width: anchor.width,
				height: anchor.height,
				radius,
			};
			return;
		}
		// Beside the trigger: a pill as wide as it, on the panel's near edge.
		const placed = element.dataset.side ?? side;
		const vertical = placed === "top" || placed === "bottom";
		const w = Math.min(anchor.width, width);
		const h = Math.min(anchor.height, height);
		const before = placed === "top" || placed === "left";
		fromRef.current = vertical
			? {
					x: clamp(x, 0, width - w),
					y: before ? height - h : 0,
					width: w,
					height: h,
					radius: Math.min(h / 2, PANEL_RADIUS),
				}
			: {
					x: placed === "right" || placed === "inline-end" ? 0 : width - w,
					y: clamp(y, 0, height - h),
					width: w,
					height: h,
					radius: Math.min(w / 2, PANEL_RADIUS),
				};
	};

	/** Rows sharpen in order of distance from the trigger. */
	const orderItems = (element: HTMLElement) => {
		const items = element.querySelectorAll<HTMLElement>("[data-lgm-item]");
		const from = fromRef.current;
		const fromBottom = from
			? from.y + from.height / 2 > element.offsetHeight / 2
			: false;
		items.forEach((item, index) => {
			const order = fromBottom ? items.length - 1 - index : index;
			item.style.setProperty("--lgm-i", String(order));
		});
	};

	const settle = () => {
		clearPaint();
		setPhase("open");
	};

	const startOpen = () => {
		const element = popupRef.current;
		const trigger = triggerRef.current;
		if (!element) return;
		const phase = phaseRef.current;
		if (phase === "pending" || phase === "morph" || phase === "open") return;
		if (phase === "static" && !holdRef.current) return;
		holdRef.current?.cancel();
		holdRef.current = null;
		clearTimers();
		// A drain this interrupts holds still until the open picks it up.
		animationRef.current?.stop();
		element.style.opacity = "";
		if (phase !== "drain") {
			// Whole px, so the glass's edges and its refraction map land on pixels.
			element.style.width = "";
			const width = Number.parseFloat(getComputedStyle(element).width);
			if (width) element.style.width = `${Math.ceil(width - 0.01)}px`;
		}
		if (latest.current.refract) updatePanelMap();

		const atRest = !latest.current.morphing || openAtMountRef.current;
		if (atRest || !trigger) {
			progress.jump(1);
			clearPaint();
			setPhase(latest.current.morphing ? "open" : "static");
			// Base UI places the popup during the first frame; measure after it.
			frameRef.current = requestAnimationFrame(() => {
				if (!trigger) return;
				measure(element, trigger);
				hideTrigger(true);
			});
			return;
		}

		const resuming = phase === "drain";
		if (!resuming) {
			progress.jump(0);
			setPhase("pending");
		}
		frameRef.current = requestAnimationFrame(() => {
			if (!resuming) measure(element, trigger);
			orderItems(element);
			hideTrigger(true);
			setPhase("morph");
			paintRef.current();
			animationRef.current?.stop();
			animationRef.current = animate(progress, 1, {
				...openSpring,
				onUpdate: (value) => {
					if (value >= SETTLED_AT && !("lgmRest" in element.dataset)) {
						element.dataset.lgmRest = "";
					}
				},
				onComplete: settle,
			});
		});
	};

	const startClose = () => {
		const element = popupRef.current;
		if (!element) return;
		const phase = phaseRef.current;
		clearTimers();
		for (const animation of lensAnimationRef.current) animation.stop();
		if (phase === "idle") return;
		animationRef.current?.stop();
		if (phase === "static" || !latest.current.morphing || phase === "pending") {
			// The panel fades out over the trigger as it fades back in. Base UI
			// unmounts once the popup's own animations finish; this one keeps it
			// mounted for as long as the children's fade runs.
			hideTrigger(false);
			if (phase === "static") {
				holdRef.current = element.animate(
					[{ outlineColor: "transparent" }, { outlineColor: "transparent" }],
					{ duration: 150 },
				);
			}
			return;
		}
		const trigger = triggerRef.current;
		const from = clamp(progress.get(), 0, 1);
		// Opened at rest: measure where to drain to now.
		if (phase === "open" && trigger) measure(element, trigger);
		const duration = CLOSE_MS * Math.max(from, 0.4);
		holdRef.current = element.animate(
			[{ outlineColor: "transparent" }, { outlineColor: "transparent" }],
			{ duration },
		);
		setPhase("drain");
		updateLensRef.current();
		paintRef.current();
		animationRef.current = animate(progress, 0, {
			duration: duration / 1000,
			ease: CLOSE_EASE,
			onComplete: () => {
				// Back in the trigger's shape: swap to the trigger in one frame.
				element.style.opacity = "0";
				hideTrigger(false);
			},
		});
	};

	/** Lets go of everything when the popup unmounts. */
	const release = () => {
		clearTimers();
		animationRef.current?.stop();
		swellRef.current?.stop();
		for (const animation of lensAnimationRef.current) animation.stop();
		holdRef.current = null;
		phaseRef.current = "idle";
		lensShownRef.current = false;
		lensItemRef.current = null;
		fromRef.current = null;
		hideTrigger(false);
	};

	const startOpenRef = useRef(startOpen);
	const startCloseRef = useRef(startClose);
	const releaseRef = useRef(release);
	useLayoutEffect(() => {
		startOpenRef.current = startOpen;
		startCloseRef.current = startClose;
		releaseRef.current = release;
	});

	// The popup only exists while the menu is open or draining.
	const popupCallback = useCallback(
		(element: HTMLDivElement | null) => {
			popupRef.current = element;
			setPopup(element);
			setRefs(element, ref as Ref<HTMLDivElement> | undefined);
			if (element) startOpenRef.current();
			else releaseRef.current();
		},
		[ref],
	);

	// Open and close while the popup is mounted: a reopen mid-drain flows back
	// out, and a close drains. Controlled changes animate the same way.
	useLayoutEffect(() => {
		if (!popup) return;
		if (open) startOpenRef.current();
		else startCloseRef.current();
	}, [open, popup]);

	// The lens follows Base UI's highlight, from the pointer and the keyboard.
	useEffect(() => {
		if (!popup) return;
		const observer = new MutationObserver(() => updateLensRef.current());
		observer.observe(popup, {
			attributes: true,
			attributeFilter: ["data-highlighted", "data-lgm-rest"],
			subtree: true,
		});
		return () => observer.disconnect();
	}, [popup]);

	// Focus returns to the trigger on close. After pointer use it shouldn't
	// show a ring there; after keys it should.
	useEffect(() => {
		if (!popup) return;
		const pointer = () => {
			if (triggerRef.current) triggerRef.current.dataset.lgmPointer = "";
		};
		const key = () => {
			if (triggerRef.current) delete triggerRef.current.dataset.lgmPointer;
		};
		document.addEventListener("pointerdown", pointer, true);
		document.addEventListener("keydown", key, true);
		return () => {
			document.removeEventListener("pointerdown", pointer, true);
			document.removeEventListener("keydown", key, true);
		};
	}, [popup, triggerRef]);

	useEffect(() => () => releaseRef.current(), []);

	const absorbs = () => morph && roundTriggerRef.current;

	const glassStyle = support.glass
		? { backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR }
		: undefined;
	// Without the morph, the children fade rather than the popup: opacity on
	// the popup would cut the glass off from the page behind it.
	const fade =
		mode !== "morph" &&
		"transition-opacity duration-150 ease-out group-data-ending-style/lgm:opacity-0 group-data-starting-style/lgm:opacity-0";

	return (
		<MenuPrimitive.Portal>
			{support.refract ? (
				<svg aria-hidden width={0} height={0} className="absolute">
					<defs>
						<filter
							ref={panelFilterRef}
							id={panelFilterId}
							x={0}
							y={0}
							filterUnits="userSpaceOnUse"
							primitiveUnits="userSpaceOnUse"
							colorInterpolationFilters="sRGB"
						>
							<feImage
								ref={panelMapRef}
								x={0}
								y={0}
								preserveAspectRatio="none"
								result="map"
							/>
							<feDisplacementMap
								ref={panelDisplaceRef}
								in="SourceGraphic"
								in2="map"
								scale={0}
								xChannelSelector="R"
								yChannelSelector="G"
							/>
						</filter>
					</defs>
				</svg>
			) : null}
			<MenuPrimitive.Positioner
				className="isolate z-50 outline-none"
				side={side}
				align={align}
				collisionPadding={collisionPadding}
				sideOffset={
					sideOffset ??
					(({ anchor, side: placed }) =>
						absorbs()
							? -(
									(placed === "top" || placed === "bottom"
										? anchor.height
										: anchor.width) + ABSORB_INSET
								)
							: SIDE_OFFSET)
				}
				alignOffset={alignOffset ?? (() => (absorbs() ? -ABSORB_INSET : 0))}
			>
				<MenuPrimitive.Popup
					ref={popupCallback}
					data-slot="liquid-glass-menu-content"
					data-mode={mode}
					data-solid={!support.glass || undefined}
					className={withClasses(
						cn(
							"group/lgm relative flex max-h-(--available-height) min-w-48 flex-col rounded-[24px] text-foreground outline-none",
							mode === "pop" &&
								"origin-(--transform-origin) transition-[scale] duration-150 ease-out data-ending-style:scale-[0.96] data-starting-style:scale-[0.96]",
							"data-[lgm-phase=pending]:opacity-0",
							// The items' blur and fade per phase; see `ITEM_MORPH`.
							"data-[lgm-phase=pending]:[--lgm-fade:0] data-[lgm-phase=pending]:[--lgm-filter:blur(4px)]",
							"data-[lgm-phase=morph]:[--lgm-delay:80ms] data-[lgm-phase=morph]:[--lgm-duration:160ms] data-[lgm-phase=morph]:[--lgm-filter:blur(0px)] data-[lgm-phase=morph]:[--lgm-stagger:16ms]",
							"data-[lgm-phase=drain]:[--lgm-duration:70ms] data-[lgm-phase=drain]:[--lgm-fade:0]",
						),
						className,
					)}
					{...props}
				>
					{/* The glass: blur, fill, hairline, and shadow. During the morph it
					    changes shape, from the trigger's to the panel's. */}
					<span
						ref={shellRef}
						aria-hidden
						data-slot="liquid-glass-menu-surface"
						className={cn(
							"pointer-events-none absolute inset-0 rounded-[inherit]",
							support.glass ? GLASS_FILL : SOLID_FILL,
							GLASS_EDGE,
							fade,
						)}
						style={glassStyle}
					>
						<span
							ref={ambientRef}
							className={cn("absolute inset-0 rounded-[inherit]", PANEL_SHADOW)}
						/>
					</span>
					<div
						ref={viewportRef}
						data-slot="liquid-glass-menu-viewport"
						className={cn(
							"relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[inherit] [scrollbar-width:thin]",
							fade,
						)}
						style={{ padding: PANEL_PADDING }}
					>
						{/* The lens: a clear pill of glass under the highlighted item. */}
						<span
							ref={lensRef}
							aria-hidden
							data-slot="liquid-glass-menu-lens"
							data-visible="false"
							className={cn(
								"pointer-events-none absolute top-0 left-0 opacity-0 transition-[opacity,scale,background-color] duration-150 ease-out data-[visible=true]:opacity-100 motion-reduce:transition-none",
								support.glass ? LENS_GLASS : LENS_SOLID,
								LENS_PRESSED,
								support.glass ? LENS_PRESSED_GLASS : LENS_PRESSED_SOLID,
							)}
							style={{ borderRadius: ITEM_RADIUS }}
						/>
						<div className="relative flex flex-col">{children}</div>
					</div>
				</MenuPrimitive.Popup>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

/**
 * Every row starts blurred and clear, then sharpens 16 ms after the row
 * nearer the trigger. The values come from the popup's phase; at rest they
 * resolve to no filter at all.
 */
const ITEM_MORPH =
	"[filter:var(--lgm-filter,none)] [opacity:calc(var(--lgm-fade,1)*var(--lgm-dim,1))] [transition-delay:calc(var(--lgm-delay,0ms)+var(--lgm-i,0)*var(--lgm-stagger,0ms))] [transition-duration:var(--lgm-duration,0ms)] [transition-property:filter,opacity] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]";

/**
 * 40 px rows (44 px on touch), 12 px in from the lens, with a 16 px icon
 * column and a 12 px gap, so labels line up whatever the row type. The lens
 * and a stronger label mark the highlight; nothing moves.
 */
const ITEM_CLASS = cn(
	"group/lgm-item relative flex min-h-10 pointer-coarse:min-h-11 cursor-default select-none items-center gap-3 px-3 py-2 text-foreground/85 text-sm leading-5 outline-none [-webkit-tap-highlight-color:transparent] dark:text-foreground/90",
	"data-disabled:pointer-events-none data-highlighted:text-foreground data-disabled:[--lgm-dim:0.45]",
	ITEM_MORPH,
);

const ICON_CLASS =
	"grid min-w-4 shrink-0 place-items-center [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0";

/** The label and the shortcut share a baseline. */
function ItemText({
	children,
	shortcut,
}: {
	children?: ReactNode;
	shortcut?: ReactNode;
}) {
	return (
		<span className="flex min-w-0 flex-1 items-baseline gap-4">
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{shortcut === undefined || shortcut === null ? null : (
				<span
					data-slot="liquid-glass-menu-shortcut"
					className="shrink-0 text-foreground/75 text-xs tabular-nums dark:text-foreground/80"
				>
					{shortcut}
				</span>
			)}
		</span>
	);
}

function CheckIcon() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-4"
		>
			<path d="m3.5 8.5 3 3 6-7" />
		</svg>
	);
}

/**
 * Stops a long press on the swallowed trigger from choosing whichever row has
 * grown over it by the time the button comes up. A press dragged onto a row
 * away from the trigger still chooses it.
 */
function useReleaseGuard() {
	const { triggerPressRef, triggerRef } = useLiquidGlassMenu();
	return (event: {
		clientX: number;
		clientY: number;
		preventBaseUIHandler?: () => void;
	}) => {
		const trigger = triggerRef.current;
		if (!triggerPressRef.current || !trigger) return;
		const rect = trigger.getBoundingClientRect();
		if (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		) {
			event.preventBaseUIHandler?.();
		}
	};
}

export interface LiquidGlassMenuItemProps
	extends Omit<MenuPrimitive.Item.Props, "children"> {
	/** Leading icon, such as a lucide icon or a colored badge. Plain icons are drawn at 16 px. */
	icon?: ReactNode;
	/** Trailing hint, such as a keyboard shortcut. Shown, not bound. */
	shortcut?: ReactNode;
	/** The label. */
	children?: ReactNode;
}

export function LiquidGlassMenuItem({
	icon,
	shortcut,
	children,
	className,
	onClick,
	onMouseUp,
	...props
}: LiquidGlassMenuItemProps) {
	const { feedback } = useLiquidGlassMenu();
	const guard = useReleaseGuard();
	return (
		<MenuPrimitive.Item
			data-slot="liquid-glass-menu-item"
			data-lgm-item=""
			className={withClasses(ITEM_CLASS, className)}
			onClick={(event) => {
				feedback("select");
				onClick?.(event);
			}}
			onMouseUp={(event) => {
				guard(event);
				onMouseUp?.(event);
			}}
			{...props}
		>
			{icon ? (
				<span data-slot="liquid-glass-menu-item-icon" className={ICON_CLASS}>
					{icon}
				</span>
			) : null}
			<ItemText shortcut={shortcut}>{children}</ItemText>
		</MenuPrimitive.Item>
	);
}

export interface LiquidGlassMenuCheckboxItemProps
	extends Omit<MenuPrimitive.CheckboxItem.Props, "children"> {
	/** Trailing hint, such as a keyboard shortcut. Shown, not bound. */
	shortcut?: ReactNode;
	/** The label. */
	children?: ReactNode;
}

/** A row that toggles. It stays open on click unless `closeOnClick` is set. */
export function LiquidGlassMenuCheckboxItem({
	shortcut,
	children,
	className,
	onClick,
	onMouseUp,
	...props
}: LiquidGlassMenuCheckboxItemProps) {
	const { feedback } = useLiquidGlassMenu();
	const guard = useReleaseGuard();
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="liquid-glass-menu-checkbox-item"
			data-lgm-item=""
			className={withClasses(ITEM_CLASS, className)}
			onClick={(event) => {
				feedback("select");
				onClick?.(event);
			}}
			onMouseUp={(event) => {
				guard(event);
				onMouseUp?.(event);
			}}
			{...props}
		>
			<span className="grid size-4 shrink-0 place-items-center">
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			<ItemText shortcut={shortcut}>{children}</ItemText>
		</MenuPrimitive.CheckboxItem>
	);
}

export function LiquidGlassMenuRadioGroup(
	props: MenuPrimitive.RadioGroup.Props,
) {
	return (
		<MenuPrimitive.RadioGroup
			data-slot="liquid-glass-menu-radio-group"
			{...props}
		/>
	);
}

export interface LiquidGlassMenuRadioItemProps
	extends Omit<MenuPrimitive.RadioItem.Props, "children"> {
	/** Trailing hint, such as a keyboard shortcut. Shown, not bound. */
	shortcut?: ReactNode;
	/** The label. */
	children?: ReactNode;
}

/** One choice in a `LiquidGlassMenuRadioGroup`. It stays open on click unless `closeOnClick` is set. */
export function LiquidGlassMenuRadioItem({
	shortcut,
	children,
	className,
	onClick,
	onMouseUp,
	...props
}: LiquidGlassMenuRadioItemProps) {
	const { feedback } = useLiquidGlassMenu();
	const guard = useReleaseGuard();
	return (
		<MenuPrimitive.RadioItem
			data-slot="liquid-glass-menu-radio-item"
			data-lgm-item=""
			className={withClasses(ITEM_CLASS, className)}
			onClick={(event) => {
				feedback("select");
				onClick?.(event);
			}}
			onMouseUp={(event) => {
				guard(event);
				onMouseUp?.(event);
			}}
			{...props}
		>
			<span className="grid size-4 shrink-0 place-items-center">
				<MenuPrimitive.RadioItemIndicator>
					<span className="block size-1.5 rounded-full bg-current" />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			<ItemText shortcut={shortcut}>{children}</ItemText>
		</MenuPrimitive.RadioItem>
	);
}

export function LiquidGlassMenuGroup(props: MenuPrimitive.Group.Props) {
	return <MenuPrimitive.Group data-slot="liquid-glass-menu-group" {...props} />;
}

/** A heading for a `LiquidGlassMenuGroup` or `LiquidGlassMenuRadioGroup`. */
export function LiquidGlassMenuLabel({
	className,
	...props
}: MenuPrimitive.GroupLabel.Props) {
	return (
		<MenuPrimitive.GroupLabel
			data-slot="liquid-glass-menu-label"
			data-lgm-item=""
			className={withClasses(
				// Lines up with the item labels, past the 16 px icon column.
				cn(
					"flex h-7 items-end pr-3 pb-1 pl-10 font-medium text-foreground/75 text-xs leading-4 dark:text-foreground/80",
					ITEM_MORPH,
				),
				className,
			)}
			{...props}
		/>
	);
}

export function LiquidGlassMenuSeparator({
	className,
	...props
}: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="liquid-glass-menu-separator"
			data-lgm-item=""
			className={withClasses(
				// An 8 px band with a hairline in it, inset like the item padding:
				// one device pixel at 2x, centred.
				cn(
					"relative mx-3 h-2 shrink-0 before:absolute before:inset-x-0 before:top-[3.25px] before:h-px before:scale-y-50 before:bg-foreground/15",
					ITEM_MORPH,
				),
				className,
			)}
			{...props}
		/>
	);
}

export default LiquidGlassMenu;
