"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type ComponentProps,
	type MouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Lifecycle state displayed by `LiveSaveStatus`. */
export type LiveSaveStatusState =
	| "saved"
	| "unsaved"
	| "saving"
	| "offline"
	| "error";

/** Visual surface treatment for `LiveSaveStatus`. */
export type LiveSaveStatusVariant = "pill" | "ghost" | "minimal";

/** Density preset for `LiveSaveStatus`. */
export type LiveSaveStatusSize = "sm" | "md";

/** Horizontal alignment of the optional sync details popover. */
export type LiveSaveStatusPopoverAlign = "start" | "center" | "end";

/** A past save checkpoint rendered inside the optional details popover. */
export interface LiveSaveStatusHistoryItem {
	/** Stable unique identifier for the checkpoint. */
	id: string;
	/** Short summary of what was saved (e.g., "Updated introduction"). */
	label: string;
	/** When this checkpoint was saved. */
	savedAt: Date | number | string;
	/** Optional collaborator or device name. */
	author?: string;
}

/** Custom status labels for each save lifecycle state. */
export type LiveSaveStatusLabels = Partial<Record<LiveSaveStatusState, string>>;

export interface LiveSaveStatusProps
	extends Omit<ComponentProps<"div">, "children"> {
	/**
	 * Current save lifecycle state.
	 * @default "saved"
	 */
	status?: LiveSaveStatusState;
	/**
	 * Surface presentation: elevated `pill`, borderless `ghost`, or compact icon-first `minimal`.
	 * @default "pill"
	 */
	variant?: LiveSaveStatusVariant;
	/**
	 * Size preset for the status badge.
	 * @default "md"
	 */
	size?: LiveSaveStatusSize;
	/** Timestamp of the most recent completed save. */
	lastSavedAt?: Date | number | string;
	/**
	 * Whether to show the live relative timestamp alongside the saved label.
	 * Defaults to `true` when `lastSavedAt` is provided.
	 */
	showTimestamp?: boolean;
	/** Number of pending unsaved or offline-queued edits. */
	pendingCount?: number;
	/** Optional failure reason shown in the tooltip and details popover. */
	errorMessage?: string;
	/**
	 * Minimum milliseconds to keep the visual `saving` state before settling to `saved`,
	 * preventing jarring sub-second flashes. Set to `0` to disable.
	 * @default 450
	 */
	minSavingMs?: number;
	/** Override the default label for any status. */
	labels?: LiveSaveStatusLabels;
	/**
	 * Label for the inline save button shown in the `unsaved` state when `onSave` is provided.
	 * @default "Save"
	 */
	saveLabel?: string;
	/**
	 * Label for the inline retry button shown in the `error` state when `onRetry` is provided.
	 * @default "Retry"
	 */
	retryLabel?: string;
	/** Optional keyboard shortcut hint rendered inside the details popover (e.g., `"⌘S"`). */
	shortcut?: string;
	/** Triggered when the user clicks the inline Save action in `unsaved` state. */
	onSave?: () => void | Promise<void>;
	/** Triggered when the user clicks the inline Retry action in `error` state. */
	onRetry?: () => void | Promise<void>;
	/** Extra custom content displayed inside the anchored details popover. */
	details?: ReactNode;
	/** Optional list of recent save checkpoints shown inside the details popover. */
	history?: LiveSaveStatusHistoryItem[];
	/** Called when the user clicks Restore on a history checkpoint. */
	onRestore?: (item: LiveSaveStatusHistoryItem) => void;
	/**
	 * Enable the anchored sync details popover even without `details` or `history`.
	 * Automatically enabled whenever `details` or `history` is provided.
	 * @default false
	 */
	showPopover?: boolean;
	/**
	 * Preferred horizontal alignment of the details popover relative to the badge.
	 * Automatically clamped inside the viewport on narrow screens.
	 * @default "start"
	 */
	popoverAlign?: LiveSaveStatusPopoverAlign;
	/** Controlled open state of the details popover. */
	open?: boolean;
	/** Initial uncontrolled open state of the details popover. */
	defaultOpen?: boolean;
	/** Called whenever the details popover opens or closes. */
	onOpenChange?: (open: boolean) => void;
	/**
	 * Play subtle synthesized confirmation and error clicks via `@rexa-developer/tiks`.
	 * @default false
	 */
	sound?: boolean;
	/**
	 * Play subtle haptic feedback on touch devices via `web-haptics`.
	 * @default true
	 */
	haptics?: boolean;
	/**
	 * Toggle spring and motion transitions. `false` matches `prefers-reduced-motion`.
	 * @default true
	 */
	animated?: boolean;
}

const DEFAULT_LABELS: Record<LiveSaveStatusState, string> = {
	saved: "Saved",
	unsaved: "Unsaved",
	saving: "Saving",
	offline: "Offline",
	error: "Save failed",
};

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const WIDTH_SPRING = {
	type: "spring",
	stiffness: 380,
	damping: 32,
	mass: 0.85,
} as const;

/** Hold crisp "Saved" for this long after a fresh save before showing relative time. */
const FRESH_SAVE_HOLD_MS = 2400;
/** Minimum ms between sound/haptic cues. */
const CUE_THROTTLE_MS = 120;
/** Viewport edge padding when clamping the anchored popover. */
const POPOVER_MARGIN_PX = 16;

const SAVE_SOUND = {
	name: "live-save-status-saved",
	baseFreq: 1640,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 4600,
	filterQ: 2.2,
	attack: 0.001,
	decay: 0.36,
	brightness: 3800,
} as const;

const ERROR_SOUND = {
	name: "live-save-status-error",
	baseFreq: 340,
	noiseColor: "pink",
	oscType: "triangle",
	filterFreq: 1100,
	filterQ: 1.4,
	attack: 0.002,
	decay: 0.45,
	brightness: 900,
} as const;

const TAP_SOUND = {
	name: "live-save-status-tap",
	baseFreq: 1120,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 3000,
	filterQ: 1.8,
	attack: 0.001,
	decay: 0.22,
	brightness: 2200,
} as const;

// Hoisted and deduplicated by React 19 so multiple instances share one sheet.
const STYLES =
	"@keyframes lss-spin{to{transform:rotate(360deg)}}" +
	"@keyframes lss-breathe{0%,100%{transform:scale(.94);opacity:.26}50%{transform:scale(1.14);opacity:.62}}" +
	"@keyframes lss-ripple{0%{transform:scale(.82);opacity:.44}100%{transform:scale(1.48);opacity:0}}" +
	"@keyframes lss-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}45%{transform:translateX(2.5px)}70%{transform:translateX(-1.5px)}88%{transform:translateX(.5px)}}" +
	"[data-slot=live-save-status] [data-lss-spin]{transform-origin:8px 8px;animation:lss-spin .75s linear infinite}" +
	"[data-slot=live-save-status] [data-lss-breathe]{transform-origin:8px 8px;animation:lss-breathe 2.2s ease-in-out infinite}" +
	"[data-slot=live-save-status] [data-lss-ripple]{transform-origin:8px 8px;animation:lss-ripple .44s cubic-bezier(.23,1,.32,1) forwards}" +
	"[data-slot=live-save-status][data-lss-shaking]{animation:lss-shake .32s cubic-bezier(.23,1,.32,1)}" +
	"@media (prefers-reduced-motion:reduce){" +
	"[data-slot=live-save-status] :is([data-lss-spin],[data-lss-breathe],[data-lss-ripple]){animation:none}" +
	"[data-slot=live-save-status][data-lss-shaking]{animation:none}" +
	"}";

function toTimestampMs(value?: Date | number | string): number | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	const date = value instanceof Date ? value : new Date(value);
	const ms = date.getTime();
	return Number.isFinite(ms) ? ms : null;
}

function formatRelativeTime(timestampMs: number, nowMs: number): string {
	const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
	if (diffSec < 45) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays === 1) return "yesterday";
	return `${diffDays}d ago`;
}

function nextRelativeTickMs(timestampMs: number, nowMs: number): number {
	const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
	if (diffSec < 60) return 10_000;
	if (diffSec < 3600) return 30_000;
	return 300_000;
}

function formatExactTime(timestampMs: number, nowMs: number): string {
	const target = new Date(timestampMs);
	const now = new Date(nowMs);
	const sameDay =
		target.getFullYear() === now.getFullYear() &&
		target.getMonth() === now.getMonth() &&
		target.getDate() === now.getDate();

	const time = new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	}).format(target);

	if (sameDay) return `Today at ${time}`;

	const date = new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(target);
	return `${date}, ${time}`;
}

function getStoragePromise(
	status: LiveSaveStatusState,
	pendingCount?: number,
	errorMessage?: string,
): { heading: string; description: string } {
	switch (status) {
		case "saved":
			return {
				heading: "All changes saved",
				description: "Your latest edits are synced and safely stored.",
			};
		case "unsaved":
			return {
				heading:
					pendingCount && pendingCount > 0
						? `${pendingCount} unsaved ${pendingCount === 1 ? "change" : "changes"}`
						: "Unsaved changes",
				description: "Edits are waiting to sync with storage.",
			};
		case "saving":
			return {
				heading: "Saving changes",
				description: "Syncing your latest edits now.",
			};
		case "offline":
			return {
				heading: "Saved locally · Offline",
				description:
					pendingCount && pendingCount > 0
						? `${pendingCount} ${pendingCount === 1 ? "edit" : "edits"} queued on this device. Will sync on reconnect.`
						: "Edits are kept on this device and will sync automatically when you reconnect.",
			};
		case "error":
			return {
				heading: "Could not save changes",
				description:
					errorMessage ||
					"Connection interrupted. Your edits are still in this session — retry to sync.",
			};
	}
}

function StatusSeal({
	status,
	saveSeq,
	reduced,
}: {
	status: LiveSaveStatusState;
	saveSeq: number;
	reduced: boolean;
}) {
	const colorClass =
		status === "saved"
			? "text-emerald-600 dark:text-emerald-400"
			: status === "unsaved" || status === "offline"
				? "text-amber-600 dark:text-amber-400"
				: status === "error"
					? "text-destructive"
					: "text-foreground/75";

	return (
		<span
			aria-hidden="true"
			data-slot="live-save-status-seal"
			className={cn(
				"relative inline-flex size-4 shrink-0 items-center justify-center transition-colors duration-200",
				colorClass,
			)}
		>
			<svg
				viewBox="0 0 16 16"
				fill="none"
				className="size-4 overflow-visible"
				aria-hidden="true"
			>
				{status === "saved" && (
					<>
						{saveSeq > 0 && !reduced && (
							<circle
								key={`ripple-${saveSeq}`}
								cx="8"
								cy="8"
								r="6"
								stroke="currentColor"
								strokeWidth="1.25"
								data-lss-ripple=""
							/>
						)}
						<circle
							cx="8"
							cy="8"
							r="6.25"
							fill="currentColor"
							fillOpacity="0.12"
							stroke="currentColor"
							strokeOpacity="0.32"
							strokeWidth="1.15"
						/>
						<motion.path
							key={`check-${saveSeq}`}
							d="M5.2 8.25L7.1 10.15L11 6.1"
							stroke="currentColor"
							strokeWidth="1.65"
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={
								saveSeq > 0 && !reduced
									? { pathLength: 0, opacity: 0.4 }
									: false
							}
							animate={{ pathLength: 1, opacity: 1 }}
							transition={
								reduced ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }
							}
						/>
					</>
				)}

				{status === "unsaved" && (
					<>
						<circle
							cx="8"
							cy="8"
							r="5.6"
							fill="currentColor"
							fillOpacity="0.22"
							data-lss-breathe={reduced ? undefined : ""}
						/>
						<circle cx="8" cy="8" r="2.9" fill="currentColor" />
					</>
				)}

				{status === "saving" && (
					<>
						<circle
							cx="8"
							cy="8"
							r="5.75"
							stroke="currentColor"
							strokeOpacity="0.18"
							strokeWidth="1.65"
						/>
						<circle
							cx="8"
							cy="8"
							r="5.75"
							stroke="currentColor"
							strokeWidth="1.65"
							strokeLinecap="round"
							strokeDasharray={reduced ? "18 18" : "24 36.2"}
							data-lss-spin={reduced ? undefined : ""}
						/>
					</>
				)}

				{status === "offline" && (
					<>
						<circle
							cx="8"
							cy="8"
							r="5.75"
							stroke="currentColor"
							strokeOpacity="0.28"
							strokeWidth="1.35"
							strokeDasharray="3.2 2.4"
						/>
						<path
							d="M4.2 11.8L11.8 4.2"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
						/>
					</>
				)}

				{status === "error" && (
					<>
						<circle
							cx="8"
							cy="8"
							r="6.25"
							fill="currentColor"
							fillOpacity="0.12"
							stroke="currentColor"
							strokeOpacity="0.38"
							strokeWidth="1.15"
						/>
						<path
							d="M8 4.9V8.4"
							stroke="currentColor"
							strokeWidth="1.65"
							strokeLinecap="round"
						/>
						<circle cx="8" cy="10.95" r="0.9" fill="currentColor" />
					</>
				)}
			</svg>
		</span>
	);
}

export function LiveSaveStatus({
	status = "saved",
	variant = "pill",
	size = "md",
	lastSavedAt,
	showTimestamp,
	pendingCount,
	errorMessage,
	minSavingMs = 450,
	labels,
	saveLabel = "Save",
	retryLabel = "Retry",
	shortcut,
	onSave,
	onRetry,
	details,
	history,
	onRestore,
	showPopover = false,
	popoverAlign = "start",
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	sound = false,
	haptics = true,
	animated = true,
	className,
	...props
}: LiveSaveStatusProps) {
	const prefersReduced = useReducedMotion();
	const reduced = Boolean(prefersReduced) || !animated;

	const resolvedLabels: Record<LiveSaveStatusState, string> = {
		...DEFAULT_LABELS,
		...labels,
	};

	const [visualStatus, setVisualStatus] = useState<LiveSaveStatusState>(status);
	const [saveSeq, setSaveSeq] = useState(0);
	const [errorSeq, setErrorSeq] = useState(0);
	const [freshSavedHold, setFreshSavedHold] = useState(false);
	const [actionPending, setActionPending] = useState(false);
	const [nowMs, setNowMs] = useState<number | null>(null);
	const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
	const [hasMountedWidth, setHasMountedWidth] = useState(false);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const [popoverShiftX, setPopoverShiftX] = useState(0);

	const rootRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	const prevVisualRef = useRef<LiveSaveStatusState>(status);
	const savingStartedAtRef = useRef<number | null>(
		status === "saving" ? Date.now() : null,
	);
	const floorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastCueRef = useRef(Number.NEGATIVE_INFINITY);
	const mountedRef = useRef(false);

	const popoverId = useId();
	const hasPopover =
		showPopover || Boolean(details) || Boolean(history && history.length > 0);
	const isControlledOpen = openProp !== undefined;
	const popoverOpen = hasPopover
		? isControlledOpen
			? openProp
			: uncontrolledOpen
		: false;

	const setPopoverOpen = useCallback(
		(next: boolean) => {
			if (!isControlledOpen) setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[isControlledOpen, onOpenChange],
	);

	// Sound & haptics
	const { trigger: haptic } = useWebHaptics();
	const { click: playSave } = useTiks({
		theme: SAVE_SOUND,
		volume: 0.16,
		respectReducedMotion: false,
	});
	const { click: playError } = useTiks({
		theme: ERROR_SOUND,
		volume: 0.16,
		respectReducedMotion: false,
	});
	const { click: playTap } = useTiks({
		theme: TAP_SOUND,
		volume: 0.12,
		respectReducedMotion: false,
	});

	const fireCue = useCallback(
		(kind: "save" | "error" | "tap") => {
			if (typeof document === "undefined") return;
			if (document.visibilityState === "hidden") return;
			const now = performance.now();
			if (now - lastCueRef.current < CUE_THROTTLE_MS) return;
			lastCueRef.current = now;
			if (sound) {
				if (kind === "save") playSave();
				else if (kind === "error") playError();
				else playTap();
			}
			if (
				haptics &&
				typeof window !== "undefined" &&
				window.matchMedia("(pointer: coarse)").matches
			) {
				void haptic(
					kind === "save" ? "success" : kind === "error" ? "error" : "light",
				);
			}
		},
		[haptic, haptics, playError, playSave, playTap, sound],
	);

	// Minimum saving display floor: keeps brief sub-second saves legible without blocking errors/unsaved/offline.
	useEffect(() => {
		if (floorTimerRef.current) {
			clearTimeout(floorTimerRef.current);
			floorTimerRef.current = null;
		}

		if (status === "saving") {
			if (savingStartedAtRef.current === null) {
				savingStartedAtRef.current = Date.now();
			}
			setVisualStatus("saving");
			return;
		}

		if (
			status === "saved" &&
			savingStartedAtRef.current !== null &&
			minSavingMs > 0
		) {
			const elapsed = Date.now() - savingStartedAtRef.current;
			const remaining = minSavingMs - elapsed;
			if (remaining > 16) {
				floorTimerRef.current = setTimeout(() => {
					savingStartedAtRef.current = null;
					setVisualStatus("saved");
				}, remaining);
				return;
			}
		}

		savingStartedAtRef.current = null;
		setVisualStatus(status);
	}, [minSavingMs, status]);

	// Clean up timers on unmount.
	useEffect(
		() => () => {
			if (floorTimerRef.current) clearTimeout(floorTimerRef.current);
			if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
		},
		[],
	);

	// React to settled visual state transitions (never fire cues/ripples/shakes on initial mount).
	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			prevVisualRef.current = visualStatus;
			return;
		}

		const previous = prevVisualRef.current;
		prevVisualRef.current = visualStatus;
		if (previous === visualStatus) return;

		if (holdTimerRef.current) {
			clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}

		if (visualStatus === "saved" && previous === "saving") {
			setSaveSeq((seq) => seq + 1);
			setFreshSavedHold(true);
			fireCue("save");
			holdTimerRef.current = setTimeout(() => {
				setFreshSavedHold(false);
			}, FRESH_SAVE_HOLD_MS);
		} else {
			setFreshSavedHold(false);
		}

		if (visualStatus === "error") {
			setErrorSeq((seq) => seq + 1);
			fireCue("error");
		}
	}, [fireCue, visualStatus]);

	// Clear shaking data attribute after error animation settles so future errors replay cleanly.
	const [shaking, setShaking] = useState(false);
	useEffect(() => {
		if (errorSeq === 0 || reduced) return;
		setShaking(true);
		const timer = setTimeout(() => setShaking(false), 340);
		return () => clearTimeout(timer);
	}, [errorSeq, reduced]);

	// Live relative clock ticking only when needed and when the tab is visible.
	const lastSavedMs = toTimestampMs(lastSavedAt);
	const wantsTimestamp =
		(showTimestamp ?? lastSavedMs !== null) && lastSavedMs !== null;

	useEffect(() => {
		const needsClock = wantsTimestamp || popoverOpen;
		if (!needsClock) return;

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const tick = () => {
			const current = Date.now();
			setNowMs(current);
			if (
				typeof document !== "undefined" &&
				document.visibilityState === "hidden"
			) {
				return;
			}
			const interval =
				lastSavedMs !== null
					? nextRelativeTickMs(lastSavedMs, current)
					: 30_000;
			timeoutId = setTimeout(tick, interval);
		};

		const onVisibility = () => {
			if (timeoutId) clearTimeout(timeoutId);
			if (document.visibilityState !== "hidden") tick();
		};

		tick();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			if (timeoutId) clearTimeout(timeoutId);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [lastSavedMs, popoverOpen, wantsTimestamp]);

	// Measure inner capsule width in local unzoomed CSS pixels via offsetWidth + ResizeObserver
	// so borders and text never scale-distort and CSS zoom never double-scales width.
	const recomputeWidth = useCallback(() => {
		const el = innerRef.current;
		if (!el) return;
		const nextWidth = Math.ceil(el.offsetWidth);
		if (nextWidth > 0) {
			setMeasuredWidth(nextWidth);
		}
	}, []);

	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		recomputeWidth();
		const raf = requestAnimationFrame(() => setHasMountedWidth(true));
		const observer = new ResizeObserver(recomputeWidth);
		observer.observe(el);
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
		};
	}, [recomputeWidth]);

	useLayoutEffect(() => {
		recomputeWidth();
	}, [
		recomputeWidth,
		visualStatus,
		variant,
		size,
		pendingCount,
		freshSavedHold,
		nowMs,
		labels,
		saveLabel,
		retryLabel,
		onSave,
		onRetry,
	]);

	// Clamp popover inside viewport margins (important at 390px mobile widths).
	useLayoutEffect(() => {
		if (!popoverOpen) {
			setPopoverShiftX(0);
			return;
		}
		const clamp = () => {
			const panel = popoverRef.current;
			if (!panel) return;
			const rect = panel.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			let shift = 0;
			if (rect.right > viewportWidth - POPOVER_MARGIN_PX) {
				shift = viewportWidth - POPOVER_MARGIN_PX - rect.right;
			} else if (rect.left < POPOVER_MARGIN_PX) {
				shift = POPOVER_MARGIN_PX - rect.left;
			}
			setPopoverShiftX((prev) => (Math.abs(prev - shift) > 0.5 ? shift : prev));
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, [popoverOpen, popoverAlign]);

	// Close popover on Escape or outside pointer-down.
	useEffect(() => {
		if (!popoverOpen) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			setPopoverOpen(false);
			triggerRef.current?.focus();
		};

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target) return;
			if (rootRef.current?.contains(target)) return;
			setPopoverOpen(false);
		};

		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [popoverOpen, setPopoverOpen]);

	const handleInlineAction = async (
		event: MouseEvent<HTMLButtonElement>,
		callback?: () => void | Promise<void>,
	) => {
		event.stopPropagation();
		if (!callback || actionPending) return;
		fireCue("tap");
		try {
			setActionPending(true);
			await callback();
		} finally {
			setActionPending(false);
		}
	};

	// Build concise visible label & relative suffix.
	const baseLabel = resolvedLabels[visualStatus];
	const countPrefix =
		(visualStatus === "unsaved" || visualStatus === "offline") &&
		typeof pendingCount === "number" &&
		pendingCount > 0;

	const primaryLabel =
		visualStatus === "unsaved" && countPrefix
			? `${pendingCount} ${baseLabel.toLowerCase()}`
			: baseLabel;

	const relativeTime =
		wantsTimestamp &&
		visualStatus === "saved" &&
		!freshSavedHold &&
		lastSavedMs !== null &&
		nowMs !== null
			? formatRelativeTime(lastSavedMs, nowMs)
			: null;

	const secondaryMeta =
		relativeTime ??
		(visualStatus === "offline" && countPrefix
			? `${pendingCount} queued`
			: null);

	const showSaveChip =
		variant !== "minimal" && visualStatus === "unsaved" && Boolean(onSave);
	const showRetryChip =
		variant !== "minimal" && visualStatus === "error" && Boolean(onRetry);

	const statusTitle =
		visualStatus === "error" && errorMessage
			? `${primaryLabel}: ${errorMessage}`
			: secondaryMeta
				? `${primaryLabel} · ${secondaryMeta}`
				: primaryLabel;

	// Live region announcements: only meaningful transitions, never ticking relative timestamps.
	const politeAnnouncement =
		visualStatus === "error"
			? ""
			: visualStatus === "saved"
				? "All changes saved"
				: visualStatus === "saving"
					? "Saving changes"
					: visualStatus === "unsaved"
						? pendingCount && pendingCount > 0
							? `${pendingCount} unsaved ${pendingCount === 1 ? "change" : "changes"}`
							: "Unsaved changes"
						: pendingCount && pendingCount > 0
							? `Offline, ${pendingCount} ${pendingCount === 1 ? "change" : "changes"} saved locally`
							: "Offline, changes saved locally";

	const alertAnnouncement =
		visualStatus === "error"
			? errorMessage
				? `${primaryLabel}. ${errorMessage}`
				: `${primaryLabel}. Retry to save changes.`
			: "";

	const promiseCopy = getStoragePromise(
		visualStatus,
		pendingCount,
		errorMessage,
	);

	const heightClass = size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]";
	const capsuleSurfaceClass =
		variant === "pill"
			? cn(
					"rounded-full bg-card text-foreground shadow-black/[0.04] shadow-xs ring-1",
					visualStatus === "error"
						? "ring-destructive/30"
						: visualStatus === "offline" || visualStatus === "unsaved"
							? "ring-amber-500/25 dark:ring-amber-400/25"
							: "ring-foreground/10",
				)
			: variant === "ghost"
				? cn(
						"rounded-full bg-transparent text-foreground",
						hasPopover && "hover:bg-muted/70",
					)
				: cn(
						"rounded-full bg-card text-foreground shadow-black/[0.04] shadow-xs ring-1",
						visualStatus === "error"
							? "ring-destructive/30"
							: "ring-foreground/10",
					);

	const popoverPositionClass =
		popoverAlign === "end"
			? "right-0 origin-top-right"
			: popoverAlign === "center"
				? "left-1/2 -translate-x-1/2 origin-top"
				: "left-0 origin-top-left";

	const statusBody = (
		<>
			<StatusSeal status={visualStatus} saveSeq={saveSeq} reduced={reduced} />

			{variant !== "minimal" ? (
				<span className="relative inline-flex items-center overflow-hidden py-0.5">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={`${visualStatus}-${primaryLabel}`}
							initial={
								reduced
									? { opacity: 0 }
									: { opacity: 0, y: 5, filter: "blur(2px)" }
							}
							animate={
								reduced
									? { opacity: 1 }
									: { opacity: 1, y: 0, filter: "blur(0px)" }
							}
							exit={
								reduced
									? { opacity: 0 }
									: { opacity: 0, y: -5, filter: "blur(2px)" }
							}
							transition={
								reduced
									? { duration: 0.12 }
									: { duration: 0.18, ease: EASE_OUT }
							}
							className={cn(
								"inline-flex items-baseline gap-1.5 whitespace-nowrap font-medium leading-none tracking-[-0.005em]",
								visualStatus === "error"
									? "text-destructive"
									: visualStatus === "saved"
										? "text-foreground/85"
										: "text-foreground",
							)}
						>
							<span className="max-w-[min(56vw,15rem)] truncate">
								{primaryLabel}
							</span>
							{secondaryMeta && (
								<span className="shrink-0 font-normal text-muted-foreground tabular-nums">
									· {secondaryMeta}
								</span>
							)}
						</motion.span>
					</AnimatePresence>
				</span>
			) : (
				countPrefix && (
					<span className="font-medium text-amber-700 tabular-nums dark:text-amber-300">
						{pendingCount}
					</span>
				)
			)}
		</>
	);

	return (
		<div
			ref={rootRef}
			data-slot="live-save-status"
			data-status={visualStatus}
			data-variant={variant}
			data-size={size}
			data-open={popoverOpen ? "true" : "false"}
			data-lss-shaking={shaking ? "" : undefined}
			className={cn("relative inline-flex max-w-full font-sans", className)}
			{...props}
		>
			<style href="tentui-live-save-status" precedence="medium">
				{STYLES}
			</style>

			{/* Outer spring-measured capsule (borders & radius stay 1:1 crisp, never scaled). */}
			<motion.div
				data-slot="live-save-status-capsule"
				initial={false}
				animate={measuredWidth !== null ? { width: measuredWidth } : undefined}
				transition={
					!hasMountedWidth || reduced ? { duration: 0 } : WIDTH_SPRING
				}
				className={cn(
					"relative inline-flex max-w-full items-center overflow-hidden transition-[box-shadow,background-color] duration-200",
					heightClass,
					capsuleSurfaceClass,
				)}
			>
				<div
					ref={innerRef}
					className={cn(
						"inline-flex w-max shrink-0 items-center",
						variant === "minimal"
							? cn("gap-1", size === "sm" ? "px-1.5" : "px-2")
							: showSaveChip || showRetryChip
								? cn("gap-1.5", size === "sm" ? "pr-1 pl-2.5" : "pr-1 pl-2.5")
								: cn("gap-1.5", size === "sm" ? "px-2.5" : "px-3"),
					)}
				>
					{hasPopover ? (
						<button
							ref={triggerRef}
							type="button"
							data-slot="live-save-status-trigger"
							aria-expanded={popoverOpen}
							aria-haspopup="dialog"
							aria-controls={popoverId}
							aria-label={variant === "minimal" ? statusTitle : undefined}
							title={statusTitle}
							onClick={() => {
								fireCue("tap");
								setPopoverOpen(!popoverOpen);
							}}
							className={cn(
								"inline-flex cursor-pointer items-center gap-1.5 rounded-full py-1 outline-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.98] motion-reduce:transform-none",
								size === "sm" ? "h-6" : "h-7",
							)}
						>
							{statusBody}
						</button>
					) : (
						<span
							data-slot="live-save-status-indicator"
							title={statusTitle}
							className="inline-flex items-center gap-1.5"
						>
							{statusBody}
							{variant === "minimal" && (
								<span className="sr-only">{statusTitle}</span>
							)}
						</span>
					)}

					<AnimatePresence initial={false} mode="popLayout">
						{showSaveChip && (
							<motion.button
								key="action-save"
								type="button"
								data-slot="live-save-status-action"
								disabled={actionPending}
								initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
								transition={{ duration: 0.15, ease: EASE_OUT }}
								onClick={(event) => void handleInlineAction(event, onSave)}
								className={cn(
									"inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground font-medium text-background outline-none transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-card active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none",
									size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
								)}
							>
								{saveLabel}
							</motion.button>
						)}

						{showRetryChip && (
							<motion.button
								key="action-retry"
								type="button"
								data-slot="live-save-status-action"
								disabled={actionPending}
								initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
								transition={{ duration: 0.15, ease: EASE_OUT }}
								onClick={(event) => void handleInlineAction(event, onRetry)}
								className={cn(
									"inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-destructive font-medium text-white outline-none transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none",
									size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
								)}
							>
								{retryLabel}
							</motion.button>
						)}
					</AnimatePresence>
				</div>
			</motion.div>

			{/* Optional anchored sync details & history popover. */}
			<AnimatePresence>
				{popoverOpen && (
					<motion.div
						ref={popoverRef}
						id={popoverId}
						role="dialog"
						aria-label="Save status details"
						data-slot="live-save-status-popover"
						initial={
							reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }
						}
						animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
						exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -3 }}
						transition={
							reduced ? { duration: 0.12 } : { duration: 0.17, ease: EASE_OUT }
						}
						style={
							popoverShiftX !== 0 ? { marginLeft: popoverShiftX } : undefined
						}
						className={cn(
							"absolute top-[calc(100%+8px)] z-50 w-[min(calc(100vw-2rem),18.5rem)] rounded-2xl bg-popover p-3.5 text-popover-foreground shadow-black/10 shadow-lg ring-1 ring-foreground/10 dark:shadow-black/35",
							popoverPositionClass,
						)}
					>
						<div className="flex items-start gap-2.5">
							<div className="mt-0.5">
								<StatusSeal
									status={visualStatus}
									saveSeq={0}
									reduced={reduced}
								/>
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground text-sm leading-5">
									{promiseCopy.heading}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
									{promiseCopy.description}
								</p>
							</div>
						</div>

						{lastSavedMs !== null && nowMs !== null && (
							<div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-2 text-xs">
								<span className="text-muted-foreground">Last saved</span>
								<span className="font-medium text-foreground tabular-nums">
									{formatExactTime(lastSavedMs, nowMs)}
								</span>
							</div>
						)}

						{details && (
							<div className="mt-3 text-muted-foreground text-xs leading-relaxed">
								{details}
							</div>
						)}

						{history && history.length > 0 && (
							<div className="mt-3 border-border/70 border-t pt-2.5">
								<p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.04em]">
									Recent checkpoints
								</p>
								<ul className="max-h-40 space-y-1 overflow-y-auto">
									{history.map((item) => {
										const itemMs = toTimestampMs(item.savedAt);
										const itemRel =
											itemMs !== null && nowMs !== null
												? formatRelativeTime(itemMs, nowMs)
												: null;
										return (
											<li
												key={item.id}
												className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60"
											>
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-foreground">
														{item.label}
													</p>
													<p className="truncate text-[11px] text-muted-foreground tabular-nums">
														{[item.author, itemRel].filter(Boolean).join(" · ")}
													</p>
												</div>
												{onRestore && (
													<button
														type="button"
														onClick={() => {
															fireCue("tap");
															onRestore(item);
															setPopoverOpen(false);
														}}
														className="shrink-0 cursor-pointer rounded-md px-2 py-1 font-medium text-[11px] text-foreground/80 outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
													>
														Restore
													</button>
												)}
											</li>
										);
									})}
								</ul>
							</div>
						)}

						{((visualStatus === "unsaved" && onSave) ||
							(visualStatus === "error" && onRetry)) && (
							<div className="mt-3 flex items-center justify-between gap-2 border-border/70 border-t pt-2.5">
								<button
									type="button"
									disabled={actionPending}
									onClick={(event) => {
										void handleInlineAction(
											event,
											visualStatus === "error" ? onRetry : onSave,
										);
									}}
									className={cn(
										"inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 font-medium text-xs outline-none transition-[transform,opacity] duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.98] disabled:opacity-50",
										visualStatus === "error"
											? "bg-destructive text-white"
											: "bg-foreground text-background",
									)}
								>
									{visualStatus === "error"
										? `${retryLabel} sync`
										: `${saveLabel} now`}
								</button>
								{shortcut && visualStatus === "unsaved" && (
									<kbd className="inline-flex h-7 shrink-0 items-center rounded-lg bg-muted px-2 font-mono text-[11px] text-muted-foreground ring-1 ring-foreground/8">
										{shortcut}
									</kbd>
								)}
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Screen reader live regions: polite for normal lifecycle, assertive for failures. */}
			<span
				className="sr-only"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				{politeAnnouncement}
			</span>
			<span className="sr-only" role="alert" aria-atomic="true">
				{alertAnnouncement}
			</span>
		</div>
	);
}

export default LiveSaveStatus;
