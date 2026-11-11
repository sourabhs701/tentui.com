"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	cancelFrame,
	frame,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "motion/react";
import {
	type ComponentProps,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Layout, in px at `md`. Every length is drawn off one CSS unit, so `sm` is
// the same switch scaled down and nothing is tuned twice.
const TRACK_WIDTH = 84;
const TRACK_HEIGHT = 44;
const TRACK_RADIUS = 14;
/** Gap between the thumb and the track, all round. */
const INSET = 3;
const THUMB_WIDTH = 40;
const THUMB_HEIGHT = 38;
/** Concentric with the track: track radius = thumb radius + inset. */
const THUMB_RADIUS = TRACK_RADIUS - INSET;
const TRAVEL = TRACK_WIDTH - INSET * 2 - THUMB_WIDTH;
/** `sm` draws the 44 px tall track 34 px tall. */
const SIZE_SCALE = { sm: 34 / TRACK_HEIGHT, md: 1 } as const;

// Motion. Progress runs from 0 (off) to 1 (on) and drives everything.
const thumbSpring = { type: "spring", stiffness: 560, damping: 32 } as const;
/**
 * The rim light follows the thumb on a looser spring, so it lands about 100 ms
 * after it. Damped so it overshoots by under half a pixel and never visibly
 * runs backwards.
 */
const rimSpring = { stiffness: 300, damping: 30 } as const;
/** Furthest the thumb is drawn past either end, in px. */
const MAX_OVERSHOOT = 2;
/** Furthest a drag rubber-bands past either end, in px. */
const MAX_BAND = 2;
/** Pointer travel, in px, before a press becomes a drag. */
const DRAG_SLOP = 3;
/** Release speed, in px/s, that flips the switch whatever its position. */
const FLICK_SPEED = 300;
/** Cuts the bevel band out of the glass as a ring just inside its edge. */
const BEVEL_MASK = {
	maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
	maskClip: "content-box, border-box",
	maskComposite: "exclude",
} satisfies CSSProperties;
/** Ms of pointer samples used for the release speed. */
const VELOCITY_WINDOW = 100;
/** Thumb speed, in px/s, that gets the full squash and pixel lag. */
const FULL_SPEED = 420;
/** Width the thumb stretches to at full speed; it loses 0.4 of that in height. */
const MAX_STRETCH = 0.07;
/** Furthest the pixels trail the thumb, in px. */
const MAX_LAG = 2;
/** Light level at rest, as a share of the hover level. */
const REST_GLOW = 0.7;
/** The bloom when off, as a share of the bloom when on. */
const OFF_BLOOM = 0.6;
/** Peak of the bloom's warm-up pulse when the thumb lands. */
const PULSE_PEAK = 1.3;
const PULSE_DURATION = 0.5;

// The rim light: a line that floats a hairline outside the thumb.
const RIM_OFFSET = 1.5;
const RIM_RADIUS = THUMB_RADIUS + RIM_OFFSET;
const RIM_LEFT = -RIM_OFFSET;
const RIM_TOP = -RIM_OFFSET;
const RIM_RIGHT = THUMB_WIDTH + RIM_OFFSET;
const RIM_BOTTOM = THUMB_HEIGHT + RIM_OFFSET;
const RIM_FLAT_X = RIM_RIGHT - RIM_LEFT - RIM_RADIUS * 2;
const RIM_FLAT_Y = RIM_BOTTOM - RIM_TOP - RIM_RADIUS * 2;
const RIM_CORNER = (Math.PI * RIM_RADIUS) / 2;
const RIM_PERIMETER = (RIM_FLAT_X + RIM_FLAT_Y) * 2 + RIM_CORNER * 4;
/**
 * The outline, counterclockwise on screen from the bottom-left end of the
 * bottom edge: along the bottom, up the right, back along the top, and down
 * the left. A flip moves the light half a lap along it, always forward.
 */
const RIM_PATH = [
	`M${RIM_LEFT + RIM_RADIUS} ${RIM_BOTTOM}`,
	`H${RIM_RIGHT - RIM_RADIUS}`,
	`A${RIM_RADIUS} ${RIM_RADIUS} 0 0 0 ${RIM_RIGHT} ${RIM_BOTTOM - RIM_RADIUS}`,
	`V${RIM_TOP + RIM_RADIUS}`,
	`A${RIM_RADIUS} ${RIM_RADIUS} 0 0 0 ${RIM_RIGHT - RIM_RADIUS} ${RIM_TOP}`,
	`H${RIM_LEFT + RIM_RADIUS}`,
	`A${RIM_RADIUS} ${RIM_RADIUS} 0 0 0 ${RIM_LEFT} ${RIM_TOP + RIM_RADIUS}`,
	`V${RIM_BOTTOM - RIM_RADIUS}`,
	`A${RIM_RADIUS} ${RIM_RADIUS} 0 0 0 ${RIM_LEFT + RIM_RADIUS} ${RIM_BOTTOM}Z`,
].join("");
/**
 * Where the light rests when off, as a share of the outline: on the bottom
 * edge, 30% in from the left. On rests half a lap on, on the top edge 70% in.
 */
const RIM_OFF_AT =
	(THUMB_WIDTH * 0.3 - (RIM_LEFT + RIM_RADIUS)) / RIM_PERIMETER;
/** Length of the light, as a share of the outline, at rest and lit. */
const ARC_REST = 0.36;
const ARC_LIT = 0.42;
/**
 * The line is stacked strokes, each shorter and wider than the last, so its
 * ends taper over their last 15%.
 */
const RIM_LINE = [0.4, 0.6, 0.8, 1, 1.15, 1.25].map((width, index, all) => ({
	share: 1 - (0.3 * index) / (all.length - 1),
	width,
}));
/** The white-hot core, shorter than the line so it fades in from the tips. */
const RIM_CORE_SHARE = 0.62;

// Glyphs: two bitmaps on the same 13 × 13 grid with the same number of cells,
// so every moon pixel has a sun pixel to fly to. `#` is lit, `+` a twinkle,
// `:` a dimmer dither pixel, and `,` an unlit one that only pads the count.
const MOON = [
	".......+.....",
	"..........#..",
	".........###.",
	"...##.:.:.#..",
	"..##.:.:.....",
	".###:.:.:...+",
	".###.:.:.:...",
	".####.:.:....",
	".####:.:.:...",
	".######.:....",
	"..#######....",
	"...#####...+.",
	".............",
];
const SUN = [
	".............",
	".#.....#....#",
	"..#.,..#.,.#.",
	".............",
	"..,.:####:.,.",
	"....######...",
	".##.######...",
	"....######.##",
	"....######...",
	"..,.:####:.,.",
	".............",
	"..#.,.#..,.#.",
	".#....#.....#",
];
const CELL_OPACITY: Record<string, number> = {
	"#": 1,
	"+": 0.7,
	":": 0.35,
	",": 0,
};
/** Distance between pixel centers, in px. */
const PIXEL_PITCH = 1.5;
const PIXEL_SIZE = 1.1;
/** How far the pixels fly apart mid-flip, in px. */
const SCATTER_MIN = 2;
const SCATTER_MAX = 6.5;

// A fingernail on a thick tumbler: a bright tick of band-passed noise over a
// short, faint ring. On is a touch higher and brighter than off.
const TAP_ON_SOUND = {
	name: "glass-toggle-tap-on",
	baseFreq: 880,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 6400,
	filterQ: 3,
	attack: 0.001,
	decay: 0.7,
	brightness: 6000,
} as const;
const TAP_OFF_SOUND = {
	...TAP_ON_SOUND,
	name: "glass-toggle-tap-off",
	filterFreq: 5200,
	decay: 0.6,
} as const;
/** A narrow band of noise rings like struck glass, about 12 dB under the tap. */
const RING_ON_SOUND = {
	name: "glass-toggle-ring-on",
	baseFreq: 880,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 3150,
	filterQ: 22,
	attack: 0.002,
	decay: 5,
	brightness: 6000,
} as const;
const RING_OFF_SOUND = {
	...RING_ON_SOUND,
	name: "glass-toggle-ring-off",
	filterFreq: 2650,
	decay: 4.2,
} as const;

interface Pixel {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	fromOpacity: number;
	toOpacity: number;
	scatterX: number;
	scatterY: number;
	/** How much this pixel trails the thumb, from 0.55 to 1. */
	mass: number;
	/** Dither and twinkle pixels fade out as they travel. */
	faint: boolean;
}

interface Cell {
	x: number;
	y: number;
	opacity: number;
}

/** Reads a bitmap into cells, in px from its center. */
function readGlyph(rows: string[]) {
	const cells: Cell[] = [];
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	rows.forEach((row, y) => {
		[...row].forEach((char, x) => {
			const opacity = CELL_OPACITY[char];
			if (opacity === undefined) return;
			cells.push({ x, y, opacity });
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});
	});
	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;
	return cells
		.map((cell) => ({
			x: (cell.x - centerX) * PIXEL_PITCH,
			y: (cell.y - centerY) * PIXEL_PITCH,
			opacity: cell.opacity,
		}))
		.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
}

/** A seeded random number in [0, 1), the same on the server and the client. */
function seeded(seed: number) {
	let t = (seed * 0x9e3779b9 + 0x6d2b79f5) | 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Pairs moon and sun pixels by their angle round the center, turning the sun
 * to whichever offset keeps the paths shortest, so they don't cross wildly.
 */
function pairPixels(): Pixel[] {
	const moon = readGlyph(MOON);
	const sun = readGlyph(SUN);
	const count = moon.length;
	let bestShift = 0;
	let bestCost = Number.POSITIVE_INFINITY;
	for (let shift = 0; shift < count; shift++) {
		let cost = 0;
		for (let index = 0; index < count; index++) {
			const to = sun[(index + shift) % count];
			cost += (moon[index].x - to.x) ** 2 + (moon[index].y - to.y) ** 2;
		}
		if (cost < bestCost) {
			bestCost = cost;
			bestShift = shift;
		}
	}
	return moon.map((from, index) => {
		const to = sun[(index + bestShift) % count];
		const angle =
			Math.atan2(from.y + to.y, from.x + to.x) +
			(seeded(index * 3 + 1) - 0.5) * 1.8;
		const distance =
			SCATTER_MIN + seeded(index * 3 + 2) * (SCATTER_MAX - SCATTER_MIN);
		return {
			fromX: from.x,
			fromY: from.y,
			toX: to.x,
			toY: to.y,
			fromOpacity: from.opacity,
			toOpacity: to.opacity,
			scatterX: Math.cos(angle) * distance,
			scatterY: Math.sin(angle) * distance,
			mass: 0.55 + seeded(index * 3 + 3) * 0.45,
			faint: from.opacity < 1 || to.opacity < 1,
		};
	});
}

const PIXELS = pairPixels();

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

/** Eases `over` toward `limit`, never reaching it. */
function band(over: number, limit: number) {
	return (over * limit) / (over + limit);
}

function smoothstep(t: number) {
	return t * t * (3 - 2 * t);
}

/** A length in px at `md`, scaled with the size. */
function u(px: number) {
	return `calc(var(--gt-u) * ${px})`;
}

/** Where a pixel sits, and how bright it is, at `progress`. */
function pixelAt(pixel: Pixel, progress: number, lag: number) {
	const t = smoothstep(progress);
	const spread = Math.sin(Math.PI * progress);
	const opacity =
		(pixel.fromOpacity + (pixel.toOpacity - pixel.fromOpacity) * t) *
		(1 - (pixel.faint ? 0.65 : 0.15) * spread);
	return {
		x: round(
			THUMB_WIDTH / 2 +
				pixel.fromX +
				(pixel.toX - pixel.fromX) * t +
				pixel.scatterX * spread +
				lag * pixel.mass -
				PIXEL_SIZE / 2,
		),
		y: round(
			THUMB_HEIGHT / 2 +
				pixel.fromY +
				(pixel.toY - pixel.fromY) * t +
				pixel.scatterY * spread -
				PIXEL_SIZE / 2,
		),
		opacity: round(opacity),
	};
}

/** A point on the rim's outline, `at` a share of the way round it. */
function rimPoint(at: number) {
	let along = (((at % 1) + 1) % 1) * RIM_PERIMETER;
	const corner = (cx: number, cy: number, from: number) => {
		const angle = from - (along / RIM_CORNER) * (Math.PI / 2);
		return {
			x: cx + Math.cos(angle) * RIM_RADIUS,
			y: cy + Math.sin(angle) * RIM_RADIUS,
		};
	};
	const runs = [
		RIM_FLAT_X,
		RIM_CORNER,
		RIM_FLAT_Y,
		RIM_CORNER,
		RIM_FLAT_X,
		RIM_CORNER,
		RIM_FLAT_Y,
		RIM_CORNER,
	];
	let run = 0;
	while (run < runs.length - 1 && along > runs[run]) {
		along -= runs[run];
		run++;
	}
	switch (run) {
		case 0:
			return { x: RIM_LEFT + RIM_RADIUS + along, y: RIM_BOTTOM };
		case 1:
			return corner(
				RIM_RIGHT - RIM_RADIUS,
				RIM_BOTTOM - RIM_RADIUS,
				Math.PI / 2,
			);
		case 2:
			return { x: RIM_RIGHT, y: RIM_BOTTOM - RIM_RADIUS - along };
		case 3:
			return corner(RIM_RIGHT - RIM_RADIUS, RIM_TOP + RIM_RADIUS, 0);
		case 4:
			return { x: RIM_RIGHT - RIM_RADIUS - along, y: RIM_TOP };
		case 5:
			return corner(RIM_LEFT + RIM_RADIUS, RIM_TOP + RIM_RADIUS, -Math.PI / 2);
		case 6:
			return { x: RIM_LEFT, y: RIM_TOP + RIM_RADIUS + along };
		default:
			return corner(RIM_LEFT + RIM_RADIUS, RIM_BOTTOM - RIM_RADIUS, Math.PI);
	}
}

/** Dash for a stroke `length` long centered `at` a share of the outline. */
function rimDash(at: number, length: number) {
	return {
		array: `${round(length)} ${round(1 - length)}`,
		offset: String(round(length / 2 - at)),
	};
}

/**
 * Where the light sits for a half-lap count `lap`: even counts rest off, odd
 * counts rest on, and the count only ever grows between flips.
 */
function rimAt(lap: number) {
	return RIM_OFF_AT + (((lap % 2) + 2) % 2) / 2;
}

/** The CSS variables that carry the state to the static layers. */
function stateVars(progress: number, lap: number, glow: number, pulse: number) {
	const lit = clamp(progress, 0, 1);
	const wash = rimPoint(rimAt(lap));
	return {
		"--gt-mix": `${round(lit * 100)}%`,
		"--gt-lit": String(round(lit)),
		"--gt-off-amount": String(round(Math.min(1, 2 * (1 - lit)))),
		"--gt-on-amount": String(round(Math.min(1, 2 * lit))),
		"--gt-glow": String(round(glow)),
		"--gt-bloom": String(
			round(((OFF_BLOOM + (1 - OFF_BLOOM) * lit) * glow * pulse) / PULSE_PEAK),
		),
		"--gt-x": String(
			round(
				clamp(progress, -MAX_OVERSHOOT / TRAVEL, 1 + MAX_OVERSHOOT / TRAVEL) *
					TRAVEL,
			),
		),
		"--gt-wash-x": `${round((wash.x / THUMB_WIDTH) * 100)}%`,
		"--gt-wash-y": `${round((wash.y / THUMB_HEIGHT) * 100)}%`,
	};
}

function arcLength(glow: number) {
	return (
		ARC_REST + ((ARC_LIT - ARC_REST) * (glow - REST_GLOW)) / (1 - REST_GLOW)
	);
}

export interface GlassToggleProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultChecked" | "onChange" | "ref"
	> {
	/** Controlled on/off state. */
	checked?: boolean;
	/** Initial state when uncontrolled. */
	defaultChecked?: boolean;
	/** Called when a click, key press, or drag flips the switch. */
	onCheckedChange?: (checked: boolean) => void;
	/** Accessible name of the switch. Ignored when `aria-label` or `aria-labelledby` is set. */
	label?: string;
	disabled?: boolean;
	/** Submits `"on"` or `"off"` with a native form through a hidden input. */
	name?: string;
	/** `sm` is the same switch drawn at about three quarters of the size. */
	size?: "sm" | "md";
	/** Play a glass tap when the switch flips. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
}

export function GlassToggle({
	checked: checkedProp,
	defaultChecked = false,
	onCheckedChange,
	label = "Toggle",
	disabled = false,
	name,
	size = "md",
	sound = true,
	haptics = true,
	className,
	style,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	"aria-describedby": ariaDescribedBy,
	...props
}: GlassToggleProps) {
	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const controlled = checkedProp !== undefined;
	const checked = controlled ? checkedProp : internalChecked;
	const [pressed, setPressed] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [, rerender] = useReducer((count: number) => count + 1, 0);
	// The first paint, rendered on the server too. Later frames are written
	// straight to the DOM, so React never re-renders while the switch moves.
	const [initial] = useState(() => {
		const progress = checked ? 1 : 0;
		const lap = progress;
		return {
			progress,
			lap,
			vars: stateVars(progress, lap, REST_GLOW, 1),
			pixels: PIXELS.map((pixel) => pixelAt(pixel, progress, 0)),
		};
	});

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playTap, setTheme: setTapSound } = useTiks({
		theme: TAP_ON_SOUND,
		respectReducedMotion: false,
	});
	const { click: playRing, setTheme: setRingSound } = useTiks({
		theme: RING_ON_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const filterId = (part: string) => `glass-toggle-${ids}-${part}`;

	const progress = useMotionValue(initial.progress);
	const rimTarget = useMotionValue(initial.lap);
	const rim = useSpring(rimTarget, rimSpring);
	const glow = useMotionValue(REST_GLOW);
	const pulse = useMotionValue(1);
	const sheenX = useSpring(0, { stiffness: 170, damping: 26 });
	const sheenY = useSpring(0, { stiffness: 170, damping: 26 });

	const rootRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLSpanElement>(null);
	const squashRef = useRef<HTMLSpanElement>(null);
	const pixelRefs = useRef<Array<SVGRectElement | null>>([]);
	const rimRefs = useRef<Array<{ element: SVGPathElement; share: number }>>([]);
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const pulseRef = useRef<AnimationPlaybackControls | null>(null);
	/** Where the thumb is heading: the state it last flipped to. */
	const targetRef = useRef(checked);
	/**
	 * The half lap the light is on: `base` counts finished half laps, and
	 * `from` is the state the current one started from.
	 */
	const lapRef = useRef({ base: initial.lap, from: checked });
	const paintedRef = useRef({ lit: initial.progress, lag: 0 });
	const dragVelocityRef = useRef(0);
	const stillTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const suppressClickRef = useRef(false);
	const dragRef = useRef<{
		pointerId: number;
		originX: number;
		originY: number;
		start: number;
		/** Md px per screen px, so zoom, transforms, and `sm` all work. */
		scale: number;
		moved: boolean;
		samples: Array<{ time: number; x: number }>;
	} | null>(null);

	// Event handlers and the render loop read the latest props through refs.
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

	const paint = () => {
		const root = rootRef.current;
		if (!root) return;
		const value = progress.get();
		const lit = clamp(value, 0, 1);
		const moving = dragRef.current?.moved ?? false;
		const reduced = latest.current.reducedMotion;
		const lap = reduced ? rimTarget.get() : rim.get();
		const level = glow.get();

		const vars = stateVars(value, lap, level, pulse.get());
		for (const key in vars) {
			root.style.setProperty(key, vars[key as keyof typeof vars]);
		}
		root.style.setProperty("--gt-sx", `${round(sheenX.get())}%`);
		root.style.setProperty("--gt-sy", `${round(sheenY.get())}%`);

		// Squash and stretch from speed, anchored on the trailing edge.
		const speed = moving
			? dragVelocityRef.current
			: progress.getVelocity() * TRAVEL;
		const pace = reduced ? 0 : clamp(speed / FULL_SPEED, -1, 1);
		const stretch = MAX_STRETCH * Math.abs(pace);
		const thumb = thumbRef.current;
		const squash = squashRef.current;
		if (thumb)
			thumb.style.transform = `translateX(${u(Number(vars["--gt-x"]))})`;
		if (squash) {
			squash.style.transform = stretch
				? `scale(${round(1 + stretch)}, ${round(1 - stretch * 0.4)})`
				: "";
			squash.style.transformOrigin = pace < 0 ? "100% 50%" : "0% 50%";
		}

		const at = rimAt(lap);
		const length = arcLength(level);
		for (const { element, share } of rimRefs.current) {
			const dash = rimDash(at, length * share);
			element.setAttribute("stroke-dasharray", dash.array);
			element.setAttribute("stroke-dashoffset", dash.offset);
		}

		// The pixels only move when the thumb does.
		const lag = round(-pace * MAX_LAG);
		const painted = paintedRef.current;
		if (painted.lit !== lit || painted.lag !== lag) {
			painted.lit = lit;
			painted.lag = lag;
			const morph = reduced ? Math.round(lit) : lit;
			PIXELS.forEach((pixel, index) => {
				const rect = pixelRefs.current[index];
				if (!rect) return;
				const next = pixelAt(pixel, morph, reduced ? 0 : lag);
				rect.setAttribute("x", String(next.x));
				rect.setAttribute("y", String(next.y));
				rect.setAttribute("opacity", String(next.opacity));
			});
		}

		const idle =
			!moving &&
			!progress.isAnimating() &&
			(reduced || !rim.isAnimating()) &&
			!stretch;
		if (thumb) thumb.style.willChange = idle ? "" : "transform";
	};

	// One render per frame, however many values changed in it.
	const paintRef = useRef(paint);
	useLayoutEffect(() => {
		paintRef.current = paint;
	});
	const scheduledRef = useRef(false);
	const renderRef = useRef(() => {
		scheduledRef.current = false;
		paintRef.current();
	});
	const schedule = useCallback(() => {
		if (scheduledRef.current) return;
		scheduledRef.current = true;
		frame.render(renderRef.current);
	}, []);

	/** Warms the bloom up past its rest level and lets it settle. */
	const warm = () => {
		if (latest.current.reducedMotion) return;
		pulseRef.current?.stop();
		pulseRef.current = animate(pulse, [pulse.get(), PULSE_PEAK, 1], {
			duration: PULSE_DURATION,
			times: [0, 0.16, 1],
			ease: ["easeOut", "easeInOut"],
		});
	};

	/**
	 * Moves the light along its half lap. When the thumb lands on the far end
	 * of a flip, the lap is finished and the next flip carries on forward.
	 */
	const followThumb = (value: number) => {
		const lap = lapRef.current;
		const heading = targetRef.current;
		const dragged = dragRef.current?.moved ?? false;
		if (
			!dragged &&
			heading !== lap.from &&
			(heading ? value >= 1 : value <= 0)
		) {
			lap.base += 1;
			lap.from = heading;
			warm();
		}
		const lit = clamp(value, 0, 1);
		const next = lap.base + (lap.from ? 1 - lit : lit);
		if (latest.current.reducedMotion) rim.jump(next);
		rimTarget.set(next);
	};

	const followRef = useRef(followThumb);
	useLayoutEffect(() => {
		followRef.current = followThumb;
	});

	useEffect(() => {
		const repaint = () => schedule();
		const unsubscribe = [
			progress.on("change", (value) => {
				followRef.current(value);
				repaint();
			}),
			rim.on("change", repaint),
			rim.on("animationComplete", repaint),
			glow.on("change", repaint),
			pulse.on("change", repaint),
			sheenX.on("change", repaint),
			sheenY.on("change", repaint),
		];
		return () => {
			for (const stop of unsubscribe) stop();
			cancelFrame(renderRef.current);
			scheduledRef.current = false;
			animationRef.current?.stop();
			pulseRef.current?.stop();
			clearTimeout(stillTimerRef.current);
		};
	}, [glow, progress, pulse, rim, schedule, sheenX, sheenY]);

	/** Springs the thumb to `next`, carrying `velocity` in progress per second. */
	const go = (next: boolean, velocity?: number) => {
		targetRef.current = next;
		const to = next ? 1 : 0;
		animationRef.current?.stop();
		if (thumbRef.current) thumbRef.current.style.willChange = "transform";
		if (latest.current.reducedMotion) {
			progress.jump(to);
			followRef.current(to);
			return;
		}
		animationRef.current = animate(progress, to, {
			...thumbSpring,
			velocity: velocity ?? progress.getVelocity(),
			restDelta: 0.001,
			restSpeed: 0.02,
			onComplete: schedule,
		});
		// A thumb already at the end finishes its lap without moving.
		followRef.current(progress.get());
	};

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	// Called only for user input, so the first render and prop changes stay quiet.
	const flipTo = (next: boolean, velocity?: number) => {
		if (next !== latest.current.checked) {
			latest.current.checked = next;
			// When controlled, re-render anyway, so a parent that keeps the old
			// state sends the thumb back.
			if (latest.current.controlled) rerender();
			else setInternalChecked(next);
			latest.current.onCheckedChange?.(next);
			if (!silent()) {
				if (latest.current.sound) {
					setTapSound(next ? TAP_ON_SOUND : TAP_OFF_SOUND);
					setRingSound(next ? RING_ON_SOUND : RING_OFF_SOUND);
					playTap();
					playRing();
				}
				if (latest.current.haptics) void haptic("light");
			}
		}
		go(next, velocity);
	};

	// A parent changing `checked` moves the thumb exactly like a flip, silently.
	useLayoutEffect(() => {
		if (dragRef.current?.moved || checked === targetRef.current) return;
		go(checked);
	});

	// Hover and press turn the light up.
	useEffect(() => {
		const level = !disabled && (hovered || pressed) ? 1 : REST_GLOW;
		const controls = animate(glow, level, {
			duration: pressed ? 0.08 : 0.2,
			ease: "easeOut",
		});
		return () => controls.stop();
	}, [disabled, glow, hovered, pressed]);

	const scaleOf = () => {
		const root = rootRef.current;
		if (!root) return 1;
		return TRACK_WIDTH / (root.getBoundingClientRect().width || TRACK_WIDTH);
	};

	const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		suppressClickRef.current = false;
		if (disabled || event.button !== 0 || dragRef.current) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			pointerId: event.pointerId,
			originX: event.clientX,
			originY: event.clientY,
			start: progress.get(),
			scale: scaleOf(),
			moved: false,
			samples: [{ time: event.timeStamp, x: event.clientX }],
		};
		setPressed(true);
	};

	const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType !== "touch" && !dragRef.current) {
			// The pointer is the light: the sheen leans a little toward it.
			const thumb = thumbRef.current?.getBoundingClientRect();
			if (thumb?.width) {
				const x =
					(event.clientX - (thumb.left + thumb.width / 2)) / thumb.width;
				const y =
					(event.clientY - (thumb.top + thumb.height / 2)) / thumb.height;
				sheenX.set(clamp(x, -1, 1) * 8);
				sheenY.set(clamp(y, -1, 1) * 5);
			}
		}
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = event.clientX - drag.originX;
		const dy = event.clientY - drag.originY;
		if (!drag.moved) {
			if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy)) return;
			drag.moved = true;
			animationRef.current?.stop();
			// Pick the thumb up where it is, mid-flight or not.
			drag.start = progress.get();
			drag.originX = event.clientX;
			setDragging(true);
		}
		drag.samples.push({ time: event.timeStamp, x: event.clientX });
		while (
			drag.samples.length > 2 &&
			event.timeStamp - drag.samples[0].time > VELOCITY_WINDOW
		) {
			drag.samples.shift();
		}
		const first = drag.samples[0];
		const elapsed = (event.timeStamp - first.time) / 1000;
		dragVelocityRef.current =
			elapsed > 0 ? ((event.clientX - first.x) * drag.scale) / elapsed : 0;
		// A held pointer has no speed, so the thumb unsquashes.
		clearTimeout(stillTimerRef.current);
		stillTimerRef.current = setTimeout(() => {
			dragVelocityRef.current = 0;
			schedule();
		}, 60);

		const raw =
			drag.start * TRAVEL + (event.clientX - drag.originX) * drag.scale;
		const position =
			raw < 0
				? -band(-raw, MAX_BAND)
				: raw > TRAVEL
					? TRAVEL + band(raw - TRAVEL, MAX_BAND)
					: raw;
		progress.set(position / TRAVEL);
	};

	const endDrag = (pointerId: number | undefined, commit: boolean) => {
		const drag = dragRef.current;
		if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
			return;
		}
		dragRef.current = null;
		setPressed(false);
		const button = rootRef.current?.querySelector("button");
		if (button?.hasPointerCapture(drag.pointerId)) {
			button.releasePointerCapture(drag.pointerId);
		}
		if (!drag.moved) return;
		setDragging(false);
		clearTimeout(stillTimerRef.current);
		// The click that follows a drag isn't a flip, even when the drag was
		// cancelled before the pointer came up.
		suppressClickRef.current = true;

		const first = drag.samples[0];
		const last = drag.samples[drag.samples.length - 1];
		const elapsed = (last.time - first.time) / 1000;
		const recent =
			performance.now() - last.time < VELOCITY_WINDOW && elapsed > 0;
		const speed = recent ? (last.x - first.x) / elapsed : 0;
		const velocity = (speed * drag.scale) / TRAVEL;
		dragVelocityRef.current = 0;
		if (!commit) {
			go(latest.current.checked, 0);
			return;
		}
		const next =
			Math.abs(speed) > FLICK_SPEED ? speed > 0 : progress.get() > 0.5;
		flipTo(next, velocity);
	};

	const handleClick = () => {
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}
		if (disabled) return;
		flipTo(!latest.current.checked);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		suppressClickRef.current = false;
		// Holding a key shouldn't flicker the switch.
		if (event.repeat && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
		}
	};

	const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType !== "touch") setHovered(true);
	};

	const handlePointerLeave = () => {
		setHovered(false);
		sheenX.set(0);
		sheenY.set(0);
	};

	// Losing the window or the tab mid-drag lets go without flipping.
	const cancelRef = useRef(() => endDrag(undefined, false));
	useLayoutEffect(() => {
		cancelRef.current = () => endDrag(undefined, false);
	});

	useEffect(() => {
		if (!pressed) return;
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
	}, [pressed]);

	useEffect(() => {
		if (disabled) cancelRef.current();
	}, [disabled]);

	// iOS can still scroll the page under a captured pointer; block it mid-drag.
	useEffect(() => {
		const button = rootRef.current?.querySelector("button");
		if (!button) return;
		const onTouchMove = (event: TouchEvent) => {
			if (dragRef.current?.moved) event.preventDefault();
		};
		button.addEventListener("touchmove", onTouchMove, { passive: false });
		return () => button.removeEventListener("touchmove", onTouchMove);
	}, []);

	const state = checked ? "on" : "off";
	const initialDash = (share: number) =>
		rimDash(rimAt(initial.lap), ARC_REST * share);
	const rimRef =
		(index: number, share: number) => (element: SVGPathElement | null) => {
			if (element) rimRefs.current[index] = { element, share };
		};

	const rimStroke = (
		index: number,
		share: number,
		props: Omit<ComponentProps<"path">, "ref">,
	) => {
		const dash = initialDash(share);
		return (
			<path
				key={index}
				ref={rimRef(index, share)}
				d={RIM_PATH}
				pathLength={1}
				fill="none"
				strokeLinecap="round"
				strokeDasharray={dash.array}
				strokeDashoffset={dash.offset}
				{...props}
			/>
		);
	};

	return (
		<div
			ref={rootRef}
			data-slot="glass-toggle"
			data-state={state}
			data-size={size}
			data-pressed={pressed || undefined}
			data-dragging={dragging || undefined}
			data-disabled={disabled || undefined}
			{...props}
			className={cn(
				"group/glass-toggle relative inline-block shrink-0 select-none align-middle data-disabled:cursor-not-allowed data-disabled:opacity-50",
				// The light colors. Set `--glass-toggle-off` and `--glass-toggle-on`
				// on this element or any parent to retheme them.
				"[--gt-light-off:var(--glass-toggle-off,oklch(0.72_0.14_285))] [--gt-light-on:var(--glass-toggle-on,#ffb224)] dark:[--gt-light-off:var(--glass-toggle-off,#9aa2ff)] dark:[--gt-light-on:var(--glass-toggle-on,#ffc04d)]",
				"[--gt-light:color-mix(in_oklab,var(--gt-light-off),var(--gt-light-on)_var(--gt-mix))]",
				// Pixels are ink on a light surface and lit on a dark one.
				"[--gt-ink-off:color-mix(in_oklab,var(--foreground)_88%,transparent)] [--gt-ink-on:color-mix(in_oklab,color-mix(in_oklab,var(--foreground),#8a4a0c_24%)_88%,transparent)] dark:[--gt-ink-off:#e8eaff] dark:[--gt-ink-on:#fff2dc]",
				className,
			)}
			style={
				{
					"--gt-u": size === "sm" ? `calc(1px * ${SIZE_SCALE.sm})` : "1px",
					"--gt-sx": "0%",
					"--gt-sy": "0%",
					...initial.vars,
					width: u(TRACK_WIDTH),
					height: u(TRACK_HEIGHT),
					...style,
				} as CSSProperties
			}
		>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? label)}
				aria-labelledby={ariaLabelledBy}
				aria-describedby={ariaDescribedBy}
				disabled={disabled}
				data-slot="glass-toggle-switch"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={(event) => endDrag(event.pointerId, true)}
				onPointerCancel={(event) => endDrag(event.pointerId, false)}
				onLostPointerCapture={(event) => endDrag(event.pointerId, false)}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={handlePointerLeave}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onContextMenu={(event) => event.preventDefault()}
				className="group/switch absolute inset-0 block cursor-pointer touch-pan-y outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 disabled:cursor-not-allowed group-data-dragging/glass-toggle:cursor-grabbing"
			>
				{/* The tray: a recessed slab a step darker than the page. */}
				<span
					aria-hidden
					data-slot="glass-toggle-track"
					className="absolute inset-0 overflow-hidden bg-[linear-gradient(to_bottom,#e9e9ec,#f1f1f3)] [--gt-tray-inset:rgb(0_0_0/0.1)] [--gt-tray-line:rgb(0_0_0/0.06)] [--gt-tray-lip:#fff] dark:bg-[linear-gradient(to_bottom,#0b0b0d,#141416)] dark:[--gt-tray-inset:rgb(0_0_0/0.7)] dark:[--gt-tray-line:rgb(255_255_255/0.05)] dark:[--gt-tray-lip:rgb(255_255_255/0.06)]"
					style={{
						borderRadius: u(TRACK_RADIUS),
						boxShadow: `inset 0 ${u(1)} ${u(2)} var(--gt-tray-inset), inset 0 0 0 ${u(0.5)} var(--gt-tray-line), 0 ${u(1)} 0 var(--gt-tray-lip)`,
					}}
				>
					{/* Light from the thumb on the tray: cool when off, warm when on. */}
					<span
						className="absolute inset-0 opacity-[calc(1-var(--gt-lit))] [--gt-wash-strength:5%] dark:[--gt-wash-strength:9%]"
						style={{
							background: `radial-gradient(${u(36)} ${u(26)} at calc(var(--gt-u) * (${INSET + THUMB_WIDTH / 2} + var(--gt-x))) 50%, color-mix(in oklab, var(--gt-light-off) var(--gt-wash-strength), transparent), transparent)`,
						}}
					/>
					<span
						className="absolute inset-0 opacity-[var(--gt-lit)] [--gt-wash-strength:8%] dark:[--gt-wash-strength:8%]"
						style={{
							background: `radial-gradient(${u(40)} ${u(28)} at calc(var(--gt-u) * (${INSET + THUMB_WIDTH / 2} + var(--gt-x))) 50%, color-mix(in oklab, var(--gt-light-on) var(--gt-wash-strength), transparent), transparent)`,
						}}
					/>
				</span>
				{/* Keyboard focus only, so pointer use never shows a ring. */}
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 group-focus-visible/switch:ring-3 group-focus-visible/switch:ring-ring/50 group-focus-visible/switch:ring-offset-2 group-focus-visible/switch:ring-offset-background"
					style={{ borderRadius: u(TRACK_RADIUS) }}
				/>

				<span
					ref={thumbRef}
					aria-hidden
					data-slot="glass-toggle-thumb"
					className="pointer-events-none absolute"
					style={{
						left: u(INSET),
						top: u(INSET),
						width: u(THUMB_WIDTH),
						height: u(THUMB_HEIGHT),
						transform: `translateX(${u(Number(initial.vars["--gt-x"]))})`,
					}}
				>
					<span className="absolute inset-0 transition-transform duration-[80ms] ease-out group-data-pressed/glass-toggle:scale-[0.97] motion-reduce:transition-none">
						<span ref={squashRef} className="absolute inset-0">
							{/* Contact shadow and a soft drop; tighter while pressed. */}
							<span
								className="absolute inset-0 transition-opacity duration-[80ms] [--gt-contact:rgb(0_0_0/0.12)] [--gt-drop:rgb(0_0_0/0.14)] group-data-pressed/glass-toggle:opacity-0 dark:[--gt-contact:rgb(0_0_0/0.5)] dark:[--gt-drop:rgb(0_0_0/0.55)]"
								style={{
									borderRadius: u(THUMB_RADIUS),
									boxShadow: `0 ${u(0.5)} ${u(1)} var(--gt-contact), 0 ${u(4)} ${u(8)} ${u(-2)} var(--gt-drop)`,
								}}
							/>
							<span
								className="absolute inset-0 opacity-0 transition-opacity duration-[80ms] [--gt-contact:rgb(0_0_0/0.16)] [--gt-drop:rgb(0_0_0/0.12)] group-data-pressed/glass-toggle:opacity-100 dark:[--gt-contact:rgb(0_0_0/0.6)] dark:[--gt-drop:rgb(0_0_0/0.5)]"
								style={{
									borderRadius: u(THUMB_RADIUS),
									boxShadow: `0 ${u(0.5)} ${u(0.75)} var(--gt-contact), 0 ${u(2)} ${u(4)} ${u(-1)} var(--gt-drop)`,
								}}
							/>
							{/* Caustic: light focused through the glass onto the tray. */}
							<span
								className="absolute [--gt-caustic:color-mix(in_oklab,#fff_80%,var(--gt-light))] dark:[--gt-caustic:color-mix(in_oklab,var(--gt-light)_45%,transparent)]"
								style={{
									left: u(9),
									width: u(THUMB_WIDTH - 18),
									top: u(THUMB_HEIGHT - 0.5),
									height: u(3),
									background:
										"radial-gradient(50% 100% at 50% 0%, var(--gt-caustic), transparent)",
								}}
							/>

							{/* The glass. */}
							<span
								data-slot="glass-toggle-glass"
								className="absolute inset-0 overflow-hidden bg-[linear-gradient(to_bottom,rgb(255_255_255/0.92),rgb(244_244_246/0.78))] [--gt-glass-line:rgb(0_0_0/0.05)] dark:bg-[linear-gradient(to_bottom,rgb(255_255_255/0.1),rgb(255_255_255/0.05))] dark:[--gt-glass-line:rgb(255_255_255/0.14)]"
								style={{
									borderRadius: u(THUMB_RADIUS),
									boxShadow: `inset 0 0 0 ${u(0.5)} var(--gt-glass-line)`,
								}}
							>
								{/* The lamp inside the glass, on the side nearest the rim light. */}
								<span
									className="absolute inset-0 opacity-[var(--gt-off-amount)] [--gt-tint:50%] dark:[--gt-tint:48%]"
									style={{
										background: `radial-gradient(circle ${u(30)} at var(--gt-wash-x) var(--gt-wash-y), color-mix(in oklab, var(--gt-light-off) var(--gt-tint), transparent), color-mix(in oklab, var(--gt-light-off) calc(var(--gt-tint) * 0.4), transparent) 45%, transparent)`,
									}}
								/>
								<span
									className="absolute inset-0 opacity-[var(--gt-on-amount)] [--gt-tint:88%] dark:[--gt-tint:55%]"
									style={{
										background: `radial-gradient(circle ${u(30)} at var(--gt-wash-x) var(--gt-wash-y), color-mix(in oklab, var(--gt-light-on) var(--gt-tint), transparent), color-mix(in oklab, var(--gt-light-on) calc(var(--gt-tint) * 0.4), transparent) 45%, transparent)`,
									}}
								/>

								<svg
									aria-hidden
									data-slot="glass-toggle-glyph"
									viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
									className="absolute inset-0 size-full overflow-visible [fill:color-mix(in_oklab,var(--gt-ink-off),var(--gt-ink-on)_var(--gt-mix))] dark:[filter:drop-shadow(0_0_calc(var(--gt-u)*2)_color-mix(in_oklab,var(--gt-light)_75%,transparent))]"
								>
									{PIXELS.map((_, index) => {
										const pixel = initial.pixels[index];
										return (
											<rect
												key={index}
												ref={(element) => {
													pixelRefs.current[index] = element;
												}}
												x={pixel.x}
												y={pixel.y}
												width={PIXEL_SIZE}
												height={PIXEL_SIZE}
												rx={0.22}
												opacity={pixel.opacity}
											/>
										);
									})}
								</svg>

								{/* Soft sheen over the top; the pointer is the light. */}
								<span
									className="absolute inset-0 [--gt-sheen:rgb(255_255_255/0.7)] dark:[--gt-sheen:rgb(255_255_255/0.13)]"
									style={{
										background:
											"radial-gradient(90% 48% at calc(50% + var(--gt-sx)) calc(0% + var(--gt-sy)), var(--gt-sheen), transparent)",
									}}
								/>
								{/* Thickness: a bevel band lit from the top-left, with an exit glint. */}
								<span
									className="absolute inset-0 blur-[calc(var(--gt-u)*1.4)] dark:hidden"
									style={{
										borderRadius: u(THUMB_RADIUS),
										padding: u(3),
										background:
											"conic-gradient(from 0deg, #fff, rgb(255 255 255/0.5) 50deg, rgb(96 96 112/0.08) 95deg, rgb(96 96 112/0.12) 124deg, #fff 136deg, rgb(96 96 112/0.14) 150deg, rgb(96 96 112/0.11) 200deg, rgb(96 96 112/0.04) 245deg, rgb(255 255 255/0.6) 290deg, #fff 318deg)",
										...BEVEL_MASK,
									}}
								/>
								<span
									className="absolute inset-0 hidden blur-[calc(var(--gt-u)*1.4)] dark:block"
									style={{
										borderRadius: u(THUMB_RADIUS),
										padding: u(3),
										background:
											"conic-gradient(from 0deg, rgb(255 255 255/0.22), rgb(255 255 255/0.12) 50deg, rgb(255 255 255/0.03) 95deg, rgb(255 255 255/0.04) 124deg, rgb(255 255 255/0.42) 136deg, rgb(255 255 255/0.03) 150deg, rgb(255 255 255/0.03) 200deg, rgb(255 255 255/0.06) 245deg, rgb(255 255 255/0.15) 290deg, rgb(255 255 255/0.26) 318deg, rgb(255 255 255/0.22))",
										...BEVEL_MASK,
									}}
								/>
								{/* Specular: a crisp line along the top rim. */}
								<span
									className="absolute inset-0 [--gt-specular:rgb(255_255_255/0.9)] dark:[--gt-specular:rgb(255_255_255/0.35)]"
									style={{
										borderRadius: u(THUMB_RADIUS),
										boxShadow: `inset 0 ${u(1)} 0 var(--gt-specular), inset 0 ${u(-1)} ${u(1.5)} rgb(0 0 0 / 0.04)`,
									}}
								/>
							</span>

							{/* The rim light, its bloom, and a white-hot core. */}
							<svg
								aria-hidden
								data-slot="glass-toggle-light"
								viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
								className="absolute inset-0 size-full overflow-visible"
							>
								<defs>
									<filter
										id={filterId("bloom")}
										filterUnits="userSpaceOnUse"
										x={-30}
										y={-30}
										width={THUMB_WIDTH + 60}
										height={THUMB_HEIGHT + 60}
									>
										<feGaussianBlur stdDeviation={5.5} />
									</filter>
									<filter
										id={filterId("halo")}
										filterUnits="userSpaceOnUse"
										x={-12}
										y={-12}
										width={THUMB_WIDTH + 24}
										height={THUMB_HEIGHT + 24}
									>
										<feGaussianBlur stdDeviation={1.5} />
									</filter>
								</defs>
								<g
									data-slot="glass-toggle-bloom"
									className="group-data-disabled/glass-toggle:hidden"
								>
									<g
										filter={`url(#${filterId("bloom")})`}
										className="opacity-[var(--gt-bloom)]"
									>
										{rimStroke(0, 1, {
											strokeWidth: 10,
											className:
												"[stroke:var(--gt-light-off)] opacity-[var(--gt-off-amount)]",
										})}
										{rimStroke(1, 1, {
											strokeWidth: 10,
											className:
												"[stroke:var(--gt-light-on)] opacity-[var(--gt-on-amount)] mix-blend-screen",
										})}
									</g>
									<g
										filter={`url(#${filterId("halo")})`}
										className="opacity-[var(--gt-glow)]"
									>
										{rimStroke(2, 1, {
											strokeWidth: 3,
											className:
												"[stroke:var(--gt-light-off)] opacity-[var(--gt-off-amount)]",
										})}
										{rimStroke(3, 1, {
											strokeWidth: 3,
											className:
												"[stroke:var(--gt-light-on)] opacity-[var(--gt-on-amount)] mix-blend-screen",
										})}
									</g>
								</g>
								<g className="isolate">
									{RIM_LINE.map((line, index) =>
										rimStroke(4 + index, line.share, {
											strokeWidth: line.width,
											className:
												"[stroke:var(--gt-light-off)] opacity-[var(--gt-off-amount)]",
										}),
									)}
									{RIM_LINE.map((line, index) =>
										rimStroke(4 + RIM_LINE.length + index, line.share, {
											strokeWidth: line.width,
											className:
												"[stroke:var(--gt-light-on)] opacity-[var(--gt-on-amount)] mix-blend-screen",
										}),
									)}
								</g>
								{rimStroke(4 + RIM_LINE.length * 2, RIM_CORE_SHARE, {
									strokeWidth: 0.5,
									stroke: "#fff",
									strokeOpacity: 0.7,
								})}
							</svg>
						</span>
					</span>
				</span>
			</button>

			{name ? (
				<input type="hidden" name={name} value={state} disabled={disabled} />
			) : null}
		</div>
	);
}

export default GlassToggle;
