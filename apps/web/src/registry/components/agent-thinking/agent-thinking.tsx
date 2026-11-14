"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	domAnimation,
	LazyMotion,
	m,
	useReducedMotion,
} from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Dots the cluster always has, so the mark is never empty. */
const SEEDS = 3;
const GOLDEN_ANGLE = (137.508 * Math.PI) / 180;
/** How much the cluster tightens once the agent is done. */
const SETTLED_SCALE = 0.92;
/** Opacity of the cluster left behind while the log is open. */
const GHOST_ALPHA = 0.2;
/** Bullet opacity in the log; failed steps show at full strength. */
const BULLET_ALPHA = 0.7;
/** Seconds per lap of the seeking dot. */
const ORBIT_PERIOD = 2.2;
/** Where the seeking dot starts, and where it rests with reduced motion. */
const ORBIT_START = (-50 * Math.PI) / 180;
/** Landings from the seeking dot in the air at once; the rest fade in. */
const MAX_FLIGHTS = 6;
/** Stagger, in seconds, as dots leave for and return from the log. */
const LOG_STAGGER = 0.025;
/** Minimum ms between landing sounds and haptics. */
const CUE_THROTTLE_MS = 60;
const ANNOUNCE_DEBOUNCE_MS = 1000;

/** Seeking dot size relative to the cluster dots, and its fading tail. */
const SEEKER_SCALE = 1.25;
const TAIL = [
	{ lag: 0.06, alpha: 0.35, scale: 1 },
	{ lag: 0.12, alpha: 0.18, scale: 0.85 },
	{ lag: 0.18, alpha: 0.08, scale: 0.7 },
] as const;

/** Under 4% overshoot, about 380 ms to rest. */
const LAND_SPRING = { stiffness: 290, damping: 24.5 } as const;
/** Flights to and from the log: longer, so damped harder. */
const LOG_SPRING = { stiffness: 260, damping: 29 } as const;

// A very soft tick per landing and a slightly brighter one when done.
const LAND_SOUND = {
	name: "agent-thinking-land",
	baseFreq: 1300,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 3400,
	filterQ: 2.5,
	attack: 0.001,
	decay: 0.3,
	brightness: 2600,
} as const;
const DONE_SOUND = {
	...LAND_SOUND,
	name: "agent-thinking-done",
	baseFreq: 1750,
	filterFreq: 5200,
	decay: 0.42,
	brightness: 4400,
} as const;

// Hoisted and deduplicated by React, so every instance shares one sheet.
// The sweep paints the label through a moving gradient; `currentColor` keeps
// it on the text color because only the fill is made transparent.
const STYLES =
	"@keyframes agent-thinking-sweep{from{background-position:100% 0}to{background-position:0 0}}" +
	"@keyframes agent-thinking-pulse{50%{opacity:.4}}" +
	"@keyframes agent-thinking-flash{20%,45%{color:var(--color-destructive,#e7000b)}}" +
	"[data-slot=agent-thinking] [data-sweep]{background-image:linear-gradient(90deg,currentColor 40%,color-mix(in oklab,currentColor 38%,transparent) 50%,currentColor 60%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:agent-thinking-sweep 2.4s linear infinite}" +
	"[data-slot=agent-thinking] [data-sweep]:dir(rtl){animation-direction:reverse}" +
	"[data-slot=agent-thinking] [data-pulse]{animation:agent-thinking-pulse 2.4s ease-in-out infinite}" +
	"[data-slot=agent-thinking] [data-flash]{animation:agent-thinking-flash .7s ease-out}" +
	"@media (prefers-reduced-motion:reduce){[data-slot=agent-thinking] [data-sweep]{animation:none;background:none;-webkit-text-fill-color:currentColor}}";

const sizes = {
	sm: {
		/**
		 * Mark box, dot diameter, phyllotaxis spacing, widest cluster radius,
		 * orbit gap, and wander, in px.
		 */
		mark: 20,
		dot: 2,
		spacing: 1.45,
		fit: 5.5,
		gap: 3.3,
		wander: 0.3,
		markClass: "size-5",
		gapClass: "gap-2",
		bulletClass: "w-5",
		label: "text-xs",
		timer: "text-[11px]",
		step: "min-h-6 text-xs",
	},
	md: {
		mark: 28,
		dot: 3,
		spacing: 2,
		fit: 8,
		gap: 4.6,
		wander: 0.45,
		markClass: "size-7",
		gapClass: "gap-2.5",
		bulletClass: "w-7",
		label: "text-sm",
		timer: "text-xs",
		step: "min-h-7 text-sm",
	},
} as const;

type SizeConfig = (typeof sizes)[keyof typeof sizes];

export type AgentThinkingStatus = "thinking" | "done" | "error";

export interface AgentThinkingStep {
	id: string;
	label: string;
	/** Defaults to `"done"`. The first `"active"` step is the seeking dot. */
	status?: "pending" | "active" | "done" | "error";
	/** Shown beside the step in the log. */
	durationMs?: number;
}

export interface AgentThinkingDoneInfo {
	/** From `startedAt` to `endedAt`, or the sum of step durations. */
	elapsedMs: number;
	/** Finished steps, failed ones included. */
	steps: number;
}

export interface AgentThinkingProps
	extends Omit<ComponentProps<"div">, "children"> {
	status?: AgentThinkingStatus;
	/** Agent steps in log order. Finished steps are the dots of the cluster. */
	steps?: AgentThinkingStep[];
	/** Label while thinking. */
	label?: string;
	/** Label once done. Defaults to "Thought for 14s · 6 steps". */
	doneLabel?: string | ((info: AgentThinkingDoneInfo) => string);
	/** Label when the run stops with `status="error"`. */
	errorLabel?: string;
	/** Epoch ms the run started. Defaults to mount time. */
	startedAt?: number;
	/** Epoch ms the run ended. Defaults to when `status` left `"thinking"`. */
	endedAt?: number;
	/** Ms before the elapsed timer fades in. */
	timerDelay?: number;
	showTimer?: boolean;
	/** Controlled open state of the step log. */
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Finished steps that get their own dot; more thicken the existing ones. */
	maxDots?: number;
	size?: keyof typeof sizes;
	/** `"pill"` puts the row on a soft rounded background. */
	variant?: "plain" | "pill";
	/** A soft tick per landed step and a brighter one when done. */
	sound?: boolean;
	/** A light tick per landed step and a success pattern when done, on touch devices. */
	haptics?: boolean;
	/** Set to `false` for a still cluster and fades only, like reduced motion. */
	animated?: boolean;
}

type Vec = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

/** "4s", "59s", "1m 05s", "1h 02m". */
function formatElapsed(ms: number) {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${pad(seconds % 60)}s`;
	return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

/** "14 seconds", "1 minute 5 seconds", "1 hour 2 minutes", for the announcer. */
function speakElapsed(ms: number) {
	const unit = (value: number, name: string) =>
		`${value} ${name}${value === 1 ? "" : "s"}`;
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return unit(seconds, "second");
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		const rest = seconds % 60;
		return rest
			? `${unit(minutes, "minute")} ${unit(rest, "second")}`
			: unit(minutes, "minute");
	}
	const rest = minutes % 60;
	return rest
		? `${unit(Math.floor(minutes / 60), "hour")} ${unit(rest, "minute")}`
		: unit(Math.floor(minutes / 60), "hour");
}

/** A finished run reads in whole seconds, never "0s". */
function roundElapsed(ms: number) {
	return Math.max(1, Math.round(ms / 1000)) * 1000;
}

function formatStepDuration(ms: number) {
	if (ms < 10_000) return `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
	return formatElapsed(ms);
}

function stepsWord(count: number) {
	return `${count} step${count === 1 ? "" : "s"}`;
}

function isFinished(step: AgentThinkingStep) {
	const status = step.status ?? "done";
	return status === "done" || status === "error";
}

// --- Cluster layout ---------------------------------------------------------

/**
 * Golden-angle (sunflower) packing: dot `i` sits at `spacing * sqrt(i + 0.5)`,
 * turned `i * 137.5°`, so the cluster grows outward and always looks organic.
 * Points are centered on their centroid. Small clusters keep their dots apart;
 * past `size.fit` the cluster packs tighter instead of growing. Past `maxDots`
 * finished steps, extra dots share slots and every dot thickens instead, so
 * the mark keeps its size.
 */
function layoutCluster(count: number, size: SizeConfig, maxDots: number) {
	const capacity = SEEDS + Math.max(1, Math.floor(maxDots));
	const filled = Math.min(count, capacity);
	const slots: Vec[] = [];
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < filled; i++) {
		const radius = size.spacing * Math.sqrt(i + 0.5);
		const angle = i * GOLDEN_ANGLE;
		const point = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
		slots.push(point);
		cx += point.x / filled;
		cy += point.y / filled;
	}
	let radius = 0;
	for (const point of slots) {
		point.x -= cx;
		point.y -= cy;
		radius = Math.max(radius, Math.hypot(point.x, point.y));
	}
	if (radius > size.fit) {
		const pack = size.fit / radius;
		for (const point of slots) {
			point.x *= pack;
			point.y *= pack;
		}
		radius = size.fit;
	}
	const points: Vec[] = [];
	for (let rank = 0; rank < count; rank++) {
		points.push(
			slots[
				rank < capacity ? rank : SEEDS + ((rank - SEEDS) % (capacity - SEEDS))
			],
		);
	}
	const overflow = Math.max(0, count - capacity);
	const thick = 1 + 0.3 * Math.min(1, overflow / (capacity - SEEDS));
	return { points, radius, thick };
}

/** Newest dot at full strength, the oldest at about 55%. */
function ageAlpha(rank: number, count: number) {
	return count <= 1 ? 1 : 0.55 + (0.45 * rank) / (count - 1);
}

/** Orbit radius of the seeking dot: just outside the cluster, inside the mark. */
function orbitRadius(clusterRadius: number, size: SizeConfig) {
	const max =
		size.mark / 2 - (size.dot * SEEKER_SCALE) / 2 - size.wander - 0.25;
	return Math.min(clusterRadius + size.gap, max);
}

function transformOf(x: number, y: number, scale: number) {
	return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
}

function hashString(value: string) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

/** Small seeded PRNG, so every dot drifts the same way on every render. */
function seeded(seed: number) {
	let state = seed || 1;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface Drift {
	ax: number;
	ay: number;
	wx: number;
	wy: number;
	px: number;
	py: number;
}

function makeDrift(key: string): Drift {
	const random = seeded(hashString(key));
	const turn = Math.PI * 2;
	return {
		ax: 0.3 + 0.3 * random(),
		ay: 0.3 + 0.3 * random(),
		wx: turn * (0.12 + 0.16 * random()),
		wy: turn * (0.12 + 0.16 * random()),
		px: turn * random(),
		py: turn * random(),
	};
}

// --- Engine -------------------------------------------------------------------

interface EngineModel {
	/** Finished steps in log order; their rank is `SEEDS + index`. */
	steps: { id: string; error: boolean }[];
	/** Removed steps still fading out. */
	leaving: Set<string>;
	open: boolean;
	thinking: boolean;
	/** On screen and in a visible tab. */
	live: boolean;
	still: boolean;
	size: SizeConfig;
	maxDots: number;
	rtl: boolean;
}

interface Flight {
	/** Toward the bullet in the log, or back into the cluster. */
	out: boolean;
	/** Engine time the flight leaves, for the stagger. */
	at: number;
	started: boolean;
	/** Leaves from the seeking dot rather than the cluster. */
	fromSeeker: boolean;
	cue: boolean;
	x: number;
	y: number;
	vx: number;
	vy: number;
	tx: number;
	ty: number;
	alpha: number;
	scale: number;
}

interface Dot {
	key: string;
	seed: boolean;
	rank: number;
	error: boolean;
	drift: Drift;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Slot, before the settle scale and drift. Kept while fading out. */
	bx: number;
	by: number;
	alpha: number;
	alphaTo: number;
	/** Fade time constant in seconds; 0 jumps. */
	fade: number;
	scale: number;
	scaleTo: number;
	/** Flying in from the seeking dot; lands when it reaches its slot. */
	landing: boolean;
	leaving: boolean;
	/** Represented in the log: a flight or its bullet. */
	away: boolean;
	bullet: boolean;
	flight: Flight | null;
}

type ElementKind = "dot" | "flight" | "bullet";

const seedKey = (index: number) => `agent-thinking-seed-${index}`;

/**
 * Drift, the seeking dot, landings, and flights to the log all run here, in
 * one rAF loop that writes transforms and opacity straight to the DOM. It only
 * runs while thinking on screen, or until a flight or the settle comes to rest.
 */
class ClusterEngine {
	model: EngineModel | null = null;
	dots = new Map<string, Dot>();
	elements: Record<ElementKind, Map<string, HTMLElement>> = {
		dot: new Map(),
		flight: new Map(),
		bullet: new Map(),
	};
	refs = new Map<string, (element: HTMLElement | null) => void>();
	anchor: HTMLElement | null = null;
	seekerEl: HTMLElement | null = null;
	tailEls: (HTMLElement | null)[] = [];
	onLand: (error: boolean) => void = () => {};

	/** Engine clock in seconds; only advances while the loop runs. */
	time = 0;
	frame = 0;
	last = 0;
	radius = 0;
	thick = 1;
	orbit = 0;
	clusterScale = 1;
	driftAmp = 1;
	seeker = { alpha: 0, returnAt: 0, collapse: 0, x: 0, y: 0, vx: 0, vy: 0 };

	ref(kind: ElementKind, key: string) {
		const id = `${kind}:${key}`;
		let callback = this.refs.get(id);
		if (!callback) {
			callback = (element) => {
				if (element) this.elements[kind].set(key, element);
				else this.elements[kind].delete(key);
			};
			this.refs.set(id, callback);
		}
		return callback;
	}

	sync(model: EngineModel) {
		const previous = this.model;
		this.model = model;
		const count = SEEDS + model.steps.length;
		const layout = layoutCluster(count, model.size, model.maxDots);
		this.radius = layout.radius;
		this.thick = layout.thick;

		const fresh: Dot[] = [];
		for (let i = 0; i < SEEDS; i++) {
			const dot = this.dots.get(seedKey(i)) ?? this.create(seedKey(i), true);
			dot.rank = i;
		}
		const present = new Set<string>();
		model.steps.forEach((step, index) => {
			present.add(step.id);
			let dot = this.dots.get(step.id);
			if (!dot) {
				dot = this.create(step.id, false);
				fresh.push(dot);
			} else if (dot.leaving) {
				dot.leaving = false;
			}
			dot.rank = SEEDS + index;
			dot.error = step.error;
		});
		for (const dot of this.dots.values()) {
			if (dot.seed) continue;
			if (present.has(dot.key)) {
				const point = layout.points[dot.rank];
				dot.bx = point.x;
				dot.by = point.y;
			} else if (model.leaving.has(dot.key)) {
				if (!dot.leaving) {
					dot.leaving = true;
					dot.landing = false;
					dot.flight = null;
					dot.bullet = false;
					dot.fade = 0.12;
				}
			} else {
				this.dots.delete(dot.key);
				for (const kind of ["dot", "flight", "bullet"] as const) {
					this.refs.delete(`${kind}:${dot.key}`);
				}
			}
		}
		for (let i = 0; i < SEEDS; i++) {
			const dot = this.dots.get(seedKey(i));
			if (dot) {
				dot.bx = layout.points[i].x;
				dot.by = layout.points[i].y;
			}
		}

		if (!previous) {
			this.reset(model);
			return;
		}

		// Settle when the agent is done, and wake up again for a follow-up.
		if (previous.thinking !== model.thinking && model.thinking) {
			this.seeker.returnAt = this.time;
		}

		const still = model.still;
		let flights = 0;
		for (const dot of this.dots.values()) {
			if (dot.landing || dot.flight?.fromSeeker) flights++;
		}
		const seekerFree = !still && previous.thinking && this.seeker.alpha > 0.2;
		for (const dot of fresh) {
			const target = this.target(dot);
			dot.x = target.x;
			dot.y = target.y;
			dot.scale = this.thick;
			dot.alpha = 0;
			dot.fade = 0.12;
			const fly = seekerFree && flights < MAX_FLIGHTS;
			if (fly) {
				flights++;
				// The seeking dot becomes this step's dot; a new one fades in later.
				const { x, y, vx, vy } = this.seeker;
				if (model.open) {
					dot.away = true;
					dot.flight = this.flight(true, this.time, true);
					Object.assign(dot.flight, {
						started: true,
						cue: true,
						x,
						y,
						vx,
						vy,
						alpha: 1,
						scale: SEEKER_SCALE,
					});
					this.aimAtBullet(dot);
				} else {
					Object.assign(dot, { x, y, vx, vy, alpha: 1, landing: true });
					dot.scale = SEEKER_SCALE;
				}
				this.seeker.alpha = 0;
				this.seeker.returnAt = this.time + 0.22;
			} else {
				if (model.open) {
					dot.away = true;
					dot.bullet = true;
				}
				this.onLand(dot.error);
			}
		}

		if (previous.open !== model.open) this.toggleLog(model.open, fresh);

		for (const dot of this.dots.values()) this.retarget(dot);

		if (still) {
			this.settleNow(fresh);
			return;
		}
		// Written now too, so remounted elements never paint a frame unplaced.
		this.write();
		this.kick();
	}

	reset(model: EngineModel) {
		this.clusterScale = model.thinking ? 1 : SETTLED_SCALE;
		this.driftAmp = model.thinking ? 1 : 0;
		this.orbit = orbitRadius(this.radius, model.size);
		this.seeker.alpha = model.thinking ? 1 : 0;
		this.seeker.collapse = model.thinking ? 0 : 1;
		Object.assign(this.seeker, this.orbitAt(0));
		for (const dot of this.dots.values()) {
			if (!dot.seed && model.open) {
				dot.away = true;
				dot.bullet = true;
			}
			this.retarget(dot);
			const target = this.target(dot);
			dot.x = target.x;
			dot.y = target.y;
			dot.alpha = dot.alphaTo;
			dot.scale = dot.scaleTo;
		}
		this.write();
		this.kick();
	}

	create(key: string, seed: boolean) {
		const dot: Dot = {
			key,
			seed,
			rank: 0,
			error: false,
			drift: makeDrift(key),
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			bx: 0,
			by: 0,
			alpha: 0,
			alphaTo: 0,
			fade: 0.09,
			scale: 1,
			scaleTo: 1,
			landing: false,
			leaving: false,
			away: false,
			bullet: false,
			flight: null,
		};
		this.dots.set(key, dot);
		return dot;
	}

	flight(out: boolean, at: number, fromSeeker = false): Flight {
		return {
			out,
			at,
			started: false,
			fromSeeker,
			cue: false,
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			tx: 0,
			ty: 0,
			alpha: 0,
			scale: 1,
		};
	}

	/** Dots leave for their bullets in step order, and come back the same way. */
	toggleLog(open: boolean, fresh: Dot[]) {
		const steps = [...this.dots.values()]
			.filter((dot) => !dot.seed && !dot.leaving && !fresh.includes(dot))
			.sort((a, b) => a.rank - b.rank);
		steps.forEach((dot, index) => {
			const at = this.time + index * LOG_STAGGER;
			if (open) {
				if (dot.flight) {
					dot.flight.out = true;
					if (dot.flight.started) this.aimAtBullet(dot);
				} else if (!dot.away) {
					dot.away = true;
					dot.flight = this.flight(true, at);
				}
				return;
			}
			if (dot.flight?.started) {
				dot.flight.out = false;
				dot.flight.fromSeeker = false;
			} else if (dot.flight) {
				dot.flight = null;
				dot.away = false;
			} else if (dot.bullet) {
				dot.flight = this.flight(false, at);
			} else {
				dot.away = false;
			}
		});
	}

	/** Bullet center relative to the mark center, in unzoomed px. */
	measureBullet(dot: Dot): Vec | null {
		const bullet = this.elements.bullet.get(dot.key);
		if (!bullet || !this.anchor) return null;
		const a = this.anchor.getBoundingClientRect();
		const b = bullet.getBoundingClientRect();
		const zoom =
			(this.anchor as HTMLElement & { currentCSSZoom?: number })
				.currentCSSZoom ?? 1;
		return {
			x: (b.left + b.width / 2 - a.left) / zoom,
			y: (b.top + b.height / 2 - a.top) / zoom,
		};
	}

	aimAtBullet(dot: Dot) {
		const flight = dot.flight;
		if (!flight) return;
		const point = this.measureBullet(dot);
		if (!point) {
			// No row to fly to: show it as a bullet as soon as one exists.
			dot.flight = null;
			dot.bullet = true;
			return;
		}
		flight.tx = point.x;
		flight.ty = point.y;
	}

	retarget(dot: Dot) {
		const model = this.model;
		if (!model) return;
		const count = SEEDS + model.steps.length;
		if (dot.leaving) {
			dot.alphaTo = 0;
			return;
		}
		// Dots waiting their turn to leave stay lit until their flight starts.
		const waiting = dot.flight?.out && !dot.flight.started;
		const ghost = dot.seed ? model.open : dot.away && !waiting;
		dot.alphaTo = ghost ? GHOST_ALPHA : ageAlpha(dot.rank, count);
		if (!dot.landing) dot.scaleTo = this.thick;
	}

	target(dot: Dot): Vec {
		const scale = this.clusterScale;
		const amp = this.driftAmp;
		const { drift } = dot;
		const t = this.time;
		// Measured from t = 0, so the first frame matches the server render.
		return {
			x:
				dot.bx * scale +
				amp *
					drift.ax *
					(Math.sin(drift.wx * t + drift.px) - Math.sin(drift.px)),
			y:
				dot.by * scale +
				amp *
					drift.ay *
					(Math.sin(drift.wy * t + drift.py) - Math.sin(drift.py)),
		};
	}

	/** Mirrored in right-to-left layouts: starts top left, turns the other way. */
	orbitAt(time: number): Vec {
		const model = this.model;
		const wander = model?.size.wander ?? 0;
		const angle =
			ORBIT_START +
			(Math.PI * 2 * time) / ORBIT_PERIOD +
			0.6 * Math.sin(0.83 * time);
		const radius =
			this.orbit +
			wander *
				(0.6 * Math.sin(1.7 * time + 0.4) + 0.4 * Math.sin(2.9 * time + 1.3));
		const pull = 1 - this.seeker.collapse ** 2 * (3 - 2 * this.seeker.collapse);
		const x = radius * Math.cos(angle) * pull;
		return { x: model?.rtl ? -x : x, y: radius * Math.sin(angle) * pull };
	}

	kick() {
		if (this.frame || !this.model || this.model.still) return;
		if (!this.wants()) return;
		this.last = 0;
		this.frame = requestAnimationFrame(this.tick);
	}

	stop() {
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = 0;
	}

	/** Ambient motion while thinking on screen, or anything still in motion. */
	wants() {
		const model = this.model;
		if (!model || model.still) return false;
		if (model.thinking) return model.live;
		return this.busy();
	}

	busy() {
		const model = this.model;
		if (!model) return false;
		if (this.driftAmp > 0 || this.seeker.alpha > 0.001) return true;
		if (Math.abs(this.clusterScale - SETTLED_SCALE) > 1e-4) return true;
		for (const dot of this.dots.values()) {
			if (dot.flight || dot.landing) return true;
			if (Math.abs(dot.alpha - dot.alphaTo) > 0.002) return true;
			if (Math.abs(dot.scale - dot.scaleTo) > 0.002) return true;
			const target = this.target(dot);
			if (
				Math.abs(dot.x - target.x) > 0.01 ||
				Math.abs(dot.y - target.y) > 0.01 ||
				Math.abs(dot.vx) + Math.abs(dot.vy) > 0.05
			) {
				return true;
			}
		}
		return false;
	}

	tick = (now: number) => {
		this.frame = 0;
		const model = this.model;
		if (!model) return;
		const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 1 / 60;
		this.last = now;
		this.step(dt);
		if (this.wants()) {
			this.write();
			this.frame = requestAnimationFrame(this.tick);
			return;
		}
		if (!model.thinking) this.settleNow([]);
		else this.write();
	};

	step(dt: number) {
		const model = this.model;
		if (!model) return;
		this.time += dt;
		const time = this.time;
		const ease = (tau: number) => 1 - Math.exp(-dt / tau);

		this.driftAmp = clamp(
			this.driftAmp + (model.thinking ? dt : -dt) / 0.6,
			0,
			1,
		);
		const scaleTo = model.thinking ? 1 : SETTLED_SCALE;
		this.clusterScale += (scaleTo - this.clusterScale) * ease(0.12);
		if (Math.abs(scaleTo - this.clusterScale) < 1e-4)
			this.clusterScale = scaleTo;
		const orbitTo = orbitRadius(this.radius * this.clusterScale, model.size);
		this.orbit += (orbitTo - this.orbit) * ease(0.3);

		// The seeking dot: fades in at the edge, and spirals into the cluster when done.
		const seeker = this.seeker;
		if (model.thinking) {
			seeker.collapse = Math.max(0, seeker.collapse - dt / 0.3);
			if (time >= seeker.returnAt) {
				seeker.alpha = Math.min(1, seeker.alpha + dt / 0.25);
			}
		} else {
			seeker.collapse = Math.min(1, seeker.collapse + dt / 0.35);
			seeker.alpha = Math.max(0, seeker.alpha - dt / 0.35);
		}
		const position = this.orbitAt(time);
		const before = this.orbitAt(time - 1 / 120);
		seeker.vx = (position.x - before.x) * 120;
		seeker.vy = (position.y - before.y) * 120;
		seeker.x = position.x;
		seeker.y = position.y;

		for (const dot of this.dots.values()) {
			const target = this.target(dot);
			spring(dot, target.x, target.y, dt, LAND_SPRING);
			dot.scale += (dot.scaleTo - dot.scale) * ease(0.16);
			dot.alpha =
				dot.fade === 0
					? dot.alphaTo
					: dot.alpha + (dot.alphaTo - dot.alpha) * ease(dot.fade);
			if (Math.abs(dot.alpha - dot.alphaTo) < 0.002) dot.alpha = dot.alphaTo;
			if (dot.landing && Math.hypot(target.x - dot.x, target.y - dot.y) < 0.6) {
				this.land(dot);
			}
			if (dot.flight) this.fly(dot, dt);
		}
	}

	fly(dot: Dot, dt: number) {
		const flight = dot.flight;
		if (!flight || this.time < flight.at) return;
		const ease = (tau: number) => 1 - Math.exp(-dt / tau);
		if (!flight.started) {
			flight.started = true;
			if (flight.out) {
				Object.assign(flight, {
					x: dot.x,
					y: dot.y,
					vx: dot.vx,
					vy: dot.vy,
					alpha: dot.alpha,
					scale: dot.scale,
				});
				this.retarget(dot);
				dot.alpha = dot.alphaTo;
				this.aimAtBullet(dot);
				if (!dot.flight) return;
			} else {
				const from = this.measureBullet(dot);
				dot.bullet = false;
				if (!from) {
					dot.flight = null;
					dot.away = false;
					this.retarget(dot);
					return;
				}
				Object.assign(flight, {
					x: from.x,
					y: from.y,
					alpha: bulletAlpha(dot),
					scale: 1,
				});
			}
		}
		if (!flight.out) {
			const target = this.target(dot);
			flight.tx = target.x;
			flight.ty = target.y;
		}
		spring(
			flight,
			flight.tx,
			flight.ty,
			dt,
			flight.fromSeeker ? LAND_SPRING : LOG_SPRING,
		);
		const alphaTo = flight.out
			? bulletAlpha(dot)
			: ageAlpha(dot.rank, SEEDS + (this.model?.steps.length ?? 0));
		flight.alpha += (alphaTo - flight.alpha) * ease(0.12);
		const scaleTo = flight.out ? 1 : dot.scaleTo;
		flight.scale += (scaleTo - flight.scale) * ease(0.14);
		const distance = Math.hypot(flight.tx - flight.x, flight.ty - flight.y);
		const speed = Math.hypot(flight.vx, flight.vy);
		if (distance > 0.35 || speed > 12) return;
		// Hand over: to the bullet in the log, or back to the dot in the cluster.
		dot.flight = null;
		if (flight.out) {
			dot.bullet = true;
			if (flight.cue) this.onLand(dot.error);
		} else {
			dot.away = false;
			this.retarget(dot);
			dot.alpha = dot.alphaTo;
		}
	}

	land(dot: Dot) {
		dot.landing = false;
		dot.scaleTo = this.thick;
		this.onLand(dot.error);
		// Neighbours make room: a half-pixel nudge outward that springs back.
		const reach = (this.model?.size.spacing ?? 1.5) * 2.4;
		for (const other of this.dots.values()) {
			if (other === dot || other.leaving || other.landing) continue;
			const dx = other.x - dot.x;
			const dy = other.y - dot.y;
			const distance = Math.hypot(dx, dy);
			if (distance < 0.01 || distance > reach) continue;
			const push = 18 * (1 - distance / reach);
			other.vx += (dx / distance) * push;
			other.vy += (dy / distance) * push;
		}
	}

	/** Jump everything to rest: reduced motion, or the loop winding down. */
	settleNow(fresh: Dot[]) {
		const model = this.model;
		if (!model) return;
		this.stop();
		this.clusterScale = model.thinking ? 1 : SETTLED_SCALE;
		this.driftAmp = 0;
		this.orbit = orbitRadius(this.radius * this.clusterScale, model.size);
		this.seeker.collapse = model.thinking ? 0 : 1;
		this.seeker.alpha = model.thinking ? 1 : 0;
		for (const dot of this.dots.values()) {
			if (dot.flight) {
				dot.bullet = dot.flight.out;
				dot.away = dot.flight.out;
				dot.flight = null;
			}
			if (model.open && !dot.seed && !dot.leaving && !dot.away) {
				dot.away = true;
				dot.bullet = true;
			}
			if (!model.open && dot.away) {
				dot.away = false;
				dot.bullet = false;
			}
			dot.landing = false;
			this.retarget(dot);
			const target = this.target(dot);
			Object.assign(dot, { x: target.x, y: target.y, vx: 0, vy: 0 });
			dot.scale = dot.scaleTo;
			dot.alpha = dot.alphaTo;
		}
		// New dots and bullets start from nothing, so their CSS fade runs.
		if (model.still) {
			for (const dot of fresh) {
				for (const kind of ["dot", "bullet"] as const) {
					const element = this.elements[kind].get(dot.key);
					if (!element) continue;
					element.style.opacity = "0";
					void element.offsetWidth;
				}
			}
		}
		this.write();
	}

	write() {
		const model = this.model;
		if (!model) return;
		for (const dot of this.dots.values()) {
			const element = this.elements.dot.get(dot.key);
			if (element) {
				setStyle(element, transformOf(dot.x, dot.y, dot.scale), dot.alpha);
			}
			const flyer = this.elements.flight.get(dot.key);
			if (flyer) {
				const flight = dot.flight;
				if (flight?.started) {
					setStyle(
						flyer,
						transformOf(flight.x, flight.y, flight.scale),
						flight.alpha,
					);
				} else setStyle(flyer, null, 0);
			}
			const bullet = this.elements.bullet.get(dot.key);
			if (bullet) setStyle(bullet, null, dot.bullet ? bulletAlpha(dot) : 0);
		}
		const seeker = this.seeker;
		const fade = 1 - seeker.collapse;
		const still = model.still;
		const resting = still ? this.restingSeeker() : null;
		if (this.seekerEl) {
			const scale = SEEKER_SCALE * (1 - 0.35 * seeker.collapse);
			setStyle(
				this.seekerEl,
				resting
					? transformOf(resting.x, resting.y, SEEKER_SCALE)
					: transformOf(seeker.x, seeker.y, scale),
				still ? (model.thinking ? 1 : 0) : seeker.alpha,
			);
		}
		TAIL.forEach((tail, index) => {
			const element = this.tailEls[index];
			if (!element) return;
			if (still || seeker.alpha === 0) {
				setStyle(element, null, 0);
				return;
			}
			const point = this.orbitAt(this.time - tail.lag);
			setStyle(
				element,
				transformOf(point.x, point.y, SEEKER_SCALE * tail.scale),
				seeker.alpha * tail.alpha * fade,
			);
		});
	}

	/** With reduced motion the seeking dot rests at the edge, top right. */
	restingSeeker(): Vec {
		const model = this.model;
		const radius = orbitRadius(
			this.radius * this.clusterScale,
			model?.size ?? sizes.md,
		);
		const x = radius * Math.cos(ORBIT_START);
		return { x: model?.rtl ? -x : x, y: radius * Math.sin(ORBIT_START) };
	}
}

function bulletAlpha(dot: Dot) {
	return dot.error ? 1 : BULLET_ALPHA;
}

function setStyle(
	element: HTMLElement,
	transform: string | null,
	alpha: number,
) {
	if (transform !== null && element.style.transform !== transform) {
		element.style.transform = transform;
	}
	const opacity = String(Math.round(alpha * 1000) / 1000);
	if (element.style.opacity !== opacity) element.style.opacity = opacity;
}

/** Damped spring toward a target, in small fixed substeps for stability. */
function spring(
	body: { x: number; y: number; vx: number; vy: number },
	tx: number,
	ty: number,
	dt: number,
	{ stiffness, damping }: { stiffness: number; damping: number },
) {
	const steps = Math.ceil(dt / 0.004);
	const h = dt / steps;
	for (let i = 0; i < steps; i++) {
		body.vx += (stiffness * (tx - body.x) - damping * body.vx) * h;
		body.vy += (stiffness * (ty - body.y) - damping * body.vy) * h;
		body.x += body.vx * h;
		body.y += body.vy * h;
	}
}

// --- Component ------------------------------------------------------------------

interface LeavingStep {
	id: string;
	error: boolean;
}

export function AgentThinking({
	status = "thinking",
	steps,
	label = "Thinking",
	doneLabel,
	errorLabel = "Stopped",
	startedAt,
	endedAt,
	timerDelay = 1500,
	showTimer = true,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	maxDots = 24,
	size = "md",
	variant = "plain",
	sound = false,
	haptics = true,
	animated = true,
	className,
	onKeyDown,
	...props
}: AgentThinkingProps) {
	const config = sizes[size];
	const thinking = status === "thinking";
	const hasSteps = steps !== undefined && steps.length > 0;
	const finished = (steps ?? []).filter(isFinished);
	const finishedKey = finished
		.map((step) => `${step.id}:${step.status === "error" ? 1 : 0}`)
		.join("|");

	const [hydrated, setHydrated] = useState(false);
	const reducedMotion = useReducedMotion() ?? false;
	// The server can't know the motion preference, so it renders the animated
	// state and the client switches after hydration.
	const still = !animated || (hydrated && reducedMotion);

	const [openState, setOpenState] = useState(defaultOpen);
	const open = (openProp ?? openState) && hasSteps;
	const setOpen = (next: boolean) => {
		if (openProp === undefined) setOpenState(next);
		onOpenChange?.(next);
	};

	// --- Clock ---------------------------------------------------------------
	const [clock, setClock] = useState(() => ({
		status,
		start: startedAt ?? null,
		end: endedAt ?? null,
	}));
	if (clock.status !== status) {
		// Adjusted during render so the done label has its final time at once.
		const now = Date.now();
		setClock({
			status,
			start: startedAt ?? clock.start ?? now,
			end: status === "thinking" ? null : (endedAt ?? now),
		});
	}
	const start = startedAt ?? clock.start;
	const end = thinking ? null : (endedAt ?? clock.end);
	const [now, setNow] = useState<number | null>(null);
	const [live, setLive] = useState(true);

	useEffect(() => {
		setHydrated(true);
		setClock((current) =>
			current.start === null && current.status === "thinking"
				? { ...current, start: Date.now() }
				: current,
		);
	}, []);

	// Re-renders once per second, on the second, and once more at `timerDelay`.
	useEffect(() => {
		if (!thinking || start === null || !live) return;
		let timeout = 0;
		const tick = () => {
			const current = Date.now();
			setNow(current);
			const elapsed = current - start;
			let wait = 1000 - (((elapsed % 1000) + 1000) % 1000);
			if (elapsed < timerDelay) wait = Math.min(wait, timerDelay - elapsed);
			timeout = window.setTimeout(tick, Math.max(16, wait + 4));
		};
		tick();
		return () => window.clearTimeout(timeout);
	}, [thinking, start, live, timerDelay]);

	const durationSum = finished.reduce(
		(sum, step) => sum + (step.durationMs ?? 0),
		0,
	);
	const elapsedMs =
		start !== null && end !== null ? Math.max(0, end - start) : durationSum;
	const doneInfo = { elapsedMs, steps: finished.length };
	const doneText =
		typeof doneLabel === "function"
			? doneLabel(doneInfo)
			: (doneLabel ??
				`${elapsedMs > 0 ? `Thought for ${formatElapsed(roundElapsed(elapsedMs))}` : "Done"}${
					finished.length > 0 ? ` · ${stepsWord(finished.length)}` : ""
				}`);
	const labelText = thinking
		? label
		: status === "error"
			? errorLabel
			: doneText;
	const timerElapsed =
		thinking && start !== null && now !== null ? Math.max(0, now - start) : 0;
	const timerShown = hydrated && thinking && timerElapsed >= timerDelay;

	// --- Steps that fade out after being removed -----------------------------
	const [leaving, setLeaving] = useState<LeavingStep[]>([]);
	const finishedRef = useRef<LeavingStep[]>([]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the finished ids and states
	useLayoutEffect(() => {
		const previous = finishedRef.current;
		finishedRef.current = finished.map((step) => ({
			id: step.id,
			error: step.status === "error",
		}));
		const ids = new Set(finished.map((step) => step.id));
		const gone = previous.filter((step) => !ids.has(step.id));
		if (gone.length === 0) return;
		setLeaving((current) => [
			...current.filter((step) => !ids.has(step.id)),
			...gone.filter((step) => !current.some((c) => c.id === step.id)),
		]);
		const timeout = window.setTimeout(() => {
			setLeaving((current) =>
				current.filter((step) => !gone.some((g) => g.id === step.id)),
			);
		}, 220);
		return () => window.clearTimeout(timeout);
	}, [finishedKey]);
	const leavingShown = leaving.filter(
		(step) => !finished.some((f) => f.id === step.id),
	);

	// --- Engine ---------------------------------------------------------------
	const [engine] = useState(() => new ClusterEngine());
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const [rtl, setRtl] = useState(false);

	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playLand } = useTiks({
		theme: LAND_SOUND,
		volume: 0.12,
		respectReducedMotion: false,
	});
	const { click: playDone } = useTiks({
		theme: DONE_SOUND,
		volume: 0.2,
		respectReducedMotion: false,
	});
	const lastCueRef = useRef(Number.NEGATIVE_INFINITY);
	const cue = (kind: "land" | "done") => {
		if (document.visibilityState === "hidden") return;
		const current = performance.now();
		if (kind === "land" && current - lastCueRef.current < CUE_THROTTLE_MS) {
			return;
		}
		lastCueRef.current = current;
		if (sound) (kind === "land" ? playLand : playDone)();
		if (haptics && window.matchMedia("(pointer: coarse)").matches) {
			void haptic(kind === "land" ? "light" : "success");
		}
	};
	const flash = () => {
		const element = labelRef.current;
		if (!element) return;
		delete element.dataset.flash;
		void element.offsetWidth;
		element.dataset.flash = "";
	};

	useLayoutEffect(() => {
		setRtl(
			rootRef.current
				? getComputedStyle(rootRef.current).direction === "rtl"
				: false,
		);
	}, []);

	useLayoutEffect(() => {
		engine.onLand = (error) => {
			// A step that lands as the run ends is covered by the done cue.
			if (thinking) cue("land");
			if (error) flash();
		};
		engine.sync({
			steps: finished.map((step) => ({
				id: step.id,
				error: step.status === "error",
			})),
			leaving: new Set(leavingShown.map((step) => step.id)),
			open,
			thinking,
			live,
			still,
			size: config,
			maxDots,
			rtl,
		});
	});
	useEffect(() => () => engine.stop(), [engine]);

	// Played when a run finishes while mounted, never for one done at mount.
	const statusRef = useRef(status);
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires on status changes only
	useEffect(() => {
		const previous = statusRef.current;
		statusRef.current = status;
		if (previous === "thinking" && status === "done") cue("done");
	}, [status]);

	// Only watched while thinking: after that, no observers or listeners.
	useEffect(() => {
		const root = rootRef.current;
		if (!thinking || !root) return;
		let onScreen = true;
		let visible = document.visibilityState !== "hidden";
		const update = () => setLive(onScreen && visible);
		const observer = new IntersectionObserver(([entry]) => {
			onScreen = entry?.isIntersecting ?? true;
			update();
		});
		observer.observe(root);
		const onVisibility = () => {
			visible = document.visibilityState !== "hidden";
			update();
		};
		document.addEventListener("visibilitychange", onVisibility);
		update();
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			setLive(true);
		};
	}, [thinking]);

	// --- Width of the label and timer, eased when it changes -----------------
	const widthRef = useRef<number | null>(null);
	const timerText = timerShown ? formatElapsed(timerElapsed) : "";
	// biome-ignore lint/correctness/useExhaustiveDependencies: measured when the text changes
	useLayoutEffect(() => {
		const element = textRef.current;
		if (!element) return;
		const zoom =
			(element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ??
			1;
		const from = element.getBoundingClientRect().width / zoom;
		for (const animation of element.getAnimations()) {
			if (animation.id === "agent-thinking-width") animation.cancel();
		}
		const to = element.getBoundingClientRect().width / zoom;
		const previous = widthRef.current;
		widthRef.current = to;
		if (previous === null || still || Math.abs(from - to) < 0.5) return;
		element.style.overflow = "hidden";
		const animation = element.animate(
			[{ width: `${from}px` }, { width: `${to}px` }],
			{
				duration: 320,
				easing: "cubic-bezier(.2,.8,.2,1)",
				id: "agent-thinking-width",
			},
		);
		animation.onfinish = animation.oncancel = () => {
			element.style.overflow = "";
		};
	}, [labelText, thinking, timerText.length]);

	// --- Announcements ----------------------------------------------------------
	const [message, setMessage] = useState("");
	const announceRef = useRef<{
		status: AgentThinkingStatus | null;
		finished: Set<string> | null;
		pending: string[];
		timeout: number;
	}>({ status: null, finished: null, pending: [], timeout: 0 });
	const spokenDone =
		typeof doneLabel === "string"
			? doneLabel
			: typeof doneLabel === "function"
				? doneText
				: `${elapsedMs > 0 ? `Thought for ${speakElapsed(roundElapsed(elapsedMs))}` : "Done"}${
						finished.length > 0 ? `, ${stepsWord(finished.length)}` : ""
					}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: announces step and status changes
	useEffect(() => {
		const state = announceRef.current;
		const flush = (extra?: string) => {
			window.clearTimeout(state.timeout);
			state.timeout = 0;
			const parts = extra ? [...state.pending, extra] : state.pending;
			state.pending = [];
			if (parts.length) setMessage(parts.join(". "));
		};
		if (state.finished) {
			for (const step of finished) {
				if (state.finished.has(step.id)) continue;
				state.pending.push(
					`${step.label}, ${step.status === "error" ? "failed" : "done"}`,
				);
			}
		}
		state.finished = new Set(finished.map((step) => step.id));
		const previous = state.status;
		if (previous !== status) {
			state.status = status;
			if (status === "thinking") {
				state.pending = [];
				window.clearTimeout(state.timeout);
				// Set after mount, so the live region exists before it changes.
				state.timeout = window.setTimeout(
					() => {
						state.timeout = 0;
						setMessage(label);
					},
					previous === null ? 150 : 0,
				);
				return;
			}
			if (previous !== null) {
				flush(status === "error" ? errorLabel : spokenDone);
				return;
			}
			state.pending = [];
		}
		if (state.pending.length && thinking) {
			window.clearTimeout(state.timeout);
			state.timeout = window.setTimeout(() => flush(), ANNOUNCE_DEBOUNCE_MS);
		}
	}, [finishedKey, status]);

	// --- Render -------------------------------------------------------------------
	const listId = `agent-thinking-${useId().replace(/[^\w-]/g, "")}-log`;
	const count = SEEDS + finished.length;
	const layout = layoutCluster(count, config, maxDots);
	const initialScale = thinking ? 1 : SETTLED_SCALE;
	const initialStyle = (rank: number, away: boolean) => {
		const point = layout.points[rank] ?? { x: 0, y: 0 };
		return {
			left: -config.dot / 2,
			top: -config.dot / 2,
			width: config.dot,
			height: config.dot,
			transform: transformOf(
				point.x * initialScale,
				point.y * initialScale,
				layout.thick,
			),
			opacity: open && away ? GHOST_ALPHA : ageAlpha(rank, count),
		};
	};
	const dotBox = {
		left: -config.dot / 2,
		top: -config.dot / 2,
		width: config.dot,
		height: config.dot,
	};
	const orbit = orbitRadius(layout.radius, config);
	const seekerStart = transformOf(
		orbit * Math.cos(ORBIT_START),
		orbit * Math.sin(ORBIT_START),
		SEEKER_SCALE,
	);
	const fadeClass = still ? "transition-opacity duration-150" : undefined;
	const dotClass = "pointer-events-none absolute rounded-full bg-current";

	const mark = (
		<span
			aria-hidden
			data-slot="agent-thinking-mark"
			className={cn("relative shrink-0", config.markClass)}
		>
			<span
				ref={(element) => {
					engine.anchor = element;
				}}
				className="absolute top-1/2 left-1/2 size-0"
			>
				{Array.from({ length: SEEDS }, (_, index) => (
					<span
						key={seedKey(index)}
						ref={engine.ref("dot", seedKey(index))}
						className={cn(dotClass, fadeClass)}
						style={initialStyle(index, true)}
					/>
				))}
				{finished.map((step, index) => (
					<span
						key={step.id}
						ref={engine.ref("dot", step.id)}
						data-slot="agent-thinking-dot"
						className={cn(
							dotClass,
							fadeClass,
							step.status === "error" && "text-destructive",
						)}
						style={initialStyle(SEEDS + index, true)}
					/>
				))}
				{leavingShown.map((step) => (
					<span
						key={step.id}
						ref={engine.ref("dot", step.id)}
						className={cn(dotClass, step.error && "text-destructive")}
						style={dotBox}
					/>
				))}
				{finished.map((step) => (
					<span
						key={`flight-${step.id}`}
						ref={engine.ref("flight", step.id)}
						className={cn(
							dotClass,
							step.status === "error" && "text-destructive",
						)}
						style={{ ...dotBox, opacity: 0 }}
					/>
				))}
				{TAIL.map((tail, index) => (
					<span
						key={tail.lag}
						ref={(element) => {
							engine.tailEls[index] = element;
						}}
						className={dotClass}
						style={{ ...dotBox, opacity: 0 }}
					/>
				))}
				<span
					ref={(element) => {
						engine.seekerEl = element;
					}}
					data-slot="agent-thinking-seeker"
					data-pulse={still && thinking && live ? "" : undefined}
					className={dotClass}
					style={{
						...dotBox,
						transform: seekerStart,
						opacity: thinking ? 1 : 0,
					}}
				/>
			</span>
		</span>
	);

	const text = (
		<span
			ref={textRef}
			data-slot="agent-thinking-text"
			className="relative flex min-w-0 items-baseline gap-2"
		>
			<AnimatePresence initial={false} mode="popLayout">
				<m.span
					key={`${status}:${labelText}`}
					ref={labelRef}
					data-slot="agent-thinking-label"
					data-sweep={thinking && !still && live ? "" : undefined}
					onAnimationEnd={(event) => {
						if (event.animationName === "agent-thinking-flash") {
							delete event.currentTarget.dataset.flash;
						}
					}}
					className={cn(
						"min-w-0 truncate font-medium",
						config.label,
						status === "error" ? "text-destructive" : "text-current/80",
						hasSteps && status !== "error" && "group-hover/row:text-current",
					)}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: still ? 0.12 : 0.24, ease: "easeOut" }}
					// Keeps the fade on motion's frame loop for frame-stepped captures.
					onUpdate={noop}
				>
					{labelText}
				</m.span>
			</AnimatePresence>
			{thinking && showTimer ? (
				<span
					aria-hidden
					dir="ltr"
					data-slot="agent-thinking-timer"
					className={cn(
						"min-w-[3ch] shrink-0 text-muted-foreground tabular-nums transition-opacity duration-300",
						config.timer,
					)}
					style={{ opacity: timerShown ? 1 : 0 }}
				>
					{timerText}
				</span>
			) : null}
		</span>
	);

	const rowClass = cn(
		"group/row relative flex min-h-8 min-w-0 max-w-full items-center text-start",
		config.gapClass,
		variant === "pill" ? "rounded-full bg-muted/50 px-3 py-1.5" : "rounded-md",
	);

	return (
		<LazyMotion features={domAnimation}>
			<div
				ref={rootRef}
				data-slot="agent-thinking"
				data-status={status}
				data-size={size}
				data-variant={variant}
				data-open={open ? "" : undefined}
				className={cn(
					"flex w-full min-w-0 flex-col items-start text-foreground",
					className,
				)}
				onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
					onKeyDown?.(event);
					if (event.defaultPrevented || event.key !== "Escape" || !open) return;
					event.preventDefault();
					setOpen(false);
					triggerRef.current?.focus();
				}}
				{...props}
			>
				<style href="tentui-agent-thinking" precedence="default">
					{STYLES}
				</style>
				{hasSteps ? (
					<button
						ref={triggerRef}
						type="button"
						data-slot="agent-thinking-trigger"
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen(!open)}
						className={cn(
							rowClass,
							"pointer-coarse:min-h-11 cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2",
						)}
					>
						{mark}
						{text}
					</button>
				) : (
					<div data-slot="agent-thinking-trigger" className={rowClass}>
						{mark}
						{text}
					</div>
				)}
				<AnimatePresence initial={false}>
					{open && steps ? (
						<m.div
							key="log"
							data-slot="agent-thinking-log"
							className="w-full min-w-0 overflow-hidden"
							initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
							transition={{
								duration: still ? 0.15 : 0.3,
								ease: [0.2, 0.8, 0.2, 1],
							}}
							onUpdate={noop}
						>
							<ol
								id={listId}
								className={cn(
									"flex min-w-0 flex-col pt-1 pb-0.5",
									variant === "pill" && "px-3",
								)}
							>
								{steps.map((step) => {
									const state = step.status ?? "done";
									const done = isFinished(step);
									return (
										<li
											key={step.id}
											data-slot="agent-thinking-step"
											data-status={state}
											className={cn(
												"flex min-w-0 items-center",
												config.gapClass,
												config.step,
											)}
										>
											<span
												aria-hidden
												className={cn(
													"relative flex shrink-0 items-center justify-center self-stretch",
													config.bulletClass,
												)}
											>
												{done ? (
													<span
														ref={engine.ref("bullet", step.id)}
														data-slot="agent-thinking-bullet"
														className={cn(
															"rounded-full bg-current",
															fadeClass,
															state === "error" && "text-destructive",
														)}
														style={{
															width: config.dot,
															height: config.dot,
															opacity: 0,
														}}
													/>
												) : (
													<span
														className="rounded-full bg-current opacity-25"
														style={{ width: config.dot, height: config.dot }}
													/>
												)}
											</span>
											<span
												title={step.label}
												data-sweep={
													state === "active" && thinking && !still && live
														? ""
														: undefined
												}
												className={cn(
													"min-w-0 flex-1 truncate",
													state === "error"
														? "text-destructive"
														: state === "active"
															? "font-medium text-current/80"
															: "text-muted-foreground",
												)}
											>
												{step.label}
												<span className="sr-only">
													{`, ${
														state === "done"
															? "done"
															: state === "error"
																? "failed"
																: state === "active"
																	? "in progress"
																	: "pending"
													}`}
												</span>
											</span>
											{step.durationMs !== undefined ? (
												<span className="shrink-0 ps-3 text-muted-foreground text-xs tabular-nums">
													{formatStepDuration(step.durationMs)}
												</span>
											) : null}
										</li>
									);
								})}
							</ol>
						</m.div>
					) : null}
				</AnimatePresence>
				<span role="status" aria-live="polite" aria-atomic className="sr-only">
					{message}
				</span>
			</div>
		</LazyMotion>
	);
}

function noop() {}
