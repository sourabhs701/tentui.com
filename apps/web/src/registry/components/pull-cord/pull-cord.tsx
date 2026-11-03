"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Layout, in px. The chain hangs from the fixture at the top-center of the box.
const WIDTH = 200;
const HEIGHT = 304;
const CENTER_X = WIDTH / 2;
/** Where the chain leaves the fixture. */
const ANCHOR_Y = 49;
/** Center-to-center distance between beads. */
const BEAD_PITCH = 7;
const BEAD_RADIUS = 2.6;
/** Beads hanging below the fixture at rest. */
const REST_BEADS = 20;
const REST_LENGTH = REST_BEADS * BEAD_PITCH;
/** The handle's pivot, where the last bead is crimped in, at rest. */
const REST_PIVOT_Y = ANCHOR_Y + REST_LENGTH;
/** From the handle's pivot to its center of mass. */
const HANDLE_ARM = 30;
/** The pivot's spot inside the handle button. */
const PIVOT_IN_BUTTON = { x: 24, y: 3 } as const;

// Pulling, in px of chain fed out of the fixture.
/** Pull before the chain starts to rubber-band. */
const TRAVEL = 44;
/** Pull that flips the switch on release. */
const THRESHOLD = 28;
/** Furthest the chain rubber-bands past `TRAVEL`. */
const MAX_BAND = 14;
/** Furthest the handle follows the pointer sideways. */
const MAX_SWAY = 24;
/** Sideways pointer travel the handle follows, as a fraction. */
const SWAY_FACTOR = 0.6;
/** Pointer travel before a press becomes a pull. */
const DRAG_SLOP = 3;
/** How far a click or key press pulls the chain. */
const TUG_DEPTH = 38;
/** Tug speed in px/s: one bead per 47 ms, so each bead keeps its own tick. */
const TUG_SPEED = 150;
/** Seconds a tug rests at the bottom before letting go. */
const TUG_HOLD = 0.06;
/** A tug leans this far sideways, alternating sides, so the chain swings. */
const TUG_SWAY = 12;
/** Seconds the handle eases home with reduced motion. */
const RETURN_DURATION = 0.22;
/** Minimum ms between bead ticks. Two 60 Hz frames still fit. */
const CUE_THROTTLE_MS = 32;

// Physics, in px and seconds. A verlet rope with a two-node rigid handle.
const SEGMENTS = 20;
const PIVOT = SEGMENTS;
const WEIGHT = SEGMENTS + 1;
const NODES = SEGMENTS + 2;
const GRAVITY = 9000;
/** Fixed timestep: the same motion at 60 Hz and 120 Hz. */
const STEP = 1 / 240;
/** Longest frame simulated, so a stalled tab doesn't jump. */
const MAX_FRAME = 1 / 20;
const ITERATIONS = 8;
/** The handle outweighs each chain node three to one. */
const HANDLE_MASS = 3;
/** Air drag on the chain and handle, per second. */
const CHAIN_DAMPING = 6;
const HANDLE_DAMPING = 4;
/**
 * Friction that ramps in after a release, like a real chain losing its last
 * sway, so the rope rests within about 1.5 s instead of shivering.
 */
const SETTLE_FRICTION = 14;
const SETTLE_FRICTION_AFTER = 0.9;
const SETTLE_FRICTION_RAMP = 0.5;
/** Velocity correction from the follow-the-leader pass, which keeps the rope from buzzing. */
const LEADER_DAMPING = 0.5;
/** How quickly a held handle catches up with the pointer, per second. */
const PIN_RATE = 40;
const PIN_BLEND = 1 - Math.exp(-PIN_RATE * STEP);
/** The switch's return spring, which reels the chain back in. */
const RECOIL_STIFFNESS = 520;
const RECOIL_DAMPING = 2 * 0.42 * Math.sqrt(RECOIL_STIFFNESS);
/** Settled once every node stays this close to rest for `SETTLE_FRAMES`. */
const SETTLE_DISTANCE = 0.25;
const SETTLE_FRAMES = 12;

const MAX_BEADS =
	Math.ceil((REST_LENGTH + TRAVEL + MAX_BAND + 8) / BEAD_PITCH) + 2;

// One soft metallic tick per bead, a firm clack on the flip, and a low thunk
// when the chain hits the end of its travel.
const BEAD_SOUND = {
	name: "pull-cord-bead",
	baseFreq: 660,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 5200,
	filterQ: 7,
	attack: 0.001,
	decay: 0.8,
	brightness: 6000,
} as const;
const SWITCH_ON_SOUND = {
	name: "pull-cord-on",
	baseFreq: 300,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 1400,
	filterQ: 2.5,
	attack: 0.001,
	decay: 1.6,
	brightness: 3000,
} as const;
/** A touch higher than on. */
const SWITCH_OFF_SOUND = {
	...SWITCH_ON_SOUND,
	name: "pull-cord-off",
	baseFreq: 360,
	filterFreq: 1800,
} as const;
const STOP_SOUND = {
	name: "pull-cord-stop",
	baseFreq: 220,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 900,
	filterQ: 1,
	attack: 0.002,
	decay: 1.6,
	brightness: 1500,
} as const;

type Mode = "idle" | "drag" | "tug" | "free" | "return";

interface Sim {
	x: Float64Array;
	y: Float64Array;
	px: Float64Array;
	py: Float64Array;
	/** Arc length along the rope at each node, reused by `layoutBeads`. */
	lengths: Float64Array;
	/** Chain fed out past its resting length. */
	feed: number;
	feedVelocity: number;
	mode: Mode;
	/** Pointer offset from the resting pivot, before rubber banding. */
	pullX: number;
	pullY: number;
	/** Pull, in px, where the current tug or return started. */
	fromX: number;
	fromY: number;
	elapsed: number;
	/** Seconds since the handle was let go. */
	freeTime: number;
	/** Side the next tug leans to. */
	tugSide: 1 | -1;
	accumulator: number;
	lastTime: number | null;
	lastBead: number;
	atStop: boolean;
	calmFrames: number;
}

function restY(node: number) {
	return node === WEIGHT
		? REST_PIVOT_Y + HANDLE_ARM
		: ANCHOR_Y + (node * REST_LENGTH) / SEGMENTS;
}

function createSim(): Sim {
	const sim: Sim = {
		x: new Float64Array(NODES),
		y: new Float64Array(NODES),
		px: new Float64Array(NODES),
		py: new Float64Array(NODES),
		lengths: new Float64Array(SEGMENTS + 1),
		feed: 0,
		feedVelocity: 0,
		mode: "idle",
		pullX: 0,
		pullY: 0,
		fromX: 0,
		fromY: 0,
		elapsed: 0,
		freeTime: 0,
		tugSide: 1,
		accumulator: 0,
		lastTime: null,
		lastBead: 0,
		atStop: false,
		calmFrames: 0,
	};
	settle(sim);
	return sim;
}

/** Puts the rope back at rest, hanging straight down. */
function settle(sim: Sim) {
	for (let node = 0; node < NODES; node++) {
		sim.x[node] = sim.px[node] = CENTER_X;
		sim.y[node] = sim.py[node] = restY(node);
	}
	sim.feed = 0;
	sim.feedVelocity = 0;
	sim.lastBead = 0;
	sim.calmFrames = 0;
}

/** Eases `over` toward `limit`, never reaching it. */
function band(over: number, limit: number) {
	return (over * limit) / (over + limit);
}

/** Where a pull puts the handle's pivot. */
function pullTarget(pullX: number, pullY: number) {
	const down = Math.max(pullY, 0);
	return {
		x: CENTER_X + MAX_SWAY * Math.tanh((pullX * SWAY_FACTOR) / MAX_SWAY),
		y:
			REST_PIVOT_Y +
			(down > TRAVEL ? TRAVEL + band(down - TRAVEL, MAX_BAND) : down),
	};
}

/** Chain fed out when the pivot sits at `x`, `y` with the chain taut. */
function feedAt(x: number, y: number) {
	return Math.max(0, Math.hypot(x - CENTER_X, y - ANCHOR_Y) - REST_LENGTH);
}

/** Advances the rope by one fixed step. A `pin` holds the handle's pivot. */
function stepSim(sim: Sim, pin: { x: number; y: number } | null) {
	const { x, y, px, py } = sim;

	if (pin) {
		px[PIVOT] = x[PIVOT];
		py[PIVOT] = y[PIVOT];
		x[PIVOT] += (pin.x - x[PIVOT]) * PIN_BLEND;
		y[PIVOT] += (pin.y - y[PIVOT]) * PIN_BLEND;
		const feed = feedAt(x[PIVOT], y[PIVOT]);
		sim.feedVelocity = (feed - sim.feed) / STEP;
		sim.feed = feed;
	} else {
		// The return spring reels the chain in until the stop bead hits the fixture.
		sim.feedVelocity +=
			(-RECOIL_STIFFNESS * sim.feed - RECOIL_DAMPING * sim.feedVelocity) * STEP;
		sim.feed += sim.feedVelocity * STEP;
		if (sim.feed <= 0) {
			sim.feed = 0;
			sim.feedVelocity = 0;
		}
	}

	let friction = 0;
	if (!pin) {
		sim.freeTime += STEP;
		friction =
			SETTLE_FRICTION *
			Math.min(
				Math.max(
					(sim.freeTime - SETTLE_FRICTION_AFTER) / SETTLE_FRICTION_RAMP,
					0,
				),
				1,
			);
	}
	const chainKeep = Math.exp(-(CHAIN_DAMPING + friction) * STEP);
	const handleKeep = Math.exp(-(HANDLE_DAMPING + friction) * STEP);
	const fall = GRAVITY * STEP * STEP;
	for (let node = 1; node < NODES; node++) {
		if (pin && node === PIVOT) continue;
		const keep = node >= PIVOT ? handleKeep : chainKeep;
		const vx = (x[node] - px[node]) * keep;
		const vy = (y[node] - py[node]) * keep;
		px[node] = x[node];
		py[node] = y[node];
		x[node] += vx;
		y[node] += vy + fall;
	}

	const segment = (REST_LENGTH + sim.feed) / SEGMENTS;
	const weightOf = (node: number) => {
		if (node === 0 || (pin && node === PIVOT)) return 0;
		return node >= PIVOT ? 1 / HANDLE_MASS : 1;
	};
	for (let pass = 0; pass < ITERATIONS; pass++) {
		for (let node = 0; node < NODES - 1; node++) {
			const wa = weightOf(node);
			const wb = weightOf(node + 1);
			const total = wa + wb;
			if (!total) continue;
			const dx = x[node + 1] - x[node];
			const dy = y[node + 1] - y[node];
			const distance = Math.hypot(dx, dy) || 1e-6;
			const rest = node < SEGMENTS ? segment : HANDLE_ARM;
			const push = (distance - rest) / distance / total;
			x[node] += dx * push * wa;
			y[node] += dy * push * wa;
			x[node + 1] -= dx * push * wb;
			y[node + 1] -= dy * push * wb;
		}
	}

	// Follow the leader from the fixture down, so the chain never stretches
	// and the handle stays rigid. A chain can still go slack.
	for (let node = 1; node < NODES; node++) {
		if (pin && node === PIVOT) continue;
		const rest = node <= SEGMENTS ? segment : HANDLE_ARM;
		const dx = x[node] - x[node - 1];
		const dy = y[node] - y[node - 1];
		const distance = Math.hypot(dx, dy) || 1e-6;
		if (node <= SEGMENTS && distance <= rest) continue;
		const nextX = x[node - 1] + (dx / distance) * rest;
		const nextY = y[node - 1] + (dy / distance) * rest;
		if (node > 1 && !(pin && node - 1 === PIVOT)) {
			px[node - 1] += (nextX - x[node]) * LEADER_DAMPING;
			py[node - 1] += (nextY - y[node]) * LEADER_DAMPING;
		}
		x[node] = nextX;
		y[node] = nextY;
	}
}

/** Lays the rope out straight from the fixture to `pivotX`, `pivotY`. */
function poseStraight(sim: Sim, pivotX: number, pivotY: number) {
	for (let node = 0; node <= SEGMENTS; node++) {
		const t = node / SEGMENTS;
		sim.x[node] = sim.px[node] = CENTER_X + (pivotX - CENTER_X) * t;
		sim.y[node] = sim.py[node] = ANCHOR_Y + (pivotY - ANCHOR_Y) * t;
	}
	sim.x[WEIGHT] = sim.px[WEIGHT] = pivotX;
	sim.y[WEIGHT] = sim.py[WEIGHT] = pivotY + HANDLE_ARM;
	sim.feed = feedAt(pivotX, pivotY);
	sim.feedVelocity = 0;
}

/**
 * Places the beads along the rope, counting up from the handle, and returns
 * how many there are. Beads above the fixture's mouth are tucked inside it,
 * so a pull feeds them out one by one.
 */
function layoutBeads(sim: Sim, out: Float64Array) {
	const { x, y, lengths } = sim;
	lengths[0] = 0;
	for (let node = 1; node <= SEGMENTS; node++) {
		lengths[node] =
			lengths[node - 1] +
			Math.hypot(x[node] - x[node - 1], y[node] - y[node - 1]);
	}
	const ropeLength = lengths[SEGMENTS];
	const span = REST_LENGTH + sim.feed;
	const last = Math.min(MAX_BEADS - 1, Math.floor(span / BEAD_PITCH) + 1);
	let segment = 1;
	// From the fixture down, so the segment only ever moves forward.
	for (let bead = last; bead >= 0; bead--) {
		const along = span - bead * BEAD_PITCH;
		if (along <= 0) {
			out[bead * 2] = x[0];
			out[bead * 2 + 1] = y[0] + along;
			continue;
		}
		const at = (along / span) * ropeLength;
		while (segment < SEGMENTS && lengths[segment] < at) segment++;
		const from = lengths[segment - 1];
		const t = (at - from) / (lengths[segment] - from || 1);
		out[bead * 2] = x[segment - 1] + (x[segment] - x[segment - 1]) * t;
		out[bead * 2 + 1] = y[segment - 1] + (y[segment] - y[segment - 1]) * t;
	}
	return last + 1;
}

function round(value: number) {
	return Math.round(value * 100) / 100;
}

function chainPath(points: Float64Array, count: number) {
	let path = "";
	for (let bead = 0; bead < count; bead++) {
		path += `${bead ? "L" : "M"}${round(points[bead * 2])} ${round(points[bead * 2 + 1])}`;
	}
	return path;
}

function handleTransform(sim: Sim) {
	const pivotX = sim.x[PIVOT];
	const pivotY = sim.y[PIVOT];
	const tilt = Math.atan2(sim.x[WEIGHT] - pivotX, sim.y[WEIGHT] - pivotY);
	return `translate(${round(pivotX - PIVOT_IN_BUTTON.x)}px, ${round(pivotY - PIVOT_IN_BUTTON.y)}px) rotate(${round((-tilt * 180) / Math.PI)}deg)`;
}

// The resting pose, rendered on the server and on first paint.
const restSim = createSim();
const restBeads = new Float64Array(MAX_BEADS * 2);
const restCount = layoutBeads(restSim, restBeads);
const restPath = chainPath(restBeads, restCount);
const restTransform = handleTransform(restSim);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
	const query = window.matchMedia(REDUCED_MOTION_QUERY);
	query.addEventListener("change", onStoreChange);
	return () => query.removeEventListener("change", onStoreChange);
}

function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribeToReducedMotion,
		() => window.matchMedia(REDUCED_MOTION_QUERY).matches,
		() => false,
	);
}

function easeOutCubic(t: number) {
	return 1 - (1 - t) ** 3;
}

export interface PullCordProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultChecked" | "onChange" | "ref"
	> {
	/** Controlled on/off state. */
	checked?: boolean;
	/** Initial state when uncontrolled. */
	defaultChecked?: boolean;
	/** Called when a pull, click, or key press flips the switch. */
	onCheckedChange?: (checked: boolean) => void;
	/** Accessible name of the switch. Ignored when `aria-label` or `aria-labelledby` is set. */
	label?: string;
	disabled?: boolean;
	/** Submits `"on"` or `"off"` with a native form through a hidden input. */
	name?: string;
	/** Play a tick per bead, a click on the flip, and a thunk at the end of the pull. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
}

export function PullCord({
	checked: checkedProp,
	defaultChecked = false,
	onCheckedChange,
	label = "Light",
	disabled = false,
	name,
	sound = true,
	haptics = true,
	className,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	"aria-describedby": ariaDescribedBy,
	...props
}: PullCordProps) {
	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const controlled = checkedProp !== undefined;
	const checked = controlled ? checkedProp : internalChecked;
	const [pulling, setPulling] = useState(false);

	const reducedMotion = usePrefersReducedMotion();
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playBead } = useTiks({
		theme: BEAD_SOUND,
		respectReducedMotion: false,
	});
	const {
		click: playSwitchClick,
		toggle: playSwitchClunk,
		setTheme: setSwitchSound,
	} = useTiks({ theme: SWITCH_ON_SOUND, respectReducedMotion: false });
	const { toggle: playStop } = useTiks({
		theme: STOP_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const url = (part: string) => `url(#pull-cord-${ids}-${part})`;
	const gradientId = (part: string) => `pull-cord-${ids}-${part}`;

	const rootRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLButtonElement>(null);
	const chainRef = useRef<SVGPathElement>(null);
	const beadRefs = useRef<Array<SVGCircleElement | null>>([]);
	const simRef = useRef<Sim | null>(null);
	const beadsRef = useRef<Float64Array | null>(null);
	const shownRef = useRef(restCount);
	const frameRef = useRef(0);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const suppressClickRef = useRef(false);
	const dragRef = useRef<{
		pointerId: number;
		originX: number;
		originY: number;
		startX: number;
		startY: number;
		scale: number;
		moved: boolean;
	} | null>(null);

	// Event handlers and the frame loop read the latest props through refs.
	const latest = useRef({
		checked,
		controlled,
		onCheckedChange,
		sound,
		haptics,
		reducedMotion,
	});
	useLayoutEffect(() => {
		latest.current = {
			checked,
			controlled,
			onCheckedChange,
			sound,
			haptics,
			reducedMotion,
		};
	});

	const getSim = () => {
		simRef.current ??= createSim();
		return simRef.current;
	};

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	const tick = (now: number) => {
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return;
		lastCueAtRef.current = now;
		if (silent()) return;
		if (latest.current.sound) playBead();
		if (latest.current.haptics) void haptic("selection");
	};

	const thunk = () => {
		lastCueAtRef.current = performance.now();
		if (silent()) return;
		if (latest.current.sound) playStop(false);
		if (latest.current.haptics) void haptic("soft");
	};

	// Called only for user input, so the first render and prop changes stay quiet.
	const flip = () => {
		const next = !latest.current.checked;
		latest.current.checked = next;
		if (!latest.current.controlled) setInternalChecked(next);
		latest.current.onCheckedChange?.(next);
		lastCueAtRef.current = performance.now();
		if (silent()) return;
		if (latest.current.sound) {
			// The same falling clunk for both, pitched a little lower for on.
			setSwitchSound(next ? SWITCH_ON_SOUND : SWITCH_OFF_SOUND);
			playSwitchClick();
			playSwitchClunk(false);
		}
		if (latest.current.haptics) void haptic("medium");
	};

	const paint = () => {
		const sim = getSim();
		beadsRef.current ??= new Float64Array(MAX_BEADS * 2);
		const beads = beadsRef.current;
		const count = layoutBeads(sim, beads);
		const shown = shownRef.current;
		for (let bead = 0; bead < Math.max(count, shown); bead++) {
			const circle = beadRefs.current[bead];
			if (!circle) continue;
			if (bead >= count) {
				circle.setAttribute("display", "none");
				continue;
			}
			if (bead >= shown) circle.removeAttribute("display");
			circle.setAttribute("cx", String(round(beads[bead * 2])));
			circle.setAttribute("cy", String(round(beads[bead * 2 + 1])));
		}
		shownRef.current = count;
		chainRef.current?.setAttribute("d", chainPath(beads, count));
		if (handleRef.current) {
			handleRef.current.style.transform = handleTransform(sim);
		}
	};

	/** Lets go of the handle; `commit` flips the switch if it was pulled far enough. */
	const release = (commit: boolean) => {
		const sim = getSim();
		const target = pullTarget(sim.pullX, sim.pullY);
		const pulled = feedAt(target.x, target.y);
		if (sim.mode === "tug" || (commit && pulled >= THRESHOLD)) flip();
		if (latest.current.reducedMotion) {
			sim.mode = "return";
			sim.fromX = sim.x[PIVOT] - CENTER_X;
			sim.fromY = sim.y[PIVOT] - REST_PIVOT_Y;
			sim.elapsed = 0;
		} else {
			sim.mode = "free";
			sim.freeTime = 0;
		}
		sim.atStop = false;
		wake();
	};

	const frame = (now: number) => {
		frameRef.current = 0;
		const sim = getSim();
		const elapsed =
			sim.lastTime === null
				? 1 / 60
				: Math.min((now - sim.lastTime) / 1000, MAX_FRAME);
		sim.lastTime = now;
		sim.elapsed += elapsed;

		if (sim.mode === "tug") {
			sim.pullY = Math.min(TUG_DEPTH, sim.fromY + sim.elapsed * TUG_SPEED);
			const progress = (sim.pullY - sim.fromY) / (TUG_DEPTH - sim.fromY || 1);
			sim.pullX = sim.tugSide * TUG_SWAY * progress;
		}
		const held = sim.mode === "drag" || sim.mode === "tug";
		const target = pullTarget(sim.pullX, sim.pullY);

		if (latest.current.reducedMotion) {
			if (held) {
				poseStraight(sim, target.x, target.y);
			} else if (sim.mode === "return") {
				const t = Math.min(sim.elapsed / RETURN_DURATION, 1);
				const left = 1 - easeOutCubic(t);
				poseStraight(
					sim,
					CENTER_X + sim.fromX * left,
					REST_PIVOT_Y + sim.fromY * left,
				);
				if (t >= 1) sim.mode = "idle";
			} else {
				settle(sim);
				sim.mode = "idle";
			}
		} else {
			sim.accumulator += elapsed;
			while (sim.accumulator >= STEP) {
				stepSim(sim, held ? target : null);
				sim.accumulator -= STEP;
			}
		}

		// Each bead that passes the fixture's mouth ticks while the chain is held.
		const bead = Math.floor(sim.feed / BEAD_PITCH);
		if (bead !== sim.lastBead) {
			if (held) tick(now);
			sim.lastBead = bead;
		}
		if (sim.mode === "drag") {
			if (!sim.atStop && sim.pullY >= TRAVEL) {
				sim.atStop = true;
				thunk();
			} else if (sim.atStop && sim.pullY < TRAVEL - 6) {
				sim.atStop = false;
			}
		}
		if (
			sim.mode === "tug" &&
			sim.elapsed >= (TUG_DEPTH - sim.fromY) / TUG_SPEED + TUG_HOLD
		) {
			release(true);
		}

		if (sim.mode === "free" && sim.feed === 0) {
			let farthest = 0;
			for (let node = 1; node < NODES; node++) {
				farthest = Math.max(
					farthest,
					Math.abs(sim.x[node] - CENTER_X),
					Math.abs(sim.y[node] - restY(node)),
				);
			}
			sim.calmFrames = farthest < SETTLE_DISTANCE ? sim.calmFrames + 1 : 0;
			// Snap the last fraction of a pixel so the chain rests perfectly still.
			if (sim.calmFrames >= SETTLE_FRAMES) {
				settle(sim);
				sim.mode = "idle";
			}
		}

		paint();
		if (sim.mode !== "idle") wake();
		else sim.lastTime = null;
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

	const tug = () => {
		const sim = getSim();
		if (sim.mode === "drag" || sim.mode === "tug") return;
		if (latest.current.reducedMotion) {
			flip();
			return;
		}
		sim.mode = "tug";
		sim.fromY = Math.max(0, sim.y[PIVOT] - REST_PIVOT_Y);
		sim.pullY = sim.fromY;
		sim.pullX = 0;
		sim.tugSide = sim.tugSide > 0 ? -1 : 1;
		sim.elapsed = 0;
		sim.lastBead = Math.floor(sim.feed / BEAD_PITCH);
		wake();
	};

	const scaleOf = () => {
		const root = rootRef.current;
		if (!root) return 1;
		// CSS zoom and transforms scale client coordinates; work in local px.
		return root.getBoundingClientRect().width / (root.offsetWidth || 1) || 1;
	};

	const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		suppressClickRef.current = false;
		if (disabled || event.button !== 0 || dragRef.current) return;
		const sim = getSim();
		if (sim.mode === "tug") return;
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			pointerId: event.pointerId,
			originX: event.clientX,
			originY: event.clientY,
			// Grabbing a swinging handle picks it up where it is.
			startX: (sim.x[PIVOT] - CENTER_X) / SWAY_FACTOR,
			startY: Math.max(0, sim.y[PIVOT] - REST_PIVOT_Y),
			scale: scaleOf(),
			moved: false,
		};
	};

	const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = (event.clientX - drag.originX) / drag.scale;
		const dy = (event.clientY - drag.originY) / drag.scale;
		const sim = getSim();
		if (!drag.moved) {
			if (Math.hypot(dx, dy) < DRAG_SLOP) return;
			drag.moved = true;
			sim.mode = "drag";
			sim.atStop = false;
			sim.lastBead = Math.floor(sim.feed / BEAD_PITCH);
			setPulling(true);
		}
		sim.pullX = drag.startX + dx;
		sim.pullY = drag.startY + dy;
		wake();
	};

	const endDrag = (pointerId: number | undefined, commit: boolean) => {
		const drag = dragRef.current;
		if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
			return;
		}
		dragRef.current = null;
		const handle = handleRef.current;
		if (handle?.hasPointerCapture(drag.pointerId)) {
			handle.releasePointerCapture(drag.pointerId);
		}
		if (!drag.moved) return;
		// The click that follows a pull isn't a tug.
		suppressClickRef.current = commit;
		setPulling(false);
		release(commit);
	};

	const handleClick = () => {
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}
		if (disabled) return;
		tug();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		// Holding a key shouldn't flicker the light.
		if (event.repeat && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
		}
	};

	// Losing the window or the tab mid-pull lets go without flipping.
	const cancelRef = useRef(() => endDrag(undefined, false));
	useLayoutEffect(() => {
		cancelRef.current = () => endDrag(undefined, false);
	});

	useEffect(() => {
		if (!pulling) return;
		const cancel = () => cancelRef.current();
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") cancel();
		};
		window.addEventListener("blur", cancel);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.removeEventListener("blur", cancel);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [pulling]);

	useEffect(() => {
		if (disabled) cancelRef.current();
	}, [disabled]);

	// iOS can still scroll the page under a captured pointer; block it mid-pull.
	useEffect(() => {
		const handle = handleRef.current;
		if (!handle) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current) event.preventDefault();
		};
		handle.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => handle.removeEventListener("touchmove", onTouchMove);
	}, []);

	const state = checked ? "on" : "off";

	return (
		<div
			ref={rootRef}
			data-slot="pull-cord"
			data-state={state}
			data-pulling={pulling || undefined}
			data-disabled={disabled || undefined}
			{...props}
			className={cn(
				"group/pull-cord relative h-[304px] w-[200px] shrink-0 select-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
		>
			{/* Warm light cast under the fixture. */}
			<div
				aria-hidden
				data-slot="pull-cord-light"
				className="pointer-events-none absolute inset-x-0 top-0 h-[260px] opacity-0 transition-opacity duration-200 ease-out group-data-[state=on]/pull-cord:opacity-100 motion-reduce:transition-none dark:group-data-[state=on]/pull-cord:opacity-80"
				style={{
					background:
						"radial-gradient(60px 15px at 50% 41px, rgb(255 184 92 / 0.6), rgb(255 184 92 / 0)), radial-gradient(92px 210px at 50% 36px, rgb(255 196 120 / 0.3), rgb(255 196 120 / 0.1) 50%, rgb(255 196 120 / 0) 100%)",
					// No light above the fixture's rim.
					maskImage: "linear-gradient(to bottom, transparent 24px, #000 40px)",
				}}
			/>

			<svg
				aria-hidden
				data-slot="pull-cord-chain"
				width={WIDTH}
				height={HEIGHT}
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="pointer-events-none absolute inset-0 overflow-visible"
			>
				<defs>
					<radialGradient
						id={gradientId("bead")}
						cx="0.5"
						cy="0.5"
						r="0.5"
						fx="0.36"
						fy="0.3"
					>
						<stop
							offset="0"
							className="[stop-color:#fff] dark:[stop-color:#fff]"
						/>
						<stop
							offset="0.24"
							className="[stop-color:#eceef1] dark:[stop-color:#f4f5f7]"
						/>
						<stop
							offset="0.64"
							className="[stop-color:#9ba1aa] dark:[stop-color:#b8bec7]"
						/>
						<stop
							offset="1"
							className="[stop-color:#575d66] dark:[stop-color:#7a818c]"
						/>
					</radialGradient>
				</defs>
				{/* The tiny links between beads. */}
				<path
					ref={chainRef}
					d={restPath}
					fill="none"
					strokeWidth={1.1}
					strokeLinecap="round"
					strokeLinejoin="round"
					className="stroke-[#8b919a] dark:stroke-[#a6acb5]"
				/>
				{Array.from({ length: MAX_BEADS }, (_, bead) => (
					<circle
						key={bead}
						ref={(element) => {
							beadRefs.current[bead] = element;
						}}
						cx={bead < restCount ? round(restBeads[bead * 2]) : CENTER_X}
						cy={bead < restCount ? round(restBeads[bead * 2 + 1]) : ANCHOR_Y}
						r={BEAD_RADIUS}
						fill={url("bead")}
						display={bead < restCount ? undefined : "none"}
					/>
				))}
			</svg>

			<svg
				aria-hidden
				data-slot="pull-cord-fixture"
				width={WIDTH}
				height={52}
				viewBox={`0 0 ${WIDTH} 52`}
				className="pointer-events-none absolute top-0 left-0 overflow-visible drop-shadow-[0_6px_10px_rgb(0_0_0/0.07)] dark:drop-shadow-[0_6px_12px_rgb(0_0_0/0.5)]"
			>
				<defs>
					<linearGradient
						id={gradientId("housing")}
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop
							offset="0"
							className="[stop-color:#ffffff] dark:[stop-color:#4a4a52]"
						/>
						<stop
							offset="0.45"
							className="[stop-color:#f4f4f5] dark:[stop-color:#36363d]"
						/>
						<stop
							offset="1"
							className="[stop-color:#dcdce1] dark:[stop-color:#232327]"
						/>
					</linearGradient>
					{/* Turns the dish's sides away from the light. Each fade keeps its
					    own color, since SVG blends black into white through grey. */}
					<linearGradient id={gradientId("sheen")} x1="0" y1="0" x2="1" y2="0">
						<stop
							offset="0"
							className="[stop-color:#000] [stop-opacity:0.08] dark:[stop-opacity:0.4]"
						/>
						<stop offset="0.24" stopColor="#000" stopOpacity={0} />
						<stop offset="0.24" stopColor="#fff" stopOpacity={0} />
						<stop
							offset="0.4"
							className="[stop-color:#fff] [stop-opacity:0.5] dark:[stop-opacity:0.06]"
						/>
						<stop offset="0.62" stopColor="#fff" stopOpacity={0} />
						<stop offset="0.62" stopColor="#000" stopOpacity={0} />
						<stop
							offset="1"
							className="[stop-color:#000] [stop-opacity:0.1] dark:[stop-opacity:0.45]"
						/>
					</linearGradient>
					<linearGradient id={gradientId("warm")} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0.5" stopColor="#ffc778" stopOpacity={0} />
						<stop
							offset="1"
							className="[stop-color:#ffc778] [stop-opacity:0.28] dark:[stop-opacity:0.5]"
						/>
					</linearGradient>
					<linearGradient id={gradientId("lens")} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0"
							className="[stop-color:#ececef] dark:[stop-color:#2e2e33]"
						/>
						<stop
							offset="1"
							className="[stop-color:#d2d2d8] dark:[stop-color:#1c1c20]"
						/>
					</linearGradient>
					<linearGradient
						id={gradientId("lens-on")}
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop offset="0" stopColor="#fff6e2" />
						<stop offset="0.5" stopColor="#ffe3a8" />
						<stop offset="1" stopColor="#ffc56b" />
					</linearGradient>
					<radialGradient
						id={gradientId("lens-core")}
						cx="0.5"
						cy="0.35"
						r="0.5"
					>
						<stop offset="0" stopColor="#fffdf8" />
						<stop offset="1" stopColor="#fffdf8" stopOpacity={0} />
					</radialGradient>
					<linearGradient id={gradientId("steel")} x1="0" y1="0" x2="1" y2="0">
						<stop
							offset="0"
							className="[stop-color:#6f747d] dark:[stop-color:#80868f]"
						/>
						<stop
							offset="0.32"
							className="[stop-color:#eef0f2] dark:[stop-color:#f4f5f7]"
						/>
						<stop
							offset="0.55"
							className="[stop-color:#bfc3c9] dark:[stop-color:#c9cdd3]"
						/>
						<stop
							offset="1"
							className="[stop-color:#5f646c] dark:[stop-color:#737983]"
						/>
					</linearGradient>
				</defs>

				{/* Housing: a soft ceramic dish with a lit lip when on. */}
				<path
					d="M48 2H152Q158 2 158 8C158 21 151 31.5 137 34H63C49 31.5 42 21 42 8Q42 2 48 2Z"
					fill={url("housing")}
				/>
				<path
					d="M48 2H152Q158 2 158 8C158 21 151 31.5 137 34H63C49 31.5 42 21 42 8Q42 2 48 2Z"
					fill={url("sheen")}
				/>
				<path
					d="M48 2H152Q158 2 158 8C158 21 151 31.5 137 34H63C49 31.5 42 21 42 8Q42 2 48 2Z"
					fill={url("warm")}
					className="opacity-0 transition-opacity duration-200 ease-out group-data-[state=on]/pull-cord:opacity-100 motion-reduce:transition-none"
				/>
				<path
					d="M48 2H152Q158 2 158 8C158 21 151 31.5 137 34H63C49 31.5 42 21 42 8Q42 2 48 2Z"
					fill="none"
					strokeWidth={0.75}
					className="stroke-foreground/12 dark:stroke-white/8"
				/>
				{/* Top highlight. */}
				<path
					d="M49 2.6H151"
					strokeWidth={0.8}
					strokeLinecap="round"
					className="stroke-white/90 dark:stroke-white/20"
				/>

				{/* Diffuser lens. */}
				<path
					d="M64 33.5H136C134 39.5 124 42.5 100 42.5C76 42.5 66 39.5 64 33.5Z"
					fill={url("lens")}
				/>
				<g className="opacity-0 transition-opacity duration-200 ease-out group-data-[state=on]/pull-cord:opacity-100 motion-reduce:transition-none">
					<path
						d="M64 33.5H136C134 39.5 124 42.5 100 42.5C76 42.5 66 39.5 64 33.5Z"
						fill={url("lens-on")}
					/>
					<ellipse cx={100} cy={37.5} rx={28} ry={4} fill={url("lens-core")} />
				</g>
				<path
					d="M64 33.5H136"
					strokeWidth={0.75}
					className="stroke-black/12 dark:stroke-black/50"
				/>

				{/* The bushing the chain runs through. */}
				<rect
					x={95}
					y={40.5}
					width={10}
					height={2.5}
					rx={1}
					fill={url("steel")}
				/>
				<rect x={96} y={42} width={8} height={7} rx={1.6} fill={url("steel")} />
				<rect
					x={96}
					y={42}
					width={8}
					height={7}
					rx={1.6}
					fill="none"
					strokeWidth={0.5}
					className="stroke-black/15 dark:stroke-black/40"
				/>
			</svg>

			<button
				ref={handleRef}
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? label)}
				aria-labelledby={ariaLabelledBy}
				aria-describedby={ariaDescribedBy}
				disabled={disabled}
				data-slot="pull-cord-handle"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={(event) => endDrag(event.pointerId, true)}
				onPointerCancel={(event) => endDrag(event.pointerId, false)}
				onLostPointerCapture={(event) => endDrag(event.pointerId, false)}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onContextMenu={(event) => event.preventDefault()}
				className="group/handle absolute top-0 left-0 h-16 w-12 cursor-grab touch-none outline-none will-change-transform [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] disabled:cursor-not-allowed group-data-pulling/pull-cord:cursor-grabbing"
				style={{
					transform: restTransform,
					transformOrigin: `${PIVOT_IN_BUTTON.x}px ${PIVOT_IN_BUTTON.y}px`,
				}}
			>
				<span
					aria-hidden
					className="absolute top-[5px] left-2.5 h-[58px] w-7 rounded-full group-focus-visible/handle:ring-3 group-focus-visible/handle:ring-ring/50 group-focus-visible/handle:ring-offset-2 group-focus-visible/handle:ring-offset-background"
				/>
				<svg
					aria-hidden
					width={24}
					height={58}
					viewBox="0 0 24 58"
					className="absolute top-0 left-3 overflow-visible drop-shadow-[0_5px_5px_rgb(0_0_0/0.16)] dark:drop-shadow-[0_5px_6px_rgb(0_0_0/0.55)]"
				>
					<defs>
						<linearGradient id={gradientId("wood")} x1="0" y1="0" x2="1" y2="0">
							<stop offset="0" stopColor="#8a5a30" />
							<stop offset="0.16" stopColor="#b7824f" />
							<stop offset="0.36" stopColor="#e3bd8f" />
							<stop offset="0.52" stopColor="#d5a774" />
							<stop offset="0.8" stopColor="#a6713f" />
							<stop offset="1" stopColor="#7a4c25" />
						</linearGradient>
						<linearGradient
							id={gradientId("wood-shade")}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop offset="0" stopColor="#2b1a0c" stopOpacity={0.35} />
							<stop offset="0.16" stopColor="#2b1a0c" stopOpacity={0} />
							<stop offset="0.72" stopColor="#2b1a0c" stopOpacity={0} />
							<stop offset="1" stopColor="#2b1a0c" stopOpacity={0.3} />
						</linearGradient>
						<linearGradient
							id={gradientId("wood-glint")}
							x1="0"
							y1="12"
							x2="0"
							y2="52"
							gradientUnits="userSpaceOnUse"
						>
							<stop offset="0" stopColor="#fff" stopOpacity={0} />
							<stop offset="0.55" stopColor="#fff" stopOpacity={0.5} />
							<stop offset="1" stopColor="#fff" stopOpacity={0} />
						</linearGradient>
					</defs>
					{/* Turned oak drop. */}
					<path
						d="M9 8.5H15C15.6 18 22 28 22 41C22 49.6 17.6 55 12 55C6.4 55 2 49.6 2 41C2 28 8.4 18 9 8.5Z"
						fill={url("wood")}
					/>
					<path
						d="M9 8.5H15C15.6 18 22 28 22 41C22 49.6 17.6 55 12 55C6.4 55 2 49.6 2 41C2 28 8.4 18 9 8.5Z"
						fill={url("wood-shade")}
					/>
					{/* Grain, following the turn. */}
					<path
						d="M11.4 11C11.8 22 16.2 30 16.4 41C16.5 47.5 14.6 51.5 12.6 53.6M10.2 13C9.4 24 6.4 32 6.6 42C6.7 46.5 7.6 49.5 8.8 51.5"
						fill="none"
						stroke="#5a3415"
						strokeOpacity={0.09}
						strokeWidth={0.5}
						strokeLinecap="round"
					/>
					<path
						d="M9.7 13C9 24 5.2 31 5.1 41C5 46 6.2 49.6 8 51.6"
						fill="none"
						stroke={url("wood-glint")}
						strokeWidth={1.4}
						strokeLinecap="round"
					/>
					<path
						d="M9 8.5H15C15.6 18 22 28 22 41C22 49.6 17.6 55 12 55C6.4 55 2 49.6 2 41C2 28 8.4 18 9 8.5Z"
						fill="none"
						stroke="#4a2a10"
						strokeOpacity={0.22}
						strokeWidth={0.5}
					/>
					{/* Steel ferrule the chain is crimped into. */}
					<rect
						x={9.5}
						y={0}
						width={5}
						height={9.5}
						rx={1.4}
						fill={url("steel")}
					/>
					<path
						d="M9.6 3.4H14.4M9.6 6H14.4"
						strokeWidth={0.45}
						className="stroke-black/20"
					/>
				</svg>
			</button>

			{name ? (
				<input type="hidden" name={name} value={state} disabled={disabled} />
			) : null}
		</div>
	);
}

export default PullCord;
