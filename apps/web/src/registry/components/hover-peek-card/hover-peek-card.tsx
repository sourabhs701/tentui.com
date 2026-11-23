"use client";

import {
	AnimatePresence,
	domAnimation,
	LazyMotion,
	m,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "motion/react";
import {
	Children,
	cloneElement,
	createContext,
	type FocusEvent,
	type HTMLAttributes,
	isValidElement,
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
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Preferred placement edge relative to the trigger. */
export type HoverPeekCardSide = "top" | "bottom" | "left" | "right";
/** Alignment along the cross axis of the trigger. */
export type HoverPeekCardAlign = "start" | "center" | "end";
/** Visual surface treatment for the floating peek card. */
export type HoverPeekCardVariant = "elevated" | "glass" | "minimal";

type OpenSource = "pointer" | "keyboard" | "touch" | "controlled";

const VIEWPORT_PADDING = 12;
const TOUCH_SLOP = 10;
const ENTER_OFFSET = 6;
const EXIT_OFFSET = 3;
const MAX_TILT_DEG = 2;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const ENTER_SPRING = {
	type: "spring" as const,
	stiffness: 460,
	damping: 36,
	mass: 0.85,
};

const TILT_SPRING = {
	stiffness: 260,
	damping: 26,
	mass: 0.6,
};

const OPPOSITE_SIDE: Record<HoverPeekCardSide, HoverPeekCardSide> = {
	top: "bottom",
	bottom: "top",
	left: "right",
	right: "left",
};

type ZoomedElement = HTMLElement & { currentCSSZoom?: number };

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getEffectiveZoom(element: HTMLElement | null): number {
	if (!element) return 1;
	const zoomed = element as ZoomedElement;
	if (
		typeof zoomed.currentCSSZoom === "number" &&
		Number.isFinite(zoomed.currentCSSZoom) &&
		zoomed.currentCSSZoom > 0
	) {
		return zoomed.currentCSSZoom;
	}
	return 1;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
	return (node: T | null) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === "function") {
				ref(node);
			} else {
				(ref as RefObject<T | null>).current = node;
			}
		}
	};
}

/**
 * Checks whether point `p` lies inside the triangle formed by `(a, b, c)`.
 * Used for safe-corridor hover tolerance when moving diagonally from trigger to card.
 */
function isPointInTriangle(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
) {
	const v0x = cx - ax;
	const v0y = cy - ay;
	const v1x = bx - ax;
	const v1y = by - ay;
	const v2x = px - ax;
	const v2y = py - ay;

	const dot00 = v0x * v0x + v0y * v0y;
	const dot01 = v0x * v1x + v0y * v1y;
	const dot02 = v0x * v2x + v0y * v2y;
	const dot11 = v1x * v1x + v1y * v1y;
	const dot12 = v1x * v2x + v1y * v2y;

	const denom = dot00 * dot11 - dot01 * dot01;
	if (Math.abs(denom) < 1e-6) return false;
	const inv = 1 / denom;
	const u = (dot11 * dot02 - dot01 * dot12) * inv;
	const v = (dot00 * dot12 - dot01 * dot02) * inv;
	return u >= 0 && v >= 0 && u + v <= 1;
}

interface ComputedPosition {
	x: number;
	y: number;
	side: HoverPeekCardSide;
	origin: string;
	bridge: {
		left: number;
		top: number;
		width: number;
		height: number;
	};
}

function computeCardPosition(
	triggerRect: DOMRect,
	cardWidth: number,
	cardHeight: number,
	preferredSide: HoverPeekCardSide,
	align: HoverPeekCardAlign,
	sideOffset: number,
	collisionPadding: number,
	zoom: number,
): ComputedPosition {
	const vw =
		window.visualViewport?.width ??
		document.documentElement.clientWidth ??
		window.innerWidth;
	const vh = window.visualViewport?.height ?? window.innerHeight;
	const pad = Math.max(4, collisionPadding);
	const scaledWidth = cardWidth * zoom;
	const scaledHeight = cardHeight * zoom;
	const scaledOffset = sideOffset * zoom;

	const space: Record<HoverPeekCardSide, number> = {
		top: triggerRect.top - pad,
		bottom: vh - triggerRect.bottom - pad,
		left: triggerRect.left - pad,
		right: vw - triggerRect.right - pad,
	};

	const needed = (s: HoverPeekCardSide) =>
		s === "top" || s === "bottom"
			? scaledHeight + scaledOffset
			: scaledWidth + scaledOffset;

	let side = preferredSide;
	if (space[side] < needed(side)) {
		const opposite = OPPOSITE_SIDE[side];
		if (space[opposite] >= needed(opposite) || space[opposite] > space[side]) {
			side = opposite;
		}
		// On narrow screens, if neither left nor right fits the card without overlapping the trigger, fall back to top/bottom.
		if ((side === "left" || side === "right") && space[side] < needed(side)) {
			side = space.bottom >= space.top ? "bottom" : "top";
		}
	}

	let x = 0;
	let y = 0;

	if (side === "top" || side === "bottom") {
		y =
			side === "top"
				? triggerRect.top - scaledHeight - scaledOffset
				: triggerRect.bottom + scaledOffset;

		if (align === "start") {
			x = triggerRect.left;
		} else if (align === "end") {
			x = triggerRect.right - scaledWidth;
		} else {
			x = triggerRect.left + triggerRect.width / 2 - scaledWidth / 2;
		}
	} else {
		x =
			side === "left"
				? triggerRect.left - scaledWidth - scaledOffset
				: triggerRect.right + scaledOffset;

		if (align === "start") {
			y = triggerRect.top;
		} else if (align === "end") {
			y = triggerRect.bottom - scaledHeight;
		} else {
			y = triggerRect.top + triggerRect.height / 2 - scaledHeight / 2;
		}
	}

	const maxX = Math.max(pad, vw - scaledWidth - pad);
	const maxY = Math.max(pad, vh - scaledHeight - pad);
	x = clamp(x, pad, maxX);
	y = clamp(y, pad, maxY);

	const triggerCenterX = triggerRect.left + triggerRect.width / 2;
	const triggerCenterY = triggerRect.top + triggerRect.height / 2;

	let originX = clamp(
		(triggerCenterX - x) / zoom,
		12,
		Math.max(12, cardWidth - 12),
	);
	let originY = clamp(
		(triggerCenterY - y) / zoom,
		12,
		Math.max(12, cardHeight - 12),
	);

	if (side === "top") originY = cardHeight;
	if (side === "bottom") originY = 0;
	if (side === "left") originX = cardWidth;
	if (side === "right") originX = 0;

	// Span only the exact gap between card and trigger so sibling triggers never get occluded.
	const gap = Math.max(sideOffset, 2);
	let bridge = { left: 0, top: 0, width: 0, height: 0 };
	if (side === "top") {
		bridge = {
			left: 0,
			top: cardHeight,
			width: cardWidth,
			height: gap,
		};
	} else if (side === "bottom") {
		bridge = {
			left: 0,
			top: -gap,
			width: cardWidth,
			height: gap,
		};
	} else if (side === "left") {
		bridge = {
			left: cardWidth,
			top: 0,
			width: gap,
			height: cardHeight,
		};
	} else {
		bridge = {
			left: -gap,
			top: 0,
			width: gap,
			height: cardHeight,
		};
	}

	return {
		x: x / zoom,
		y: y / zoom,
		side,
		origin: `${Math.round(originX)}px ${Math.round(originY)}px`,
		bridge,
	};
}

// ---------------------------------------------------------------------------
// Group Context (shared skip-delay & seamless handoff between sibling cards)
// ---------------------------------------------------------------------------

export interface HoverPeekCardGroupProps {
	/** Delay in ms before opening on pointer hover. Defaults to `260`. */
	openDelay?: number;
	/** Delay in ms before closing after the pointer leaves trigger and card. Defaults to `160`. */
	closeDelay?: number;
	/** Window in ms after one card closes during which sibling cards open instantly. Defaults to `350`. */
	skipDelayDuration?: number;
	/** Long-press duration in ms on touch devices. Defaults to `420`. */
	longPressDelay?: number;
	/** Default preferred side for cards in this group. Defaults to `"top"`. */
	side?: HoverPeekCardSide;
	/** Default alignment for cards in this group. Defaults to `"center"`. */
	align?: HoverPeekCardAlign;
	/** Default gap in px between trigger and card. Defaults to `10`. */
	sideOffset?: number;
	/** Default surface variant for cards in this group. Defaults to `"elevated"`. */
	variant?: HoverPeekCardVariant;
	/** Enable subtle pointer-driven tilt and surface sheen on fine pointers. Defaults to `true`. */
	interactiveTilt?: boolean;
	children?: ReactNode;
}

interface GroupContextValue {
	openDelay: number;
	closeDelay: number;
	skipDelayDuration: number;
	longPressDelay: number;
	side: HoverPeekCardSide;
	align: HoverPeekCardAlign;
	sideOffset: number;
	variant: HoverPeekCardVariant;
	interactiveTilt: boolean;
	shouldSkipDelay: () => boolean;
	claimActive: (
		id: string,
		triggerRect: DOMRect | null,
		closeFn: () => void,
	) => { dx: number; dy: number };
	releaseActive: (id: string) => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

/**
 * Coordinates sibling `HoverPeekCard` instances so gliding from one trigger to
 * another skips the initial hover delay and hands off cleanly without overlapping cards.
 */
export function HoverPeekCardGroup({
	openDelay = 260,
	closeDelay = 160,
	skipDelayDuration = 350,
	longPressDelay = 420,
	side = "top",
	align = "center",
	sideOffset = 10,
	variant = "elevated",
	interactiveTilt = true,
	children,
}: HoverPeekCardGroupProps) {
	const activeIdRef = useRef<string | null>(null);
	const activeCloseRef = useRef<(() => void) | null>(null);
	const lastRectRef = useRef<DOMRect | null>(null);
	const lastClosedAtRef = useRef<number>(Number.NEGATIVE_INFINITY);

	const shouldSkipDelay = useCallback(() => {
		if (activeIdRef.current !== null) return true;
		return performance.now() - lastClosedAtRef.current < skipDelayDuration;
	}, [skipDelayDuration]);

	const claimActive = useCallback(
		(id: string, triggerRect: DOMRect | null, closeFn: () => void) => {
			let dx = 0;
			let dy = 0;

			if (lastRectRef.current && triggerRect && activeIdRef.current !== id) {
				const prevX = lastRectRef.current.left + lastRectRef.current.width / 2;
				const prevY = lastRectRef.current.top + lastRectRef.current.height / 2;
				const nextX = triggerRect.left + triggerRect.width / 2;
				const nextY = triggerRect.top + triggerRect.height / 2;
				dx = Math.sign(nextX - prevX);
				dy = Math.sign(nextY - prevY);
			}

			if (activeIdRef.current && activeIdRef.current !== id) {
				activeCloseRef.current?.();
			}

			activeIdRef.current = id;
			activeCloseRef.current = closeFn;
			lastRectRef.current = triggerRect;

			return { dx, dy };
		},
		[],
	);

	const releaseActive = useCallback((id: string) => {
		if (activeIdRef.current === id) {
			activeIdRef.current = null;
			activeCloseRef.current = null;
			lastClosedAtRef.current = performance.now();
		}
	}, []);

	const value = useMemo<GroupContextValue>(
		() => ({
			openDelay,
			closeDelay,
			skipDelayDuration,
			longPressDelay,
			side,
			align,
			sideOffset,
			variant,
			interactiveTilt,
			shouldSkipDelay,
			claimActive,
			releaseActive,
		}),
		[
			openDelay,
			closeDelay,
			skipDelayDuration,
			longPressDelay,
			side,
			align,
			sideOffset,
			variant,
			interactiveTilt,
			shouldSkipDelay,
			claimActive,
			releaseActive,
		],
	);

	return (
		<GroupContext.Provider value={value}>{children}</GroupContext.Provider>
	);
}

// ---------------------------------------------------------------------------
// Root Context
// ---------------------------------------------------------------------------

export interface HoverPeekCardProps {
	/** Controlled open state. */
	open?: boolean;
	/** Initial open state for uncontrolled usage. Defaults to `false`. */
	defaultOpen?: boolean;
	/** Called whenever the peek card opens or closes. */
	onOpenChange?: (open: boolean) => void;
	/** Delay in ms before opening on pointer hover. Defaults to group value or `260`. */
	openDelay?: number;
	/** Delay in ms before closing after leaving trigger and card. Defaults to group value or `160`. */
	closeDelay?: number;
	/** Hold duration in ms on touch devices to lift the peek card. Defaults to group value or `420`. */
	longPressDelay?: number;
	/** Preferred placement side. Defaults to group value or `"top"`. */
	side?: HoverPeekCardSide;
	/** Alignment along the trigger edge. Defaults to group value or `"center"`. */
	align?: HoverPeekCardAlign;
	/** Distance in px between the trigger and the card. Defaults to group value or `10`. */
	sideOffset?: number;
	/** Surface visual style. Defaults to group value or `"elevated"`. */
	variant?: HoverPeekCardVariant;
	/** Subtle spring-smoothed tilt and light sheen on desktop hover. Defaults to group value or `true`. */
	interactiveTilt?: boolean;
	/** Prevents the peek card from opening on hover, focus, or long-press. Defaults to `false`. */
	disabled?: boolean;
	children?: ReactNode;
}

interface CardContextValue {
	cardId: string;
	contentId: string;
	titleId: string;
	hasTitle: boolean;
	registerTitle: () => () => void;
	open: boolean;
	openSource: OpenSource;
	isPressing: boolean;
	disabled: boolean;
	handoffVector: { dx: number; dy: number };
	side: HoverPeekCardSide;
	align: HoverPeekCardAlign;
	sideOffset: number;
	variant: HoverPeekCardVariant;
	interactiveTilt: boolean;
	triggerRef: RefObject<HTMLElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
	setOpenState: (next: boolean, source: OpenSource) => void;
	scheduleOpen: (source: OpenSource, immediate?: boolean) => void;
	scheduleClose: (exitPoint?: { x: number; y: number }) => void;
	cancelTimers: () => void;
	onTriggerPointerDown: (event: PointerEvent<HTMLElement>) => void;
	onTriggerPointerMove: (event: PointerEvent<HTMLElement>) => void;
	onTriggerPointerUpOrCancel: (event: PointerEvent<HTMLElement>) => void;
	onTriggerClickCapture: (event: MouseEvent<HTMLElement>) => void;
	onTriggerContextMenu: (event: MouseEvent<HTMLElement>) => void;
	onTriggerFocus: (event: FocusEvent<HTMLElement>) => void;
	onTriggerBlur: (event: FocusEvent<HTMLElement>) => void;
}

const CardContext = createContext<CardContextValue | null>(null);

function useHoverPeekCardContext(componentName: string) {
	const ctx = useContext(CardContext);
	if (!ctx) {
		throw new Error(`${componentName} must be used inside <HoverPeekCard>.`);
	}
	return ctx;
}

/**
 * Root controller for a hover and long-press rich preview card.
 */
export function HoverPeekCard({
	open: controlledOpen,
	defaultOpen = false,
	onOpenChange,
	openDelay: openDelayProp,
	closeDelay: closeDelayProp,
	longPressDelay: longPressDelayProp,
	side: sideProp,
	align: alignProp,
	sideOffset: sideOffsetProp,
	variant: variantProp,
	interactiveTilt: interactiveTiltProp,
	disabled = false,
	children,
}: HoverPeekCardProps) {
	const group = useContext(GroupContext);
	const cardId = useId();
	const contentId = `${cardId}-content`;
	const titleId = `${cardId}-title`;

	const openDelay = openDelayProp ?? group?.openDelay ?? 260;
	const closeDelay = closeDelayProp ?? group?.closeDelay ?? 160;
	const longPressDelay = longPressDelayProp ?? group?.longPressDelay ?? 420;
	const side = sideProp ?? group?.side ?? "top";
	const align = alignProp ?? group?.align ?? "center";
	const sideOffset = sideOffsetProp ?? group?.sideOffset ?? 10;
	const variant = variantProp ?? group?.variant ?? "elevated";
	const interactiveTilt = interactiveTiltProp ?? group?.interactiveTilt ?? true;

	const isControlled = controlledOpen !== undefined;
	const [uncontrolledOpen, setUncontrolledOpen] = useState(
		disabled ? false : defaultOpen,
	);
	const open = disabled
		? false
		: isControlled
			? controlledOpen
			: uncontrolledOpen;

	const [openSource, setOpenSource] = useState<OpenSource>(
		defaultOpen || controlledOpen ? "controlled" : "pointer",
	);
	const [isPressing, setIsPressing] = useState(false);
	const [hasTitle, setHasTitle] = useState(false);
	const [handoffVector, setHandoffVector] = useState({ dx: 0, dy: 0 });

	const triggerRef = useRef<HTMLElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const openTimerRef = useRef<number | null>(null);
	const closeTimerRef = useRef<number | null>(null);
	const longPressTimerRef = useRef<number | null>(null);
	const touchStartRef = useRef<{ id: number; x: number; y: number } | null>(
		null,
	);
	const suppressClickRef = useRef(false);
	const suppressFocusOpenRef = useRef(false);
	const lastKeyboardEventAtRef = useRef(Number.NEGATIVE_INFINITY);
	const safeCorridorCleanupRef = useRef<(() => void) | null>(null);

	const clearSafeCorridor = useCallback(() => {
		safeCorridorCleanupRef.current?.();
		safeCorridorCleanupRef.current = null;
	}, []);

	const cancelTimers = useCallback(() => {
		if (openTimerRef.current !== null) {
			window.clearTimeout(openTimerRef.current);
			openTimerRef.current = null;
		}
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		clearSafeCorridor();
	}, [clearSafeCorridor]);

	const cancelLongPress = useCallback(() => {
		if (longPressTimerRef.current !== null) {
			window.clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		touchStartRef.current = null;
		setIsPressing(false);
	}, []);

	const forceCloseFromGroup = useCallback(() => {
		cancelTimers();
		cancelLongPress();
		if (!isControlled) {
			setUncontrolledOpen(false);
		}
		onOpenChange?.(false);
	}, [cancelLongPress, cancelTimers, isControlled, onOpenChange]);

	const setOpenState = useCallback(
		(next: boolean, source: OpenSource) => {
			if (disabled && next) return;
			cancelTimers();
			if (next) {
				setOpenSource(source);
				if (group) {
					const rect = triggerRef.current?.getBoundingClientRect() ?? null;
					const vec = group.claimActive(cardId, rect, forceCloseFromGroup);
					setHandoffVector(vec);
				} else {
					setHandoffVector({ dx: 0, dy: 0 });
				}
			} else {
				group?.releaseActive(cardId);
				setHandoffVector({ dx: 0, dy: 0 });
			}

			if (!isControlled) {
				setUncontrolledOpen(next);
			}
			onOpenChange?.(next);
		},
		[
			cancelTimers,
			cardId,
			disabled,
			forceCloseFromGroup,
			group,
			isControlled,
			onOpenChange,
		],
	);

	const scheduleOpen = useCallback(
		(source: OpenSource, immediate = false) => {
			if (disabled) return;
			cancelTimers();
			const delay =
				immediate || source === "keyboard" || group?.shouldSkipDelay()
					? 0
					: openDelay;

			if (delay <= 0) {
				setOpenState(true, source);
			} else {
				openTimerRef.current = window.setTimeout(() => {
					openTimerRef.current = null;
					setOpenState(true, source);
				}, delay);
			}
		},
		[cancelTimers, disabled, group, openDelay, setOpenState],
	);

	const scheduleClose = useCallback(
		(exitPoint?: { x: number; y: number }) => {
			cancelTimers();

			// If pointer exited the trigger while the card is open, check whether
			// the pointer is traveling through the safe triangle toward the card.
			const cardEl = contentRef.current;
			if (exitPoint && cardEl && open) {
				const rect = cardEl.getBoundingClientRect();
				const pad = 16;
				const corners: Array<[number, number]> = [
					[rect.left - pad, rect.top - pad],
					[rect.right + pad, rect.top - pad],
					[rect.right + pad, rect.bottom + pad],
					[rect.left - pad, rect.bottom + pad],
				];

				const angles = corners.map(([cx, cy], index) => ({
					index,
					angle: Math.atan2(cy - exitPoint.y, cx - exitPoint.x),
					x: cx,
					y: cy,
				}));

				let bestA = angles[0];
				let bestB = angles[1];
				let maxSpread = -1;
				for (let i = 0; i < angles.length; i++) {
					for (let j = i + 1; j < angles.length; j++) {
						let diff = Math.abs(angles[i].angle - angles[j].angle);
						if (diff > Math.PI) diff = Math.PI * 2 - diff;
						if (diff > maxSpread) {
							maxSpread = diff;
							bestA = angles[i];
							bestB = angles[j];
						}
					}
				}

				const distToCard = (px: number, py: number) => {
					const dx = Math.max(rect.left - px, 0, px - rect.right);
					const dy = Math.max(rect.top - py, 0, py - rect.bottom);
					return Math.hypot(dx, dy);
				};
				let closestDist = distToCard(exitPoint.x, exitPoint.y);
				const corridorStartedAt = performance.now();

				const onMove = (ev: globalThis.PointerEvent) => {
					if (ev.pointerType !== "mouse") return;
					if (performance.now() - corridorStartedAt > 450) {
						clearSafeCorridor();
						return;
					}
					const insideCard =
						ev.clientX >= rect.left &&
						ev.clientX <= rect.right &&
						ev.clientY >= rect.top &&
						ev.clientY <= rect.bottom;
					if (insideCard) {
						cancelTimers();
						return;
					}
					const nextDist = distToCard(ev.clientX, ev.clientY);
					const inCorridor =
						nextDist < closestDist - 1.5 &&
						isPointInTriangle(
							ev.clientX,
							ev.clientY,
							exitPoint.x,
							exitPoint.y,
							bestA.x,
							bestA.y,
							bestB.x,
							bestB.y,
						);
					if (inCorridor) {
						closestDist = nextDist;
						if (closeTimerRef.current !== null) {
							window.clearTimeout(closeTimerRef.current);
						}
						closeTimerRef.current = window.setTimeout(
							() => {
								closeTimerRef.current = null;
								clearSafeCorridor();
								setOpenState(false, "pointer");
							},
							Math.max(closeDelay, 200),
						);
					}
				};

				window.addEventListener("pointermove", onMove, { passive: true });
				safeCorridorCleanupRef.current = () => {
					window.removeEventListener("pointermove", onMove);
				};
			}

			closeTimerRef.current = window.setTimeout(() => {
				closeTimerRef.current = null;
				clearSafeCorridor();
				setOpenState(false, "pointer");
			}, closeDelay);
		},
		[cancelTimers, clearSafeCorridor, closeDelay, open, setOpenState],
	);

	// Track keyboard modality so focus-visible opens immediately without waiting on mouse focus.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "Tab" ||
				event.key === "ArrowUp" ||
				event.key === "ArrowDown" ||
				event.key === "ArrowLeft" ||
				event.key === "ArrowRight" ||
				event.key === "Enter" ||
				event.key === " "
			) {
				lastKeyboardEventAtRef.current = performance.now();
			}
			if (event.key === "Escape" && open) {
				event.stopPropagation();
				suppressFocusOpenRef.current = true;
				setOpenState(false, "keyboard");
				triggerRef.current?.focus({ preventScroll: true });
				window.setTimeout(() => {
					suppressFocusOpenRef.current = false;
				}, 0);
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [open, setOpenState]);

	// Clean up timers and group claims on unmount or when disabled toggles on.
	useEffect(() => {
		if (disabled) {
			cancelTimers();
			cancelLongPress();
			group?.releaseActive(cardId);
		}
	}, [cancelLongPress, cancelTimers, cardId, disabled, group]);

	const latestUnmountRef = useRef({
		cancelTimers,
		cancelLongPress,
		group,
		cardId,
	});
	latestUnmountRef.current = { cancelTimers, cancelLongPress, group, cardId };

	useEffect(() => {
		return () => {
			const current = latestUnmountRef.current;
			current.cancelTimers();
			current.cancelLongPress();
			current.group?.releaseActive(current.cardId);
		};
	}, []);

	const onTriggerPointerDown = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			if (disabled) return;
			if (event.pointerType !== "touch") return;

			cancelLongPress();
			touchStartRef.current = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			};
			setIsPressing(true);

			longPressTimerRef.current = window.setTimeout(() => {
				longPressTimerRef.current = null;
				setIsPressing(false);
				suppressClickRef.current = true;
				setOpenState(true, "touch");
			}, longPressDelay);
		},
		[cancelLongPress, disabled, longPressDelay, setOpenState],
	);

	const onTriggerPointerMove = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			const start = touchStartRef.current;
			if (!start || event.pointerId !== start.id) return;
			const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
			if (dist > TOUCH_SLOP) {
				cancelLongPress();
			}
		},
		[cancelLongPress],
	);

	const onTriggerPointerUpOrCancel = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			const start = touchStartRef.current;
			if (!start || event.pointerId !== start.id) return;
			const wasCancelled = event.type === "pointercancel";
			const moved = Math.hypot(
				event.clientX - start.x,
				event.clientY - start.y,
			);
			const longPressFired = suppressClickRef.current;
			cancelLongPress();
			if (
				!wasCancelled &&
				!longPressFired &&
				moved <= TOUCH_SLOP &&
				!disabled
			) {
				const triggerEl = triggerRef.current;
				const isNavLink = Boolean(triggerEl?.closest("a[href]"));
				if (!isNavLink) {
					suppressClickRef.current = true;
					window.setTimeout(() => {
						suppressClickRef.current = false;
					}, 400);
					setOpenState(!open, "touch");
				}
			}
		},
		[cancelLongPress, disabled, open, setOpenState],
	);

	const onTriggerClickCapture = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			if (suppressClickRef.current) {
				suppressClickRef.current = false;
				event.preventDefault();
				event.stopPropagation();
			}
		},
		[],
	);

	const onTriggerContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
		if (touchStartRef.current || suppressClickRef.current) {
			event.preventDefault();
		}
	}, []);

	const onTriggerFocus = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			if (disabled) return;
			if (suppressFocusOpenRef.current) {
				suppressFocusOpenRef.current = false;
				return;
			}
			const target = event.currentTarget;
			let isFocusVisible = false;
			try {
				isFocusVisible = target.matches(":focus-visible");
			} catch {
				isFocusVisible = false;
			}
			const recentKeyboard =
				performance.now() - lastKeyboardEventAtRef.current < 500;
			if (isFocusVisible || recentKeyboard) {
				scheduleOpen("keyboard", true);
			}
		},
		[disabled, scheduleOpen],
	);

	const onTriggerBlur = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			const nextFocus = event.relatedTarget as Node | null;
			if (nextFocus && contentRef.current?.contains(nextFocus)) {
				cancelTimers();
				return;
			}
			if (open && openSource !== "touch") {
				scheduleClose();
			}
		},
		[cancelTimers, open, openSource, scheduleClose],
	);

	const registerTitle = useCallback(() => {
		setHasTitle(true);
		return () => setHasTitle(false);
	}, []);

	const value = useMemo<CardContextValue>(
		() => ({
			cardId,
			contentId,
			titleId,
			hasTitle,
			registerTitle,
			open,
			openSource,
			isPressing,
			disabled,
			handoffVector,
			side,
			align,
			sideOffset,
			variant,
			interactiveTilt,
			triggerRef,
			contentRef,
			setOpenState,
			scheduleOpen,
			scheduleClose,
			cancelTimers,
			onTriggerPointerDown,
			onTriggerPointerMove,
			onTriggerPointerUpOrCancel,
			onTriggerClickCapture,
			onTriggerContextMenu,
			onTriggerFocus,
			onTriggerBlur,
		}),
		[
			cardId,
			contentId,
			titleId,
			hasTitle,
			registerTitle,
			open,
			openSource,
			isPressing,
			disabled,
			handoffVector,
			side,
			align,
			sideOffset,
			variant,
			interactiveTilt,
			setOpenState,
			scheduleOpen,
			scheduleClose,
			cancelTimers,
			onTriggerPointerDown,
			onTriggerPointerMove,
			onTriggerPointerUpOrCancel,
			onTriggerClickCapture,
			onTriggerContextMenu,
			onTriggerFocus,
			onTriggerBlur,
		],
	);

	return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export interface HoverPeekCardTriggerProps extends HTMLAttributes<HTMLElement> {
	/** Merge props onto the single child element instead of rendering a wrapper button. */
	asChild?: boolean;
	children: ReactNode;
}

type TriggerChildProps = HTMLAttributes<HTMLElement> & {
	ref?: Ref<HTMLElement>;
	"data-slot"?: string;
	"data-state"?: string;
	"data-pressing"?: string;
};

/**
 * Interactive anchor element that lifts the peek card on hover, keyboard focus,
 * or touch long-press.
 */
export function HoverPeekCardTrigger({
	asChild = false,
	className,
	children,
	onPointerEnter,
	onPointerLeave,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onClickCapture,
	onContextMenu,
	onFocus,
	onBlur,
	...rest
}: HoverPeekCardTriggerProps) {
	const ctx = useHoverPeekCardContext("HoverPeekCardTrigger");

	const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
		onPointerEnter?.(event);
		if (event.pointerType === "touch") return;
		ctx.scheduleOpen("pointer");
	};

	const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
		onPointerLeave?.(event);
		if (event.pointerType === "touch") return;
		ctx.scheduleClose({ x: event.clientX, y: event.clientY });
	};

	const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
		onPointerDown?.(event);
		ctx.onTriggerPointerDown(event);
	};

	const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
		onPointerMove?.(event);
		ctx.onTriggerPointerMove(event);
	};

	const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
		onPointerUp?.(event);
		ctx.onTriggerPointerUpOrCancel(event);
	};

	const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
		onPointerCancel?.(event);
		ctx.onTriggerPointerUpOrCancel(event);
	};

	const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
		onClickCapture?.(event);
		ctx.onTriggerClickCapture(event);
	};

	const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
		onContextMenu?.(event);
		ctx.onTriggerContextMenu(event);
	};

	const handleFocus = (event: FocusEvent<HTMLElement>) => {
		onFocus?.(event);
		ctx.onTriggerFocus(event);
	};

	const handleBlur = (event: FocusEvent<HTMLElement>) => {
		onBlur?.(event);
		ctx.onTriggerBlur(event);
	};

	if (asChild) {
		const child = Children.only(children);
		if (!isValidElement<TriggerChildProps>(child)) {
			throw new Error(
				"HoverPeekCardTrigger with `asChild` expects a single valid React element.",
			);
		}
		const childProps = child.props;
		const existingRef = childProps.ref;

		return cloneElement(child, {
			...rest,
			ref: mergeRefs<HTMLElement>(ctx.triggerRef, existingRef),
			"data-slot": "hover-peek-card-trigger",
			"data-state": ctx.open ? "open" : "closed",
			"data-pressing": ctx.isPressing ? "true" : "false",
			"aria-expanded": ctx.disabled ? undefined : ctx.open,
			"aria-controls": ctx.open ? ctx.contentId : undefined,
			"aria-haspopup": ctx.disabled ? undefined : "dialog",
			className: cn(
				"select-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] data-[pressing=true]:scale-[0.98] motion-reduce:data-[pressing=true]:scale-100",
				className,
				childProps.className,
			),
			onPointerEnter: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerEnter?.(event);
				handlePointerEnter(event);
			},
			onPointerLeave: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerLeave?.(event);
				handlePointerLeave(event);
			},
			onPointerDown: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerDown?.(event);
				handlePointerDown(event);
			},
			onPointerMove: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerMove?.(event);
				handlePointerMove(event);
			},
			onPointerUp: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerUp?.(event);
				handlePointerUp(event);
			},
			onPointerCancel: (event: PointerEvent<HTMLElement>) => {
				childProps.onPointerCancel?.(event);
				handlePointerCancel(event);
			},
			onClickCapture: (event: MouseEvent<HTMLElement>) => {
				childProps.onClickCapture?.(event);
				handleClickCapture(event);
			},
			onContextMenu: (event: MouseEvent<HTMLElement>) => {
				childProps.onContextMenu?.(event);
				handleContextMenu(event);
			},
			onFocus: (event: FocusEvent<HTMLElement>) => {
				childProps.onFocus?.(event);
				handleFocus(event);
			},
			onBlur: (event: FocusEvent<HTMLElement>) => {
				childProps.onBlur?.(event);
				handleBlur(event);
			},
		});
	}

	return (
		<button
			ref={(node) => {
				ctx.triggerRef.current = node;
			}}
			type="button"
			data-slot="hover-peek-card-trigger"
			data-state={ctx.open ? "open" : "closed"}
			data-pressing={ctx.isPressing ? "true" : "false"}
			aria-expanded={ctx.disabled ? undefined : ctx.open}
			aria-controls={ctx.open ? ctx.contentId : undefined}
			aria-haspopup={ctx.disabled ? undefined : "dialog"}
			className={cn(
				"inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md font-medium text-foreground underline decoration-foreground/25 decoration-dashed underline-offset-4 outline-offset-2 transition-[color,text-decoration-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] hover:decoration-foreground/60 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid active:scale-[0.98] data-[pressing=true]:scale-[0.97] motion-reduce:data-[pressing=true]:scale-100 motion-reduce:active:scale-100",
				className,
			)}
			onPointerEnter={handlePointerEnter}
			onPointerLeave={handlePointerLeave}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onClickCapture={handleClickCapture}
			onContextMenu={handleContextMenu}
			onFocus={handleFocus}
			onBlur={handleBlur}
			{...rest}
		>
			{children}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface HoverPeekCardContentProps {
	/** Overrides the root `side` for this card. */
	side?: HoverPeekCardSide;
	/** Overrides the root `align` for this card. */
	align?: HoverPeekCardAlign;
	/** Overrides the root `sideOffset` in px. */
	sideOffset?: number;
	/** Minimum clearance in px from viewport edges. Defaults to `12`. */
	collisionPadding?: number;
	/** Visual surface treatment. Defaults to root value or `"elevated"`. */
	variant?: HoverPeekCardVariant;
	/** Accessible label when no `HoverPeekCardTitle` is rendered inside the card. */
	"aria-label"?: string;
	/** Additional classes applied to the card surface. */
	className?: string;
	children?: ReactNode;
}

const VARIANT_CLASSES: Record<HoverPeekCardVariant, string> = {
	elevated:
		"bg-popover text-popover-foreground ring-1 ring-foreground/[0.08] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.18),0_4px_12px_-2px_rgba(0,0,0,0.06)] dark:ring-foreground/[0.13] dark:shadow-[0_22px_48px_-14px_rgba(0,0,0,0.65),0_4px_14px_-2px_rgba(0,0,0,0.4)]",
	glass:
		"bg-popover/80 text-popover-foreground backdrop-blur-xl backdrop-saturate-150 ring-1 ring-foreground/[0.1] shadow-[0_20px_44px_-14px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-popover/74 dark:ring-white/[0.13] dark:shadow-[0_24px_52px_-14px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)] [@media(prefers-reduced-transparency:reduce)]:bg-popover [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
	minimal:
		"bg-card text-card-foreground border border-border shadow-[0_10px_28px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_14px_32px_-10px_rgba(0,0,0,0.5)]",
};

/**
 * Portaled floating preview card with origin-aware spring elevation,
 * viewport collision flipping, safe hover bridge, and optional pointer sheen.
 */
export function HoverPeekCardContent({
	side: sideProp,
	align: alignProp,
	sideOffset: sideOffsetProp,
	collisionPadding = VIEWPORT_PADDING,
	variant: variantProp,
	"aria-label": ariaLabel,
	className,
	children,
}: HoverPeekCardContentProps) {
	const ctx = useHoverPeekCardContext("HoverPeekCardContent");
	const shouldReduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);
	const [position, setPosition] = useState<ComputedPosition | null>(null);
	const [cardZoom, setCardZoom] = useState(1);

	const preferredSide = sideProp ?? ctx.side;
	const align = alignProp ?? ctx.align;
	const sideOffset = sideOffsetProp ?? ctx.sideOffset;
	const variant = variantProp ?? ctx.variant;

	// Spring-driven micro-tilt & specular sheen (desktop fine pointer only)
	const rawRotateX = useMotionValue(0);
	const rawRotateY = useMotionValue(0);
	const sheenX = useMotionValue(50);
	const sheenY = useMotionValue(0);
	const sheenOpacity = useMotionValue(0);

	const rotateX = useSpring(rawRotateX, TILT_SPRING);
	const rotateY = useSpring(rawRotateY, TILT_SPRING);
	const sheenAlpha = useSpring(sheenOpacity, { stiffness: 220, damping: 28 });

	const sheenBackground = useMotionTemplate`radial-gradient(240px circle at ${sheenX}% ${sheenY}%, color-mix(in oklab, var(--foreground) 7%, transparent), transparent 70%)`;

	useEffect(() => {
		setMounted(true);
	}, []);

	const updatePosition = useCallback(() => {
		const trigger = ctx.triggerRef.current;
		const card = ctx.contentRef.current;
		if (!trigger || !card) return;

		const zoom = getEffectiveZoom(trigger);
		setCardZoom(zoom);

		const triggerRect = trigger.getBoundingClientRect();
		const width = card.offsetWidth;
		const height = card.offsetHeight;
		if (width === 0 || height === 0) return;

		const next = computeCardPosition(
			triggerRect,
			width,
			height,
			preferredSide,
			align,
			sideOffset,
			collisionPadding,
			zoom,
		);
		setPosition(next);
	}, [
		align,
		collisionPadding,
		ctx.contentRef,
		ctx.triggerRef,
		preferredSide,
		sideOffset,
	]);

	useLayoutEffect(() => {
		if (!mounted || !ctx.open) return;
		updatePosition();

		const card = ctx.contentRef.current;
		const ro =
			typeof ResizeObserver !== "undefined" && card
				? new ResizeObserver(() => updatePosition())
				: null;
		if (card && ro) ro.observe(card);

		const onViewportChange = () => updatePosition();
		window.addEventListener("scroll", onViewportChange, {
			capture: true,
			passive: true,
		});
		window.addEventListener("resize", onViewportChange, { passive: true });
		window.visualViewport?.addEventListener("resize", onViewportChange, {
			passive: true,
		});

		return () => {
			ro?.disconnect();
			window.removeEventListener("scroll", onViewportChange, true);
			window.removeEventListener("resize", onViewportChange);
			window.visualViewport?.removeEventListener("resize", onViewportChange);
		};
	}, [ctx.contentRef, ctx.open, mounted, updatePosition]);

	// Reset tilt when closed.
	useEffect(() => {
		if (!ctx.open) {
			rawRotateX.set(0);
			rawRotateY.set(0);
			sheenOpacity.set(0);
		}
	}, [ctx.open, rawRotateX, rawRotateY, sheenOpacity]);

	const handleCardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (
			!ctx.interactiveTilt ||
			shouldReduceMotion ||
			event.pointerType !== "mouse"
		) {
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
		const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
		rawRotateY.set((nx - 0.5) * 2 * MAX_TILT_DEG);
		rawRotateX.set((0.5 - ny) * 2 * MAX_TILT_DEG);
		sheenX.set(nx * 100);
		sheenY.set(ny * 100);
		sheenOpacity.set(1);
	};

	const handleCardPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
		rawRotateX.set(0);
		rawRotateY.set(0);
		sheenOpacity.set(0);
		if (event.pointerType === "touch") return;
		ctx.scheduleClose();
	};

	const handleCardPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "touch") return;
		ctx.cancelTimers();
	};

	const handleCardFocus = () => {
		ctx.cancelTimers();
	};

	const handleCardBlur = (event: FocusEvent<HTMLDivElement>) => {
		const nextFocus = event.relatedTarget as Node | null;
		if (
			nextFocus &&
			(ctx.contentRef.current?.contains(nextFocus) ||
				ctx.triggerRef.current?.contains(nextFocus))
		) {
			return;
		}
		if (ctx.open && ctx.openSource !== "touch") {
			ctx.scheduleClose();
		}
	};

	if (!mounted) return null;

	const activeSide = position?.side ?? preferredSide;
	const instant = Boolean(shouldReduceMotion) || ctx.openSource === "keyboard";

	const enterAxisOffset = (() => {
		if (instant) return { x: 0, y: 0 };
		const handoffNudgeX = ctx.handoffVector.dx * 4;
		const handoffNudgeY = ctx.handoffVector.dy * 4;
		if (activeSide === "top") {
			return { x: handoffNudgeX, y: ENTER_OFFSET + handoffNudgeY * 0.4 };
		}
		if (activeSide === "bottom") {
			return { x: handoffNudgeX, y: -ENTER_OFFSET + handoffNudgeY * 0.4 };
		}
		if (activeSide === "left") {
			return { x: ENTER_OFFSET + handoffNudgeX * 0.4, y: handoffNudgeY };
		}
		return { x: -ENTER_OFFSET + handoffNudgeX * 0.4, y: handoffNudgeY };
	})();

	const exitAxisOffset = (() => {
		if (shouldReduceMotion) return { x: 0, y: 0 };
		if (activeSide === "top") return { x: 0, y: EXIT_OFFSET };
		if (activeSide === "bottom") return { x: 0, y: -EXIT_OFFSET };
		if (activeSide === "left") return { x: EXIT_OFFSET, y: 0 };
		return { x: -EXIT_OFFSET, y: 0 };
	})();

	const isTouchOpen = ctx.open && ctx.openSource === "touch";

	return createPortal(
		<LazyMotion features={domAnimation}>
			<AnimatePresence>
				{isTouchOpen ? (
					<m.div
						key={`${ctx.cardId}-scrim`}
						data-slot="hover-peek-card-scrim"
						aria-hidden="true"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.16, ease: EASE_OUT }}
						className="fixed inset-0 z-40 bg-foreground/[0.06] backdrop-blur-[1px] [-webkit-tap-highlight-color:transparent] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
						onPointerDown={(event) => {
							event.stopPropagation();
							ctx.setOpenState(false, "touch");
						}}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence onExitComplete={() => setPosition(null)}>
				{ctx.open ? (
					<m.div
						key={`${ctx.cardId}-portal`}
						initial={{ opacity: 1 }}
						animate={{ opacity: 1 }}
						exit={{
							opacity: 0,
							pointerEvents: "none",
							transition: {
								duration:
									ctx.openSource === "keyboard"
										? 0
										: shouldReduceMotion
											? 0.1
											: 0.13,
								ease: EASE_OUT,
							},
						}}
						style={{
							position: "fixed",
							left: position ? Math.round(position.x) : -9999,
							top: position ? Math.round(position.y) : -9999,
							zIndex: 50,
							perspective: 900,
							visibility: position ? "visible" : "hidden",
							zoom: cardZoom !== 1 ? cardZoom : undefined,
						}}
					>
						{/* Invisible bridge spanning the gap between trigger and card */}
						{position ? (
							<div
								aria-hidden="true"
								data-slot="hover-peek-card-bridge"
								onPointerEnter={handleCardPointerEnter}
								onPointerLeave={handleCardPointerLeave}
								style={{
									position: "absolute",
									left: position.bridge.left,
									top: position.bridge.top,
									width: position.bridge.width,
									height: position.bridge.height,
									pointerEvents: "auto",
								}}
							/>
						) : null}

						<m.div
							ref={ctx.contentRef}
							id={ctx.contentId}
							role="dialog"
							aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
							aria-label={
								!ctx.hasTitle ? (ariaLabel ?? "Preview card") : undefined
							}
							data-slot="hover-peek-card-content"
							data-state="open"
							data-side={activeSide}
							data-variant={variant}
							initial={
								instant
									? {
											opacity: shouldReduceMotion ? 0 : 1,
											x: 0,
											y: 0,
											scale: 1,
										}
									: {
											opacity: 0,
											scale: 0.94,
											x: enterAxisOffset.x,
											y: enterAxisOffset.y,
											filter: "blur(3px)",
										}
							}
							animate={{
								opacity: 1,
								scale: 1,
								x: 0,
								y: 0,
								filter: "blur(0px)",
							}}
							exit={
								ctx.openSource === "keyboard"
									? { opacity: 0, transition: { duration: 0 } }
									: shouldReduceMotion
										? { opacity: 0, transition: { duration: 0.1 } }
										: {
												opacity: 0,
												scale: 0.96,
												x: exitAxisOffset.x,
												y: exitAxisOffset.y,
												filter: "blur(2px)",
												transition: { duration: 0.13, ease: EASE_OUT },
											}
							}
							transition={
								instant
									? { duration: shouldReduceMotion ? 0.11 : 0 }
									: ENTER_SPRING
							}
							style={{
								transformOrigin: position?.origin ?? "50% 100%",
								rotateX:
									ctx.interactiveTilt && !shouldReduceMotion ? rotateX : 0,
								rotateY:
									ctx.interactiveTilt && !shouldReduceMotion ? rotateY : 0,
							}}
							onPointerEnter={handleCardPointerEnter}
							onPointerMove={handleCardPointerMove}
							onPointerLeave={handleCardPointerLeave}
							onFocus={handleCardFocus}
							onBlur={handleCardBlur}
							className={cn(
								"relative max-h-[calc(100dvh-24px)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-2xl will-change-transform",
								VARIANT_CLASSES[variant],
								className,
							)}
						>
							{ctx.interactiveTilt && !shouldReduceMotion ? (
								<m.div
									aria-hidden="true"
									data-slot="hover-peek-card-sheen"
									className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
									style={{
										background: sheenBackground,
										opacity: sheenAlpha,
									}}
								/>
							) : null}
							{children}
						</m.div>
					</m.div>
				) : null}
			</AnimatePresence>
		</LazyMotion>,
		document.body,
	);
}

// ---------------------------------------------------------------------------
// Composable Card Sub-Slots
// ---------------------------------------------------------------------------

export interface HoverPeekCardMediaProps
	extends HTMLAttributes<HTMLDivElement> {
	/** Optional image URL to render inside the media frame. */
	src?: string;
	/** Accessible alt text when `src` is provided. */
	alt?: string;
	/** Aspect ratio utility preset. Defaults to `"16/9"`. */
	aspect?: "16/9" | "2/1" | "4/3" | "auto";
	/** Optional badge or caption overlaid cleanly in the media frame. */
	overlay?: ReactNode;
}

const ASPECT_CLASSES: Record<
	NonNullable<HoverPeekCardMediaProps["aspect"]>,
	string
> = {
	"16/9": "aspect-video",
	"2/1": "aspect-[2/1]",
	"4/3": "aspect-[4/3]",
	auto: "",
};

/**
 * Framed media slot for images, diagrams, or miniature UI previews at the top of a peek card.
 */
export function HoverPeekCardMedia({
	src,
	alt = "",
	aspect = "16/9",
	overlay,
	className,
	children,
	...rest
}: HoverPeekCardMediaProps) {
	return (
		<div
			data-slot="hover-peek-card-media"
			className={cn("p-1.5 pb-0", className)}
			{...rest}
		>
			<div
				className={cn(
					"relative overflow-hidden rounded-[11px] bg-muted ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]",
					ASPECT_CLASSES[aspect],
				)}
			>
				{src ? (
					/* biome-ignore lint/performance/noImgElement: standalone registry component should not require next/image */
					<img
						src={src}
						alt={alt}
						className="size-full object-cover"
						loading="eager"
					/>
				) : (
					children
				)}
				{overlay ? (
					<div className="pointer-events-none absolute inset-x-0 bottom-0 p-2">
						{overlay}
					</div>
				) : null}
			</div>
		</div>
	);
}

export interface HoverPeekCardHeaderProps
	extends HTMLAttributes<HTMLDivElement> {}

/**
 * Body padding container for the peek card's title, description, and metadata.
 */
export function HoverPeekCardHeader({
	className,
	...rest
}: HoverPeekCardHeaderProps) {
	return (
		<div
			data-slot="hover-peek-card-header"
			className={cn("flex flex-col gap-1 px-3.5 pt-3 pb-3", className)}
			{...rest}
		/>
	);
}

export interface HoverPeekCardTitleProps
	extends HTMLAttributes<HTMLHeadingElement> {}

/**
 * Primary heading for the peek card. Automatically wires `aria-labelledby` on the card dialog.
 */
export function HoverPeekCardTitle({
	className,
	...rest
}: HoverPeekCardTitleProps) {
	const { registerTitle, titleId } =
		useHoverPeekCardContext("HoverPeekCardTitle");

	useEffect(() => registerTitle(), [registerTitle]);

	return (
		<h4
			id={titleId}
			data-slot="hover-peek-card-title"
			className={cn(
				"truncate font-medium text-[14px] text-foreground leading-5 tracking-[-0.015em]",
				className,
			)}
			{...rest}
		/>
	);
}

export interface HoverPeekCardDescriptionProps
	extends HTMLAttributes<HTMLParagraphElement> {}

/**
 * Concise summary text inside the peek card.
 */
export function HoverPeekCardDescription({
	className,
	...rest
}: HoverPeekCardDescriptionProps) {
	return (
		<p
			data-slot="hover-peek-card-description"
			className={cn(
				"line-clamp-3 text-[12.5px] text-muted-foreground leading-[1.45]",
				className,
			)}
			{...rest}
		/>
	);
}

export interface HoverPeekCardMetaProps
	extends HTMLAttributes<HTMLDivElement> {}

/**
 * Compact horizontal row for stats, status pills, or timestamps with `tabular-nums`.
 */
export function HoverPeekCardMeta({
	className,
	...rest
}: HoverPeekCardMetaProps) {
	return (
		<div
			data-slot="hover-peek-card-meta"
			className={cn(
				"mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground tabular-nums",
				className,
			)}
			{...rest}
		/>
	);
}

export interface HoverPeekCardFooterProps
	extends HTMLAttributes<HTMLDivElement> {}

/**
 * Subtle hairline footer bar for secondary context or interactive quick actions.
 */
export function HoverPeekCardFooter({
	className,
	...rest
}: HoverPeekCardFooterProps) {
	return (
		<div
			data-slot="hover-peek-card-footer"
			className={cn(
				"flex items-center justify-between gap-2 border-border/70 border-t bg-muted/35 px-3.5 py-2 text-[11.5px] text-muted-foreground",
				className,
			)}
			{...rest}
		/>
	);
}
