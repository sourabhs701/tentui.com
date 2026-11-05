"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	type Easing,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type CSSProperties,
	type KeyboardEvent,
	type MouseEvent,
	memo,
	type PointerEvent,
	type Ref,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Smallest a bubble may get, in px. Columns drop on narrow sheets to keep it. */
const MIN_CELL_PX = 36;
/** Largest a bubble gets at the sheet's default width, in px. */
const MAX_CELL_PX = 42;
const GAP_PX = 6;
const PADDING_PX = 12;
/** A sweep pops a bubble once it passes this close to the center, as a fraction of the radius. */
const HIT_REACH = 0.92;
/** Ripple delay per bubble of distance from its origin, and the longest delay, in ms. */
const RIPPLE_STEP_MS = 14;
const RIPPLE_MAX_MS = 320;
/** Pause after the last pop before the sheet refills, in ms. */
const AUTO_RESET_MS = 900;
/** Minimum ms between haptic ticks. */
const CUE_THROTTLE_MS = 35;
/** Remaining counts are announced every this many bubbles. */
const ANNOUNCE_EVERY = 5;
/** The clear flourish plays this long after the last pop, in ms. */
const FLOURISH_DELAY_MS = 120;

/** Pop sound: a short sine thump that drops in pitch, under a filtered noise snap. */
const POP_SECONDS = 0.1;
const POP_START_HZ = 180;
const POP_END_HZ = 70;
const POP_SWEEP_SECONDS = 0.08;
const POP_PITCH_JITTER = 0.12;
/** Fewest seconds between two pop sounds, and the most that may ring at once. */
const POP_MIN_GAP = 0.016;
const MAX_VOICES = 6;
/** A pop that would start this many seconds late is dropped instead. */
const POP_MAX_LAG = 0.05;

// A soft, low falling tick (tiks' toggle-off cue) for a cleared sheet.
const CLEAR_SOUND = {
	name: "bubble-wrap-clear",
	baseFreq: 262,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 1200,
	filterQ: 1,
	attack: 0.012,
	decay: 4,
	brightness: 1500,
} as const;

/** Fast in, no tail: a press that bottoms out at once. */
const squashEase = [0.2, 0.9, 0.3, 1] as const;
/** The dome giving way speeds up, like a seal letting go. */
const giveEase = [0.6, 0, 0.9, 0.4] as const;
const settleEase = [0.23, 1, 0.32, 1] as const;
/** A pressure wave races out, then dies away slowly. */
const waveEase = [0.1, 0.8, 0.25, 1] as const;

type TintName = "clear" | "blue" | "pink";

/** Film tint as RGB channels and strength; `clear` has none. */
const tints: Record<TintName, string> = {
	clear:
		"[--bubble-wrap-tint:148_163_184] [--bubble-wrap-tint-a:0] dark:[--bubble-wrap-tint-a:0]",
	blue: "[--bubble-wrap-tint:96_165_250] [--bubble-wrap-tint-a:0.11] dark:[--bubble-wrap-tint-a:0.1]",
	pink: "[--bubble-wrap-tint:244_114_182] [--bubble-wrap-tint-a:0.1] dark:[--bubble-wrap-tint-a:0.09]",
};

/**
 * Surface colors, light first. `ink` is the RGB of shadows, `band` of the
 * plastic bending toward the rim, and `line` of the dome's hairline edge. On a
 * light tray the rim darkens; on a dark tray it catches the light instead, and
 * the body stays nearly invisible so the domes never turn chalky.
 */
const surfaceVars =
	"[--bubble-wrap-ink:28_25_22] [--bubble-wrap-line:36_38_46] [--bubble-wrap-line-a:0.3] [--bubble-wrap-band:28_25_22] [--bubble-wrap-band-a:0.13] [--bubble-wrap-body-a:0.14] [--bubble-wrap-fill-a:0.4] [--bubble-wrap-spec-a:1] [--bubble-wrap-caustic-a:0.85] [--bubble-wrap-shadow-a:0.13] [--bubble-wrap-foot-a:0.7] [--bubble-wrap-flat-a:0.42] [--bubble-wrap-flat-rim-a:0.85] [--bubble-wrap-crease-a:0.13] [--bubble-wrap-crease-light:0.85] [--bubble-wrap-grain-a:0.5] [--bubble-wrap-wave-dark:0.1] [--bubble-wrap-wave-light:0.95] dark:[--bubble-wrap-ink:0_0_0] dark:[--bubble-wrap-line:255_255_255] dark:[--bubble-wrap-line-a:0.24] dark:[--bubble-wrap-band:255_255_255] dark:[--bubble-wrap-band-a:0.06] dark:[--bubble-wrap-body-a:0.05] dark:[--bubble-wrap-fill-a:0.08] dark:[--bubble-wrap-spec-a:0.8] dark:[--bubble-wrap-caustic-a:0.2] dark:[--bubble-wrap-shadow-a:0.5] dark:[--bubble-wrap-foot-a:0.07] dark:[--bubble-wrap-flat-a:0.055] dark:[--bubble-wrap-flat-rim-a:0.1] dark:[--bubble-wrap-crease-a:0.5] dark:[--bubble-wrap-crease-light:0.13] dark:[--bubble-wrap-grain-a:0.14] dark:[--bubble-wrap-wave-dark:0.45] dark:[--bubble-wrap-wave-light:0.2]";

/** A fine, tiling grain for the film, as a tiny inline SVG. */
const grain =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 -0.3'/%3E%3C/filter%3E%3Crect width='72' height='72' filter='url(%23g)'/%3E%3C/svg%3E\")";

const domeBodyStyle: CSSProperties = {
	background: [
		// Soft fill: the window's glow spread across the upper dome.
		"radial-gradient(52% 44% at 34% 27%, rgb(255 255 255 / var(--bubble-wrap-fill-a)), rgb(255 255 255 / 0) 100%)",
		// Clear in the middle; the plastic thickens and bends toward the rim and
		// ends in a thin hairline.
		"radial-gradient(closest-side, rgb(var(--bubble-wrap-band) / 0) 60%, rgb(var(--bubble-wrap-band) / calc(var(--bubble-wrap-band-a) * 0.4)) 80%, rgb(var(--bubble-wrap-band) / var(--bubble-wrap-band-a)) 93%, rgb(var(--bubble-wrap-line) / var(--bubble-wrap-line-a)) 98.5%, rgb(var(--bubble-wrap-line) / 0) 100%)",
		// The film's tint, densest where the plastic is thickest.
		"radial-gradient(closest-side, rgb(var(--bubble-wrap-tint) / calc(var(--bubble-wrap-tint-a) * 0.3)) 30%, rgb(var(--bubble-wrap-tint) / calc(var(--bubble-wrap-tint-a) * 1.5)) 100%)",
		"linear-gradient(160deg, rgb(255 255 255 / var(--bubble-wrap-body-a)) 12%, rgb(255 255 255 / 0) 62%)",
	].join(", "),
};

const flatStyle: CSSProperties = {
	backgroundImage: [
		// A flatter, sealed rim where the dome used to stand.
		"radial-gradient(closest-side, rgb(255 255 255 / 0) 80%, rgb(255 255 255 / calc(var(--bubble-wrap-flat-rim-a) * 0.6)) 92%, rgb(var(--bubble-wrap-ink) / calc(var(--bubble-wrap-crease-a) * 0.7)) 100%)",
		"radial-gradient(closest-side, rgb(var(--bubble-wrap-tint) / calc(var(--bubble-wrap-tint-a) * 0.5)), rgb(var(--bubble-wrap-tint) / calc(var(--bubble-wrap-tint-a) * 1.1)))",
		// Cloudy, stretched film.
		"radial-gradient(closest-side at 54% 46%, rgb(255 255 255 / calc(var(--bubble-wrap-flat-a) * 0.55)), rgb(255 255 255 / var(--bubble-wrap-flat-a)))",
	].join(", "),
	boxShadow: [
		"inset 0 0 0 0.5px rgb(var(--bubble-wrap-line) / calc(var(--bubble-wrap-line-a) * 0.6))",
		"inset 0.5px 1px 1.5px rgb(var(--bubble-wrap-ink) / calc(var(--bubble-wrap-crease-a) * 0.9))",
		"0 0.5px 0 rgb(255 255 255 / calc(var(--bubble-wrap-flat-rim-a) * 0.5))",
	].join(", "),
};

/**
 * The wrinkles of one popped bubble, in a 100 × 100 box: curved folds
 * radiating from an off-center tear, with soft facets between them. Hashed
 * by index, so each popped bubble creases its own way.
 */
function wrinkles(index: number) {
	const cx = 50 + hashUnit(index, 3) * 7;
	const cy = 48 + hashUnit(index, 4) * 7;
	const at = (radius: number, degrees: number) => {
		const radians = (degrees * Math.PI) / 180;
		return `${(cx + Math.cos(radians) * radius).toFixed(1)} ${(cy + Math.sin(radians) * radius).toFixed(1)}`;
	};
	const count = 5 + Math.round(Math.abs(hashUnit(index, 5)) * 2);
	const start = hashUnit(index, 2) * 180;
	let folds = "";
	let facets = "";
	for (let fold = 0; fold < count; fold++) {
		const angle =
			start + (fold * 360) / count + hashUnit(index, 20 + fold) * 22;
		const bend = hashUnit(index, 40 + fold) * 14;
		const inner = 3 + Math.abs(hashUnit(index, 50 + fold)) * 8;
		const reach = 22 + Math.abs(hashUnit(index, 30 + fold)) * 22;
		folds += `M${at(inner, angle)}Q${at((inner + reach) / 2, angle + bend)} ${at(reach, angle + bend * 0.2)}`;
		// Soft facets between folds: one side lit, the other shaded.
		const shade =
			fold % 2
				? "255 255 255 / calc(var(--bubble-wrap-crease-light) * 0.55)"
				: "var(--bubble-wrap-ink) / calc(var(--bubble-wrap-crease-a) * 0.7)";
		facets += `, rgb(${shade}) ${(angle - start + 180 / count).toFixed(1)}deg`;
	}
	const facetStyle: CSSProperties = {
		background: `conic-gradient(from ${start.toFixed(1)}deg at ${cx.toFixed(1)}% ${cy.toFixed(1)}%${facets}, rgb(255 255 255 / 0) 360deg)`,
	};
	return { folds, tear: { cx, cy }, facetStyle };
}

/** A slightly uneven outline for each popped bubble, so no two look stamped. */
function slackOutline(index: number) {
	const a = 50 + hashUnit(index, 8) * 5;
	const b = 50 + hashUnit(index, 9) * 5;
	const c = 50 + hashUnit(index, 10) * 5;
	const d = 50 + hashUnit(index, 11) * 5;
	return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** A fixed value in [-1, 1] for each index, so jitter is the same on server and client. */
function hashUnit(index: number, salt: number) {
	let state = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
	state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
	state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
	state ^= state >>> 15;
	return ((state >>> 0) / 4294967295) * 2 - 1;
}

function columnsFor(width: number, columns: number) {
	if (width <= 0) return columns;
	const fit = Math.floor((width + GAP_PX) / (MIN_CELL_PX + GAP_PX));
	return clamp(fit, 1, columns);
}

/** Squared distance from (px, py) to the segment from (ax, ay) to (bx, by), and where along it. */
function segmentHit(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	px: number,
	py: number,
) {
	const dx = bx - ax;
	const dy = by - ay;
	const length = dx * dx + dy * dy;
	const t = length
		? clamp(((px - ax) * dx + (py - ay) * dy) / length, 0, 1)
		: 0;
	const x = ax + dx * t - px;
	const y = ay + dy * t - py;
	return { distance: x * x + y * y, t };
}

type Keyframes = Record<string, (number | null)[]>;

interface HeldTiming {
	duration: number;
	times: number[];
	ease: Easing[];
}

/**
 * Runs `keyframes` after `delayMs`, holding the first keyframe during the
 * delay. Holding (rather than a plain delay) means the bubble keeps its old
 * look until its turn in a ripple, even though its state already changed.
 */
function animateHeld(
	element: HTMLElement,
	keyframes: Keyframes,
	{ duration, times, ease }: HeldTiming,
	delayMs: number,
) {
	const delay = delayMs / 1000;
	if (delay <= 0) {
		return animate(element, keyframes, { duration, times, ease });
	}
	const total = delay + duration;
	const held: Keyframes = {};
	for (const [key, values] of Object.entries(keyframes)) {
		held[key] = [values[0] ?? null, ...values];
	}
	return animate(element, held, {
		duration: total,
		times: [0, ...times.map((time) => (delay + time * duration) / total)],
		ease: ["linear", ...ease],
	});
}

interface PopAudio {
	ctx: AudioContext;
	output: GainNode;
	noise: AudioBuffer;
	/** End times of the pops still ringing, in context seconds. */
	voices: number[];
	lastStart: number;
}

let popAudio: PopAudio | null = null;

/** One shared context for every sheet, created on the first press (a user gesture). */
function getPopAudio() {
	if (popAudio && popAudio.ctx.state !== "closed") return popAudio;
	const AudioContextClass =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return null;
	const ctx = new AudioContextClass();
	// A limiter after the mix, so a burst of pops never clips.
	const limiter = ctx.createDynamicsCompressor();
	limiter.threshold.value = -8;
	limiter.knee.value = 4;
	limiter.ratio.value = 12;
	limiter.attack.value = 0.002;
	limiter.release.value = 0.08;
	limiter.connect(ctx.destination);
	const output = ctx.createGain();
	output.gain.value = 0.7;
	output.connect(limiter);
	const noise = ctx.createBuffer(
		1,
		Math.floor(ctx.sampleRate * 0.25),
		ctx.sampleRate,
	);
	const data = noise.getChannelData(0);
	for (let index = 0; index < data.length; index++) {
		data[index] = Math.random() * 2 - 1;
	}
	popAudio = {
		ctx,
		output,
		noise,
		voices: [],
		lastStart: Number.NEGATIVE_INFINITY,
	};
	return popAudio;
}

/**
 * Plays one pop, `delay` seconds from now. Pops are spaced at least
 * `POP_MIN_GAP` apart and at most `MAX_VOICES` ring at once; a pop that
 * can't fit soon enough is dropped. Every envelope starts and ends at zero.
 */
function playPop(audio: PopAudio, delay = 0, loudness = 1) {
	const { ctx } = audio;
	if (ctx.state === "suspended") void ctx.resume().catch(() => {});
	const wanted = ctx.currentTime + 0.005 + delay;
	const start = Math.max(wanted, audio.lastStart + POP_MIN_GAP);
	if (start - wanted > POP_MAX_LAG) return;
	audio.voices = audio.voices.filter((end) => end > start);
	if (audio.voices.length >= MAX_VOICES) return;
	const end = start + POP_SECONDS;
	audio.voices.push(end + 0.01);
	audio.lastStart = start;

	// Each pop is a little higher or lower, so a sweep never sounds mechanical.
	const pitch = 1 + (Math.random() * 2 - 1) * POP_PITCH_JITTER;
	const level = loudness * (0.85 + Math.random() * 0.3);

	const body = ctx.createOscillator();
	body.type = "sine";
	body.frequency.setValueAtTime(POP_START_HZ * pitch, start);
	body.frequency.exponentialRampToValueAtTime(
		POP_END_HZ * pitch,
		start + POP_SWEEP_SECONDS,
	);
	const bodyGain = ctx.createGain();
	bodyGain.gain.setValueAtTime(0, start);
	bodyGain.gain.linearRampToValueAtTime(0.55 * level, start + 0.003);
	bodyGain.gain.exponentialRampToValueAtTime(0.001, start + POP_SECONDS - 0.01);
	bodyGain.gain.linearRampToValueAtTime(0, start + POP_SECONDS);
	body.connect(bodyGain);
	bodyGain.connect(audio.output);
	body.start(start);
	body.stop(end + 0.01);

	// The snap of the film giving way: a few ms of band-passed noise.
	const snap = ctx.createBufferSource();
	snap.buffer = audio.noise;
	const band = ctx.createBiquadFilter();
	band.type = "bandpass";
	band.frequency.value = 1700 * pitch;
	band.Q.value = 1.1;
	const snapGain = ctx.createGain();
	snapGain.gain.setValueAtTime(0, start);
	snapGain.gain.linearRampToValueAtTime(0.42 * level, start + 0.002);
	snapGain.gain.exponentialRampToValueAtTime(0.001, start + 0.035);
	snapGain.gain.linearRampToValueAtTime(0, start + 0.04);
	snap.connect(band);
	band.connect(snapGain);
	snapGain.connect(audio.output);
	const offset = Math.random() * (audio.noise.duration - 0.06);
	snap.start(start, offset, 0.045);
}

interface Sweep {
	pointerId: number;
	/** Last pointer position, in client px relative to the grid. */
	x: number;
	y: number;
	/** Bubble centers relative to the grid, and the hit radius, in client px. */
	centers: { x: number; y: number }[];
	radius: number;
}

export interface BubbleWrapHandle {
	/** Re-inflates every bubble with a ripple. Silent. */
	reset: () => void;
	/** Pops every bubble with a ripple. Silent. */
	popAll: () => void;
}

export interface BubbleWrapProps
	extends Omit<ComponentProps<"div">, "children" | "ref"> {
	/** Rows of bubbles. */
	rows?: number;
	/** Columns of bubbles. On narrow sheets fewer columns fit, and the bubbles wrap onto more rows. */
	columns?: number;
	/** Indexes of bubbles that start out popped, for example `[2, 9, 15]`. Read on mount. */
	defaultPopped?: number[];
	/** Subtle tint of the plastic film. */
	tint?: TintName;
	/** Called once for each bubble that pops, with its index. */
	onPop?: (index: number) => void;
	/** Called once when the last bubble pops. */
	onClear?: () => void;
	/** Re-inflate the sheet shortly after every bubble is popped. */
	autoReset?: boolean;
	/** Show how many bubbles are popped under the sheet. */
	showCount?: boolean;
	/** Play a pop sound for each bubble and a soft flourish on a full clear. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	ref?: Ref<BubbleWrapHandle>;
}

interface BubbleProps {
	index: number;
	count: number;
	popped: boolean;
	focusable: boolean;
	register: (index: number, element: HTMLButtonElement | null) => void;
	onActivate: (index: number) => void;
	onFocusCell: (index: number) => void;
}

const Bubble = memo(function Bubble({
	index,
	count,
	popped,
	focusable,
	register,
	onActivate,
	onFocusCell,
}: BubbleProps) {
	// A bubble's wrinkles and outline never change, so build them once.
	const [creases] = useState(() => wrinkles(index));
	const [outline] = useState(() => slackOutline(index));

	return (
		<button
			ref={(element) => register(index, element)}
			type="button"
			tabIndex={focusable ? 0 : -1}
			aria-pressed={popped}
			aria-label={`Bubble ${index + 1} of ${count}`}
			data-bubble-index={index}
			data-state={popped ? "popped" : "inflated"}
			onClick={(event: MouseEvent<HTMLButtonElement>) => {
				// Pointer presses pop on pointer down; this is the keyboard and screen reader path.
				if (event.detail === 0) onActivate(index);
			}}
			onFocus={() => onFocusCell(index)}
			className="group/bubble relative aspect-square cursor-pointer rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:z-10 data-[state=popped]:cursor-default"
		>
			<span
				data-part="flat"
				aria-hidden
				className="pointer-events-none absolute inset-[7%] overflow-hidden opacity-0 group-data-[state=popped]/bubble:opacity-100"
				style={{ ...flatStyle, borderRadius: outline }}
			>
				<span
					className="absolute inset-0 bg-size-[72px_72px] opacity-(--bubble-wrap-grain-a) mix-blend-overlay"
					style={{ backgroundImage: grain }}
				/>
				<span
					className="absolute inset-0 blur-[1px]"
					style={creases.facetStyle}
				/>
				<svg
					viewBox="0 0 100 100"
					className="absolute inset-0 size-full fill-none blur-[0.3px]"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					{/* Each fold is a lit ridge beside a shaded crease. */}
					<g
						transform="translate(-0.9 -0.9)"
						strokeWidth={2.4}
						style={{
							stroke:
								"rgb(255 255 255 / calc(var(--bubble-wrap-crease-light) * 0.6))",
						}}
					>
						<path d={creases.folds} />
					</g>
					<g
						strokeWidth={1}
						style={{
							stroke:
								"rgb(var(--bubble-wrap-ink) / var(--bubble-wrap-crease-a))",
						}}
					>
						<path d={creases.folds} />
					</g>
					<ellipse
						cx={creases.tear.cx}
						cy={creases.tear.cy}
						rx={2.6}
						ry={1.8}
						style={{
							fill: "rgb(var(--bubble-wrap-ink) / calc(var(--bubble-wrap-crease-a) * 0.8))",
						}}
					/>
				</svg>
			</span>
			<span
				data-part="dome"
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-full group-data-[state=popped]/bubble:opacity-0"
			>
				{/* The dome's shadow on the tray. The dome itself is clear, so only the
				    crescent outside it shows, and light focused through the air pools
				    on the tray inside it. */}
				<span className="mask-[radial-gradient(closest-side_at_44%_41%,transparent_76%,#000_120%)] absolute inset-[2%] translate-x-[6%] translate-y-[9%] rounded-full bg-[rgb(var(--bubble-wrap-ink)/var(--bubble-wrap-shadow-a))] blur-[5px]" />
				<span className="absolute top-[50%] left-[42%] h-[32%] w-[42%] -rotate-[38deg] rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_255_255/var(--bubble-wrap-caustic-a)),rgb(255_255_255/0))] blur-[2px]" />
				{/* Where the film lifts off the sheet, catching the light. */}
				<span className="absolute -inset-[2%] rounded-full shadow-[-0.5px_-0.75px_1.5px_rgb(255_255_255/var(--bubble-wrap-foot-a))]" />
				<span className="absolute inset-0 rounded-full" style={domeBodyStyle} />
				{/* Light caught along the inside of the lower rim. */}
				<span className="absolute inset-[6%] rounded-full shadow-[inset_-1.5px_-2px_2px_-1px_rgb(255_255_255/var(--bubble-wrap-caustic-a))]" />
				{/* One crisp reflection of a window. */}
				<span className="absolute top-[16%] left-[23%] h-[13%] w-[28%] -rotate-[34deg] rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_255_255/var(--bubble-wrap-spec-a))_58%,rgb(255_255_255/0))]" />
			</span>
			<span
				data-part="ring"
				aria-hidden
				className="pointer-events-none absolute -inset-[4%] rounded-full bg-[radial-gradient(closest-side,rgb(var(--bubble-wrap-ink)/0)_70%,rgb(var(--bubble-wrap-ink)/var(--bubble-wrap-wave-dark))_83%,rgb(255_255_255/var(--bubble-wrap-wave-light))_91%,rgb(255_255_255/0))] opacity-0"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-[0_0_0_2px_#fff,0_0_0_4px_#18181b] group-focus-visible/bubble:opacity-100"
			/>
		</button>
	);
});

export function BubbleWrap({
	rows = 5,
	columns = 6,
	defaultPopped,
	tint = "clear",
	onPop,
	onClear,
	autoReset = true,
	showCount = false,
	sound = true,
	haptics = true,
	className,
	style,
	ref,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	onKeyDown,
	...props
}: BubbleWrapProps) {
	const columnCount = Math.max(1, Math.floor(columns) || 1);
	const rowCount = Math.max(1, Math.floor(rows) || 1);
	const count = columnCount * rowCount;

	const [initialPopped] = useState(() =>
		Array.from({ length: count }, (_, index) =>
			Boolean(defaultPopped?.includes(index)),
		),
	);
	const [popped, setPopped] = useState(initialPopped);
	const [fitColumns, setFitColumns] = useState(columnCount);
	const [activeIndex, setActiveIndex] = useState(0);
	const [announcement, setAnnouncement] = useState("");

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { toggle: playToggle } = useTiks({
		theme: CLEAR_SOUND,
		respectReducedMotion: false,
	});

	const id = useId();
	const titleId = `${id}-title`;
	const countId = `${id}-count`;

	const rootRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const cellsRef = useRef<(HTMLButtonElement | null)[]>([]);
	const poppedRef = useRef<boolean[]>(initialPopped.slice());
	const clearedRef = useRef(initialPopped.every(Boolean));
	const lastPoppedRef = useRef(defaultPopped?.at(-1) ?? 0);
	const sweepRef = useRef<Sweep | null>(null);
	const animationsRef = useRef(new Map<number, AnimationPlaybackControls[]>());
	/** Bubbles whose re-inflate animation is still running. */
	const inflatingRef = useRef(new Set<number>());
	const resetTimerRef = useRef<number | undefined>(undefined);
	const flourishTimerRef = useRef<number | undefined>(undefined);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const fitColumnsRef = useRef(fitColumns);

	// Event handlers and timers read the latest props through refs.
	const latest = useRef({
		onPop,
		onClear,
		autoReset,
		sound,
		haptics,
		reducedMotion,
	});
	useLayoutEffect(() => {
		fitColumnsRef.current = fitColumns;
		latest.current = {
			onPop,
			onClear,
			autoReset,
			sound,
			haptics,
			reducedMotion,
		};
	});

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const commit = () => setPopped(poppedRef.current.slice());

	// A new size keeps each bubble's state by index; added bubbles start inflated.
	useLayoutEffect(() => {
		const current = poppedRef.current;
		if (current.length === count) return;
		const next = Array.from({ length: count }, (_, index) =>
			Boolean(current[index]),
		);
		poppedRef.current = next;
		cellsRef.current.length = count;
		clearedRef.current = next.every(Boolean);
		setPopped(next.slice());
		setActiveIndex((index) => Math.min(index, count - 1));
	}, [count]);

	// Fewer columns fit on narrow sheets, so no bubble shrinks below MIN_CELL_PX.
	useLayoutEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;
		const update = () =>
			setFitColumns(columnsFor(grid.clientWidth, columnCount));
		update();
		const observer = new ResizeObserver(update);
		observer.observe(grid);
		return () => observer.disconnect();
	}, [columnCount]);

	useEffect(
		() => () => {
			window.clearTimeout(resetTimerRef.current);
			window.clearTimeout(flourishTimerRef.current);
			for (const controls of animationsRef.current.values()) {
				for (const control of controls) control.stop();
			}
		},
		[],
	);

	const parts = (index: number) => {
		const cell = cellsRef.current[index];
		if (!cell) return null;
		const dome = cell.querySelector<HTMLElement>('[data-part="dome"]');
		const flat = cell.querySelector<HTMLElement>('[data-part="flat"]');
		const ring = cell.querySelector<HTMLElement>('[data-part="ring"]');
		if (!dome || !flat || !ring) return null;
		return { dome, flat, ring };
	};

	const stopAnimations = (index: number) => {
		const controls = animationsRef.current.get(index);
		if (controls) for (const control of controls) control.stop();
		animationsRef.current.delete(index);
		inflatingRef.current.delete(index);
	};

	const animatePop = (index: number, delay: number) => {
		stopAnimations(index);
		const elements = parts(index);
		if (!elements) return;
		const { dome, flat, ring } = elements;
		if (latest.current.reducedMotion) {
			animationsRef.current.set(index, [
				animate(dome, { opacity: 0, scale: 1, rotate: 0 }, { duration: 0 }),
				animate(flat, { opacity: 1, scale: 1 }, { duration: 0 }),
				animate(ring, { opacity: 0 }, { duration: 0 }),
			]);
			return;
		}
		const jitter = hashUnit(index, 1) * 4;
		animationsRef.current.set(index, [
			// A quick squash with a little twist, then the dome gives way.
			animateHeld(
				dome,
				{
					scale: [null, 0.88, 0.8],
					rotate: [null, jitter, jitter * 1.5],
					// Explicit, since the popped state already hides the dome in CSS.
					opacity: [1, 1, 0],
				},
				{ duration: 0.12, times: [0, 0.55, 1], ease: [squashEase, giveEase] },
				delay,
			),
			// The slack film spreads out flat and stops dead.
			animateHeld(
				flat,
				{ opacity: [0, 0, 1], scale: [0.86, 0.86, 1] },
				{ duration: 0.2, times: [0, 0.3, 1], ease: ["linear", settleEase] },
				delay,
			),
			// A pressure wave runs out through the film from the burst.
			animateHeld(
				ring,
				{ opacity: [0, 1, 0], scale: [0.9, 1.08, 1.5] },
				{ duration: 0.34, times: [0, 0.12, 1], ease: ["easeOut", waveEase] },
				delay + 55,
			),
		]);
	};

	const animateInflate = (index: number, delay: number) => {
		stopAnimations(index);
		const elements = parts(index);
		if (!elements) return;
		const { dome, flat, ring } = elements;
		inflatingRef.current.add(index);
		const controls = latest.current.reducedMotion
			? [
					animate(flat, { opacity: 0, scale: 1 }, { duration: 0 }),
					animate(ring, { opacity: 0 }, { duration: 0 }),
					animate(
						dome,
						{ opacity: [0, 1], scale: 1, rotate: 0 },
						{ duration: 0.2, ease: "easeOut" },
					),
				]
			: [
					animate(ring, { opacity: 0 }, { duration: 0 }),
					animateHeld(
						flat,
						{ opacity: [1, 0], scale: [1, 0.94] },
						{ duration: 0.14, times: [0, 1], ease: ["easeOut"] },
						delay,
					),
					// Blooms back up past full, then settles dead still.
					animateHeld(
						dome,
						{
							opacity: [0, 1, 1, 1],
							scale: [0.72, 1.07, 0.99, 1],
							rotate: [0, 0, 0, 0],
						},
						{
							duration: 0.42,
							times: [0, 0.45, 0.75, 1],
							ease: [settleEase, "easeInOut", "easeOut"],
						},
						delay,
					),
				];
		animationsRef.current.set(index, controls);
		void controls[controls.length - 1]?.finished.then(() => {
			if (animationsRef.current.get(index) === controls) {
				inflatingRef.current.delete(index);
			}
		});
	};

	/** Ripple delay of each bubble, by grid distance from `origin`. */
	const rippleDelay = (index: number, origin: number) => {
		const cols = fitColumnsRef.current;
		const dx = (index % cols) - (origin % cols);
		const dy = Math.floor(index / cols) - Math.floor(origin / cols);
		return Math.min(Math.hypot(dx, dy) * RIPPLE_STEP_MS, RIPPLE_MAX_MS);
	};

	const announceAfter = (before: number, after: number) => {
		if (after === 0) setAnnouncement("All popped");
		else if (
			Math.floor((before - 1) / ANNOUNCE_EVERY) >
			Math.floor((after - 1) / ANNOUNCE_EVERY)
		) {
			setAnnouncement(`${after} ${after === 1 ? "bubble" : "bubbles"} left`);
		}
	};

	const scheduleAutoReset = (after: number) => {
		window.clearTimeout(resetTimerRef.current);
		if (!latest.current.autoReset) return;
		resetTimerRef.current = window.setTimeout(() => {
			resetTimerRef.current = undefined;
			if (latest.current.autoReset) resetSheet(lastPoppedRef.current, true);
		}, after);
	};

	/**
	 * Pops `indices` in order. With `ripple`, each waits for its distance from
	 * the origin. `cue` plays sounds and haptics, for user input only.
	 */
	const pop = (
		indices: number[],
		{ cue, ripple }: { cue: boolean; ripple?: number },
	) => {
		const state = poppedRef.current;
		const delayOf = (index: number) =>
			ripple === undefined ? 0 : rippleDelay(index, ripple);
		const fresh = indices.filter((index) => index < count && !state[index]);
		if (!fresh.length) return;
		// Ripples pop, and schedule their sounds, nearest first.
		if (ripple !== undefined) fresh.sort((a, b) => delayOf(a) - delayOf(b));
		const before = state.filter((value) => !value).length;
		const {
			sound: soundOn,
			haptics: hapticsOn,
			onPop: handlePop,
		} = latest.current;
		const audio = cue && soundOn && !silent() ? getPopAudio() : null;
		let longest = 0;
		for (const index of fresh) {
			state[index] = true;
			const delay = delayOf(index);
			longest = Math.max(longest, delay);
			animatePop(index, delay);
			if (audio) playPop(audio, delay / 1000, ripple === undefined ? 1 : 0.7);
		}
		lastPoppedRef.current = fresh[fresh.length - 1] ?? 0;
		commit();
		for (const index of fresh) handlePop?.(index);

		const now = performance.now();
		if (
			cue &&
			hapticsOn &&
			!silent() &&
			now - lastHapticAtRef.current >= CUE_THROTTLE_MS
		) {
			lastHapticAtRef.current = now;
			void haptic("light");
		}

		const after = before - fresh.length;
		announceAfter(before, after);
		if (after > 0 || clearedRef.current) return;
		clearedRef.current = true;
		latest.current.onClear?.();
		if (cue && !silent()) {
			window.clearTimeout(flourishTimerRef.current);
			flourishTimerRef.current = window.setTimeout(() => {
				if (latest.current.sound) playToggle(false);
				if (latest.current.haptics) void haptic("medium");
			}, longest + FLOURISH_DELAY_MS);
		}
		scheduleAutoReset(longest + AUTO_RESET_MS);
	};

	/** Re-inflates popped bubbles, and restarts any ripple still running. Silent. */
	const resetSheet = (origin: number, announce: boolean) => {
		window.clearTimeout(resetTimerRef.current);
		window.clearTimeout(flourishTimerRef.current);
		resetTimerRef.current = undefined;
		const state = poppedRef.current;
		const targets: number[] = [];
		for (let index = 0; index < count; index++) {
			if (state[index] || inflatingRef.current.has(index)) targets.push(index);
		}
		clearedRef.current = false;
		if (!targets.length) return;
		const wasPopped = state.some(Boolean);
		poppedRef.current = Array(count).fill(false);
		for (const index of targets)
			animateInflate(index, rippleDelay(index, origin));
		commit();
		if (announce && wasPopped) setAnnouncement("New sheet");
	};

	const popAll = (origin: number, cue: boolean) => {
		const all = Array.from({ length: count }, (_, index) => index);
		pop(all, { cue, ripple: origin });
	};

	const resetRef = useRef(resetSheet);
	const popAllRef = useRef(popAll);
	useLayoutEffect(() => {
		resetRef.current = resetSheet;
		popAllRef.current = popAll;
	});

	useImperativeHandle(ref, () => ({
		reset: () => resetRef.current(lastPoppedRef.current, true),
		popAll: () => popAllRef.current(0, false),
	}));

	// Turning autoReset on while the sheet is clear refills it after the pause.
	useEffect(() => {
		if (!autoReset) window.clearTimeout(resetTimerRef.current);
		else if (clearedRef.current && resetTimerRef.current === undefined) {
			resetTimerRef.current = window.setTimeout(() => {
				resetTimerRef.current = undefined;
				resetRef.current(lastPoppedRef.current, true);
			}, AUTO_RESET_MS);
		}
	}, [autoReset]);

	const endSweep = () => {
		const sweep = sweepRef.current;
		if (!sweep) return;
		sweepRef.current = null;
		const grid = gridRef.current;
		if (grid?.hasPointerCapture(sweep.pointerId)) {
			grid.releasePointerCapture(sweep.pointerId);
		}
		if (rootRef.current) delete rootRef.current.dataset.sweeping;
	};

	// iOS can still scroll the page under a captured pointer; block it mid-sweep.
	useEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;
		const onTouchMove = (event: TouchEvent) => {
			if (sweepRef.current) event.preventDefault();
		};
		grid.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => grid.removeEventListener("touchmove", onTouchMove);
	}, []);

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		// One finger sweeps; a second one, or a right click, is ignored.
		if (!event.isPrimary || sweepRef.current) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const grid = gridRef.current;
		if (!grid) return;
		const rect = grid.getBoundingClientRect();
		const centers: Sweep["centers"] = [];
		let radius = 0;
		for (let index = 0; index < count; index++) {
			const cell = cellsRef.current[index]?.getBoundingClientRect();
			if (!cell) {
				centers.push({ x: Number.NaN, y: Number.NaN });
				continue;
			}
			centers.push({
				x: cell.left + cell.width / 2 - rect.left,
				y: cell.top + cell.height / 2 - rect.top,
			});
			radius = Math.max(radius, (cell.width / 2) * HIT_REACH);
		}
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		sweepRef.current = { pointerId: event.pointerId, x, y, centers, radius };
		grid.setPointerCapture(event.pointerId);
		if (rootRef.current) rootRef.current.dataset.sweeping = "";
		// Create the audio context inside the gesture so the first pop can play.
		if (latest.current.sound) getPopAudio();
		// A press anywhere on a bubble's square pops it.
		const target = (event.target as Element).closest<HTMLElement>(
			"[data-bubble-index]",
		);
		const index = target ? Number(target.dataset.bubbleIndex) : -1;
		if (index >= 0) pop([index], { cue: true });
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const sweep = sweepRef.current;
		if (!sweep || event.pointerId !== sweep.pointerId) return;
		const grid = gridRef.current;
		const root = rootRef.current;
		if (!grid || !root) return;
		const rect = grid.getBoundingClientRect();
		const native = event.nativeEvent;
		const coalesced = native.getCoalescedEvents?.() ?? [];
		const points = coalesced.length ? coalesced : [native];
		const reach = sweep.radius * sweep.radius;
		const state = poppedRef.current;
		const hits: { index: number; at: number }[] = [];
		// Test each segment between pointer samples, so fast sweeps skip nothing.
		points.forEach((point, step) => {
			const x = point.clientX - rect.left;
			const y = point.clientY - rect.top;
			sweep.centers.forEach((center, index) => {
				if (state[index] || hits.some((hit) => hit.index === index)) return;
				const hit = segmentHit(sweep.x, sweep.y, x, y, center.x, center.y);
				if (hit.distance <= reach) hits.push({ index, at: step + hit.t });
			});
			sweep.x = x;
			sweep.y = y;
		});
		if (hits.length) {
			hits.sort((a, b) => a.at - b.at);
			pop(
				hits.map((hit) => hit.index),
				{ cue: true },
			);
		}
		// Leaving the sheet ends the sweep.
		const bounds = root.getBoundingClientRect();
		if (
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom
		) {
			endSweep();
		}
	};

	const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (sweepRef.current?.pointerId !== event.pointerId) return;
		endSweep();
	};

	const focusCell = (index: number) => {
		const next = clamp(index, 0, count - 1);
		setActiveIndex(next);
		cellsRef.current[next]?.focus();
	};

	const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const target = (event.target as Element).closest<HTMLElement>(
			"[data-bubble-index]",
		);
		if (!target) return;
		const index = Number(target.dataset.bubbleIndex);
		const cols = fitColumnsRef.current;
		const moves: Record<string, number> = {
			ArrowRight: index + 1,
			ArrowLeft: index - 1,
			ArrowDown: index + cols < count ? index + cols : index,
			ArrowUp: index - cols >= 0 ? index - cols : index,
			Home: 0,
			End: count - 1,
		};
		const next = moves[event.key];
		if (next === undefined) return;
		event.preventDefault();
		focusCell(next);
	};

	const register = useRef(
		(index: number, element: HTMLButtonElement | null) => {
			cellsRef.current[index] = element;
		},
	).current;
	const activateRef = useRef((index: number) => {
		popRef.current([index], { cue: true });
	}).current;
	const popRef = useRef(pop);
	useLayoutEffect(() => {
		popRef.current = pop;
	});
	const onFocusCell = useRef((index: number) => setActiveIndex(index)).current;

	const poppedCount = popped.slice(0, count).filter(Boolean).length;
	const labelledBy =
		ariaLabelledBy ??
		(ariaLabel ? undefined : showCount ? `${titleId} ${countId}` : titleId);

	return (
		<div
			ref={rootRef}
			role="group"
			aria-label={ariaLabel}
			aria-labelledby={labelledBy}
			data-slot="bubble-wrap"
			data-tint={tint}
			data-state={poppedCount === count ? "clear" : "idle"}
			onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
				onKeyDown?.(event);
				if (!event.defaultPrevented) onGridKeyDown(event);
			}}
			style={
				{
					"--bubble-wrap-width": `${columnCount * MAX_CELL_PX + (columnCount - 1) * GAP_PX + PADDING_PX * 2 + 2}px`,
					...style,
				} as CSSProperties
			}
			className={cn(
				"group/bubble-wrap relative isolate w-full max-w-(--bubble-wrap-width) select-none rounded-[20px] bg-[linear-gradient(180deg,#ece9e4,#e1ded8)] p-3 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05),0_1px_1px_rgb(0_0_0/0.04),0_2px_4px_-1px_rgb(0_0_0/0.05),0_14px_28px_-14px_rgb(0_0_0/0.22)] [-webkit-touch-callout:none] dark:bg-[linear-gradient(180deg,#1c1c1f,#161618)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.05),0_1px_1px_rgb(0_0_0/0.4),0_14px_28px_-12px_rgb(0_0_0/0.7)]",
				surfaceVars,
				tints[tint] ?? tints.clear,
				className,
			)}
			{...props}
		>
			<span id={titleId} className="sr-only">
				Bubble wrap
			</span>

			<div className="relative">
				{/* The plastic film the bubbles are molded into, sealed to the tray at its lip. */}
				<div
					aria-hidden
					className="pointer-events-none absolute -inset-1.5 overflow-hidden rounded-[12px] bg-[linear-gradient(155deg,rgb(255_255_255/0.42),rgb(255_255_255/0.1)_38%,rgb(255_255_255/0.22)_56%,rgb(255_255_255/0.06))] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.65),0_0_0_0.5px_rgb(0_0_0/0.06),0_1px_1.5px_rgb(0_0_0/0.05)] dark:bg-[linear-gradient(155deg,rgb(255_255_255/0.06),rgb(255_255_255/0.02)_38%,rgb(255_255_255/0.04)_56%,rgb(255_255_255/0.015))] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_0.5px_rgb(0_0_0/0.5),0_1px_2px_rgb(0_0_0/0.4)]"
				>
					<div className="absolute inset-0 bg-[rgb(var(--bubble-wrap-tint)/calc(var(--bubble-wrap-tint-a)*0.45))]" />
					<div
						className="absolute inset-0 bg-size-[72px_72px] opacity-[calc(var(--bubble-wrap-grain-a)*0.35)] mix-blend-overlay"
						style={{ backgroundImage: grain }}
					/>
				</div>

				<div
					ref={gridRef}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerEnd}
					onPointerCancel={onPointerEnd}
					onLostPointerCapture={onPointerEnd}
					className="relative grid touch-none"
					style={{
						gap: GAP_PX,
						gridTemplateColumns: `repeat(${fitColumns}, minmax(0, 1fr))`,
					}}
				>
					{Array.from({ length: count }, (_, index) => (
						<Bubble
							key={index}
							index={index}
							count={count}
							popped={Boolean(popped[index])}
							focusable={index === Math.min(activeIndex, count - 1)}
							register={register}
							onActivate={activateRef}
							onFocusCell={onFocusCell}
						/>
					))}
				</div>
			</div>

			{showCount ? (
				<p
					id={countId}
					className="mt-3 text-center text-muted-foreground text-xs tabular-nums"
				>
					{poppedCount} of {count} popped
				</p>
			) : null}

			<button
				type="button"
				onClick={() => popAll(Math.min(activeIndex, count - 1), true)}
				className="pointer-events-none absolute bottom-3 left-1/2 z-20 inline-flex h-7 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-background px-3 font-medium text-foreground text-xs opacity-0 shadow-[0_1px_2px_rgb(0_0_0/0.12),0_4px_12px_-4px_rgb(0_0_0/0.25)] outline-none focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#18181b] group-data-sweeping/bubble-wrap:invisible"
			>
				Pop all
			</button>

			<span role="status" aria-live="polite" className="sr-only">
				{announcement}
			</span>
		</div>
	);
}
