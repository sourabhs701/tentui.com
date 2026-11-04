"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type Ref,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Columns and rows of the coverage grid; each cell is cleared at most once. */
const GRID_COLUMNS = 40;
const GRID_ROWS = 24;
/** Brush radius as a fraction of the card width, clamped to px limits. */
const BRUSH_FRACTION = 0.06;
const MIN_BRUSH_PX = 14;
const MAX_BRUSH_PX = 30;
/** Distance between brush dabs, as a fraction of the radius. */
const DAB_SPACING = 0.2;
/** A grid cell is cleared once a dab center passes this close, as a fraction of the radius. */
const CLEAR_REACH = 0.8;
/** Px scratched over foil between haptic ticks. */
const HAPTIC_STEP_PX = 44;
/** Minimum ms between haptic ticks. */
const CUE_THROTTLE_MS = 35;
/** Minimum ms between scratch sound grains. */
const GRAIN_INTERVAL_MS = 28;
/** Length of one scratch sound grain, in seconds. */
const GRAIN_SECONDS = 0.07;
/** Below this pointer speed, in px/ms, the scratch is silent. */
const SILENT_SPEED = 0.03;
/** A stroke still counts as scratching foil this many ms after it last cleared a cell. */
const FRESH_MS = 90;
/** Px scratched over foil per flake, and the most flakes alive at once. */
const FLAKE_STEP_PX = 9;
const MAX_FLAKES = 24;
/** Canvas backing store limit, in device px per CSS px. */
const MAX_BACKING_SCALE = 4;
/** Resting sheen position along the gradient, and how far the pointer moves it. */
const SHEEN_REST = 0.42;
const SHEEN_PARALLAX = 0.14;
const GRADIENT_ANGLE = 115;
const CORNER_RADIUS = 16;

const revealEase = [0.23, 1, 0.32, 1] as const;
const REVEAL_SECONDS = 0.35;

// Two soft sine notes, a fifth apart (tiks' success cue).
const CHIME_SOUND = {
	name: "scratch-card-chime",
	baseFreq: 587,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 3000,
	filterQ: 1,
	attack: 0.006,
	decay: 3.2,
	brightness: 2000,
} as const;

type FoilName = "silver" | "gold" | "graphite";

interface FoilPalette {
	/** Base gradient stops, laid along `GRADIENT_ANGLE`. */
	stops: string[];
	/** Peak opacity of the brushed streaks and the fine grain. */
	streak: number;
	grain: number;
	sheen: string;
	/** Engraved hint: the cut is `ink`, its lower lip catches `highlight`. */
	ink: string;
	highlight: string;
	/** Colors for the specks that pop off the brush. */
	flakes: string[];
}

const foils: Record<FoilName, FoilPalette> = {
	silver: {
		stops: ["#f3f4f6", "#cdd1d7", "#eceef1", "#b9bec6", "#e3e6ea", "#c4c9d0"],
		streak: 0.04,
		grain: 0.03,
		sheen: "rgb(255 255 255 / 0.5)",
		ink: "rgb(72 78 88 / 0.5)",
		highlight: "rgb(255 255 255 / 0.75)",
		flakes: ["#e6e8ec", "#c2c7ce", "#f7f8fa", "#aab0b9"],
	},
	gold: {
		stops: ["#f6e7bd", "#d9b56c", "#f3dfa8", "#c39a4c", "#ecd18f", "#cfa85e"],
		streak: 0.045,
		grain: 0.03,
		sheen: "rgb(255 249 230 / 0.6)",
		ink: "rgb(110 76 22 / 0.5)",
		highlight: "rgb(255 246 220 / 0.7)",
		flakes: ["#f1dca2", "#d2ab5f", "#f8ebc6", "#b98f42"],
	},
	graphite: {
		stops: ["#6b7078", "#43474e", "#5e636b", "#363a40", "#555a62", "#3d4148"],
		streak: 0.05,
		grain: 0.045,
		sheen: "rgb(255 255 255 / 0.16)",
		ink: "rgb(12 13 16 / 0.78)",
		highlight: "rgb(255 255 255 / 0.2)",
		flakes: ["#73787f", "#4a4e55", "#878c93", "#3a3e44"],
	},
};

function cssGradient(palette: FoilPalette) {
	return `linear-gradient(${GRADIENT_ANGLE}deg, ${palette.stops.join(", ")})`;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** A small seeded random generator, so the foil texture is the same every render. */
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

/** End points of a CSS-style linear gradient line at `angle` across a `width` by `height` box. */
function gradientLine(width: number, height: number, angle: number) {
	const radians = (angle * Math.PI) / 180;
	const dx = Math.sin(radians);
	const dy = -Math.cos(radians);
	const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
	return {
		x0: width / 2 - dx * half,
		y0: height / 2 - dy * half,
		x1: width / 2 + dx * half,
		y1: height / 2 + dy * half,
	};
}

function createCanvas(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, width);
	canvas.height = Math.max(1, height);
	return canvas;
}

/** Paints the foil artwork (no sheen) at `scale` device px per CSS px. */
function paintFoil(
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
	scale: number,
	palette: FoilPalette,
	hint: string,
	fontFamily: string,
) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const random = seededRandom(0x5c7a7c4);
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = 1;

	const line = gradientLine(width, height, GRADIENT_ANGLE);
	const base = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
	palette.stops.forEach((stop, index) => {
		base.addColorStop(index / (palette.stops.length - 1), stop);
	});
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, width, height);

	// Brushed metal: thin horizontal streaks of varying length, one device px tall.
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const deviceWidth = canvas.width;
	const deviceHeight = canvas.height;
	const streaks = Math.round(deviceHeight * 1.6);
	for (let index = 0; index < streaks; index++) {
		const light = random() > 0.45;
		ctx.fillStyle = light ? "#fff" : "#000";
		ctx.globalAlpha = palette.streak * (0.25 + random() * 0.75);
		const length = deviceWidth * (0.2 + random() * 0.9);
		const x = random() * (deviceWidth + length) - length;
		const y = Math.floor(random() * deviceHeight);
		ctx.fillRect(x, y, length, Math.max(1, Math.round(scale / 2)));
	}

	// Fine grain, about half a CSS px per speck so it stays visible at 3x and 4x.
	const speck = Math.max(1, Math.round(scale / 2));
	const tileSize = 64 * speck;
	const tile = createCanvas(tileSize, tileSize);
	const tileCtx = tile.getContext("2d");
	if (tileCtx) {
		const pixels = tileCtx.createImageData(tileSize, tileSize);
		const data = pixels.data;
		for (let y = 0; y < tileSize; y += speck) {
			for (let x = 0; x < tileSize; x += speck) {
				const shade = random() > 0.5 ? 255 : 0;
				const alpha = Math.round(random() * random() * palette.grain * 255 * 2);
				for (let sy = 0; sy < speck; sy++) {
					for (let sx = 0; sx < speck; sx++) {
						const offset = ((y + sy) * tileSize + x + sx) * 4;
						data[offset] = shade;
						data[offset + 1] = shade;
						data[offset + 2] = shade;
						data[offset + 3] = alpha;
					}
				}
			}
		}
		tileCtx.putImageData(pixels, 0, 0);
		const pattern = ctx.createPattern(tile, "repeat");
		if (pattern) {
			ctx.globalAlpha = 1;
			ctx.fillStyle = pattern;
			ctx.fillRect(0, 0, deviceWidth, deviceHeight);
		}
	}

	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.globalAlpha = 1;

	// A soft bevel: the top edge catches light and the bottom edge falls off.
	const bevel = ctx.createLinearGradient(0, 0, 0, height);
	bevel.addColorStop(0, "rgb(255 255 255 / 0.55)");
	bevel.addColorStop(0.5, "rgb(255 255 255 / 0)");
	bevel.addColorStop(0.5, "rgb(0 0 0 / 0)");
	bevel.addColorStop(1, "rgb(0 0 0 / 0.14)");
	ctx.strokeStyle = bevel;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(0.5, 0.5, width - 1, height - 1, CORNER_RADIUS - 0.5);
	ctx.stroke();

	// The engraved hint, flanked by two hairlines.
	const label = hint.trim().toLocaleUpperCase();
	if (!label) return;
	const fontSize = clamp(width * 0.042, 10, 14);
	ctx.font = `600 ${fontSize}px ${fontFamily}`;
	ctx.letterSpacing = `${(fontSize * 0.18).toFixed(2)}px`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const textWidth = Math.min(ctx.measureText(label).width, width * 0.7);
	const centerX = width / 2;
	const centerY = height / 2;
	const rule = clamp(width * 0.07, 10, 26);
	const gap = fontSize * 0.9;
	const engrave = (color: string, offset: number) => {
		ctx.fillStyle = color;
		ctx.fillText(
			label,
			centerX + fontSize * 0.09,
			centerY + offset,
			width * 0.7,
		);
		const left = centerX - textWidth / 2 - gap;
		const right = centerX + textWidth / 2 + gap;
		ctx.fillRect(left - rule, centerY + offset - 0.5, rule, 1);
		ctx.fillRect(right, centerY + offset - 0.5, rule, 1);
	};
	engrave(palette.highlight, 0.75);
	engrave(palette.ink, 0);
}

/** A soft round dab: solid in the middle, feathered to nothing at the radius. */
function createBrush(radius: number, scale: number) {
	const size = Math.ceil(radius * 2 * scale);
	const brush = createCanvas(size, size);
	const ctx = brush.getContext("2d");
	if (!ctx) return brush;
	const center = size / 2;
	const gradient = ctx.createRadialGradient(
		center,
		center,
		0,
		center,
		center,
		center,
	);
	gradient.addColorStop(0, "rgb(0 0 0 / 1)");
	gradient.addColorStop(0.7, "rgb(0 0 0 / 1)");
	gradient.addColorStop(0.86, "rgb(0 0 0 / 0.6)");
	gradient.addColorStop(1, "rgb(0 0 0 / 0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	return brush;
}

/** Squared distance from a point to the segment `a`→`b`. */
function distanceToSegmentSq(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
) {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSq = dx * dx + dy * dy;
	const t =
		lengthSq > 0
			? clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1)
			: 0;
	const x = ax + dx * t - px;
	const y = ay + dy * t - py;
	return x * x + y * y;
}

interface ScratchAudio {
	ctx: AudioContext;
	output: GainNode;
	noise: AudioBuffer;
}

let scratchAudio: ScratchAudio | null = null;

/** One shared context for every card, created on the first scratch (a user gesture). */
function getScratchAudio() {
	if (scratchAudio && scratchAudio.ctx.state !== "closed") return scratchAudio;
	const AudioContextClass =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return null;
	const ctx = new AudioContextClass();
	const output = ctx.createGain();
	output.gain.value = 0.8;
	output.connect(ctx.destination);
	// Grainy noise with sparse louder crackles, like foil catching under a nail.
	const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const data = noise.getChannelData(0);
	for (let index = 0; index < data.length; index++) {
		const crackle = Math.random() < 0.035 ? 1 : 0.4;
		data[index] = (Math.random() * 2 - 1) * crackle;
	}
	scratchAudio = { ctx, output, noise };
	return scratchAudio;
}

/** Plays one short burst of filtered noise. Starts and ends at zero gain, so it never clicks. */
function playScratchGrain(
	audio: ScratchAudio,
	loudness: number,
	brightness: number,
) {
	const { ctx } = audio;
	if (ctx.state === "suspended") void ctx.resume().catch(() => {});
	const start = ctx.currentTime + 0.005;
	const source = ctx.createBufferSource();
	source.buffer = audio.noise;
	const band = ctx.createBiquadFilter();
	band.type = "bandpass";
	band.frequency.value = 1500 + brightness * 4500;
	band.Q.value = 0.9;
	const highpass = ctx.createBiquadFilter();
	highpass.type = "highpass";
	highpass.frequency.value = 700;
	const gain = ctx.createGain();
	const peak = loudness * (0.75 + Math.random() * 0.5);
	gain.gain.setValueAtTime(0, start);
	gain.gain.linearRampToValueAtTime(peak, start + GRAIN_SECONDS * 0.25);
	gain.gain.linearRampToValueAtTime(0, start + GRAIN_SECONDS);
	source.connect(band);
	band.connect(highpass);
	highpass.connect(gain);
	gain.connect(audio.output);
	const offset = Math.random() * (audio.noise.duration - GRAIN_SECONDS - 0.02);
	source.start(start, offset, GRAIN_SECONDS + 0.01);
}

interface Flake {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	spin: number;
	width: number;
	height: number;
	age: number;
	life: number;
	color: string;
}

interface Stroke {
	pointerId: number;
	x: number;
	y: number;
	time: number;
	/** Smoothed pointer speed, in px/ms. */
	speed: number;
	/** Converts client px to the card's layout px (accounts for CSS transforms and zoom). */
	left: number;
	top: number;
	ratioX: number;
	ratioY: number;
	freshAt: number;
	hapticDistance: number;
	flakeDistance: number;
	lastGrainAt: number;
}

export interface ScratchCardHandle {
	/** Puts a fresh foil back over the content. Silent. */
	reset: () => void;
	/** Reveals the content at once, as if scratched clear. Silent. */
	reveal: () => void;
}

export interface ScratchCardProps
	extends Omit<ComponentProps<"div">, "children" | "onProgress" | "ref"> {
	/** The content under the foil. Hidden from assistive technology until revealed. */
	children?: ReactNode;
	/** Fraction of the foil, 0 to 1, that has to be cleared before the rest lifts off. */
	threshold?: number;
	/** The foil finish. */
	foil?: FoilName;
	/** Engraved into the foil, and scratched away with it. */
	hint?: string;
	/** Called once, when the card is revealed by scratching, the button, a key, or `reveal()`. */
	onReveal?: () => void;
	/** Called with the cleared fraction, 0 to 1, as the foil is scratched. */
	onProgress?: (fraction: number) => void;
	disabled?: boolean;
	/** Play a scratch texture that follows the pointer speed, and a chime on reveal. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Exposes `reset()` and `reveal()`. */
	ref?: Ref<ScratchCardHandle>;
}

export function ScratchCard({
	children,
	threshold = 0.6,
	foil = "silver",
	hint = "Scratch here",
	onReveal,
	onProgress,
	disabled = false,
	sound = true,
	haptics = true,
	className,
	ref,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: ScratchCardProps) {
	const [revealed, setRevealed] = useState(false);
	const palette = foils[foil] ?? foils.silver;

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { success: playChime } = useTiks({
		theme: CHIME_SOUND,
		respectReducedMotion: false,
	});

	const rootRef = useRef<HTMLDivElement>(null);
	const foilRef = useRef<HTMLDivElement>(null);
	const fallbackRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const sizeRef = useRef({ width: 0, height: 0, scale: 0 });
	const baseRef = useRef<HTMLCanvasElement | null>(null);
	const maskRef = useRef<HTMLCanvasElement | null>(null);
	const brushRef = useRef<HTMLCanvasElement | null>(null);
	const gridRef = useRef(new Uint8Array(GRID_COLUMNS * GRID_ROWS));
	const clearedRef = useRef(0);
	const progressRef = useRef(0);
	const revealedRef = useRef(false);
	const strokeRef = useRef<Stroke | null>(null);
	const flakesRef = useRef<Flake[]>([]);
	const sheenRef = useRef({ value: SHEEN_REST, target: SHEEN_REST });
	const frameRef = useRef(0);
	const lastFrameRef = useRef<number | null>(null);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const focusContentRef = useRef(false);

	// Event handlers and the frame loop read the latest props through refs.
	const latest = useRef({
		threshold,
		palette,
		hint,
		onReveal,
		onProgress,
		disabled,
		sound,
		haptics,
		reducedMotion,
	});
	useLayoutEffect(() => {
		latest.current = {
			threshold,
			palette,
			hint,
			onReveal,
			onProgress,
			disabled,
			sound,
			haptics,
			reducedMotion,
		};
	});

	const brushRadius = () =>
		clamp(sizeRef.current.width * BRUSH_FRACTION, MIN_BRUSH_PX, MAX_BRUSH_PX);

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const composite = () => {
		const canvas = canvasRef.current;
		const base = baseRef.current;
		const mask = maskRef.current;
		if (!canvas || !base || !mask) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const { width, height, scale } = sizeRef.current;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "copy";
		ctx.drawImage(base, 0, 0);

		// A diagonal sheen across the foil that drifts a little with the pointer.
		ctx.globalCompositeOperation = "source-over";
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		const line = gradientLine(width, height, GRADIENT_ANGLE);
		const sheen = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
		const at = sheenRef.current.value;
		sheen.addColorStop(clamp(at - 0.2, 0, 1), "rgb(255 255 255 / 0)");
		sheen.addColorStop(clamp(at, 0, 1), latest.current.palette.sheen);
		sheen.addColorStop(clamp(at + 0.2, 0, 1), "rgb(255 255 255 / 0)");
		ctx.fillStyle = sheen;
		ctx.fillRect(0, 0, width, height);

		// Cut the scratched areas out of the foil and its sheen.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = "destination-in";
		ctx.drawImage(mask, 0, 0);

		ctx.globalCompositeOperation = "source-over";
		for (const flake of flakesRef.current) {
			const cos = Math.cos(flake.angle) * scale;
			const sin = Math.sin(flake.angle) * scale;
			ctx.setTransform(cos, sin, -sin, cos, flake.x * scale, flake.y * scale);
			ctx.globalAlpha = 1 - (flake.age / flake.life) ** 2;
			ctx.fillStyle = flake.color;
			ctx.fillRect(
				-flake.width / 2,
				-flake.height / 2,
				flake.width,
				flake.height,
			);
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
	};

	const frame = (now: number) => {
		frameRef.current = 0;
		const elapsed =
			lastFrameRef.current === null
				? 1 / 60
				: Math.min((now - lastFrameRef.current) / 1000, 1 / 20);
		lastFrameRef.current = now;
		let moving = false;

		const sheen = sheenRef.current;
		sheen.value +=
			(sheen.target - sheen.value) * (1 - Math.exp(-elapsed / 0.14));
		if (Math.abs(sheen.target - sheen.value) < 0.0008)
			sheen.value = sheen.target;
		else moving = true;

		const flakes = flakesRef.current;
		for (let index = flakes.length - 1; index >= 0; index--) {
			const flake = flakes[index];
			flake.age += elapsed;
			if (flake.age >= flake.life) {
				flakes.splice(index, 1);
				continue;
			}
			flake.vy += 700 * elapsed;
			flake.x += flake.vx * elapsed;
			flake.y += flake.vy * elapsed;
			flake.angle += flake.spin * elapsed;
		}
		if (flakes.length) moving = true;

		composite();
		if (moving) wake();
		else lastFrameRef.current = null;
	};

	const frameHandlerRef = useRef(frame);
	useLayoutEffect(() => {
		frameHandlerRef.current = frame;
	});

	function wake() {
		if (frameRef.current) return;
		frameRef.current = requestAnimationFrame((now) =>
			frameHandlerRef.current(now),
		);
	}

	useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

	const paintBase = () => {
		const { width, height, scale } = sizeRef.current;
		const base = baseRef.current;
		const root = rootRef.current;
		if (!base || !root || !width) return;
		const fontFamily = getComputedStyle(root).fontFamily || "sans-serif";
		paintFoil(
			base,
			width,
			height,
			scale,
			latest.current.palette,
			latest.current.hint,
			fontFamily,
		);
	};

	/** Sizes the canvases to the card, keeping what was scratched as a fraction of the area. */
	const layout = (force = false) => {
		const root = rootRef.current;
		const canvas = canvasRef.current;
		if (!root || !canvas) return;
		const width = root.clientWidth;
		const height = root.clientHeight;
		if (!width || !height) return;
		const rect = root.getBoundingClientRect();
		const zoom = rect.width / width;
		const cssZoom =
			(root as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
		const scale = clamp(
			window.devicePixelRatio * Math.max(zoom, cssZoom, 1e-3),
			1,
			MAX_BACKING_SCALE,
		);
		const current = sizeRef.current;
		if (
			!force &&
			current.width === width &&
			current.height === height &&
			current.scale === scale &&
			maskRef.current
		) {
			return;
		}
		sizeRef.current = { width, height, scale };
		const deviceWidth = Math.round(width * scale);
		const deviceHeight = Math.round(height * scale);
		canvas.width = deviceWidth;
		canvas.height = deviceHeight;

		const previous = maskRef.current;
		const mask = createCanvas(deviceWidth, deviceHeight);
		const maskCtx = mask.getContext("2d");
		if (maskCtx) {
			if (previous) {
				maskCtx.drawImage(previous, 0, 0, deviceWidth, deviceHeight);
			} else {
				maskCtx.fillStyle = "#000";
				maskCtx.fillRect(0, 0, deviceWidth, deviceHeight);
			}
		}
		maskRef.current = mask;
		baseRef.current = createCanvas(deviceWidth, deviceHeight);
		brushRef.current = createBrush(brushRadius(), scale);
		paintBase();
		composite();
		if (fallbackRef.current) fallbackRef.current.hidden = true;
	};

	const layoutRef = useRef(layout);
	useLayoutEffect(() => {
		layoutRef.current = layout;
	});

	const setProgress = (fraction: number) => {
		const rounded = Math.round(fraction * 100) / 100;
		if (rounded === progressRef.current) return;
		progressRef.current = rounded;
		latest.current.onProgress?.(rounded);
	};

	/** Clears grid cells along the segment and returns how many were newly cleared. */
	const markSegment = (ax: number, ay: number, bx: number, by: number) => {
		const { width, height } = sizeRef.current;
		const reach = brushRadius() * CLEAR_REACH;
		const reachSq = reach * reach;
		const cellWidth = width / GRID_COLUMNS;
		const cellHeight = height / GRID_ROWS;
		const fromColumn = clamp(
			Math.floor((Math.min(ax, bx) - reach) / cellWidth),
			0,
			GRID_COLUMNS - 1,
		);
		const toColumn = clamp(
			Math.floor((Math.max(ax, bx) + reach) / cellWidth),
			0,
			GRID_COLUMNS - 1,
		);
		const fromRow = clamp(
			Math.floor((Math.min(ay, by) - reach) / cellHeight),
			0,
			GRID_ROWS - 1,
		);
		const toRow = clamp(
			Math.floor((Math.max(ay, by) + reach) / cellHeight),
			0,
			GRID_ROWS - 1,
		);
		const grid = gridRef.current;
		let cleared = 0;
		for (let row = fromRow; row <= toRow; row++) {
			const cy = (row + 0.5) * cellHeight;
			for (let column = fromColumn; column <= toColumn; column++) {
				const cell = row * GRID_COLUMNS + column;
				if (grid[cell]) continue;
				const cx = (column + 0.5) * cellWidth;
				if (distanceToSegmentSq(cx, cy, ax, ay, bx, by) <= reachSq) {
					grid[cell] = 1;
					cleared++;
				}
			}
		}
		clearedRef.current += cleared;
		return cleared;
	};

	/** Erases the foil along the segment with soft round dabs, spaced so fast flicks leave no gaps. */
	const eraseSegment = (ax: number, ay: number, bx: number, by: number) => {
		const mask = maskRef.current;
		const brush = brushRef.current;
		if (!mask || !brush) return;
		const ctx = mask.getContext("2d");
		if (!ctx) return;
		const { scale } = sizeRef.current;
		const radius = brushRadius();
		const distance = Math.hypot(bx - ax, by - ay);
		const steps = Math.max(1, Math.ceil(distance / (radius * DAB_SPACING)));
		ctx.globalCompositeOperation = "destination-out";
		for (let step = 1; step <= steps; step++) {
			const t = step / steps;
			// A little jitter roughens the edge, like foil flaking rather than a clean cut.
			const size = radius * (0.92 + Math.random() * 0.16) * 2 * scale;
			const x =
				(ax + (bx - ax) * t) * scale + (Math.random() - 0.5) * 2.4 * scale;
			const y =
				(ay + (by - ay) * t) * scale + (Math.random() - 0.5) * 2.4 * scale;
			ctx.drawImage(brush, x - size / 2, y - size / 2, size, size);
		}
		ctx.globalCompositeOperation = "source-over";
	};

	const spawnFlake = (x: number, y: number, dx: number, dy: number) => {
		const flakes = flakesRef.current;
		if (flakes.length >= MAX_FLAKES) return;
		const colors = latest.current.palette.flakes;
		const radius = brushRadius();
		const length = Math.hypot(dx, dy) || 1;
		// Specks fly off to either side of the stroke, a little upward.
		const side = Math.random() > 0.5 ? 1 : -1;
		const speed = 50 + Math.random() * 110;
		const normalX = (-dy / length) * side;
		const normalY = (dx / length) * side;
		flakes.push({
			x: x + normalX * radius * 0.6,
			y: y + normalY * radius * 0.6,
			vx: normalX * speed + (dx / length) * 30 + (Math.random() - 0.5) * 40,
			vy: normalY * speed - 70 - Math.random() * 60,
			angle: Math.random() * Math.PI,
			spin: (Math.random() - 0.5) * 18,
			width: 1.2 + Math.random() * 1.8,
			height: 0.8 + Math.random() * 1.2,
			age: 0,
			life: 0.35 + Math.random() * 0.3,
			color: colors[Math.floor(Math.random() * colors.length)] ?? "#ccc",
		});
	};

	const endStroke = () => {
		const stroke = strokeRef.current;
		if (!stroke) return;
		strokeRef.current = null;
		const foilElement = foilRef.current;
		if (foilElement?.hasPointerCapture(stroke.pointerId)) {
			foilElement.releasePointerCapture(stroke.pointerId);
		}
		if (rootRef.current) delete rootRef.current.dataset.scratching;
	};

	/** Reveals the content; `cue` plays the chime and haptic, for user input only. */
	const reveal = (cue: boolean) => {
		if (revealedRef.current) return;
		revealedRef.current = true;
		endStroke();
		flakesRef.current = [];
		sheenRef.current.target = SHEEN_REST;
		const root = rootRef.current;
		focusContentRef.current = Boolean(
			root && document.activeElement && root.contains(document.activeElement),
		);
		setRevealed(true);
		progressRef.current = 1;
		latest.current.onProgress?.(1);
		latest.current.onReveal?.();
		if (!cue || silent()) return;
		if (latest.current.sound) playChime();
		if (latest.current.haptics) void haptic("medium");
	};

	const reset = () => {
		endStroke();
		gridRef.current.fill(0);
		clearedRef.current = 0;
		flakesRef.current = [];
		sheenRef.current = { value: SHEEN_REST, target: SHEEN_REST };
		if (progressRef.current !== 0) {
			progressRef.current = 0;
			latest.current.onProgress?.(0);
		}
		if (revealedRef.current) {
			// The foil remounts, and the layout effect below gives it a fresh mask.
			revealedRef.current = false;
			setRevealed(false);
			return;
		}
		maskRef.current = null;
		layout(true);
	};

	const resetRef = useRef(reset);
	const revealRef = useRef(reveal);
	useLayoutEffect(() => {
		resetRef.current = reset;
		revealRef.current = reveal;
	});

	useImperativeHandle(ref, () => ({
		reset: () => resetRef.current(),
		reveal: () => revealRef.current(false),
	}));

	// A fresh foil on mount and after a reset from the revealed state.
	useLayoutEffect(() => {
		if (revealed) return;
		maskRef.current = null;
		layoutRef.current(true);
	}, [revealed]);

	// A new finish or hint repaints the foil but keeps what was scratched.
	// biome-ignore lint/correctness/useExhaustiveDependencies: repaint when these props change
	useLayoutEffect(() => {
		if (revealedRef.current || !baseRef.current) return;
		brushRef.current = createBrush(brushRadius(), sizeRef.current.scale);
		paintBase();
		composite();
	}, [foil, hint]);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const observer = new ResizeObserver(() => {
			if (!revealedRef.current) layoutRef.current();
		});
		observer.observe(root);
		// Repaint once web fonts load so the hint uses the page font.
		let active = true;
		if (document.fonts && document.fonts.status !== "loaded") {
			void document.fonts.ready.then(() => {
				if (active && !revealedRef.current) layoutRef.current(true);
			});
		}
		return () => {
			active = false;
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!revealed || !focusContentRef.current) return;
		focusContentRef.current = false;
		contentRef.current?.focus({ preventScroll: true });
	}, [revealed]);

	const endStrokeRef = useRef(endStroke);
	useLayoutEffect(() => {
		endStrokeRef.current = endStroke;
	});

	useEffect(() => {
		if (disabled) endStrokeRef.current();
	}, [disabled]);

	// iOS can still scroll the page under a captured pointer; block it mid-stroke.
	useEffect(() => {
		const element = foilRef.current;
		if (!element || revealed) return;
		const onTouchMove = (event: TouchEvent) => {
			if (strokeRef.current) event.preventDefault();
		};
		element.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => element.removeEventListener("touchmove", onTouchMove);
	}, [revealed]);

	const scratchTo = (x: number, y: number, time: number) => {
		const stroke = strokeRef.current;
		if (!stroke) return;
		const dx = x - stroke.x;
		const dy = y - stroke.y;
		const distance = Math.hypot(dx, dy);
		if (distance < 0.5) return;
		const elapsed = Math.max(time - stroke.time, 1);
		stroke.speed = stroke.speed * 0.6 + (distance / elapsed) * 0.4;

		eraseSegment(stroke.x, stroke.y, x, y);
		const cleared = markSegment(stroke.x, stroke.y, x, y);
		if (cleared) stroke.freshAt = time;
		const onFoil = time - stroke.freshAt < FRESH_MS;
		const { sound, haptics, reducedMotion } = latest.current;

		if (onFoil) {
			stroke.hapticDistance += distance;
			if (stroke.hapticDistance >= HAPTIC_STEP_PX) {
				stroke.hapticDistance = 0;
				if (
					haptics &&
					!silent() &&
					time - lastHapticAtRef.current >= CUE_THROTTLE_MS
				) {
					lastHapticAtRef.current = time;
					void haptic("selection");
				}
			}
			if (!reducedMotion) {
				stroke.flakeDistance += distance;
				while (stroke.flakeDistance >= FLAKE_STEP_PX) {
					stroke.flakeDistance -= FLAKE_STEP_PX;
					spawnFlake(x, y, dx, dy);
				}
			}
		}

		if (
			sound &&
			stroke.speed > SILENT_SPEED &&
			time - stroke.lastGrainAt >= GRAIN_INTERVAL_MS &&
			!silent()
		) {
			stroke.lastGrainAt = time;
			const audio = getScratchAudio();
			if (audio) {
				const intensity =
					clamp((stroke.speed - SILENT_SPEED) / 1.6, 0, 1) ** 0.7;
				// Rubbing over cleared card is quieter and duller than over foil.
				playScratchGrain(
					audio,
					(0.03 + 0.22 * intensity) * (onFoil ? 1 : 0.3),
					clamp(stroke.speed / 2.4, 0, 1) * (onFoil ? 1 : 0.4),
				);
			}
		}

		stroke.x = x;
		stroke.y = y;
		stroke.time = time;
	};

	const followSheen = (x: number, y: number) => {
		if (latest.current.reducedMotion) return;
		const { width, height } = sizeRef.current;
		if (!width || !height) return;
		sheenRef.current.target =
			SHEEN_REST +
			(x / width - 0.5) * SHEEN_PARALLAX +
			(y / height - 0.5) * SHEEN_PARALLAX * 0.4;
		wake();
	};

	const toLocal = (clientX: number, clientY: number) => {
		const root = rootRef.current;
		const rect = root?.getBoundingClientRect();
		if (!root || !rect?.width || !rect.height) return null;
		return {
			x: (clientX - rect.left) * (root.clientWidth / rect.width),
			y: (clientY - rect.top) * (root.clientHeight / rect.height),
		};
	};

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (latest.current.disabled || revealedRef.current) return;
		// One finger scratches; a second one, or a right click, is ignored.
		if (!event.isPrimary || strokeRef.current) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const root = rootRef.current;
		const rect = root?.getBoundingClientRect();
		if (!root || !rect?.width || !rect.height) return;
		layout();
		event.currentTarget.setPointerCapture(event.pointerId);
		const ratioX = root.clientWidth / rect.width;
		const ratioY = root.clientHeight / rect.height;
		const x = (event.clientX - rect.left) * ratioX;
		const y = (event.clientY - rect.top) * ratioY;
		strokeRef.current = {
			pointerId: event.pointerId,
			x,
			y,
			time: event.timeStamp,
			speed: 0,
			left: rect.left,
			top: rect.top,
			ratioX,
			ratioY,
			freshAt: Number.NEGATIVE_INFINITY,
			hapticDistance: 0,
			flakeDistance: 0,
			lastGrainAt: Number.NEGATIVE_INFINITY,
		};
		root.dataset.scratching = "";
		// Create the audio context inside the gesture so the first grain can play.
		if (latest.current.sound) getScratchAudio();
		// A press is a dab.
		eraseSegment(x, y, x, y);
		if (markSegment(x, y, x, y)) {
			strokeRef.current.freshAt = event.timeStamp;
			setProgress(clearedRef.current / gridRef.current.length);
		}
		followSheen(x, y);
		wake();
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const stroke = strokeRef.current;
		if (!stroke) {
			// Hovering with a mouse tilts the sheen.
			if (event.pointerType === "mouse" && !revealedRef.current) {
				const point = toLocal(event.clientX, event.clientY);
				if (point) followSheen(point.x, point.y);
			}
			return;
		}
		if (event.pointerId !== stroke.pointerId) return;
		const native = event.nativeEvent;
		const coalesced = native.getCoalescedEvents?.() ?? [];
		const points = coalesced.length ? coalesced : [native];
		for (const point of points) {
			const current = strokeRef.current;
			if (!current) break;
			scratchTo(
				(point.clientX - current.left) * current.ratioX,
				(point.clientY - current.top) * current.ratioY,
				point.timeStamp,
			);
		}
		const last = strokeRef.current;
		if (last) followSheen(last.x, last.y);
		wake();
		const fraction = clearedRef.current / gridRef.current.length;
		setProgress(fraction);
		if (fraction >= clamp(latest.current.threshold, 0.05, 1)) reveal(true);
	};

	const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (strokeRef.current?.pointerId !== event.pointerId) return;
		endStroke();
	};

	const onPointerLeave = () => {
		if (strokeRef.current) return;
		sheenRef.current.target = SHEEN_REST;
		wake();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (latest.current.disabled || revealedRef.current) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		reveal(true);
	};

	const transition = {
		duration: reducedMotion ? 0 : REVEAL_SECONDS,
		ease: revealEase,
	};

	return (
		<div
			ref={rootRef}
			role="group"
			aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? "Scratch card")}
			aria-labelledby={ariaLabelledBy}
			aria-disabled={disabled || undefined}
			data-slot="scratch-card"
			data-foil={foil}
			data-state={revealed ? "revealed" : "covered"}
			data-disabled={disabled || undefined}
			className={cn(
				"group/scratch-card relative isolate aspect-[28/17] w-full max-w-80 select-none overflow-hidden rounded-2xl border border-black/[0.07] bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05),0_10px_28px_-14px_rgb(0_0_0/0.28)] dark:border-white/10 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_12px_32px_-14px_rgb(0_0_0/0.7)]",
				className,
			)}
			{...props}
		>
			<motion.div
				ref={contentRef}
				tabIndex={-1}
				aria-hidden={!revealed}
				inert={!revealed}
				initial={false}
				animate={{ scale: revealed ? 1 : 0.98 }}
				transition={revealed ? transition : { duration: 0 }}
				className="absolute inset-0 flex items-center justify-center overflow-hidden outline-none"
			>
				{children}
			</motion.div>

			<AnimatePresence initial={false}>
				{revealed ? null : (
					<motion.div
						key="foil"
						ref={foilRef}
						tabIndex={-1}
						aria-hidden
						initial={false}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: reducedMotion ? 1 : 1.04 }}
						transition={transition}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerEnd}
						onPointerCancel={onPointerEnd}
						onLostPointerCapture={onPointerEnd}
						onPointerLeave={onPointerLeave}
						onKeyDown={onKeyDown}
						className="absolute inset-0 cursor-crosshair touch-none outline-none group-data-disabled/scratch-card:cursor-not-allowed group-data-disabled/scratch-card:opacity-60"
					>
						{/* Shown until the canvas paints, so server HTML never shows the content. */}
						<div
							ref={fallbackRef}
							className="absolute inset-0 flex items-center justify-center font-semibold text-[11px] text-black/40 uppercase tracking-[0.18em]"
							style={{ background: cssGradient(palette) }}
						>
							{hint}
						</div>
						<canvas ref={canvasRef} className="absolute inset-0 size-full" />
					</motion.div>
				)}
			</AnimatePresence>

			{revealed ? null : (
				<button
					type="button"
					disabled={disabled}
					onClick={() => reveal(true)}
					className="absolute right-2 bottom-2 z-10 inline-flex h-7 items-center rounded-full bg-background/85 px-3 font-medium text-foreground text-xs opacity-0 pointer-coarse:opacity-100 shadow-[0_1px_2px_rgb(0_0_0/0.12)] outline-none ring-1 ring-black/5 backdrop-blur-sm transition-opacity duration-150 ease-out focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/scratch-card:opacity-100 group-data-scratching/scratch-card:invisible group-data-disabled/scratch-card:hidden motion-reduce:transition-none dark:ring-white/10"
				>
					Reveal
				</button>
			)}

			<span role="status" aria-live="polite" className="sr-only">
				{revealed ? "Revealed" : ""}
			</span>
		</div>
	);
}
