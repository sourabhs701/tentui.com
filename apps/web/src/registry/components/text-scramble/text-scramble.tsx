"use client";

import {
	type ComponentProps,
	type FocusEvent,
	type PointerEvent,
	type Ref,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Preset glyph pools curated for clean typographic rhythm. */
const CHARACTER_PRESETS = {
	alphanumeric:
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
	letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	lowercase: "abcdefghijklmnopqrstuvwxyz",
	numeric: "0123456789",
	binary: "01",
	symbols: "!#$%&*+-/:;<=>?@^_~",
} as const;

const UPPERCASE_POOL = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const LOWERCASE_POOL = Array.from("abcdefghijklmnopqrstuvwxyz");
const DIGIT_POOL = Array.from("0123456789");

/** Duration of the crisp vertical settle when a character locks into place. */
const LOCK_SETTLE_MS = 110;
/** Vertical offset in px at the instant a character locks in. */
const LOCK_OFFSET_PX = -1.5;
/** Lead time before a character's settle moment where cycling decelerates. */
const DECEL_WINDOW_MS = 180;
/** Reduced-motion crossfade duration when dynamic text changes. */
const REDUCED_FADE_MS = 180;
/** Maximum movement in px on touch before a press is treated as a scroll. */
const TOUCH_TAP_SLOP_PX = 10;

/** Display scale presets: leading tightens and tracking narrows with size. */
const sizes = {
	sm: "text-xl leading-[1.2] tracking-[-0.02em] font-semibold sm:text-2xl",
	md: "text-3xl leading-[1.14] tracking-[-0.025em] font-semibold sm:text-4xl sm:leading-[1.12]",
	lg: "text-3xl leading-[1.12] tracking-[-0.025em] font-semibold sm:text-5xl sm:leading-[1.06] sm:tracking-[-0.03em]",
	xl: "text-4xl leading-[1.08] tracking-[-0.03em] font-semibold sm:text-6xl sm:tracking-[-0.035em]",
} as const;

export type TextScrambleElement =
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "p"
	| "span"
	| "div";
export type TextScrambleSize = keyof typeof sizes;
export type TextScrambleTrigger = "mount" | "view" | "hover" | "manual";
export type TextScrambleDirection = "ltr" | "rtl" | "center" | "random";
export type TextScramblePreset = keyof typeof CHARACTER_PRESETS;
export type TextScrambleCharacterSet = TextScramblePreset | (string & {});

export interface TextScrambleHandle {
	/** Play a fresh scramble from start to settled text. */
	scramble: () => void;
	/** Alias for `scramble()` for consistency with TentUI text animations. */
	replay: () => void;
	/** Immediately stop scrambling and settle on the final text. */
	reset: () => void;
}

interface GraphemeSlot {
	text: string;
	left: number;
	top: number;
	width: number;
	height: number;
	/** Normalized 0..1 resolve order along the sweep. */
	order: number;
	/** Whether this slot scrambles or stays anchored (e.g. punctuation). */
	scramblable: boolean;
	/** Optical-width-safe candidate glyphs for this slot. */
	pool: string[];
	/** Settle timestamp in ms relative to animation start. */
	settleAt: number;
	/** Next allowed glyph swap timestamp in ms relative to animation start. */
	nextFlipAt: number;
	/** Index of the last chosen glyph to prevent back-to-back repeats. */
	lastGlyphIndex: number;
	/** Whether this slot has already locked onto its final character. */
	settled: boolean;
	/** Whether this slot's lock-in settle transition has finished. */
	finished: boolean;
	span: HTMLSpanElement;
}

interface EngineOptions {
	text: string;
	trigger: TextScrambleTrigger;
	direction: TextScrambleDirection;
	duration: number;
	speed: number;
	characterSet: TextScrambleCharacterSet;
	active?: boolean;
	reducedMotion: boolean;
	scrambleClassName?: string;
	onComplete?: () => void;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Stable 0..1 hash so per-character micro-stagger feels organic yet crisp. */
function hash(a: number, b: number) {
	let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
	return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Strong ease-out curve for the per-glyph lock-in settle. */
function easeOutQuint(t: number) {
	const x = clamp(t, 0, 1);
	return 1 - (1 - x) ** 5;
}

/** Smooth ease-out curve for the resolve wave progression. */
function easeOutQuad(t: number) {
	const x = clamp(t, 0, 1);
	return 1 - (1 - x) ** 2;
}

function subscribeToReducedMotion(onStoreChange: () => void) {
	const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);
	return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribeToReducedMotion,
		() => window.matchMedia(REDUCED_MOTION_QUERY).matches,
		() => false,
	);
}

function segmentGraphemes(data: string) {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(data), (part) => ({
			index: part.index,
			value: part.segment,
		}));
	}
	const parts: { index: number; value: string }[] = [];
	let index = 0;
	for (const value of data) {
		parts.push({ index, value });
		index += value.length;
	}
	return parts;
}

function widestRect(rects: DOMRectList): DOMRect | null {
	let best: DOMRect | null = null;
	for (const candidate of rects) {
		if (candidate.height === 0) continue;
		if (!best || candidate.width > best.width) best = candidate;
	}
	return best;
}

function isPunctuationOrSymbol(char: string) {
	return /^[\p{P}\p{S}]$/u.test(char);
}

function isAsciiUpper(char: string) {
	return /^[A-Z]$/.test(char);
}

function isAsciiLower(char: string) {
	return /^[a-z]$/.test(char);
}

function isAsciiDigit(char: string) {
	return /^[0-9]$/.test(char);
}

function resolveRawPool(
	characterSet: TextScrambleCharacterSet,
	targetChar: string,
	textTransform: string,
): { pool: string[]; scramblable: boolean } {
	if (
		characterSet === "alphanumeric" ||
		characterSet === "letters" ||
		characterSet === "numeric"
	) {
		if (isPunctuationOrSymbol(targetChar)) {
			return { pool: [targetChar], scramblable: false };
		}
	}

	if (characterSet === "alphanumeric") {
		if (isAsciiDigit(targetChar)) {
			return { pool: DIGIT_POOL, scramblable: true };
		}
		if (textTransform === "uppercase" || isAsciiUpper(targetChar)) {
			return { pool: UPPERCASE_POOL, scramblable: true };
		}
		if (textTransform === "lowercase" || isAsciiLower(targetChar)) {
			return { pool: LOWERCASE_POOL, scramblable: true };
		}
		return {
			pool: textTransform === "uppercase" ? UPPERCASE_POOL : LOWERCASE_POOL,
			scramblable: true,
		};
	}

	if (characterSet === "letters") {
		if (textTransform === "uppercase" || isAsciiUpper(targetChar)) {
			return { pool: UPPERCASE_POOL, scramblable: true };
		}
		return { pool: LOWERCASE_POOL, scramblable: true };
	}

	if (characterSet in CHARACTER_PRESETS) {
		const preset = CHARACTER_PRESETS[characterSet as TextScramblePreset];
		return { pool: Array.from(preset), scramblable: true };
	}

	const custom = Array.from(characterSet).filter((c) => !/^\s$/.test(c));
	if (custom.length === 0) {
		return { pool: LOWERCASE_POOL, scramblable: true };
	}
	return { pool: custom, scramblable: true };
}

/** Shared canvas context for measuring optical glyph advance widths once. */
let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext() {
	if (measureContext !== undefined) return measureContext;
	if (typeof document === "undefined") {
		measureContext = null;
		return null;
	}
	measureContext = document.createElement("canvas").getContext("2d");
	return measureContext;
}

/**
 * Filters a glyph pool so proportional fonts never swap a narrow slot (`i`, `l`)
 * with an oversized glyph (`W`, `M`) that would collide with neighbouring letters.
 */
function selectWidthMatchedPool(
	pool: string[],
	slotWidth: number,
	widthCache: Map<string, number>,
	ctx: CanvasRenderingContext2D | null,
) {
	if (!ctx || pool.length <= 4 || slotWidth <= 0) return pool;

	const getWidth = (glyph: string) => {
		const cached = widthCache.get(glyph);
		if (cached !== undefined) return cached;
		const measured = ctx.measureText(glyph).width;
		widthCache.set(glyph, measured);
		return measured;
	};

	const maxAllowed = slotWidth * 1.16;
	const fitting: string[] = [];
	for (const glyph of pool) {
		if (getWidth(glyph) <= maxAllowed) fitting.push(glyph);
	}
	if (fitting.length >= 4) return fitting;

	// Fallback for ultra-narrow letters: pick the closest-width glyphs in the pool.
	const ranked = [...pool].sort(
		(a, b) =>
			Math.abs(getWidth(a) - slotWidth) - Math.abs(getWidth(b) - slotWidth),
	);
	return ranked.slice(0, Math.min(6, ranked.length));
}

function commonPrefixGraphemeCount(prev: string, next: string) {
	if (!prev || !next || prev === next) return 0;
	const prevParts = segmentGraphemes(prev);
	const nextParts = segmentGraphemes(next);
	let sharedNonSpace = 0;
	let matched = 0;
	const limit = Math.min(prevParts.length, nextParts.length);
	while (
		matched < limit &&
		prevParts[matched]?.value === nextParts[matched]?.value
	) {
		if (!/^\s+$/.test(prevParts[matched]!.value)) {
			sharedNonSpace++;
		}
		matched++;
	}
	// Preserve a shared prefix only when it ends on a clean word boundary
	// (e.g. "Status: Queued" -> "Status: Ready"), not partial letter overlap.
	if (matched === 0 || matched >= nextParts.length) return 0;
	const lastMatched = prevParts[matched - 1]?.value ?? "";
	if (!/^\s+$/.test(lastMatched)) return 0;
	return sharedNonSpace;
}

/**
 * Owns the measured grapheme overlay and idle-stopping `requestAnimationFrame`
 * loop so glyph flips never trigger React re-renders or layout reflow.
 */
class TextScrambleEngine {
	private root: HTMLElement;
	private textElement: HTMLElement;
	private layer: HTMLElement;
	private options: EngineOptions;

	private slots: GraphemeSlot[] = [];
	private running = false;
	private selecting = false;
	private destroyed = false;
	private viewed = false;
	private runSeed = 1;
	private startTime: number | null = null;
	private frame = 0;
	private resizeFrame = 0;
	private fadeTimer = 0;
	private hoverInside = false;
	private touchStart: { id: number; x: number; y: number } | null = null;
	private cleanups: (() => void)[] = [];

	constructor(
		root: HTMLElement,
		textElement: HTMLElement,
		layer: HTMLElement,
		options: EngineOptions,
	) {
		this.root = root;
		this.textElement = textElement;
		this.layer = layer;
		this.options = options;

		const resizeObserver = new ResizeObserver(() => {
			if (!this.running || this.resizeFrame) return;
			this.resizeFrame = requestAnimationFrame(() => {
				this.resizeFrame = 0;
				if (this.running) this.repositionOverlay();
			});
		});
		resizeObserver.observe(root);

		const intersectionObserver = new IntersectionObserver(
			([entry]) => {
				if (!entry) return;
				if (
					entry.isIntersecting &&
					entry.intersectionRatio >= 0.35 &&
					!this.viewed &&
					this.options.trigger === "view"
				) {
					this.viewed = true;
					if (!this.options.reducedMotion) {
						this.start(0);
					}
				}
			},
			{ threshold: [0, 0.35] },
		);
		intersectionObserver.observe(root);

		const onVisibility = () => {
			if (document.hidden && this.running) {
				this.finish(true);
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		const onSelectionChange = () => this.syncSelectionState();
		document.addEventListener("selectionchange", onSelectionChange);

		this.cleanups.push(
			() => resizeObserver.disconnect(),
			() => intersectionObserver.disconnect(),
			() => document.removeEventListener("visibilitychange", onVisibility),
			() => document.removeEventListener("selectionchange", onSelectionChange),
		);

		if (
			!options.reducedMotion &&
			(options.trigger === "mount" ||
				(options.trigger === "manual" && options.active))
		) {
			if (!document.fonts || document.fonts.status === "loaded") {
				this.start(0);
			} else {
				void document.fonts.ready.then(() => {
					if (!this.destroyed && !this.options.reducedMotion) this.start(0);
				});
			}
		}
	}

	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.resizeFrame);
		window.clearTimeout(this.fadeTimer);
		for (const cleanup of this.cleanups) cleanup();
		this.teardownOverlay();
	}

	setOptions(next: EngineOptions) {
		const prev = this.options;
		this.options = next;

		if (next.reducedMotion) {
			if (this.running) this.finish(false);
			if (prev.text !== next.text) {
				this.runReducedFade();
			} else if (next.trigger === "manual" && next.active && !prev.active) {
				next.onComplete?.();
			}
			return;
		}

		if (prev.text !== next.text) {
			const sharedPrefix = commonPrefixGraphemeCount(prev.text, next.text);
			if (next.trigger !== "manual" || next.active !== false) {
				this.start(sharedPrefix);
			} else if (this.running) {
				this.finish(false);
			}
			return;
		}

		if (next.trigger === "manual" && prev.active !== next.active) {
			if (next.active) {
				this.start(0);
			} else if (this.running) {
				this.finish(false);
			}
		}
	}

	scramble() {
		if (this.destroyed) return;
		if (this.options.reducedMotion) {
			this.runReducedFade();
			this.options.onComplete?.();
			return;
		}
		this.start(0);
	}

	reset() {
		if (this.destroyed) return;
		if (this.running) {
			this.finish(false);
		}
	}

	// ── Pointer & keyboard handlers ───────────────────────────────────────

	onPointerEnter(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") return;
		if (this.options.trigger !== "hover") return;
		if (this.hoverInside) return;
		this.hoverInside = true;
		this.scramble();
	}

	onPointerLeave(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") return;
		this.hoverInside = false;
	}

	onPointerDown(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			if (this.options.trigger !== "hover") return;
			this.touchStart = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			};
			return;
		}
		if (event.button === 0 && this.running) {
			// Step aside immediately so mouse drag-selection works on real text.
			this.setSelecting(true);
		}
	}

	onPointerUp(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			const start = this.touchStart;
			this.touchStart = null;
			if (!start || start.id !== event.pointerId) return;
			const moved = Math.hypot(
				event.clientX - start.x,
				event.clientY - start.y,
			);
			if (moved <= TOUCH_TAP_SLOP_PX && this.options.trigger === "hover") {
				this.scramble();
			}
			return;
		}
		requestAnimationFrame(() => this.syncSelectionState());
	}

	onPointerCancel() {
		this.touchStart = null;
	}

	onFocus(event: FocusEvent<HTMLElement>) {
		if (this.options.trigger !== "hover") return;
		let visible = false;
		try {
			visible = event.currentTarget.matches(":focus-visible");
		} catch {
			visible = true;
		}
		if (visible) {
			this.scramble();
		}
	}

	// ── Selection handling ────────────────────────────────────────────────

	private setSelecting(selecting: boolean) {
		if (this.selecting === selecting) return;
		this.selecting = selecting;
		if (selecting) {
			this.textElement.style.color = "";
			this.layer.style.visibility = "hidden";
		} else if (this.running) {
			this.textElement.style.color = "transparent";
			this.layer.style.visibility = "visible";
		}
	}

	private syncSelectionState() {
		if (!this.running) {
			this.setSelecting(false);
			return;
		}
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) {
			this.setSelecting(false);
			return;
		}
		const inside =
			(selection.anchorNode !== null &&
				this.root.contains(selection.anchorNode)) ||
			(selection.focusNode !== null && this.root.contains(selection.focusNode));
		this.setSelecting(inside);
	}

	// ── Reduced motion gentle crossfade ───────────────────────────────────

	private runReducedFade() {
		window.clearTimeout(this.fadeTimer);
		this.textElement.style.transition = `opacity ${REDUCED_FADE_MS}ms ease-out`;
		this.textElement.style.opacity = "0.55";
		requestAnimationFrame(() => {
			if (this.destroyed) return;
			this.textElement.style.opacity = "1";
		});
		this.fadeTimer = window.setTimeout(() => {
			if (this.destroyed) return;
			this.textElement.style.transition = "";
			this.textElement.style.opacity = "";
		}, REDUCED_FADE_MS + 30);
	}

	// ── Scramble lifecycle ────────────────────────────────────────────────

	private start(skipLeadingCount: number) {
		if (this.options.reducedMotion) return;
		cancelAnimationFrame(this.frame);
		this.frame = 0;

		const built = this.buildSlots(skipLeadingCount);
		if (!built) {
			this.teardownOverlay();
			this.running = false;
			this.root.dataset.state = "settled";
			this.options.onComplete?.();
			return;
		}

		this.running = true;
		this.startTime = null;
		this.root.dataset.state = "scrambling";
		if (!this.selecting) {
			this.textElement.style.color = "transparent";
			this.layer.style.visibility = "visible";
		}

		// Paint the initial scrambled frame synchronously so there is no blank flash.
		this.paint(0);
		this.frame = requestAnimationFrame((now) => this.tick(now));
	}

	private finish(notify: boolean) {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.running = false;
		this.startTime = null;
		this.selecting = false;
		this.teardownOverlay();
		this.root.dataset.state = "settled";
		if (notify) {
			this.options.onComplete?.();
		}
	}

	private teardownOverlay() {
		this.textElement.style.color = "";
		this.layer.style.visibility = "";
		this.layer.replaceChildren();
		this.slots = [];
	}

	private measureGraphemes() {
		const rect = this.root.getBoundingClientRect();
		const zoom = this.root.offsetWidth ? rect.width / this.root.offsetWidth : 1;
		const scale = zoom || 1;
		if (!rect.width || !rect.height) return null;

		const toLocal = (x: number, y: number) => ({
			x: (x - rect.left) / scale,
			y: (y - rect.top) / scale,
		});

		const boxes: {
			text: string;
			left: number;
			top: number;
			width: number;
			height: number;
		}[] = [];

		const range = document.createRange();
		const walker = document.createTreeWalker(
			this.textElement,
			NodeFilter.SHOW_TEXT,
		);

		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const textNode = node as Text;
			for (const segment of segmentGraphemes(textNode.data)) {
				if (/^\s+$/.test(segment.value)) continue;
				range.setStart(textNode, segment.index);
				range.setEnd(textNode, segment.index + segment.value.length);
				const box = widestRect(range.getClientRects());
				if (!box) continue;
				const corner = toLocal(box.left, box.top);
				boxes.push({
					text: segment.value,
					left: corner.x,
					top: corner.y,
					width: box.width / scale,
					height: box.height / scale,
				});
			}
		}
		range.detach();
		return boxes;
	}

	private repositionOverlay() {
		const boxes = this.measureGraphemes();
		if (!boxes || boxes.length !== this.slots.length) return;
		for (let i = 0; i < boxes.length; i++) {
			const box = boxes[i]!;
			const slot = this.slots[i]!;
			slot.left = box.left;
			slot.top = box.top;
			slot.width = box.width;
			slot.height = box.height;
			slot.span.style.left = slot.settled
				? `${box.left}px`
				: `${box.left + box.width / 2}px`;
			slot.span.style.top = `${box.top}px`;
		}
	}

	private buildSlots(skipLeadingCount: number) {
		const boxes = this.measureGraphemes();
		if (!boxes || boxes.length === 0) return false;

		const computed = getComputedStyle(this.textElement);
		const rtl = computed.direction === "rtl";
		const direction =
			rtl && this.options.direction === "ltr"
				? "rtl"
				: rtl && this.options.direction === "rtl"
					? "ltr"
					: this.options.direction;

		const ctx = getMeasureContext();
		if (ctx) {
			ctx.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
		}
		const widthCache = new Map<string, number>();

		const duration = clamp(this.options.duration, 150, 5000);
		const speed = clamp(this.options.speed, 16, 200);
		const waveDuration = Math.max(duration - LOCK_SETTLE_MS, 100);
		const leadMs = Math.min(speed * 2.2, waveDuration * 0.25);
		const sweepSpan = Math.max(waveDuration - leadMs, 60);

		const seed = ++this.runSeed;
		const total = boxes.length;
		const activeCount = Math.max(total - skipLeadingCount, 1);
		const center = skipLeadingCount + (activeCount - 1) / 2;
		const maxCenterDist = Math.max(activeCount / 2, 1);

		const fragment = document.createDocumentFragment();
		const slots: GraphemeSlot[] = [];

		for (let i = 0; i < total; i++) {
			const box = boxes[i]!;
			const isSkippedPrefix = i < skipLeadingCount;
			const { pool: rawPool, scramblable } = resolveRawPool(
				this.options.characterSet,
				box.text,
				computed.textTransform,
			);
			const shouldScramble = scramblable && !isSkippedPrefix;
			const pool = shouldScramble
				? selectWidthMatchedPool(rawPool, box.width, widthCache, ctx)
				: [box.text];

			const relativeIndex = Math.max(i - skipLeadingCount, 0);
			let order = 0;
			if (activeCount > 1) {
				if (direction === "rtl") {
					order = (activeCount - 1 - relativeIndex) / (activeCount - 1);
				} else if (direction === "center") {
					order = Math.abs(i - center) / maxCenterDist;
				} else if (direction === "random") {
					order = hash(i + 13, seed * 37);
				} else {
					order = relativeIndex / (activeCount - 1);
				}
			}

			// Subtle deterministic micro-jitter keeps the resolve front organic.
			const jitter =
				direction === "random" ? 0 : (hash(i + 7, seed * 19) - 0.5) * 0.08;
			const normalized = clamp(order + jitter, 0, 1);
			const settleAt = shouldScramble
				? leadMs + easeOutQuad(normalized) * sweepSpan
				: 0;

			const span = document.createElement("span");
			span.style.position = "absolute";
			span.style.top = `${box.top}px`;
			span.style.whiteSpace = "pre";
			span.style.lineHeight = "normal";
			span.style.letterSpacing = "0px";
			span.style.willChange = shouldScramble ? "transform, opacity" : "";

			if (shouldScramble) {
				// Center substitute glyphs on the slot's optical midpoint so neighbors never collide.
				span.style.left = `${box.left + box.width / 2}px`;
				span.style.transform = "translate3d(-50%, 0, 0)";
				span.dataset.state = "scrambling";
				if (this.options.scrambleClassName) {
					span.className = this.options.scrambleClassName;
				}
			} else {
				span.style.left = `${box.left}px`;
				span.textContent = box.text;
				span.dataset.state = "settled";
			}

			fragment.appendChild(span);

			slots.push({
				text: box.text,
				left: box.left,
				top: box.top,
				width: box.width,
				height: box.height,
				order: normalized,
				scramblable: shouldScramble,
				pool,
				settleAt,
				nextFlipAt: 0,
				lastGlyphIndex: -1,
				settled: !shouldScramble,
				finished: !shouldScramble,
				span,
			});
		}

		this.layer.replaceChildren(fragment);
		this.slots = slots;
		return slots.some((slot) => slot.scramblable);
	}

	private pickGlyph(slot: GraphemeSlot, index: number, step: number) {
		const pool = slot.pool;
		if (pool.length <= 1) return pool[0] ?? slot.text;
		let pick = Math.floor(
			hash(index * 131 + this.runSeed * 17, step * 53) * pool.length,
		);
		if (pick === slot.lastGlyphIndex || pool[pick] === slot.text) {
			pick = (pick + 1) % pool.length;
		}
		if (pool[pick] === slot.text && pool.length > 2) {
			pick = (pick + 1) % pool.length;
		}
		slot.lastGlyphIndex = pick;
		return pool[pick]!;
	}

	private tick(now: number) {
		this.frame = 0;
		if (this.destroyed || !this.running) return;
		if (document.hidden) {
			this.finish(true);
			return;
		}
		if (this.startTime === null) this.startTime = now;
		const elapsed = now - this.startTime;

		const allDone = this.paint(elapsed);
		if (allDone) {
			this.finish(true);
			return;
		}
		this.frame = requestAnimationFrame((nextNow) => this.tick(nextNow));
	}

	private paint(elapsed: number) {
		const baseSpeed = clamp(this.options.speed, 16, 200);
		let allFinished = true;

		for (let i = 0; i < this.slots.length; i++) {
			const slot = this.slots[i]!;
			if (slot.finished) continue;

			if (!slot.settled) {
				if (elapsed >= slot.settleAt) {
					slot.settled = true;
					slot.span.textContent = slot.text;
					slot.span.style.left = `${slot.left}px`;
					slot.span.dataset.state = "settled";
					if (this.options.scrambleClassName) {
						slot.span.className = "";
					}
					slot.span.style.opacity = "1";
				} else {
					allFinished = false;
					const remaining = slot.settleAt - elapsed;
					// Decelerate flip cadence as the resolve front closes in.
					const decelProgress =
						remaining < DECEL_WINDOW_MS ? 1 - remaining / DECEL_WINDOW_MS : 0;
					const interval = baseSpeed * (1 + decelProgress * 1.35);

					if (elapsed >= slot.nextFlipAt) {
						const step = Math.floor(elapsed / baseSpeed) + 1;
						slot.span.textContent = this.pickGlyph(slot, i, step);
						slot.nextFlipAt = elapsed + interval;
					}

					// Soften scrambling ink, brightening gently right before locking in.
					const ink = 0.48 + decelProgress * 0.24;
					slot.span.style.opacity = ink.toFixed(2);
					continue;
				}
			}

			// Crisp, critically-damped vertical micro-settle after locking in.
			const sinceLock = elapsed - slot.settleAt;
			if (sinceLock >= LOCK_SETTLE_MS) {
				slot.finished = true;
				slot.span.style.transform = "";
				slot.span.style.willChange = "";
			} else {
				allFinished = false;
				const progress = easeOutQuint(sinceLock / LOCK_SETTLE_MS);
				const dy = LOCK_OFFSET_PX * (1 - progress);
				slot.span.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0)`;
			}
		}

		return allFinished;
	}
}

export interface TextScrambleProps
	extends Omit<ComponentProps<"span">, "children" | "ref"> {
	/** Plain string to scramble and settle. Updating `children` automatically scrambles to the new text. */
	children: string;
	/** Semantic HTML element to render. Defaults to `"span"`. */
	as?: TextScrambleElement;
	/** Optional display typography scale preset. Omit to inherit surrounding font styling. */
	size?: TextScrambleSize;
	/** When the scramble runs: `"view"` on entering viewport, `"mount"` immediately, `"hover"` on pointer enter, keyboard focus, or tap, or `"manual"` via `active` or ref. Defaults to `"view"`. */
	trigger?: TextScrambleTrigger;
	/** Sweep order in which characters lock into place. Defaults to `"ltr"`. */
	direction?: TextScrambleDirection;
	/** Total scramble duration in milliseconds (150–5000). Defaults to `650`. */
	duration?: number;
	/** Base interval in milliseconds between glyph flips before deceleration (16–200). Defaults to `38`. */
	speed?: number;
	/** Character preset (`"alphanumeric"`, `"letters"`, `"uppercase"`, `"lowercase"`, `"numeric"`, `"binary"`, `"symbols"`) or a custom string of glyphs. Defaults to `"alphanumeric"`. */
	characterSet?: TextScrambleCharacterSet;
	/** Controlled trigger for `trigger="manual"`: setting `true` runs a scramble and `false` settles immediately. */
	active?: boolean;
	/** Set to `false` to disable all animation and render static text. Defaults to `true`. */
	animated?: boolean;
	/** Extra class name applied to glyphs while they are actively scrambling. */
	scrambleClassName?: string;
	/** Called when a scramble run finishes settling on the final text. */
	onScrambleComplete?: () => void;
	/** Imperative handle exposing `scramble()`, `replay()`, and `reset()`. */
	ref?: Ref<TextScrambleHandle>;
}

export function TextScramble({
	children,
	as: Tag = "span",
	size,
	trigger = "view",
	direction = "ltr",
	duration = 650,
	speed = 38,
	characterSet = "alphanumeric",
	active,
	animated = true,
	scrambleClassName,
	onScrambleComplete,
	className,
	onPointerEnter,
	onPointerLeave,
	onPointerDown,
	onPointerUp,
	onPointerCancel,
	onFocus,
	ref,
	...props
}: TextScrambleProps) {
	const rootRef = useRef<HTMLElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const layerRef = useRef<HTMLSpanElement>(null);
	const engineRef = useRef<TextScrambleEngine | null>(null);
	const onCompleteRef = useRef(onScrambleComplete);

	const prefersReducedMotion = usePrefersReducedMotion();
	const reducedMotion = !animated || prefersReducedMotion;

	const options: EngineOptions = {
		text: children,
		trigger,
		direction,
		duration,
		speed,
		characterSet,
		active,
		reducedMotion,
		scrambleClassName,
		onComplete: () => onCompleteRef.current?.(),
	};
	const latestOptionsRef = useRef<EngineOptions>(options);

	useLayoutEffect(() => {
		onCompleteRef.current = onScrambleComplete;
		latestOptionsRef.current = options;
	});

	useImperativeHandle(ref, () => ({
		scramble: () => engineRef.current?.scramble(),
		replay: () => engineRef.current?.scramble(),
		reset: () => engineRef.current?.reset(),
	}));

	useLayoutEffect(() => {
		const root = rootRef.current;
		const textElement = textRef.current;
		const layer = layerRef.current;
		if (!root || !textElement || !layer) return;

		const engine = new TextScrambleEngine(
			root,
			textElement,
			layer,
			latestOptionsRef.current,
		);
		engineRef.current = engine;

		return () => {
			engine.destroy();
			engineRef.current = null;
		};
	}, []);

	useLayoutEffect(() => {
		engineRef.current?.setOptions({
			text: children,
			trigger,
			direction,
			duration,
			speed,
			characterSet,
			active,
			reducedMotion,
			scrambleClassName,
			onComplete: () => onCompleteRef.current?.(),
		});
	}, [
		children,
		trigger,
		direction,
		duration,
		speed,
		characterSet,
		active,
		reducedMotion,
		scrambleClassName,
	]);

	const isInlineTag = Tag === "span";

	return (
		<Tag
			ref={rootRef as never}
			data-slot="text-scramble"
			data-state="settled"
			className={cn(
				"relative max-w-full rounded-sm outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				isInlineTag ? "inline-block" : "block",
				size ? sizes[size] : undefined,
				className,
			)}
			onPointerEnter={(event: PointerEvent<HTMLElement>) => {
				engineRef.current?.onPointerEnter(event);
				onPointerEnter?.(event as PointerEvent<HTMLSpanElement>);
			}}
			onPointerLeave={(event: PointerEvent<HTMLElement>) => {
				engineRef.current?.onPointerLeave(event);
				onPointerLeave?.(event as PointerEvent<HTMLSpanElement>);
			}}
			onPointerDown={(event: PointerEvent<HTMLElement>) => {
				engineRef.current?.onPointerDown(event);
				onPointerDown?.(event as PointerEvent<HTMLSpanElement>);
			}}
			onPointerUp={(event: PointerEvent<HTMLElement>) => {
				engineRef.current?.onPointerUp(event);
				onPointerUp?.(event as PointerEvent<HTMLSpanElement>);
			}}
			onPointerCancel={(event: PointerEvent<HTMLElement>) => {
				engineRef.current?.onPointerCancel();
				onPointerCancel?.(event as PointerEvent<HTMLSpanElement>);
			}}
			onFocus={(event: FocusEvent<HTMLElement>) => {
				engineRef.current?.onFocus(event);
				onFocus?.(event as FocusEvent<HTMLSpanElement>);
			}}
			{...props}
		>
			<span ref={textRef} data-slot="text-scramble-text">
				{children}
			</span>
			<span
				ref={layerRef}
				aria-hidden="true"
				data-slot="text-scramble-overlay"
				className="pointer-events-none absolute inset-0 select-none"
			/>
		</Tag>
	);
}
