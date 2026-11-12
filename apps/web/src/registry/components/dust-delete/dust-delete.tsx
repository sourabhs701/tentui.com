"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type ComponentProps,
	createContext,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Height, in px, of the row the undo pill sits in once the slot has closed. */
const UNDO_ROW = 44;
/** Feather of each erosion front, and how far the mask reaches past the item for its shadow, in px. */
const FEATHER = 20;
const BLEED = 32;
/** Share of the mask's noise cells that stay opaque. */
const NOISE_DENSITY = 0.45;
const NOISE_SIZE = 64;
/** Tile size and offset of each noise class, in px, so the classes don't line up. */
const NOISE_LAYERS = [
	{ size: 64, x: 0, y: 0 },
	{ size: 96, x: 23, y: 41 },
	{ size: 48, x: 37, y: 11 },
] as const;
/** CSS px of item area per grain, the per-item limits, and the page-wide cap. */
const AREA_PER_GRAIN = 10;
const MIN_GRAINS = 500;
const MAX_GRAINS = 6000;
const PAGE_GRAIN_CAP = 12000;
const MIN_SHARE = 300;
/** Grains are only seeded this far, in px, outside the viewport. */
const SEED_MARGIN = 100;
/** Seconds a released grain holds its home, and the latest release jitter. */
const HOLD = 0.04;
const RELEASE_JITTER = 0.14;
/** Every grain is gone by this many seconds after the sweep ends. */
const DUST_TAIL = 1.3;
/** A frame over this many ms counts as slow; this many in a row halve what is left to emit. */
const SLOW_FRAME_MS = 24;
const SLOW_FRAMES = 5;
/** Canvas backing store limits. */
const MAX_BACKING_SCALE = 2;
const MAX_BACKING_PIXELS = 6_000_000;
/** Side, in px, of the copy of an image that grain colours are read from. */
const SAMPLE_SIZE = 128;
/** Palette colours this close in relative luminance to the backdrop are mixed toward the text colour. */
const ASH_CONTRAST = 0.12;
const ASH_MIX = 0.4;
const MAX_PALETTE = 6;

/** Undo turns the clock round at this speed, and starts no further back than `T + REWIND_FROM`. */
const REWIND_SPEED = 1.25;
const REWIND_FROM = 0.45;
const REWIND_EASE = 0.15;

const COLLAPSE_MS = 280;
const REOPEN_MS = 240;
const PILL_DELAY_MS = 120;
const PILL_IN_MS = 180;
const PILL_OUT_MS = 140;
const LAPSE_COLLAPSE_DELAY_MS = 60;
const LAPSE_COLLAPSE_MS = 200;
const FADE_MS = 160;

/** Concurrent hiss voices, and the window in which a second dissolve plays quieter. */
const MAX_HISS_VOICES = 3;
const HISS_OVERLAP = 0.12;
const HISS_PEAK = 0.05;

// A gentle rising tick for the undo press (tiks' toggle on).
const UNDO_SOUND = {
	name: "dust-delete-undo",
	baseFreq: 620,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 3200,
	filterQ: 1,
	attack: 0.002,
	decay: 1.1,
	brightness: 3000,
} as const;

type Edge = "left" | "right" | "top" | "bottom";
type Phase =
	| "idle"
	| "dissolving"
	| "pending"
	| "restoring"
	| "committing"
	| "committed";
type Rgb = [number, number, number];

const silent = () =>
	typeof document !== "undefined" && document.visibilityState === "hidden";

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** A small seeded random generator, so one item's dust is reproducible. */
function seededRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** CSS `cubic-bezier()` as a lookup table, with its inverse for when a front reaches a point. */
function bezierTable(x1: number, y1: number, x2: number, y2: number) {
	const steps = 256;
	const xs = new Float32Array(steps + 1);
	const ys = new Float32Array(steps + 1);
	for (let index = 0; index <= steps; index++) {
		const t = index / steps;
		const u = 1 - t;
		xs[index] = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
		ys[index] = 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
	}
	const lookup = (from: Float32Array, to: Float32Array, value: number) => {
		if (value <= 0) return 0;
		if (value >= 1) return 1;
		let low = 0;
		let high = steps;
		while (high - low > 1) {
			const mid = (low + high) >> 1;
			if (from[mid] < value) low = mid;
			else high = mid;
		}
		const span = from[high] - from[low] || 1;
		return to[low] + ((value - from[low]) / span) * (to[high] - to[low]);
	};
	return {
		ease: (x: number) => lookup(xs, ys, x),
		inverse: (y: number) => lookup(ys, xs, y),
	};
}

/** The erosion front: a short gather, then steady. */
const frontCurve = bezierTable(0.3, 0, 0.5, 1);
/** Slot height changes. */
const slotCurve = bezierTable(0.25, 1, 0.5, 1);

interface Tween {
	from: number;
	to: number;
	/** Engine time in ms; `null` until the next frame picks it up. */
	start: number | null;
	delay: number;
	duration: number;
	ease?: (t: number) => number;
}

function tween(
	from: number,
	to: number,
	duration: number,
	options: { delay?: number; ease?: (t: number) => number } = {},
): Tween {
	return {
		from,
		to,
		start: null,
		delay: options.delay ?? 0,
		duration,
		ease: options.ease,
	};
}

function tweenAt(tween: Tween, now: number) {
	if (tween.start === null) tween.start = now;
	const elapsed = now - tween.start - tween.delay;
	if (elapsed <= 0) return { value: tween.from, done: false };
	if (elapsed >= tween.duration || tween.duration <= 0)
		return { value: tween.to, done: true };
	const t = elapsed / tween.duration;
	const eased = tween.ease ? tween.ease(t) : t;
	return { value: tween.from + (tween.to - tween.from) * eased, done: false };
}

/** Clock value `t` seconds into a rewind from `from`: steady at `REWIND_SPEED`, easing out at the end. */
function rewindClock(from: number, t: number) {
	const speed = REWIND_SPEED;
	const easeSeconds = Math.min(REWIND_EASE, (2 * from) / speed);
	const easeDistance = (speed * easeSeconds) / 2;
	const steady = (from - easeDistance) / speed;
	if (t <= steady) return from - speed * t;
	const tail = t - steady;
	if (tail >= easeSeconds) return 0;
	return Math.max(
		0,
		easeDistance - (speed * tail - (speed * tail * tail) / (2 * easeSeconds)),
	);
}

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */
/* -------------------------------------------------------------------------- */

let colorProbe: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, [number, number, number, number] | null>();

/** Any CSS colour (oklch, color-mix, …) as sRGB bytes, by painting one pixel. */
function parseColor(value: string) {
	const cached = colorCache.get(value);
	if (cached !== undefined) return cached;
	if (colorProbe === undefined) {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		colorProbe = canvas.getContext("2d", { willReadFrequently: true });
	}
	let result: [number, number, number, number] | null = null;
	if (colorProbe && value && value !== "transparent") {
		colorProbe.clearRect(0, 0, 1, 1);
		colorProbe.fillStyle = "#0000";
		colorProbe.fillStyle = value;
		colorProbe.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
		result = a ? [r, g, b, a / 255] : null;
	}
	colorCache.set(value, result);
	return result;
}

function luminance([r, g, b]: Rgb) {
	const channel = (value: number) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
	return [
		Math.round(a[0] + (b[0] - a[0]) * amount),
		Math.round(a[1] + (b[1] - a[1]) * amount),
		Math.round(a[2] + (b[2] - a[2]) * amount),
	];
}

/** The first opaque background behind `element`, i.e. what the dust floats over. */
function resolveBackdrop(element: Element): Rgb {
	for (
		let node: Element | null = element.parentElement;
		node;
		node = node.parentElement
	) {
		const color = parseColor(getComputedStyle(node).backgroundColor);
		if (color && color[3] > 0.95) return [color[0], color[1], color[2]];
	}
	const scheme = getComputedStyle(document.documentElement).colorScheme;
	return scheme.includes("dark") ? [0, 0, 0] : [255, 255, 255];
}

const COLOR_PATTERN =
	/(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;

interface ColorSource {
	/** Item-local layout px. */
	x: number;
	y: number;
	width: number;
	height: number;
	text: boolean;
	colors: number[];
}

interface Palette {
	colors: Rgb[];
	weights: number[];
	sources: ColorSource[];
}

/** The item's own colours from computed styles: surfaces by area, text, borders. */
function readPalette(
	content: HTMLElement,
	origin: DOMRect,
	zoom: number,
	backdrop: Rgb,
): Palette {
	const totals = new Map<string, { rgb: Rgb; weight: number }>();
	const raw: { rect: ColorSource; keys: string[] }[] = [];
	const add = (value: string, weight: number) => {
		const color = parseColor(value);
		if (!color || color[3] < 0.1) return null;
		const rgb: Rgb = [color[0], color[1], color[2]];
		const key = rgb.join(",");
		const entry = totals.get(key);
		if (entry) entry.weight += weight;
		else totals.set(key, { rgb, weight });
		return key;
	};

	const walker = document.createTreeWalker(content, NodeFilter.SHOW_ELEMENT);
	let visited = 0;
	for (
		let node = walker.nextNode() as Element | null;
		node && visited < 400;
		node = walker.nextNode() as Element | null
	) {
		visited++;
		const style = getComputedStyle(node);
		if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
		const box = node.getBoundingClientRect();
		if (box.width < 1 || box.height < 1) continue;
		const rect: ColorSource = {
			x: (box.left - origin.left) / zoom,
			y: (box.top - origin.top) / zoom,
			width: box.width / zoom,
			height: box.height / zoom,
			text: false,
			colors: [],
		};
		const area = rect.width * rect.height;
		const keys: string[] = [];
		const surface = add(style.backgroundColor, area);
		if (surface) keys.push(surface);
		const stops = style.backgroundImage.match(COLOR_PATTERN);
		if (stops)
			for (const stop of stops) {
				const key = add(stop, area / stops.length);
				if (key) keys.push(key);
			}
		if (keys.length) raw.push({ rect, keys });

		const border = Number.parseFloat(style.borderTopWidth);
		if (border > 0)
			add(style.borderTopColor, (rect.width + rect.height) * 2 * border);

		const hasText =
			node instanceof SVGSVGElement ||
			Array.from(node.childNodes).some(
				(child) =>
					child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
			);
		if (hasText) {
			const key = add(style.color, area * 0.35);
			if (key) raw.push({ rect: { ...rect, text: true }, keys: [key] });
		}
	}

	// The item's own surface, or the backdrop it sits on when it has none.
	const width = origin.width / zoom;
	const height = origin.height / zoom;
	const hasSurface = raw.some(
		({ rect }) => !rect.text && rect.width * rect.height > width * height * 0.5,
	);
	if (!hasSurface) {
		const key = backdrop.join(",");
		const entry = totals.get(key);
		if (entry) entry.weight += width * height;
		else totals.set(key, { rgb: backdrop, weight: width * height });
		raw.unshift({
			rect: { x: 0, y: 0, width, height, text: false, colors: [] },
			keys: [key],
		});
	}

	const ranked = [...totals.entries()]
		.sort((a, b) => b[1].weight - a[1].weight)
		.slice(0, MAX_PALETTE);
	const index = new Map(ranked.map(([key], position) => [key, position]));
	const sources: ColorSource[] = [];
	for (const { rect, keys } of raw) {
		const colors = keys
			.map((key) => index.get(key))
			.filter((value): value is number => value !== undefined);
		if (colors.length) sources.push({ ...rect, colors });
	}
	// Smallest first, so the topmost-ish source wins a lookup.
	sources.sort((a, b) => a.width * a.height - b.width * b.height);
	return {
		colors: ranked.map(([, entry]) => entry.rgb),
		weights: ranked.map(([, entry]) => entry.weight),
		sources: sources.slice(0, 64),
	};
}

interface PixelSource {
	x: number;
	y: number;
	width: number;
	height: number;
	scale: number;
	columns: number;
	rows: number;
	data: Uint8ClampedArray;
}

/** The largest image, canvas, or video in the item, read once at a small size. Null when tainted. */
function readPixels(
	content: HTMLElement,
	origin: DOMRect,
	zoom: number,
): PixelSource | null {
	const itemArea = origin.width * origin.height;
	let best: { element: HTMLElement; box: DOMRect } | null = null;
	for (const element of content.querySelectorAll<HTMLElement>(
		"img, canvas, video",
	)) {
		const box = element.getBoundingClientRect();
		const visibleWidth =
			Math.min(box.right, origin.right) - Math.max(box.left, origin.left);
		const visibleHeight =
			Math.min(box.bottom, origin.bottom) - Math.max(box.top, origin.top);
		const area = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
		if (area < itemArea * 0.25) continue;
		if (getComputedStyle(element).visibility === "hidden") continue;
		if (!best || area > best.box.width * best.box.height)
			best = { element, box };
	}
	if (!best) return null;
	const { element, box } = best;
	let sourceWidth = 0;
	let sourceHeight = 0;
	if (element instanceof HTMLImageElement) {
		if (!element.complete) return null;
		sourceWidth = element.naturalWidth;
		sourceHeight = element.naturalHeight;
	} else if (element instanceof HTMLVideoElement) {
		sourceWidth = element.videoWidth;
		sourceHeight = element.videoHeight;
	} else if (element instanceof HTMLCanvasElement) {
		sourceWidth = element.width;
		sourceHeight = element.height;
	}
	if (!sourceWidth || !sourceHeight) return null;

	const width = box.width / zoom;
	const height = box.height / zoom;
	const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
	const columns = Math.max(1, Math.round(width * scale));
	const rows = Math.max(1, Math.round(height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = columns;
	canvas.height = rows;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;

	// object-fit with a centred object-position.
	const fit = getComputedStyle(element).objectFit;
	let scaleX = width / sourceWidth;
	let scaleY = height / sourceHeight;
	if (fit === "cover" || fit === "contain" || fit === "scale-down") {
		const cover = Math.max(scaleX, scaleY);
		const contain = Math.min(scaleX, scaleY);
		const uniform =
			fit === "cover"
				? cover
				: fit === "contain"
					? contain
					: Math.min(1, contain);
		scaleX = uniform;
		scaleY = uniform;
	} else if (fit === "none") {
		scaleX = 1;
		scaleY = 1;
	}
	const drawWidth = sourceWidth * scaleX;
	const drawHeight = sourceHeight * scaleY;
	try {
		ctx.drawImage(
			element as CanvasImageSource,
			((width - drawWidth) / 2) * scale,
			((height - drawHeight) / 2) * scale,
			drawWidth * scale,
			drawHeight * scale,
		);
		const { data } = ctx.getImageData(0, 0, columns, rows);
		return {
			x: (box.left - origin.left) / zoom,
			y: (box.top - origin.top) / zoom,
			width,
			height,
			scale,
			columns,
			rows,
			data,
		};
	} catch {
		// A cross-origin image taints the canvas; the palette takes over.
		return null;
	}
}

/* -------------------------------------------------------------------------- */
/* Noise mask                                                                 */
/* -------------------------------------------------------------------------- */

let noise: { url: string; cells: Uint8Array } | null = null;

/** One 64 x 64 tile of binary noise, shared by every item and every class. */
function getNoise() {
	if (noise) return noise;
	const random = seededRandom(0xd057);
	const cells = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
	const canvas = document.createElement("canvas");
	canvas.width = NOISE_SIZE;
	canvas.height = NOISE_SIZE;
	const ctx = canvas.getContext("2d");
	let url = "";
	if (ctx) {
		const image = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
		for (let index = 0; index < cells.length; index++) {
			cells[index] = random() < NOISE_DENSITY ? 1 : 0;
			image.data[index * 4 + 3] = cells[index] * 255;
		}
		ctx.putImageData(image, 0, 0);
		url = canvas.toDataURL();
		// Decode it before the first dissolve needs it.
		const preload = new Image();
		preload.src = url;
	}
	noise = { url, cells };
	return noise;
}

/** Whether a noise class keeps the item-local point `(x, y)`. */
function inNoise(layer: number, x: number, y: number) {
	const { size, x: offsetX, y: offsetY } = NOISE_LAYERS[layer];
	const cells = getNoise().cells;
	const wrap = (value: number) => ((value % size) + size) % size;
	const column = Math.floor((wrap(x - offsetX) / size) * NOISE_SIZE);
	const row = Math.floor((wrap(y - offsetY) / size) * NOISE_SIZE);
	return cells[row * NOISE_SIZE + column] === 1;
}

let maskSupport: boolean | undefined;

function supportsMask() {
	if (maskSupport === undefined) {
		const css = typeof CSS !== "undefined" ? CSS : null;
		maskSupport =
			!!css &&
			((css.supports("mask-image", "linear-gradient(#000, #000)") &&
				css.supports("mask-composite", "intersect")) ||
				(css.supports("-webkit-mask-image", "linear-gradient(#000, #000)") &&
					css.supports("-webkit-mask-composite", "source-in")));
	}
	return maskSupport;
}

const GRADIENT_DIRECTION: Record<Edge, string> = {
	left: "to right",
	right: "to left",
	top: "to bottom",
	bottom: "to top",
};

/**
 * Seven layers, bottom up: the lead front, then three times a noise class
 * (`add`) and the next front (`intersect`). Alpha is
 * g3 x (n3 + g2 x (n2 + g1 x (n1 + g0))), so each class thins out as its own
 * front passes and the item loses density grain by grain.
 */
function maskStyles(from: Edge, band: number) {
	const url = getNoise().url;
	const front = (k: number) => {
		const lag = (k * band) / 3;
		const clear = BLEED - lag - FEATHER;
		const solid = BLEED - lag;
		return `linear-gradient(${GRADIENT_DIRECTION[from]}, #0000 calc(var(--dust-front) + ${clear}px), #000 calc(var(--dust-front) + ${solid}px))`;
	};
	const tile = (layer: number) => NOISE_LAYERS[layer];
	const frontSize = `calc(100% + ${BLEED * 2}px) calc(100% + ${BLEED * 2}px)`;
	const frontPosition = `-${BLEED}px -${BLEED}px`;
	const layers = [
		{
			image: front(3),
			size: frontSize,
			position: frontPosition,
			gradient: true,
		},
		...[2, 1, 0].flatMap((layer) => [
			{
				image: `url(${url})`,
				size: `${tile(layer).size}px ${tile(layer).size}px`,
				position: `${tile(layer).x}px ${tile(layer).y}px`,
				gradient: false,
			},
			{
				image: front(layer),
				size: frontSize,
				position: frontPosition,
				gradient: true,
			},
		]),
	];
	const list = (
		pick: (layer: (typeof layers)[number], index: number) => string,
	) => layers.map(pick).join(", ");
	const composite = (intersect: string, add: string) =>
		list((layer, index) =>
			index === layers.length - 1 ? add : layer.gradient ? intersect : add,
		);
	return {
		"-webkit-mask-image": list((layer) => layer.image),
		"-webkit-mask-size": list((layer) => layer.size),
		"-webkit-mask-position": list((layer) => layer.position),
		"-webkit-mask-repeat": list((layer) =>
			layer.gradient ? "no-repeat" : "repeat",
		),
		"-webkit-mask-composite": composite("source-in", "source-over"),
		"-webkit-mask-clip": list(() => "no-clip"),
		"mask-image": list((layer) => layer.image),
		"mask-size": list((layer) => layer.size),
		"mask-position": list((layer) => layer.position),
		"mask-repeat": list((layer) => (layer.gradient ? "no-repeat" : "repeat")),
		"mask-composite": composite("intersect", "add"),
		"mask-clip": list(() => "no-clip"),
		"mask-mode": list(() => "alpha"),
	};
}

/* -------------------------------------------------------------------------- */
/* Hiss                                                                       */
/* -------------------------------------------------------------------------- */

interface DustAudio {
	ctx: AudioContext;
	output: GainNode;
	noise: AudioBuffer;
	voices: number[];
	lastAt: number;
}

let dustAudio: DustAudio | null = null;

/** One shared context for every item, created on the first delete (a user gesture). */
function getDustAudio() {
	if (dustAudio && dustAudio.ctx.state !== "closed") return dustAudio;
	const AudioContextClass =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return null;
	const ctx = new AudioContextClass();
	const output = ctx.createGain();
	output.gain.value = 1;
	output.connect(ctx.destination);
	// Fine noise with sparse louder crackles, like sand poured on paper.
	const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let index = 0; index < data.length; index++) {
		const crackle = Math.random() < 0.02 ? 1 : 0.3;
		data[index] = (Math.random() * 2 - 1) * crackle;
	}
	dustAudio = { ctx, output, noise: buffer, voices: [], lastAt: -1 };
	return dustAudio;
}

/** A soft granular hiss whose band slides down over the sweep, or up when `rising`. */
function playHiss(seconds: number, rising: boolean, level = 1) {
	const audio = getDustAudio();
	if (!audio) return;
	const { ctx } = audio;
	if (ctx.state === "suspended") void ctx.resume().catch(() => {});
	const start = ctx.currentTime + 0.005;
	audio.voices = audio.voices.filter((end) => end > start);
	if (audio.voices.length >= MAX_HISS_VOICES) return;
	let peak = HISS_PEAK * level;
	if (!rising) {
		if (start - audio.lastAt < HISS_OVERLAP) peak *= 0.6;
		audio.lastAt = start;
	}
	const tail = rising ? 0.15 : 0.25;
	const end = start + seconds + tail;
	audio.voices.push(end);

	const source = ctx.createBufferSource();
	source.buffer = audio.noise;
	source.loop = true;
	const band = ctx.createBiquadFilter();
	band.type = "bandpass";
	band.Q.value = 0.8;
	band.frequency.setValueAtTime(rising ? 2200 : 5200, start);
	band.frequency.exponentialRampToValueAtTime(
		rising ? 5200 : 2200,
		start + seconds,
	);
	const highpass = ctx.createBiquadFilter();
	highpass.type = "highpass";
	highpass.frequency.value = 900;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0, start);
	gain.gain.linearRampToValueAtTime(peak, start + 0.06);
	gain.gain.linearRampToValueAtTime(peak * 0.7, start + seconds);
	gain.gain.linearRampToValueAtTime(0, end);
	source.connect(band);
	band.connect(highpass);
	highpass.connect(gain);
	gain.connect(audio.output);
	source.start(start, Math.random() * 0.5);
	source.stop(end + 0.02);
}

/* -------------------------------------------------------------------------- */
/* Engine: one canvas, one clock                                              */
/* -------------------------------------------------------------------------- */

interface Grains {
	count: number;
	homeX: Float32Array;
	homeY: Float32Array;
	release: Float32Array;
	life: Float32Array;
	dirX: Float32Array;
	dirY: Float32Array;
	distance: Float32Array;
	wobble: Float32Array;
	frequency: Float32Array;
	phase: Float32Array;
	size: Float32Array;
	color: Uint16Array;
	/** Draw order, grouped by colour so `fillStyle` changes rarely. */
	order: Uint32Array;
	colors: string[];
	dark: boolean;
	/** Clock value at which the last grain is gone. */
	end: number;
}

interface EngineItem {
	/** Reads layout (rects) before any item writes this frame. */
	measure: () => void;
	/** Advances clocks and writes styles. Returns false once the item can rest. */
	step: (now: number, dt: number) => boolean;
	/** Live grain count, 0 when there is nothing to draw. */
	liveGrains: () => number;
	draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
	/** Jumps to the destination state (tab hidden, resize). */
	finish: () => void;
	/** Halves the grains not yet released. */
	thin: () => void;
}

const engine = {
	items: new Set<EngineItem>(),
	frame: 0,
	last: null as number | null,
	slow: 0,
	canvas: null as HTMLCanvasElement | null,
	ctx: null as CanvasRenderingContext2D | null,
	canvasOk: undefined as boolean | undefined,
	scale: 1,
	listening: false,
};

/** Creates the page canvas on first use; false when 2D is unavailable. */
function canvasAvailable() {
	if (engine.canvasOk !== undefined) return engine.canvasOk;
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	canvas.dataset.slot = "dust-delete-canvas";
	Object.assign(canvas.style, {
		position: "fixed",
		inset: "0",
		width: "100%",
		height: "100%",
		pointerEvents: "none",
		zIndex: "2147483000",
		contain: "strict",
	});
	const ctx = canvas.getContext("2d");
	engine.canvasOk = !!ctx;
	if (ctx) {
		engine.canvas = canvas;
		engine.ctx = ctx;
	}
	return engine.canvasOk;
}

/** Fits the canvas to the viewport at min(DPR, 2), within the pixel budget. */
function sizeCanvas() {
	const canvas = engine.canvas;
	if (!canvas) return;
	const width = window.innerWidth;
	const height = window.innerHeight;
	let scale = Math.min(window.devicePixelRatio || 1, MAX_BACKING_SCALE);
	if (width * height * scale * scale > MAX_BACKING_PIXELS)
		scale = Math.sqrt(MAX_BACKING_PIXELS / (width * height));
	const deviceWidth = Math.round(width * scale);
	const deviceHeight = Math.round(height * scale);
	if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
	if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
	engine.scale = scale;
}

function onVisibility() {
	engine.last = null;
	if (document.visibilityState === "hidden")
		for (const item of engine.items) item.finish();
}

function onResize() {
	for (const item of engine.items) item.finish();
	sizeCanvas();
}

function liveGrains() {
	let total = 0;
	for (const item of engine.items) total += item.liveGrains();
	return total;
}

function tick(now: number) {
	engine.frame = 0;
	const elapsed = engine.last === null ? 0 : now - engine.last;
	engine.last = now;
	const dt = Math.min(elapsed, 100) / 1000;

	if (elapsed > SLOW_FRAME_MS) engine.slow++;
	else engine.slow = 0;
	if (engine.slow >= SLOW_FRAMES) {
		engine.slow = 0;
		for (const item of engine.items) item.thin();
	}

	const items = [...engine.items];
	for (const item of items) item.measure();
	for (const item of items) if (!item.step(now, dt)) engine.items.delete(item);

	const { canvas, ctx } = engine;
	const drawing = items.filter((item) => item.liveGrains() > 0);
	if (canvas && ctx && drawing.length) {
		if (!canvas.isConnected) {
			sizeCanvas();
			document.body.appendChild(canvas);
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const item of drawing) item.draw(ctx, engine.scale);
		ctx.globalAlpha = 1;
	} else if (canvas?.isConnected) {
		canvas.remove();
	}

	if (engine.items.size) engine.frame = requestAnimationFrame(tick);
	else sleep();
}

function wake(item: EngineItem) {
	engine.items.add(item);
	if (!engine.listening) {
		engine.listening = true;
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("resize", onResize);
	}
	if (!engine.frame) engine.frame = requestAnimationFrame(tick);
}

function sleep() {
	engine.last = null;
	engine.slow = 0;
	if (engine.frame) cancelAnimationFrame(engine.frame);
	engine.frame = 0;
	engine.canvas?.remove();
	if (engine.listening) {
		engine.listening = false;
		document.removeEventListener("visibilitychange", onVisibility);
		window.removeEventListener("resize", onResize);
	}
}

function forget(item: EngineItem) {
	engine.items.delete(item);
	if (!engine.items.size) sleep();
}

/* -------------------------------------------------------------------------- */
/* One item's dissolve, undo window, and reassembly                           */
/* -------------------------------------------------------------------------- */

interface ItemHost {
	slot: HTMLDivElement | null;
	content: HTMLDivElement | null;
	undoRow: HTMLDivElement | null;
	undoButton: HTMLButtonElement | null;
	hairline: HTMLSpanElement | null;
	options: () => {
		from: Edge;
		collapse: boolean;
		undoDuration: number;
		dustColors?: string[];
	};
	setPhase: (phase: Phase) => void;
	/** The undo window lapsed and the slot has closed. */
	committed: () => void;
}

interface Sweep {
	from: Edge;
	/** Size along and across the sweep, layout px. */
	length: number;
	width: number;
	height: number;
	band: number;
	duration: number;
	travel: number;
	zoom: number;
	styles: Record<string, string>;
}

function sweepFor(
	from: Edge,
	width: number,
	height: number,
	zoom: number,
): Sweep {
	const length = from === "left" || from === "right" ? width : height;
	const band = clamp(0.45 * length, 48, 220);
	const crossing = length + 2 * BLEED + FEATHER;
	const travel = crossing + band;
	// The lead front crosses the item in T; the clock runs on at the same pace
	// until the trailing front has left the far edge too.
	const duration = clamp(0.5 + length / 800, 0.6, 1) * (travel / crossing);
	return {
		from,
		length,
		width,
		height,
		band,
		duration,
		travel,
		zoom,
		styles: {},
	};
}

/** Lead front position along the sweep, item-local px, at clock `c`. */
function leadAt(sweep: Sweep, c: number) {
	return (
		-BLEED + frontCurve.ease(clamp(c / sweep.duration, 0, 1)) * sweep.travel
	);
}

/** Clock value when the lead front reaches `position`. */
function clockAtLead(sweep: Sweep, position: number) {
	return (
		frontCurve.inverse(clamp((position + BLEED) / sweep.travel, 0, 1)) *
		sweep.duration
	);
}

const DRIFT: Record<Edge, [number, number]> = {
	left: [-0.42, -0.91],
	right: [0.42, -0.91],
	top: [-0.196, -0.981],
	bottom: [-0.196, -0.981],
};

type ContentMode = "flow" | "hidden" | "ghost";

class DustItem implements EngineItem {
	host: ItemHost;
	phase: Phase = "idle";
	mode: "dust" | "fade" = "fade";
	clock = 0;
	rewind: { from: number; start: number | null } | null = null;
	sweep: Sweep | null = null;
	grains: Grains | null = null;
	masked = false;
	contentMode: ContentMode = "flow";
	sweepEnded = false;
	restHeight = 0;
	slotHeight: number | null = null;
	heightTween: Tween | null = null;
	pillTween: Tween | null = null;
	pillOpacity = 0;
	fadeTween: Tween | null = null;
	remaining = 0;
	windowOpen = false;
	hovered = false;
	pressed = false;
	anchorX = 0;
	anchorY = 0;
	slotWidth = 0;
	resize: ResizeObserver | null = null;

	constructor(host: ItemHost, phase: Phase) {
		this.host = host;
		this.phase = phase;
	}

	setPhase(phase: Phase) {
		this.phase = phase;
		if (this.host.slot) this.host.slot.dataset.state = phase;
		this.host.setPhase(phase);
	}

	/* Styles ---------------------------------------------------------------- */

	applyMask() {
		const content = this.host.content;
		if (!content || !this.sweep || this.masked) return;
		for (const [property, value] of Object.entries(this.sweep.styles))
			content.style.setProperty(property, value);
		content.style.willChange = "mask-image";
		this.masked = true;
		this.writeFront();
	}

	clearMask() {
		const content = this.host.content;
		if (!content || !this.sweep || !this.masked) return;
		for (const property of Object.keys(this.sweep.styles))
			content.style.removeProperty(property);
		content.style.removeProperty("--dust-front");
		content.style.removeProperty("will-change");
		this.masked = false;
	}

	writeFront() {
		if (!this.masked || !this.sweep || !this.host.content) return;
		const front = leadAt(this.sweep, this.clock);
		this.host.content.style.setProperty(
			"--dust-front",
			`${front.toFixed(2)}px`,
		);
	}

	setContent(mode: ContentMode) {
		const { content, slot } = this.host;
		this.contentMode = mode;
		if (!content || !slot) return;
		if (mode === "flow") {
			for (const property of ["position", "inset", "visibility"])
				content.style.removeProperty(property);
			slot.style.removeProperty("overflow");
			return;
		}
		Object.assign(content.style, {
			position: "absolute",
			inset: "0 0 auto 0",
			visibility: mode === "hidden" ? "hidden" : "visible",
		});
		slot.style.overflow = "clip";
	}

	setHeight(value: number | null) {
		const slot = this.host.slot;
		this.slotHeight = value;
		if (!slot) return;
		if (value === null) slot.style.removeProperty("height");
		else slot.style.height = `${value}px`;
	}

	setPill(opacity: number, scale = 1) {
		this.pillOpacity = opacity;
		const row = this.host.undoRow;
		if (!row) return;
		row.style.opacity = String(opacity);
		row.style.transform = scale === 1 ? "" : `scale(${scale})`;
	}

	setFade(opacity: number | null) {
		const content = this.host.content;
		if (!content) return;
		if (opacity === null) content.style.removeProperty("opacity");
		else content.style.opacity = String(opacity);
	}

	watchSize() {
		const slot = this.host.slot;
		if (!slot || this.resize || typeof ResizeObserver === "undefined") return;
		this.slotWidth = slot.offsetWidth;
		this.resize = new ResizeObserver(() => {
			if (!this.host.slot) return;
			const width = this.host.slot.offsetWidth;
			// Height changes are ours; a new width means the layout moved under us.
			if (Math.abs(width - this.slotWidth) > 0.5) {
				this.slotWidth = width;
				this.finish();
			}
		});
		this.resize.observe(slot);
	}

	unwatchSize() {
		this.resize?.disconnect();
		this.resize = null;
	}

	/* Transitions ----------------------------------------------------------- */

	/** Starts the delete. Returns the sweep duration, for the hiss. */
	dissolve(reducedMotion: boolean) {
		const { slot, content } = this.host;
		if (!slot || !content) return 0;
		if (this.phase === "restoring") {
			if (this.mode === "dust" && this.grains && !reducedMotion) {
				// Turn round again from where the clock is.
				this.rewind = null;
				this.pillTween = null;
				this.heightTween = null;
				this.setHeight(null);
				this.setContent("flow");
				this.sweepEnded = false;
				this.setPhase("dissolving");
				wake(this);
				return this.sweep?.duration ?? 0;
			}
			this.completeRestore();
		}
		if (this.phase !== "idle") return 0;

		const options = this.host.options();
		const rect = slot.getBoundingClientRect();
		const width = slot.offsetWidth;
		const height = slot.offsetHeight;
		const zoom = width ? rect.width / width || 1 : 1;
		this.restHeight = height;
		const sweep = sweepFor(options.from, width, height, zoom);
		this.sweep = sweep;
		this.clock = 0;
		this.rewind = null;
		this.sweepEnded = false;
		this.windowOpen = false;
		this.remaining = options.undoDuration;
		this.grains = null;
		this.heightTween = null;
		this.pillTween = null;
		this.fadeTween = null;
		this.hovered = false;
		this.pressed = false;
		this.setPill(0);
		this.writeHairline();

		const onScreen =
			rect.bottom > 0 &&
			rect.top < window.innerHeight &&
			rect.right > 0 &&
			rect.left < window.innerWidth;
		const dust =
			!reducedMotion &&
			onScreen &&
			width > 0 &&
			height > 0 &&
			supportsMask() &&
			canvasAvailable();
		this.mode = dust ? "dust" : "fade";

		if (dust) {
			sweep.styles = maskStyles(sweep.from, sweep.band);
			this.applyMask();
			this.grains = this.seed(sweep, rect);
		} else if (onScreen && width > 0) {
			this.fadeTween = tween(1, 0, FADE_MS);
		} else {
			// Off screen: skip straight to the window.
			this.fadeTween = tween(0, 0, 0);
		}
		this.watchSize();
		this.setPhase("dissolving");
		wake(this);
		return sweep.duration;
	}

	/** Starts the reassembly from wherever the item is. */
	restore(reducedMotion: boolean) {
		if (
			this.phase !== "dissolving" &&
			this.phase !== "pending" &&
			this.phase !== "committing" &&
			this.phase !== "committed"
		)
			return false;
		const fromCommitted = this.phase === "committed";
		this.windowOpen = false;
		this.pillTween = tween(this.pillOpacity, 0, PILL_OUT_MS);
		const sweep = this.sweep;
		if (
			this.mode === "dust" &&
			sweep &&
			this.grains &&
			!reducedMotion &&
			!fromCommitted &&
			this.phase !== "committing"
		) {
			const from = Math.min(this.clock, sweep.duration + REWIND_FROM);
			this.clock = from;
			this.rewind = { from, start: null };
			this.applyMask();
			this.writeFront();
			if (this.contentMode === "hidden") {
				this.setContent("ghost");
				const seconds = clamp(
					(from - sweep.duration) / REWIND_SPEED,
					0,
					REOPEN_MS / 1000,
				);
				this.heightTween = tween(
					this.slotHeight ?? this.restHeight,
					this.restHeight,
					seconds * 1000,
					{ ease: slotCurve.ease },
				);
			}
		} else {
			// The fallback: the slot snaps open and the item fades back in.
			this.mode = "fade";
			this.grains = null;
			this.rewind = null;
			this.clearMask();
			this.heightTween = null;
			this.setHeight(null);
			this.setContent("flow");
			const host = this.host.slot;
			if (host) host.hidden = false;
			this.setFade(0);
			this.fadeTween = tween(0, 1, FADE_MS);
		}
		this.watchSize();
		this.setPhase("restoring");
		wake(this);
		return true;
	}

	/** Ends the sweep: the content is gone, the slot closes, the pill comes in. */
	endSweep(instant: boolean) {
		const sweep = this.sweep;
		if (!sweep) return;
		this.sweepEnded = true;
		const { collapse, undoDuration } = this.host.options();
		this.clearMask();
		this.setFade(null);
		this.setContent("hidden");
		const from = this.slotHeight ?? this.restHeight;
		const target = !collapse
			? this.restHeight
			: undoDuration > 0
				? UNDO_ROW
				: 0;
		const animate = this.mode === "dust" && !instant;
		this.heightTween = tween(from, target, animate ? COLLAPSE_MS : 0, {
			ease: slotCurve.ease,
		});
		if (undoDuration > 0) {
			this.pillTween = animate
				? tween(0, 1, PILL_IN_MS, { delay: PILL_DELAY_MS })
				: tween(0, 1, instant ? 0 : FADE_MS);
		}
		this.setPhase("pending");
	}

	lapse() {
		const { collapse } = this.host.options();
		this.windowOpen = false;
		this.pillTween = tween(this.pillOpacity, 0, PILL_OUT_MS);
		if (collapse) {
			const animate = this.mode === "dust";
			this.heightTween = tween(
				this.slotHeight ?? UNDO_ROW,
				0,
				animate ? LAPSE_COLLAPSE_MS : 0,
				{
					delay: animate ? LAPSE_COLLAPSE_DELAY_MS : PILL_OUT_MS,
					ease: slotCurve.ease,
				},
			);
		}
		this.setPhase("committing");
	}

	completeCommit() {
		this.unwatchSize();
		this.pillTween = null;
		this.heightTween = null;
		this.setPill(0);
		if (this.host.options().collapse) this.setHeight(0);
		if (this.host.slot) this.host.slot.hidden = true;
		this.setPhase("committed");
		this.host.committed();
	}

	completeRestore() {
		this.unwatchSize();
		this.clearMask();
		this.setFade(null);
		this.setContent("flow");
		this.setHeight(null);
		this.setPill(0);
		this.clock = 0;
		this.rewind = null;
		this.grains = null;
		this.heightTween = null;
		this.pillTween = null;
		this.fadeTween = null;
		this.sweepEnded = false;
		this.windowOpen = false;
		if (this.host.slot) this.host.slot.hidden = false;
		this.setPhase("idle");
	}

	finish() {
		if (this.phase === "dissolving") {
			if (this.grains) this.clock = Math.max(this.clock, this.grains.end);
			this.endSweep(true);
			this.settleTweens();
			this.windowOpen = this.host.options().undoDuration > 0;
			if (!this.windowOpen) {
				this.completeCommit();
				return;
			}
		} else if (this.phase === "restoring") {
			this.completeRestore();
		} else if (this.phase === "committing") {
			this.completeCommit();
		} else if (this.phase === "pending" && this.grains) {
			this.clock = Math.max(this.clock, this.grains.end);
			this.settleTweens();
			if (this.host.options().undoDuration > 0) this.windowOpen = true;
		}
	}

	/** Jumps every running tween to its end value. */
	settleTweens() {
		if (this.heightTween) {
			this.setHeight(this.heightTween.to);
			this.heightTween = null;
		}
		if (this.pillTween) {
			this.setPill(this.pillTween.to);
			this.pillTween = null;
		}
		if (this.fadeTween) {
			this.setFade(this.fadeTween.to);
			this.fadeTween = null;
		}
	}

	destroy() {
		this.unwatchSize();
		this.clearMask();
		this.grains = null;
		forget(this);
	}

	/* Countdown ------------------------------------------------------------- */

	writeHairline() {
		const { hairline } = this.host;
		const { undoDuration } = this.host.options();
		if (!hairline) return;
		const fraction =
			undoDuration > 0 ? clamp(this.remaining / undoDuration, 0, 1) : 0;
		hairline.style.transform = `scaleX(${fraction})`;
	}

	paused() {
		if (this.hovered || this.pressed || silent()) return true;
		const button = this.host.undoButton;
		try {
			return !!button?.matches(":focus-visible");
		} catch {
			return false;
		}
	}

	/* Engine hooks ---------------------------------------------------------- */

	measure() {
		const slot = this.host.slot;
		// A committed slot is hidden; its last dust stays where it was.
		if (!slot || !this.grains || slot.hidden || !slot.isConnected) return;
		const rect = slot.getBoundingClientRect();
		this.anchorX = rect.left;
		this.anchorY = rect.top;
	}

	liveGrains() {
		const grains = this.grains;
		if (!grains || this.mode !== "dust") return 0;
		if (this.clock >= grains.end || this.clock <= 0) return 0;
		return grains.count;
	}

	thin() {
		const grains = this.grains;
		if (!grains || this.phase !== "dissolving") return;
		for (let index = 0; index < grains.count; index++)
			if (grains.release[index] > this.clock && index % 2)
				grains.release[index] = Number.POSITIVE_INFINITY;
	}

	step(now: number, dt: number) {
		const sweep = this.sweep;
		const { undoDuration } = this.host.options();

		if (this.mode === "dust" && sweep) {
			if (this.rewind) {
				if (this.rewind.start === null) this.rewind.start = now;
				this.clock = rewindClock(
					this.rewind.from,
					(now - this.rewind.start) / 1000,
				);
			} else if (this.phase !== "restoring" && this.phase !== "idle") {
				const end = Math.max(sweep.duration, this.grains?.end ?? 0);
				if (this.clock < end) this.clock = Math.min(end, this.clock + dt);
			}
			this.writeFront();
		}

		if (this.fadeTween) {
			const { value, done } = tweenAt(this.fadeTween, now);
			this.setFade(value);
			if (done) this.fadeTween = null;
		}

		if (this.phase === "dissolving") {
			const swept =
				this.mode === "dust" && sweep
					? this.clock >= sweep.duration
					: !this.fadeTween;
			if (swept) this.endSweep(false);
		}

		if (this.heightTween) {
			const { value, done } = tweenAt(this.heightTween, now);
			this.setHeight(value);
			if (done) {
				this.heightTween = null;
				if (this.phase === "restoring") {
					this.setHeight(null);
					this.setContent("flow");
				}
			}
		}

		if (this.pillTween) {
			const tweenNow = this.pillTween;
			const { value, done } = tweenAt(tweenNow, now);
			const rising = tweenNow.to > tweenNow.from;
			this.setPill(
				value,
				rising && this.mode === "dust" ? 0.96 + 0.04 * value : 1,
			);
			if (done) {
				this.pillTween = null;
				if (rising && this.phase === "pending") this.windowOpen = true;
			}
		}

		if (this.phase === "pending") {
			if (undoDuration <= 0) {
				if (!this.heightTween) this.completeCommit();
			} else if (this.windowOpen) {
				if (!this.paused()) this.remaining -= dt * 1000;
				this.writeHairline();
				if (this.remaining <= 0) this.lapse();
			}
		}

		if (this.phase === "committing" && !this.pillTween && !this.heightTween)
			this.completeCommit();

		if (this.phase === "restoring") {
			const rewound =
				this.mode === "dust" ? !!this.rewind && this.clock <= 0 : true;
			if (rewound && !this.fadeTween && !this.heightTween) {
				this.completeRestore();
				return false;
			}
		}

		// Dust from a quick commit may still be in the air.
		if (this.phase === "committed") return this.liveGrains() > 0;
		return this.phase !== "idle";
	}

	draw(ctx: CanvasRenderingContext2D, scale: number) {
		const grains = this.grains;
		const sweep = this.sweep;
		if (!grains || !sweep) return;
		const c = this.clock;
		const zoom = sweep.zoom;
		const unit = zoom * scale;
		const originX = this.anchorX * scale;
		const originY = this.anchorY * scale;
		let lastColor = -1;
		for (let position = 0; position < grains.count; position++) {
			const index = grains.order[position];
			const age = c - grains.release[index];
			if (!(age >= 0)) continue;
			const moving = age - HOLD;
			const life = grains.life[index];
			const u = moving > 0 ? moving / life : 0;
			if (u >= 1) continue;
			let alpha = u <= 0.15 ? 1 : (1 - (u - 0.15) / 0.85) ** 1.5;
			// Dark mode: the grain darkens into the page as it goes.
			if (grains.dark) alpha *= 1 - 0.35 * u;
			if (alpha < 0.02) continue;
			const travel = grains.distance[index] * (1 - (1 - u) * (1 - u));
			const sway =
				grains.wobble[index] *
				u *
				Math.sin(
					grains.phase[index] +
						2 * Math.PI * grains.frequency[index] * Math.max(0, moving),
				);
			const dirX = grains.dirX[index];
			const dirY = grains.dirY[index];
			const x = grains.homeX[index] + dirX * travel - dirY * sway;
			const y = grains.homeY[index] + dirY * travel + dirX * sway;
			const side = Math.max(
				1,
				Math.round(grains.size[index] * (1 - 0.4 * u) * unit),
			);
			const color = grains.color[index];
			if (color !== lastColor) {
				ctx.fillStyle = grains.colors[color];
				lastColor = color;
			}
			ctx.globalAlpha = alpha;
			ctx.fillRect(
				Math.round(originX + x * unit - side / 2),
				Math.round(originY + y * unit - side / 2),
				side,
				side,
			);
		}
	}

	/* Seeding --------------------------------------------------------------- */

	seed(sweep: Sweep, rect: DOMRect): Grains | null {
		const { slot, content } = this.host;
		if (!slot || !content) return null;
		const { width, height, zoom } = sweep;
		const random = seededRandom((Math.random() * 2 ** 32) >>> 0);

		// Only the part of the item near the viewport sheds dust.
		const visibleLeft = Math.max(0, (-SEED_MARGIN - rect.left) / zoom);
		const visibleTop = Math.max(0, (-SEED_MARGIN - rect.top) / zoom);
		const visibleRight = Math.min(
			width,
			(window.innerWidth + SEED_MARGIN - rect.left) / zoom,
		);
		const visibleBottom = Math.min(
			height,
			(window.innerHeight + SEED_MARGIN - rect.top) / zoom,
		);
		const visibleWidth = visibleRight - visibleLeft;
		const visibleHeight = visibleBottom - visibleTop;
		if (visibleWidth <= 0 || visibleHeight <= 0) return null;

		const wanted = clamp(
			Math.round((visibleWidth * visibleHeight) / AREA_PER_GRAIN),
			MIN_GRAINS,
			MAX_GRAINS,
		);
		const room = PAGE_GRAIN_CAP - liveGrains();
		const target = Math.max(MIN_SHARE, Math.min(wanted, room));

		// Corner radius of the item's surface, so dust stays inside its silhouette.
		const surface = content.firstElementChild as HTMLElement | null;
		let radius =
			Number.parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 0;
		if (surface) {
			const box = surface.getBoundingClientRect();
			if (box.width >= rect.width * 0.9 && box.height >= rect.height * 0.9)
				radius = Math.max(
					radius,
					Number.parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0,
				);
		}
		radius = Math.min(radius, width / 2, height / 2);
		const inside = (x: number, y: number) => {
			if (radius <= 0) return true;
			const cx = clamp(x, radius, width - radius);
			const cy = clamp(y, radius, height - radius);
			return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
		};

		// Colours: the image's own pixels where there is one, the palette elsewhere.
		const backdrop = resolveBackdrop(slot);
		const backdropLuminance = luminance(backdrop);
		const dark = backdropLuminance < 0.2;
		const textColor = parseColor(getComputedStyle(content).color);
		const ink: Rgb = textColor
			? [textColor[0], textColor[1], textColor[2]]
			: dark
				? [235, 235, 235]
				: [40, 40, 40];
		const custom = this.host.options().dustColors;
		const palette: Palette = custom?.length
			? {
					colors: custom
						.map(parseColor)
						.filter(
							(value): value is [number, number, number, number] => !!value,
						)
						.map(([r, g, b]) => [r, g, b] as Rgb),
					weights: custom.map(() => 1),
					sources: [],
				}
			: readPalette(content, rect, zoom, backdrop);
		if (!palette.colors.length) {
			palette.colors = [ink];
			palette.weights = [1];
		}
		const pixels = custom?.length ? null : readPixels(content, rect, zoom);

		const table: string[] = [];
		const tableIndex = new Map<number, number>();
		const colorIndex = (rgb: Rgb) => {
			// Five bits a channel is plenty for specks a couple of px wide.
			const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
			const known = tableIndex.get(key);
			if (known !== undefined) return known;
			// Ash: colours that would vanish into the backdrop lean toward the text colour.
			const visible =
				Math.abs(luminance(rgb) - backdropLuminance) < ASH_CONTRAST
					? mix(rgb, ink, ASH_MIX)
					: rgb;
			const index = table.length;
			table.push(`rgb(${visible[0]} ${visible[1]} ${visible[2]})`);
			tableIndex.set(key, index);
			return index;
		};
		const paletteIndex = palette.colors.map(colorIndex);
		const totalWeight =
			palette.weights.reduce((sum, value) => sum + value, 0) || 1;
		const pickWeighted = () => {
			let roll = random() * totalWeight;
			for (let index = 0; index < palette.weights.length; index++) {
				roll -= palette.weights[index];
				if (roll <= 0) return paletteIndex[index];
			}
			return paletteIndex[0];
		};
		const pickAt = (x: number, y: number) => {
			if (pixels) {
				const px = x - pixels.x;
				const py = y - pixels.y;
				if (px >= 0 && py >= 0 && px < pixels.width && py < pixels.height) {
					const column = Math.min(
						pixels.columns - 1,
						Math.floor(px * pixels.scale),
					);
					const row = Math.min(pixels.rows - 1, Math.floor(py * pixels.scale));
					const offset = (row * pixels.columns + column) * 4;
					if (pixels.data[offset + 3] > 128)
						return colorIndex([
							pixels.data[offset],
							pixels.data[offset + 1],
							pixels.data[offset + 2],
						]);
				}
			}
			let surfaceSource: ColorSource | null = null;
			let textSource: ColorSource | null = null;
			for (const source of palette.sources) {
				if (
					x < source.x ||
					y < source.y ||
					x > source.x + source.width ||
					y > source.y + source.height
				)
					continue;
				if (source.text) textSource ??= source;
				else surfaceSource ??= source;
				if (surfaceSource && textSource) break;
			}
			const source =
				textSource && (random() < 0.25 || !surfaceSource)
					? textSource
					: surfaceSource;
			if (!source) return pickWeighted();
			return paletteIndex[
				source.colors[Math.floor(random() * source.colors.length)]
			];
		};

		// A jittered grid over the visible part of the item.
		const cell = Math.sqrt((visibleWidth * visibleHeight) / target);
		const columns = Math.max(1, Math.round(visibleWidth / cell));
		const rows = Math.max(1, Math.round(visibleHeight / cell));
		const cellWidth = visibleWidth / columns;
		const cellHeight = visibleHeight / rows;
		const capacity = columns * rows;
		const grains: Grains = {
			count: 0,
			homeX: new Float32Array(capacity),
			homeY: new Float32Array(capacity),
			release: new Float32Array(capacity),
			life: new Float32Array(capacity),
			dirX: new Float32Array(capacity),
			dirY: new Float32Array(capacity),
			distance: new Float32Array(capacity),
			wobble: new Float32Array(capacity),
			frequency: new Float32Array(capacity),
			phase: new Float32Array(capacity),
			size: new Float32Array(capacity),
			color: new Uint16Array(capacity),
			order: new Uint32Array(capacity),
			colors: table,
			dark,
			end: 0,
		};
		const [baseX, baseY] = DRIFT[sweep.from];
		const latest = sweep.duration + DUST_TAIL;
		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < columns; column++) {
				const x = visibleLeft + (column + random()) * cellWidth;
				const y = visibleTop + (row + random()) * cellHeight;
				if (!inside(x, y)) continue;
				const index = grains.count++;
				const along =
					sweep.from === "left"
						? x
						: sweep.from === "right"
							? width - x
							: sweep.from === "top"
								? y
								: height - y;
				// The grain leaves when its pixel does: when the front of the last
				// noise class still holding that pixel has passed it.
				let lastClass = 0;
				for (let layer = 2; layer >= 0; layer--)
					if (inNoise(layer, x, y)) {
						lastClass = layer + 1;
						break;
					}
				const release =
					clockAtLead(
						sweep,
						along + (lastClass * sweep.band) / 3 + FEATHER / 2,
					) +
					random() * RELEASE_JITTER;
				const life = Math.max(
					0.25,
					Math.min(0.7 + random() * 0.6, latest - release - HOLD),
				);
				const fan = ((random() * 2 - 1) * 22 * Math.PI) / 180;
				const cos = Math.cos(fan);
				const sin = Math.sin(fan);
				grains.homeX[index] = x;
				grains.homeY[index] = y;
				grains.release[index] = release;
				grains.life[index] = life;
				grains.dirX[index] = baseX * cos - baseY * sin;
				grains.dirY[index] = baseX * sin + baseY * cos;
				grains.distance[index] = 36 + random() * 74;
				grains.wobble[index] = 3 + random() * 6;
				grains.frequency[index] = 0.6 + random() * 0.8;
				grains.phase[index] = random() * Math.PI * 2;
				grains.size[index] = 1.25 + random();
				grains.color[index] = pickAt(x, y);
				grains.end = Math.max(grains.end, release + HOLD + life);
			}
		}
		const order = Array.from(
			{ length: grains.count },
			(_, index) => index,
		).sort((a, b) => grains.color[a] - grains.color[b]);
		grains.order.set(order);
		return grains;
	}
}

/* -------------------------------------------------------------------------- */
/* React                                                                      */
/* -------------------------------------------------------------------------- */

/** Polite status region; a counter forces repeat messages to be read again. */
function useAnnouncer() {
	const [message, setMessage] = useState({ text: "", count: 0 });
	const region = (
		<span role="status" aria-live="polite" className="sr-only">
			{message.text}
			{message.count % 2 ? "​" : ""}
		</span>
	);
	const announce = useCallback(
		(text: string) =>
			setMessage((previous) => ({ text, count: previous.count + 1 })),
		[],
	);
	return { region, announce };
}

const FOCUSABLE =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Where focus goes in another item: its trigger when idle, its Undo while pending. */
function focusTargetIn(slot: HTMLElement) {
	if (slot.hidden) return null;
	const state = slot.dataset.state;
	if (state === "idle")
		return (
			slot.querySelector<HTMLElement>('[data-slot="dust-delete-trigger"]') ??
			slot
				.querySelector('[data-slot="dust-delete-content"]')
				?.querySelector<HTMLElement>(FOCUSABLE) ??
			null
		);
	if (state === "dissolving" || state === "pending")
		return slot.querySelector<HTMLElement>('[data-slot="dust-delete-undo"]');
	return null;
}

/** The next item's focus target, else the previous one's, looking a few levels up. */
function neighbourTarget(slot: HTMLElement) {
	const selector = '[data-slot="dust-delete"]';
	const scan = (start: Element | null, forward: boolean) => {
		for (
			let node = start;
			node;
			node = forward ? node.nextElementSibling : node.previousElementSibling
		) {
			const candidates = node.matches(selector)
				? [node as HTMLElement]
				: Array.from(node.querySelectorAll<HTMLElement>(selector));
			if (!forward) candidates.reverse();
			for (const candidate of candidates) {
				const target = focusTargetIn(candidate);
				if (target) return target;
			}
		}
		return null;
	};
	let node: Element = slot;
	for (let depth = 0; depth < 3 && node.parentElement; depth++) {
		const target =
			scan(node.nextElementSibling, true) ??
			scan(node.previousElementSibling, false);
		if (target) return target;
		node = node.parentElement;
	}
	return null;
}

function reducedMotionPreferred() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

interface DustDeleteContextValue {
	deleted: boolean;
	label: string;
	remove: (fromKeyboard?: boolean) => void;
	undo: () => void;
	registerTrigger: (element: HTMLButtonElement | null) => void;
}

const DustDeleteContext = createContext<DustDeleteContextValue | null>(null);

export interface DustDeleteProps
	extends Omit<ComponentProps<"div">, "children"> {
	/** The row or card to delete. */
	children: ReactNode;
	/** The item's name, used for the buttons and the announcements. */
	label: string;
	/** The real delete: called once, after the undo window lapses. Never called for an undone or unmounted item. */
	onDelete?: () => void;
	/** Called when Undo is pressed. */
	onUndo?: () => void;
	/** Controlled deleted state. Changing it runs the same animation, silently. */
	deleted?: boolean;
	/** Called with `true` on a delete press and `false` on an undo press. */
	onDeletedChange?: (deleted: boolean) => void;
	/** How long Undo stays available, in ms, once the pill has appeared. `0` removes the pill. */
	undoDuration?: number;
	/** Visible text of the undo button. */
	undoLabel?: string;
	/** The edge the dissolve starts at. */
	from?: Edge;
	/** Close the slot to the undo row, then to nothing. Turn off in grids, where neighbours fix the cell size. */
	collapse?: boolean;
	/** Grain colours, replacing the ones read from the item. */
	dustColors?: string[];
	/** Play a soft granular hiss on delete and a rising tick on undo. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
}

export function DustDelete({
	children,
	label,
	onDelete,
	onUndo,
	deleted: deletedProp,
	onDeletedChange,
	undoDuration = 5000,
	undoLabel = "Undo",
	from = "left",
	collapse = true,
	dustColors,
	sound = true,
	haptics = true,
	className,
	...props
}: DustDeleteProps) {
	const controlled = deletedProp !== undefined;
	const [internalDeleted, setInternalDeleted] = useState(false);
	const deleted = controlled ? deletedProp : internalDeleted;
	const [initialPhase] = useState<Phase>(() =>
		deleted ? "committed" : "idle",
	);
	const [phase, setPhase] = useState<Phase>(initialPhase);

	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { toggle: playTick } = useTiks({
		theme: UNDO_SOUND,
		respectReducedMotion: false,
	});
	const { region, announce } = useAnnouncer();

	const slotRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const undoRowRef = useRef<HTMLDivElement>(null);
	const undoRef = useRef<HTMLButtonElement>(null);
	const hairlineRef = useRef<HTMLSpanElement>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const itemRef = useRef<DustItem | null>(null);
	/** The deleted value the animation last acted on. */
	const shownRef = useRef(deleted);
	/** A user press waiting for its `deleted` change, so it gets sound, haptics and focus. */
	const intentRef = useRef<{ to: boolean; keyboard: boolean } | null>(null);
	const focusRequestRef = useRef<"undo" | "trigger" | null>(null);

	const latest = useRef({
		label,
		onDelete,
		onUndo,
		onDeletedChange,
		undoDuration,
		undoLabel,
		from,
		collapse,
		dustColors,
		sound,
		haptics,
		controlled,
	});
	useLayoutEffect(() => {
		latest.current = {
			label,
			onDelete,
			onUndo,
			onDeletedChange,
			undoDuration,
			undoLabel,
			from,
			collapse,
			dustColors,
			sound,
			haptics,
			controlled,
		};
	});

	const getItem = useCallback(() => {
		if (!itemRef.current) {
			itemRef.current = new DustItem(
				{
					get slot() {
						return slotRef.current;
					},
					get content() {
						return contentRef.current;
					},
					get undoRow() {
						return undoRowRef.current;
					},
					get undoButton() {
						return undoRef.current;
					},
					get hairline() {
						return hairlineRef.current;
					},
					options: () => ({
						from: latest.current.from,
						collapse: latest.current.collapse,
						undoDuration: Math.max(0, latest.current.undoDuration),
						dustColors: latest.current.dustColors,
					}),
					setPhase,
					committed: () => {
						const slot = slotRef.current;
						// Hand focus to a neighbour before the parent removes this item.
						if (slot?.contains(document.activeElement))
							neighbourTarget(slot)?.focus({ preventScroll: true });
						latest.current.onDelete?.();
					},
				},
				initialPhase,
			);
		}
		return itemRef.current;
	}, [initialPhase]);

	useEffect(() => {
		// Decode the noise tile early, so the first dissolve has its grain.
		if (supportsMask()) getNoise();
		return () => itemRef.current?.destroy();
	}, []);

	// Every deleted change runs the animation; only a user press adds cues.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs on deleted changes only
	useLayoutEffect(() => {
		if (deleted === shownRef.current) return;
		shownRef.current = deleted;
		const intent = intentRef.current?.to === deleted ? intentRef.current : null;
		intentRef.current = null;
		const item = getItem();
		const reduced = reducedMotionPreferred();
		const { sound, haptics, label, undoDuration, undoLabel } = latest.current;
		const cue = !!intent && !silent();

		if (deleted) {
			const slot = slotRef.current;
			const hadFocus = !!slot?.contains(document.activeElement);
			const seconds = item.dissolve(reduced);
			if (!intent) return;
			if (cue && sound && seconds) playHiss(seconds, false);
			if (cue && haptics) void haptic("medium");
			const windowSeconds = Math.round(undoDuration / 1000);
			announce(
				undoDuration > 0
					? `Deleted ${label}. ${undoLabel} available for ${windowSeconds} second${windowSeconds === 1 ? "" : "s"}`
					: `Deleted ${label}`,
			);
			if (hadFocus || intent.keyboard) {
				if (undoDuration > 0) focusRequestRef.current = "undo";
				else if (slot) neighbourTarget(slot)?.focus({ preventScroll: true });
			}
		} else {
			const hadFocus =
				!!slotRef.current?.contains(document.activeElement) ||
				document.activeElement === document.body;
			if (!item.restore(reduced)) return;
			if (!intent) return;
			latest.current.onUndo?.();
			if (cue && sound) {
				playTick(true);
				playHiss(0.35, true, 0.6);
			}
			if (cue && haptics) void haptic("light");
			announce(`Restored ${label}`);
			if (hadFocus) focusRequestRef.current = "trigger";
		}
	}, [deleted]);

	// Focus moves once the element it goes to is in the DOM and usable.
	useLayoutEffect(() => {
		const request = focusRequestRef.current;
		if (request === "undo" && (phase === "dissolving" || phase === "pending")) {
			focusRequestRef.current = null;
			undoRef.current?.focus({ preventScroll: true });
		} else if (request === "trigger" && phase === "idle") {
			focusRequestRef.current = null;
			const active = document.activeElement;
			const slot = slotRef.current;
			if (active && active !== document.body && !slot?.contains(active)) return;
			const target =
				triggerRef.current ??
				contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			target?.focus({ preventScroll: true });
		} else if (request === "trigger" && phase !== "restoring") {
			focusRequestRef.current = null;
		}
	}, [phase]);

	const setDeleted = useCallback((next: boolean, keyboard = false) => {
		intentRef.current = { to: next, keyboard };
		if (!latest.current.controlled) setInternalDeleted(next);
		latest.current.onDeletedChange?.(next);
	}, []);

	const remove = useCallback(
		(keyboard = false) => {
			if (itemRef.current && itemRef.current.phase !== "idle") return;
			if (shownRef.current) return;
			setDeleted(true, keyboard);
		},
		[setDeleted],
	);

	const undo = useCallback(() => {
		const current = itemRef.current?.phase;
		if (current !== "dissolving" && current !== "pending") return;
		setDeleted(false);
	}, [setDeleted]);

	const registerTrigger = useCallback((element: HTMLButtonElement | null) => {
		triggerRef.current = element;
	}, []);

	const context = useMemo<DustDeleteContextValue>(
		() => ({ deleted, label, remove, undo, registerTrigger }),
		[deleted, label, remove, undo, registerTrigger],
	);

	const handleUndoKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const key = event.key.toLowerCase();
		if (
			event.key === "Escape" ||
			(key === "z" && (event.metaKey || event.ctrlKey))
		) {
			event.preventDefault();
			undo();
		}
	};

	const handleUndoPointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType !== "touch" && itemRef.current)
			itemRef.current.hovered = true;
	};
	const handleUndoPointerLeave = () => {
		if (itemRef.current) itemRef.current.hovered = false;
	};
	const handleUndoPointerDown = () => {
		const item = itemRef.current;
		if (!item) return;
		item.pressed = true;
		const release = () => {
			item.pressed = false;
			window.removeEventListener("pointerup", release, true);
			window.removeEventListener("pointercancel", release, true);
		};
		window.addEventListener("pointerup", release, true);
		window.addEventListener("pointercancel", release, true);
	};

	const showPill =
		undoDuration > 0 &&
		(phase === "dissolving" ||
			phase === "pending" ||
			phase === "restoring" ||
			phase === "committing");

	return (
		<DustDeleteContext.Provider value={context}>
			<div
				ref={slotRef}
				data-slot="dust-delete"
				data-state={phase}
				hidden={phase === "committed" || undefined}
				className={cn("relative", className)}
				{...props}
			>
				<div
					ref={contentRef}
					data-slot="dust-delete-content"
					inert={phase !== "idle"}
					aria-hidden={phase !== "idle" || undefined}
				>
					{children}
				</div>
				{showPill ? (
					<div
						ref={undoRowRef}
						data-slot="dust-delete-undo-row"
						className={cn(
							"pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center opacity-0",
							collapse ? "h-11" : "bottom-0",
						)}
					>
						<button
							ref={undoRef}
							type="button"
							data-slot="dust-delete-undo"
							aria-label={`${undoLabel} delete ${label}`}
							onClick={undo}
							onKeyDown={handleUndoKeyDown}
							onPointerEnter={handleUndoPointerEnter}
							onPointerLeave={handleUndoPointerLeave}
							onPointerDown={handleUndoPointerDown}
							className="pointer-events-auto relative inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-full border border-black/8 bg-white ps-3 pe-3.5 font-medium text-[13px] text-foreground leading-none shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_8px_-2px_rgb(0_0_0/0.1)] outline-none transition-[background-color,box-shadow] duration-150 after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-[max(100%,2.75rem)] after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/10 dark:bg-white/8 dark:text-white/90 dark:shadow-none dark:hover:bg-white/12"
						>
							<svg
								aria-hidden
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-3.5 shrink-0 opacity-80 rtl:-scale-x-100"
							>
								<path d="M9 14 4 9l5-5" />
								<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
							</svg>
							<span>{undoLabel}</span>
							<span
								aria-hidden
								className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
							>
								<span
									ref={hairlineRef}
									className="absolute inset-x-0 bottom-0 h-[1.5px] origin-left bg-foreground/55 rtl:origin-right dark:bg-white/55"
								/>
							</span>
						</button>
					</div>
				) : null}
				{region}
			</div>
		</DustDeleteContext.Provider>
	);
}

function useDustDeleteContext(name: string) {
	const context = useContext(DustDeleteContext);
	if (!context) throw new Error(`${name} must be used inside <DustDelete>.`);
	return context;
}

/** For a custom trigger inside a `DustDelete`, such as a menu item or a Delete key handler. */
export function useDustDelete() {
	const { deleted, remove, undo } = useDustDeleteContext("useDustDelete");
	return useMemo(
		() => ({ deleted, remove: () => remove(), undo }),
		[deleted, remove, undo],
	);
}

export interface DustDeleteTriggerProps extends ComponentProps<"button"> {
	/** Replaces the default trash icon. */
	children?: ReactNode;
	/** Accessible name. Defaults to "Delete {label}"; ignored when `aria-label` or `aria-labelledby` is set. */
	label?: string;
}

export function DustDeleteTrigger({
	children,
	label,
	className,
	onClick,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: DustDeleteTriggerProps) {
	const context = useDustDeleteContext("DustDeleteTrigger");
	const { remove, registerTrigger } = context;

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		// Keyboard clicks have no detail.
		remove(event.detail === 0);
	};

	return (
		<button
			ref={registerTrigger}
			type="button"
			data-slot="dust-delete-trigger"
			aria-label={
				ariaLabelledBy
					? undefined
					: (ariaLabel ?? label ?? `Delete ${context.label}`)
			}
			aria-labelledby={ariaLabelledBy}
			onClick={handleClick}
			className={cn(
				"relative inline-flex shrink-0 cursor-pointer items-center justify-center outline-none after:absolute after:top-1/2 after:left-1/2 after:h-[max(100%,2.75rem)] after:w-[max(100%,2.75rem)] after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{children ?? (
				<svg
					aria-hidden
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M3 6h18" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
					<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					<path d="M10 11v6" />
					<path d="M14 11v6" />
				</svg>
			)}
		</button>
	);
}

export default DustDelete;
