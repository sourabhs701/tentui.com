"use client";

import { useReducedMotion } from "motion/react";
import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Fixed physics step, in seconds, so every frame rate gives the same swing. */
const SUB_STEP = 1 / 120;
/** Longest frame the loop will integrate, in seconds; longer gaps are dropped. */
const MAX_FRAME = 0.05;
/** Gravity in px/s², tuned so a 100 px pendulum swings about once a second. */
const GRAVITY = 3200;
/** A tube is at rest below this angle (deg) and angular speed (deg/s). */
const REST_ANGLE = 0.1;
const REST_VELOCITY = 0.05;
/** Widest swing, in degrees, with and without reduced motion. */
const MAX_SWING = 35;
const MAX_SWING_REDUCED = 6;
/** Damping, per second, under reduced motion: a strike is a quick twitch. */
const DAMPING_REDUCED = 14;
/** Swing, as a fraction of `MAX_SWING`, that a full-strength strike gives. */
const STRIKE_SWING = 0.8;
/** A tube ignores new strikes for this many ms. */
const COOLDOWN_MS = 130;
/** Pointer samples older than this many ms give a tap-strength strike. */
const STALE_SAMPLE_MS = 80;
/** Pointer speed, in px/ms, that strikes at full strength. */
const FULL_SPEED = 2.2;
/** Softest pointer strike, 0 to 1. */
const MIN_VELOCITY = 0.15;
/** Strength of a tap, click, or key press. */
const TAP_VELOCITY = 0.5;
/** Coupled pushes weaker than this are dropped, which ends a ripple. */
const MIN_COUPLED = 0.03;
/** Time, in ms, for a swing to reach its neighbour: quicker for a harder hit. */
const COUPLE_DELAY_MS = [60, 130] as const;
/** Minimum ms between haptics across the whole row. */
const HAPTIC_THROTTLE_MS = 45;
/** Quiet time, in ms, before the last strike is announced. */
const ANNOUNCE_DELAY_MS = 350;
/** Idle sway amplitude, in degrees, and the seconds it takes to fade in. */
const SWAY_DEG = 0.45;
const SWAY_FADE_IN = 1.5;
/** Angular acceleration, in rad/s², from a full gust at `windStrength` 1. */
const WIND_TORQUE = 2.2;
/** The clapper swings this much more than the average tube. */
const CLAPPER_GAIN = 1.3;

const sizes = {
	sm: { spacing: 40, tube: 10, length: 100, thread: 14, beam: 3, ring: 22 },
	md: { spacing: 52, tube: 14, length: 136, thread: 18, beam: 4, ring: 28 },
	lg: { spacing: 64, tube: 18, length: 172, thread: 22, beam: 5, ring: 34 },
} as const;

const scales = {
	pentatonic: [0, 2, 4, 7, 9],
	hirajoshi: [0, 2, 3, 7, 8],
	"whole-tone": [0, 2, 4, 6, 8, 10],
	major: [0, 2, 4, 5, 7, 9, 11],
} as const;

/** Named scales spread the row across about 1.5 octaves. */
const NAMED_SCALE_SPAN = 19;

const NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
];
const NOTE_BASE: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};
const DEFAULT_ROOT = 60;

type Material = "metal" | "bamboo" | "glass";
export type WindChimesScale = keyof typeof scales | number[];
export type WindChimesStrikeSource = "pointer" | "keyboard" | "wind";

export interface WindChimesStrike {
	/** Tube index, 0 is the longest tube on the left. */
	index: number;
	/** Note name with octave, like `"E4"`. */
	note: string;
	/** Strike strength, 0 to 1. */
	velocity: number;
	source: WindChimesStrikeSource;
}

export interface WindChimesProps {
	/** Number of tubes, 3 to 9. */
	count?: number;
	/** A named scale, or semitone offsets from `root` repeated up the octaves. */
	scale?: WindChimesScale;
	/** Lowest note, with octave, like `"C4"` or `"F#3"`. Invalid values fall back to C4. */
	root?: string;
	/** Sets the ring, the tail length, and the tube look. */
	material?: Material;
	/** Let gusts sway and ring the tubes on their own. Off under reduced motion. */
	wind?: boolean;
	/** How hard and how often the wind blows, 0 to 1. */
	windStrength?: number;
	/** How much a swinging tube pushes the next one, 0 to 0.5. */
	coupling?: number;
	/** A barely visible, silent idle sway. Off under reduced motion. */
	sway?: boolean;
	/** Add a short, low-passed echo tail. */
	reverb?: boolean;
	/** Play a synthesized note per strike. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Output level, 0 to 1. */
	volume?: number;
	/** Show note names under the tubes. */
	showNotes?: boolean;
	/** Announce the note of the last strike to screen readers. */
	announce?: boolean;
	size?: keyof typeof sizes;
	onStrike?: (strike: WindChimesStrike) => void;
	"aria-label"?: string;
	className?: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function finiteOr(value: number | undefined, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseRoot(root: string) {
	const match = /^\s*([A-Ga-g])([#b♯♭]?)(-?\d)\s*$/.exec(root);
	if (!match) return DEFAULT_ROOT;
	const [, letter, accidental, octave] = match;
	const shift =
		accidental === "#" || accidental === "♯" ? 1 : accidental ? -1 : 0;
	const midi =
		12 * (Number(octave) + 1) + (NOTE_BASE[letter.toUpperCase()] ?? 0) + shift;
	return clamp(midi, 12, 108);
}

function noteName(midi: number) {
	return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function midiToFrequency(midi: number) {
	return 440 * 2 ** ((midi - 69) / 12);
}

/** Semitone offsets from the root for each tube, lowest first. */
function tubeOffsets(scale: WindChimesScale, count: number) {
	if (Array.isArray(scale)) {
		const steps = [
			...new Set(scale.filter(Number.isFinite).map((step) => Math.round(step))),
		].sort((a, b) => a - b);
		if (steps.length) {
			const first = steps[0] ?? 0;
			const last = steps[steps.length - 1] ?? 0;
			// Repeat by whole octaves, wide enough to clear the custom range.
			const period = Math.max(12, Math.ceil((last - first + 1) / 12) * 12);
			return Array.from(
				{ length: count },
				(_, index) =>
					(steps[index % steps.length] ?? 0) +
					period * Math.floor(index / steps.length),
			);
		}
	}
	const steps: readonly number[] = Array.isArray(scale)
		? scales.pentatonic
		: (scales[scale] ?? scales.pentatonic);
	const pool: number[] = [];
	for (let octave = 0; ; octave++) {
		for (const step of steps) {
			const offset = step + 12 * octave;
			// Past the span only while the row still needs more notes.
			if (offset <= NAMED_SCALE_SPAN || pool.length < count) pool.push(offset);
		}
		if (12 * (octave + 1) > NAMED_SCALE_SPAN && pool.length >= count) break;
	}
	const span = pool.length - 1;
	// Spread the tubes evenly over the pool so the row covers the whole span.
	return Array.from(
		{ length: count },
		(_, index) => pool[Math.round((index * span) / (count - 1))] ?? 0,
	);
}

// ---------------------------------------------------------------------------
// Synth: one shared AudioContext, additive struck-metal voices, no audio files.
// ---------------------------------------------------------------------------

/** Inharmonic partials of a struck tube. */
const PARTIALS = [1, 2.76, 5.4, 8.93, 13.34];
/** Most voices allowed at once across every instance on the page. */
const MAX_VOICES = 12;
/** Seconds a voice takes to fade out when cut short. */
const RELEASE = 0.03;
const REVERB_MIX = 0.12;

const materials = {
	metal: {
		gains: [1, 0.55, 0.38, 0.22, 0.12],
		decays: [2.5, 1.6, 0.9, 0.5, 0.3],
		tick: 0.16,
		tickRatio: 4,
		octave: 0,
		damping: 1.8,
	},
	bamboo: {
		gains: [1, 0.3, 0.12, 0.05, 0.02],
		decays: [0.5, 0.22, 0.12, 0.07, 0.04],
		tick: 0.45,
		tickRatio: 1.5,
		octave: 0,
		damping: 2.6,
	},
	glass: {
		gains: [1, 0.2, 0.08, 0.03, 0.015],
		decays: [3, 1.2, 0.6, 0.3, 0.15],
		tick: 0.08,
		tickRatio: 6,
		octave: 1,
		damping: 1.6,
	},
} as const;

interface ChimeAudio {
	ctx: AudioContext;
	/** Dry input: a compressor in front of the master gain. */
	input: AudioNode;
	/** Echo send: a low-passed feedback delay into the compressor. */
	send: AudioNode;
}

interface Voice {
	owner: object;
	tube: number;
	ctx: AudioContext;
	output: GainNode;
	sources: AudioScheduledSourceNode[];
	released: boolean;
}

let sharedAudio: ChimeAudio | null = null;
let audioUnavailable = false;
const voices: Voice[] = [];

/** Creates the shared context on first use. Call only from a user gesture. */
function getChimeAudio() {
	if (sharedAudio || audioUnavailable || typeof window === "undefined") {
		return sharedAudio;
	}
	const Context =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!Context) {
		audioUnavailable = true;
		return null;
	}
	try {
		const ctx = new Context();
		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -18;
		compressor.knee.value = 12;
		compressor.ratio.value = 6;
		compressor.attack.value = 0.003;
		compressor.release.value = 0.2;
		const master = ctx.createGain();
		master.gain.value = 0.9;
		compressor.connect(master).connect(ctx.destination);

		const delay = ctx.createDelay(0.5);
		delay.delayTime.value = 0.09;
		const tone = ctx.createBiquadFilter();
		tone.type = "lowpass";
		tone.frequency.value = 2800;
		const feedback = ctx.createGain();
		feedback.gain.value = 0.25;
		delay.connect(tone);
		tone.connect(feedback).connect(delay);
		tone.connect(compressor);

		sharedAudio = { ctx, input: compressor, send: delay };
	} catch {
		audioUnavailable = true;
	}
	return sharedAudio;
}

/** Resumes the shared context. Must run inside a gesture handler on iOS. */
function unlockChimeAudio() {
	const audio = getChimeAudio();
	if (audio && audio.ctx.state !== "running") {
		audio.ctx.resume().catch(() => {});
	}
}

function removeVoice(voice: Voice) {
	const index = voices.indexOf(voice);
	if (index !== -1) voices.splice(index, 1);
	for (const source of voice.sources) source.disconnect();
	voice.output.disconnect();
}

function releaseVoice(voice: Voice, seconds = RELEASE) {
	if (voice.released) return;
	voice.released = true;
	const now = voice.ctx.currentTime;
	voice.output.gain.setValueAtTime(1, now);
	voice.output.gain.linearRampToValueAtTime(0, now + seconds);
	for (const source of voice.sources) {
		try {
			source.stop(now + seconds + 0.01);
		} catch {
			// Already stopped.
		}
	}
}

function releaseVoices(owner: object, tube?: number) {
	for (const voice of voices) {
		if (voice.owner === owner && (tube === undefined || voice.tube === tube)) {
			releaseVoice(voice);
		}
	}
}

function playChime(
	audio: ChimeAudio,
	destination: AudioNode,
	options: {
		owner: object;
		tube: number;
		frequency: number;
		velocity: number;
		material: Material;
	},
) {
	const { ctx } = audio;
	const { owner, tube, velocity } = options;
	const voice = materials[options.material];

	// A tube that is still ringing fades out first so notes don't pile up.
	let start = ctx.currentTime;
	for (const live of voices) {
		if (live.owner === owner && live.tube === tube && !live.released) {
			releaseVoice(live);
			start = ctx.currentTime + RELEASE;
		}
	}
	// The cap is shared by every instance; the oldest voices give way.
	const live = voices.filter((candidate) => !candidate.released);
	for (let index = 0; index <= live.length - MAX_VOICES; index++) {
		const oldest = live[index];
		if (oldest) releaseVoice(oldest);
	}

	const output = ctx.createGain();
	output.connect(destination);
	const sources: AudioScheduledSourceNode[] = [];
	const peak = 0.6 * velocity * velocity;
	const brightness = 0.35 + 0.65 * velocity;
	const total = voice.gains.reduce((sum, gain) => sum + gain, 0);
	const ceiling = Math.min(16000, ctx.sampleRate * 0.45);
	let end = start;

	PARTIALS.forEach((ratio, index) => {
		const frequency = options.frequency * ratio;
		if (frequency > ceiling) return;
		const level =
			(peak * (voice.gains[index] ?? 0) * (index ? brightness : 1)) / total;
		const decay = voice.decays[index] ?? 0.2;
		const oscillator = ctx.createOscillator();
		oscillator.type = "sine";
		oscillator.frequency.value = frequency;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.linearRampToValueAtTime(Math.max(level, 0.0001), start + 0.002);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.002 + decay);
		oscillator.connect(gain).connect(output);
		oscillator.start(start);
		oscillator.stop(start + decay + 0.05);
		end = Math.max(end, start + decay + 0.05);
		sources.push(oscillator);
	});

	// A few ms of triangle wave gives the strike its transient.
	const tick = ctx.createOscillator();
	tick.type = "triangle";
	tick.frequency.value = Math.min(options.frequency * voice.tickRatio, 8000);
	const tickGain = ctx.createGain();
	tickGain.gain.setValueAtTime(0.0001, start);
	tickGain.gain.linearRampToValueAtTime(
		Math.max(peak * voice.tick * brightness, 0.0001),
		start + 0.0005,
	);
	tickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.007);
	tick.connect(tickGain).connect(output);
	tick.start(start);
	tick.stop(start + 0.01);
	sources.push(tick);

	const entry: Voice = {
		owner,
		tube,
		ctx,
		output,
		sources,
		released: false,
	};
	let ended = 0;
	for (const source of sources) {
		source.onended = () => {
			ended++;
			if (ended === sources.length) removeVoice(entry);
		};
	}
	voices.push(entry);
	return end;
}

// ---------------------------------------------------------------------------
// Simulation: one rAF loop, damped pendulums, written straight to transforms.
// ---------------------------------------------------------------------------

interface Tube {
	/** Radians; positive swings the bottom to the right. */
	angle: number;
	/** Radians per second. */
	velocity: number;
	lastStrikeAt: number;
}

interface CoupledPush {
	index: number;
	velocity: number;
	direction: 1 | -1;
	source: WindChimesStrikeSource;
	at: number;
}

interface SimulationOptions {
	/** Pivot to centre of mass, in px, per tube. */
	lengths: number[];
	damping: number;
	maxSwing: number;
	/** Wind blows: on, unpaused, visible, and motion allowed. */
	windActive: boolean;
	windStrength: number;
	swayActive: boolean;
	/** Called from the loop when a gust or a neighbour strikes a tube. */
	onLoopStrike: (push: Omit<CoupledPush, "at">, coupled: boolean) => void;
}

const restTube = (): Tube => ({
	angle: 0,
	velocity: 0,
	lastStrikeAt: Number.NEGATIVE_INFINITY,
});

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function useChimeSimulation(
	options: SimulationOptions,
	pendulumRefs: RefObject<(HTMLElement | null)[]>,
	clapperRef: RefObject<HTMLElement | null>,
) {
	const optionsRef = useRef(options);
	const tubesRef = useRef<Tube[]>([]);
	const pushesRef = useRef<CoupledPush[]>([]);
	const frameRef = useRef(0);
	const loopRef = useRef({
		last: null as number | null,
		accumulator: 0,
		time: 0,
		swayTime: 0,
		gust: 0,
		clapper: 0,
	});

	useLayoutEffect(() => {
		optionsRef.current = options;
		const tubes = tubesRef.current;
		// New tubes start at rest; existing ones keep swinging.
		while (tubes.length < options.lengths.length) tubes.push(restTube());
		tubes.length = options.lengths.length;
	});

	const render = useCallback(() => {
		const { swayActive } = optionsRef.current;
		const loop = loopRef.current;
		const swayRamp = swayActive ? Math.min(loop.swayTime / SWAY_FADE_IN, 1) : 0;
		let sum = 0;
		tubesRef.current.forEach((tube, index) => {
			const sway =
				swayRamp *
				SWAY_DEG *
				Math.sin(loop.swayTime * (1.7 + index * 0.13) + index * 0.9);
			const degrees = toDegrees(tube.angle) + sway;
			sum += degrees;
			const element = pendulumRefs.current[index];
			// CSS turns clockwise, which swings the bottom left.
			if (element) element.style.transform = `rotate(${-degrees}deg)`;
		});
		const clapper = clapperRef.current;
		if (clapper) {
			clapper.style.transform = `rotate(${-loop.clapper}deg)`;
		}
		return tubesRef.current.length ? sum / tubesRef.current.length : 0;
	}, [pendulumRefs, clapperRef]);

	const step = useCallback(
		(timestamp: number) => {
			// Marks the loop as running so strikes inside it don't queue a second frame.
			frameRef.current = -1;
			const options = optionsRef.current;
			const loop = loopRef.current;
			const tubes = tubesRef.current;
			const dt =
				loop.last === null
					? 0
					: Math.min((timestamp - loop.last) / 1000, MAX_FRAME);
			loop.last = timestamp;

			// Neighbour pushes that are due.
			const now = performance.now();
			const due = pushesRef.current.filter((push) => push.at <= now);
			if (due.length) {
				pushesRef.current = pushesRef.current.filter((push) => push.at > now);
				for (const push of due) options.onLoopStrike(push, true);
			}

			let windTorque = 0;
			if (options.windActive && dt > 0) {
				// Two slow sines and a random walk make a gust that rises and falls.
				loop.gust = clamp(
					loop.gust * 0.995 + (Math.random() - 0.5) * 0.6 * dt,
					-0.35,
					0.35,
				);
				const gust = clamp(
					0.45 +
						0.3 * Math.sin(loop.time * 2 * Math.PI * 0.05) +
						0.25 * Math.sin(loop.time * 2 * Math.PI * 0.13 + 1.7) +
						loop.gust,
					0,
					1,
				);
				windTorque = options.windStrength * gust * WIND_TORQUE;
				// Strong gusts knock a tube now and then.
				const rate = options.windStrength * Math.max(gust - 0.4, 0) * 3;
				if (tubes.length && Math.random() < rate * dt) {
					options.onLoopStrike(
						{
							index: Math.floor(Math.random() * tubes.length),
							velocity: clamp(
								options.windStrength * gust * (0.3 + 0.5 * Math.random()),
								0.1,
								0.8,
							),
							direction: Math.random() < 0.75 ? 1 : -1,
							source: "wind",
						},
						false,
					);
				}
			}

			const maxAngle = toRadians(options.maxSwing);
			loop.accumulator += dt;
			while (loop.accumulator >= SUB_STEP) {
				loop.accumulator -= SUB_STEP;
				loop.time += SUB_STEP;
				tubes.forEach((tube, index) => {
					const length = options.lengths[index] ?? 100;
					const gustShare = windTorque
						? windTorque * (0.75 + 0.25 * Math.sin(loop.time * 0.9 + index))
						: 0;
					const acceleration =
						-(GRAVITY / length) * Math.sin(tube.angle) -
						options.damping * tube.velocity +
						gustShare;
					// Semi-implicit Euler stays stable at this step size.
					tube.velocity += acceleration * SUB_STEP;
					tube.angle += tube.velocity * SUB_STEP;
					if (Math.abs(tube.angle) > maxAngle) {
						tube.angle = Math.sign(tube.angle) * maxAngle;
						if (Math.sign(tube.velocity) === Math.sign(tube.angle)) {
							tube.velocity = 0;
						}
					}
				});
			}
			if (options.swayActive) loop.swayTime += dt;

			let resting = !options.windActive && !options.swayActive;
			for (const tube of tubes) {
				if (
					Math.abs(toDegrees(tube.angle)) < REST_ANGLE &&
					Math.abs(toDegrees(tube.velocity)) < REST_VELOCITY
				) {
					tube.angle = 0;
					tube.velocity = 0;
				} else {
					resting = false;
				}
			}
			if (!options.swayActive) loop.swayTime = 0;

			const average = render();
			// The clapper trails the row and swings a little wider.
			const target = clamp(
				average * CLAPPER_GAIN,
				-options.maxSwing,
				options.maxSwing,
			);
			loop.clapper += (target - loop.clapper) * (1 - Math.exp(-dt * 10));
			if (Math.abs(loop.clapper) < REST_ANGLE && target === 0) {
				loop.clapper = 0;
			} else {
				resting = false;
			}

			if (resting && pushesRef.current.length === 0) {
				// Asleep until the next strike, gust, or sway wakes it.
				frameRef.current = 0;
				loop.last = null;
				loop.accumulator = 0;
				return;
			}
			frameRef.current = requestAnimationFrame(step);
		},
		[render],
	);

	const wake = useCallback(() => {
		if (frameRef.current || typeof window === "undefined") return;
		if (document.visibilityState === "hidden") return;
		frameRef.current = requestAnimationFrame(step);
	}, [step]);

	const sleep = useCallback(() => {
		if (frameRef.current > 0) cancelAnimationFrame(frameRef.current);
		frameRef.current = 0;
		loopRef.current.last = null;
		loopRef.current.accumulator = 0;
	}, []);

	/** Back to rest with nothing queued, so a returning tab can't burst. */
	const reset = useCallback(() => {
		for (const tube of tubesRef.current) {
			tube.angle = 0;
			tube.velocity = 0;
		}
		pushesRef.current = [];
		loopRef.current.clapper = 0;
		loopRef.current.gust = 0;
		render();
	}, [render]);

	/** Adds angular velocity, capped so the swing stays inside `maxSwing`. */
	const kick = useCallback((index: number, deltaVelocity: number) => {
		const tube = tubesRef.current[index];
		const length = optionsRef.current.lengths[index];
		if (!tube || !length) return;
		const omega = Math.sqrt(GRAVITY / length);
		const maxAngle = toRadians(optionsRef.current.maxSwing);
		tube.velocity += deltaVelocity;
		const amplitude = Math.hypot(tube.angle, tube.velocity / omega);
		if (amplitude > maxAngle && Math.abs(tube.angle) < maxAngle) {
			const room = Math.sqrt(maxAngle ** 2 - tube.angle ** 2);
			tube.velocity = Math.sign(tube.velocity) * room * omega;
		}
	}, []);

	const schedule = useCallback((push: CoupledPush) => {
		pushesRef.current.push(push);
	}, []);

	useEffect(() => sleep, [sleep]);

	return { tubesRef, wake, sleep, reset, kick, schedule };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StrikeHandler = (
	index: number,
	velocity: number,
	direction: 1 | -1,
	source: WindChimesStrikeSource,
	coupled?: boolean,
	strikeY?: number,
) => void;

const tubeLook: Record<Material, string> = {
	metal: "bg-muted-foreground",
	bamboo: "bg-foreground/75",
	glass: "border border-foreground/50 bg-foreground/10",
};

function TubeHighlight({ material }: { material: Material }) {
	if (material === "bamboo") {
		// Bamboo nodes.
		return (
			<>
				<span className="absolute inset-x-0 top-1/3 h-px bg-background/50" />
				<span className="absolute inset-x-0 top-2/3 h-px bg-background/50" />
			</>
		);
	}
	return (
		<span
			className={cn(
				"absolute inset-y-[7%] left-1/4 rounded-full",
				material === "glass"
					? "w-px bg-foreground/45"
					: "w-[max(1px,18%)] bg-background/40",
			)}
		/>
	);
}

export function WindChimes({
	count: countProp = 5,
	scale = "pentatonic",
	root = "C4",
	material = "metal",
	wind = false,
	windStrength = 0.4,
	coupling = 0.25,
	sway = false,
	reverb = true,
	sound = true,
	haptics = true,
	volume = 0.6,
	showNotes = false,
	announce = false,
	size = "md",
	onStrike,
	"aria-label": ariaLabel = "Wind chimes",
	className,
}: WindChimesProps) {
	const count = clamp(Math.round(finiteOr(countProp, 5)), 3, 9);
	const sizeStyle = sizes[size] ?? sizes.md;
	const look = materials[material] ? material : "metal";
	const lowest = parseRoot(root) + 12 * materials[look].octave;
	const midis = tubeOffsets(scale, count).map((offset) => lowest + offset);
	const notes = midis.map(noteName);
	// A tube's pitch falls with the square root of its length.
	const tubeLengths = midis.map((midi) =>
		Math.round(
			sizeStyle.length *
				Math.max(2 ** (-(midi - (midis[0] ?? midi)) / 24), 0.4),
		),
	);
	const stageHeight = sizeStyle.beam + sizeStyle.thread + sizeStyle.length + 20;

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const [windPaused, setWindPaused] = useState(false);
	const [focusIndex, setFocusIndex] = useState(0);
	const activeIndex = Math.min(focusIndex, count - 1);
	const [inView, setInView] = useState(true);
	const [pageVisible, setPageVisible] = useState(true);
	// The server can't know the motion preference, so markup waits for mount.
	const [mounted, setMounted] = useState(false);

	const windOn = wind && !shouldReduceMotion;
	const windActive = windOn && !windPaused && inView && pageVisible;
	const swayActive = sway && !shouldReduceMotion && inView && pageVisible;
	const stageRef = useRef<HTMLDivElement>(null);
	const pendulumRefs = useRef<(HTMLElement | null)[]>([]);
	const bodyRefs = useRef<(HTMLElement | null)[]>([]);
	const ringRefs = useRef<(HTMLElement | null)[]>([]);
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const clapperRef = useRef<HTMLDivElement>(null);
	const liveRef = useRef<HTMLSpanElement>(null);
	const ownerRef = useRef({});
	const outputRef = useRef<{ dry: GainNode; wet: GainNode } | null>(null);
	const inViewRef = useRef(true);
	const lastHapticAtRef = useRef(Number.NEGATIVE_INFINITY);
	const announceFlipRef = useRef(false);
	const announceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const sampleRef = useRef<{ x: number; t: number } | null>(null);
	const keyDirectionRef = useRef<1 | -1>(1);

	const strikeRef = useRef<StrikeHandler>(() => {});

	const simulation = useChimeSimulation(
		{
			lengths: tubeLengths.map((length) => sizeStyle.thread + length / 2),
			damping: shouldReduceMotion ? DAMPING_REDUCED : materials[look].damping,
			maxSwing: shouldReduceMotion ? MAX_SWING_REDUCED : MAX_SWING,
			windActive,
			windStrength: clamp(finiteOr(windStrength, 0.4), 0, 1),
			swayActive,
			onLoopStrike: (push, coupled) =>
				strikeRef.current(
					push.index,
					push.velocity,
					push.direction,
					push.source,
					coupled,
				),
		},
		pendulumRefs,
		clapperRef,
	);
	const { wake, sleep, reset, kick, schedule } = simulation;

	const silent = () =>
		typeof document === "undefined" ||
		document.visibilityState === "hidden" ||
		!inViewRef.current;

	/** This instance's gain and echo send, built on the first audible strike. */
	const getOutput = () => {
		const audio = getChimeAudio();
		if (!audio) return null;
		if (!outputRef.current) {
			const dry = audio.ctx.createGain();
			const wet = audio.ctx.createGain();
			dry.connect(audio.input);
			dry.connect(wet).connect(audio.send);
			outputRef.current = { dry, wet };
		}
		const { dry, wet } = outputRef.current;
		dry.gain.value = clamp(finiteOr(volume, 0.6), 0, 1);
		wet.gain.value = reverb ? REVERB_MIX : 0;
		return { audio, dry };
	};

	const pulse = (index: number, strikeY?: number) => {
		const body = bodyRefs.current[index];
		const ring = ringRefs.current[index];
		if (typeof body?.animate === "function") {
			body.animate([{ opacity: 0.7 }, { opacity: 1 }], {
				duration: 120,
				easing: "ease-out",
			});
		}
		if (shouldReduceMotion || typeof ring?.animate !== "function") return;
		const length = tubeLengths[index] ?? 0;
		const y = clamp(strikeY ?? length * 0.6, 0, length);
		ring.animate(
			[
				{ opacity: 0.25, transform: `translateY(${y}px) scale(1)` },
				{ opacity: 0, transform: `translateY(${y}px) scale(1.4)` },
			],
			{ duration: 400, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
		);
	};

	useLayoutEffect(() => {
		strikeRef.current = (
			index,
			velocity,
			direction,
			source,
			coupled,
			strikeY,
		) => {
			const tube = simulation.tubesRef.current[index];
			const length = tubeLengths[index];
			if (!tube || length === undefined) return;
			const omega = Math.sqrt(GRAVITY / (sizeStyle.thread + length / 2));
			const maxSwing = shouldReduceMotion ? MAX_SWING_REDUCED : MAX_SWING;
			const impulse =
				direction * velocity * STRIKE_SWING * toRadians(maxSwing) * omega;
			const now = performance.now();
			if (now - tube.lastStrikeAt < COOLDOWN_MS) {
				// Inside the cooldown a neighbour can still nudge, but not ring.
				if (coupled) {
					kick(index, impulse);
					wake();
				}
				return;
			}
			tube.lastStrikeAt = now;
			kick(index, impulse);
			pulse(index, strikeY);

			const note = notes[index] ?? "";
			const muted = silent();
			if (sound && !muted) {
				const output = getOutput();
				if (output && output.audio.ctx.state === "running") {
					// ±0.6% detune so repeats aren't identical.
					const detune = 1 + (Math.random() * 2 - 1) * 0.006;
					playChime(output.audio, output.dry, {
						owner: ownerRef.current,
						tube: index,
						frequency: midiToFrequency(midis[index] ?? DEFAULT_ROOT) * detune,
						velocity,
						material: look,
					});
				}
			}
			if (haptics && !coupled && source !== "wind" && !muted) {
				if (now - lastHapticAtRef.current >= HAPTIC_THROTTLE_MS) {
					lastHapticAtRef.current = now;
					void haptic(
						velocity < 0.35 ? "soft" : velocity < 0.7 ? "selection" : "medium",
					);
				}
			}
			if (announce && !coupled && source !== "wind") {
				clearTimeout(announceTimerRef.current);
				announceTimerRef.current = setTimeout(() => {
					// A trailing space toggles so the same note is announced again.
					announceFlipRef.current = !announceFlipRef.current;
					if (liveRef.current) {
						liveRef.current.textContent = `${note}${announceFlipRef.current ? "\u00a0" : ""}`;
					}
				}, ANNOUNCE_DELAY_MS);
			}
			onStrike?.({ index, note, velocity, source });

			// The swing reaches the next tube in the direction of travel.
			const push = velocity * clamp(finiteOr(coupling, 0.25), 0, 0.5);
			const next = index + direction;
			if (push >= MIN_COUPLED && next >= 0 && next < count) {
				const [fast, slow] = COUPLE_DELAY_MS;
				schedule({
					index: next,
					velocity: push,
					direction,
					source,
					at: now + slow - (slow - fast) * velocity,
				});
			}
			wake();
		};
	});

	const strike = (
		index: number,
		velocity: number,
		direction: 1 | -1,
		source: WindChimesStrikeSource,
		strikeY?: number,
	) => strikeRef.current(index, velocity, direction, source, false, strikeY);

	useEffect(() => setMounted(true), []);

	// Wind and sway keep the loop awake; a strike wakes it otherwise.
	useEffect(() => {
		if (windActive || swayActive) wake();
	}, [windActive, swayActive, wake]);

	// Hidden tabs pause the loop and fall silent; tubes come back at rest.
	useEffect(() => {
		const owner = ownerRef.current;
		const onVisibility = () => {
			const visible = document.visibilityState !== "hidden";
			setPageVisible(visible);
			if (visible) {
				reset();
				wake();
			} else {
				sleep();
				releaseVoices(owner);
			}
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, [reset, sleep, wake]);

	// Off-screen chimes stay silent, and wind and sway stop.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(([entry]) => {
			const visible = entry?.isIntersecting ?? true;
			inViewRef.current = visible;
			setInView(visible);
		});
		observer.observe(stage);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!sound) releaseVoices(ownerRef.current);
	}, [sound]);

	// Unmount: stop this instance's voices and unhook its nodes. The shared
	// context stays open for other instances.
	useEffect(() => {
		const owner = ownerRef.current;
		return () => {
			clearTimeout(announceTimerRef.current);
			releaseVoices(owner);
			const output = outputRef.current;
			outputRef.current = null;
			if (output) {
				// Let the released voices fade before cutting the line.
				setTimeout(
					() => {
						output.dry.disconnect();
						output.wet.disconnect();
					},
					RELEASE * 1000 + 30,
				);
			}
		};
	}, []);

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		// Hovering doesn't unlock audio, but an earlier click anywhere on the page does.
		if (navigator.userActivation?.hasBeenActive) unlockChimeAudio();
		const stage = event.currentTarget;
		const rect = stage.getBoundingClientRect();
		const now = event.timeStamp || performance.now();
		const x = event.clientX - rect.left;
		const previous = sampleRef.current;
		sampleRef.current = { x, t: now };
		if (!previous || x === previous.x) return;
		const inside = event.clientY >= rect.top && event.clientY <= rect.bottom;
		if (!inside || rect.width <= 0) return;

		const elapsed = now - previous.t;
		const speed =
			elapsed > 0 && elapsed <= STALE_SAMPLE_MS
				? Math.abs(x - previous.x) / elapsed
				: 0;
		// A stale sample reads as a tap, not as a silent brush.
		const velocity =
			speed === 0 ? TAP_VELOCITY : clamp(speed / FULL_SPEED, MIN_VELOCITY, 1);
		const direction = x > previous.x ? 1 : -1;
		// Local px, so CSS zoom and transforms don't skew the strike point.
		const scale = rect.height / (stage.offsetHeight || 1) || 1;
		const strikeY =
			(event.clientY - rect.top) / scale - sizeStyle.beam - sizeStyle.thread;
		const column = rect.width / count;
		const order = Array.from({ length: count }, (_, index) =>
			direction > 0 ? index : count - 1 - index,
		);
		for (const index of order) {
			const center = (index + 0.5) * column;
			const crossed =
				(previous.x < center && x >= center) ||
				(previous.x > center && x <= center);
			if (crossed) strike(index, velocity, direction, "pointer", strikeY);
		}
	};

	const forgetPointer = () => {
		sampleRef.current = null;
	};

	const focusTube = (index: number) => {
		const next = clamp(index, 0, count - 1);
		setFocusIndex(next);
		buttonRefs.current[next]?.focus();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const index = Number(event.currentTarget.dataset.index);
		switch (event.key) {
			case "ArrowRight":
				focusTube(index + 1);
				break;
			case "ArrowLeft":
				focusTube(index - 1);
				break;
			case "Home":
				focusTube(0);
				break;
			case "End":
				focusTube(count - 1);
				break;
			case "Enter":
			case " ":
				unlockChimeAudio();
				if (!event.repeat || event.key === "Enter") {
					keyDirectionRef.current = keyDirectionRef.current === 1 ? -1 : 1;
					strike(index, TAP_VELOCITY, keyDirectionRef.current, "keyboard");
				}
				break;
			default:
				return;
		}
		event.preventDefault();
	};

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		unlockChimeAudio();
		// Keyboard activation is handled on keydown.
		if (event.detail === 0) return;
		const index = Number(event.currentTarget.dataset.index);
		const rect = event.currentTarget.getBoundingClientRect();
		// Push the tube away from the side it was tapped on.
		const direction = event.clientX < rect.left + rect.width / 2 ? 1 : -1;
		const scale = rect.height / (event.currentTarget.offsetHeight || 1) || 1;
		const strikeY =
			(event.clientY - rect.top) / scale - sizeStyle.beam - sizeStyle.thread;
		strike(index, TAP_VELOCITY, direction, "pointer", strikeY);
	};

	const midLength =
		count % 2
			? (tubeLengths[(count - 1) / 2] ?? 0)
			: ((tubeLengths[count / 2 - 1] ?? 0) + (tubeLengths[count / 2] ?? 0)) / 2;
	const clapperSize = Math.round(sizeStyle.tube * 1.3);
	const clapperThread = Math.min(
		sizeStyle.thread + midLength + 8,
		stageHeight - sizeStyle.beam - clapperSize - 2,
	);
	const beamInset = `calc(${50 / count}% - ${sizeStyle.tube}px)`;

	return (
		<div
			role="group"
			aria-label={ariaLabel}
			data-slot="wind-chimes"
			data-material={look}
			data-size={size}
			className={cn("flex w-full flex-col items-center gap-3", className)}
		>
			<div
				ref={stageRef}
				data-slot="wind-chimes-stage"
				dir="ltr"
				onPointerDown={(event) => {
					unlockChimeAudio();
					const rect = event.currentTarget.getBoundingClientRect();
					sampleRef.current = {
						x: event.clientX - rect.left,
						t: event.timeStamp || performance.now(),
					};
				}}
				onPointerMove={handlePointerMove}
				onPointerUp={unlockChimeAudio}
				onTouchEnd={unlockChimeAudio}
				onPointerLeave={forgetPointer}
				onPointerCancel={forgetPointer}
				className="relative w-full touch-pan-y select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
				style={{ maxWidth: count * sizeStyle.spacing, height: stageHeight }}
			>
				<div
					aria-hidden
					data-slot="wind-chimes-beam"
					className="pointer-events-none absolute top-0 z-10 rounded-full bg-foreground"
					style={{ left: beamInset, right: beamInset, height: sizeStyle.beam }}
				/>
				<div
					ref={clapperRef}
					aria-hidden
					data-slot="wind-chimes-clapper"
					className="pointer-events-none absolute left-1/2 flex origin-top flex-col items-center will-change-transform"
					style={{
						top: sizeStyle.beam,
						width: clapperSize,
						marginLeft: -clapperSize / 2,
					}}
				>
					<span
						className="w-px bg-muted-foreground"
						style={{ height: clapperThread }}
					/>
					<span
						className="rounded-full bg-foreground"
						style={{ width: clapperSize, height: clapperSize }}
					/>
				</div>
				<div
					className="relative grid h-full"
					style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
				>
					{notes.map((note, index) => {
						const length = tubeLengths[index] ?? sizeStyle.length;
						return (
							<button
								// Index keys keep tubes in place when `count` changes.
								key={index}
								ref={(element) => {
									buttonRefs.current[index] = element;
								}}
								type="button"
								data-index={index}
								data-slot="wind-chimes-tube"
								tabIndex={index === activeIndex ? 0 : -1}
								aria-label={`Chime ${index + 1} of ${count}${showNotes ? `, ${note}` : ""}`}
								onKeyDown={handleKeyDown}
								onClick={handleClick}
								onFocus={() => setFocusIndex(index)}
								className="group/chime relative flex h-full cursor-pointer flex-col items-center outline-none"
								style={{ paddingTop: sizeStyle.beam }}
							>
								<span
									ref={(element) => {
										pendulumRefs.current[index] = element;
									}}
									className="flex origin-top flex-col items-center will-change-transform"
									style={{ width: `min(${sizeStyle.tube}px, 45%)` }}
								>
									<span
										className="w-px bg-muted-foreground"
										style={{ height: sizeStyle.thread }}
									/>
									<span className="relative w-full" style={{ height: length }}>
										<span
											ref={(element) => {
												bodyRefs.current[index] = element;
											}}
											className={cn(
												"absolute inset-0 overflow-hidden rounded-[4px] outline-ring outline-offset-3 group-focus-visible/chime:outline-2",
												tubeLook[look],
											)}
										>
											<TubeHighlight material={look} />
										</span>
										<span
											ref={(element) => {
												ringRefs.current[index] = element;
											}}
											className="pointer-events-none absolute top-0 left-1/2 rounded-full border border-foreground opacity-0"
											style={{
												width: sizeStyle.ring,
												height: sizeStyle.ring,
												marginLeft: -sizeStyle.ring / 2,
												marginTop: -sizeStyle.ring / 2,
											}}
										/>
									</span>
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{showNotes ? (
				<div
					aria-hidden
					data-slot="wind-chimes-notes"
					className="grid w-full font-medium text-[11px] text-muted-foreground tabular-nums"
					style={{
						maxWidth: count * sizeStyle.spacing,
						gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
					}}
				>
					{notes.map((note, index) => (
						<span key={index} className="text-center">
							{note}
						</span>
					))}
				</div>
			) : null}

			{wind && (!mounted || windOn) ? (
				<button
					type="button"
					data-slot="wind-chimes-pause"
					onClick={() => setWindPaused((paused) => !paused)}
					className="rounded-md border border-border px-2.5 py-1 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					{windPaused ? "Resume wind" : "Pause wind"}
				</button>
			) : null}

			<span ref={liveRef} aria-live="polite" aria-atomic className="sr-only" />
		</div>
	);
}

export default WindChimes;
