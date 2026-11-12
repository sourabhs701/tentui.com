"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	motion,
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

// Layout, in px.
const PANEL_RADIUS = 24;
/** Panel padding; item corners are concentric with the panel's. */
const PANEL_PADDING = 6;
const ITEM_RADIUS = PANEL_RADIUS - PANEL_PADDING;
/** How far the panel reaches past a trigger it swallows, all round. */
const ABSORB_INSET = 6;
/** Gap to a trigger the panel doesn't swallow. */
const SIDE_OFFSET = 8;

// Motion. Progress runs from 0 (a blob over the trigger) to 1 (the panel).
/** About 280 ms to settle, with a 3% overshoot: a few px on a 200 px panel. */
const openSpring = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	restDelta: 0.0005,
	restSpeed: 0.01,
} as const;
/** The drain: no overshoot, easing into the trigger so the merge reads. */
const CLOSE_MS = 220;
const CLOSE_EASE = [0.4, 0, 0.5, 1] as const;
/** About 160 ms between neighbouring items, with no visible overshoot. */
const lensSpring = { type: "spring", stiffness: 700, damping: 48 } as const;
/** Progress at which the goo hands over to the real glass. */
const HANDOFF_AT = 0.99;
/** How long the goo and the glass cross-fade, in ms. */
const HANDOFF_MS = 140;
/** Items start sharpening 40 ms into the morph, 20 ms apart, over 180 ms. */
const ITEM_DELAY_MS = 40;
const ITEM_STAGGER_MS = 20;
const ITEM_SHARPEN_MS = 180;

/** The frost behind the glass. */
const GLASS_BLUR = "blur(20px) saturate(180%)";

// The goo: both shapes are blurred together, then the alpha is cut back to a
// hard edge, so where they meet the edge flows round in a concave neck.
const GOO_BLUR = 7;
const GOO_MATRIX = "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10";

// Refraction: displacement maps that bend what's behind the glass.
/** Width of the bent band at the panel's rim, in px. */
const PANEL_BEZEL = 24;
/** Furthest the backdrop is pulled in at the very rim, in px. */
const PANEL_BEND = 16;
/**
 * The lens magnifies what's under it a little, like a drop of water. It has
 * no bent rim: that would chip the edge of an icon sitting near it.
 */
const LENS_ZOOM = 1.05;

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
 * - `morph`: the blob flows out of the trigger and the items sharpen.
 * - `open`: at rest. No goo, no blur on the items, nothing animating.
 * - `drain`: flowing back into the trigger.
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
 * it. Within `bezel` of the rim it points inward by up to `bend` px, harder
 * toward the edge, so the glass samples from further in and the backdrop bends
 * like it does at the edge of a lens. `zoom` above 1 magnifies toward the center.
 */
function displacementMap(
	width: number,
	height: number,
	radius: number,
	{
		bezel = 1,
		bend = 0,
		zoom = 1,
	}: { bezel?: number; bend?: number; zoom?: number },
) {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const shrink = 1 - 1 / zoom;
	const reach = bend + Math.max(halfWidth, halfHeight) * shrink;
	const scale = Math.ceil(reach * 2);
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
			const t = clamp(1 - depth / bezel, 0, 1);
			const rim = bend * t * t;
			const dx = -rim * nx * Math.sign(px) - px * shrink;
			const dy = -rim * ny * Math.sign(py) - py * shrink;
			const i = (y * width + x) * 4;
			image.data[i] = 128 + (127 * dx) / reach;
			image.data[i + 1] = 128 + (127 * dy) / reach;
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
			strokeWidth={1.8}
			strokeLinecap="round"
			className="size-5"
		>
			<path d="M10 4v12M4 10h12" />
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
	...props
}: LiquidGlassMenuTriggerProps) {
	const context = useLiquidGlassMenu();
	const round = render === undefined;
	useLayoutEffect(() => {
		context.roundTriggerRef.current = round;
	});

	return (
		<MenuPrimitive.Trigger
			data-slot="liquid-glass-menu-trigger"
			data-solid={!context.support.glass || undefined}
			ref={(element: HTMLButtonElement | null) => {
				context.triggerRef.current = element;
				setRefs(element, ref as Ref<HTMLButtonElement> | undefined);
			}}
			render={render}
			onPointerDown={(event) => {
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
			className={
				round
					? withClasses(
							cn(
								"relative inline-grid size-11 shrink-0 cursor-pointer select-none place-items-center rounded-full text-foreground outline-none [-webkit-tap-highlight-color:transparent]",
								"bg-white/72 backdrop-blur-xl backdrop-saturate-[1.8] hover:bg-white/90 dark:bg-white/12 dark:hover:bg-white/18",
								"shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_0_0.5px_rgb(0_0_0/0.07),0_1px_2px_rgb(0_0_0/0.08),0_6px_16px_-4px_rgb(0_0_0/0.18)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),inset_0_0_0_0.5px_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.5),0_8px_20px_-4px_rgb(0_0_0/0.6)]",
								"data-solid:bg-popover data-solid:backdrop-filter-none",
								"transition-[scale,opacity,background-color] duration-150 ease-out active:scale-[0.94] motion-reduce:transition-none",
								// Swallowed by the open panel; it fades back in under the drain.
								"[&[data-popup-open][data-lgm-absorbed]]:opacity-0",
								"focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								"disabled:pointer-events-none disabled:opacity-50",
							),
							className,
						)
					: className
			}
			{...props}
		>
			{children ?? (round ? <PlusIcon /> : null)}
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
	const gooId = `liquid-glass-menu-${ids}-goo`;
	const panelFilterId = `liquid-glass-menu-${ids}-panel`;
	const lensFilterId = `liquid-glass-menu-${ids}-lens`;

	const popupRef = useRef<HTMLDivElement | null>(null);
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const backdropRef = useRef<HTMLSpanElement | null>(null);
	const gooRef = useRef<SVGSVGElement | null>(null);
	const gooFilterRef = useRef<SVGFilterElement | null>(null);
	const gooPanelRef = useRef<SVGRectElement | null>(null);
	const gooTriggerRef = useRef<SVGRectElement | null>(null);
	const panelMapRef = useRef<SVGFEImageElement | null>(null);
	const panelFilterRef = useRef<SVGFilterElement | null>(null);
	const lensMapRef = useRef<SVGFEImageElement | null>(null);
	const lensFilterRef = useRef<SVGFilterElement | null>(null);
	const lensRefs = useRef<Array<HTMLSpanElement | null>>([]);
	const [popup, setPopup] = useState<HTMLDivElement | null>(null);

	const progress = useMotionValue(0);
	const lensX = useMotionValue(0);
	const lensY = useMotionValue(0);
	const lensWidth = useMotionValue(0);
	const lensHeight = useMotionValue(0);
	/** How far the magnifier has swelled in, from 0 to 1. */
	const lensZoom = useMotionValue(0);
	const lensZoomRef = useRef<AnimationPlaybackControls | null>(null);
	const lensScaleRef = useRef(0);

	const phaseRef = useRef<Phase>("idle");
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const lensAnimationRef = useRef<AnimationPlaybackControls[]>([]);
	const holdRef = useRef<Animation | null>(null);
	const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
	const frameRef = useRef(0);
	const lensShownRef = useRef(false);
	const lensHideRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const lensFocusRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const lensMapSizeRef = useRef("");
	/** Whether the panel covers the trigger; measured when it opens. */
	const absorbedRef = useRef(false);
	const triggerRadiusRef = useRef(0);
	/** The open started from the trigger, not from a drain it interrupted. */
	const leadRef = useRef(false);
	const lensItemRef = useRef<HTMLElement | null>(null);

	const latest = useRef({ morphing, refract: support.refract, reducedMotion });
	useLayoutEffect(() => {
		latest.current = { morphing, refract: support.refract, reducedMotion };
	});

	const clearTimers = () => {
		for (const timer of timersRef.current) clearTimeout(timer);
		timersRef.current = [];
		cancelAnimationFrame(frameRef.current);
		clearTimeout(lensHideRef.current);
		clearTimeout(lensFocusRef.current);
	};

	const later = (ms: number, run: () => void) => {
		timersRef.current.push(setTimeout(run, ms));
	};

	const setPhase = (phase: Phase) => {
		phaseRef.current = phase;
		const element = popupRef.current;
		if (!element) return;
		element.dataset.lgmPhase = phase;
		const resting = phase === "open" || phase === "static";
		if (resting) element.dataset.lgmSurface = "";
		// The rim only bends at rest: Chromium feeds `url()` filters a stale
		// backdrop while their element moves.
		const backdrop = backdropRef.current;
		if (backdrop && latest.current.refract) {
			backdrop.style.backdropFilter = resting
				? `${GLASS_BLUR} url(#${panelFilterId})`
				: GLASS_BLUR;
		}
	};

	const showGoo = (visible: boolean) => {
		const goo = gooRef.current;
		if (!goo) return;
		goo.style.transition = "";
		goo.style.display = visible ? "block" : "none";
		if (!visible) goo.style.opacity = "0";
	};

	/** Writes the frame for the current progress: the popup and the goo. */
	const paint = () => {
		const element = popupRef.current;
		const trigger = triggerRef.current;
		const positioner = element?.parentElement;
		if (!element || !trigger || !positioner) return;
		const width = element.offsetWidth;
		const height = element.offsetHeight;
		if (!width || !height) return;
		const value = progress.get();
		const lit = clamp(value, 0, 1);
		const anchor = trigger.getBoundingClientRect();
		const place = positioner.getBoundingClientRect();

		// Starts as a circle the size of the trigger, centered on it.
		const triggerSize = Math.min(anchor.width, anchor.height);
		const from = clamp(triggerSize / Math.min(width, height), 0.05, 1);
		const scale = from + (1 - from) * value;
		const anchorX = anchor.left + anchor.width / 2;
		const anchorY = anchor.top + anchor.height / 2;
		const restX = place.left + width / 2;
		const restY = place.top + height / 2;
		// The panel's center runs ahead of its growth, so early on the trigger
		// still bulges out of its corner and the goo pulls a neck between them.
		const travel =
			phaseRef.current === "morph" && value < 1 ? value * (2 - value) : value;
		const dx = (anchorX - restX) * (1 - travel);
		const dy = (anchorY - restY) * (1 - travel);
		const radius =
			PANEL_RADIUS + (Math.min(width, height) / 2 - PANEL_RADIUS) * (1 - lit);
		element.style.transform = `translate(${round(dx)}px, ${round(dy)}px) scale(${round(scale)})`;
		element.style.borderRadius = `${round(radius)}px`;

		const goo = gooRef.current;
		const panelShape = gooPanelRef.current;
		const triggerShape = gooTriggerRef.current;
		const filter = gooFilterRef.current;
		if (!goo || goo.style.display === "none") return;
		if (!panelShape || !triggerShape || !filter) return;
		const panelWidth = width * scale;
		const panelHeight = height * scale;
		const panelX = restX + dx - panelWidth / 2;
		const panelY = restY + dy - panelHeight / 2;
		panelShape.setAttribute("x", String(round(panelX)));
		panelShape.setAttribute("y", String(round(panelY)));
		panelShape.setAttribute("width", String(round(panelWidth)));
		panelShape.setAttribute("height", String(round(panelHeight)));
		panelShape.setAttribute("rx", String(round(radius * scale)));

		// A swallowed trigger is a blob of its own; one the panel sits beside
		// gets a short nub on its facing edge, so the neck doesn't cover it.
		let shape = {
			x: anchor.left,
			y: anchor.top,
			width: anchor.width,
			height: anchor.height,
			rx: triggerRadiusRef.current,
		};
		if (!absorbedRef.current) {
			const nub = Math.min(anchor.width, anchor.height, 36) * 0.8;
			const vertical =
				Math.abs(restY - anchorY) / (height + anchor.height) >
				Math.abs(restX - anchorX) / (width + anchor.width);
			shape = vertical
				? {
						x: anchorX - nub / 2,
						y: restY < anchorY ? anchor.top - 6 : anchor.bottom - 6,
						width: nub,
						height: 12,
						rx: 6,
					}
				: {
						x: restX < anchorX ? anchor.left - 6 : anchor.right - 6,
						y: anchorY - nub / 2,
						width: 12,
						height: nub,
						rx: 6,
					};
		}
		triggerShape.setAttribute("x", String(round(shape.x)));
		triggerShape.setAttribute("y", String(round(shape.y)));
		triggerShape.setAttribute("width", String(round(shape.width)));
		triggerShape.setAttribute("height", String(round(shape.height)));
		triggerShape.setAttribute("rx", String(round(shape.rx)));

		const left = Math.min(panelX, shape.x) - 48;
		const top = Math.min(panelY, shape.y) - 48;
		const right = Math.max(panelX + panelWidth, shape.x + shape.width) + 48;
		const bottom = Math.max(panelY + panelHeight, shape.y + shape.height) + 48;
		filter.setAttribute("x", String(round(left)));
		filter.setAttribute("y", String(round(top)));
		filter.setAttribute("width", String(round(right - left)));
		filter.setAttribute("height", String(round(bottom - top)));

		// Fades in over the trigger as it starts, and out as it lands back. The
		// blur goes with it, or a tiny saturated smudge is left on its own.
		const phase = phaseRef.current;
		let opacity = 1;
		if (phase === "morph") opacity = clamp(value / 0.12, 0, 1);
		else if (phase === "drain") opacity = clamp(value / 0.3, 0, 1);
		if (goo.style.transition === "") goo.style.opacity = String(round(opacity));
		if (backdropRef.current) {
			backdropRef.current.style.opacity =
				opacity < 1 ? String(round(opacity)) : "";
		}
	};

	const paintRef = useRef(paint);
	useLayoutEffect(() => {
		paintRef.current = paint;
	});

	useEffect(() => progress.on("change", () => paintRef.current()), [progress]);

	const updatePanelMap = () => {
		const element = popupRef.current;
		const map = panelMapRef.current;
		const filter = panelFilterRef.current;
		if (!element || !map || !filter) return;
		const width = element.offsetWidth;
		const height = element.offsetHeight;
		if (!width || !height) return;
		const { href, scale } = displacementMap(width, height, PANEL_RADIUS, {
			bezel: PANEL_BEZEL,
			bend: PANEL_BEND,
		});
		for (const node of [filter, map]) {
			node.setAttribute("width", String(width));
			node.setAttribute("height", String(height));
		}
		map.setAttribute("href", href);
		map.nextElementSibling?.setAttribute("scale", String(scale));
	};

	const paintZoom = () => {
		lensMapRef.current?.nextElementSibling?.setAttribute(
			"scale",
			String(round(lensScaleRef.current * lensZoom.get())),
		);
	};
	const paintZoomRef = useRef(paintZoom);
	useLayoutEffect(() => {
		paintZoomRef.current = paintZoom;
	});
	useEffect(
		() => lensZoom.on("change", () => paintZoomRef.current()),
		[lensZoom],
	);

	/** Moves the lens onto the highlighted item, or hides it. */
	const updateLens = (instant = false) => {
		const viewport = viewportRef.current;
		const element = popupRef.current;
		if (!viewport || !element) return;
		const item = viewport.querySelector<HTMLElement>("[data-highlighted]");
		const visible = Boolean(item) && "lgmSurface" in element.dataset;
		clearTimeout(lensHideRef.current);
		clearTimeout(lensFocusRef.current);
		if (!item || !visible) {
			// The highlight clears for a moment between rows; only hide for real
			// if nothing takes it, so the lens slides rather than jumps.
			const hide = () => {
				for (const lens of lensRefs.current) {
					if (lens) lens.dataset.visible = "false";
				}
				lensShownRef.current = false;
			};
			if (item || !lensShownRef.current) hide();
			else lensHideRef.current = setTimeout(hide, 80);
			return;
		}
		const [body, refraction, rim] = lensRefs.current;
		if (body) body.dataset.visible = "true";
		if (item === lensItemRef.current && lensShownRef.current && !instant)
			return;
		lensItemRef.current = item;
		// Chromium serves `backdrop-filter: url()` a stale backdrop while its
		// element moves, so the magnifier only comes in once the lens has landed.
		// It swells in from no displacement rather than fading, which would
		// show the plain and the magnified items at once.
		const focus = (on: boolean) => {
			for (const lens of [refraction, rim]) {
				if (lens) lens.dataset.visible = on ? "true" : "false";
			}
			lensZoomRef.current?.stop();
			lensZoom.jump(0);
			if (on && !latest.current.reducedMotion) {
				lensZoomRef.current = animate(lensZoom, 1, {
					duration: 0.18,
					ease: "easeOut",
				});
			} else if (on) lensZoom.jump(1);
		};
		const box = viewport.getBoundingClientRect();
		const rect = item.getBoundingClientRect();
		const scale = box.width / (viewport.offsetWidth || box.width) || 1;
		const x = (rect.left - box.left) / scale + viewport.scrollLeft;
		const y = (rect.top - box.top) / scale + viewport.scrollTop;
		const width = rect.width / scale;
		const height = rect.height / scale;

		for (const animation of lensAnimationRef.current) animation.stop();
		const shown = lensShownRef.current;
		const jump = instant || !shown || latest.current.reducedMotion;
		lensShownRef.current = true;
		if (jump) {
			lensX.jump(x);
			lensY.jump(y);
			lensWidth.jump(width);
			lensHeight.jump(height);
			// A lens that is just appearing fades in first.
			if (shown || latest.current.reducedMotion) focus(true);
			else {
				focus(false);
				lensFocusRef.current = setTimeout(() => focus(true), 150);
			}
		} else {
			focus(false);
			lensAnimationRef.current = [
				animate(lensX, x, lensSpring),
				animate(lensY, y, { ...lensSpring, onComplete: () => focus(true) }),
				animate(lensWidth, width, lensSpring),
				animate(lensHeight, height, lensSpring),
			];
		}

		const map = lensMapRef.current;
		const filter = lensFilterRef.current;
		const size = `${Math.round(width)}x${Math.round(height)}`;
		if (map && filter && lensMapSizeRef.current !== size) {
			lensMapSizeRef.current = size;
			const w = Math.round(width);
			const h = Math.round(height);
			for (const node of [filter, map]) {
				node.setAttribute("width", String(w));
				node.setAttribute("height", String(h));
			}
			const { href, scale } = displacementMap(w, h, ITEM_RADIUS, {
				zoom: LENS_ZOOM,
			});
			map.setAttribute("href", href);
			lensScaleRef.current = scale;
			paintZoom();
		}
	};

	const updateLensRef = useRef(updateLens);
	useLayoutEffect(() => {
		updateLensRef.current = updateLens;
	});

	/** The goo has done its job: show the glass and let the goo fade away. */
	const handOff = () => {
		const element = popupRef.current;
		if (!element || "lgmSurface" in element.dataset) return;
		element.dataset.lgmSurface = "";
		const goo = gooRef.current;
		if (goo) {
			goo.style.transition = `opacity ${HANDOFF_MS}ms ease-out`;
			goo.style.opacity = "0";
		}
		later(HANDOFF_MS + 20, () => {
			if (phaseRef.current === "morph" || phaseRef.current === "open") {
				showGoo(false);
			}
		});
		updateLensRef.current(true);
	};

	const settle = () => {
		const element = popupRef.current;
		if (!element) return;
		handOff();
		element.style.transform = "";
		element.style.borderRadius = "";
		setPhase("open");
	};

	/** Whether the placed panel covers the trigger, which then hides under it. */
	const measureAbsorbed = (element: HTMLElement, trigger: HTMLElement) => {
		const anchor = trigger.getBoundingClientRect();
		const place = element.parentElement?.getBoundingClientRect();
		absorbedRef.current = Boolean(
			place &&
				anchor.left >= place.left - 1 &&
				anchor.right <= place.right + 1 &&
				anchor.top >= place.top - 1 &&
				anchor.bottom <= place.bottom + 1,
		);
		if (absorbedRef.current) trigger.dataset.lgmAbsorbed = "";
		else delete trigger.dataset.lgmAbsorbed;
		return anchor;
	};

	const startOpen = () => {
		const element = popupRef.current;
		const trigger = triggerRef.current;
		if (!element) return;
		const phase = phaseRef.current;
		if (phase === "pending" || phase === "morph" || phase === "open") return;
		holdRef.current?.cancel();
		holdRef.current = null;
		clearTimers();
		// A drain this interrupts holds still until the morph picks it up.
		animationRef.current?.stop();
		element.style.opacity = "";
		if (latest.current.refract) updatePanelMap();

		const atRest = !latest.current.morphing || openAtMountRef.current;
		if (atRest || !trigger) {
			progress.jump(1);
			setPhase(latest.current.morphing ? "open" : "static");
			element.style.transform = "";
			element.style.borderRadius = "";
			// Base UI places the popup during the first frame; measure after it.
			frameRef.current = requestAnimationFrame(() => {
				if (trigger) measureAbsorbed(element, trigger);
			});
			return;
		}

		const resuming = phase === "drain";
		leadRef.current = !resuming;
		if (!resuming) {
			progress.jump(0);
			setPhase("pending");
		}
		// Base UI places the popup during the first frame; measure after it.
		frameRef.current = requestAnimationFrame(() => {
			const anchor = measureAbsorbed(element, trigger);
			triggerRadiusRef.current = Math.min(
				Number.parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 0,
				Math.min(anchor.width, anchor.height) / 2,
			);
			element
				.querySelectorAll<HTMLElement>("[data-lgm-item]")
				.forEach((item, index) => {
					item.style.setProperty("--lgm-i", String(index));
				});
			delete element.dataset.lgmSurface;
			setPhase("morph");
			showGoo(true);
			paintRef.current();
			animationRef.current?.stop();
			const startedAt = performance.now();
			animationRef.current = animate(progress, 1, {
				...openSpring,
				onUpdate: (value) => {
					if (value >= HANDOFF_AT) handOff();
				},
				onComplete: () => {
					// Items further down the list may still be sharpening.
					const items = element.querySelectorAll("[data-lgm-item]").length;
					const sharpened =
						ITEM_DELAY_MS +
						ITEM_STAGGER_MS * Math.max(items - 1, 0) +
						ITEM_SHARPEN_MS;
					const elapsed = performance.now() - startedAt;
					later(Math.max(0, sharpened - elapsed), () => {
						if (phaseRef.current === "morph") settle();
					});
					handOff();
					element.style.transform = "";
					element.style.borderRadius = "";
				},
			});
		});
	};

	const startClose = () => {
		const element = popupRef.current;
		if (!element) return;
		const phase = phaseRef.current;
		clearTimers();
		for (const animation of lensAnimationRef.current) animation.stop();
		if (phase === "static" || phase === "idle" || !latest.current.morphing) {
			return;
		}
		animationRef.current?.stop();
		if (phase === "pending") {
			progress.jump(0);
			return;
		}
		const from = clamp(progress.get(), 0, 1);
		const duration = CLOSE_MS * Math.max(from, 0.3);
		// Base UI unmounts once the popup's own animations finish; this one
		// keeps it mounted for exactly as long as the drain runs.
		holdRef.current = element.animate(
			[{ outlineColor: "transparent" }, { outlineColor: "transparent" }],
			{ duration },
		);
		delete element.dataset.lgmSurface;
		updateLensRef.current();
		leadRef.current = false;
		setPhase("drain");
		showGoo(true);
		if (gooRef.current) gooRef.current.style.opacity = "1";
		paintRef.current();
		animationRef.current = animate(progress, 0, {
			duration: duration / 1000,
			ease: CLOSE_EASE,
			onComplete: () => {
				showGoo(false);
				// Back inside the trigger; Base UI unmounts it next.
				element.style.opacity = "0";
			},
		});
	};

	/** Lets go of everything when the popup unmounts. */
	const release = () => {
		clearTimers();
		animationRef.current?.stop();
		lensZoomRef.current?.stop();
		for (const animation of lensAnimationRef.current) animation.stop();
		holdRef.current = null;
		phaseRef.current = "idle";
		lensShownRef.current = false;
		lensItemRef.current = null;
		lensMapSizeRef.current = "";
		const trigger = triggerRef.current;
		if (trigger) delete trigger.dataset.lgmAbsorbed;
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
			attributeFilter: ["data-highlighted", "data-lgm-surface"],
			subtree: true,
		});
		return () => observer.disconnect();
	}, [popup]);

	useEffect(() => () => releaseRef.current(), []);

	const absorbs = () => morph && roundTriggerRef.current;

	const glassStyle = support.glass
		? { backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR }
		: undefined;

	return (
		<MenuPrimitive.Portal>
			{morphing ? (
				<svg
					ref={gooRef}
					aria-hidden
					data-slot="liquid-glass-menu-goo"
					className={cn(
						"pointer-events-none fixed inset-0 z-50 size-full overflow-visible [--lgm-goo-shadow:rgb(0_0_0/0.2)] dark:[--lgm-goo-shadow:rgb(0_0_0/0.7)]",
						// The same fill as the surface, so the hand-off doesn't show.
						support.glass
							? "[--lgm-goo-alpha:0.76] [--lgm-goo-fill:#fff] dark:[--lgm-goo-alpha:0.8] dark:[--lgm-goo-fill:rgb(30_30_34)]"
							: "[--lgm-goo-alpha:1] [--lgm-goo-fill:var(--popover)]",
					)}
					style={{ display: "none", opacity: 0 }}
				>
					<defs>
						<filter
							ref={gooFilterRef}
							id={gooId}
							filterUnits="userSpaceOnUse"
							colorInterpolationFilters="sRGB"
						>
							<feGaussianBlur
								in="SourceGraphic"
								stdDeviation={GOO_BLUR}
								result="blur"
							/>
							<feColorMatrix
								in="blur"
								type="matrix"
								values={GOO_MATRIX}
								result="goo"
							/>
							<feGaussianBlur in="goo" stdDeviation={12} result="spread" />
							<feOffset in="spread" dy={8} result="drop" />
							<feFlood
								className="[flood-color:var(--lgm-goo-shadow)]"
								result="tint"
							/>
							<feComposite in="tint" in2="drop" operator="in" result="shadow" />
							<feComposite in="shadow" in2="goo" operator="out" result="cast" />
							<feMerge>
								<feMergeNode in="cast" />
								<feMergeNode in="goo" />
							</feMerge>
						</filter>
					</defs>
					<g className="opacity-(--lgm-goo-alpha)">
						<g filter={`url(#${gooId})`} className="fill-(--lgm-goo-fill)">
							<rect ref={gooTriggerRef} />
							<rect ref={gooPanelRef} />
						</g>
					</g>
				</svg>
			) : null}
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
								in="SourceGraphic"
								in2="map"
								xChannelSelector="R"
								yChannelSelector="G"
							/>
						</filter>
						<filter
							ref={lensFilterRef}
							id={lensFilterId}
							x={0}
							y={0}
							filterUnits="userSpaceOnUse"
							primitiveUnits="userSpaceOnUse"
							colorInterpolationFilters="sRGB"
						>
							<feImage
								ref={lensMapRef}
								x={0}
								y={0}
								preserveAspectRatio="none"
								result="map"
							/>
							<feDisplacementMap
								in="SourceGraphic"
								in2="map"
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
					className={withClasses(
						cn(
							"group/lgm relative flex max-h-(--available-height) min-w-48 flex-col rounded-[24px] text-foreground outline-none",
							mode === "morph" && "origin-center",
							mode === "pop" &&
								"origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0",
							mode === "fade" &&
								"transition-opacity duration-[120ms] ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
							"data-[lgm-phase=pending]:opacity-0",
							// The items' blur, fade, and shrink per phase; see `ITEM_MORPH`.
							"data-[lgm-phase=pending]:[--lgm-fade:0.4] data-[lgm-phase=pending]:[--lgm-filter:blur(6px)] data-[lgm-phase=pending]:[--lgm-shrink:0.96]",
							// Keep in step with ITEM_DELAY_MS, ITEM_SHARPEN_MS, and ITEM_STAGGER_MS.
							"data-[lgm-phase=morph]:[--lgm-delay:40ms] data-[lgm-phase=morph]:[--lgm-duration:180ms] data-[lgm-phase=morph]:[--lgm-filter:blur(0px)] data-[lgm-phase=morph]:[--lgm-stagger:20ms]",
							"data-[lgm-phase=drain]:[--lgm-duration:150ms] data-[lgm-phase=drain]:[--lgm-fade:0.3] data-[lgm-phase=drain]:[--lgm-filter:blur(6px)] data-[lgm-phase=drain]:[--lgm-shrink:0.96]",
						),
						className,
					)}
					{...props}
				>
					{/* The blur stays on while the goo draws the blob, so the blob is glass too. */}
					{support.glass ? (
						<span
							ref={backdropRef}
							aria-hidden
							data-slot="liquid-glass-menu-backdrop"
							className="pointer-events-none absolute inset-0 rounded-[inherit]"
							style={glassStyle}
						/>
					) : null}
					{/* Fill, rim, and shadow. The goo stands in for them during the morph. */}
					<span
						aria-hidden
						data-slot="liquid-glass-menu-surface"
						className={cn(
							"pointer-events-none absolute inset-0 rounded-[inherit]",
							"shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_0_0.5px_rgb(0_0_0/0.07),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.2),0_28px_56px_-24px_rgb(0_0_0/0.16)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_0.5px_rgb(255_255_255/0.1),0_1px_2px_rgb(0_0_0/0.5),0_16px_40px_-8px_rgb(0_0_0/0.7)]",
							support.glass
								? "bg-white/76 dark:bg-[rgb(30_30_34/0.8)]"
								: "bg-popover",
							mode === "morph" &&
								"opacity-0 transition-opacity duration-[140ms] ease-out group-data-lgm-surface/lgm:opacity-100",
						)}
					/>
					<div
						ref={viewportRef}
						data-slot="liquid-glass-menu-viewport"
						className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[inherit]"
						style={{ padding: PANEL_PADDING }}
					>
						{/* The lens: a pill of glass under the highlighted item. All three
						    layers move by top and left, not transform: Chromium reuses the
						    last frame's backdrop for a filter that only moved on the
						    compositor, which smears the refraction mid-slide. */}
						<motion.span
							ref={(element) => {
								lensRefs.current[0] = element;
							}}
							aria-hidden
							data-slot="liquid-glass-menu-lens"
							data-visible="false"
							className={cn(
								"pointer-events-none absolute opacity-0 transition-opacity duration-150 data-[visible=true]:opacity-100 motion-reduce:transition-none",
								// A raised bead of clearer glass: brighter at the top, a crisp
								// rim, a faint inner shade at the bottom, and a soft drop.
								"bg-[linear-gradient(to_bottom,rgb(255_255_255/0.95),rgb(246_246_250/0.7))] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08),inset_0_1px_0_#fff,inset_0_-3px_6px_-3px_rgb(0_0_0/0.07),0_1px_2px_rgb(0_0_0/0.08),0_6px_14px_-4px_rgb(0_0_0/0.18)]",
								"dark:bg-[linear-gradient(to_bottom,rgb(255_255_255/0.16),rgb(255_255_255/0.07))] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.14),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-3px_6px_-3px_rgb(0_0_0/0.3),0_6px_14px_-4px_rgb(0_0_0/0.6)]",
							)}
							style={{
								left: lensX,
								top: lensY,
								width: lensWidth,
								height: lensHeight,
								borderRadius: ITEM_RADIUS,
							}}
						/>
						<div className="relative flex flex-col">{children}</div>
						{/* Over the items, so it magnifies the label and bends it at the rim. */}
						{support.refract ? (
							<motion.span
								ref={(element) => {
									lensRefs.current[1] = element;
								}}
								aria-hidden
								data-slot="liquid-glass-menu-lens-refraction"
								data-visible="false"
								className="pointer-events-none absolute opacity-0 data-[visible=true]:opacity-100"
								style={{
									left: lensX,
									top: lensY,
									width: lensWidth,
									height: lensHeight,
									borderRadius: ITEM_RADIUS,
									backdropFilter: `url(#${lensFilterId})`,
								}}
							/>
						) : null}
						{/* The rim again, crisp over the magnified items. */}
						{support.refract ? (
							<motion.span
								ref={(element) => {
									lensRefs.current[2] = element;
								}}
								aria-hidden
								data-slot="liquid-glass-menu-lens-rim"
								data-visible="false"
								className="pointer-events-none absolute opacity-0 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08),inset_0_1px_0_#fff,inset_0_-3px_6px_-3px_rgb(0_0_0/0.07)] data-[visible=true]:opacity-100 dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.14),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-3px_6px_-3px_rgb(0_0_0/0.3)]"
								style={{
									left: lensX,
									top: lensY,
									width: lensWidth,
									height: lensHeight,
									borderRadius: ITEM_RADIUS,
								}}
							/>
						) : null}
					</div>
				</MenuPrimitive.Popup>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

/**
 * Every row blurs, fades, and shrinks a little while the blob forms, then
 * sharpens 20 ms after the row above it. The values come from the popup's
 * phase; at rest they resolve to no filter at all.
 */
const ITEM_MORPH =
	"[filter:var(--lgm-filter,none)] [opacity:calc(var(--lgm-fade,1)*var(--lgm-dim,1))] [scale:var(--lgm-shrink,1)] [transition-delay:calc(var(--lgm-delay,0ms)+var(--lgm-i,0)*var(--lgm-stagger,0ms))] [transition-duration:var(--lgm-duration,0ms)] [transition-property:filter,opacity,scale] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]";

/** The highlight is the lens plus a brighter label and a larger icon. */
const ITEM_CLASS = cn(
	"group/lgm-item relative flex min-h-11 cursor-default select-none items-center gap-3 px-3 py-1.5 text-[15px] text-foreground/85 outline-none [-webkit-tap-highlight-color:transparent]",
	"data-disabled:pointer-events-none data-highlighted:text-foreground data-disabled:[--lgm-dim:0.45]",
	ITEM_MORPH,
);

const ICON_CLASS =
	"grid shrink-0 place-items-center transition-transform duration-200 ease-out group-data-highlighted/lgm-item:scale-110 motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0";

function ItemShortcut({ children }: { children?: ReactNode }) {
	if (children === undefined || children === null) return null;
	return (
		<span
			data-slot="liquid-glass-menu-shortcut"
			className="ml-auto pl-4 text-foreground/65 text-xs tracking-widest"
		>
			{children}
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
			strokeWidth={1.8}
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
	/** Leading icon, such as a lucide icon or a colored badge. It grows when highlighted. */
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
			<span className="min-w-0 flex-1 truncate">{children}</span>
			<ItemShortcut>{shortcut}</ItemShortcut>
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
			<span className={cn(ICON_CLASS, "size-4")}>
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			<ItemShortcut>{shortcut}</ItemShortcut>
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
			<span className={cn(ICON_CLASS, "size-4")}>
				<MenuPrimitive.RadioItemIndicator>
					<span className="block size-2 rounded-full bg-current" />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			<ItemShortcut>{shortcut}</ItemShortcut>
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
				cn("px-3 pt-2 pb-1 font-medium text-foreground/65 text-xs", ITEM_MORPH),
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
				cn("mx-3 my-1 h-px shrink-0 bg-foreground/10", ITEM_MORPH),
				className,
			)}
			{...props}
		/>
	);
}

export default LiquidGlassMenu;
