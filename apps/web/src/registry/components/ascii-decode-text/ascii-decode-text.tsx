"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type ComponentProps,
	type PointerEvent,
	type Ref,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useWebHaptics } from "web-haptics/react";

import { cn } from "@/lib/utils";

const DEFAULT_RAMP = " .:-=+*#%@";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Width of the soft edge on the text reveal, in px. */
const EDGE_PX = 24;
/** Ms each cell takes to fade once the front reaches it. */
const CELL_FADE_MS = 120;
/** Ms a cell flickers through neighbouring ramp characters before it resolves. */
const FLICKER_MS = 150;
/** Ms each flicker character holds. */
const FLICKER_STEP_MS = 45;
/** Spread of the per-cell decode time, in ms. */
const JITTER_MS = 90;
/** Ms of flicker on the first cells before the front starts moving. */
const LEAD_MS = 120;
/** A re-encode runs at this fraction of `duration`. */
const ENCODE_SPEED = 0.6;
/** Cross-fade length under reduced motion, in ms. */
const FADE_MS = 200;
/** Ms the lens takes to heal behind the pointer. */
const HEAL_MS = 250;
/** Most trail points kept for the healing lens. */
const MAX_TRAIL = 16;
/** Inner part of the lens, as a fraction of its radius, that is fully encoded. */
const LENS_CORE = 0.55;
/** Touch moves this far, mostly sideways, before the lens starts. */
const TOUCH_SLOP_PX = 6;
/** Minimum ms between type ticks, and the most ticks per decode. */
const TICK_THROTTLE_MS = 35;
const MAX_TICKS = 24;
/** Canvas backing store limit, in device px per CSS px. */
const MAX_BACKING_SCALE = 2;
/** Raster samples per cell height when measuring glyph coverage. */
const SAMPLES_PER_CELL = 8;
/**
 * Smallest cell height in CSS px, so small text stays legible as ASCII
 * rather than stipple. It never drops below 4 cells per cap height.
 */
const MIN_CELL_PX = 3.5;
/** Monospace cell width as a fraction of its height. */
const CELL_ASPECT = 0.62;
/** At most this fraction of empty cells get a dust character. */
const DUST_FRACTION = 0.06;
const DUST_ALPHA = 0.25;

// A very soft, high, short tick, like a key on a quiet keyboard.
const TYPE_SOUND = {
	name: "ascii-decode-text-type",
	baseFreq: 1900,
	noiseColor: "white",
	oscType: "triangle",
	filterFreq: 4800,
	filterQ: 2,
	attack: 0.001,
	decay: 0.35,
	brightness: 5200,
} as const;

/** Ink opacity at the lightest and the densest cell. */
const tones = {
	default: [0.55, 1],
	muted: [0.5, 0.6],
} as const;

const sizes = {
	sm: "text-2xl",
	md: "text-4xl",
	lg: "text-4xl sm:text-5xl",
	xl: "text-5xl sm:text-6xl",
} as const;

export type AsciiDecodeTextTrigger = "mount" | "view" | "hover" | "manual";
export type AsciiDecodeTextDirection = "ltr" | "rtl" | "center" | "random";
type Phase = "encoded" | "decoding" | "decoded" | "encoding";

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** A stable 0-1 hash of two integers, so jitter and flicker are the same on every replay. */
function hash(a: number, b: number) {
	let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
	return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function smoothstep(t: number) {
	return t * t * (3 - 2 * t);
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

function applyTextTransform(text: string, transform: string) {
	if (transform === "uppercase") return text.toLocaleUpperCase();
	if (transform === "lowercase") return text.toLocaleLowerCase();
	if (transform === "capitalize") {
		return text.replace(/(^|\s)(\S)/g, (_, space, char) =>
			`${space}${char}`.toLocaleUpperCase(),
		);
	}
	return text;
}

function pxValue(value: string) {
	const number = Number.parseFloat(value);
	return Number.isFinite(number) ? number : 0;
}

interface Line {
	/** The line's text in logical order, without the spaces at the wrap. */
	text: string;
	left: number;
	right: number;
	top: number;
	height: number;
	/** Horizontal centre of each letter, for the type ticks. */
	letters: number[];
}

interface PendingLine extends Line {
	node: Text;
	start: number;
	end: number;
}

/** Graphemes with their offsets, so emoji and combining marks stay whole. */
function segmentText(data: string) {
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

/**
 * Reads the line boxes of the rendered text, in the root's layout px. Each
 * grapheme is measured with a Range, so wrapping, bidi, and letter-spacing
 * come from the browser rather than a re-layout.
 */
function measureLines(
	textElement: HTMLElement,
	toLocal: (x: number, y: number) => { x: number; y: number },
	zoom: number,
) {
	const lines: Line[] = [];
	const range = document.createRange();
	const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
	let pending = null as PendingLine | null;
	const flush = (line: PendingLine | null) => {
		if (line && line.right > line.left) {
			lines.push({
				text: line.node.data.slice(line.start, line.end),
				left: line.left,
				right: line.right,
				top: line.top,
				height: line.height,
				letters: line.letters,
			});
		}
	};
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		for (const segment of segmentText(text.data)) {
			if (/^\s+$/.test(segment.value)) continue;
			range.setStart(text, segment.index);
			range.setEnd(text, segment.index + segment.value.length);
			let rect: DOMRect | null = null;
			for (const candidate of range.getClientRects()) {
				if (!rect || candidate.width > rect.width) rect = candidate;
			}
			if (!rect || rect.height === 0) continue;
			const corner = toLocal(rect.left, rect.top);
			const width = rect.width / zoom;
			const height = rect.height / zoom;
			const end = segment.index + segment.value.length;
			const line: PendingLine | null = pending;
			if (
				line &&
				line.node === text &&
				Math.abs(corner.y - line.top) <= line.height * 0.5
			) {
				line.left = Math.min(line.left, corner.x);
				line.right = Math.max(line.right, corner.x + width);
				line.end = end;
				line.letters.push(corner.x + width / 2);
				continue;
			}
			flush(line);
			pending = {
				text: "",
				left: corner.x,
				right: corner.x + width,
				top: corner.y,
				height,
				letters: [corner.x + width / 2],
				node: text,
				start: segment.index,
				end,
			};
		}
	}
	flush(pending);
	range.detach();
	return lines;
}

interface Grid {
	/** Canvas box in the root's layout px, and its backing scale. */
	left: number;
	top: number;
	width: number;
	height: number;
	scale: number;
	/** Cell size in backing px. */
	cellWidth: number;
	cellHeight: number;
	/** The text element's offset in the root, for mask coordinates. */
	textLeft: number;
	textTop: number;
	textWidth: number;
	count: number;
	col: Uint16Array;
	row: Uint16Array;
	glyph: Uint8Array;
	ink: Float32Array;
	/** Distance from where the front starts, in px. */
	distance: Float32Array;
	jitter: Float32Array;
	seed: Float32Array;
	/** The front's full travel, in px. */
	span: number;
	/** Front distance sampled across the text box every `MASK_STEP` px. */
	maskDistance: Float32Array;
	/** Front distance of each letter, sorted, for the type ticks. */
	letters: Float32Array;
	atlas: HTMLCanvasElement;
	color: string;
	glyphs: string[];
	monoFamily: string;
	fontSize: number;
}

const MASK_STEP = 3;

interface EngineOptions {
	text: string;
	direction: AsciiDecodeTextDirection;
	duration: number;
	density: number;
	ramp: string;
	tone: keyof typeof tones;
	dust: boolean;
	lens: boolean;
	lensRadius?: number;
	trigger: AsciiDecodeTextTrigger;
	reducedMotion: boolean;
	sound: boolean;
	haptics: boolean;
}

interface EngineCallbacks {
	onPhase: (phase: Phase) => void;
	onDecoded: () => void;
	onTick: () => void;
	onHaptic: () => void;
}

interface Animation {
	kind: "decode" | "encode";
	fade: boolean;
	start: number | null;
	total: number;
	lead: number;
	sweep: number;
	next: "decode" | null;
	nextLetter: number;
	ticks: number;
	lastTickAt: number;
}

interface TrailPoint {
	x: number;
	y: number;
	t: number;
}

function createCanvas(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, width);
	canvas.height = Math.max(1, height);
	return canvas;
}

/**
 * Owns the canvas, the text mask, and the frame loop. The component creates
 * one per mount and passes it new options on every render.
 */
class DecodeEngine {
	private root: HTMLElement;
	private textElement: HTMLElement;
	private canvas: HTMLCanvasElement;
	private options: EngineOptions;
	private callbacks: EngineCallbacks;
	phase: Phase;
	private grid: Grid | null = null;
	private dirty = true;
	private animation: Animation | null = null;
	private trail: TrailPoint[] = [];
	private head: { x: number; y: number } | null = null;
	private touch: { id: number; x: number; y: number; active: boolean } | null =
		null;
	private frame = 0;
	private resizeFrame = 0;
	private visible = true;
	private viewed = false;
	private destroyed = false;
	private painted = false;
	private pendingDecode = false;
	private fontsReady = false;
	private cleanups: (() => void)[] = [];

	constructor(
		root: HTMLElement,
		textElement: HTMLElement,
		canvas: HTMLCanvasElement,
		options: EngineOptions,
		callbacks: EngineCallbacks,
		phase: Phase,
	) {
		this.root = root;
		this.textElement = textElement;
		this.canvas = canvas;
		this.options = options;
		this.callbacks = callbacks;
		this.phase = phase;
		if (phase === "encoded") this.setMask("linear-gradient(#0000, #0000)");

		const resize = new ResizeObserver(() => {
			if (this.resizeFrame) return;
			this.resizeFrame = requestAnimationFrame(() => {
				this.resizeFrame = 0;
				this.invalidate();
			});
		});
		resize.observe(root);
		const intersection = new IntersectionObserver(
			([entry]) => {
				if (!entry) return;
				this.visible = entry.isIntersecting;
				if (entry.intersectionRatio >= 0.4) this.onView();
			},
			{ threshold: [0, 0.4] },
		);
		intersection.observe(root);
		// The art is painted in the text colour, so repaint on a theme switch.
		const theme = new MutationObserver(() => this.onThemeChange());
		theme.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style", "data-theme"],
		});
		const onFonts = () => this.invalidate();
		document.fonts?.addEventListener("loadingdone", onFonts);
		this.cleanups.push(
			() => resize.disconnect(),
			() => intersection.disconnect(),
			() => theme.disconnect(),
			() => document.fonts?.removeEventListener("loadingdone", onFonts),
		);

		const ready = () => {
			if (this.destroyed) return;
			this.fontsReady = true;
			this.invalidate();
			if (this.options.trigger === "mount" || this.pendingDecode) {
				this.pendingDecode = false;
				this.decode();
			}
		};
		if (!document.fonts || document.fonts.status === "loaded") ready();
		else void document.fonts.ready.then(ready);
		if (this.phase === "encoded") this.paintStatic();
	}

	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.resizeFrame);
		for (const cleanup of this.cleanups) cleanup();
	}

	setOptions(options: EngineOptions) {
		const previous = this.options;
		this.options = options;
		if (
			previous.text !== options.text ||
			previous.density !== options.density ||
			previous.ramp !== options.ramp ||
			previous.tone !== options.tone ||
			previous.dust !== options.dust ||
			previous.direction !== options.direction
		) {
			this.invalidate();
		}
		if (!this.lensEnabled() && (this.head || this.trail.length)) {
			this.head = null;
			this.trail = [];
			this.paintLens(performance.now());
		}
	}

	// ── State ────────────────────────────────────────────────────────────

	private setPhase(phase: Phase) {
		if (this.phase === phase) return;
		this.phase = phase;
		this.root.dataset.state = phase;
		this.callbacks.onPhase(phase);
	}

	private onView() {
		if (this.viewed || this.options.trigger !== "view") return;
		this.viewed = true;
		if (this.phase === "encoded") this.decode();
	}

	decode() {
		if (!this.fontsReady) {
			this.pendingDecode = true;
			return;
		}
		if (this.phase === "decoded" || this.phase === "decoding") return;
		this.start("decode", null);
	}

	encode(next: "decode" | null = null) {
		this.pendingDecode = false;
		if (this.phase === "encoded") {
			if (next) this.decode();
			return;
		}
		if (this.phase === "encoding") {
			if (this.animation) this.animation.next = next;
			return;
		}
		this.start("encode", next);
	}

	/** Re-encodes quickly, then decodes again. */
	replay() {
		if (this.phase === "encoded") this.decode();
		else this.encode("decode");
	}

	private start(kind: "decode" | "encode", next: "decode" | null) {
		this.head = null;
		this.trail = [];
		const grid = this.ensureGrid();
		const fade = this.options.reducedMotion;
		if (!grid) {
			// Nothing to draw (no size yet): land on the end state.
			if (kind === "decode") this.finishDecoded(true);
			else this.finishEncoded();
			return;
		}
		this.refreshColor(grid);
		const duration = clamp(this.options.duration, 200, 10000);
		let total = FADE_MS;
		let lead = 0;
		let sweep = FADE_MS;
		if (!fade && kind === "decode") {
			total = duration;
			lead = LEAD_MS;
			sweep = Math.max(duration - LEAD_MS - CELL_FADE_MS - JITTER_MS / 2, 150);
		} else if (!fade) {
			total = Math.round(duration * ENCODE_SPEED);
			sweep = Math.max(total - CELL_FADE_MS - FLICKER_MS - JITTER_MS / 2, 120);
		}
		this.animation = {
			kind,
			fade,
			start: null,
			total,
			lead,
			sweep,
			next,
			nextLetter: 0,
			ticks: 0,
			lastTickAt: Number.NEGATIVE_INFINITY,
		};
		this.setPhase(kind === "decode" ? "decoding" : "encoding");
		this.wake();
	}

	private finishDecoded(notify: boolean) {
		this.animation = null;
		this.setMask(null);
		this.clearCanvas();
		this.setPhase("decoded");
		if (notify) this.callbacks.onDecoded();
	}

	private finishEncoded() {
		const next = this.animation?.next ?? null;
		this.animation = null;
		this.setMask("linear-gradient(#0000, #0000)");
		this.setPhase("encoded");
		this.paintStatic();
		if (next) this.decode();
	}

	// ── Frame loop ───────────────────────────────────────────────────────

	private wake() {
		if (this.frame || this.destroyed) return;
		this.frame = requestAnimationFrame((now) => this.tick(now));
	}

	private tick(now: number) {
		this.frame = 0;
		const animation = this.animation;
		if (animation) {
			if (animation.start === null) animation.start = now;
			const elapsed = now - animation.start;
			// Offscreen or in a hidden tab, skip straight to the end.
			if (!this.visible || document.hidden || elapsed >= animation.total) {
				if (animation.kind === "decode") this.finishDecoded(true);
				else this.finishEncoded();
				return;
			}
			this.paintAnimation(animation, elapsed, now);
			this.wake();
			return;
		}
		if (this.head || this.trail.length) {
			this.paintLens(now);
			if (this.trail.length) this.wake();
		}
	}

	// ── Rasterising ──────────────────────────────────────────────────────

	/** Marks the art stale and repaints it if it is on screen. */
	private invalidate() {
		this.dirty = true;
		if (this.destroyed) return;
		if (this.phase === "encoded") this.paintStatic();
		else if (this.animation || this.head || this.trail.length) {
			this.ensureGrid();
			this.wake();
		}
	}

	private onThemeChange() {
		const grid = this.grid;
		if (!grid || this.dirty) return;
		const color = getComputedStyle(this.root).color;
		if (color === grid.color) return;
		this.refreshColor(grid);
		if (this.phase === "encoded") this.paintStatic();
	}

	private refreshColor(grid: Grid) {
		const color = getComputedStyle(this.root).color;
		if (color === grid.color) return;
		grid.color = color;
		grid.atlas = this.buildAtlas(grid);
	}

	private ensureGrid() {
		if (this.dirty || !this.grid) {
			this.grid = this.rasterise();
			this.dirty = false;
		}
		return this.grid;
	}

	private toLocalFactory() {
		const rect = this.root.getBoundingClientRect();
		const zoom = this.root.offsetWidth ? rect.width / this.root.offsetWidth : 1;
		const toLocal = (x: number, y: number) => ({
			x: (x - rect.left) / (zoom || 1),
			y: (y - rect.top) / (zoom || 1),
		});
		return { rect, zoom: zoom || 1, toLocal };
	}

	private buildAtlas(grid: Grid) {
		const atlas = createCanvas(
			grid.cellWidth * grid.glyphs.length,
			grid.cellHeight,
		);
		const ctx = atlas.getContext("2d");
		if (!ctx) return atlas;
		ctx.font = `400 ${grid.cellHeight}px ${grid.monoFamily}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = grid.color;
		grid.glyphs.forEach((glyph, index) => {
			ctx.fillText(
				glyph,
				index * grid.cellWidth + grid.cellWidth / 2,
				grid.cellHeight / 2 + grid.cellHeight * 0.04,
			);
		});
		return atlas;
	}

	/**
	 * Draws the real text into an offscreen canvas at its measured line
	 * boxes, then maps the ink in each cell to a ramp character.
	 */
	private rasterise(): Grid | null {
		const { root, textElement, options } = this;
		const width = root.offsetWidth;
		const height = root.offsetHeight;
		if (!width || !height) return null;
		const style = getComputedStyle(textElement);
		const { rect, zoom, toLocal } = this.toLocalFactory();
		const lines = measureLines(textElement, toLocal, zoom);
		if (!lines.length) return null;

		const fontSize = pxValue(style.fontSize);
		const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
		const measure = createCanvas(1, 1).getContext("2d");
		if (!measure) return null;
		measure.font = font;
		const capHeight =
			measure.measureText("H").actualBoundingBoxAscent || fontSize * 0.7;

		const deviceScale = window.devicePixelRatio * zoom;
		const scale = clamp(deviceScale, 1, MAX_BACKING_SCALE);
		const density = clamp(options.density, 4, 12);
		const cellCss = Math.max(
			capHeight / density,
			Math.min(MIN_CELL_PX, capHeight / 4),
		);
		const cellHeight = Math.max(3, Math.round(cellCss * scale));
		const cellWidth = Math.max(2, Math.round(cellHeight * CELL_ASPECT));

		// Bleed a little above and below for accents and descenders, and
		// line the canvas up with whole device pixels.
		const bleed = Math.round(fontSize * 0.2);
		const fractionX = (rect.left * window.devicePixelRatio) % 1;
		const fractionY = (rect.top * window.devicePixelRatio) % 1;
		const left = -fractionX / deviceScale;
		const top = -bleed - fractionY / deviceScale;
		const columns = Math.ceil((width * scale) / cellWidth);
		const rows = Math.ceil(((height + bleed * 2) * scale) / cellHeight);
		const canvasWidth = (columns * cellWidth) / scale;
		const canvasHeight = (rows * cellHeight) / scale;

		// Coverage raster: SAMPLES_PER_CELL samples down each cell.
		const sampleScale = SAMPLES_PER_CELL / (cellHeight / scale);
		const rasterWidth = Math.ceil(canvasWidth * sampleScale);
		const rasterHeight = Math.ceil(canvasHeight * sampleScale);
		const raster = createCanvas(rasterWidth, rasterHeight);
		const ctx = raster.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		ctx.font = font;
		ctx.fillStyle = "#fff";
		ctx.textBaseline = "alphabetic";
		ctx.textAlign = "left";
		ctx.direction = style.direction === "rtl" ? "rtl" : "ltr";
		ctx.letterSpacing = `${pxValue(style.letterSpacing)}px`;
		ctx.wordSpacing = `${pxValue(style.wordSpacing)}px`;
		ctx.fontKerning = style.fontKerning === "none" ? "none" : "normal";
		const metrics = ctx.measureText("Hg");
		const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.9;
		const descent = metrics.fontBoundingBoxDescent || fontSize * 0.25;
		for (const line of lines) {
			const text = applyTextTransform(line.text, style.textTransform);
			const measured = ctx.measureText(text).width;
			const target = line.right - line.left;
			const fit = measured > 0 ? clamp(target / measured, 0.9, 1.1) : 1;
			const baseline =
				line.top + (line.height - (ascent + descent)) / 2 + ascent;
			ctx.setTransform(
				sampleScale * fit,
				0,
				0,
				sampleScale,
				(line.left - left) * sampleScale,
				(baseline - top) * sampleScale,
			);
			ctx.fillText(text, 0, 0);
		}
		const pixels = ctx.getImageData(0, 0, rasterWidth, rasterHeight).data;

		const cellCount = columns * rows;
		const sums = new Float32Array(cellCount);
		const counts = new Uint16Array(cellCount);
		const columnOf = new Uint16Array(rasterWidth);
		const cellCssWidth = cellWidth / scale;
		const cellCssHeight = cellHeight / scale;
		for (let x = 0; x < rasterWidth; x++) {
			columnOf[x] = Math.min(
				columns - 1,
				Math.floor(x / sampleScale / cellCssWidth),
			);
		}
		for (let y = 0; y < rasterHeight; y++) {
			const rowIndex = Math.min(
				rows - 1,
				Math.floor(y / sampleScale / cellCssHeight),
			);
			const rowOffset = rowIndex * columns;
			const pixelRow = y * rasterWidth * 4;
			for (let x = 0; x < rasterWidth; x++) {
				const cell = rowOffset + columnOf[x];
				sums[cell] += pixels[pixelRow + x * 4 + 3];
				counts[cell]++;
			}
		}

		// Front distance for any x, per direction. "ltr" means from the start
		// of the line, so it runs from the right in RTL text.
		const inkLeft = Math.min(...lines.map((line) => line.left));
		const inkRight = Math.max(...lines.map((line) => line.right));
		const inkWidth = Math.max(inkRight - inkLeft, 1);
		const rtl = style.direction === "rtl";
		const direction =
			rtl && options.direction === "ltr"
				? "rtl"
				: rtl && options.direction === "rtl"
					? "ltr"
					: options.direction;
		const noiseStep = Math.max(fontSize * 1.4, 24);
		const span =
			direction === "center"
				? inkWidth / 2
				: direction === "random"
					? inkWidth * 0.5
					: inkWidth;
		const distanceAt = (x: number) => {
			if (direction === "rtl") return inkRight - x;
			if (direction === "center") return Math.abs(x - (inkLeft + inkRight) / 2);
			if (direction === "random") {
				const t = Math.max(x - inkLeft, 0) / noiseStep;
				const index = Math.floor(t);
				const a = hash(index, 7919);
				const b = hash(index + 1, 7919);
				return (a + (b - a) * smoothstep(t - index)) * span;
			}
			return x - inkLeft;
		};

		const glyphs = Array.from(options.ramp || DEFAULT_RAMP);
		const levels = glyphs.length - 1;
		const [minAlpha, maxAlpha] = tones[options.tone] ?? tones.default;
		const lineBands = lines.map((line) => [line.top, line.top + line.height]);
		const col: number[] = [];
		const row: number[] = [];
		const glyph: number[] = [];
		const ink: number[] = [];
		for (let r = 0; r < rows; r++) {
			const cy = top + (r + 0.5) * cellCssHeight;
			const inLine = lineBands.some(([a, b]) => cy >= a && cy <= b);
			for (let c = 0; c < columns; c++) {
				const cell = r * columns + c;
				const coverage = counts[cell] ? sums[cell] / (counts[cell] * 255) : 0;
				// Faint anti-aliased edges drop out, so the letter shapes stay sharp.
				const level = clamp((coverage - 0.06) / 0.84, 0, 1);
				const index = Math.round(level * levels);
				if (coverage > 0.1 && index > 0 && glyphs[index] !== " ") {
					col.push(c);
					row.push(r);
					glyph.push(index);
					ink.push(minAlpha + (maxAlpha - minAlpha) * level);
				} else if (
					options.dust &&
					coverage === 0 &&
					inLine &&
					hash(c, r + 4099) < DUST_FRACTION
				) {
					col.push(c);
					row.push(r);
					glyph.push(Math.min(levels, hash(r, c) < 0.6 ? 1 : 2));
					ink.push(DUST_ALPHA);
				}
			}
		}

		const count = col.length;
		const distance = new Float32Array(count);
		const jitter = new Float32Array(count);
		const seed = new Float32Array(count);
		for (let index = 0; index < count; index++) {
			const cx = left + (col[index] + 0.5) * cellCssWidth;
			distance[index] = distanceAt(cx);
			jitter[index] = (hash(col[index], row[index]) - 0.5) * JITTER_MS;
			seed[index] = hash(row[index] + 31, col[index] + 17);
		}

		const textRect = textElement.getBoundingClientRect();
		const textOrigin = toLocal(textRect.left, textRect.top);
		const textWidth = textRect.width / zoom;
		const maskDistance = new Float32Array(Math.ceil(textWidth / MASK_STEP) + 1);
		for (let index = 0; index < maskDistance.length; index++) {
			maskDistance[index] = distanceAt(textOrigin.x + index * MASK_STEP);
		}
		const letters = Float32Array.from(
			lines.flatMap((line) => line.letters.map(distanceAt)),
		).sort();

		this.canvas.width = columns * cellWidth;
		this.canvas.height = rows * cellHeight;
		Object.assign(this.canvas.style, {
			left: `${left}px`,
			top: `${top}px`,
			width: `${canvasWidth}px`,
			height: `${canvasHeight}px`,
		});
		this.painted = true;

		const monoFamily =
			getComputedStyle(this.canvas).fontFamily || "ui-monospace, monospace";
		const grid: Grid = {
			left,
			top,
			width: canvasWidth,
			height: canvasHeight,
			scale,
			cellWidth,
			cellHeight,
			textLeft: textOrigin.x,
			textTop: textOrigin.y,
			textWidth,
			count,
			col: Uint16Array.from(col),
			row: Uint16Array.from(row),
			glyph: Uint8Array.from(glyph),
			ink: Float32Array.from(ink),
			distance,
			jitter,
			seed,
			span,
			maskDistance,
			letters,
			atlas: createCanvas(1, 1),
			color: getComputedStyle(root).color,
			glyphs,
			monoFamily,
			fontSize,
		};
		grid.atlas = this.buildAtlas(grid);
		// The mono font may not be in use anywhere else yet; redraw once it is.
		const monoFont = `${cellHeight}px ${monoFamily.split(",")[0]}`;
		if (document.fonts && !document.fonts.check(monoFont)) {
			document.fonts
				.load(monoFont)
				.then(() => {
					if (this.grid !== grid || this.destroyed) return;
					grid.atlas = this.buildAtlas(grid);
					if (this.phase === "encoded") this.paintStatic();
				})
				.catch(() => {});
		}
		return grid;
	}

	// ── Painting ─────────────────────────────────────────────────────────

	private context() {
		const ctx = this.canvas.getContext("2d");
		if (ctx) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = 1;
		}
		return ctx;
	}

	private clearCanvas() {
		if (!this.painted) return;
		this.painted = false;
		this.context()?.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	private setMask(mask: string | null) {
		if (mask) this.textElement.style.setProperty("--ascii-decode-mask", mask);
		else this.textElement.style.removeProperty("--ascii-decode-mask");
	}

	private drawCell(
		ctx: CanvasRenderingContext2D,
		grid: Grid,
		index: number,
		glyph: number,
		alpha: number,
	) {
		ctx.globalAlpha = alpha;
		ctx.drawImage(
			grid.atlas,
			glyph * grid.cellWidth,
			0,
			grid.cellWidth,
			grid.cellHeight,
			grid.col[index] * grid.cellWidth,
			grid.row[index] * grid.cellHeight,
			grid.cellWidth,
			grid.cellHeight,
		);
	}

	/** A neighbouring ramp character that changes every `FLICKER_STEP_MS`. */
	private flicker(grid: Grid, index: number, time: number) {
		const step = Math.floor(time / FLICKER_STEP_MS + grid.seed[index] * 7);
		const offset = Math.floor(hash(index, step) * 3) - 1;
		return clamp(grid.glyph[index] + offset, 1, grid.glyphs.length - 1);
	}

	/** The resting art: every cell at its density character. */
	private paintStatic() {
		const grid = this.ensureGrid();
		const ctx = this.context();
		if (!grid || !ctx) return;
		this.refreshColor(grid);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		for (let index = 0; index < grid.count; index++) {
			this.drawCell(ctx, grid, index, grid.glyph[index], grid.ink[index]);
		}
		this.painted = true;
	}

	private paintAnimation(animation: Animation, elapsed: number, now: number) {
		const grid = this.ensureGrid();
		const ctx = this.context();
		if (!grid || !ctx) return;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.painted = true;
		const decoding = animation.kind === "decode";

		if (animation.fade) {
			// Reduced motion: one cross-fade, no sweep and no flicker.
			const progress = clamp(elapsed / animation.total, 0, 1);
			const textAlpha = decoding ? progress : 1 - progress;
			for (let index = 0; index < grid.count; index++) {
				this.drawCell(
					ctx,
					grid,
					index,
					grid.glyph[index],
					grid.ink[index] * (1 - textAlpha),
				);
			}
			const alpha = textAlpha.toFixed(3);
			this.setMask(
				`linear-gradient(rgb(0 0 0 / ${alpha}), rgb(0 0 0 / ${alpha}))`,
			);
			return;
		}

		const t = elapsed - animation.lead;
		const travel = grid.span + EDGE_PX;
		const front = (t / animation.sweep) * travel - EDGE_PX / 2;
		for (let index = 0; index < grid.count; index++) {
			const at =
				((grid.distance[index] + EDGE_PX / 2) / travel) * animation.sweep -
				CELL_FADE_MS / 2 +
				grid.jitter[index];
			const local = t - at;
			let glyph = grid.glyph[index];
			let alpha = grid.ink[index];
			if (decoding) {
				if (local >= CELL_FADE_MS) continue;
				if (local >= -FLICKER_MS) glyph = this.flicker(grid, index, t);
				if (local > 0) alpha *= 1 - local / CELL_FADE_MS;
			} else {
				if (local <= 0) continue;
				if (local < CELL_FADE_MS + FLICKER_MS) {
					glyph = this.flicker(grid, index, t);
				}
				if (local < CELL_FADE_MS) alpha *= local / CELL_FADE_MS;
			}
			this.drawCell(ctx, grid, index, glyph, alpha);
		}
		this.setMask(this.frontMask(grid, front, !decoding));

		if (decoding) this.playTicks(animation, grid, front, now);
	}

	/**
	 * A left-to-right gradient that is opaque wherever the front has passed,
	 * softened with a box blur so every edge is `EDGE_PX` wide.
	 */
	private frontMask(grid: Grid, front: number, invert: boolean) {
		const samples = grid.maskDistance;
		const count = samples.length;
		const prefix = new Float32Array(count + 1);
		for (let index = 0; index < count; index++) {
			prefix[index + 1] = prefix[index] + (front >= samples[index] ? 1 : 0);
		}
		const radius = Math.round(EDGE_PX / 2 / MASK_STEP);
		const alphas = new Float32Array(count);
		let sum = 0;
		for (let index = 0; index < count; index++) {
			const from = Math.max(0, index - radius);
			const to = Math.min(count, index + radius + 1);
			const value = (prefix[to] - prefix[from]) / (to - from);
			alphas[index] = invert ? 1 - value : value;
			sum += alphas[index];
		}
		if (sum >= count - 1e-3) return null;
		if (sum <= 1e-3) return "linear-gradient(#0000, #0000)";
		const stops: string[] = [];
		for (let index = 0; index < count; index++) {
			const value = alphas[index];
			const previous = alphas[index - 1];
			const next = alphas[index + 1];
			if (
				index === 0 ||
				index === count - 1 ||
				value !== previous ||
				value !== next
			) {
				stops.push(`rgb(0 0 0 / ${value.toFixed(3)}) ${index * MASK_STEP}px`);
			}
		}
		return `linear-gradient(to right, ${stops.join(", ")})`;
	}

	private playTicks(
		animation: Animation,
		grid: Grid,
		front: number,
		now: number,
	) {
		let crossed = false;
		while (
			animation.nextLetter < grid.letters.length &&
			grid.letters[animation.nextLetter] <= front
		) {
			animation.nextLetter++;
			crossed = true;
		}
		if (
			!crossed ||
			!this.options.sound ||
			animation.ticks >= MAX_TICKS ||
			now - animation.lastTickAt < TICK_THROTTLE_MS ||
			document.hidden
		) {
			return;
		}
		// Never on page load: only once the page has had a user gesture.
		const activation = (
			navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
		).userActivation;
		if (activation && !activation.hasBeenActive) return;
		animation.ticks++;
		animation.lastTickAt = now;
		this.callbacks.onTick();
	}

	// ── Lens ─────────────────────────────────────────────────────────────

	private lensEnabled() {
		const { lens, trigger, reducedMotion } = this.options;
		return lens && trigger !== "hover" && !reducedMotion;
	}

	private lensRadius(grid: Grid) {
		return this.options.lensRadius ?? clamp(grid.fontSize * 0.6, 24, 64);
	}

	private paintLens(now: number) {
		this.trail = this.trail.filter((point) => now - point.t < HEAL_MS);
		if (this.trail.length > MAX_TRAIL) {
			this.trail.splice(0, this.trail.length - MAX_TRAIL);
		}
		const grid = this.grid;
		const ctx = this.context();
		if (!grid || !ctx || (!this.head && !this.trail.length)) {
			this.setMask(null);
			this.clearCanvas();
			return;
		}
		const radius = this.lensRadius(grid);
		const circles = this.trail.map((point) => ({
			x: point.x,
			y: point.y,
			r: radius * (1 - (now - point.t) / HEAL_MS),
		}));
		if (this.head) circles.push({ ...this.head, r: radius });

		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.painted = true;
		let minX = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const circle of circles) {
			minX = Math.min(minX, circle.x - circle.r);
			maxX = Math.max(maxX, circle.x + circle.r);
			minY = Math.min(minY, circle.y - circle.r);
			maxY = Math.max(maxY, circle.y + circle.r);
		}
		const cellWidth = grid.cellWidth / grid.scale;
		const cellHeight = grid.cellHeight / grid.scale;
		for (let index = 0; index < grid.count; index++) {
			const x = grid.left + (grid.col[index] + 0.5) * cellWidth;
			const y = grid.top + (grid.row[index] + 0.5) * cellHeight;
			if (x < minX || x > maxX || y < minY || y > maxY) continue;
			// The text mask multiplies the holes, so the art is its complement.
			let clear = 1;
			for (const circle of circles) {
				const reach = Math.hypot(x - circle.x, y - circle.y);
				const inner = circle.r * LENS_CORE;
				const open =
					reach <= inner
						? 1
						: 1 - clamp((reach - inner) / (circle.r - inner), 0, 1);
				clear *= 1 - open;
			}
			const strength = 1 - clear;
			if (strength <= 0.01) continue;
			// Cells on the soft rim shimmer between neighbouring characters.
			const glyph =
				strength < 0.85 ? this.flicker(grid, index, now) : grid.glyph[index];
			this.drawCell(ctx, grid, index, glyph, grid.ink[index] * strength);
		}
		this.setMask(
			circles
				.map(
					(circle) =>
						`radial-gradient(circle ${circle.r.toFixed(1)}px at ${(circle.x - grid.textLeft).toFixed(1)}px ${(circle.y - grid.textTop).toFixed(1)}px, #0000 ${(circle.r * LENS_CORE).toFixed(1)}px, #000 ${circle.r.toFixed(1)}px)`,
				)
				.join(", "),
		);
	}

	private moveLens(clientX: number, clientY: number) {
		const grid = this.ensureGrid();
		if (!grid) return;
		const { toLocal } = this.toLocalFactory();
		const point = toLocal(clientX, clientY);
		const now = performance.now();
		const head = this.head;
		if (
			head &&
			Math.hypot(point.x - head.x, point.y - head.y) >=
				this.lensRadius(grid) * 0.3
		) {
			this.trail.push({ ...head, t: now });
		}
		this.head = point;
		this.wake();
	}

	private releaseLens() {
		if (!this.head) return;
		this.trail.push({ ...this.head, t: performance.now() });
		this.head = null;
		this.wake();
	}

	private lensReady() {
		return this.lensEnabled() && this.phase === "decoded" && !this.animation;
	}

	pointerDown(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			this.touch = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				active: false,
			};
		} else if (event.pointerType === "mouse") {
			// A press starts a text selection; keep the text clear for it.
			this.releaseLens();
		}
	}

	pointerMove(event: PointerEvent<HTMLElement>) {
		if (!this.lensReady()) return;
		if (event.pointerType === "touch") {
			const touch = this.touch;
			if (!touch || touch.id !== event.pointerId) return;
			if (!touch.active) {
				const dx = event.clientX - touch.x;
				const dy = event.clientY - touch.y;
				if (Math.hypot(dx, dy) < TOUCH_SLOP_PX) return;
				// A vertical swipe is a page scroll, not a lens drag.
				if (Math.abs(dx) <= Math.abs(dy)) {
					this.touch = null;
					return;
				}
				touch.active = true;
				if (this.options.haptics && !document.hidden) {
					this.callbacks.onHaptic();
				}
			}
		} else if (event.pointerType === "mouse" && event.buttons !== 0) {
			return;
		}
		this.moveLens(event.clientX, event.clientY);
	}

	pointerEnd(event: PointerEvent<HTMLElement>) {
		if (event.pointerType === "touch") {
			if (this.touch?.id !== event.pointerId) return;
			this.touch = null;
		}
		this.releaseLens();
	}

	pointerLeave(event: PointerEvent<HTMLElement>) {
		if (event.pointerType !== "touch") this.releaseLens();
	}
}

export interface AsciiDecodeTextHandle {
	/** Re-encodes the text to ASCII art, then decodes it again. */
	replay: () => void;
	/** Sweeps the text back into ASCII art and holds it there. */
	encode: () => void;
	/** Decodes the ASCII art into the text. */
	decode: () => void;
}

export interface AsciiDecodeTextProps
	extends Omit<ComponentProps<"h2">, "children" | "ref"> {
	/** The headline. Plain text only: the art is drawn from this string. */
	children: string;
	/** The element to render. */
	as?: "h1" | "h2" | "h3" | "p" | "span";
	/** Type scale of the headline. Overridable with `className`. */
	size?: keyof typeof sizes;
	/**
	 * What starts the decode: on mount, once 40% of it is in view, on hover or
	 * focus (which re-encodes first), or only through `decoded` and the ref.
	 */
	trigger?: AsciiDecodeTextTrigger;
	/** Controlled state for `trigger="manual"`: `true` decodes, `false` re-encodes. */
	decoded?: boolean;
	/** Called each time a decode finishes. */
	onDecoded?: () => void;
	/** Where the front starts. `"ltr"` means the start of the line, so it runs from the right in RTL text. */
	direction?: AsciiDecodeTextDirection;
	/** Length of the decode sweep, in ms. A re-encode takes 60% of it. */
	duration?: number;
	/**
	 * ASCII cells per cap height, from 4 to 12. Small text uses larger cells,
	 * down to 4 per cap height, so the characters stay legible.
	 */
	density?: number;
	/** Characters from empty to full ink. */
	ramp?: string;
	/** Ink colour of the art: the text colour, or a quieter 60% of it. */
	tone?: keyof typeof tones;
	/** Sprinkles faint dust characters around the letters while encoded. */
	dust?: boolean;
	/**
	 * Re-encodes the text under the pointer, or under a sideways touch drag,
	 * after decoding. Defaults to `true`; always off with `trigger="hover"` and
	 * reduced motion.
	 */
	lens?: boolean;
	/** Lens radius in px. Defaults to 0.6em, clamped to 24-64 px. */
	lensRadius?: number;
	/** A very soft type tick as the front crosses each letter. */
	sound?: boolean;
	/** A light haptic when a touch lens starts. */
	haptics?: boolean;
	/** Set to `false` for a plain cross-fade, as with reduced motion. */
	animated?: boolean;
	/** Exposes `replay()`, `encode()`, and `decode()`. */
	ref?: Ref<AsciiDecodeTextHandle>;
}

export function AsciiDecodeText({
	children,
	as: Component = "h2",
	size = "md",
	trigger = "view",
	decoded,
	onDecoded,
	direction = "ltr",
	duration = 1100,
	density = 7,
	ramp = DEFAULT_RAMP,
	tone = "default",
	dust = false,
	lens,
	lensRadius,
	sound = false,
	haptics = true,
	animated = true,
	className,
	ref,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onPointerLeave,
	onPointerEnter,
	onFocus,
	...props
}: AsciiDecodeTextProps) {
	const [phase, setPhase] = useState<Phase>(() =>
		trigger === "manual" && decoded ? "decoded" : "encoded",
	);
	const prefersReducedMotion = usePrefersReducedMotion();
	const reducedMotion = prefersReducedMotion || !animated;
	const lensOn = (lens ?? trigger !== "hover") && trigger !== "hover";

	const { trigger: haptic } = useWebHaptics();
	const { click: playType } = useTiks({
		theme: TYPE_SOUND,
		volume: 0.35,
		respectReducedMotion: false,
	});

	const rootRef = useRef<HTMLElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<DecodeEngine | null>(null);

	const options: EngineOptions = {
		text: children,
		direction,
		duration,
		density,
		ramp,
		tone,
		dust,
		lens: lensOn,
		lensRadius,
		trigger,
		reducedMotion,
		sound,
		haptics,
	};
	const latest = useRef({ options, onDecoded, playType, haptic });
	useLayoutEffect(() => {
		latest.current = { options, onDecoded, playType, haptic };
		engineRef.current?.setOptions(options);
	});

	useLayoutEffect(() => {
		const root = rootRef.current;
		const text = textRef.current;
		const canvas = canvasRef.current;
		if (!root || !text || !canvas) return;
		const engine = new DecodeEngine(
			root,
			text,
			canvas,
			latest.current.options,
			{
				onPhase: setPhase,
				onDecoded: () => latest.current.onDecoded?.(),
				onTick: () => latest.current.playType(),
				onHaptic: () => void latest.current.haptic("light"),
			},
			root.dataset.state === "decoded" ? "decoded" : "encoded",
		);
		engineRef.current = engine;
		return () => {
			engine.destroy();
			engineRef.current = null;
		};
	}, []);

	// Controlled mode: follow `decoded` after the first render.
	const decodedRef = useRef(decoded);
	useEffect(() => {
		if (decodedRef.current === decoded) return;
		decodedRef.current = decoded;
		if (trigger !== "manual" || decoded === undefined) return;
		if (decoded) engineRef.current?.decode();
		else engineRef.current?.encode();
	}, [decoded, trigger]);

	useImperativeHandle(ref, () => ({
		replay: () => engineRef.current?.replay(),
		encode: () => engineRef.current?.encode(),
		decode: () => engineRef.current?.decode(),
	}));

	const startHover = () => {
		if (trigger === "hover") engineRef.current?.replay();
	};

	return (
		<Component
			ref={rootRef as Ref<HTMLHeadingElement>}
			data-slot="ascii-decode-text"
			data-state={phase}
			data-trigger={trigger}
			data-direction={direction}
			className={cn(
				// The last cell column can overhang the box by a fraction; clip it so
				// the art never widens the page.
				"relative max-w-full overflow-x-clip break-words font-semibold tracking-tight",
				"data-[state=encoded]:[--ascii-decode-mask:linear-gradient(#0000,#0000)]",
				// A new formatting context, so the text's negative margins below
				// never collapse through the root.
				Component === "span" ? "inline-block" : "flow-root",
				lensOn && !reducedMotion && "touch-pan-y",
				sizes[size],
				className,
			)}
			onPointerDown={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerDown?.(event);
				engineRef.current?.pointerDown(event);
				// A tap is the touch equivalent of hovering.
				if (event.pointerType === "touch") startHover();
			}}
			onPointerMove={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerMove?.(event);
				engineRef.current?.pointerMove(event);
			}}
			onPointerUp={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerUp?.(event);
				engineRef.current?.pointerEnd(event);
			}}
			onPointerCancel={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerCancel?.(event);
				engineRef.current?.pointerEnd(event);
			}}
			onPointerLeave={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerLeave?.(event);
				engineRef.current?.pointerLeave(event);
			}}
			onPointerEnter={(event: PointerEvent<HTMLHeadingElement>) => {
				onPointerEnter?.(event);
				if (event.pointerType !== "touch") startHover();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				startHover();
			}}
			{...props}
		>
			<span
				ref={textRef}
				data-slot="ascii-decode-text-text"
				// The padding, cancelled by the margin, grows the mask area so
				// descenders and accents past the line box aren't clipped.
				className="-my-[0.25em] block py-[0.25em] [mask-composite:intersect] [mask-image:var(--ascii-decode-mask)]"
			>
				{children}
			</span>
			{/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas without tabIndex is not focusable. */}
			<canvas
				ref={canvasRef}
				aria-hidden="true"
				data-slot="ascii-decode-text-canvas"
				// Unsized until the first raster, so it never adds a 300x150 box.
				className="pointer-events-none absolute top-0 left-0 size-0 select-none font-mono"
			/>
		</Component>
	);
}

export default AsciiDecodeText;
