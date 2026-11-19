"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { XIcon } from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	createContext,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	type Ref,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Motion. The whole morph is one progress value, 0 at the trigger and 1 at the
// dialog, plus a drag offset. Every frame is painted from those numbers.
const openSpring = { type: "spring", stiffness: 320, damping: 34 } as const;
const closeSpring = { type: "spring", duration: 0.34, bounce: 0 } as const;
const returnSpring = { type: "spring", stiffness: 420, damping: 36 } as const;
/** Reduced motion opens and closes with this cross-fade, in seconds. */
const REDUCED_FADE = 0.15;
/** Progress over which the trigger's snapshot fades out. */
const GHOST_FADE = 0.4;
/**
 * Progress over which travelling text takes over from the snapshot's copy. The
 * snapshot's copy starts fading a little later, so the hand-off never dips.
 */
const TEXT_IN = 0.12;
const TEXT_OUT_FROM = 0.04;
const TEXT_OUT_TO = 0.16;
/** Progress over which the body and close button fade in. */
const REVEAL_FROM = 0.35;
const REVEAL_TO = 0.85;

// Layout.
/** Gap kept between the dialog and the viewport edges, in px. */
const VIEWPORT_MARGIN = 16;

// Drag to rewind.
/** Pointer travel, in px, before a press becomes a drag. */
const DRAG_SLOP = 4;
/** Share of the morph a long pull rewinds. */
const MAX_REWIND = 0.55;
/** Pull distance, in px, that rewinds about 63% of `MAX_REWIND`. */
const REWIND_RANGE = 240;
/** Pull distance, in px, past which a release closes the dialog. */
const DISMISS_DISTANCE = 90;
/** Release speed away from the grab point, in px/s, that closes from anywhere. */
const DISMISS_VELOCITY = 650;
/** Ms of pointer samples used for the release speed. */
const VELOCITY_WINDOW = 100;

/** A soft breath of air as the card lifts into a dialog. */
const LIFT_SOUND = {
	name: "morph-dialog-lift",
	baseFreq: 420,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 850,
	filterQ: 0.7,
	attack: 0.004,
	decay: 1.3,
	brightness: 1900,
} as const;
/** A muted tap as the dialog settles back into its card. */
const SETTLE_SOUND = {
	name: "morph-dialog-settle",
	baseFreq: 420,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 1400,
	filterQ: 1.2,
	attack: 0.002,
	decay: 0.8,
	brightness: 1900,
} as const;

const INTERACTIVE =
	"a, button, input, select, textarea, label, [contenteditable]";
const FOCUSABLE =
	"a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']), [contenteditable='true']";

type Phase = "closed" | "opening" | "open" | "closing";
type Placement = "center" | "anchor";
type Box = { x: number; y: number; w: number; h: number };
type Cue = { sound: boolean; pointer: boolean };
type MorphState = { p: number; ox: number; oy: number; scroll: number };
type SpringOptions = {
	type: "spring";
	stiffness?: number;
	damping?: number;
	duration?: number;
	bounce?: number;
};

/** One shared part: where it sits in the trigger and in the dialog. */
type Part = {
	el: HTMLElement;
	kind: "media" | "text";
	/** The media's image frame, which is resized rather than scaled. */
	frame: HTMLElement | null;
	/** Box in the trigger, relative to the trigger. Null when unmatched. */
	from: Box | null;
	/** Box in the dialog, relative to its scroll content. */
	to: Box;
	/** Text: the trigger's font size over the dialog's. */
	scale: number;
	/** Text: first-line baseline below the box top, in the trigger and dialog. */
	b0: number;
	b1: number;
	/** Media: corner radius in the trigger and in the dialog. */
	r0: number;
	r1: number;
	/** The same part inside the trigger's snapshot. */
	ghost: HTMLElement | null;
};

type Geometry = {
	trigger: Box;
	dialog: Box;
	r0: number;
	r1: number;
	parts: Part[];
};

type Drag = {
	id: number;
	startX: number;
	startY: number;
	started: boolean;
	/** Where the press landed in the surface, as a share of its size. */
	u: number;
	v: number;
	from: MorphState;
	past: boolean;
	samples: { t: number; x: number; y: number }[];
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));
function smoothstep(from: number, to: number, value: number) {
	const t = clamp((value - from) / (to - from), 0, 1);
	return t * t * (3 - 2 * t);
}

function boxOf(element: Element): Box {
	const rect = element.getBoundingClientRect();
	return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

/** The element's top-left corner radius, capped to what its box can show. */
function radiusOf(element: Element, w: number, h: number) {
	const radius =
		Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
	return Math.min(radius, w / 2, h / 2);
}

/** Distance from the element's top to its first line's baseline. */
function baselineOf(element: HTMLElement) {
	const probe = document.createElement("span");
	probe.style.cssText =
		"display:inline-block;width:0;height:0;vertical-align:baseline";
	element.insertBefore(probe, element.firstChild);
	const offset =
		probe.getBoundingClientRect().top - element.getBoundingClientRect().top;
	probe.remove();
	return offset;
}

/** Final dialog box for a placement, kept inside the viewport margins. */
function place(placement: Placement, trigger: Box, w: number, h: number) {
	const vw = document.documentElement.clientWidth;
	const vh = window.innerHeight;
	const fit = (value: number, size: number, viewport: number) =>
		viewport - 2 * VIEWPORT_MARGIN < size
			? (viewport - size) / 2
			: clamp(value, VIEWPORT_MARGIN, viewport - VIEWPORT_MARGIN - size);
	if (placement === "center" || trigger.w === 0) {
		return {
			x: Math.round((vw - w) / 2),
			y: Math.round((vh - h) / 2),
			w,
			h,
		};
	}
	// Grow from the trigger's corner nearest the middle of the screen.
	const x =
		trigger.x + trigger.w / 2 > vw / 2 ? trigger.x + trigger.w - w : trigger.x;
	const y =
		trigger.y + trigger.h / 2 > vh / 2 ? trigger.y + trigger.h - h : trigger.y;
	return {
		x: Math.round(fit(x, w, vw)),
		y: Math.round(fit(y, h, vh)),
		w,
		h,
	};
}

/** Px/s of the latest samples, along the direction of the pull. */
function releaseSpeed(drag: Drag) {
	const last = drag.samples[drag.samples.length - 1];
	if (!last) return 0;
	const first =
		drag.samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW) ?? last;
	const elapsed = last.t - first.t;
	if (elapsed <= 0) return 0;
	const dx = last.x - drag.startX;
	const dy = last.y - drag.startY;
	const length = Math.hypot(dx, dy) || 1;
	const vx = ((last.x - first.x) / elapsed) * 1000;
	const vy = ((last.y - first.y) / elapsed) * 1000;
	return (vx * dx + vy * dy) / length;
}

/** Locks page scroll, keeping the scrollbar's gutter so nothing shifts. */
function lockScroll() {
	const root = document.documentElement;
	const { overflow, scrollbarGutter } = root.style;
	const gutter = window.innerWidth - root.clientWidth;
	if (gutter > 0 && getComputedStyle(root).scrollbarGutter === "auto") {
		root.style.scrollbarGutter = "stable";
	}
	root.style.overflow = "hidden";
	return () => {
		root.style.overflow = overflow;
		root.style.scrollbarGutter = scrollbarGutter;
	};
}

/** Makes everything but `keep` inert, so focus and clicks stay in the dialog. */
function inertOthers(keep: Element) {
	const changed: Element[] = [];
	for (const element of Array.from(document.body.children)) {
		if (element === keep || element.hasAttribute("inert")) continue;
		if (element.tagName === "SCRIPT" || element.tagName === "STYLE") continue;
		element.setAttribute("inert", "");
		changed.push(element);
	}
	return () => {
		for (const element of changed) element.removeAttribute("inert");
	};
}

function silent() {
	return document.visibilityState === "hidden";
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (typeof ref === "function") ref(value);
	else if (ref) (ref as RefObject<T | null>).current = value;
}

type MorphDialogContextValue = {
	open: boolean;
	present: boolean;
	drag: boolean;
	contentId: string;
	titleId: string;
	subtitleId: string;
	triggerRef: RefObject<HTMLButtonElement | null>;
	overlayRef: RefObject<HTMLDivElement | null>;
	scrimRef: RefObject<HTMLDivElement | null>;
	plateRef: RefObject<HTMLDivElement | null>;
	layerRef: RefObject<HTMLDivElement | null>;
	ghostRef: RefObject<HTMLDivElement | null>;
	requestOpen: (next: boolean, cue: Cue) => void;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	onScrimClick: (event: MouseEvent<HTMLDivElement>) => void;
	onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
};

const MorphDialogContext = createContext<MorphDialogContextValue | null>(null);
/** Whether a part renders inside the trigger or inside the dialog. */
const ScopeContext = createContext<"trigger" | "content" | null>(null);

function useMorphDialog(component: string) {
	const context = useContext(MorphDialogContext);
	if (!context) {
		throw new Error(`<${component}> must be used inside <MorphDialog>.`);
	}
	return context;
}

export interface MorphDialogProps {
	/** Controlled open state. */
	open?: boolean;
	/** Open state on mount, when uncontrolled. Opens without a morph. */
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/**
	 * Where the dialog lands: `"center"` flies to the middle of the viewport,
	 * `"anchor"` grows in place from the trigger's nearest corner.
	 */
	placement?: Placement;
	/** Pull the media, title, or a drag handle to rewind the morph and close. */
	drag?: boolean;
	/** Play a soft sound on open and when the dialog lands back. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	children?: ReactNode;
}

function MorphDialog({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	placement = "center",
	drag = true,
	sound = true,
	haptics = true,
	children,
}: MorphDialogProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const open = openProp ?? uncontrolledOpen;
	const [present, setPresent] = useState(false);
	const [ready, setReady] = useState(false);

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { swoosh: playLift } = useTiks({
		theme: LIFT_SOUND,
		respectReducedMotion: false,
	});
	const { click: playSettle } = useTiks({
		theme: SETTLE_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const contentId = `morph-dialog-${ids}`;
	const titleId = `${contentId}-title`;
	const subtitleId = `${contentId}-subtitle`;

	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const scrimRef = useRef<HTMLDivElement | null>(null);
	const plateRef = useRef<HTMLDivElement | null>(null);
	const layerRef = useRef<HTMLDivElement | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);

	const phaseRef = useRef<Phase>("closed");
	/** True while the dialog sits open with no morph styles applied. */
	const restRef = useRef(false);
	const geometryRef = useRef<Geometry | null>(null);
	const stateRef = useRef<MorphState>({ p: 0, ox: 0, oy: 0, scroll: 0 });
	const scrollWrittenRef = useRef(0);
	const cloneRef = useRef<HTMLElement | null>(null);
	/** Paused blend from the trigger's fill and shadow to the dialog's. */
	const surfaceRef = useRef<Animation | null>(null);
	const animRef = useRef<AnimationPlaybackControls | null>(null);
	const fadeRef = useRef<AnimationPlaybackControls | null>(null);
	const releaseRef = useRef<(() => void) | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const cueRef = useRef<(Cue & { open: boolean }) | null>(null);
	const closeCueRef = useRef<Cue | null>(null);
	const pendingRef = useRef<{ instant: boolean; cue: Cue | null } | null>(null);
	const firstRef = useRef(true);

	// Latest props for the imperative handlers below, so they never re-bind.
	const latest = useRef({
		openProp,
		onOpenChange,
		placement,
		drag,
		sound,
		haptics,
		reducedMotion,
	});
	latest.current = {
		openProp,
		onOpenChange,
		placement,
		drag,
		sound,
		haptics,
		reducedMotion,
	};

	const requestOpen = useCallback((next: boolean, cue: Cue) => {
		cueRef.current = { open: next, ...cue };
		if (latest.current.openProp === undefined) setUncontrolledOpen(next);
		latest.current.onOpenChange?.(next);
	}, []);

	/** The trigger can morph only while it is laid out. */
	const morphable = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger?.isConnected || latest.current.reducedMotion) return false;
		const box = boxOf(trigger);
		return box.w > 0 && box.h > 0;
	}, []);

	const clearPartStyles = useCallback(() => {
		for (const part of geometryRef.current?.parts ?? []) {
			part.el.style.transform = "";
			part.el.style.transformOrigin = "";
			part.el.style.opacity = "";
			if (part.frame) {
				for (const key of [
					"left",
					"top",
					"right",
					"bottom",
					"width",
					"height",
					"borderRadius",
				] as const) {
					part.frame.style[key] = "";
				}
			}
		}
	}, []);

	const removeClone = useCallback(() => {
		cloneRef.current?.remove();
		cloneRef.current = null;
		for (const part of geometryRef.current?.parts ?? []) part.ghost = null;
		surfaceRef.current?.cancel();
		surfaceRef.current = null;
	}, []);

	/**
	 * Measures the trigger, the dialog at its natural size, and every shared
	 * part. Leaves the dialog unstyled; `paint` puts it back.
	 */
	const measure = useCallback(() => {
		const trigger = triggerRef.current;
		const plate = plateRef.current;
		const layer = layerRef.current;
		if (!plate || !layer) return;
		clearPartStyles();
		removeClone();
		const scroll = layer.scrollTop;
		plate.style.transform = "";
		plate.style.width = "";
		plate.style.height = "";
		plate.style.borderRadius = "";
		layer.style.width = "";
		layer.style.height = "";
		layer.style.flex = "";
		layer.style.overflow = "";
		layer.style.scrollbarGutter = "";
		layer.style.paddingRight = "";
		layer.style.paddingBottom = "";

		const plateBox = boxOf(plate);
		// Width a classic scrollbar takes from the content at rest.
		const gutter = layer.offsetWidth - layer.clientWidth;
		const { w, h } = plateBox;
		const triggerBox =
			trigger?.isConnected && trigger.offsetWidth > 0 ? boxOf(trigger) : null;
		const dialog = place(
			latest.current.placement,
			triggerBox ?? { x: 0, y: 0, w: 0, h: 0 },
			w,
			h,
		);
		const r1 = radiusOf(plate, w, h);
		const r0 =
			trigger && triggerBox
				? radiusOf(trigger, triggerBox.w, triggerBox.h)
				: r1;

		const parts: Part[] = [];
		const seen = new Set<string>();
		for (const el of Array.from(
			layer.querySelectorAll<HTMLElement>("[data-morph-part]"),
		)) {
			const key = el.dataset.morphPart ?? "";
			if (seen.has(key)) continue;
			seen.add(key);
			const box = boxOf(el);
			const to = {
				x: box.x - plateBox.x,
				y: box.y - plateBox.y + scroll,
				w: box.w,
				h: box.h,
			};
			const source = trigger?.querySelector<HTMLElement>(
				`[data-morph-part="${key}"]`,
			);
			const kind = key === "media" ? "media" : "text";
			const frame =
				kind === "media"
					? el.querySelector<HTMLElement>("[data-morph-frame]")
					: null;
			let from: Box | null = null;
			let scale = 1;
			let b0 = 0;
			let b1 = 0;
			let r0Part = 0;
			let r1Part = 0;
			if (source && triggerBox) {
				const sourceBox = boxOf(source);
				from = {
					x: sourceBox.x - triggerBox.x,
					y: sourceBox.y - triggerBox.y,
					w: sourceBox.w,
					h: sourceBox.h,
				};
				if (kind === "text") {
					const size = (node: Element) =>
						Number.parseFloat(getComputedStyle(node).fontSize) || 16;
					const lines = (node: Element, height: number) =>
						Math.round(
							height /
								(Number.parseFloat(getComputedStyle(node).lineHeight) ||
									height),
						);
					scale = size(source) / size(el);
					// Glyph advances round differently at the two sizes on some
					// platforms. A single line matches by width, so the two copies
					// cover each other exactly when they hand over.
					const byWidth = from.w / to.w;
					if (
						lines(source, from.h) === 1 &&
						lines(el, to.h) === 1 &&
						Math.abs(byWidth / scale - 1) < 0.15
					) {
						scale = byWidth;
					}
					b0 = baselineOf(source);
					b1 = baselineOf(el);
				} else if (frame) {
					const sourceFrame =
						source.querySelector("[data-morph-frame]") ?? source;
					r0Part = radiusOf(sourceFrame, from.w, from.h);
					r1Part = radiusOf(frame, to.w, to.h);
				}
			}
			parts.push({
				el,
				kind,
				frame,
				from,
				to,
				scale,
				b0,
				b1,
				r0: r0Part,
				r1: r1Part,
				ghost: null,
			});
		}

		geometryRef.current = {
			trigger: triggerBox ?? dialog,
			dialog,
			r0,
			r1,
			parts,
		};
		// The content keeps its final size while the surface around it grows,
		// so nothing inside reflows during the morph. When the trigger is bigger
		// than the dialog, padding stretches the layer over the trigger's box, so
		// the surface, not the layer, clips the travelling parts.
		const padX = triggerBox ? Math.max(0, Math.ceil(triggerBox.w - w)) : 0;
		const padY = triggerBox ? Math.max(0, Math.ceil(triggerBox.h - h)) : 0;
		layer.style.width = `${w + padX}px`;
		layer.style.height = `${h + padY}px`;
		layer.style.paddingRight = `${padX}px`;
		layer.style.paddingBottom = `${padY}px`;
		layer.style.flex = "none";
		// Mid-morph the travelling parts overflow the content. Scrollbars there
		// would narrow and reflow it, so it clips instead, keeping the gutter a
		// scrollbar holds at rest.
		layer.style.overflow = "hidden";
		if (gutter > 0) layer.style.scrollbarGutter = "stable";
		layer.scrollTop = scroll;
		scrollWrittenRef.current = scroll;
	}, [clearPartStyles, removeClone]);

	/** Snapshot of the trigger that fades out inside the growing surface. */
	const ensureClone = useCallback(() => {
		const trigger = triggerRef.current;
		const host = ghostRef.current;
		const geometry = geometryRef.current;
		if (cloneRef.current || !trigger || !host || !geometry) return;
		const clone = trigger.cloneNode(true) as HTMLElement;
		for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
			node.removeAttribute("id");
			node.removeAttribute("data-slot");
		}
		clone.setAttribute("aria-hidden", "true");
		clone.setAttribute("inert", "");
		const computed = getComputedStyle(trigger);
		Object.assign(clone.style, {
			position: "absolute",
			left: "0px",
			top: "0px",
			margin: "0px",
			width: `${geometry.trigger.w}px`,
			height: `${geometry.trigger.h}px`,
			visibility: "visible",
			overflow: "visible",
			pointerEvents: "none",
			transition: "none",
			// The dialog's surface draws the fill, ring, and shadow.
			background: "transparent",
			boxShadow: "none",
			borderColor: "transparent",
			outline: "none",
			color: computed.color,
			font: computed.font,
		});
		for (const part of geometry.parts) {
			if (!part.from) continue;
			const ghost = clone.querySelector<HTMLElement>(
				`[data-morph-part="${part.el.dataset.morphPart}"]`,
			);
			if (!ghost) continue;
			if (part.kind === "media") {
				// The dialog's own image travels; the snapshot's would double it.
				ghost.style.visibility = "hidden";
			} else {
				ghost.style.transformOrigin = "0 0";
				part.ghost = ghost;
			}
		}
		host.appendChild(clone);
		cloneRef.current = clone;
		// The surface wears the trigger's fill and shadow at p = 0 and its own at
		// p = 1. A paused animation interpolates the shadow lists; `paint` scrubs it.
		const plate = plateRef.current;
		if (plate) {
			const own = getComputedStyle(plate);
			const surface = plate.animate(
				[
					{
						backgroundColor: computed.backgroundColor,
						boxShadow: computed.boxShadow,
					},
					{ backgroundColor: own.backgroundColor, boxShadow: own.boxShadow },
				],
				{ duration: 1000, fill: "both" },
			);
			surface.pause();
			surface.currentTime = clamp(stateRef.current.p, 0, 1) * 1000;
			surfaceRef.current = surface;
		}
	}, []);

	/** Draws the morph at progress `p`, offset by a drag. */
	const paint = useCallback(
		(p: number, ox: number, oy: number, scroll: number) => {
			const geometry = geometryRef.current;
			const plate = plateRef.current;
			const layer = layerRef.current;
			if (!geometry || !plate || !layer) return;
			stateRef.current = { p, ox, oy, scroll };
			const { trigger, dialog } = geometry;
			const x = mix(trigger.x, dialog.x, p) + ox;
			const y = mix(trigger.y, dialog.y, p) + oy;
			const w = Math.max(1, mix(trigger.w, dialog.w, p));
			const h = Math.max(1, mix(trigger.h, dialog.h, p));
			plate.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			plate.style.width = `${w}px`;
			plate.style.height = `${h}px`;
			plate.style.borderRadius = `${Math.max(0, mix(geometry.r0, geometry.r1, p))}px`;
			plate.style.setProperty(
				"--morph-reveal",
				String(smoothstep(REVEAL_FROM, REVEAL_TO, p)),
			);
			if (scrimRef.current) {
				scrimRef.current.style.opacity = String(clamp(p, 0, 1));
			}
			if (surfaceRef.current) {
				surfaceRef.current.currentTime = clamp(p, 0, 1) * 1000;
			}
			if (scroll !== scrollWrittenRef.current) {
				layer.scrollTop = scroll;
				scrollWrittenRef.current = scroll;
			}

			if (p < 1 - 1e-3 && geometry.trigger !== geometry.dialog) ensureClone();
			const ghostOpacity = 1 - smoothstep(0, GHOST_FADE, p);
			if (cloneRef.current) {
				cloneRef.current.style.opacity = String(ghostOpacity);
			}

			// The body rides along under the lowest shared part, so it never
			// slides under a title that is still on its way down.
			let lowest = Number.NEGATIVE_INFINITY;
			let shift = 0;
			for (const part of geometry.parts) {
				const { from, to } = part;
				// Text starts where its first baseline meets the trigger copy's, so
				// the two copies overlap exactly while they hand over.
				const fromY = from ? from.y + part.b0 - part.b1 * part.scale : 0;
				if (from && to.y + to.h > lowest) {
					lowest = to.y + to.h;
					const top = mix(fromY, to.y - scroll, p);
					const height =
						part.kind === "media"
							? mix(from.h, to.h, p)
							: to.h * mix(part.scale, 1, p);
					shift = top + height - (to.y - scroll + to.h);
				}
				if (!from) {
					// No counterpart in the trigger: fades in with the body.
					part.el.style.opacity = "var(--morph-reveal)";
					continue;
				}
				const toY = to.y - scroll;
				const dx = (1 - p) * (from.x - to.x);
				const dy = (1 - p) * (fromY - toY);
				if (part.kind === "media" && part.frame) {
					// The frame itself resizes, so the image uncrops instead of
					// stretching.
					const frame = part.frame.style;
					frame.right = "auto";
					frame.bottom = "auto";
					frame.left = `${dx}px`;
					frame.top = `${dy}px`;
					frame.width = `${mix(from.w, to.w, p)}px`;
					frame.height = `${mix(from.h, to.h, p)}px`;
					frame.borderRadius = `${Math.max(0, mix(part.r0, part.r1, p))}px`;
					continue;
				}
				// Text travels with a uniform scale over the snapshot's copy, which
				// keeps its baseline on the same path and hands over early. The two
				// overlap only briefly, so slightly different glyph hinting at the
				// two font sizes never reads as a doubled edge.
				const scale = mix(part.scale, 1, p);
				part.el.style.transformOrigin = "0 0";
				part.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
				part.el.style.opacity = cloneRef.current
					? String(smoothstep(0, TEXT_IN, p))
					: "";
				if (part.ghost) {
					const top = toY + dy + scale * (part.b1 - part.b0 / part.scale);
					part.ghost.style.transform = `translate3d(${p * (to.x - from.x)}px, ${top - from.y}px, 0) scale(${scale / part.scale})`;
					part.ghost.style.opacity = String(
						1 - smoothstep(TEXT_OUT_FROM, TEXT_OUT_TO, p),
					);
				}
			}
			plate.style.setProperty("--morph-shift-y", `${shift}px`);
		},
		[ensureClone],
	);

	/** Re-measures and redraws the current frame, e.g. after a resize. */
	const remeasure = useCallback(() => {
		const layer = layerRef.current;
		if (!layer) return;
		const scroll = restRef.current ? layer.scrollTop : stateRef.current.scroll;
		measure();
		const { p, ox, oy } = stateRef.current;
		paint(p, ox, oy, scroll);
	}, [measure, paint]);

	const settleOpen = useCallback(() => {
		phaseRef.current = "open";
		animRef.current = null;
		plateRef.current?.style.setProperty("--morph-shift-y", "0px");
		plateRef.current?.style.setProperty("--morph-reveal", "1");
		removeClone();
		clearPartStyles();
		// At rest the surface takes its natural size again, so content that
		// changes while open (say, a form error) reflows as usual.
		const plate = plateRef.current;
		if (plate) {
			plate.style.width = "";
			plate.style.height = "";
		}
		const layer = layerRef.current;
		if (layer) {
			const scroll = layer.scrollTop;
			for (const key of [
				"width",
				"height",
				"flex",
				"overflow",
				"scrollbarGutter",
				"paddingRight",
				"paddingBottom",
			] as const) {
				layer.style[key] = "";
			}
			layer.scrollTop = scroll;
			scrollWrittenRef.current = scroll;
		}
		restRef.current = true;
	}, [clearPartStyles, removeClone]);

	const finishClose = useCallback(() => {
		phaseRef.current = "closed";
		restRef.current = false;
		animRef.current?.stop();
		fadeRef.current?.stop();
		animRef.current = null;
		fadeRef.current = null;
		dragRef.current = null;
		removeClone();
		geometryRef.current = null;
		releaseRef.current?.();
		releaseRef.current = null;
		const cue = closeCueRef.current;
		closeCueRef.current = null;
		flushSync(() => setPresent(false));
		const trigger = triggerRef.current;
		if (trigger?.isConnected) {
			// After a pointer close the trigger takes focus back without a ring.
			if (cue?.pointer) trigger.setAttribute("data-pointer-return", "");
			trigger.focus({ preventScroll: true });
		}
		if (cue?.sound && latest.current.sound && !silent()) playSettle();
	}, [playSettle, removeClone]);

	/** Springs the morph from where it is now to the dialog (1) or trigger (0). */
	const run = useCallback(
		(to: 0 | 1, transition: SpringOptions) => {
			animRef.current?.stop();
			const from = { ...stateRef.current };
			animRef.current = animate(0, 1, {
				...transition,
				onUpdate: (q) =>
					paint(
						mix(from.p, to, q),
						from.ox * (1 - q),
						from.oy * (1 - q),
						to === 0 ? Math.max(0, from.scroll * (1 - q)) : from.scroll,
					),
				onComplete: () => (to === 1 ? settleOpen() : finishClose()),
			});
		},
		[finishClose, paint, settleOpen],
	);

	/** Reduced motion and missing triggers fade the whole overlay instead. */
	const fade = useCallback(
		(to: 0 | 1) => {
			const overlay = overlayRef.current;
			if (!overlay) return;
			fadeRef.current?.stop();
			const from = Number(overlay.style.opacity || (to === 1 ? 0 : 1));
			fadeRef.current = animate(from, to, {
				type: "tween",
				duration: REDUCED_FADE * Math.abs(to - from),
				ease: "easeOut",
				onUpdate: (value) => {
					overlay.style.opacity = String(value);
				},
				onComplete: () => {
					fadeRef.current = null;
					if (to === 1) settleOpen();
					else finishClose();
				},
			});
		},
		[finishClose, settleOpen],
	);

	const beginOpen = useCallback(
		(instant: boolean, cue: Cue | null) => {
			const overlay = overlayRef.current;
			const plate = plateRef.current;
			if (!overlay || !plate) return;
			phaseRef.current = "opening";
			restRef.current = false;
			const unlock = lockScroll();
			const restoreInert = inertOthers(overlay);
			const onResize = () => {
				if (phaseRef.current !== "closed") remeasure();
			};
			window.addEventListener("resize", onResize);
			releaseRef.current = () => {
				window.removeEventListener("resize", onResize);
				restoreInert();
				unlock();
			};
			measure();
			const layer = layerRef.current;
			if (layer) layer.scrollTop = 0;
			scrollWrittenRef.current = 0;
			if (plate.getAttribute("aria-label") === null) {
				if (plate.querySelector(`#${CSS.escape(titleId)}`)) {
					plate.setAttribute("aria-labelledby", titleId);
				}
			}
			if (plate.querySelector(`#${CSS.escape(subtitleId)}`)) {
				plate.setAttribute("aria-describedby", subtitleId);
			}
			plate.focus({ preventScroll: true });
			if (cue?.sound && latest.current.sound && !silent()) playLift();

			if (instant) {
				paint(1, 0, 0, 0);
				settleOpen();
			} else if (!morphable()) {
				paint(1, 0, 0, 0);
				overlay.style.opacity = "0";
				fade(1);
			} else {
				paint(0, 0, 0, 0);
				run(1, openSpring);
			}
		},
		[
			fade,
			measure,
			morphable,
			paint,
			playLift,
			remeasure,
			run,
			settleOpen,
			subtitleId,
			titleId,
		],
	);

	const beginClose = useCallback(
		(cue: Cue | null) => {
			closeCueRef.current = cue;
			dragRef.current = null;
			const wasResting = restRef.current;
			phaseRef.current = "closing";
			restRef.current = false;
			if (!morphable() || fadeRef.current) {
				animRef.current?.stop();
				fade(0);
				return;
			}
			if (wasResting) remeasure();
			run(0, closeSpring);
		},
		[fade, morphable, remeasure, run],
	);

	useEffect(() => {
		setReady(true);
	}, []);

	// Open state → phases. Opening mounts the overlay first; the morph starts
	// in the layout effect below, once its elements exist.
	useLayoutEffect(() => {
		if (!ready) return;
		const instant = firstRef.current;
		firstRef.current = false;
		const pendingCue = cueRef.current;
		cueRef.current = null;
		const cue =
			pendingCue && pendingCue.open === open
				? { sound: pendingCue.sound, pointer: pendingCue.pointer }
				: null;
		const phase = phaseRef.current;
		if (open) {
			if (phase === "closed") {
				pendingRef.current = { instant, cue };
				setPresent(true);
			} else if (phase === "closing") {
				phaseRef.current = "opening";
				closeCueRef.current = null;
				if (fadeRef.current) fade(1);
				else run(1, openSpring);
			}
		} else if (phase === "opening" || phase === "open") {
			beginClose(cue);
		} else if (pendingRef.current) {
			pendingRef.current = null;
			setPresent(false);
		}
	}, [open, ready, beginClose, fade, run]);

	useLayoutEffect(() => {
		if (!present || !pendingRef.current) return;
		const { instant, cue } = pendingRef.current;
		pendingRef.current = null;
		beginOpen(instant, cue);
	}, [present, beginOpen]);

	useEffect(
		() => () => {
			animRef.current?.stop();
			fadeRef.current?.stop();
			releaseRef.current?.();
			releaseRef.current = null;
		},
		[],
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				if (phaseRef.current !== "closing") {
					requestOpen(false, { sound: true, pointer: false });
				}
				return;
			}
			if (event.key !== "Tab") return;
			// Keep focus inside the dialog.
			const plate = plateRef.current;
			if (!plate) return;
			const focusable = Array.from(
				plate.querySelectorAll<HTMLElement>(FOCUSABLE),
			).filter(
				(element) => element.tabIndex >= 0 && !element.closest("[inert]"),
			);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first || !last) {
				event.preventDefault();
				return;
			}
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === plate)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[requestOpen],
	);

	const onScrimClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (event.target !== event.currentTarget) return;
			if (phaseRef.current === "closing") return;
			requestOpen(false, { sound: true, pointer: event.detail > 0 });
		},
		[requestOpen],
	);

	const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
		const phase = phaseRef.current;
		if (!latest.current.drag || (phase !== "open" && phase !== "opening")) {
			return;
		}
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const target = event.target as Element;
		const plate = event.currentTarget;
		const zone = target.closest("[data-morph-drag]");
		if (!zone || !plate.contains(zone)) return;
		const interactive = target.closest(INTERACTIVE);
		if (interactive && plate.contains(interactive)) return;
		dragRef.current = {
			id: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			started: false,
			u: 0,
			v: 0,
			from: { ...stateRef.current },
			past: false,
			samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
		};
	}, []);

	const onPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.id !== event.pointerId) return;
			const dx = event.clientX - drag.startX;
			const dy = event.clientY - drag.startY;
			if (!drag.started) {
				if (Math.hypot(dx, dy) < DRAG_SLOP) return;
				drag.started = true;
				animRef.current?.stop();
				animRef.current = null;
				if (restRef.current) {
					restRef.current = false;
					remeasure();
				}
				const geometry = geometryRef.current;
				if (!geometry) {
					dragRef.current = null;
					return;
				}
				drag.from = { ...stateRef.current };
				const { p, ox, oy } = drag.from;
				const w = mix(geometry.trigger.w, geometry.dialog.w, p);
				const h = mix(geometry.trigger.h, geometry.dialog.h, p);
				const x = mix(geometry.trigger.x, geometry.dialog.x, p) + ox;
				const y = mix(geometry.trigger.y, geometry.dialog.y, p) + oy;
				drag.u = (drag.startX - x) / w;
				drag.v = (drag.startY - y) / h;
				event.currentTarget.setPointerCapture(event.pointerId);
				window.getSelection()?.removeAllRanges();
			}
			event.preventDefault();
			drag.samples.push({
				t: event.timeStamp,
				x: event.clientX,
				y: event.clientY,
			});
			if (drag.samples.length > 12) drag.samples.shift();

			const geometry = geometryRef.current;
			if (!geometry) return;
			const distance = Math.hypot(dx, dy);
			// The pull rewinds the morph toward the trigger, easing off so it
			// never fully collapses under the pointer.
			const rewind = latest.current.reducedMotion
				? 0
				: MAX_REWIND * (1 - Math.exp(-distance / REWIND_RANGE));
			const p = Math.max(0, drag.from.p - rewind);
			// Keep the grabbed point under the pointer as the surface shrinks.
			const w = mix(geometry.trigger.w, geometry.dialog.w, p);
			const h = mix(geometry.trigger.h, geometry.dialog.h, p);
			const ox =
				event.clientX -
				mix(geometry.trigger.x, geometry.dialog.x, p) -
				drag.u * w;
			const oy =
				event.clientY -
				mix(geometry.trigger.y, geometry.dialog.y, p) -
				drag.v * h;
			paint(p, ox, oy, drag.from.scroll);

			const past = distance > DISMISS_DISTANCE;
			if (past !== drag.past) {
				drag.past = past;
				if (past && latest.current.haptics && !silent()) void haptic("light");
			}
		},
		[haptic, paint, remeasure],
	);

	const onPointerUp = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.id !== event.pointerId) return;
			dragRef.current = null;
			if (!drag.started) return;
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			const cancelled = event.type === "pointercancel";
			const close =
				!cancelled && (drag.past || releaseSpeed(drag) > DISMISS_VELOCITY);
			if (close) {
				requestOpen(false, { sound: true, pointer: true });
				// A controlled parent may keep it open: then spring back.
				requestAnimationFrame(() => {
					if (phaseRef.current !== "closing" && phaseRef.current !== "closed") {
						run(1, returnSpring);
					}
				});
				return;
			}
			run(1, returnSpring);
		},
		[requestOpen, run],
	);

	const value = useMemo<MorphDialogContextValue>(
		() => ({
			open,
			present: present && ready,
			drag,
			contentId,
			titleId,
			subtitleId,
			triggerRef,
			overlayRef,
			scrimRef,
			plateRef,
			layerRef,
			ghostRef,
			requestOpen,
			onKeyDown,
			onScrimClick,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		}),
		[
			open,
			present,
			ready,
			drag,
			contentId,
			titleId,
			subtitleId,
			requestOpen,
			onKeyDown,
			onScrimClick,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		],
	);

	return (
		<MorphDialogContext.Provider value={value}>
			{children}
		</MorphDialogContext.Provider>
	);
}

export type MorphDialogTriggerProps = ComponentProps<"button">;

/** The card or button the dialog grows out of. It hides while the dialog is open. */
function MorphDialogTrigger({
	ref,
	className,
	onClick,
	onKeyDown,
	onBlur,
	children,
	...props
}: MorphDialogTriggerProps) {
	const context = useMorphDialog("MorphDialogTrigger");
	return (
		<ScopeContext.Provider value="trigger">
			<button
				ref={(node) => {
					context.triggerRef.current = node;
					setRef(ref, node);
				}}
				type="button"
				aria-haspopup="dialog"
				aria-expanded={context.open}
				aria-controls={context.present ? context.contentId : undefined}
				data-slot="morph-dialog-trigger"
				data-state={context.open ? "open" : "closed"}
				data-hidden={context.present ? "" : undefined}
				className={cn(
					"relative cursor-pointer text-left outline-none focus-visible:not-data-[pointer-return]:ring-2 focus-visible:not-data-[pointer-return]:ring-ring focus-visible:not-data-[pointer-return]:ring-offset-2 focus-visible:not-data-[pointer-return]:ring-offset-background data-hidden:invisible",
					className,
				)}
				onClick={(event) => {
					onClick?.(event);
					if (event.defaultPrevented) return;
					event.currentTarget.removeAttribute("data-pointer-return");
					context.requestOpen(true, {
						sound: true,
						pointer: event.detail > 0,
					});
				}}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					event.currentTarget.removeAttribute("data-pointer-return");
				}}
				onBlur={(event) => {
					onBlur?.(event);
					event.currentTarget.removeAttribute("data-pointer-return");
				}}
				{...props}
			>
				{children}
			</button>
		</ScopeContext.Provider>
	);
}

export type MorphDialogContentProps = ComponentProps<"div">;

/**
 * The dialog surface, portaled to the body. `className` styles the surface:
 * width, corner radius, background.
 */
function MorphDialogContent({
	ref,
	className,
	children,
	...props
}: MorphDialogContentProps) {
	const context = useMorphDialog("MorphDialogContent");
	if (!context.present) return null;
	return createPortal(
		<div
			ref={context.overlayRef}
			data-slot="morph-dialog-overlay"
			className="fixed inset-0 z-50"
			onKeyDown={context.onKeyDown}
		>
			<div
				ref={context.scrimRef}
				data-slot="morph-dialog-scrim"
				aria-hidden
				className="absolute inset-0 bg-black/25 dark:bg-black/60"
				style={{ opacity: 0 }}
				onClick={context.onScrimClick}
			/>
			<div
				ref={(node) => {
					context.plateRef.current = node;
					setRef(ref, node);
				}}
				id={context.contentId}
				role="dialog"
				aria-modal="true"
				tabIndex={-1}
				data-slot="morph-dialog-content"
				className={cn(
					"fixed top-0 left-0 flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),26rem)] flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-2xl shadow-black/20 outline-none ring-1 ring-foreground/10 dark:ring-white/10",
					className,
				)}
				onPointerDown={context.onPointerDown}
				onPointerMove={context.onPointerMove}
				onPointerUp={context.onPointerUp}
				onPointerCancel={context.onPointerUp}
				{...props}
			>
				{/* The trigger's snapshot goes here, under the content. */}
				<div
					ref={context.ghostRef}
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10"
				/>
				<div
					ref={context.layerRef}
					data-slot="morph-dialog-body"
					className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
				>
					<ScopeContext.Provider value="content">
						{children}
					</ScopeContext.Provider>
				</div>
			</div>
		</div>,
		document.body,
	);
}

export interface MorphDialogMediaProps
	extends Omit<ComponentProps<"img">, "className"> {
	src: string;
	/** Required: describe the image. */
	alt: string;
	/** Size and corner radius of the image's box. */
	className?: string;
}

/**
 * A shared image. Between the trigger and the dialog its frame resizes, so the
 * crop opens up instead of the picture stretching. Also a drag handle.
 */
function MorphDialogMedia({
	src,
	alt,
	className,
	...props
}: MorphDialogMediaProps) {
	const context = useMorphDialog("MorphDialogMedia");
	const scope = useContext(ScopeContext);
	const inContent = scope === "content";
	const Tag = inContent ? "div" : "span";
	return (
		<Tag
			data-slot="morph-dialog-media"
			data-morph-part="media"
			data-morph-drag={inContent && context.drag ? "" : undefined}
			className={cn(
				"relative block shrink-0",
				inContent &&
					context.drag &&
					"cursor-grab touch-none select-none active:cursor-grabbing",
				className,
			)}
		>
			<span
				data-morph-frame=""
				className="absolute inset-0 block overflow-hidden rounded-[inherit] bg-muted"
			>
				{/* biome-ignore lint/performance/noImgElement: plain image so the registry item works outside Next.js */}
				<img
					src={src}
					alt={alt}
					draggable={false}
					decoding="async"
					className="block size-full object-cover"
					{...props}
				/>
			</span>
		</Tag>
	);
}

export type MorphDialogTitleProps = ComponentProps<"h2">;

/** A shared title: a span in the trigger, the dialog's `h2` and label inside. */
function MorphDialogTitle({ className, ...props }: MorphDialogTitleProps) {
	const context = useMorphDialog("MorphDialogTitle");
	const inContent = useContext(ScopeContext) === "content";
	if (!inContent) {
		return (
			<span
				data-slot="morph-dialog-title"
				data-morph-part="title"
				className={cn("block w-fit max-w-full font-semibold", className)}
				{...(props as ComponentProps<"span">)}
			/>
		);
	}
	return (
		<h2
			id={context.titleId}
			data-slot="morph-dialog-title"
			data-morph-part="title"
			data-morph-drag={context.drag ? "" : undefined}
			className={cn(
				"w-fit max-w-full font-semibold text-xl",
				context.drag &&
					"cursor-grab touch-none select-none active:cursor-grabbing",
				className,
			)}
			{...props}
		/>
	);
}

export type MorphDialogSubtitleProps = ComponentProps<"p">;

/** A shared subtitle: describes the dialog when present. */
function MorphDialogSubtitle({
	className,
	...props
}: MorphDialogSubtitleProps) {
	const context = useMorphDialog("MorphDialogSubtitle");
	const inContent = useContext(ScopeContext) === "content";
	if (!inContent) {
		return (
			<span
				data-slot="morph-dialog-subtitle"
				data-morph-part="subtitle"
				className={cn(
					"block w-fit max-w-full text-muted-foreground",
					className,
				)}
				{...(props as ComponentProps<"span">)}
			/>
		);
	}
	return (
		<p
			id={context.subtitleId}
			data-slot="morph-dialog-subtitle"
			data-morph-part="subtitle"
			data-morph-drag={context.drag ? "" : undefined}
			className={cn(
				"w-fit max-w-full text-muted-foreground",
				context.drag &&
					"cursor-grab touch-none select-none active:cursor-grabbing",
				className,
			)}
			{...props}
		/>
	);
}

export type MorphDialogDescriptionProps = ComponentProps<"div">;

/** The dialog's body. It fades and rises in as the surface lands. */
function MorphDialogDescription({
	className,
	style,
	...props
}: MorphDialogDescriptionProps) {
	return (
		<div
			data-slot="morph-dialog-description"
			className={className}
			style={{
				opacity: "var(--morph-reveal, 1)",
				translate:
					"0 calc(var(--morph-shift-y, 0px) + (1 - var(--morph-reveal, 1)) * 10px)",
				...style,
			}}
			{...props}
		/>
	);
}

export type MorphDialogCloseProps = ComponentProps<"button">;

/** Close button pinned to the surface's top-right corner; it rides the corner. */
function MorphDialogClose({
	className,
	onClick,
	children,
	style,
	...props
}: MorphDialogCloseProps) {
	const context = useMorphDialog("MorphDialogClose");
	return (
		<button
			type="button"
			aria-label="Close"
			data-slot="morph-dialog-close"
			className={cn(
				"absolute top-3 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-background/75 text-foreground shadow-sm outline-none ring-1 ring-foreground/10 backdrop-blur-md transition-[background-color,scale] duration-150 hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-ring active:scale-95 [&_svg]:size-4",
				className,
			)}
			style={{ opacity: "var(--morph-reveal, 1)", ...style }}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				context.requestOpen(false, { sound: true, pointer: event.detail > 0 });
			}}
			{...props}
		>
			{children ?? <XIcon aria-hidden />}
		</button>
	);
}

export type MorphDialogDragProps = ComponentProps<"div">;

/** A grabber to pull from, for dialogs without media. */
function MorphDialogDrag({ className, ...props }: MorphDialogDragProps) {
	const context = useMorphDialog("MorphDialogDrag");
	if (!context.drag) return null;
	return (
		<div
			aria-hidden
			data-slot="morph-dialog-drag"
			data-morph-drag=""
			className={cn(
				"flex h-5 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing",
				className,
			)}
			{...props}
		>
			<span className="h-1 w-9 rounded-full bg-foreground/15" />
		</div>
	);
}

export {
	MorphDialog,
	MorphDialogClose,
	MorphDialogContent,
	MorphDialogDescription,
	MorphDialogDrag,
	MorphDialogMedia,
	MorphDialogSubtitle,
	MorphDialogTitle,
	MorphDialogTrigger,
};

export default MorphDialog;
