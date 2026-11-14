"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type ComponentProps,
	createContext,
	type MouseEvent,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// The wave, in CSS px and seconds.
/** Time for the front to cross the surface: a base, plus 1 s per `CROSSING_PX` of reach. */
const BASE_CROSSING = 0.36;
const CROSSING_PX = 4000;
const MIN_CROSSING = 0.38;
const MAX_CROSSING = 0.55;
/** Wavelength, as a fraction of the reach. */
const WAVELENGTH_FACTOR = 0.45;
const MIN_WAVELENGTH = 48;
const MAX_WAVELENGTH = 150;
/** Decay per radian of the swell: one full period leaves about 18 percent. */
const DECAY_RATIO = 0.27;
/** Steepest slope of the swell at full strength, just behind the front. */
const MAX_SLOPE = 0.6;
/** Strength left at the far corner. */
const FAR_STRENGTH = 0.65;
/** Hiding is the same wave, a touch calmer. */
const HIDE_STRENGTH = 0.85;
/** The slope eases to zero this close to the tap point, in px, so it never pinches. */
const CENTER_EASE = 12;
/** Periods the surface rings after the front leaves the far corner. */
const RING_PERIODS = 1.5;
/** The last part of the ring fades out over this many periods, so nothing pops. */
const FADE_PERIODS = 0.5;
/** Live fronts at once; another tap retires the oldest. */
const MAX_FRONTS = 3;
/** Soft edge of each front's mask, in px. */
const FEATHER = 1.5;
/** The light fades out over this many px at the surface's edges, or a quarter of its height. */
const EDGE_FEATHER = 8;
/** Peak scale step of the face inside a front, and of the face outside it. */
const LENS_IN = 0.02;
const LENS_OUT = 0.012;
/** Cross-fade without WebGL or with reduced motion, in ms. */
const FADE_MS = 140;
const MAX_BACKING_SCALE = 2;
/** Light strengths when the surface's custom properties are unset. */
const DEFAULT_HIGHLIGHT = 0.6;
const DEFAULT_SHADE = 0.12;

// A fingertip on a taut surface: a short burst of pink noise through a low
// band-pass. No pitch sweep, so it never turns into a droplet. Reveal sits a
// shade higher than hide.
const REVEAL_SOUND = {
	name: "ripple-reveal-show",
	baseFreq: 440,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 640,
	filterQ: 2.2,
	attack: 0.001,
	decay: 1.1,
	brightness: 1500,
} as const;
const HIDE_SOUND = {
	...REVEAL_SOUND,
	name: "ripple-reveal-hide",
	filterFreq: 500,
} as const;

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
	gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// One damped sine per front, evaluated per pixel. The slope becomes a surface
// normal lit from the top left; only light is drawn, in premultiplied alpha,
// and flat water draws nothing at all.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uSize;
uniform float uHeight;
uniform float uScale;
uniform vec2 uOrigin[${MAX_FRONTS}];
uniform float uAge[${MAX_FRONTS}];
uniform float uSpeed[${MAX_FRONTS}];
uniform float uFreq[${MAX_FRONTS}];
uniform float uDecay[${MAX_FRONTS}];
uniform float uStrength[${MAX_FRONTS}];
uniform float uReach[${MAX_FRONTS}];
uniform float uHighlight;
uniform float uShade;

// Toward the light, top left (y points down), and halfway to the viewer.
const vec3 LIGHT = vec3(-0.42, -0.56, 0.714);
const vec3 HALFWAY = vec3(-0.227, -0.303, 0.926);

void main() {
	vec2 px = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uScale;
	vec2 grad = vec2(0.0);
	vec2 displacement = vec2(0.0);
	float rise = 0.0;
	float height = 0.0;
	float glint = 0.0;

	for (int i = 0; i < ${MAX_FRONTS}; i++) {
		if (uStrength[i] <= 0.0) continue;
		vec2 d = px - uOrigin[i];
		float r = length(d);
		vec2 direction = d / max(r, 1.0);
		// How long ago the front reached this pixel.
		float local = max(0.0, uAge[i] - r / uSpeed[i]);
		float env = exp(-uDecay[i] * local);
		float s = sin(uFreq[i] * local);
		float c = cos(uFreq[i] * local);
		float swell = s * env;
		float k = uStrength[i] * mix(1.0, ${FAR_STRENGTH.toFixed(2)}, clamp(r / uReach[i], 0.0, 1.0));
		// Px behind the front, anti-aliased over one px; nothing moves ahead of it.
		float behind = uAge[i] * uSpeed[i] - r;
		float reached = clamp(behind + 0.5, 0.0, 1.0) * smoothstep(0.0, ${CENTER_EASE.toFixed(1)}, r);
		// The slope along the radius, normalised so the steepest is 1.
		float slope = -(c - (uDecay[i] / uFreq[i]) * s) * env * k * reached;
		// Where a DOM texture would be sampled once HTML-in-canvas ships.
		displacement += ${MAX_SLOPE.toFixed(2)} * uSpeed[i] / uFreq[i] * swell * k * direction;
		grad += ${MAX_SLOPE.toFixed(2)} * slope * direction;
		rise -= slope;
		height += swell * k;
		glint += k * exp(-behind * behind * 1.4);
	}

	// Light fades out near the edges, so on a bare line of text it never reads as a box.
	vec2 edge = min(px, uSize - px);
	float feather = clamp(min(uSize.x, uSize.y) * 0.25, 1.0, ${EDGE_FEATHER.toFixed(1)});
	float edges = smoothstep(0.0, feather, min(edge.x, edge.y));

	vec3 n = normalize(vec3(-grad, 1.0));
	float diffuse = (dot(n, LIGHT) - LIGHT.z) / 0.3;
	float specular = max(pow(max(dot(n, HALFWAY), 0.0), 48.0) - pow(HALFWAY.z, 48.0), 0.0);
	float light = uHighlight * clamp(
		0.6 * specular + 0.25 * max(diffuse, 0.0) + 0.6 * max(rise, 0.0) +
		0.35 * max(height, 0.0) + 0.35 * glint,
		0.0, 1.0);
	float shade = uShade * clamp(
		0.35 * max(-diffuse, 0.0) + 0.5 * max(-rise, 0.0) + 0.9 * max(-height, 0.0),
		0.0, 1.0);
	light *= edges;
	shade *= edges;
	gl_FragColor = vec4(vec3(light), light + shade * (1.0 - light));
}
`;

const UNIFORMS = [
	"uSize",
	"uHeight",
	"uScale",
	"uOrigin",
	"uAge",
	"uSpeed",
	"uFreq",
	"uDecay",
	"uStrength",
	"uReach",
	"uHighlight",
	"uShade",
] as const;

interface WaveRenderer {
	canvas: HTMLCanvasElement;
	gl: WebGLRenderingContext;
	uniforms: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

// One WebGL context for the whole page: browsers cap live contexts at about
// 16, and a list of accounts can hold a dozen values. Each surface draws here
// and copies the result into its own 2D canvas in the same frame.
let renderer: WaveRenderer | null = null;
/** Set once WebGL is missing, fails to build, or loses its context; the fade is used from then on. */
let rendererBroken = false;
const lossListeners = new Set<() => void>();
const scratch = {
	origin: new Float32Array(MAX_FRONTS * 2),
	age: new Float32Array(MAX_FRONTS),
	speed: new Float32Array(MAX_FRONTS),
	freq: new Float32Array(MAX_FRONTS),
	decay: new Float32Array(MAX_FRONTS),
	strength: new Float32Array(MAX_FRONTS),
	reach: new Float32Array(MAX_FRONTS),
};

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createRenderer(): WaveRenderer | null {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const options: WebGLContextAttributes = {
		alpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		premultipliedAlpha: true,
		preserveDrawingBuffer: false,
		powerPreference: "low-power",
	};
	const gl = (canvas.getContext("webgl2", options) ??
		canvas.getContext("webgl", options)) as WebGLRenderingContext | null;
	if (!gl) return null;

	const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
	const program = gl.createProgram();
	if (!vertex || !fragment || !program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
	gl.useProgram(program);

	// One triangle that covers the viewport.
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW,
	);
	const position = gl.getAttribLocation(program, "aPosition");
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	gl.clearColor(0, 0, 0, 0);

	const uniforms = {} as WaveRenderer["uniforms"];
	for (const name of UNIFORMS) {
		uniforms[name] = gl.getUniformLocation(program, name);
	}

	// A lost context isn't asked back: the fade takes over for the rest of the page.
	canvas.addEventListener("webglcontextlost", () => {
		renderer = null;
		rendererBroken = true;
		for (const listener of lossListeners) listener();
	});
	return { canvas, gl, uniforms };
}

/** The page's wave renderer, created on first use. `null` means use the fade. */
function getRenderer() {
	if (renderer || rendererBroken || typeof document === "undefined") {
		return renderer;
	}
	renderer = createRenderer();
	if (!renderer) rendererBroken = true;
	return renderer;
}

/** Builds the renderer and draws one empty frame, so the first ripple doesn't wait on the driver. */
function warmRenderer() {
	if (renderer || rendererBroken || prefersReducedMotion()) return;
	const created = getRenderer();
	if (!created) return;
	const { gl, uniforms } = created;
	gl.viewport(0, 0, 1, 1);
	gl.uniform1fv(uniforms.uStrength, new Float32Array(MAX_FRONTS));
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.flush();
}

function prefersReducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number) {
	return Math.round(value * 100) / 100;
}

interface Front {
	/** The tap point, in the surface's px. */
	x: number;
	y: number;
	/** `performance.now()` when the front left the tap point. */
	start: number;
	/** The face the front turns on: `true` for the shown face. */
	to: boolean;
	speed: number;
	freq: number;
	decay: number;
	strength: number;
	/** Distance to the farthest corner of the surface. */
	reach: number;
	/** Seconds for the front to reach the farthest corner. */
	crossing: number;
	period: number;
	/** Seconds until the farthest corner is `RING_PERIODS` behind the front. */
	life: number;
}

function createFront(
	x: number,
	y: number,
	width: number,
	height: number,
	to: boolean,
	start: number,
): Front {
	const reach = Math.max(
		Math.hypot(x, y),
		Math.hypot(width - x, y),
		Math.hypot(x, height - y),
		Math.hypot(width - x, height - y),
		1,
	);
	// A small value gets a slower wave so it is still seen; a big card doesn't drag.
	const crossing = clamp(
		BASE_CROSSING + reach / CROSSING_PX,
		MIN_CROSSING,
		MAX_CROSSING,
	);
	const speed = reach / crossing;
	const wavelength = clamp(
		WAVELENGTH_FACTOR * reach,
		MIN_WAVELENGTH,
		MAX_WAVELENGTH,
	);
	const freq = (2 * Math.PI * speed) / wavelength;
	const period = wavelength / speed;
	return {
		x,
		y,
		start,
		to,
		speed,
		freq,
		decay: DECAY_RATIO * freq,
		strength: to ? 1 : HIDE_STRENGTH,
		reach,
		crossing,
		period,
		life: crossing + RING_PERIODS * period,
	};
}

/** Strength of a front `age` seconds in, faded out over its last half period. */
function strengthAt(front: Front, age: number) {
	const fade = clamp((front.life - age) / (FADE_PERIODS * front.period), 0, 1);
	return front.strength * fade;
}

/**
 * The same damped sine as the wave, stretched so half a period spans the
 * crossing. At the wave's own period the swell is spent before the front
 * reaches the value; this way the lens step peaks while it crosses the text.
 */
function lensAt(front: Front, age: number) {
	const freq = Math.PI / front.crossing;
	return (
		Math.sin(freq * age) *
		Math.exp(-DECAY_RATIO * freq * age) *
		strengthAt(front, age)
	);
}

type Mode = "idle" | "ripple" | "fade";

interface Engine {
	/** The state every live front ends on. */
	target: boolean;
	mode: Mode;
	fronts: Front[];
	frame: number;
	/** Opacity of the shown face during the fade. */
	fade: number;
	lastTime: number;
	/** Surface size in px, and canvas px per px. */
	width: number;
	height: number;
	scale: number;
	/** Where each face sits in the surface, measured once per ripple and on resize. */
	shownOffset: Point;
	hiddenOffset: Point;
	highlight: number;
	shade: number;
	context: CanvasRenderingContext2D | null;
}

type Point = { x: number; y: number };

interface SurfaceController {
	/** Plays the change to `next`. A `point` in client px is where the wave starts; `null` is the center. */
	play: (next: boolean, point: Point | null, user: boolean) => void;
}

interface RippleRevealContextValue {
	revealed: boolean;
	disabled: boolean;
	surfaceId: string;
	surfaceRef: RefObject<SurfaceController | null>;
	toggle: (point: Point) => void;
}

const RippleRevealContext = createContext<RippleRevealContextValue | null>(
	null,
);

function useRippleReveal() {
	const context = useContext(RippleRevealContext);
	if (!context) {
		throw new Error(
			"RippleReveal parts must be rendered inside <RippleReveal>.",
		);
	}
	return context;
}

export interface RippleRevealProps extends ComponentProps<"div"> {
	/** Controlled state: `true` shows the value, `false` hides it. */
	revealed?: boolean;
	/** Initial state when uncontrolled. */
	defaultRevealed?: boolean;
	/** Called the moment the trigger is pressed, before the wave has crossed. */
	onRevealedChange?: (revealed: boolean) => void;
	disabled?: boolean;
	/** Play a soft tap when the trigger is pressed. */
	sound?: boolean;
	/** Trigger a light haptic on supported devices when the trigger is pressed. */
	haptics?: boolean;
}

export function RippleReveal({
	revealed: revealedProp,
	defaultRevealed = true,
	onRevealedChange,
	disabled = false,
	sound = true,
	haptics = true,
	className,
	children,
	...props
}: RippleRevealProps) {
	const [internalRevealed, setInternalRevealed] = useState(defaultRevealed);
	const controlled = revealedProp !== undefined;
	const revealed = controlled ? revealedProp : internalRevealed;
	// A controlled root re-renders on every press, so a refused change is played back.
	const [, rerender] = useReducer((count: number) => count + 1, 0);

	const surfaceId = useId();
	const surfaceRef = useRef<SurfaceController | null>(null);
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playTap, setTheme: setTapSound } = useTiks({
		theme: REVEAL_SOUND,
		respectReducedMotion: false,
	});

	// Event handlers read the latest props through a ref.
	const latest = useRef({
		revealed,
		controlled,
		onRevealedChange,
		disabled,
		sound,
		haptics,
	});
	useLayoutEffect(() => {
		latest.current = {
			revealed,
			controlled,
			onRevealedChange,
			disabled,
			sound,
			haptics,
		};
	});

	// Called only for user input, so the first render and prop changes stay quiet.
	const toggle = (point: Point) => {
		const current = latest.current;
		if (current.disabled) return;
		const next = !current.revealed;
		// Two presses inside one frame still alternate.
		current.revealed = next;
		if (current.controlled) rerender();
		else setInternalRevealed(next);
		current.onRevealedChange?.(next);
		if (document.visibilityState !== "hidden") {
			if (current.sound) {
				setTapSound(next ? REVEAL_SOUND : HIDE_SOUND);
				playTap();
			}
			if (current.haptics) void haptic("light");
		}
		surfaceRef.current?.play(next, point, true);
	};

	return (
		<RippleRevealContext.Provider
			value={{ revealed, disabled, surfaceId, surfaceRef, toggle }}
		>
			<div
				data-slot="ripple-reveal"
				data-state={revealed ? "revealed" : "hidden"}
				data-disabled={disabled || undefined}
				{...props}
				className={className}
			>
				{children}
			</div>
		</RippleRevealContext.Provider>
	);
}

const DOT_KEYS = ["a", "b", "c", "d", "e"] as const;

/** Five em-sized dots, so they don't depend on the font. */
function Dots() {
	return (
		<span className="inline-flex h-[1lh] items-center gap-[0.24em] align-top opacity-55">
			{DOT_KEYS.map((key) => (
				<span key={key} className="size-[0.42em] rounded-full bg-current" />
			))}
		</span>
	);
}

/** Readable text of a face, with its lines joined by spaces. */
function textOf(element: HTMLElement | null) {
	return element?.innerText.replace(/\s+/g, " ").trim() ?? "";
}

const FACE_STYLES = [
	"-webkit-mask-image",
	"mask-image",
	"-webkit-mask-composite",
	"mask-composite",
	"-webkit-mask-repeat",
	"mask-repeat",
	"-webkit-mask-size",
	"mask-size",
	"transform",
	"transform-origin",
	"opacity",
] as const;

const NO_MASK = "linear-gradient(transparent, transparent)";
const FULL_MASK = "linear-gradient(#000, #000)";

export interface RippleRevealSurfaceProps
	extends Omit<ComponentProps<"div">, "ref"> {
	/** The shown face: the value itself. */
	children?: ReactNode;
	/** The hidden face. Defaults to five dots in the current text color. */
	placeholder?: ReactNode;
	/** What assistive technology gets in place of the value while it's hidden. */
	hiddenLabel?: string;
	/** Plain text announced on reveal. Defaults to the shown face's text. */
	valueText?: string;
}

export function RippleRevealSurface({
	children,
	placeholder,
	hiddenLabel = "Hidden",
	valueText,
	className,
	...props
}: RippleRevealSurfaceProps) {
	const { revealed, surfaceId, surfaceRef: controllerRef } = useRippleReveal();
	const [announcement, setAnnouncement] = useState("");

	const surfaceRef = useRef<HTMLDivElement>(null);
	const shownRef = useRef<HTMLDivElement>(null);
	const hiddenRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pendingAnnouncementRef = useRef<boolean | null>(null);
	const engineRef = useRef<Engine | null>(null);
	engineRef.current ??= {
		target: revealed,
		mode: "idle",
		fronts: [],
		frame: 0,
		fade: revealed ? 1 : 0,
		lastTime: 0,
		width: 0,
		height: 0,
		scale: 1,
		shownOffset: { x: 0, y: 0 },
		hiddenOffset: { x: 0, y: 0 },
		highlight: DEFAULT_HIGHLIGHT,
		shade: DEFAULT_SHADE,
		context: null,
	};
	const engine = engineRef.current;

	/** Back to rest in the final state: no canvas pixels, masks, transforms, or frames. */
	const stop = () => {
		cancelAnimationFrame(engine.frame);
		engine.frame = 0;
		engine.fronts = [];
		engine.mode = "idle";
		for (const face of [shownRef.current, hiddenRef.current]) {
			if (!face) continue;
			for (const property of FACE_STYLES) face.style.removeProperty(property);
		}
		surfaceRef.current?.removeAttribute("data-animating");
		const canvas = canvasRef.current;
		if (canvas) {
			// Zero size frees the backing store until the next ripple.
			canvas.width = 0;
			canvas.height = 0;
			canvas.style.removeProperty("display");
		}
	};

	const measure = () => {
		const surface = surfaceRef.current;
		const canvas = canvasRef.current;
		const shown = shownRef.current;
		const hidden = hiddenRef.current;
		if (!surface || !canvas || !shown || !hidden) return;
		engine.width = surface.clientWidth;
		engine.height = surface.clientHeight;
		engine.shownOffset = { x: shown.offsetLeft, y: shown.offsetTop };
		engine.hiddenOffset = { x: hidden.offsetLeft, y: hidden.offsetTop };
		engine.scale = Math.min(window.devicePixelRatio || 1, MAX_BACKING_SCALE);
		canvas.width = Math.max(1, Math.round(engine.width * engine.scale));
		canvas.height = Math.max(1, Math.round(engine.height * engine.scale));
	};

	/** Draws the wave into this surface's canvas. `false` once WebGL is gone. */
	const drawWave = (now: number) => {
		const canvas = canvasRef.current;
		const wave = getRenderer();
		if (!canvas || !wave || wave.gl.isContextLost()) return false;
		engine.context ??= canvas.getContext("2d");
		const context = engine.context;
		if (!context) return false;
		const { gl, uniforms } = wave;
		const width = canvas.width;
		const height = canvas.height;
		if (wave.canvas.width < width || wave.canvas.height < height) {
			wave.canvas.width = Math.max(wave.canvas.width, width);
			wave.canvas.height = Math.max(wave.canvas.height, height);
		}
		gl.viewport(0, 0, width, height);
		gl.clear(gl.COLOR_BUFFER_BIT);

		scratch.strength.fill(0);
		engine.fronts.forEach((front, index) => {
			const age = (now - front.start) / 1000;
			scratch.origin[index * 2] = front.x;
			scratch.origin[index * 2 + 1] = front.y;
			scratch.age[index] = age;
			scratch.speed[index] = front.speed;
			scratch.freq[index] = front.freq;
			scratch.decay[index] = front.decay;
			scratch.strength[index] = strengthAt(front, age);
			scratch.reach[index] = front.reach;
		});
		gl.uniform2f(uniforms.uSize, engine.width, engine.height);
		gl.uniform1f(uniforms.uHeight, height);
		gl.uniform1f(uniforms.uScale, width / Math.max(engine.width, 1));
		gl.uniform2fv(uniforms.uOrigin, scratch.origin);
		gl.uniform1fv(uniforms.uAge, scratch.age);
		gl.uniform1fv(uniforms.uSpeed, scratch.speed);
		gl.uniform1fv(uniforms.uFreq, scratch.freq);
		gl.uniform1fv(uniforms.uDecay, scratch.decay);
		gl.uniform1fv(uniforms.uStrength, scratch.strength);
		gl.uniform1fv(uniforms.uReach, scratch.reach);
		gl.uniform1f(uniforms.uHighlight, engine.highlight);
		gl.uniform1f(uniforms.uShade, engine.shade);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		// The viewport sits at the bottom left of the shared canvas.
		context.clearRect(0, 0, width, height);
		context.drawImage(
			wave.canvas,
			0,
			wave.canvas.height - height,
			width,
			height,
			0,
			0,
			width,
			height,
		);
		return true;
	};

	/**
	 * Masks and scales one face. Each front still crossing is a circle; the
	 * circles are combined with XOR, so every front a pixel has passed flips it.
	 */
	const paintFace = (face: HTMLElement, shown: boolean, now: number) => {
		const offset = shown ? engine.shownOffset : engine.hiddenOffset;
		const offsetX = offset.x;
		const offsetY = offset.y;
		// Each front scales the face about its tap point; together they are one
		// uniform scale and a translation.
		let scale = 1;
		let x = 0;
		let y = 0;
		for (const front of engine.fronts) {
			const age = (now - front.start) / 1000;
			const step =
				1 + (front.to === shown ? LENS_IN : -LENS_OUT) * lensAt(front, age);
			const originX = front.x - offsetX;
			const originY = front.y - offsetY;
			scale *= step;
			x = step * x + (1 - step) * originX;
			y = step * y + (1 - step) * originY;
		}

		const layers: string[] = [];
		for (const front of engine.fronts) {
			const radius = ((now - front.start) / 1000) * front.speed;
			if (radius >= front.reach + FEATHER) continue;
			// Map the circle back through the transform so both faces meet on it.
			const centerX = (front.x - offsetX - x) / scale;
			const centerY = (front.y - offsetY - y) / scale;
			const inner = Math.max(0, radius - FEATHER / 2) / scale;
			const outer = (radius + FEATHER / 2) / scale;
			layers.push(
				`radial-gradient(circle at ${round(centerX)}px ${round(centerY)}px, #000 ${round(inner)}px, transparent ${round(outer)}px)`,
			);
		}
		// Outside every circle a face shows its state from before those fronts.
		const before = engine.target !== (layers.length % 2 === 1);
		if (before === shown) layers.push(FULL_MASK);
		const mask = layers.length ? layers.join(", ") : NO_MASK;
		face.style.setProperty("-webkit-mask-image", mask);
		face.style.setProperty("mask-image", mask);
		face.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${round(x)}, ${round(y)})`;
	};

	const paintRipple = (now: number) => {
		engine.fronts = engine.fronts.filter(
			(front) => (now - front.start) / 1000 < front.life,
		);
		const shown = shownRef.current;
		const hidden = hiddenRef.current;
		if (!engine.fronts.length || !shown || !hidden || !drawWave(now)) {
			stop();
			return;
		}
		paintFace(shown, true, now);
		paintFace(hidden, false, now);
	};

	const paintFade = (now: number) => {
		const shown = shownRef.current;
		const hidden = hiddenRef.current;
		if (!shown || !hidden) {
			stop();
			return;
		}
		const goal = engine.target ? 1 : 0;
		const step = (now - engine.lastTime) / FADE_MS;
		engine.lastTime = now;
		engine.fade =
			goal > engine.fade
				? Math.min(goal, engine.fade + step)
				: Math.max(goal, engine.fade - step);
		if (engine.fade === goal) {
			stop();
			return;
		}
		shown.style.opacity = String(round(engine.fade));
		hidden.style.opacity = String(round(1 - engine.fade));
	};

	const frame = (now: number) => {
		engine.frame = 0;
		if (engine.mode === "ripple") paintRipple(now);
		else if (engine.mode === "fade") paintFade(now);
		if (engine.mode !== "idle") wake();
	};

	const frameHandlerRef = useRef(frame);
	useLayoutEffect(() => {
		frameHandlerRef.current = frame;
	});

	function wake() {
		if (engine.frame) return;
		engine.frame = requestAnimationFrame((now) => frameHandlerRef.current(now));
	}

	const play = (next: boolean, point: Point | null, user: boolean) => {
		if (user) pendingAnnouncementRef.current = next;
		if (next === engine.target) return;
		const previous = engine.target;
		engine.target = next;
		const surface = surfaceRef.current;
		const shown = shownRef.current;
		const hidden = hiddenRef.current;
		if (!surface || !shown || !hidden) return;
		const width = surface.clientWidth;
		const height = surface.clientHeight;
		// Nothing to see: land in the final state at once.
		if (!width || !height || document.visibilityState === "hidden") {
			stop();
			return;
		}
		const now = performance.now();

		// Reduced motion, or no WebGL: a plain cross-fade. Read live, every time.
		if (prefersReducedMotion() || !getRenderer()) {
			if (engine.mode === "ripple") stop();
			if (engine.mode === "idle") engine.fade = previous ? 1 : 0;
			engine.mode = "fade";
			engine.lastTime = now;
			surface.setAttribute("data-animating", "");
			paintFade(now);
			wake();
			return;
		}

		if (engine.mode === "fade") stop();
		let x = width / 2;
		let y = height / 2;
		if (point) {
			// CSS zoom and transforms scale client px; work in the surface's own px.
			const rect = surface.getBoundingClientRect();
			const zoom = rect.width / (surface.offsetWidth || 1) || 1;
			x = (point.x - rect.left) / zoom - surface.clientLeft;
			y = (point.y - rect.top) / zoom - surface.clientTop;
		}
		if (engine.fronts.length >= MAX_FRONTS) engine.fronts.shift();
		engine.fronts.push(createFront(x, y, width, height, next, now));

		if (engine.mode === "idle") {
			// Light strengths are read once per ripple, from the surface's custom properties.
			const style = getComputedStyle(surface);
			const highlight = Number.parseFloat(
				style.getPropertyValue("--ripple-reveal-highlight"),
			);
			const shade = Number.parseFloat(
				style.getPropertyValue("--ripple-reveal-shade"),
			);
			engine.highlight = Number.isFinite(highlight)
				? highlight
				: DEFAULT_HIGHLIGHT;
			engine.shade = Number.isFinite(shade) ? shade : DEFAULT_SHADE;
			measure();
			canvasRef.current?.style.setProperty("display", "block");
			for (const face of [shown, hidden]) {
				face.style.setProperty("-webkit-mask-repeat", "no-repeat");
				face.style.setProperty("mask-repeat", "no-repeat");
				face.style.setProperty("-webkit-mask-size", "100% 100%");
				face.style.setProperty("mask-size", "100% 100%");
				face.style.setProperty("-webkit-mask-composite", "xor");
				face.style.setProperty("mask-composite", "exclude");
				face.style.transformOrigin = "0 0";
			}
			surface.setAttribute("data-animating", "");
		}
		engine.mode = "ripple";
		paintRipple(now);
		wake();
	};

	const controller = useRef<SurfaceController>({ play });
	useLayoutEffect(() => {
		controller.current.play = play;
		controllerRef.current = controller.current;
		return () => {
			if (controllerRef.current === controller.current) {
				controllerRef.current = null;
			}
		};
	});

	useLayoutEffect(() => {
		// A change that didn't come from the trigger, such as the parent's
		// `revealed`: a silent wave from the center.
		if (engine.target !== revealed) play(revealed, null, false);
		const pending = pendingAnnouncementRef.current;
		if (pending === null) return;
		pendingAnnouncementRef.current = null;
		if (pending !== revealed) return;
		setAnnouncement(
			revealed ? (valueText ?? textOf(shownRef.current)) : hiddenLabel,
		);
	});

	// Hiding the tab, losing the context, or collapsing the surface ends a
	// ripple in its final state.
	const stopRef = useRef(stop);
	const resizeRef = useRef(measure);
	useLayoutEffect(() => {
		stopRef.current = stop;
		resizeRef.current = measure;
	});

	useEffect(() => {
		const surface = surfaceRef.current;
		if (!surface) return;
		const engine = engineRef.current;
		const onResize = () => {
			if (engine?.mode !== "ripple") return;
			if (!surface.clientWidth || !surface.clientHeight) stopRef.current();
			else resizeRef.current();
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") stopRef.current();
		};
		const onLoss = () => {
			if (engine?.mode === "ripple") stopRef.current();
		};
		const observer = new ResizeObserver(onResize);
		observer.observe(surface);
		document.addEventListener("visibilitychange", onVisibilityChange);
		lossListeners.add(onLoss);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			lossListeners.delete(onLoss);
			if (engine) cancelAnimationFrame(engine.frame);
		};
	}, []);

	return (
		<div
			ref={surfaceRef}
			id={surfaceId}
			data-slot="ripple-reveal-surface"
			data-state={revealed ? "revealed" : "hidden"}
			{...props}
			className={cn(
				"relative inline-grid [--ripple-reveal-highlight:0.6] [--ripple-reveal-shade:0.12] data-animating:overflow-clip dark:[--ripple-reveal-highlight:0.4] dark:[--ripple-reveal-shade:0.25]",
				className,
			)}
		>
			{/* While hidden and at rest, the value can't be found, selected, or focused. */}
			<div
				ref={shownRef}
				data-slot="ripple-reveal-value"
				aria-hidden={!revealed || undefined}
				inert={!revealed}
				className="rounded-[inherit] [grid-area:1/1] [[data-state=hidden]:not([data-animating])>&]:invisible"
			>
				{children}
			</div>
			<div
				ref={hiddenRef}
				aria-hidden
				inert
				data-slot="ripple-reveal-placeholder"
				className="rounded-[inherit] [grid-area:1/1] [[data-state=revealed]:not([data-animating])>&]:invisible"
			>
				{placeholder ?? <Dots />}
			</div>
			{revealed ? null : <span className="sr-only">{hiddenLabel}</span>}
			<canvas
				ref={canvasRef}
				aria-hidden
				width={0}
				height={0}
				data-slot="ripple-reveal-canvas"
				className="pointer-events-none absolute inset-0 hidden size-full rounded-[inherit]"
			/>
			<span role="status" aria-live="polite" className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

/** An eye whose slash draws in while the value is shown, and out while it's hidden. */
function EyeIcon({ slashed }: { slashed: boolean }) {
	const maskId = `ripple-reveal-eye-${useId().replace(/[^\w-]/g, "")}`;
	const slash = {
		strokeDashoffset: slashed ? 0 : 1,
		opacity: slashed ? 1 : 0,
	};
	const slashClass =
		"transition-[stroke-dashoffset,opacity] duration-150 ease-out motion-reduce:transition-none";
	return (
		<svg
			aria-hidden
			width={16}
			height={16}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<mask
				id={maskId}
				maskUnits="userSpaceOnUse"
				x={0}
				y={0}
				width={24}
				height={24}
			>
				<rect width={24} height={24} fill="#fff" />
				{/* Cuts a gap in the eye on either side of the slash. */}
				<path
					d="M3 3L21 21"
					stroke="#000"
					strokeWidth={5.5}
					pathLength={1}
					strokeDasharray="1 1"
					className={slashClass}
					style={slash}
				/>
			</mask>
			<g mask={`url(#${maskId})`}>
				<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
				<circle cx={12} cy={12} r={3} />
			</g>
			<path
				d="M3 3L21 21"
				pathLength={1}
				strokeDasharray="1 1"
				className={slashClass}
				style={slash}
			/>
		</svg>
	);
}

export interface RippleRevealTriggerProps extends ComponentProps<"button"> {
	/** Accessible name. Ignored when `aria-label` or `aria-labelledby` is set. */
	label?: string;
	/** Replaces the default eye icon. */
	children?: ReactNode;
}

export function RippleRevealTrigger({
	label = "Show value",
	children,
	className,
	disabled: disabledProp,
	onClick,
	onFocus,
	onPointerEnter,
	onTouchStart,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: RippleRevealTriggerProps) {
	const { revealed, disabled, surfaceId, toggle } = useRippleReveal();

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		// Keys, and clicks without a pointer, start from the center of the trigger.
		if (event.detail === 0) {
			const rect = event.currentTarget.getBoundingClientRect();
			toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
		} else {
			toggle({ x: event.clientX, y: event.clientY });
		}
	};

	return (
		<button
			type="button"
			aria-pressed={revealed}
			aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? label)}
			aria-labelledby={ariaLabelledBy}
			aria-controls={surfaceId}
			disabled={disabled || disabledProp}
			data-slot="ripple-reveal-trigger"
			data-state={revealed ? "revealed" : "hidden"}
			{...props}
			// Compile the shader before the first press needs it.
			onPointerEnter={(event) => {
				onPointerEnter?.(event);
				warmRenderer();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				warmRenderer();
			}}
			onTouchStart={(event) => {
				onTouchStart?.(event);
				warmRenderer();
			}}
			onClick={handleClick}
			className={cn(
				"relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,opacity] duration-150 ease-out [-webkit-tap-highlight-color:transparent] before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 hover:bg-foreground/6 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
				className,
			)}
		>
			{children ?? <EyeIcon slashed={revealed} />}
		</button>
	);
}

export default RippleReveal;
