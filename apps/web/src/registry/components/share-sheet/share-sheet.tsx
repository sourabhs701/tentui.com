"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { CheckIcon, CopyIcon, Link2Icon, XIcon } from "lucide-react";
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type ButtonHTMLAttributes,
	type ComponentProps,
	createContext,
	type HTMLAttributes,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Critically damped spring for desktop popover elevation (no overshoot). */
const POPOVER_ENTER_SPRING = {
	type: "spring",
	stiffness: 460,
	damping: 36,
	mass: 0.85,
} as const;

/** Critically damped spring for compact floating bottom sheet entrance. */
const SHEET_ENTER_SPRING = {
	type: "spring",
	stiffness: 420,
	damping: 38,
	mass: 0.9,
} as const;

/** Snappy asymmetric exit curve (strong ease-out). */
const EXIT_TRANSITION = {
	type: "tween",
	duration: 0.14,
	ease: [0.23, 1, 0.32, 1],
} as const;

/** Reduced-motion cross-fade duration in seconds. */
const REDUCED_TRANSITION = {
	type: "tween",
	duration: 0.12,
	ease: "easeOut",
} as const;

/** Viewport breakpoint in px below which `placement="auto"` switches to sheet. */
const MOBILE_BREAKPOINT = 640;
/** Container width in px below which `placement="auto"` switches to sheet. */
const COMPACT_CONTAINER_WIDTH = 360;
/** Downward drag distance in px that dismisses the mobile sheet. */
const DISMISS_DISTANCE = 68;
/** Downward release velocity in px/s that flick-dismisses the mobile sheet. */
const DISMISS_VELOCITY = 550;
/** Pointer travel in px before a touch press commits to a vertical drag. */
const DRAG_SLOP = 5;
/** Velocity sample lookback window in ms. */
const VELOCITY_WINDOW_MS = 100;
/** Elements inside the sheet that should not start a vertical sheet drag. */
const NO_DRAG_SELECTOR =
	"button, a, input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-share-no-drag]";
const FOCUSABLE_SELECTOR =
	"a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']), [contenteditable='true']";

export type ShareSheetPlacement = "auto" | "popover" | "sheet";
export type ShareSheetSide = "top" | "bottom";
export type ShareSheetAlign = "start" | "center" | "end";
export type ShareSheetVariant = "surface" | "glass" | "minimal";

export interface SharePayload {
	/** URL being shared. */
	url?: string;
	/** Title of the resource being shared. */
	title?: string;
	/** Optional share message or description. */
	text?: string;
}

export interface ShareSheetProps {
	/** Controlled open state. */
	open?: boolean;
	/** Initial open state when uncontrolled. */
	defaultOpen?: boolean;
	/** Called when the sheet opens or closes. */
	onOpenChange?: (open: boolean) => void;
	/** URL being shared; used by `ShareSheetLink` and target/action callbacks. */
	url?: string;
	/** Title of the resource being shared. */
	title?: string;
	/** Optional description or share message passed to callbacks. */
	text?: string;
	/**
	 * How the sheet is presented. `"auto"` anchors as a compact popover on
	 * desktop (`>= 640px`) and rises as a compact floating tray on mobile.
	 */
	placement?: ShareSheetPlacement;
	/** Preferred side relative to the trigger in popover mode. */
	side?: ShareSheetSide;
	/** Horizontal alignment relative to the trigger in popover mode. */
	align?: ShareSheetAlign;
	/** Gap in pixels between the trigger and popover. */
	sideOffset?: number;
	/** Minimum margin in pixels from the viewport or container edges. */
	collisionPadding?: number;
	/** Visual surface treatment of the sheet. */
	variant?: ShareSheetVariant;
	/**
	 * Whether backdrop dimming, focus trapping, and outside-click dismissal are
	 * active. Set `false` for non-blocking embedded previews.
	 */
	modal?: boolean;
	/**
	 * Close the sheet automatically after a target or action runs (after a short
	 * confirmation beat).
	 */
	closeOnSelect?: boolean;
	/** Play subtle tactile audio cues on open, copy, and selection. */
	sound?: boolean;
	/** Trigger subtle haptics on supported touch devices. */
	haptics?: boolean;
	children: ReactNode;
}

export interface ShareSheetTriggerProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
}

export interface ShareSheetContentProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	/**
	 * Optional container element to portal and position inside instead of the
	 * viewport. Useful for embedded frames and previews.
	 */
	container?: RefObject<HTMLElement | null>;
	/** Show the subtle drag handle pill when rendered in compact sheet mode. */
	showHandle?: boolean;
	/** Allow Escape, backdrop press, and downward drag to dismiss the sheet. */
	dismissible?: boolean;
	children: ReactNode;
}

export interface ShareSheetHeaderProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	/** Heading displayed in the sheet header. Falls back to root `title`. */
	title?: ReactNode;
	/** Quiet subtitle such as host, path, or visibility note. */
	subtitle?: ReactNode;
	/** Optional compact 36×36 thumbnail, app glyph, or preview badge. */
	thumbnail?: ReactNode;
	/** Optional compact status badge aligned beside the subtitle or title. */
	badge?: ReactNode;
	/** Render the compact close icon button on the trailing edge. */
	showClose?: boolean;
}

export interface ShareSheetLinkProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "onCopy"> {
	/** URL to display and copy. Falls back to the root `url`. */
	url?: string;
	/** Idle label for the copy button. */
	copyLabel?: string;
	/** Confirmation label shown immediately after copying. */
	copiedLabel?: string;
	/** Milliseconds to hold the copied state before resetting. */
	copiedDuration?: number;
	/** Called with the copied URL after a successful clipboard write. */
	onCopy?: (url: string) => void;
}

export interface ShareSheetTargetsProps extends HTMLAttributes<HTMLDivElement> {
	/** Accessible label for the destinations rail. */
	label?: string;
	children: ReactNode;
}

export interface ShareSheetTargetProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
	/** Destination name displayed below the icon tile. */
	label: string;
	/** Icon or avatar rendered inside the destination tile. */
	icon: ReactNode;
	/** Optional accent classes applied to the circular destination tile. */
	accentClassName?: string;
	/** Optional small badge pinned to the corner of the icon tile. */
	badge?: ReactNode;
	/** Optional external URL opened in a new tab when activated. */
	href?: string;
	/** Brief confirmation label announced and shown on the tile when clicked. */
	feedbackLabel?: string;
	/** Called when the destination is selected. */
	onSelect?: (payload: SharePayload) => void | Promise<void>;
}

export interface ShareSheetActionsProps extends HTMLAttributes<HTMLDivElement> {
	/** Accessible label for the action group. */
	label?: string;
	children: ReactNode;
}

export interface ShareSheetActionProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
	/** Leading icon for the action row. */
	icon?: ReactNode;
	/** Optional quiet secondary label displayed beside the action title. */
	description?: string;
	/** Optional keyboard shortcut hint rendered on the trailing edge. */
	shortcut?: string;
	/** Brief confirmation text shown on the trailing edge after clicking. */
	feedbackLabel?: string;
	/**
	 * When provided, displays a crisp toggled state indicator (useful for
	 * options like "Include timestamp" or "Public link").
	 */
	active?: boolean;
	/** Subtle destructive styling for actions that revoke or remove access. */
	destructive?: boolean;
	/** Called when the action row is activated. */
	onSelect?: (payload: SharePayload) => void | Promise<void>;
	children: ReactNode;
}

export interface ShareSheetSeparatorProps
	extends HTMLAttributes<HTMLHRElement> {}

export interface ShareSheetFooterProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

export interface ShareSheetCloseProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	children?: ReactNode;
}

type PopoverPosition = {
	left: number;
	top: number;
	resolvedSide: ShareSheetSide;
	originX: number;
	originY: number;
	ready: boolean;
};

type ShareSheetContextValue = {
	open: boolean;
	setOpen: (
		next: boolean,
		source?: "pointer" | "keyboard" | "programmatic",
	) => void;
	payload: SharePayload;
	placement: ShareSheetPlacement;
	side: ShareSheetSide;
	align: ShareSheetAlign;
	sideOffset: number;
	collisionPadding: number;
	variant: ShareSheetVariant;
	modal: boolean;
	closeOnSelect: boolean;
	sound: boolean;
	haptics: boolean;
	contentId: string;
	titleId: string;
	descriptionId: string;
	hasTitle: boolean;
	setHasTitle: (value: boolean) => void;
	hasDescription: boolean;
	setHasDescription: (value: boolean) => void;
	triggerRef: RefObject<HTMLButtonElement | null>;
	openedViaKeyboardRef: RefObject<boolean>;
	announcement: string;
	announce: (message: string) => void;
	playCue: (kind: "open" | "select" | "copy" | "close") => void;
	scheduleCloseAfterSelect: () => void;
};

const ShareSheetContext = createContext<ShareSheetContextValue | null>(null);

function useShareSheetContext(componentName: string) {
	const ctx = useContext(ShareSheetContext);
	if (!ctx) {
		throw new Error(`${componentName} must be rendered inside <ShareSheet>.`);
	}
	return ctx;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Apple-style progressive boundary resistance when dragging past an edge. */
function rubberband(overshoot: number, dimension: number, constant = 0.35) {
	return (
		(overshoot * dimension * constant) /
		(dimension + constant * Math.abs(overshoot))
	);
}

function formatDisplayUrl(rawUrl: string) {
	return rawUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to execCommand fallback.
		}
	}
	if (typeof document === "undefined") return false;
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	textarea.style.pointerEvents = "none";
	document.body.appendChild(textarea);
	textarea.select();
	try {
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		document.body.removeChild(textarea);
	}
}

function useIsMobileViewport() {
	return useSyncExternalStore(
		(onChange) => {
			if (typeof window === "undefined") return () => {};
			const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
			mq.addEventListener("change", onChange);
			return () => mq.removeEventListener("change", onChange);
		},
		() =>
			typeof window !== "undefined" &&
			window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches,
		() => false,
	);
}

function getSurfaceClasses(variant: ShareSheetVariant) {
	if (variant === "glass") {
		return cn(
			"bg-background/82 text-foreground backdrop-blur-2xl backdrop-saturate-180",
			"border border-black/[0.08] dark:border-white/[0.12]",
			"shadow-[0_20px_52px_-16px_rgba(15,23,42,0.22),0_4px_14px_-2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)]",
			"dark:bg-neutral-900/78 dark:shadow-[0_24px_60px_-14px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.12)]",
			"[@media(prefers-reduced-transparency:reduce)]:bg-popover [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
		);
	}
	if (variant === "minimal") {
		return cn(
			"bg-popover text-popover-foreground",
			"border border-border/90 dark:border-white/[0.1]",
			"shadow-[0_12px_30px_-12px_rgba(15,23,42,0.14),0_2px_6px_-1px_rgba(15,23,42,0.05)]",
			"dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]",
		);
	}
	return cn(
		"bg-popover text-popover-foreground",
		"border border-border/80 dark:border-white/[0.09]",
		"shadow-[0_22px_54px_-16px_rgba(15,23,42,0.18),0_4px_14px_-2px_rgba(15,23,42,0.06)]",
		"dark:shadow-[0_24px_60px_-14px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.05)]",
	);
}

function ShareSheetRoot({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	url,
	title,
	text,
	placement = "auto",
	side = "bottom",
	align = "end",
	sideOffset = 10,
	collisionPadding = 12,
	variant = "surface",
	modal = true,
	closeOnSelect = false,
	sound = true,
	haptics = true,
	children,
}: ShareSheetProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const open = openProp ?? uncontrolledOpen;

	const contentId = useId();
	const titleId = useId();
	const descriptionId = useId();
	const [hasTitle, setHasTitle] = useState(false);
	const [hasDescription, setHasDescription] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const openedViaKeyboardRef = useRef(false);
	const closeTimerRef = useRef<number | null>(null);

	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		swoosh: playSwoosh,
	} = useTiks({
		respectReducedMotion: false,
	});

	const playCue = useCallback(
		(kind: "open" | "select" | "copy" | "close") => {
			if (sound) {
				if (kind === "open") playPop();
				else if (kind === "copy" || kind === "select") playClick();
				else playSwoosh();
			}
			if (haptics) {
				if (kind === "open") void haptic("light");
				else if (kind === "copy" || kind === "select") void haptic("selection");
				else void haptic("soft");
			}
		},
		[haptic, haptics, playClick, playPop, playSwoosh, sound],
	);

	const setOpen = useCallback(
		(
			next: boolean,
			source: "pointer" | "keyboard" | "programmatic" = "programmatic",
		) => {
			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
				closeTimerRef.current = null;
			}
			if (next) {
				openedViaKeyboardRef.current = source === "keyboard";
			}
			if (openProp === undefined) {
				setUncontrolledOpen(next);
			}
			onOpenChange?.(next);
			if (source !== "programmatic") {
				playCue(next ? "open" : "close");
			}
		},
		[onOpenChange, openProp, playCue],
	);

	const announce = useCallback((message: string) => {
		setAnnouncement("");
		requestAnimationFrame(() => setAnnouncement(message));
	}, []);

	const scheduleCloseAfterSelect = useCallback(() => {
		if (!closeOnSelect) return;
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = window.setTimeout(() => {
			closeTimerRef.current = null;
			setOpen(false, "programmatic");
		}, 420);
	}, [closeOnSelect, setOpen]);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	const payload = useMemo<SharePayload>(
		() => ({ url, title, text }),
		[url, title, text],
	);

	const value = useMemo<ShareSheetContextValue>(
		() => ({
			open,
			setOpen,
			payload,
			placement,
			side,
			align,
			sideOffset,
			collisionPadding,
			variant,
			modal,
			closeOnSelect,
			sound,
			haptics,
			contentId,
			titleId,
			descriptionId,
			hasTitle,
			setHasTitle,
			hasDescription,
			setHasDescription,
			triggerRef,
			openedViaKeyboardRef,
			announcement,
			announce,
			playCue,
			scheduleCloseAfterSelect,
		}),
		[
			open,
			setOpen,
			payload,
			placement,
			side,
			align,
			sideOffset,
			collisionPadding,
			variant,
			modal,
			closeOnSelect,
			sound,
			haptics,
			contentId,
			titleId,
			descriptionId,
			hasTitle,
			hasDescription,
			announcement,
			announce,
			playCue,
			scheduleCloseAfterSelect,
		],
	);

	return (
		<ShareSheetContext.Provider value={value}>
			{children}
		</ShareSheetContext.Provider>
	);
}

export function ShareSheetTrigger({
	className,
	onClick,
	onKeyDown,
	onPointerDown,
	children,
	type = "button",
	...props
}: ShareSheetTriggerProps) {
	const { open, setOpen, contentId, triggerRef } =
		useShareSheetContext("ShareSheetTrigger");
	const keyboardIntentRef = useRef(false);

	return (
		<button
			ref={triggerRef}
			type={type}
			data-slot="share-sheet-trigger"
			data-state={open ? "open" : "closed"}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-controls={open ? contentId : undefined}
			className={cn(
				"inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border/80 bg-background px-3.5 py-2 font-medium text-foreground text-sm shadow-xs outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/70",
				className,
			)}
			onPointerDown={(event) => {
				keyboardIntentRef.current = false;
				onPointerDown?.(event);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					keyboardIntentRef.current = true;
				}
				onKeyDown?.(event);
			}}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				const source = keyboardIntentRef.current ? "keyboard" : "pointer";
				keyboardIntentRef.current = false;
				setOpen(!open, source);
			}}
			{...props}
		>
			{children}
		</button>
	);
}

export function ShareSheetContent({
	container,
	showHandle = true,
	dismissible = true,
	className,
	children,
	...props
}: ShareSheetContentProps) {
	const {
		open,
		setOpen,
		placement,
		side,
		align,
		sideOffset,
		collisionPadding,
		variant,
		modal,
		contentId,
		titleId,
		descriptionId,
		hasTitle,
		hasDescription,
		triggerRef,
		openedViaKeyboardRef,
		announcement,
	} = useShareSheetContext("ShareSheetContent");

	const shouldReduceMotion = useReducedMotion() ?? false;
	const isMobileViewport = useIsMobileViewport();
	const [mounted, setMounted] = useState(false);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useLayoutEffect(() => {
		if (!mounted) return;
		const host = container?.current;
		if (!host) {
			setContainerWidth(null);
			return;
		}
		const update = () => setContainerWidth(host.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(host);
		return () => observer.disconnect();
	}, [container, mounted, open]);

	const resolvedMode: "popover" | "sheet" = useMemo(() => {
		if (placement === "sheet") return "sheet";
		if (placement === "popover") return "popover";
		if (containerWidth !== null) {
			return containerWidth < COMPACT_CONTAINER_WIDTH ? "sheet" : "popover";
		}
		return isMobileViewport ? "sheet" : "popover";
	}, [containerWidth, isMobileViewport, placement]);

	const isScoped = Boolean(container?.current);

	// Popover geometry (measured synchronously on layout so first paint never jumps).
	const [pos, setPos] = useState<PopoverPosition>({
		left: collisionPadding,
		top: collisionPadding,
		resolvedSide: side,
		originX: 160,
		originY: 0,
		ready: false,
	});

	const updatePopoverPosition = useCallback(() => {
		if (!mounted || !open || resolvedMode !== "popover") return;
		const panel = panelRef.current;
		if (!panel) return;

		const host = container?.current ?? null;
		const hostRect = host ? host.getBoundingClientRect() : null;
		const boundsWidth = hostRect ? hostRect.width : window.innerWidth;
		const boundsHeight = hostRect ? hostRect.height : window.innerHeight;
		const panelWidth = panel.offsetWidth || 336;
		const panelHeight = panel.offsetHeight || 260;

		const trigger = triggerRef.current;
		if (!trigger) {
			setPos({
				left: Math.max(collisionPadding, (boundsWidth - panelWidth) / 2),
				top: Math.max(collisionPadding, (boundsHeight - panelHeight) / 2),
				resolvedSide: side,
				originX: panelWidth / 2,
				originY: panelHeight / 2,
				ready: true,
			});
			return;
		}

		const tRect = trigger.getBoundingClientRect();
		const relLeft = hostRect ? tRect.left - hostRect.left : tRect.left;
		const relTop = hostRect ? tRect.top - hostRect.top : tRect.top;
		const relBottom = relTop + tRect.height;
		const relCenterX = relLeft + tRect.width / 2;

		const spaceBelow = boundsHeight - relBottom - sideOffset - collisionPadding;
		const spaceAbove = relTop - sideOffset - collisionPadding;

		let resolvedSide: ShareSheetSide = side;
		if (
			side === "bottom" &&
			spaceBelow < panelHeight &&
			spaceAbove > spaceBelow
		) {
			resolvedSide = "top";
		} else if (
			side === "top" &&
			spaceAbove < panelHeight &&
			spaceBelow > spaceAbove
		) {
			resolvedSide = "bottom";
		}

		const rawTop =
			resolvedSide === "bottom"
				? relBottom + sideOffset
				: relTop - sideOffset - panelHeight;

		let rawLeft = relLeft;
		if (align === "center") {
			rawLeft = relCenterX - panelWidth / 2;
		} else if (align === "end") {
			rawLeft = relLeft + tRect.width - panelWidth;
		}

		const maxLeft = Math.max(
			collisionPadding,
			boundsWidth - panelWidth - collisionPadding,
		);
		const maxTop = Math.max(
			collisionPadding,
			boundsHeight - panelHeight - collisionPadding,
		);

		const left = clamp(rawLeft, collisionPadding, maxLeft);
		const top = clamp(rawTop, collisionPadding, maxTop);
		const originX = clamp(relCenterX - left, 20, Math.max(20, panelWidth - 20));
		const originY = resolvedSide === "bottom" ? 0 : panelHeight;

		setPos({
			left,
			top,
			resolvedSide,
			originX,
			originY,
			ready: true,
		});
	}, [
		align,
		collisionPadding,
		container,
		mounted,
		open,
		resolvedMode,
		side,
		sideOffset,
		triggerRef,
	]);

	useLayoutEffect(() => {
		if (!mounted || !open || resolvedMode !== "popover") return;
		updatePopoverPosition();

		const panel = panelRef.current;
		const resizeObserver =
			panel && typeof ResizeObserver !== "undefined"
				? new ResizeObserver(updatePopoverPosition)
				: null;
		if (panel && resizeObserver) resizeObserver.observe(panel);
		if (container?.current && resizeObserver) {
			resizeObserver.observe(container.current);
		}

		window.addEventListener("resize", updatePopoverPosition, { passive: true });
		window.addEventListener("scroll", updatePopoverPosition, {
			passive: true,
			capture: true,
		});
		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", updatePopoverPosition);
			window.removeEventListener("scroll", updatePopoverPosition, {
				capture: true,
			});
		};
	}, [container, mounted, open, resolvedMode, updatePopoverPosition]);

	// Drag-to-dismiss state for compact sheet mode.
	const dragY = useMotionValue(0);
	const scrimDragOpacity = useTransform(dragY, [0, 220], [1, 0]);
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		dragging: boolean;
		samples: Array<{ y: number; t: number }>;
	} | null>(null);

	useEffect(() => {
		if (open) {
			dragY.set(0);
		}
	}, [dragY, open]);

	const handleSheetPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (resolvedMode !== "sheet" || !dismissible) return;
			if (event.button !== 0 && event.pointerType === "mouse") return;
			if (dragRef.current) return;
			const target = event.target as HTMLElement | null;
			if (target?.closest(NO_DRAG_SELECTOR)) return;

			dragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				dragging: false,
				samples: [{ y: event.clientY, t: performance.now() }],
			};
		},
		[dismissible, resolvedMode],
	);

	const handleSheetPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			const dx = event.clientX - drag.startX;
			const dy = event.clientY - drag.startY;

			if (!drag.dragging) {
				if (Math.abs(dy) < DRAG_SLOP && Math.abs(dx) < DRAG_SLOP) return;
				if (Math.abs(dx) > Math.abs(dy)) {
					dragRef.current = null;
					return;
				}
				drag.dragging = true;
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch {
					// Synthetic events in tests may not support capture.
				}
			}

			const now = performance.now();
			drag.samples.push({ y: event.clientY, t: now });
			while (
				drag.samples.length > 2 &&
				now - drag.samples[0]!.t > VELOCITY_WINDOW_MS
			) {
				drag.samples.shift();
			}

			const nextY =
				dy < 0 ? (shouldReduceMotion ? 0 : rubberband(dy, 180, 0.32)) : dy;
			dragY.set(nextY);
		},
		[dragY, shouldReduceMotion],
	);

	const finishSheetDrag = useCallback(
		(event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			dragRef.current = null;
			if (!drag.dragging) return;

			try {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}
			} catch {
				// Ignore release errors on synthetic pointers.
			}

			if (cancelled) {
				animate(
					dragY,
					0,
					shouldReduceMotion
						? REDUCED_TRANSITION
						: { type: "spring", stiffness: 480, damping: 36 },
				);
				return;
			}

			const first = drag.samples[0];
			const last = drag.samples[drag.samples.length - 1];
			const dt = first && last ? Math.max(1, last.t - first.t) : 100;
			const velocity =
				first && last
					? clamp(((last.y - first.y) / dt) * 1000, -3000, 3000)
					: 0;
			const currentY = dragY.get();

			if (currentY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
				setOpen(false, "pointer");
				return;
			}

			animate(
				dragY,
				0,
				shouldReduceMotion
					? REDUCED_TRANSITION
					: {
							type: "spring",
							stiffness: 480,
							damping: 36,
							velocity,
						},
			);
		},
		[dragY, setOpen, shouldReduceMotion],
	);

	// Focus management, Escape key, outside click, and scroll lock.
	useEffect(() => {
		if (!mounted || !open) return;

		const panel = panelRef.current;
		if (modal && panel) {
			if (openedViaKeyboardRef.current) {
				const firstFocusable =
					panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
				(firstFocusable ?? panel).focus({ preventScroll: true });
			} else {
				panel.focus({ preventScroll: true });
			}
		}

		const handleKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape" && dismissible) {
				event.preventDefault();
				event.stopPropagation();
				setOpen(false, "keyboard");
				requestAnimationFrame(() => {
					triggerRef.current?.focus({ preventScroll: true });
				});
				return;
			}

			if (event.key === "Tab" && modal && panelRef.current) {
				const focusables = Array.from(
					panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
				).filter((el) => el.offsetParent !== null);
				if (focusables.length === 0) {
					event.preventDefault();
					panelRef.current.focus();
					return;
				}
				const first = focusables[0]!;
				const last = focusables[focusables.length - 1]!;
				const active = document.activeElement as HTMLElement | null;
				if (event.shiftKey) {
					if (
						!active ||
						active === first ||
						!panelRef.current.contains(active)
					) {
						event.preventDefault();
						last.focus();
					}
				} else if (
					!active ||
					active === last ||
					!panelRef.current.contains(active)
				) {
					event.preventDefault();
					first.focus();
				}
			}
		};

		const handlePointerDownOutside = (event: globalThis.PointerEvent) => {
			if (!dismissible || !modal) return;
			const target = event.target as Node | null;
			if (!target) return;
			if (panelRef.current?.contains(target)) return;
			if (triggerRef.current?.contains(target)) return;
			setOpen(false, "pointer");
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("pointerdown", handlePointerDownOutside, true);

		const lockScroll = modal && resolvedMode === "sheet" && !isScoped;
		const previousOverflow = lockScroll ? document.body.style.overflow : null;
		if (lockScroll) {
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener(
				"pointerdown",
				handlePointerDownOutside,
				true,
			);
			if (lockScroll && previousOverflow !== null) {
				document.body.style.overflow = previousOverflow;
			}
		};
	}, [
		dismissible,
		isScoped,
		modal,
		mounted,
		open,
		openedViaKeyboardRef,
		resolvedMode,
		setOpen,
		triggerRef,
	]);

	if (!mounted) return null;

	const portalTarget = container?.current ?? document.body;
	const surfaceClasses = getSurfaceClasses(variant);

	const popoverInitial = shouldReduceMotion
		? { opacity: 0 }
		: {
				opacity: 0,
				scale: 0.94,
				y: pos.resolvedSide === "bottom" ? -6 : 6,
				filter: "blur(4px)",
			};

	const popoverAnimate = shouldReduceMotion
		? { opacity: 1 }
		: {
				opacity: 1,
				scale: 1,
				y: 0,
				filter: "blur(0px)",
			};

	const popoverExit = shouldReduceMotion
		? { opacity: 0, transition: REDUCED_TRANSITION }
		: {
				opacity: 0,
				scale: 0.96,
				y: pos.resolvedSide === "bottom" ? -4 : 4,
				filter: "blur(2px)",
				transition: EXIT_TRANSITION,
			};

	const sheetInitial = shouldReduceMotion
		? { opacity: 0 }
		: { opacity: 0.6, y: "104%" };
	const sheetAnimate = shouldReduceMotion
		? { opacity: 1 }
		: { opacity: 1, y: 0 };
	const sheetExit = shouldReduceMotion
		? { opacity: 0, transition: REDUCED_TRANSITION }
		: {
				opacity: 0,
				y: "106%",
				transition: {
					type: "tween" as const,
					duration: 0.18,
					ease: [0.23, 1, 0.32, 1] as const,
				},
			};

	return createPortal(
		<AnimatePresence>
			{open ? (
				<div
					key="share-sheet-portal"
					data-slot="share-sheet-portal"
					data-mode={resolvedMode}
					className={cn(
						"pointer-events-none",
						isScoped ? "absolute inset-0 z-40" : "fixed inset-0 z-50",
					)}
				>
					{modal && resolvedMode === "sheet" ? (
						<motion.div
							aria-hidden="true"
							data-slot="share-sheet-backdrop"
							style={
								shouldReduceMotion ? undefined : { opacity: scrimDragOpacity }
							}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={
								shouldReduceMotion
									? REDUCED_TRANSITION
									: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
							}
							onClick={() => {
								if (dismissible) setOpen(false, "pointer");
							}}
							className={cn(
								"pointer-events-auto inset-0 bg-black/32 backdrop-blur-[2px] dark:bg-black/56",
								"[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
								isScoped ? "absolute" : "fixed",
							)}
						/>
					) : null}

					{resolvedMode === "popover" ? (
						<motion.div
							ref={panelRef}
							id={contentId}
							role="dialog"
							aria-modal={modal ? "true" : undefined}
							aria-labelledby={hasTitle ? titleId : undefined}
							aria-label={hasTitle ? undefined : "Share"}
							aria-describedby={hasDescription ? descriptionId : undefined}
							tabIndex={-1}
							data-slot="share-sheet-content"
							data-mode="popover"
							data-side={pos.resolvedSide}
							data-variant={variant}
							initial={popoverInitial}
							animate={popoverAnimate}
							exit={popoverExit}
							transition={
								shouldReduceMotion ? REDUCED_TRANSITION : POPOVER_ENTER_SPRING
							}
							style={{
								position: isScoped ? "absolute" : "fixed",
								left: pos.left,
								top: pos.top,
								transformOrigin: `${pos.originX}px ${pos.originY}px`,
								visibility: pos.ready ? "visible" : "hidden",
							}}
							className={cn(
								"pointer-events-auto flex w-[min(340px,calc(100vw-24px))] flex-col gap-3 rounded-[22px] p-3.5 outline-none will-change-transform",
								surfaceClasses,
								className,
							)}
							{...(props as ComponentProps<typeof motion.div>)}
						>
							{children}
							<span className="sr-only" aria-live="polite" aria-atomic="true">
								{announcement}
							</span>
						</motion.div>
					) : (
						<motion.div
							ref={panelRef}
							id={contentId}
							role="dialog"
							aria-modal={modal ? "true" : undefined}
							aria-labelledby={hasTitle ? titleId : undefined}
							aria-label={hasTitle ? undefined : "Share"}
							aria-describedby={hasDescription ? descriptionId : undefined}
							tabIndex={-1}
							data-slot="share-sheet-content"
							data-mode="sheet"
							data-variant={variant}
							initial={sheetInitial}
							animate={sheetAnimate}
							exit={sheetExit}
							transition={
								shouldReduceMotion ? REDUCED_TRANSITION : SHEET_ENTER_SPRING
							}
							style={{ y: dragY }}
							onPointerDown={handleSheetPointerDown}
							onPointerMove={handleSheetPointerMove}
							onPointerUp={(event) => finishSheetDrag(event, false)}
							onPointerCancel={(event) => finishSheetDrag(event, true)}
							className={cn(
								"pointer-events-auto inset-x-3 mx-auto flex max-w-[388px] touch-pan-x flex-col gap-3 rounded-[24px] p-3.5 pt-2.5 outline-none will-change-transform",
								isScoped
									? "absolute bottom-3"
									: "fixed bottom-[max(12px,env(safe-area-inset-bottom,0px))]",
								surfaceClasses,
								className,
							)}
							{...(props as ComponentProps<typeof motion.div>)}
						>
							{showHandle ? (
								<div
									data-slot="share-sheet-handle"
									aria-hidden="true"
									className="mx-auto mb-0.5 flex w-full cursor-grab items-center justify-center py-1 active:cursor-grabbing"
								>
									<span className="h-1 w-9 rounded-full bg-foreground/16 dark:bg-white/20" />
								</div>
							) : null}
							{children}
							<span className="sr-only" aria-live="polite" aria-atomic="true">
								{announcement}
							</span>
						</motion.div>
					)}
				</div>
			) : null}
		</AnimatePresence>,
		portalTarget,
	);
}

export function ShareSheetHeader({
	title,
	subtitle,
	thumbnail,
	badge,
	showClose = true,
	className,
	...props
}: ShareSheetHeaderProps) {
	const { payload, titleId, descriptionId, setHasTitle, setHasDescription } =
		useShareSheetContext("ShareSheetHeader");

	const resolvedTitle = title ?? payload.title ?? "Share";
	const resolvedSubtitle =
		subtitle ?? (payload.url ? formatDisplayUrl(payload.url) : undefined);

	useEffect(() => {
		setHasTitle(true);
		return () => setHasTitle(false);
	}, [setHasTitle]);

	useEffect(() => {
		const present = Boolean(resolvedSubtitle);
		setHasDescription(present);
		return () => setHasDescription(false);
	}, [resolvedSubtitle, setHasDescription]);

	return (
		<div
			data-slot="share-sheet-header"
			className={cn("flex items-center gap-2.5 px-0.5", className)}
			{...props}
		>
			{thumbnail ? (
				<div
					data-slot="share-sheet-thumbnail"
					className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-border/70 bg-muted/60 text-foreground dark:border-white/[0.08] dark:bg-white/[0.05]"
				>
					{thumbnail}
				</div>
			) : null}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<h2
						id={titleId}
						data-slot="share-sheet-title"
						className="truncate font-semibold text-[13.5px] text-foreground leading-tight tracking-[-0.015em]"
					>
						{resolvedTitle}
					</h2>
					{badge ? <span className="shrink-0">{badge}</span> : null}
				</div>
				{resolvedSubtitle ? (
					<p
						id={descriptionId}
						data-slot="share-sheet-subtitle"
						className="mt-0.5 truncate text-[11.5px] text-muted-foreground leading-tight"
					>
						{resolvedSubtitle}
					</p>
				) : null}
			</div>
			{showClose ? <ShareSheetClose /> : null}
		</div>
	);
}

export function ShareSheetClose({
	className,
	children,
	onClick,
	type = "button",
	...props
}: ShareSheetCloseProps) {
	const { setOpen, triggerRef } = useShareSheetContext("ShareSheetClose");

	return (
		<button
			type={type}
			data-slot="share-sheet-close"
			aria-label={props["aria-label"] ?? "Close share sheet"}
			className={cn(
				"inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted/70 text-muted-foreground outline-none transition-[transform,background-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.93] dark:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.12]",
				className,
			)}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				setOpen(false, "pointer");
				requestAnimationFrame(() => {
					triggerRef.current?.focus({ preventScroll: true });
				});
			}}
			{...props}
		>
			{children ?? <XIcon className="size-3.5" aria-hidden="true" />}
		</button>
	);
}

export function ShareSheetLink({
	url,
	copyLabel = "Copy",
	copiedLabel = "Copied",
	copiedDuration = 2000,
	onCopy,
	className,
	...props
}: ShareSheetLinkProps) {
	const { payload, playCue, announce, scheduleCloseAfterSelect } =
		useShareSheetContext("ShareSheetLink");
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number | null>(null);

	const resolvedUrl = url ?? payload.url ?? "";
	const displayUrl = formatDisplayUrl(resolvedUrl);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		};
	}, []);

	const handleCopy = useCallback(async () => {
		if (!resolvedUrl) return;
		const ok = await copyTextToClipboard(resolvedUrl);
		if (!ok) return;

		setCopied(true);
		playCue("copy");
		announce("Link copied to clipboard");
		onCopy?.(resolvedUrl);
		scheduleCloseAfterSelect();

		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => {
			setCopied(false);
			timerRef.current = null;
		}, copiedDuration);
	}, [
		announce,
		copiedDuration,
		onCopy,
		playCue,
		resolvedUrl,
		scheduleCloseAfterSelect,
	]);

	return (
		<div
			data-slot="share-sheet-link"
			className={cn(
				"flex items-center gap-2 rounded-[14px] border border-border/70 bg-muted/45 py-1.5 pr-1.5 pl-2.5 dark:border-white/[0.07] dark:bg-white/[0.04]",
				className,
			)}
			{...props}
		>
			<Link2Icon
				className="size-3.5 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<span
				title={resolvedUrl}
				className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/85 tabular-nums"
			>
				{displayUrl || "No link set"}
			</span>
			<button
				type="button"
				data-slot="share-sheet-copy-button"
				data-copied={copied ? "true" : "false"}
				disabled={!resolvedUrl}
				onClick={() => void handleCopy()}
				className={cn(
					"relative inline-flex h-7 min-w-[78px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] px-2.5 font-medium text-[12px] outline-none transition-[transform,background-color,color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45",
					copied
						? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-neutral-950"
						: "bg-foreground text-background shadow-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/90",
				)}
			>
				<AnimatePresence mode="popLayout" initial={false}>
					{copied ? (
						<motion.span
							key="copied"
							initial={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							animate={
								shouldReduceMotion
									? { opacity: 1 }
									: { opacity: 1, scale: 1, filter: "blur(0px)" }
							}
							exit={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
							className="inline-flex items-center gap-1"
						>
							<CheckIcon className="size-3 stroke-[2.5]" aria-hidden="true" />
							<span>{copiedLabel}</span>
						</motion.span>
					) : (
						<motion.span
							key="copy"
							initial={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							animate={
								shouldReduceMotion
									? { opacity: 1 }
									: { opacity: 1, scale: 1, filter: "blur(0px)" }
							}
							exit={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
							className="inline-flex items-center gap-1"
						>
							<CopyIcon className="size-3" aria-hidden="true" />
							<span>{copyLabel}</span>
						</motion.span>
					)}
				</AnimatePresence>
			</button>
		</div>
	);
}

export function ShareSheetTargets({
	label = "Share to",
	className,
	children,
	...props
}: ShareSheetTargetsProps) {
	const railRef = useRef<HTMLDivElement | null>(null);
	const [fade, setFade] = useState({ left: false, right: false });

	const updateFade = useCallback(() => {
		const el = railRef.current;
		if (!el) return;
		const left = el.scrollLeft > 4;
		const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
		setFade((prev) =>
			prev.left === left && prev.right === right ? prev : { left, right },
		);
	}, []);

	useLayoutEffect(() => {
		updateFade();
		const el = railRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(updateFade);
		observer.observe(el);
		return () => observer.disconnect();
	}, [updateFade]);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		if (
			event.key !== "ArrowRight" &&
			event.key !== "ArrowLeft" &&
			event.key !== "Home" &&
			event.key !== "End"
		) {
			return;
		}
		const rail = railRef.current;
		if (!rail) return;
		const items = Array.from(
			rail.querySelectorAll<HTMLButtonElement>(
				'button[data-slot="share-sheet-target"]:not([disabled])',
			),
		);
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		if (index === -1) return;

		event.preventDefault();
		let nextIndex = index;
		if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
		else if (event.key === "ArrowLeft")
			nextIndex = (index - 1 + items.length) % items.length;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = items.length - 1;

		const next = items[nextIndex];
		next?.focus();
		next?.scrollIntoView({
			block: "nearest",
			inline: "nearest",
			behavior: "smooth",
		});
	}, []);

	const maskImage =
		fade.left && fade.right
			? "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)"
			: fade.left
				? "linear-gradient(to right, transparent 0, black 20px, black 100%)"
				: fade.right
					? "linear-gradient(to right, black 0, black calc(100% - 20px), transparent 100%)"
					: undefined;

	return (
		<div
			ref={railRef}
			role="group"
			aria-label={label}
			data-slot="share-sheet-targets"
			data-share-no-drag=""
			onScroll={updateFade}
			onKeyDown={handleKeyDown}
			style={maskImage ? { maskImage, WebkitMaskImage: maskImage } : undefined}
			className={cn(
				"flex items-start justify-between gap-1.5 overflow-x-auto px-0.5 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function ShareSheetTarget({
	label,
	icon,
	accentClassName,
	badge,
	href,
	feedbackLabel,
	onSelect,
	onClick,
	disabled,
	className,
	type = "button",
	...props
}: ShareSheetTargetProps) {
	const { payload, playCue, announce, scheduleCloseAfterSelect } =
		useShareSheetContext("ShareSheetTarget");
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [sent, setSent] = useState(false);
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		};
	}, []);

	const handleActivate = useCallback(async () => {
		if (disabled) return;
		playCue("select");
		setSent(true);
		announce(
			feedbackLabel ? `${label}: ${feedbackLabel}` : `Shared via ${label}`,
		);

		if (href) {
			window.open(href, "_blank", "noopener,noreferrer");
		}
		await onSelect?.(payload);
		scheduleCloseAfterSelect();

		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => {
			setSent(false);
			timerRef.current = null;
		}, 1400);
	}, [
		announce,
		disabled,
		feedbackLabel,
		href,
		label,
		onSelect,
		payload,
		playCue,
		scheduleCloseAfterSelect,
	]);

	return (
		<button
			type={type}
			disabled={disabled}
			data-slot="share-sheet-target"
			data-target={label}
			data-sent={sent ? "true" : "false"}
			aria-label={sent && feedbackLabel ? `${label}, ${feedbackLabel}` : label}
			className={cn(
				"group flex w-[56px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-2xl py-1 outline-none transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-45",
				className,
			)}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				void handleActivate();
			}}
			{...props}
		>
			<span
				className={cn(
					"relative flex size-11 items-center justify-center rounded-[15px] border border-border/65 bg-muted/60 text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out dark:border-white/[0.08] dark:bg-white/[0.06] [&>svg]:size-[18px]",
					"[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-border [@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-sm",
					accentClassName,
				)}
			>
				{icon}
				{badge && !sent ? (
					<span className="pointer-events-none absolute -top-1 -right-1">
						{badge}
					</span>
				) : null}
				<AnimatePresence>
					{sent ? (
						<motion.span
							key="sent-badge"
							initial={
								shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }
							}
							animate={
								shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
							}
							exit={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.75 }
							}
							transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
							aria-hidden="true"
							className="absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-popover dark:bg-emerald-500 dark:text-neutral-950"
						>
							<CheckIcon className="size-2.5 stroke-[3]" />
						</motion.span>
					) : null}
				</AnimatePresence>
			</span>
			<span className="w-full truncate text-center font-medium text-[11px] text-muted-foreground leading-tight tracking-[0.005em] transition-colors duration-150 group-hover:text-foreground">
				{sent && feedbackLabel ? feedbackLabel : label}
			</span>
		</button>
	);
}

export function ShareSheetActions({
	label = "Actions",
	className,
	children,
	...props
}: ShareSheetActionsProps) {
	const listRef = useRef<HTMLDivElement | null>(null);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		const list = listRef.current;
		if (!list) return;
		const items = Array.from(
			list.querySelectorAll<HTMLButtonElement>(
				'button[data-slot="share-sheet-action"]:not([disabled])',
			),
		);
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		if (index === -1) return;

		event.preventDefault();
		const nextIndex =
			event.key === "ArrowDown"
				? (index + 1) % items.length
				: (index - 1 + items.length) % items.length;
		items[nextIndex]?.focus();
	}, []);

	return (
		<div
			ref={listRef}
			role="group"
			aria-label={label}
			data-slot="share-sheet-actions"
			onKeyDown={handleKeyDown}
			className={cn(
				"flex flex-col divide-y divide-border/55 overflow-hidden rounded-[15px] border border-border/70 bg-muted/35 dark:divide-white/[0.06] dark:border-white/[0.07] dark:bg-white/[0.03]",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function ShareSheetAction({
	icon,
	description,
	shortcut,
	feedbackLabel,
	active,
	destructive = false,
	onSelect,
	onClick,
	disabled,
	className,
	children,
	type = "button",
	...props
}: ShareSheetActionProps) {
	const { payload, playCue, announce, scheduleCloseAfterSelect } =
		useShareSheetContext("ShareSheetAction");
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [confirmed, setConfirmed] = useState(false);
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		};
	}, []);

	const handleActivate = useCallback(async () => {
		if (disabled) return;
		playCue("select");
		await onSelect?.(payload);
		if (feedbackLabel) {
			setConfirmed(true);
			announce(feedbackLabel);
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
			timerRef.current = window.setTimeout(() => {
				setConfirmed(false);
				timerRef.current = null;
			}, 1400);
		}
		if (active === undefined) {
			scheduleCloseAfterSelect();
		}
	}, [
		active,
		announce,
		disabled,
		feedbackLabel,
		onSelect,
		payload,
		playCue,
		scheduleCloseAfterSelect,
	]);

	return (
		<button
			type={type}
			disabled={disabled}
			aria-pressed={active !== undefined ? active : undefined}
			data-slot="share-sheet-action"
			data-active={active ? "true" : undefined}
			data-confirmed={confirmed ? "true" : undefined}
			className={cn(
				"flex min-h-[40px] w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] outline-none transition-[transform,background-color,color] duration-150 ease-out focus-visible:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
				destructive
					? "text-destructive [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/10"
					: "text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/80 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.06]",
				className,
			)}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				void handleActivate();
			}}
			{...props}
		>
			{icon ? (
				<span
					aria-hidden="true"
					className={cn(
						"flex size-4 shrink-0 items-center justify-center [&>svg]:size-4",
						destructive ? "text-destructive" : "text-muted-foreground",
					)}
				>
					{icon}
				</span>
			) : null}
			<span className="min-w-0 flex-1 truncate font-medium leading-tight">
				{children}
			</span>
			<span className="flex shrink-0 items-center gap-1.5">
				<AnimatePresence mode="popLayout" initial={false}>
					{confirmed && feedbackLabel ? (
						<motion.span
							key="confirmed"
							initial={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							animate={
								shouldReduceMotion
									? { opacity: 1 }
									: { opacity: 1, scale: 1, filter: "blur(0px)" }
							}
							exit={
								shouldReduceMotion
									? { opacity: 0 }
									: { opacity: 0, scale: 0.92, filter: "blur(2px)" }
							}
							transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
							className="inline-flex items-center gap-1 font-medium text-[11.5px] text-emerald-600 dark:text-emerald-400"
						>
							<CheckIcon className="size-3 stroke-[2.5]" aria-hidden="true" />
							<span>{feedbackLabel}</span>
						</motion.span>
					) : (
						<motion.span
							key="idle"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.12 }}
							className="inline-flex items-center gap-1.5"
						>
							{description ? (
								<span className="text-[11.5px] text-muted-foreground">
									{description}
								</span>
							) : null}
							{shortcut ? (
								<kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground leading-none dark:border-white/[0.1] dark:bg-white/[0.06]">
									{shortcut}
								</kbd>
							) : null}
							{active !== undefined ? (
								<span
									aria-hidden="true"
									className={cn(
										"flex size-4 items-center justify-center rounded-full border transition-colors duration-150",
										active
											? "border-foreground bg-foreground text-background"
											: "border-border/90 bg-transparent text-transparent",
									)}
								>
									<CheckIcon className="size-2.5 stroke-[3]" />
								</span>
							) : null}
						</motion.span>
					)}
				</AnimatePresence>
			</span>
		</button>
	);
}

export function ShareSheetSeparator({
	className,
	...props
}: ShareSheetSeparatorProps) {
	return (
		<hr
			data-slot="share-sheet-separator"
			className={cn(
				"h-px w-full border-0 bg-border/60 dark:bg-white/[0.07]",
				className,
			)}
			{...props}
		/>
	);
}

export function ShareSheetFooter({
	className,
	children,
	...props
}: ShareSheetFooterProps) {
	return (
		<div
			data-slot="share-sheet-footer"
			className={cn(
				"flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px] text-muted-foreground",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export const ShareSheet = Object.assign(ShareSheetRoot, {
	Trigger: ShareSheetTrigger,
	Content: ShareSheetContent,
	Header: ShareSheetHeader,
	Link: ShareSheetLink,
	Targets: ShareSheetTargets,
	Target: ShareSheetTarget,
	Actions: ShareSheetActions,
	Action: ShareSheetAction,
	Separator: ShareSheetSeparator,
	Footer: ShareSheetFooter,
	Close: ShareSheetClose,
});
