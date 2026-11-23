"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	AnimatePresence,
	animate,
	MotionConfig,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

export type PaginationRailSize = "sm" | "md" | "lg";
export type PaginationRailVariant = "pill" | "surface" | "ghost";
export type PaginationRailPeekSide = "top" | "bottom";

export interface PaginationRailPeekRenderState {
	/** 1-indexed page number being previewed. */
	page: number;
	/** Total number of pages in the rail. */
	totalPages: number;
	/** Currently active 1-indexed page number. */
	currentPage: number;
	/** Whether the previewed page is currently active. */
	isCurrent: boolean;
	/** Position of the previewed page relative to the active page. */
	direction: "previous" | "current" | "next";
}

export interface PaginationRailClassNames {
	/** Outer `<nav>` container. */
	root?: string;
	/** Recessed or hairline rail wrapping controls and page slots. */
	rail?: string;
	/** Sliding current-page capsule pill. */
	pill?: string;
	/** Subtle pointer hover indicator inside the track. */
	hoverPill?: string;
	/** Individual page number button. */
	pageButton?: string;
	/** Previous and Next arrow buttons. */
	navButton?: string;
	/** Collapsed-range edge peek trigger button. */
	peekTrigger?: string;
	/** Floating peek tray listing collapsed hidden pages. */
	peekTray?: string;
	/** Floating preview card rendered when `renderPagePeek` is provided. */
	peekCard?: string;
}

export interface PaginationRailProps
	extends Omit<ComponentProps<"nav">, "children" | "onChange"> {
	/** Total number of pages (clamped to a minimum of `1`). */
	totalPages: number;
	/** Controlled 1-indexed active page. */
	page?: number;
	/** Initial 1-indexed active page when uncontrolled. Defaults to `1`. */
	defaultPage?: number;
	/** Called whenever the active page changes. */
	onPageChange?: (page: number) => void;
	/** Number of visible sibling pages on each side of the current page. Defaults to `1`. */
	siblingCount?: number;
	/** Number of pages pinned at the start and end of the rail. Defaults to `1`. */
	boundaryCount?: number;
	/** Maximum number of hidden pages shown at once inside a peek tray. Defaults to `5`. */
	peekCount?: number;
	/** Visual treatment of the rail and sliding pill. Defaults to `"pill"`. */
	variant?: PaginationRailVariant;
	/** Height and typography scale. Defaults to `"md"`. */
	size?: PaginationRailSize;
	/** Show Previous and Next arrow buttons. Defaults to `true`. */
	showControls?: boolean;
	/** Show interactive edge-masked peek slots and floating peek trays for collapsed ranges. Defaults to `true`. */
	showPeek?: boolean;
	/** Side of the rail where floating peek trays and preview cards appear. Defaults to `"top"`. */
	peekSide?: PaginationRailPeekSide;
	/** Allow dragging horizontally across the rail to scrub between visible pages. Defaults to `true`. */
	scrubbable?: boolean;
	/** Optional preview content shown in a floating card when hovering or focusing a page. */
	renderPagePeek?: (state: PaginationRailPeekRenderState) => ReactNode;
	/** Custom accessible label for each page button. */
	getPageAriaLabel?: (page: number, isCurrent: boolean) => string;
	/** Disable all navigation, peeking, and scrubbing interactions. Defaults to `false`. */
	disabled?: boolean;
	/** Accessible name for the `<nav>` landmark. Defaults to `"Pagination"`. */
	"aria-label"?: string;
	/** Granular class name overrides for internal slots. */
	classNames?: PaginationRailClassNames;
}

type PeekRangeId = "start" | "end";

type PaginationItem =
	| { type: "page"; page: number }
	| { type: "peek"; id: PeekRangeId; pages: number[] };

interface HoverTarget {
	key: string;
	page: number | null;
	centerX: number;
}

interface ScrubSession {
	pointerId: number;
	startX: number;
	startY: number;
	mode: "pending" | "scrubbing" | "cancelled";
	lastPage: number;
}

// Critically damped spring (~1.0 damping ratio): crisp arrival, zero overshoot.
const PILL_SPRING = {
	type: "spring",
	stiffness: 480,
	damping: 42,
	mass: 0.9,
} as const;

const HOVER_SPRING = {
	type: "spring",
	stiffness: 540,
	damping: 42,
	mass: 0.8,
} as const;

const POPOVER_EASE = [0.23, 1, 0.32, 1] as const;

const PEEK_OPEN_DELAY = 140;
const PEEK_CLOSE_DELAY = 180;
const SCRUB_THRESHOLD_PX = 7;
const VIEWPORT_MARGIN_PX = 12;

const SIZE_STYLES: Record<
	PaginationRailSize,
	{
		rail: string;
		button: string;
		nav: string;
		icon: string;
		peek: string;
		peekNumber: string;
		trayButton: string;
	}
> = {
	sm: {
		rail: "p-0.5 gap-0.5",
		button: "h-7 min-w-7 px-2 text-xs",
		nav: "size-7",
		icon: "size-3.5",
		peek: "h-7 min-w-8 px-1.5",
		peekNumber: "text-[11px]",
		trayButton: "h-7 min-w-7 px-2 text-xs",
	},
	md: {
		rail: "p-1 gap-0.5",
		button: "h-8 min-w-8 px-2.5 text-[13px]",
		nav: "size-8",
		icon: "size-4",
		peek: "h-8 min-w-9 px-1.5",
		peekNumber: "text-xs",
		trayButton: "h-7 min-w-7 px-2 text-xs",
	},
	lg: {
		rail: "p-1 gap-1",
		button: "h-9 min-w-9 px-3 text-sm",
		nav: "size-9",
		icon: "size-4",
		peek: "h-9 min-w-10 px-2",
		peekNumber: "text-xs",
		trayButton: "h-8 min-w-8 px-2.5 text-[13px]",
	},
};

function clampPage(value: number, totalPages: number): number {
	const safeTotal = Math.max(1, Math.floor(totalPages));
	if (!Number.isFinite(value)) return 1;
	return Math.min(safeTotal, Math.max(1, Math.floor(value)));
}

function range(start: number, end: number): number[] {
	const result: number[] = [];
	for (let i = start; i <= end; i += 1) {
		result.push(i);
	}
	return result;
}

/**
 * Computes a constant-slot pagination layout so the rail keeps a steady width
 * as the active page moves from `1` through `totalPages`.
 */
function buildPaginationItems(
	currentPage: number,
	totalPages: number,
	siblingCount: number,
	boundaryCount: number,
): PaginationItem[] {
	const safeTotal = Math.max(1, Math.floor(totalPages));
	const safeSibling = Math.max(0, Math.floor(siblingCount));
	const safeBoundary = Math.max(1, Math.floor(boundaryCount));

	const totalSlots = safeBoundary * 2 + safeSibling * 2 + 3;

	if (safeTotal <= totalSlots) {
		return range(1, safeTotal).map((page) => ({ type: "page", page }));
	}

	const leftSibling = Math.max(currentPage - safeSibling, safeBoundary + 1);
	const rightSibling = Math.min(
		currentPage + safeSibling,
		safeTotal - safeBoundary,
	);

	// Never collapse a single page behind a peek trigger.
	const showStartPeek = leftSibling > safeBoundary + 2;
	const showEndPeek = rightSibling < safeTotal - safeBoundary - 1;

	const items: PaginationItem[] = [];

	if (!showStartPeek && showEndPeek) {
		const leftItemCount = totalSlots - safeBoundary - 1;
		for (const p of range(1, leftItemCount)) {
			items.push({ type: "page", page: p });
		}
		items.push({
			type: "peek",
			id: "end",
			pages: range(leftItemCount + 1, safeTotal - safeBoundary),
		});
		for (const p of range(safeTotal - safeBoundary + 1, safeTotal)) {
			items.push({ type: "page", page: p });
		}
		return items;
	}

	if (showStartPeek && !showEndPeek) {
		const rightItemCount = totalSlots - safeBoundary - 1;
		const rightStart = safeTotal - rightItemCount + 1;
		for (const p of range(1, safeBoundary)) {
			items.push({ type: "page", page: p });
		}
		items.push({
			type: "peek",
			id: "start",
			pages: range(safeBoundary + 1, rightStart - 1),
		});
		for (const p of range(rightStart, safeTotal)) {
			items.push({ type: "page", page: p });
		}
		return items;
	}

	for (const p of range(1, safeBoundary)) {
		items.push({ type: "page", page: p });
	}
	if (showStartPeek) {
		items.push({
			type: "peek",
			id: "start",
			pages: range(safeBoundary + 1, leftSibling - 1),
		});
	} else {
		for (const p of range(safeBoundary + 1, leftSibling - 1)) {
			items.push({ type: "page", page: p });
		}
	}
	for (const p of range(leftSibling, rightSibling)) {
		items.push({ type: "page", page: p });
	}
	if (showEndPeek) {
		items.push({
			type: "peek",
			id: "end",
			pages: range(rightSibling + 1, safeTotal - safeBoundary),
		});
	} else {
		for (const p of range(rightSibling + 1, safeTotal - safeBoundary)) {
			items.push({ type: "page", page: p });
		}
	}
	for (const p of range(safeTotal - safeBoundary + 1, safeTotal)) {
		items.push({ type: "page", page: p });
	}

	return items;
}

function getPeekSlotNumbers(id: PeekRangeId, pages: number[]): number[] {
	if (pages.length === 0) return [];
	const candidates = id === "end" ? pages.slice(0, 2) : pages.slice(-2);
	// Keep 3+ digit peek slots compact so the rail stays comfortably within 390px.
	if (
		candidates.length === 2 &&
		(candidates[0] >= 100 || candidates[1] >= 100)
	) {
		return id === "end" ? [candidates[0]] : [candidates[1]];
	}
	return candidates;
}

export function PaginationRail({
	totalPages,
	page,
	defaultPage = 1,
	onPageChange,
	siblingCount = 1,
	boundaryCount = 1,
	peekCount = 5,
	variant = "pill",
	size = "md",
	showControls = true,
	showPeek = true,
	peekSide = "top",
	scrubbable = true,
	renderPagePeek,
	getPageAriaLabel,
	disabled = false,
	"aria-label": ariaLabel = "Pagination",
	className,
	classNames,
	onKeyDown,
	...props
}: PaginationRailProps) {
	const safeTotal = Math.max(1, Math.floor(totalPages));
	const safePeekCount = Math.max(1, Math.floor(peekCount));
	const shouldReduceMotion = useReducedMotion() ?? false;
	const instanceId = useId();

	const [internalPage, setInternalPage] = useState(() =>
		clampPage(defaultPage, safeTotal),
	);
	const isControlled = page !== undefined;
	const activePage = clampPage(isControlled ? page : internalPage, safeTotal);

	// Keep uncontrolled state clamped if `totalPages` shrinks.
	useEffect(() => {
		if (!isControlled) {
			setInternalPage((prev) => {
				const clamped = clampPage(prev, safeTotal);
				return clamped === prev ? prev : clamped;
			});
		}
	}, [isControlled, safeTotal]);

	const items = useMemo(
		() =>
			buildPaginationItems(activePage, safeTotal, siblingCount, boundaryCount),
		[activePage, safeTotal, siblingCount, boundaryCount],
	);

	// DOM refs for measurement, focus management, and viewport clamping.
	const rootRef = useRef<HTMLElement | null>(null);
	const trackRef = useRef<HTMLDivElement | null>(null);
	const pageButtonRefs = useRef(new Map<number, HTMLButtonElement>());
	const peekTriggerRefs = useRef(new Map<PeekRangeId, HTMLButtonElement>());
	const navButtonRefs = useRef<{
		prev: HTMLButtonElement | null;
		next: HTMLButtonElement | null;
	}>({ prev: null, next: null });
	const trayRef = useRef<HTMLDivElement | null>(null);
	const cardRef = useRef<HTMLDivElement | null>(null);

	// Sliding active pill MotionValues (in track-local px).
	const pillX = useMotionValue(0);
	const pillWidth = useMotionValue(0);
	const trackWidthMv = useMotionValue(0);
	const [pillVisible, setPillVisible] = useState(false);
	const hasMeasuredPillRef = useRef(false);
	const suppressNextSpringRef = useRef(false);

	// Hover indicator MotionValues (fine pointer only).
	const hoverX = useMotionValue(0);
	const hoverWidth = useMotionValue(0);
	const hoverOpacity = useMotionValue(0);
	const hoverVisibleRef = useRef(false);

	// Open peek tray state.
	const [openPeekId, setOpenPeekId] = useState<PeekRangeId | null>(null);
	const [peekPageOffset, setPeekPageOffset] = useState(0);
	const [peekTrayHoveredPage, setPeekTrayHoveredPage] = useState<number | null>(
		null,
	);
	const [trayShiftX, setTrayShiftX] = useState(0);
	const [trayAnchorX, setTrayAnchorX] = useState(0);
	const peekOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const peekCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Floating page peek card state (used when `renderPagePeek` is provided).
	const [cardTarget, setCardTarget] = useState<HoverTarget | null>(null);
	const [cardShiftX, setCardShiftX] = useState(0);
	const cardX = useMotionValue(0);
	const cardHasShownRef = useRef(false);

	// Scrubbing state.
	const scrubRef = useRef<ScrubSession | null>(null);
	const suppressClickRef = useRef(false);
	const [isScrubbing, setIsScrubbing] = useState(false);
	const [scrubPreviewPage, setScrubPreviewPage] = useState<number | null>(null);

	// Live region announcement.
	const [announcement, setAnnouncement] = useState("");
	const lastAnnouncedPageRef = useRef(activePage);

	// Displayed active page reflects live scrubbing preview before commit.
	const displayedPage = scrubPreviewPage ?? activePage;

	const pillRadius = variant === "surface" ? "8px" : "9999px";
	const clipPath = useMotionTemplate`inset(0px max(0px, calc(${trackWidthMv}px - ${pillX}px - ${pillWidth}px)) 0px max(0px, ${pillX}px) round ${pillRadius})`;

	const clearPeekTimers = useCallback(() => {
		if (peekOpenTimerRef.current) {
			clearTimeout(peekOpenTimerRef.current);
			peekOpenTimerRef.current = null;
		}
		if (peekCloseTimerRef.current) {
			clearTimeout(peekCloseTimerRef.current);
			peekCloseTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			clearPeekTimers();
		};
	}, [clearPeekTimers]);

	const selectPage = useCallback(
		(nextPage: number, options?: { instant?: boolean }) => {
			if (disabled) return;
			const clamped = clampPage(nextPage, safeTotal);
			if (options?.instant) {
				suppressNextSpringRef.current = true;
			}
			if (!isControlled) {
				setInternalPage(clamped);
			}
			if (clamped !== activePage) {
				onPageChange?.(clamped);
			}
		},
		[disabled, safeTotal, isControlled, activePage, onPageChange],
	);

	// Announce committed page changes politely for screen readers.
	useEffect(() => {
		if (activePage !== lastAnnouncedPageRef.current) {
			lastAnnouncedPageRef.current = activePage;
			setAnnouncement(`Page ${activePage} of ${safeTotal}`);
		}
	}, [activePage, safeTotal]);

	// Measure and animate the active pill to the displayed page button.
	const syncPillToPage = useCallback(
		(targetPage: number, instant: boolean) => {
			const trackEl = trackRef.current;
			const btnEl = pageButtonRefs.current.get(targetPage);
			if (!trackEl || !btnEl) return;

			const nextTrackWidth = trackEl.offsetWidth;
			const nextLeft = btnEl.offsetLeft;
			const nextWidth = btnEl.offsetWidth;

			trackWidthMv.set(nextTrackWidth);

			if (instant || !hasMeasuredPillRef.current || shouldReduceMotion) {
				pillX.stop();
				pillWidth.stop();
				pillX.set(nextLeft);
				pillWidth.set(nextWidth);
				hasMeasuredPillRef.current = true;
				if (!pillVisible) setPillVisible(true);
				return;
			}

			animate(pillX, nextLeft, PILL_SPRING);
			animate(pillWidth, nextWidth, PILL_SPRING);
			if (!pillVisible) setPillVisible(true);
		},
		[pillX, pillWidth, trackWidthMv, shouldReduceMotion, pillVisible],
	);

	useLayoutEffect(() => {
		const shouldSnap = suppressNextSpringRef.current;
		suppressNextSpringRef.current = false;
		syncPillToPage(displayedPage, shouldSnap);
	}, [displayedPage, items, size, variant, syncPillToPage]);

	// Keep pill locked on container/font resizes.
	useEffect(() => {
		const trackEl = trackRef.current;
		if (!trackEl || typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			syncPillToPage(displayedPage, true);
		});
		observer.observe(trackEl);
		return () => observer.disconnect();
	}, [displayedPage, syncPillToPage]);

	// Close open peek tray if its range disappears after navigation or disable.
	const activePeekItem = useMemo(() => {
		if (!openPeekId || !showPeek || disabled) return null;
		const found = items.find(
			(item): item is Extract<PaginationItem, { type: "peek" }> =>
				item.type === "peek" && item.id === openPeekId,
		);
		return found ?? null;
	}, [items, openPeekId, showPeek, disabled]);

	useEffect(() => {
		if (openPeekId && !activePeekItem) {
			setOpenPeekId(null);
			setPeekPageOffset(0);
			setPeekTrayHoveredPage(null);
		}
	}, [openPeekId, activePeekItem]);

	const openPeekTray = useCallback(
		(id: PeekRangeId) => {
			if (disabled || !showPeek) return;
			clearPeekTimers();
			setCardTarget(null);
			setOpenPeekId((prev) => {
				if (prev !== id) {
					setPeekPageOffset(0);
					setPeekTrayHoveredPage(null);
				}
				return id;
			});
		},
		[disabled, showPeek, clearPeekTimers],
	);

	const closePeekTray = useCallback(() => {
		clearPeekTimers();
		setOpenPeekId(null);
		setPeekPageOffset(0);
		setPeekTrayHoveredPage(null);
	}, [clearPeekTimers]);

	// Close peek tray on outside pointerdown or global Escape.
	useEffect(() => {
		if (!openPeekId) return;
		function handleOutsidePointerDown(event: PointerEvent) {
			const rootEl = rootRef.current;
			if (rootEl && !rootEl.contains(event.target as Node)) {
				closePeekTray();
			}
		}
		function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
			if (event.key !== "Escape") return;
			const rootEl = rootRef.current;
			const wasInside = Boolean(rootEl?.contains(document.activeElement));
			const triggerToFocus = openPeekId
				? peekTriggerRefs.current.get(openPeekId)
				: undefined;
			closePeekTray();
			if (wasInside) {
				triggerToFocus?.focus();
			}
		}
		document.addEventListener("pointerdown", handleOutsidePointerDown);
		document.addEventListener("keydown", handleDocumentKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handleOutsidePointerDown);
			document.removeEventListener("keydown", handleDocumentKeyDown);
		};
	}, [openPeekId, closePeekTray]);

	// Measure and viewport-clamp the open peek tray horizontally.
	useLayoutEffect(() => {
		if (!activePeekItem) return;
		const rootEl = rootRef.current;
		const triggerEl = peekTriggerRefs.current.get(activePeekItem.id);
		if (!rootEl || !triggerEl) return;

		const rootRect = rootEl.getBoundingClientRect();
		const triggerRect = triggerEl.getBoundingClientRect();
		const scale =
			rootEl.offsetWidth > 0 ? rootRect.width / rootEl.offsetWidth : 1;
		const anchorX =
			(triggerRect.left - rootRect.left + triggerRect.width / 2) / scale;
		setTrayAnchorX(anchorX);

		const trayEl = trayRef.current;
		if (!trayEl) return;

		const trayWidth = trayEl.offsetWidth * scale;
		const viewportWidth = window.innerWidth;
		const idealLeft = rootRect.left + anchorX * scale - trayWidth / 2;
		const minLeft = VIEWPORT_MARGIN_PX;
		const maxLeft = Math.max(
			minLeft,
			viewportWidth - VIEWPORT_MARGIN_PX - trayWidth,
		);
		const clampedLeft = Math.min(maxLeft, Math.max(minLeft, idealLeft));
		setTrayShiftX((clampedLeft - idealLeft) / scale);
	}, [activePeekItem, peekPageOffset, peekTrayHoveredPage, size]);

	// Position and viewport-clamp the optional `renderPagePeek` floating card.
	useLayoutEffect(() => {
		if (!cardTarget || !renderPagePeek || openPeekId) {
			cardHasShownRef.current = false;
			return;
		}

		if (!cardHasShownRef.current || shouldReduceMotion) {
			cardX.stop();
			cardX.set(cardTarget.centerX);
			cardHasShownRef.current = true;
		} else {
			animate(cardX, cardTarget.centerX, HOVER_SPRING);
		}

		const rootEl = rootRef.current;
		const cardEl = cardRef.current;
		if (!rootEl || !cardEl) return;

		const rootRect = rootEl.getBoundingClientRect();
		const scale =
			rootEl.offsetWidth > 0 ? rootRect.width / rootEl.offsetWidth : 1;
		const cardWidth = cardEl.offsetWidth * scale;
		const viewportWidth = window.innerWidth;
		const idealLeft =
			rootRect.left + cardTarget.centerX * scale - cardWidth / 2;
		const minLeft = VIEWPORT_MARGIN_PX;
		const maxLeft = Math.max(
			minLeft,
			viewportWidth - VIEWPORT_MARGIN_PX - cardWidth,
		);
		const clampedLeft = Math.min(maxLeft, Math.max(minLeft, idealLeft));
		setCardShiftX((clampedLeft - idealLeft) / scale);
	}, [cardTarget, renderPagePeek, openPeekId, cardX, shouldReduceMotion]);

	// Fine-pointer hover highlight helper.
	const moveHoverPill = useCallback(
		(targetEl: HTMLElement | null) => {
			if (!targetEl || disabled || isScrubbing) {
				hoverVisibleRef.current = false;
				animate(hoverOpacity, 0, { duration: shouldReduceMotion ? 0 : 0.12 });
				return;
			}
			const nextLeft = targetEl.offsetLeft;
			const nextWidth = targetEl.offsetWidth;

			if (!hoverVisibleRef.current || shouldReduceMotion) {
				hoverX.stop();
				hoverWidth.stop();
				hoverX.set(nextLeft);
				hoverWidth.set(nextWidth);
				hoverVisibleRef.current = true;
			} else {
				animate(hoverX, nextLeft, HOVER_SPRING);
				animate(hoverWidth, nextWidth, HOVER_SPRING);
			}
			animate(hoverOpacity, 1, { duration: shouldReduceMotion ? 0 : 0.12 });
		},
		[
			disabled,
			isScrubbing,
			hoverX,
			hoverWidth,
			hoverOpacity,
			shouldReduceMotion,
		],
	);

	const hideHoverPill = useCallback(() => {
		hoverVisibleRef.current = false;
		animate(hoverOpacity, 0, { duration: shouldReduceMotion ? 0 : 0.13 });
	}, [hoverOpacity, shouldReduceMotion]);

	const showPageCardForElement = useCallback(
		(key: string, targetPage: number, el: HTMLElement | null) => {
			if (
				!renderPagePeek ||
				!el ||
				!rootRef.current ||
				disabled ||
				openPeekId
			) {
				return;
			}
			const rootEl = rootRef.current;
			const rootRect = rootEl.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			const scale =
				rootEl.offsetWidth > 0 ? rootRect.width / rootEl.offsetWidth : 1;
			const centerX = (elRect.left - rootRect.left + elRect.width / 2) / scale;
			setCardTarget({ key, page: targetPage, centerX });
		},
		[renderPagePeek, disabled, openPeekId],
	);

	const handleTrackPointerLeave = useCallback(() => {
		if (peekOpenTimerRef.current) {
			clearTimeout(peekOpenTimerRef.current);
			peekOpenTimerRef.current = null;
		}
		hideHoverPill();
		setCardTarget(null);
	}, [hideHoverPill]);

	const handlePeekSlotPointerEnter = useCallback(
		(id: PeekRangeId, event: ReactPointerEvent<HTMLButtonElement>) => {
			if (disabled || !showPeek || event.pointerType !== "mouse") return;
			moveHoverPill(event.currentTarget);
			clearPeekTimers();
			if (openPeekId === id) return;
			const delay = openPeekId ? 0 : PEEK_OPEN_DELAY;
			peekOpenTimerRef.current = setTimeout(() => {
				openPeekTray(id);
			}, delay);
		},
		[
			disabled,
			showPeek,
			moveHoverPill,
			clearPeekTimers,
			openPeekId,
			openPeekTray,
		],
	);

	const handlePeekSlotPointerLeave = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (event.pointerType !== "mouse") return;
			clearPeekTimers();
			peekCloseTimerRef.current = setTimeout(() => {
				closePeekTray();
			}, PEEK_CLOSE_DELAY);
		},
		[clearPeekTimers, closePeekTray],
	);

	const handleTrayPointerEnter = useCallback(() => {
		clearPeekTimers();
	}, [clearPeekTimers]);

	const handleTrayPointerLeave = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "mouse") return;
			clearPeekTimers();
			peekCloseTimerRef.current = setTimeout(() => {
				closePeekTray();
			}, PEEK_CLOSE_DELAY);
		},
		[clearPeekTimers, closePeekTray],
	);

	// Direct horizontal drag-scrubbing across visible page numbers.
	const resolvePageAtClientX = useCallback((clientX: number): number | null => {
		let bestPage: number | null = null;
		let bestDist = Number.POSITIVE_INFINITY;
		for (const [p, el] of pageButtonRefs.current.entries()) {
			const rect = el.getBoundingClientRect();
			const center = rect.left + rect.width / 2;
			const dist = Math.abs(clientX - center);
			if (dist < bestDist) {
				bestDist = dist;
				bestPage = p;
			}
		}
		return bestPage;
	}, []);

	const handleTrackPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!scrubbable || disabled) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const target = event.target as HTMLElement | null;
			if (!target?.closest("[data-pagination-page]")) return;

			scrubRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				mode: "pending",
				lastPage: activePage,
			};
		},
		[scrubbable, disabled, activePage],
	);

	const handleTrackPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = scrubRef.current;
			if (!session || session.pointerId !== event.pointerId) return;
			if (session.mode === "cancelled") return;

			const dx = event.clientX - session.startX;
			const dy = event.clientY - session.startY;
			const absX = Math.abs(dx);
			const absY = Math.abs(dy);

			if (session.mode === "pending") {
				// Yield perpendicular vertical gestures immediately on touch devices.
				if (absY >= SCRUB_THRESHOLD_PX && absY >= absX) {
					session.mode = "cancelled";
					return;
				}
				if (absX >= SCRUB_THRESHOLD_PX && absX > absY * 1.2) {
					session.mode = "scrubbing";
					suppressClickRef.current = true;
					closePeekTray();
					hideHoverPill();
					setIsScrubbing(true);
					try {
						trackRef.current?.setPointerCapture(event.pointerId);
					} catch {
						// Ignore if pointer capture is unavailable in synthetic environments.
					}
				} else {
					return;
				}
			}

			if (session.mode === "scrubbing") {
				const hovered = resolvePageAtClientX(event.clientX);
				if (hovered !== null && hovered !== session.lastPage) {
					session.lastPage = hovered;
					setScrubPreviewPage(hovered);
					const el = pageButtonRefs.current.get(hovered) ?? null;
					showPageCardForElement(`scrub-${hovered}`, hovered, el);
				}
			}
		},
		[
			closePeekTray,
			hideHoverPill,
			resolvePageAtClientX,
			showPageCardForElement,
		],
	);

	const finishScrub = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
			const session = scrubRef.current;
			if (!session || session.pointerId !== event.pointerId) return;
			scrubRef.current = null;

			if (session.mode === "scrubbing") {
				try {
					if (trackRef.current?.hasPointerCapture(event.pointerId)) {
						trackRef.current.releasePointerCapture(event.pointerId);
					}
				} catch {
					// Ignore release errors.
				}
				const targetPage = session.lastPage;
				setIsScrubbing(false);
				setScrubPreviewPage(null);
				setCardTarget(null);
				if (commit) {
					selectPage(targetPage);
				}
				requestAnimationFrame(() => {
					suppressClickRef.current = false;
				});
			}
		},
		[selectPage],
	);

	// Keyboard navigation across the rail (ArrowLeft/ArrowRight/Home/End/Escape).
	const getFocusableRailButtons = useCallback((): HTMLButtonElement[] => {
		const rootEl = rootRef.current;
		if (!rootEl) return [];
		return Array.from(
			rootEl.querySelectorAll<HTMLButtonElement>(
				"[data-rail-control]:not(:disabled)",
			),
		);
	}, []);

	const handleNavKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			onKeyDown?.(event);
			if (event.defaultPrevented || disabled) return;

			if (event.key === "Escape" && openPeekId) {
				event.preventDefault();
				const triggerToFocus = peekTriggerRefs.current.get(openPeekId);
				closePeekTray();
				triggerToFocus?.focus();
				return;
			}

			if (openPeekId && trayRef.current?.contains(document.activeElement)) {
				const trayButtons = Array.from(
					trayRef.current.querySelectorAll<HTMLButtonElement>(
						"[data-peek-tray-item]:not(:disabled)",
					),
				);
				const idx = trayButtons.indexOf(
					document.activeElement as HTMLButtonElement,
				);
				if (idx !== -1) {
					if (event.key === "ArrowRight") {
						event.preventDefault();
						trayButtons[(idx + 1) % trayButtons.length]?.focus();
						return;
					}
					if (event.key === "ArrowLeft") {
						event.preventDefault();
						trayButtons[
							(idx - 1 + trayButtons.length) % trayButtons.length
						]?.focus();
						return;
					}
					if (event.key === "Home") {
						event.preventDefault();
						trayButtons[0]?.focus();
						return;
					}
					if (event.key === "End") {
						event.preventDefault();
						trayButtons[trayButtons.length - 1]?.focus();
						return;
					}
				}
				return;
			}

			const controls = getFocusableRailButtons();
			const activeIndex = controls.indexOf(
				document.activeElement as HTMLButtonElement,
			);
			if (activeIndex === -1) return;

			if (event.key === "ArrowRight") {
				event.preventDefault();
				controls[(activeIndex + 1) % controls.length]?.focus();
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				controls[
					(activeIndex - 1 + controls.length) % controls.length
				]?.focus();
			} else if (event.key === "Home") {
				event.preventDefault();
				selectPage(1, { instant: true });
				requestAnimationFrame(() => {
					pageButtonRefs.current.get(1)?.focus();
				});
			} else if (event.key === "End") {
				event.preventDefault();
				selectPage(safeTotal, { instant: true });
				requestAnimationFrame(() => {
					pageButtonRefs.current.get(safeTotal)?.focus();
				});
			}
		},
		[
			onKeyDown,
			disabled,
			openPeekId,
			closePeekTray,
			getFocusableRailButtons,
			selectPage,
			safeTotal,
		],
	);

	// Slice hidden pages visible in the open peek tray.
	const peekTrayData = useMemo(() => {
		if (!activePeekItem) return null;
		const allHidden = activePeekItem.pages;
		const totalHidden = allHidden.length;
		const maxOffset = Math.max(0, totalHidden - safePeekCount);
		const clampedOffset = Math.min(maxOffset, Math.max(0, peekPageOffset));

		const visiblePages =
			activePeekItem.id === "end"
				? allHidden.slice(clampedOffset, clampedOffset + safePeekCount)
				: allHidden.slice(
						Math.max(0, totalHidden - safePeekCount - clampedOffset),
						totalHidden - clampedOffset,
					);

		const canStepEarlier =
			activePeekItem.id === "end"
				? clampedOffset > 0
				: clampedOffset < maxOffset;
		const canStepLater =
			activePeekItem.id === "end"
				? clampedOffset < maxOffset
				: clampedOffset > 0;

		return {
			id: activePeekItem.id,
			visiblePages,
			totalHidden,
			canStepEarlier,
			canStepLater,
			firstVisible: visiblePages[0] ?? allHidden[0],
			lastVisible: visiblePages[visiblePages.length - 1] ?? allHidden[0],
		};
	}, [activePeekItem, safePeekCount, peekPageOffset]);

	const stepPeekTray = useCallback(
		(direction: "earlier" | "later") => {
			if (!activePeekItem) return;
			const maxOffset = Math.max(
				0,
				activePeekItem.pages.length - safePeekCount,
			);
			setPeekPageOffset((prev) => {
				const delta =
					activePeekItem.id === "end"
						? direction === "later"
							? safePeekCount
							: -safePeekCount
						: direction === "earlier"
							? safePeekCount
							: -safePeekCount;
				return Math.min(maxOffset, Math.max(0, prev + delta));
			});
		},
		[activePeekItem, safePeekCount],
	);

	const sizeConfig = SIZE_STYLES[size];
	const isPillOrGhost = variant === "pill" || variant === "ghost";

	const railVariantClass =
		variant === "pill"
			? "rounded-full border border-border/75 bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-border/80 dark:bg-muted/35 dark:shadow-none"
			: variant === "surface"
				? "rounded-xl border border-border/80 bg-muted/45 dark:bg-muted/35"
				: "rounded-full bg-transparent";

	const itemRadiusClass = variant === "surface" ? "rounded-lg" : "rounded-full";
	const popoverPositionClass =
		peekSide === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]";
	const popoverBridgeClass =
		peekSide === "top"
			? "after:absolute after:inset-x-0 after:-bottom-3 after:h-3 after:content-['']"
			: "after:absolute after:inset-x-0 after:-top-3 after:h-3 after:content-['']";
	const popoverOriginClass =
		peekSide === "top" ? "origin-bottom" : "origin-top";
	const popoverEnterY = peekSide === "top" ? 5 : -5;

	const cardPageState: PaginationRailPeekRenderState | null = useMemo(() => {
		if (!cardTarget || cardTarget.page === null) return null;
		const p = cardTarget.page;
		return {
			page: p,
			totalPages: safeTotal,
			currentPage: activePage,
			isCurrent: p === activePage,
			direction:
				p < activePage ? "previous" : p > activePage ? "next" : "current",
		};
	}, [cardTarget, safeTotal, activePage]);

	const trayPreviewState: PaginationRailPeekRenderState | null = useMemo(() => {
		if (!renderPagePeek || !peekTrayData) return null;
		const defaultPeekPage =
			peekTrayData.id === "end"
				? peekTrayData.firstVisible
				: peekTrayData.lastVisible;
		const p =
			peekTrayHoveredPage !== null &&
			peekTrayData.visiblePages.includes(peekTrayHoveredPage)
				? peekTrayHoveredPage
				: defaultPeekPage;
		return {
			page: p,
			totalPages: safeTotal,
			currentPage: activePage,
			isCurrent: p === activePage,
			direction:
				p < activePage ? "previous" : p > activePage ? "next" : "current",
		};
	}, [
		renderPagePeek,
		peekTrayData,
		peekTrayHoveredPage,
		safeTotal,
		activePage,
	]);

	const isPrevDisabled = disabled || activePage <= 1;
	const isNextDisabled = disabled || activePage >= safeTotal;

	return (
		<MotionConfig reducedMotion="user">
			<nav
				{...props}
				aria-label={ariaLabel}
				className={cn(
					"relative inline-flex max-w-full select-none items-center",
					disabled && "opacity-55",
					className,
					classNames?.root,
				)}
				data-disabled={disabled ? "" : undefined}
				data-scrubbing={isScrubbing ? "" : undefined}
				data-size={size}
				data-slot="pagination-rail"
				data-variant={variant}
				onKeyDown={handleNavKeyDown}
				ref={rootRef}
			>
				{/* Screen-reader live announcement for committed page changes */}
				<span aria-live="polite" className="sr-only">
					{announcement}
				</span>

				{/* Main rail container */}
				<div
					className={cn(
						"relative inline-flex max-w-full items-center",
						sizeConfig.rail,
						railVariantClass,
						classNames?.rail,
					)}
					data-slot="pagination-rail-track-shell"
				>
					{showControls ? (
						<button
							aria-label="Previous page"
							className={cn(
								"relative inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-35 motion-safe:active:scale-[0.95]",
								"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/[0.06] [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/[0.09]",
								itemRadiusClass,
								sizeConfig.nav,
								classNames?.navButton,
							)}
							data-rail-control=""
							data-slot="pagination-rail-prev"
							disabled={isPrevDisabled}
							onBlur={() => setCardTarget(null)}
							onClick={() => {
								closePeekTray();
								selectPage(activePage - 1);
							}}
							onFocus={(e) => {
								if (
									!isPrevDisabled &&
									e.currentTarget.matches(":focus-visible")
								) {
									showPageCardForElement(
										"prev",
										activePage - 1,
										e.currentTarget,
									);
								}
							}}
							onPointerEnter={(e) => {
								if (!isPrevDisabled && e.pointerType === "mouse") {
									showPageCardForElement(
										"prev",
										activePage - 1,
										e.currentTarget,
									);
								}
							}}
							onPointerLeave={() => setCardTarget(null)}
							ref={(node) => {
								navButtonRefs.current.prev = node;
							}}
							type="button"
						>
							<ChevronLeft aria-hidden="true" className={sizeConfig.icon} />
						</button>
					) : null}

					{/* Page number & peek slot track */}
					<div
						className={cn(
							"relative inline-flex touch-pan-y items-center gap-0.5",
							scrubbable && !disabled && isScrubbing && "cursor-grabbing",
						)}
						data-slot="pagination-rail-track"
						onPointerCancel={(e) => finishScrub(e, false)}
						onPointerDown={handleTrackPointerDown}
						onPointerLeave={handleTrackPointerLeave}
						onPointerMove={handleTrackPointerMove}
						onPointerUp={(e) => finishScrub(e, true)}
						ref={trackRef}
					>
						{/* Gliding fine-pointer hover indicator */}
						<motion.span
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute top-0 bottom-0 left-0 z-0 bg-foreground/[0.06] dark:bg-foreground/[0.09]",
								itemRadiusClass,
								classNames?.hoverPill,
							)}
							data-slot="pagination-rail-hover-pill"
							style={{
								x: hoverX,
								width: hoverWidth,
								opacity: hoverOpacity,
							}}
						/>

						{/* Surface-variant sliding pill behind buttons (preserves ring + shadow cleanly) */}
						{!isPillOrGhost && pillVisible ? (
							<motion.span
								aria-hidden="true"
								className={cn(
									"pointer-events-none absolute top-0 bottom-0 left-0 z-0 bg-background shadow-xs ring-1 ring-border/80 dark:bg-zinc-800 dark:ring-white/12",
									itemRadiusClass,
									classNames?.pill,
								)}
								data-slot="pagination-rail-pill"
								style={{
									x: pillX,
									width: pillWidth,
								}}
							/>
						) : null}

						{/* Interactive base layer */}
						{items.map((item) => {
							if (item.type === "peek") {
								if (!showPeek) {
									return (
										<span
											aria-hidden="true"
											className={cn(
												"inline-flex shrink-0 items-center justify-center text-muted-foreground/70",
												sizeConfig.peek,
												sizeConfig.peekNumber,
											)}
											data-slot="pagination-rail-ellipsis"
											key={`ellipsis-${item.id}`}
										>
											&hellip;
										</span>
									);
								}

								const peekNums = getPeekSlotNumbers(item.id, item.pages);
								const isOpen = openPeekId === item.id;
								const rangeStart = item.pages[0];
								const rangeEnd = item.pages[item.pages.length - 1];
								const maskDirection =
									item.id === "end" ? "to right" : "to left";
								const maskImage = isOpen
									? `linear-gradient(${maskDirection}, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 65%, rgba(0,0,0,0.38) 100%)`
									: `linear-gradient(${maskDirection}, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.46) 58%, rgba(0,0,0,0.14) 100%)`;

								return (
									<button
										aria-controls={`${instanceId}-peek-tray`}
										aria-expanded={isOpen}
										aria-haspopup="true"
										aria-label={
											item.id === "end"
												? `Peek next pages ${rangeStart} to ${rangeEnd}`
												: `Peek earlier pages ${rangeStart} to ${rangeEnd}`
										}
										className={cn(
											"relative z-10 inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center font-medium text-muted-foreground tabular-nums transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none motion-safe:active:scale-[0.96]",
											isOpen && "text-foreground",
											itemRadiusClass,
											sizeConfig.peek,
											sizeConfig.peekNumber,
											classNames?.peekTrigger,
										)}
										data-peek-side={item.id}
										data-rail-control=""
										data-slot="pagination-rail-peek-trigger"
										data-state={isOpen ? "open" : "closed"}
										disabled={disabled}
										key={`peek-${item.id}`}
										onClick={() => {
											if (isOpen) {
												closePeekTray();
											} else {
												openPeekTray(item.id);
											}
										}}
										onPointerEnter={(e) =>
											handlePeekSlotPointerEnter(item.id, e)
										}
										onPointerLeave={handlePeekSlotPointerLeave}
										ref={(node) => {
											if (node) peekTriggerRefs.current.set(item.id, node);
											else peekTriggerRefs.current.delete(item.id);
										}}
										type="button"
									>
										<span
											aria-hidden="true"
											className="inline-flex items-center gap-1 tracking-tight"
											style={{
												maskImage,
												WebkitMaskImage: maskImage,
											}}
										>
											{peekNums.map((num) => (
												<span key={num}>{num}</span>
											))}
										</span>
									</button>
								);
							}

							const isCurrent = item.page === activePage;
							const isDisplayed = item.page === displayedPage;
							const label =
								getPageAriaLabel?.(item.page, isCurrent) ??
								(isCurrent
									? `Page ${item.page}, current page`
									: `Go to page ${item.page}`);

							return (
								<button
									aria-current={isCurrent ? "page" : undefined}
									aria-label={label}
									className={cn(
										"relative z-10 inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center font-medium tabular-nums transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none motion-safe:active:scale-[0.96]",
										!pillVisible && isDisplayed && isPillOrGhost
											? "bg-foreground text-background"
											: !pillVisible && isDisplayed && !isPillOrGhost
												? "bg-background text-foreground shadow-xs ring-1 ring-border/80 dark:bg-zinc-800 dark:ring-white/12"
												: isDisplayed
													? "text-foreground"
													: "text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
										itemRadiusClass,
										sizeConfig.button,
										classNames?.pageButton,
									)}
									data-pagination-page={item.page}
									data-rail-control=""
									data-slot="pagination-rail-page"
									data-state={isDisplayed ? "active" : "inactive"}
									disabled={disabled}
									key={`page-${item.page}`}
									onBlur={() => setCardTarget(null)}
									onClick={(e) => {
										if (suppressClickRef.current) {
											e.preventDefault();
											return;
										}
										closePeekTray();
										selectPage(item.page, { instant: e.detail === 0 });
									}}
									onFocus={(e) => {
										if (e.currentTarget.matches(":focus-visible")) {
											showPageCardForElement(
												`page-${item.page}`,
												item.page,
												e.currentTarget,
											);
										}
									}}
									onPointerEnter={(e) => {
										if (e.pointerType !== "mouse") return;
										if (isDisplayed) {
											hideHoverPill();
										} else {
											moveHoverPill(e.currentTarget);
										}
										showPageCardForElement(
											`page-${item.page}`,
											item.page,
											e.currentTarget,
										);
									}}
									ref={(node) => {
										if (node) pageButtonRefs.current.set(item.page, node);
										else pageButtonRefs.current.delete(item.page);
									}}
									type="button"
								>
									{item.page}
								</button>
							);
						})}

						{/* Dual-layer clipped active pill overlay for seamless contrast inversion on pill & ghost variants */}
						{isPillOrGhost && pillVisible ? (
							<motion.div
								aria-hidden="true"
								className={cn(
									"pointer-events-none absolute inset-0 z-20 inline-flex items-center gap-0.5 bg-foreground text-background",
									classNames?.pill,
								)}
								data-slot="pagination-rail-pill"
								style={{
									clipPath,
									WebkitClipPath: clipPath,
								}}
							>
								{items.map((item) => {
									if (item.type === "peek") {
										if (!showPeek) {
											return (
												<span
													className={cn(
														"inline-flex shrink-0 items-center justify-center text-background/70",
														sizeConfig.peek,
														sizeConfig.peekNumber,
													)}
													key={`overlay-ellipsis-${item.id}`}
												>
													&hellip;
												</span>
											);
										}
										const peekNums = getPeekSlotNumbers(item.id, item.pages);
										return (
											<span
												className={cn(
													"inline-flex shrink-0 items-center justify-center font-medium text-background/70 tabular-nums",
													sizeConfig.peek,
													sizeConfig.peekNumber,
												)}
												key={`overlay-peek-${item.id}`}
											>
												<span className="inline-flex items-center gap-1 tracking-tight">
													{peekNums.map((num) => (
														<span key={num}>{num}</span>
													))}
												</span>
											</span>
										);
									}

									return (
										<span
											className={cn(
												"inline-flex shrink-0 items-center justify-center font-medium tabular-nums",
												itemRadiusClass,
												sizeConfig.button,
												classNames?.pageButton,
											)}
											key={`overlay-page-${item.page}`}
										>
											{item.page}
										</span>
									);
								})}
							</motion.div>
						) : null}
					</div>

					{showControls ? (
						<button
							aria-label="Next page"
							className={cn(
								"relative inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-35 motion-safe:active:scale-[0.95]",
								"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/[0.06] [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/[0.09]",
								itemRadiusClass,
								sizeConfig.nav,
								classNames?.navButton,
							)}
							data-rail-control=""
							data-slot="pagination-rail-next"
							disabled={isNextDisabled}
							onBlur={() => setCardTarget(null)}
							onClick={() => {
								closePeekTray();
								selectPage(activePage + 1);
							}}
							onFocus={(e) => {
								if (
									!isNextDisabled &&
									e.currentTarget.matches(":focus-visible")
								) {
									showPageCardForElement(
										"next",
										activePage + 1,
										e.currentTarget,
									);
								}
							}}
							onPointerEnter={(e) => {
								if (!isNextDisabled && e.pointerType === "mouse") {
									showPageCardForElement(
										"next",
										activePage + 1,
										e.currentTarget,
									);
								}
							}}
							onPointerLeave={() => setCardTarget(null)}
							ref={(node) => {
								navButtonRefs.current.next = node;
							}}
							type="button"
						>
							<ChevronRight aria-hidden="true" className={sizeConfig.icon} />
						</button>
					) : null}
				</div>

				{/* Floating Peek Tray for collapsed page ranges */}
				<AnimatePresence>
					{peekTrayData ? (
						<motion.div
							animate={{ opacity: 1, scale: 1, y: 0 }}
							aria-label={
								peekTrayData.id === "end" ? "Upcoming pages" : "Earlier pages"
							}
							className={cn(
								"absolute z-40",
								popoverPositionClass,
								popoverBridgeClass,
								popoverOriginClass,
							)}
							exit={{
								opacity: 0,
								scale: shouldReduceMotion ? 1 : 0.96,
								y: shouldReduceMotion ? 0 : popoverEnterY,
								transition: {
									duration: shouldReduceMotion ? 0 : 0.11,
									ease: POPOVER_EASE,
								},
							}}
							id={`${instanceId}-peek-tray`}
							initial={{
								opacity: 0,
								scale: shouldReduceMotion ? 1 : 0.96,
								y: shouldReduceMotion ? 0 : popoverEnterY,
							}}
							key={`peek-tray-${peekTrayData.id}`}
							onPointerEnter={handleTrayPointerEnter}
							onPointerLeave={handleTrayPointerLeave}
							role="group"
							style={{
								left: trayAnchorX + trayShiftX,
							}}
							transition={{
								duration: shouldReduceMotion ? 0 : 0.16,
								ease: POPOVER_EASE,
							}}
						>
							<div
								className={cn(
									"flex -translate-x-1/2 flex-col gap-1 rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-black/[0.08] shadow-lg backdrop-blur-md dark:border-border dark:bg-popover/95 dark:shadow-black/35 [@media(prefers-reduced-transparency:reduce)]:bg-popover [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
									classNames?.peekTray,
								)}
								data-slot="pagination-rail-peek-tray"
								ref={trayRef}
							>
								<div className="flex items-center justify-between gap-3 px-1">
									<span className="font-medium text-[11px] text-muted-foreground tabular-nums">
										{peekTrayData.id === "end" ? "Next" : "Earlier"} &middot;{" "}
										{peekTrayData.firstVisible === peekTrayData.lastVisible
											? `Page ${peekTrayData.firstVisible}`
											: `${peekTrayData.firstVisible}\u2013${peekTrayData.lastVisible}`}
									</span>
									{peekTrayData.totalHidden > safePeekCount ? (
										<div className="inline-flex items-center gap-0.5">
											<button
												aria-label="Show earlier hidden pages"
												className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-30"
												disabled={!peekTrayData.canStepEarlier}
												onClick={() => stepPeekTray("earlier")}
												type="button"
											>
												<ChevronLeft aria-hidden="true" className="size-3" />
											</button>
											<button
												aria-label="Show later hidden pages"
												className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-30"
												disabled={!peekTrayData.canStepLater}
												onClick={() => stepPeekTray("later")}
												type="button"
											>
												<ChevronRight aria-hidden="true" className="size-3" />
											</button>
										</div>
									) : null}
								</div>

								<div className="flex items-center gap-0.5">
									{peekTrayData.visiblePages.map((p) => (
										<button
											aria-label={
												getPageAriaLabel?.(p, false) ?? `Go to page ${p}`
											}
											className={cn(
												"inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-lg font-medium text-foreground/85 tabular-nums transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-safe:active:scale-[0.95]",
												sizeConfig.trayButton,
											)}
											data-peek-tray-item=""
											data-slot="pagination-rail-peek-page"
											key={p}
											onBlur={() => setPeekTrayHoveredPage(null)}
											onClick={(e) => {
												const viaKeyboard = e.detail === 0;
												closePeekTray();
												selectPage(p, { instant: viaKeyboard });
												if (viaKeyboard) {
													requestAnimationFrame(() => {
														pageButtonRefs.current.get(p)?.focus();
													});
												}
											}}
											onFocus={() => setPeekTrayHoveredPage(p)}
											onPointerEnter={() => setPeekTrayHoveredPage(p)}
											type="button"
										>
											{p}
										</button>
									))}
								</div>

								{trayPreviewState && renderPagePeek ? (
									<div
										className="flex h-6 items-center truncate border-border/70 border-t px-1 pt-1 text-muted-foreground text-xs"
										data-slot="pagination-rail-peek-tray-preview"
									>
										{renderPagePeek(trayPreviewState)}
									</div>
								) : null}
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>

				{/* Optional floating page preview card when `renderPagePeek` is supplied */}
				<AnimatePresence>
					{cardPageState && renderPagePeek && !openPeekId ? (
						<motion.div
							className={cn(
								"pointer-events-none absolute left-0 z-30",
								popoverPositionClass,
							)}
							key="page-peek-card"
							style={{
								x: cardX,
							}}
						>
							<motion.div
								animate={{ opacity: 1, scale: 1, y: 0 }}
								className={popoverOriginClass}
								exit={{
									opacity: 0,
									scale: shouldReduceMotion ? 1 : 0.96,
									y: shouldReduceMotion ? 0 : popoverEnterY,
									transition: {
										duration: shouldReduceMotion ? 0 : 0.1,
										ease: POPOVER_EASE,
									},
								}}
								initial={{
									opacity: 0,
									scale: shouldReduceMotion ? 1 : 0.96,
									y: shouldReduceMotion ? 0 : popoverEnterY,
								}}
								transition={{
									duration: shouldReduceMotion ? 0 : 0.15,
									ease: POPOVER_EASE,
								}}
							>
								<div
									className={cn(
										"w-max max-w-[240px] rounded-xl border border-border/80 bg-popover/95 px-2.5 py-1.5 text-popover-foreground text-xs shadow-black/[0.08] shadow-md backdrop-blur-md dark:border-border dark:bg-popover/95 dark:shadow-black/35 [@media(prefers-reduced-transparency:reduce)]:bg-popover [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
										classNames?.peekCard,
									)}
									data-slot="pagination-rail-peek-card"
									ref={cardRef}
									style={{
										transform: `translateX(calc(-50% + ${cardShiftX}px))`,
									}}
								>
									{renderPagePeek(cardPageState)}
								</div>
							</motion.div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</nav>
		</MotionConfig>
	);
}

export default PaginationRail;
