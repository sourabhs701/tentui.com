"use client";

import {
	type ComponentProps,
	type FocusEvent,
	type PointerEvent,
	type Ref,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Maximum physics sub-step in seconds (120Hz) for unconditional stability. */
const MAX_STEP = 1 / 120;
/** Maximum frame delta in seconds to guard against backgrounded-tab spikes. */
const MAX_DT = 0.05;
/** Thresholds below which a resting unit is considered fully settled. */
const SETTLE_EPSILON = 0.001;
const VELOCITY_EPSILON = 0.005;
/** Touch movement in CSS px before committing to drag vs vertical scroll. */
const TOUCH_SLOP_PX = 6;
/** Duration in ms of the gentle swell impulse on a quick touch tap. */
const TAP_IMPULSE_MS = 180;
/** Windowed Gaussian decay factor (exact zero at distance === radius). */
const GAUSSIAN_K = 4.5;
const GAUSSIAN_EDGE = Math.exp(-GAUSSIAN_K);

/** Display scale presets: leading tightens and tracking narrows with size. */
const sizes = {
	sm: "text-2xl leading-[1.2] tracking-[-0.02em]",
	md: "text-4xl leading-[1.12] tracking-[-0.025em]",
	lg: "text-4xl leading-[1.1] tracking-[-0.025em] sm:text-5xl sm:leading-[1.06] sm:tracking-[-0.03em]",
	xl: "text-5xl leading-[1.06] tracking-[-0.03em] sm:text-6xl sm:tracking-[-0.035em]",
} as const;

export type VariableFontHoverAxis = "weight" | "width" | "both";
export type VariableFontHoverGranularity = "character" | "word";
export type VariableFontHoverFalloff = "gaussian" | "cosine" | "linear";
export type VariableFontHoverSize = keyof typeof sizes;
export type VariableFontHoverAxes = Record<string, [number, number]>;
export type VariableFontHoverElement =
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "p"
	| "span"
	| "div";

interface AxisSpec {
	tag: string;
	from: number;
	to: number;
}

interface Unit {
	text: string;
	left: number;
	top: number;
	width: number;
	height: number;
	/** Measured width change from resting (0) to peak (1) font variation. */
	deltaWidth: number;
	centerX: number;
	centerY: number;
	line: number;
	span: HTMLSpanElement;
	current: number;
	velocity: number;
	lastVariation: string;
	lastDx: string;
}

interface EngineOptions {
	text: string;
	axes: AxisSpec[];
	baseVariation: string;
	peakVariation: string;
	radius: number;
	intensity: number;
	granularity: VariableFontHoverGranularity;
	falloff: VariableFontHoverFalloff;
	stiffness: number;
	damping: number;
	breathing: number;
	reducedMotion: boolean;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
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

function resolveAxes(
	axis: VariableFontHoverAxis,
	weightRange: [number, number],
	widthRange: [number, number],
	customAxes?: VariableFontHoverAxes,
): AxisSpec[] {
	if (customAxes) {
		const entries = Object.entries(customAxes);
		if (entries.length > 0) {
			return entries.map(([tag, [from, to]]) => ({ tag, from, to }));
		}
	}
	if (axis === "width") {
		return [{ tag: "wdth", from: widthRange[0], to: widthRange[1] }];
	}
	if (axis === "both") {
		return [
			{ tag: "wght", from: weightRange[0], to: weightRange[1] },
			{ tag: "wdth", from: widthRange[0], to: widthRange[1] },
		];
	}
	return [{ tag: "wght", from: weightRange[0], to: weightRange[1] }];
}

function formatVariationSettings(axes: AxisSpec[], progress: number) {
	const t = Math.max(0, progress);
	let result = "";
	for (let i = 0; i < axes.length; i++) {
		const { tag, from, to } = axes[i]!;
		const value = Math.round((from + (to - from) * t) * 10) / 10;
		if (i > 0) result += ", ";
		result += `"${tag}" ${value}`;
	}
	return result;
}

function evaluateFalloff(
	distance: number,
	radius: number,
	falloff: VariableFontHoverFalloff,
) {
	if (radius <= 0 || distance >= radius) return 0;
	const u = distance / radius;
	if (falloff === "linear") return 1 - u;
	if (falloff === "cosine") return 0.5 * (1 + Math.cos(Math.PI * u));
	const raw = Math.exp(-GAUSSIAN_K * u * u);
	return Math.max(0, (raw - GAUSSIAN_EDGE) / (1 - GAUSSIAN_EDGE));
}

/** Segment text into graphemes so accents and emoji never split apart. */
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

interface MeasuredBox {
	text: string;
	left: number;
	top: number;
	width: number;
	height: number;
}

function widestRect(rects: DOMRectList): DOMRect | null {
	let best: DOMRect | null = null;
	for (const candidate of rects) {
		if (candidate.height === 0) continue;
		if (!best || candidate.width > best.width) best = candidate;
	}
	return best;
}

/**
 * Measures each grapheme or word directly from the real rendered text node
 * using DOM Ranges, preserving browser wrapping, kerning, and bidi order.
 */
function measureBoxes(
	textElement: HTMLElement,
	granularity: VariableFontHoverGranularity,
	toLocal: (x: number, y: number) => { x: number; y: number },
	zoom: number,
): MeasuredBox[] {
	const boxes: MeasuredBox[] = [];
	const range = document.createRange();
	const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const textNode = node as Text;
		const data = textNode.data;

		if (granularity === "character") {
			for (const segment of segmentGraphemes(data)) {
				if (/^\s+$/.test(segment.value)) continue;
				range.setStart(textNode, segment.index);
				range.setEnd(textNode, segment.index + segment.value.length);
				const rect = widestRect(range.getClientRects());
				if (!rect) continue;
				const corner = toLocal(rect.left, rect.top);
				boxes.push({
					text: segment.value,
					left: corner.x,
					top: corner.y,
					width: rect.width / zoom,
					height: rect.height / zoom,
				});
			}
			continue;
		}

		// Word granularity: keep whole words intact unless a word wraps across lines.
		for (const match of data.matchAll(/\S+/g)) {
			const word = match[0];
			const start = match.index ?? 0;
			range.setStart(textNode, start);
			range.setEnd(textNode, start + word.length);
			const rects = range.getClientRects();
			if (rects.length === 1) {
				const rect = rects[0]!;
				if (rect.height === 0) continue;
				const corner = toLocal(rect.left, rect.top);
				boxes.push({
					text: word,
					left: corner.x,
					top: corner.y,
					width: rect.width / zoom,
					height: rect.height / zoom,
				});
				continue;
			}

			// A long word wrapped across multiple lines: group graphemes per line.
			let sliceStart = start;
			let sliceEnd = start;
			let left = 0;
			let right = 0;
			let top = 0;
			let height = 0;
			let open = false;
			const flush = () => {
				if (!open) return;
				boxes.push({
					text: data.slice(sliceStart, sliceEnd),
					left,
					top,
					width: right - left,
					height,
				});
				open = false;
			};

			for (const segment of segmentGraphemes(word)) {
				const absIndex = start + segment.index;
				range.setStart(textNode, absIndex);
				range.setEnd(textNode, absIndex + segment.value.length);
				const rect = widestRect(range.getClientRects());
				if (!rect) continue;
				const corner = toLocal(rect.left, rect.top);
				const w = rect.width / zoom;
				const h = rect.height / zoom;
				if (open && Math.abs(corner.y - top) <= Math.max(height, 1) * 0.5) {
					left = Math.min(left, corner.x);
					right = Math.max(right, corner.x + w);
					sliceEnd = absIndex + segment.value.length;
				} else {
					flush();
					sliceStart = absIndex;
					sliceEnd = absIndex + segment.value.length;
					left = corner.x;
					right = corner.x + w;
					top = corner.y;
					height = h;
					open = true;
				}
			}
			flush();
		}
	}

	range.detach();
	return boxes;
}

/**
 * Owns the measured overlay spans, per-unit spring physics, and idle-stopping
 * animation loop so pointer movement never triggers React re-renders.
 */
class VariableFontHoverEngine {
	private root: HTMLElement;
	private textElement: HTMLElement;
	private layer: HTMLElement;
	private options: EngineOptions;

	private units: Unit[] = [];
	private lines: Unit[][] = [];
	private rootWidth = 0;
	private rootHeight = 0;
	private leftSlack = 0;
	private rightSlack = 0;
	private dirty = true;
	private active = false;
	private selecting = false;
	private destroyed = false;

	private pointer: { x: number; y: number } | null = null;
	private focusActive = false;
	private touch: {
		id: number;
		startX: number;
		startY: number;
		dragging: boolean;
	} | null = null;
	private tapTimer = 0;

	private frame = 0;
	private lastTime = 0;
	private resizeFrame = 0;
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
			if (this.resizeFrame) return;
			this.resizeFrame = requestAnimationFrame(() => {
				this.resizeFrame = 0;
				this.invalidate();
			});
		});
		resizeObserver.observe(root);

		const onFonts = () => this.invalidate();
		document.fonts?.addEventListener("loadingdone", onFonts);
		if (document.fonts && document.fonts.status !== "loaded") {
			void document.fonts.ready.then(() => {
				if (!this.destroyed) this.invalidate();
			});
		}

		const onSelectionChange = () => this.syncSelectionState();
		document.addEventListener("selectionchange", onSelectionChange);

		this.cleanups.push(
			() => resizeObserver.disconnect(),
			() => document.fonts?.removeEventListener("loadingdone", onFonts),
			() => document.removeEventListener("selectionchange", onSelectionChange),
		);
	}

	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.resizeFrame);
		window.clearTimeout(this.tapTimer);
		for (const cleanup of this.cleanups) cleanup();
		this.layer.replaceChildren();
		this.units = [];
		this.lines = [];
	}

	setOptions(next: EngineOptions) {
		const prev = this.options;
		this.options = next;

		if (next.reducedMotion) {
			this.resetToIdle();
			this.layer.replaceChildren();
			this.units = [];
			this.lines = [];
			this.dirty = true;
			return;
		}

		const layoutChanged =
			prev.text !== next.text ||
			prev.granularity !== next.granularity ||
			prev.baseVariation !== next.baseVariation ||
			prev.peakVariation !== next.peakVariation;

		if (layoutChanged) {
			this.invalidate();
		} else if (this.active) {
			this.wake();
		}
	}

	private invalidate() {
		this.dirty = true;
		if (this.destroyed || this.options.reducedMotion) return;
		if (this.active || this.pointer || this.focusActive) {
			this.ensureUnits();
			this.wake();
		}
	}

	private toLocal(clientX: number, clientY: number) {
		const rect = this.root.getBoundingClientRect();
		const zoom = this.root.offsetWidth ? rect.width / this.root.offsetWidth : 1;
		const scale = zoom || 1;
		return {
			x: (clientX - rect.left) / scale,
			y: (clientY - rect.top) / scale,
		};
	}

	private ensureUnits() {
		if (!this.dirty && this.units.length > 0) return true;
		this.dirty = false;

		const rect = this.root.getBoundingClientRect();
		const zoom = this.root.offsetWidth ? rect.width / this.root.offsetWidth : 1;
		const scale = zoom || 1;
		this.rootWidth = this.root.offsetWidth || rect.width;
		this.rootHeight = this.root.offsetHeight || rect.height;
		if (!this.rootWidth || !this.rootHeight) {
			this.layer.replaceChildren();
			this.units = [];
			this.lines = [];
			return false;
		}

		const computed = getComputedStyle(this.textElement);
		const fontSize = Number.parseFloat(computed.fontSize) || 36;
		const maxVisualSlack = fontSize * 1.1;
		// Keep local horizontal breathing inside the viewport so narrow mobile
		// screens never gain horizontal scrollbars.
		const viewportWidth =
			document.documentElement.clientWidth || window.innerWidth;
		this.leftSlack = clamp((rect.left - 12) / scale, 0, maxVisualSlack);
		this.rightSlack = clamp(
			(viewportWidth - rect.right - 12) / scale,
			0,
			maxVisualSlack,
		);

		const toLocal = (x: number, y: number) => ({
			x: (x - rect.left) / scale,
			y: (y - rect.top) / scale,
		});

		const boxes = measureBoxes(
			this.textElement,
			this.options.granularity,
			toLocal,
			scale,
		);
		if (boxes.length === 0) {
			this.layer.replaceChildren();
			this.units = [];
			this.lines = [];
			return false;
		}

		// Preserve spring state when re-measuring the same unit count (e.g. resize).
		const previousUnits = this.units;
		const fragment = document.createDocumentFragment();
		const nextUnits: Unit[] = [];
		const lineTops: number[] = [];
		const lineHeights: number[] = [];
		const isChar = this.options.granularity === "character";

		for (let i = 0; i < boxes.length; i++) {
			const box = boxes[i]!;
			let lineIndex = -1;
			for (let l = 0; l < lineTops.length; l++) {
				if (
					Math.abs(box.top - lineTops[l]!) <=
					Math.max(lineHeights[l]!, 1) * 0.5
				) {
					lineIndex = l;
					break;
				}
			}
			if (lineIndex === -1) {
				lineIndex = lineTops.length;
				lineTops.push(box.top);
				lineHeights.push(box.height);
			}

			const span = document.createElement("span");
			span.textContent = box.text;
			span.style.position = "absolute";
			span.style.left = `${box.left}px`;
			span.style.top = `${box.top}px`;
			span.style.whiteSpace = "pre";
			span.style.lineHeight = "normal";
			span.style.fontVariationSettings = this.options.baseVariation;
			if (isChar) span.style.letterSpacing = "0px";
			fragment.appendChild(span);

			const prev =
				previousUnits.length === boxes.length ? previousUnits[i] : undefined;

			nextUnits.push({
				text: box.text,
				left: box.left,
				top: box.top,
				width: box.width,
				height: box.height,
				deltaWidth: 0,
				centerX: box.left + box.width / 2,
				centerY: box.top + box.height / 2,
				line: lineIndex,
				span,
				current: prev?.current ?? 0,
				velocity: prev?.velocity ?? 0,
				lastVariation: this.options.baseVariation,
				lastDx: "0",
			});
		}

		this.layer.replaceChildren(fragment);

		// Calibrate every span's exact resting center and exact peak advance
		// expansion in batched read/write passes (zero layout thrashing in rAF).
		const restRects = nextUnits.map((unit) =>
			unit.span.getBoundingClientRect(),
		);
		for (const unit of nextUnits) {
			unit.span.style.fontVariationSettings = this.options.peakVariation;
		}
		const peakRects = nextUnits.map((unit) =>
			unit.span.getBoundingClientRect(),
		);
		for (let i = 0; i < nextUnits.length; i++) {
			const unit = nextUnits[i]!;
			const restRect = restRects[i]!;
			const peakRect = peakRects[i]!;
			const restWidth = restRect.width / scale;
			const restHeight = restRect.height / scale;
			const peakWidth = peakRect.width / scale;
			unit.deltaWidth = peakWidth - restWidth;
			const anchorX = unit.left + restWidth / 2;
			const anchorY = unit.top + (unit.height - restHeight) / 2;
			unit.span.style.fontVariationSettings = this.options.baseVariation;
			unit.span.style.left = `${anchorX}px`;
			unit.span.style.top = `${anchorY}px`;
			unit.span.style.transform = "translate(-50%, 0)";
		}

		// Group units per line sorted left-to-right for per-line elastic breathing.
		const grouped: Unit[][] = Array.from({ length: lineTops.length }, () => []);
		for (const unit of nextUnits) {
			grouped[unit.line]?.push(unit);
		}
		for (const lineUnits of grouped) {
			lineUnits.sort((a, b) => a.left - b.left);
		}

		this.units = nextUnits;
		this.lines = grouped;
		return true;
	}

	private setActive(active: boolean) {
		if (this.active === active) return;
		this.active = active;
		this.root.dataset.state = active ? "active" : "idle";
	}

	private setSelecting(selecting: boolean) {
		if (this.selecting === selecting) return;
		this.selecting = selecting;
		if (selecting) this.root.dataset.selecting = "true";
		else delete this.root.dataset.selecting;
	}

	private syncSelectionState() {
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) {
			this.setSelecting(false);
			return;
		}
		const inside =
			(selection.anchorNode && this.root.contains(selection.anchorNode)) ||
			(selection.focusNode && this.root.contains(selection.focusNode));
		this.setSelecting(Boolean(inside));
	}

	private resetToIdle() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.lastTime = 0;
		this.pointer = null;
		this.focusActive = false;
		this.touch = null;
		window.clearTimeout(this.tapTimer);
		for (const unit of this.units) {
			unit.current = 0;
			unit.velocity = 0;
			if (unit.lastVariation !== this.options.baseVariation) {
				unit.span.style.fontVariationSettings = this.options.baseVariation;
				unit.lastVariation = this.options.baseVariation;
			}
			if (unit.lastDx !== "0") {
				unit.span.style.transform = "translate(-50%, 0)";
				unit.lastDx = "0";
			}
		}
		this.setActive(false);
	}

	// ── Pointer & Focus Handlers ─────────────────────────────────────────

	onPointerEnter(event: PointerEvent<HTMLElement>) {
		if (this.options.reducedMotion || event.pointerType === "touch") return;
		if (event.buttons > 0) return;
		this.syncSelectionState();
		this.pointer = this.toLocal(event.clientX, event.clientY);
		this.engage();
	}

	onPointerMove(event: PointerEvent<HTMLElement>) {
		if (this.options.reducedMotion) return;

		if (event.pointerType === "touch") {
			const touch = this.touch;
			if (!touch || touch.id !== event.pointerId) return;
			const dx = Math.abs(event.clientX - touch.startX);
			const dy = Math.abs(event.clientY - touch.startY);
			if (!touch.dragging) {
				if (dy > TOUCH_SLOP_PX && dy > dx) {
					// Vertical gesture: release cleanly so page scroll stays native.
					this.touch = null;
					this.pointer = null;
					return;
				}
				if (dx >= TOUCH_SLOP_PX && dx >= dy) {
					touch.dragging = true;
				} else {
					return;
				}
			}
			this.pointer = this.toLocal(event.clientX, event.clientY);
			this.engage();
			return;
		}

		if (event.buttons > 0) {
			// User is drag-selecting with mouse: let native selection own the view.
			this.setSelecting(true);
			this.pointer = null;
			return;
		}

		this.syncSelectionState();
		this.pointer = this.toLocal(event.clientX, event.clientY);
		this.engage();
	}

	onPointerDown(event: PointerEvent<HTMLElement>) {
		if (this.options.reducedMotion) return;

		if (event.pointerType === "touch") {
			window.clearTimeout(this.tapTimer);
			this.touch = {
				id: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				dragging: false,
			};
			return;
		}

		if (event.button === 0) {
			// Primary mouse press: step the overlay aside so text selection is clean.
			this.setSelecting(true);
			this.pointer = null;
			if (this.active) this.wake();
		}
	}

	onPointerUp(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			const touch = this.touch;
			this.touch = null;
			if (touch && touch.id === event.pointerId && !touch.dragging) {
				// Quick tap: brief gentle swell impulse under the finger, then ease back.
				const dx = Math.abs(event.clientX - touch.startX);
				const dy = Math.abs(event.clientY - touch.startY);
				if (dx < TOUCH_SLOP_PX && dy < TOUCH_SLOP_PX) {
					this.pointer = this.toLocal(event.clientX, event.clientY);
					this.engage();
					window.clearTimeout(this.tapTimer);
					this.tapTimer = window.setTimeout(() => {
						this.pointer = null;
						if (this.active) this.wake();
					}, TAP_IMPULSE_MS);
					return;
				}
			}
			this.pointer = null;
			if (this.active) this.wake();
			return;
		}

		// Defer slightly so window.getSelection() reflects the finished click/drag.
		requestAnimationFrame(() => this.syncSelectionState());
	}

	onPointerCancel(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			this.touch = null;
		}
		this.pointer = null;
		if (this.active) this.wake();
	}

	onPointerLeave(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") return;
		this.pointer = null;
		if (this.active) this.wake();
	}

	onFocus(event: FocusEvent<HTMLElement>) {
		if (this.options.reducedMotion) return;
		let visible = false;
		try {
			visible = event.currentTarget.matches(":focus-visible");
		} catch {
			visible = true;
		}
		if (!visible) return;
		this.focusActive = true;
		this.engage();
	}

	onBlur() {
		if (!this.focusActive) return;
		this.focusActive = false;
		if (this.active) this.wake();
	}

	// ── Frame Loop & Spring Simulation ───────────────────────────────────

	private engage() {
		if (!this.ensureUnits()) return;
		this.setActive(true);
		this.wake();
	}

	private wake() {
		if (this.frame || this.destroyed) return;
		this.frame = requestAnimationFrame((now) => this.tick(now));
	}

	private tick(now: number) {
		this.frame = 0;
		if (this.destroyed || this.options.reducedMotion) return;

		if (this.dirty) {
			if (!this.ensureUnits()) {
				this.setActive(false);
				return;
			}
		}

		const dt = this.lastTime
			? Math.min((now - this.lastTime) / 1000, MAX_DT)
			: 1 / 60;
		this.lastTime = now;

		const { axes, radius, intensity, falloff, stiffness, damping, breathing } =
			this.options;
		const clampedIntensity = clamp(intensity, 0, 1.5);
		const clampedStiffness = clamp(stiffness, 20, 1000);
		const clampedDamping = clamp(damping, 4, 120);

		const pointer = this.pointer;
		const focusPoint =
			!pointer && this.focusActive
				? { x: this.rootWidth / 2, y: this.rootHeight / 2 }
				: null;
		const activePoint = pointer ?? focusPoint;
		const effectiveRadius = focusPoint
			? Math.max(radius, this.rootWidth * 0.45)
			: radius;
		const effectiveIntensity = focusPoint
			? clampedIntensity * 0.85
			: clampedIntensity;

		let settled = true;

		for (let i = 0; i < this.units.length; i++) {
			const unit = this.units[i]!;
			let target = 0;
			if (activePoint && effectiveIntensity > 0) {
				const distance = Math.hypot(
					activePoint.x - unit.centerX,
					activePoint.y - unit.centerY,
				);
				target =
					evaluateFalloff(distance, effectiveRadius, falloff) *
					effectiveIntensity;
			}

			// Sub-stepped semi-implicit Euler integration for smooth 60–240Hz motion.
			let current = unit.current;
			let velocity = unit.velocity;
			let remaining = dt;
			while (remaining > 0) {
				const step = Math.min(remaining, MAX_STEP);
				const acceleration =
					(target - current) * clampedStiffness - velocity * clampedDamping;
				velocity += acceleration * step;
				current += velocity * step;
				remaining -= step;
			}

			if (
				Math.abs(target - current) > SETTLE_EPSILON ||
				Math.abs(velocity) > VELOCITY_EPSILON
			) {
				settled = false;
			} else {
				current = target;
				velocity = 0;
			}

			unit.current = current;
			unit.velocity = velocity;

			const variation = formatVariationSettings(axes, current);
			if (variation !== unit.lastVariation) {
				unit.span.style.fontVariationSettings = variation;
				unit.lastVariation = variation;
			}
		}

		// Per-line local elastic breathing driven by each glyph's measured
		// advance-width delta so swollen glyphs stay airy without colliding or
		// shifting surrounding layout.
		const breathingFactor =
			Math.max(0, breathing) *
			(this.options.granularity === "character" ? 1.12 : 1);
		const effectiveLeftSlack = focusPoint ? 2 : this.leftSlack;
		const effectiveRightSlack = focusPoint ? 2 : this.rightSlack;

		for (let l = 0; l < this.lines.length; l++) {
			const lineUnits = this.lines[l]!;
			if (lineUnits.length === 0) continue;

			if (breathingFactor <= 0) {
				for (const unit of lineUnits) {
					if (unit.lastDx !== "0") {
						unit.span.style.transform = "translate(-50%, 0)";
						unit.lastDx = "0";
					}
				}
				continue;
			}

			const count = lineUnits.length;
			const cum = new Float64Array(count);
			let running = 0;
			let absRunning = 0;
			let weightSum = 0;
			let weightedPivot = 0;

			for (let k = 0; k < count; k++) {
				const unit = lineUnits[k]!;
				const swell = Math.max(0, unit.current);
				const extra = swell * unit.deltaWidth * breathingFactor;
				const centerCum = running + extra * 0.5;
				cum[k] = centerCum;
				running += extra;
				absRunning += Math.abs(extra);
				weightSum += swell;
				weightedPivot += swell * centerCum;
			}

			if (absRunning <= 0.01) {
				for (const unit of lineUnits) {
					if (unit.lastDx !== "0") {
						unit.span.style.transform = "translate(-50%, 0)";
						unit.lastDx = "0";
					}
				}
				continue;
			}

			const pivot =
				weightSum > 0.001 ? weightedPivot / weightSum : running * 0.5;
			const first = lineUnits[0]!;
			const last = lineUnits[count - 1]!;
			const firstHalfGrow = Math.max(0, first.current) * first.deltaWidth * 0.5;
			const lastHalfGrow = Math.max(0, last.current) * last.deltaWidth * 0.5;
			const rawLeftDx = cum[0]! - pivot;
			const rawRightDx = cum[count - 1]! - pivot;

			// Gently dampen breathing only if a line would cross the viewport edge
			// (or the focus outline while keyboard-focused).
			let scale = 1;
			const leftLimit = -(first.left + effectiveLeftSlack - firstHalfGrow);
			if (rawLeftDx < leftLimit && rawLeftDx < 0) {
				scale = Math.min(scale, Math.max(0, leftLimit / rawLeftDx));
			}
			const rightLimit =
				this.rootWidth +
				effectiveRightSlack -
				lastHalfGrow -
				(last.left + last.width);
			if (rawRightDx > rightLimit && rawRightDx > 0) {
				scale = Math.min(scale, Math.max(0, rightLimit / rawRightDx));
			}

			for (let k = 0; k < count; k++) {
				const unit = lineUnits[k]!;
				const dx = Math.round((cum[k]! - pivot) * scale * 100) / 100;
				const dxKey = dx === 0 ? "0" : `${dx}`;
				if (dxKey !== unit.lastDx) {
					unit.span.style.transform =
						dx === 0
							? "translate(-50%, 0)"
							: `translate(calc(-50% + ${dx}px), 0)`;
					unit.lastDx = dxKey;
				}
			}
		}

		if (settled && !activePoint) {
			this.resetToIdle();
			return;
		}

		if (settled) {
			this.lastTime = 0;
			return;
		}

		this.wake();
	}
}

export interface VariableFontHoverProps
	extends Omit<ComponentProps<"h2">, "children"> {
	/** Plain text string to render. */
	children: string;
	/** Semantic HTML element for the text. */
	as?: VariableFontHoverElement;
	/** Display scale preset with size-appropriate leading and tracking. */
	size?: VariableFontHoverSize;
	/** Variable font axis preset to swell toward the pointer. */
	axis?: VariableFontHoverAxis;
	/** Custom OpenType axis `[from, to]` ranges; overrides `axis` when set. */
	axes?: VariableFontHoverAxes;
	/** Resting and peak `"wght"` values when `axis` is `"weight"` or `"both"`. */
	weightRange?: [number, number];
	/** Resting and peak `"wdth"` values when `axis` is `"width"` or `"both"`. */
	widthRange?: [number, number];
	/** Pointer influence radius in CSS pixels. */
	radius?: number;
	/** Peak swell multiplier (`0` to `1.5`). */
	intensity?: number;
	/** Whether the swell applies per character (grapheme) or per word. */
	granularity?: VariableFontHoverGranularity;
	/** Spatial falloff curve from the pointer out to `radius`. */
	falloff?: VariableFontHoverFalloff;
	/** Spring stiffness controlling response speed. */
	stiffness?: number;
	/** Spring damping controlling settle smoothness. */
	damping?: number;
	/** Subtle per-line horizontal breathing factor (`0` disables). */
	breathing?: number;
	/** Set `false` to disable hover animation, matching reduced motion. */
	animated?: boolean;
}

export function VariableFontHover({
	children,
	as: Component = "h2",
	size = "md",
	axis = "weight",
	axes,
	weightRange = [400, 850],
	widthRange = [100, 125],
	radius = 140,
	intensity = 1,
	granularity = "character",
	falloff = "gaussian",
	stiffness = 260,
	damping = 26,
	breathing = 1,
	animated = true,
	className,
	style,
	onPointerEnter,
	onPointerMove,
	onPointerDown,
	onPointerUp,
	onPointerCancel,
	onPointerLeave,
	onFocus,
	onBlur,
	...props
}: VariableFontHoverProps) {
	const prefersReducedMotion = usePrefersReducedMotion();
	const reducedMotion = prefersReducedMotion || !animated;

	const resolvedAxes = resolveAxes(axis, weightRange, widthRange, axes);
	const baseVariation = formatVariationSettings(resolvedAxes, 0);
	const peakVariation = formatVariationSettings(resolvedAxes, 1);

	const rootRef = useRef<HTMLElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const layerRef = useRef<HTMLSpanElement>(null);
	const engineRef = useRef<VariableFontHoverEngine | null>(null);

	const options: EngineOptions = {
		text: children,
		axes: resolvedAxes,
		baseVariation,
		peakVariation,
		radius,
		intensity,
		granularity,
		falloff,
		stiffness,
		damping,
		breathing,
		reducedMotion,
	};

	const latestOptions = useRef(options);

	useLayoutEffect(() => {
		latestOptions.current = options;
		engineRef.current?.setOptions(options);
	});

	useLayoutEffect(() => {
		const root = rootRef.current;
		const text = textRef.current;
		const layer = layerRef.current;
		if (!root || !text || !layer) return;

		const engine = new VariableFontHoverEngine(
			root,
			text,
			layer,
			latestOptions.current,
		);
		engineRef.current = engine;
		return () => {
			engine.destroy();
			engineRef.current = null;
		};
	}, []);

	return (
		<Component
			ref={rootRef as Ref<HTMLHeadingElement>}
			data-slot="variable-font-hover"
			data-state="idle"
			data-axis={axes ? "custom" : axis}
			data-granularity={granularity}
			className={cn(
				"relative max-w-full break-words font-normal outline-none [-webkit-tap-highlight-color:transparent]",
				"rounded-md focus-visible:outline-2 focus-visible:outline-ring/60 focus-visible:outline-solid focus-visible:outline-offset-[6px]",
				// Swap real text and visual overlay atomically on the same frame;
				// step the overlay aside whenever the user is selecting text.
				"data-[state=active]:not-data-[selecting=true]:[&_[data-slot=variable-font-hover-text]]:text-transparent",
				"data-[state=active]:not-data-[selecting=true]:[&_[data-slot=variable-font-hover-layer]]:visible",
				Component === "span" ? "inline-block" : "flow-root",
				!reducedMotion && "touch-pan-y",
				sizes[size],
				className,
			)}
			style={{
				fontVariationSettings: baseVariation,
				...style,
			}}
			onPointerEnter={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerEnter?.(event);
				engineRef.current?.onPointerEnter(event);
			}}
			onPointerMove={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerMove?.(event);
				engineRef.current?.onPointerMove(event);
			}}
			onPointerDown={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerDown?.(event);
				engineRef.current?.onPointerDown(event);
			}}
			onPointerUp={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerUp?.(event);
				engineRef.current?.onPointerUp(event);
			}}
			onPointerCancel={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerCancel?.(event);
				engineRef.current?.onPointerCancel(event);
			}}
			onPointerLeave={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerLeave?.(event);
				engineRef.current?.onPointerLeave(event);
			}}
			onFocus={(event: FocusEvent<HTMLHeadingElement>) => {
				onFocus?.(event);
				engineRef.current?.onFocus(event);
			}}
			onBlur={(event: FocusEvent<HTMLHeadingElement>) => {
				onBlur?.(event);
				engineRef.current?.onBlur();
			}}
			{...props}
		>
			<span
				ref={textRef}
				data-slot="variable-font-hover-text"
				className={Component === "span" ? "inline" : "block"}
			>
				{children}
			</span>
			<span
				ref={layerRef}
				aria-hidden="true"
				data-slot="variable-font-hover-layer"
				className="pointer-events-none invisible absolute inset-0 select-none"
			/>
		</Component>
	);
}

export default VariableFontHover;
