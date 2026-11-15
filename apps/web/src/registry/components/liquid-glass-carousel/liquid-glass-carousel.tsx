"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	PauseIcon,
	PlayIcon,
} from "lucide-react";
import {
	type AnimationPlaybackControls,
	animate,
	cancelFrame,
	frame,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	Children,
	type ComponentProps,
	type CSSProperties,
	createContext,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	type Ref,
	useCallback,
	useContext,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const DEFAULT_SLIDE_SIZE = { width: 168, height: 232 } as const;
const DEFAULT_GAP = 20;
/** Viewport length, in slide lengths, unless `--lgc-length` is set. */
const VIEWPORT_SLIDES = 2.6;
/**
 * Room across the axis, as a share of the slide's width, so a full flare is
 * never clipped. Slides scale down to keep it on narrow screens.
 */
const CROSS_ROOM = 1.24;

// Motion. Position is a slide count along the axis, and everything is drawn
// from it, so the melt follows a drag exactly and reverses exactly.
/** About 500 ms to rest, critically damped, so the centred card never overshoots. */
const snapSpring = { type: "spring", stiffness: 260, damping: 32 } as const;
/** Reduced motion swaps the glide for a fade of this length. */
const FADE_MS = 150;
/** Pointer travel, in px, before a press becomes a drag. */
const DRAG_SLOP = 6;
/** Ms of pointer samples used for the release speed. */
const VELOCITY_WINDOW = 100;
/** Seconds of release velocity projected ahead before picking a slide. */
const PROJECTION_SECONDS = 0.16;
/** Most slides one flick can travel. */
const MAX_FLICK = 2;
/** Furthest a drag rubber-bands past either end when not looping, in px. */
const RUBBER_LIMIT = 56;
/** Most slides arrow keys can queue ahead of the one on screen. */
const MAX_QUEUE = 3;
/** Wheel travel, in px, that steps one slide. */
const WHEEL_STEP = 40;
/** Ms without wheel events that ends a wheel gesture. */
const WHEEL_IDLE = 160;
/** Jumps longer than this skip ahead and glide the last two slides. */
const MAX_GLIDE = 3;

// The melt: a lens fixed to each end of the frame. Inside the outer
// `meltZone` of the viewport every pixel samples back toward the centre, more
// the closer it sits to the edge, so cards passing through smear into
// streaks, flare like a drip, and pick up a thin rainbow fringe.
/**
 * How hard the lens magnifies along the axis once it is fully in: rows are
 * drawn 1 / (1 - 0.86), about 7 times as long. Under 1, so it never folds.
 */
const MAGNIFY = 0.9;
/** Share of the zone, from its inner edge, over which the lens eases in. */
const RAMP = 1;
/** Extra width at the very edge, as a share of the distance from the axis. */
const FLARE = 0.3;
/**
 * Blue bends further than green, and red less: the spread of their pulls
 * along the axis, and of their flare across it. Tiny along the axis, where
 * the lens magnifies 7 times, so content keeps clean streaks; a little wider
 * across, so the flared sides split by a pixel or two at the very edge.
 */
const DISPERSION_ALONG = 0.004;
const DISPERSION_ACROSS = 0.1;
/**
 * Share of the split colour kept in the result; the rest is the undispersed
 * image, so the fringe is a faint tint, never a saturated rim.
 */
const FRINGE = 0.45;
/** Blur along the axis inside the zones, in px, so magnified rows read as streaks. */
const STREAK_BLUR = 2;
/** A little blur across, so the fringe reads as light, not as painted bands. */
const FRINGE_BLUR = 0.8;
/** Depth of the soft fade at each end, as a share of the viewport length. */
const EDGE_FADE = 0.12;
/** Where SVG filters are off, slides stretch, flare, and blur on their own. */
const FALLBACK_STRETCH = 0.28;
const FALLBACK_FLARE = 0.08;
const FALLBACK_BLUR = 1.6;
/** Rows along the axis and columns across it in the displacement map. */
const MAP_LENGTH = 512;
const MAP_CROSS = 64;
/** Room for the fringe and blur either side of a fully flared slide, in px. */
const BAND_MARGIN = 8;

// A fingertip on a glass rod: a short, bright tick with a faint ring.
const TICK_SOUND = {
	name: "liquid-glass-carousel-tick",
	baseFreq: 1180,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 5400,
	filterQ: 6,
	attack: 0.001,
	decay: 0.32,
	brightness: 5200,
} as const;

const NO_DRAG_SELECTOR =
	"input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-lgc-no-drag]";

type Orientation = "vertical" | "horizontal";
type MeltMode = "filter" | "css" | "off";
/**
 * What moved the carousel. Only `user` plays sound and announces, and only
 * `prop` (a controlled index) skips `onIndexChange`.
 */
type Source = "user" | "auto" | "api" | "prop";
type Geometry = {
	/** Viewport length along the axis, in px. */
	length: number;
	/** Slide length along the axis, in px. */
	slide: number;
	/** Slide width across the axis, in px. */
	cross: number;
	/** Slide length plus the gap. */
	pitch: number;
	/** Melt zone depth, in px, at each end. */
	zone: number;
	/** 1, or -1 for a horizontal carousel in a right-to-left page. */
	sign: number;
};
type Painted = {
	visible: boolean;
	transform: string;
	origin: string;
	filter: string;
	willChange: string;
};
type Channel = "r" | "g" | "b";
type Lens = {
	/** A displacement map for each colour channel. */
	maps: Record<Channel, string>;
	/** Viewport size along and across the axis, in px. */
	length: number;
	cross: number;
	/**
	 * Width of the band the filter covers across the axis, centred on it, in
	 * px: a flared slide and its fringe. The rest is empty page, and filter
	 * cost grows with area.
	 */
	band: number;
	zone: number;
	/** Displacement scale, in px: twice the furthest pull at the edge. */
	scale: number;
};
type Drag = {
	pointerId: number;
	pointerType: string;
	startX: number;
	startY: number;
	startPosition: number;
	/** Layout px per screen px, so zoom and transforms work. */
	scale: number;
	moved: boolean;
	samples: Array<{ time: number; along: number }>;
};

export type LiquidGlassCarouselLength = number | string;

export interface LiquidGlassCarouselHandle {
	/** Moves to the next slide. Silent, like a prop change. */
	next: () => void;
	/** Moves to the previous slide. Silent. */
	prev: () => void;
	/** Moves to slide `index`, the short way round when looping. Silent. */
	goTo: (index: number) => void;
}

export interface LiquidGlassCarouselProps
	extends Omit<ComponentProps<"div">, "children" | "ref" | "aria-label"> {
	/** `LiquidGlassCarouselSlide` elements, and optionally `LiquidGlassCarouselControls`. */
	children?: ReactNode;
	/** Names the carousel region, such as "Featured artists". */
	"aria-label": string;
	/** Axis the slides travel along. */
	orientation?: Orientation;
	/** Controlled index of the centred slide. */
	index?: number;
	/** Slide centred on mount when uncontrolled. */
	defaultIndex?: number;
	/** Called when a drag, key, click, wheel, or autoplay step picks a new slide. */
	onIndexChange?: (index: number) => void;
	/** Wrap from the last slide back to the first, with no seam. */
	loop?: boolean;
	/** Ms between automatic steps, or `false`. Starts paused under reduced motion. */
	autoplay?: false | number;
	/** Depth of the melt at each end, as a share of the viewport length, from 0 to 0.5. */
	meltZone?: number;
	/** `"off"` keeps the soft edge fade but never distorts the slides. */
	melt?: "auto" | "off";
	/**
	 * Slide size, in px or CSS lengths. Px sizes scale down to fit narrow
	 * containers. The viewport is 2.6 slides long; set `--lgc-length` on the
	 * root to change it.
	 */
	slideSize?: {
		width: LiquidGlassCarouselLength;
		height: LiquidGlassCarouselLength;
	};
	/** Space between slides, in px or a CSS length. */
	gap?: LiquidGlassCarouselLength;
	/** Play a soft glass tick when a slide you moved to settles. */
	sound?: boolean;
	/** Trigger a haptic tick on touch devices when a swiped slide settles. */
	haptics?: boolean;
	/** Exposes `next()`, `prev()`, and `goTo()`. */
	ref?: Ref<LiquidGlassCarouselHandle>;
}

type CarouselContextValue = {
	count: number;
	index: number;
	loop: boolean;
	orientation: Orientation;
	autoplay: boolean;
	playing: boolean;
	setPlaying: (playing: boolean) => void;
	step: (by: number) => void;
	registerControls: () => () => void;
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

type SlideContextValue = { index: number; count: number };

const SlideContext = createContext<SlideContextValue | null>(null);

function useCarousel(part: string) {
	const context = useContext(CarouselContext);
	if (!context) {
		throw new Error(`${part} must be used inside LiquidGlassCarousel.`);
	}
	return context;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number) {
	return Math.round(value * 100) / 100;
}

function mod(value: number, size: number) {
	return ((value % size) + size) % size;
}

/** `value` wrapped into `[-size / 2, size / 2)`. */
function wrap(value: number, size: number) {
	return mod(value + size / 2, size) - size / 2;
}

/** Eases `over` toward `limit`, never reaching it. */
function band(over: number, limit: number) {
	return (over * limit) / (Math.abs(over) + limit);
}

function cssLength(value: LiquidGlassCarouselLength) {
	return typeof value === "number" ? `${value}px` : value;
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

/**
 * SVG filters on HTML are fast and exact in Chromium. Safari draws them
 * unreliably on HTML and Firefox rasterises them on the CPU, so both get the
 * stretch, flare, and blur fallback instead.
 */
function supportsSvgMelt() {
	if (typeof navigator === "undefined") return false;
	const brands = (
		navigator as Navigator & {
			userAgentData?: { brands?: Array<{ brand: string }> };
		}
	).userAgentData?.brands;
	return brands?.some((entry) => entry.brand === "Chromium") ?? false;
}

/**
 * The edge fade as a mask. Smoothstep-eased over many stops, so it has no
 * crease where it starts and dark cards dissolve into the page instead of
 * passing through a band of grey.
 */
function edgeMask(orientation: Orientation) {
	const steps = 8;
	const ramp = Array.from({ length: steps + 1 }, (_, step) => {
		const t = step / steps;
		return {
			alpha: round(t * t * (3 - 2 * t)),
			at: round(t * EDGE_FADE * 100),
		};
	});
	const stops = [
		...ramp.map(({ alpha, at }) => `rgb(0 0 0 / ${alpha}) ${at}%`),
		...ramp
			.reverse()
			.map(({ alpha, at }) => `rgb(0 0 0 / ${alpha}) ${100 - at}%`),
	];
	const to = orientation === "vertical" ? "bottom" : "right";
	return `linear-gradient(to ${to}, ${stops.join(", ")})`;
}

const mapCache = new Map<string, string>();

/**
 * How far a pixel `depth` into a zone (0 inner edge, 1 frame edge) samples
 * back toward the centre, as a share of the pull at the edge. Its slope is the
 * magnification: 0 at the inner edge, easing up to `MAGNIFY` over `RAMP`.
 */
function easedPull(depth: number) {
	const t = Math.min(depth / RAMP, 1);
	const eased = RAMP * (t ** 3 - t ** 4 / 2) + Math.max(depth - RAMP, 0);
	return eased / (1 - RAMP / 2);
}

/** Pull at the frame's edge, in px, for a zone `zone` px deep. */
function lensPull(zone: number) {
	return zone * MAGNIFY * (1 - RAMP / 2);
}

/** Scale shared by the three channel maps: room for the furthest pull. */
function lensScale(zone: number) {
	return 2 * lensPull(zone) * (1 + DISPERSION_ALONG);
}

/** How much more (above 0) or less each channel bends than green. */
const SPREAD: Record<Channel, number> = { r: -1, g: 0, b: 1 };

/**
 * The lens as a displacement map over the filter's band, for one colour
 * channel. Red moves pixels across the axis and green along it, both centred
 * on 0.5 (no movement). In each melt zone, rows sample back toward the centre
 * by up to the pull at the edge, so the content nearest the edge is magnified
 * into streaks and the content that physically reaches the edge is never
 * drawn. Columns sample toward the axis, so cards widen toward the edge.
 * Blue carries the weight of the streak blur.
 */
function lensMap(
	orientation: Orientation,
	length: number,
	band: number,
	zone: number,
	slideCross: number,
	channel: Channel,
) {
	const sizes = [length, band, zone, slideCross].map(Math.round).join("-");
	const key = `${orientation}-${sizes}-${channel}`;
	const cached = mapCache.get(key);
	if (cached) return cached;
	const vertical = orientation === "vertical";
	const width = vertical ? MAP_CROSS : MAP_LENGTH;
	const height = vertical ? MAP_LENGTH : MAP_CROSS;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return "";
	const image = context.createImageData(width, height);
	const scale = lensScale(zone);
	const edgePull = lensPull(zone) * (1 + SPREAD[channel] * DISPERSION_ALONG);
	// A slide flared by `f` is `1 / (1 - f)` times as wide at the edge. Where
	// the band is narrower than that, the flare is eased off to fit, so the
	// drip is never cut off by the frame.
	const room =
		(1 - slideCross / (band - BAND_MARGIN * 2)) / (1 + DISPERSION_ACROSS);
	const flare =
		clamp(room, 0, FLARE) * (1 + SPREAD[channel] * DISPERSION_ACROSS);
	// Past this distance from the axis the flare stays flat; it only moves page.
	const reach = slideCross * 0.75;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const along = ((vertical ? y : x) + 0.5) / (vertical ? height : width);
			const across = ((vertical ? x : y) + 0.5) / (vertical ? width : height);
			const at = along * length;
			// 0 at the zone's inner edge, 1 at the frame's edge; sign is the end.
			const depth =
				at < zone
					? 1 - at / zone
					: at > length - zone
						? (at - (length - zone)) / zone
						: 0;
			const end = at > length / 2 ? 1 : -1;
			const pull = easedPull(depth);
			const axis = 0.5 - (end * pull * edgePull) / scale;
			const offAxis = clamp((across - 0.5) * band, -reach, reach);
			const side = clamp(0.5 - (flare * pull * offAxis) / scale, 0, 1);
			const index = (y * width + x) * 4;
			image.data[index] = Math.round((vertical ? side : axis) * 255);
			image.data[index + 1] = Math.round((vertical ? axis : side) * 255);
			// Blue: how much of the streak blur shows. It eases out, so it is
			// already there where rows start to magnify and step the flared rims.
			image.data[index + 2] = Math.round((1 - (1 - depth) ** 2) * 255);
			image.data[index + 3] = 255;
		}
	}
	context.putImageData(image, 0, 0);
	const url = canvas.toDataURL("image/png");
	mapCache.set(key, url);
	return url;
}

/** Keeps one channel of an image and makes it opaque. */
const CHANNEL = {
	r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1",
	g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1",
	b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1",
} as const;

const CHANNELS = ["r", "g", "b"] as const;

/** Moves a map's blue channel into alpha, as a mask for the streak blur. */
const WEIGHT = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0";

/**
 * The lens filter for the track. Each colour channel is displaced through its
 * own map and laid over the page colour, so where one channel's card reaches
 * past the others the page shows through in the rest: a thin rainbow fringe.
 * Only `FRINGE` of it is kept over the undispersed (green) pass, so the rim is
 * a faint tint. The channels are joined under the union of their shapes and
 * blurred along the axis, more toward the edge, so magnified rows read as
 * streaks. The band between the zones is the untouched source, so the centred
 * card is never resampled.
 */
function LensFilter({
	id,
	lens,
	orientation,
}: {
	id: string;
	lens: Lens;
	orientation: Orientation;
}) {
	const vertical = orientation === "vertical";
	const middle = Math.max(lens.length - lens.zone * 2, 0);
	const inset = round((lens.cross - lens.band) / 2);
	return (
		<filter
			id={id}
			filterUnits="userSpaceOnUse"
			x={vertical ? inset : 0}
			y={vertical ? 0 : inset}
			width={vertical ? lens.band : lens.length}
			height={vertical ? lens.length : lens.band}
			colorInterpolationFilters="sRGB"
		>
			<feFlood
				style={{ floodColor: "var(--lgc-surface, var(--background, #fff))" }}
				result="surface"
			/>
			{CHANNELS.map((channel) => (
				<feImage
					key={`${channel}-map`}
					href={lens.maps[channel]}
					preserveAspectRatio="none"
					result={`${channel}-map`}
				/>
			))}
			{CHANNELS.map((channel) => (
				<feDisplacementMap
					key={`${channel}-moved`}
					in="SourceGraphic"
					in2={`${channel}-map`}
					scale={round(lens.scale)}
					xChannelSelector="R"
					yChannelSelector="G"
					result={`${channel}-moved`}
				/>
			))}
			{CHANNELS.map((channel) => (
				<feComposite
					key={`${channel}-flat`}
					in={`${channel}-moved`}
					in2="surface"
					operator="over"
					result={`${channel}-flat`}
				/>
			))}
			{CHANNELS.map((channel) => (
				<feColorMatrix
					key={channel}
					in={`${channel}-flat`}
					values={CHANNEL[channel]}
					result={channel}
				/>
			))}
			<feComposite
				in="r"
				in2="g"
				operator="arithmetic"
				k2={1}
				k3={1}
				result="rg"
			/>
			<feComposite
				in="rg"
				in2="b"
				operator="arithmetic"
				k2={1}
				k3={1}
				result="rgb"
			/>
			<feComposite
				in="r-moved"
				in2="g-moved"
				operator="over"
				result="rg-shape"
			/>
			<feComposite in="b-moved" in2="rg-shape" operator="over" result="shape" />
			<feComposite
				in="rgb"
				in2="g-flat"
				operator="arithmetic"
				k2={FRINGE}
				k3={1 - FRINGE}
				result="mixed"
			/>
			<feComposite in="mixed" in2="shape" operator="in" result="lens" />
			<feColorMatrix in="g-map" values={WEIGHT} result="weight" />
			<feGaussianBlur
				in="lens"
				stdDeviation={
					vertical
						? `${FRINGE_BLUR} ${STREAK_BLUR}`
						: `${STREAK_BLUR} ${FRINGE_BLUR}`
				}
				result="blurred"
			/>
			<feComposite in="blurred" in2="weight" operator="in" result="soft" />
			<feComposite in="lens" in2="weight" operator="out" result="sharp" />
			<feComposite
				in="soft"
				in2="sharp"
				operator="arithmetic"
				k2={1}
				k3={1}
				result="streaks"
			/>
			<feOffset
				in="SourceGraphic"
				x={vertical ? inset : round(lens.zone)}
				y={vertical ? round(lens.zone) : inset}
				width={vertical ? lens.band : round(middle)}
				height={vertical ? round(middle) : lens.band}
				result="middle"
			/>
			<feMerge>
				<feMergeNode in="streaks" />
				<feMergeNode in="middle" />
			</feMerge>
		</filter>
	);
}

export function LiquidGlassCarousel({
	children,
	"aria-label": ariaLabel,
	orientation = "vertical",
	index: indexProp,
	defaultIndex = 0,
	onIndexChange,
	loop: loopProp = true,
	autoplay = false,
	meltZone = 0.28,
	melt = "auto",
	slideSize = DEFAULT_SLIDE_SIZE,
	gap = DEFAULT_GAP,
	sound = true,
	haptics = true,
	ref,
	className,
	style,
	...props
}: LiquidGlassCarouselProps) {
	const slides: ReactNode[] = [];
	const extras: ReactNode[] = [];
	for (const child of Children.toArray(children)) {
		const slide =
			typeof child === "object" &&
			child !== null &&
			"type" in child &&
			child.type === LiquidGlassCarouselSlide;
		(slide ? slides : extras).push(child);
	}
	const count = slides.length;
	const loop = loopProp && count > 1;
	const vertical = orientation === "vertical";

	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playTick } = useTiks({
		theme: TICK_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const lensId = `lgc-${ids}-lens`;

	const startIndex = clamp(
		Math.round(indexProp ?? defaultIndex),
		0,
		Math.max(count - 1, 0),
	);
	const [internalIndex, setInternalIndex] = useState(startIndex);
	const controlled = indexProp !== undefined;
	const index = clamp(
		controlled ? Math.round(indexProp) : internalIndex,
		0,
		Math.max(count - 1, 0),
	);
	const [, rerender] = useReducer((value: number) => value + 1, 0);
	/** Slides drawn either side of the centre; sets how many clones a loop needs. */
	const [reach, setReach] = useState(2);
	/** Slot at the centre, or heading there. Slots near it are the real slides. */
	const [anchor, setAnchor] = useState(startIndex);
	/** Bumped on every move, so autoplay times its next step from it. */
	const [moves, bumpMoves] = useReducer((value: number) => value + 1, 0);
	const [meltMode, setMeltMode] = useState<MeltMode>("off");
	const [lens, setLens] = useState<Lens | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const [playing, setPlayingState] = useState(true);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [pressed, setPressed] = useState(false);
	const [hidden, setHidden] = useState(false);
	const [controlsCount, setControlsCount] = useState(0);

	// A loop draws enough copies that its seam is always off-screen.
	const minimumSlots = reach * 2 + 1;
	const slotCount =
		loop && count < minimumSlots
			? count * Math.ceil(minimumSlots / count)
			: count;

	const position = useMotionValue(startIndex);
	const rootRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const gapRef = useRef<HTMLSpanElement>(null);
	const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
	const paintedRef = useRef<Array<Painted | null>>([]);
	const geometryRef = useRef<Geometry | null>(null);
	const meltRef = useRef<MeltMode>("off");
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const dragRef = useRef<Drag | null>(null);
	/** Where the carousel is heading, in slides; unbounded when looping. */
	const targetRef = useRef(startIndex);
	/** Index of the slide at `targetRef`. */
	const indexRef = useRef(startIndex);
	/** The last slide that settled, so a tick plays only for a new one. */
	const settledRef = useRef(startIndex);
	/** What started the move in flight. */
	const sourceRef = useRef<Source>("prop");
	/** The move in flight came from a touch, so it may buzz. */
	const touchRef = useRef(false);
	const suppressClickRef = useRef(false);
	const wheelRef = useRef({ total: 0, locked: false, timer: 0 });
	const userToggledRef = useRef(false);

	// Event handlers and the render loop read the latest props through refs.
	const latest = useRef({
		count,
		loop,
		slotCount,
		index,
		controlled,
		indexProp,
		onIndexChange,
		sound,
		haptics,
		reducedMotion,
		meltZone,
		vertical,
	});
	useLayoutEffect(() => {
		latest.current = {
			count,
			loop,
			slotCount,
			index,
			controlled,
			indexProp,
			onIndexChange,
			sound,
			haptics,
			reducedMotion,
			meltZone,
			vertical,
		};
	});

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	/** Draws every slot for the current position, writing only what changed. */
	const paint = () => {
		const geometry = geometryRef.current;
		if (!geometry) return;
		const { count, loop, slotCount, vertical } = latest.current;
		if (count === 0) return;
		const value = position.get();
		const mode = meltRef.current;
		const moving = !!dragRef.current?.moved || !!animationRef.current;
		const half = geometry.length / 2;
		for (let slot = 0; slot < slotCount; slot++) {
			const element = slotRefs.current[slot];
			if (!element) continue;
			const offset =
				(loop ? wrap(slot - value, slotCount) : slot - value) * geometry.pitch;
			const distance = Math.abs(offset);
			// Hidden once the end facing the centre has left the frame.
			const visible = distance - geometry.slide / 2 < half + 1;
			let next: Painted;
			if (!visible) {
				next = {
					visible,
					transform: "",
					origin: "",
					filter: "",
					willChange: "",
				};
			} else {
				// How far the slide's outer end has sunk into the zone, eased in so
				// a slide that only grazes it stays crisp.
				const edge =
					clamp(
						(distance + geometry.slide / 2 - (half - geometry.zone)) /
							(geometry.zone + geometry.slide / 2),
						0,
						1,
					) ** 2;
				// The lens draws the melt over the whole track; the fallback melts
				// each slide on its own.
				const melting = mode === "css" && edge > 0;
				// Screen direction of the slot from the centre: 1 is down or right.
				const side = offset * geometry.sign >= 0 ? 1 : -1;
				const shift = round(offset * geometry.sign);
				const stretch = melting ? round(1 + FALLBACK_STRETCH * edge) : 1;
				const flare = melting ? round(1 + FALLBACK_FLARE * edge) : 1;
				const move = vertical
					? `translate3d(0, ${shift}px, 0)`
					: `translate3d(${shift}px, 0, 0)`;
				const scale =
					stretch === 1 && flare === 1
						? ""
						: vertical
							? ` scale(${flare}, ${stretch})`
							: ` scale(${stretch}, ${flare})`;
				const blur = melting ? round(FALLBACK_BLUR * edge) : 0;
				const filter = blur > 0 ? `blur(${blur}px)` : "";
				next = {
					visible,
					transform: move + scale,
					// Stretch away from the centre, so the gap stays put.
					origin: vertical
						? side > 0
							? "50% 0%"
							: "50% 100%"
						: side > 0
							? "0% 50%"
							: "100% 50%",
					filter,
					willChange: moving && mode !== "filter" ? "transform" : "",
				};
			}
			const painted = paintedRef.current[slot];
			const style = element.style;
			if (painted?.visible !== next.visible) {
				style.visibility = next.visible ? "" : "hidden";
			}
			if (painted?.transform !== next.transform && next.visible) {
				style.transform = next.transform;
			}
			if (painted?.origin !== next.origin && next.visible) {
				style.transformOrigin = next.origin;
			}
			if (painted?.filter !== next.filter) style.filter = next.filter;
			if (painted?.willChange !== next.willChange) {
				style.willChange = next.willChange;
			}
			paintedRef.current[slot] = next;
		}
	};

	// One paint per frame, however many times the position changed in it.
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

	useEffect(() => {
		const stop = position.on("change", schedule);
		return () => {
			stop();
			cancelFrame(renderRef.current);
			scheduledRef.current = false;
			animationRef.current?.stop();
			window.clearTimeout(wheelRef.current.timer);
		};
	}, [position, schedule]);

	/** Reads the sizes the CSS settled on, and repaints. */
	const measure = useCallback(() => {
		const viewport = viewportRef.current;
		const slot = slotRefs.current.find(Boolean);
		if (!viewport || !slot) return;
		const { vertical, meltZone } = latest.current;
		const length = vertical ? viewport.offsetHeight : viewport.offsetWidth;
		const slide = vertical ? slot.offsetHeight : slot.offsetWidth;
		const cross = vertical ? slot.offsetWidth : slot.offsetHeight;
		const gapPx = gapRef.current?.offsetWidth ?? 0;
		if (!length || !slide) return;
		const rtl = getComputedStyle(viewport).direction === "rtl";
		const pitch = slide + gapPx;
		geometryRef.current = {
			length,
			slide,
			cross,
			pitch,
			zone: clamp(meltZone, 0, 0.5) * length,
			sign: !vertical && rtl ? -1 : 1,
		};
		// Slides reach the frame's edge with their stretched outer end.
		setReach(
			Math.max(
				1,
				Math.ceil((length / 2 + slide * (0.5 + FALLBACK_STRETCH)) / pitch),
			),
		);
		if (meltRef.current === "filter") {
			const zone = geometryRef.current.zone;
			const across = vertical ? viewport.offsetWidth : viewport.offsetHeight;
			const band = Math.min(
				across,
				Math.ceil(
					cross / (1 - FLARE * (1 + DISPERSION_ACROSS)) + BAND_MARGIN * 2,
				),
			);
			const maps = {
				r: lensMap(orientation, length, band, zone, cross, "r"),
				g: lensMap(orientation, length, band, zone, cross, "g"),
				b: lensMap(orientation, length, band, zone, cross, "b"),
			};
			setLens((current) =>
				current?.maps.g === maps.g && current.cross === across
					? current
					: {
							maps,
							length,
							cross: across,
							band,
							zone,
							scale: lensScale(zone),
						},
			);
		}
		paintedRef.current = [];
		paintRef.current();
	}, [orientation]);

	// Melt mode: SVG filters where they are fast, a CSS fallback elsewhere, and
	// none with reduced motion or `melt="off"`.
	useLayoutEffect(() => {
		const mode: MeltMode =
			melt === "off" || reducedMotion
				? "off"
				: supportsSvgMelt()
					? "filter"
					: "css";
		meltRef.current = mode;
		setMeltMode(mode);
		measure();
	}, [melt, reducedMotion, measure]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-observe when the loop's clones change the first slot
	useLayoutEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		measure();
		const observer = new ResizeObserver(() => measure());
		observer.observe(viewport);
		const slot = slotRefs.current.find(Boolean);
		if (slot) observer.observe(slot);
		return () => observer.disconnect();
	}, [measure, slotCount]);

	// New slots (a loop's clones) are painted before the browser shows them.
	// biome-ignore lint/correctness/useExhaustiveDependencies: repaint when these change
	useLayoutEffect(() => {
		paintedRef.current = [];
		paintRef.current();
	}, [slotCount, meltMode, meltZone]);

	/** Ends a move: normalises a loop's position and plays the landing cue. */
	const settle = () => {
		animationRef.current = null;
		const { loop, slotCount, sound, haptics } = latest.current;
		if (loop) {
			// Whole loops change nothing on screen, so drop them.
			const turns = Math.floor(targetRef.current / slotCount) * slotCount;
			if (turns !== 0) {
				targetRef.current -= turns;
				position.jump(position.get() - turns);
			}
		}
		const landed = indexRef.current;
		if (landed !== settledRef.current) {
			settledRef.current = landed;
			if (sourceRef.current === "user" && !silent()) {
				if (sound) playTick();
				if (haptics && touchRef.current) void haptic("selection");
			}
		}
		schedule();
	};

	/** Glides, or under reduced motion fades, to `target`, carrying `velocity`. */
	const run = (target: number, velocity?: number) => {
		animationRef.current?.stop();
		if (latest.current.reducedMotion) {
			animationRef.current = null;
			position.jump(target);
			trackRef.current?.animate([{ opacity: 0.2 }, { opacity: 1 }], {
				duration: FADE_MS,
				easing: "ease-out",
			});
			settle();
			return;
		}
		const controls = animate(position, target, {
			...snapSpring,
			velocity: velocity ?? position.getVelocity(),
			restDelta: 0.0005,
			restSpeed: 0.005,
			onComplete: () => {
				if (animationRef.current === controls) settle();
			},
		});
		animationRef.current = controls;
		schedule();
	};

	/** Heads for `target` (in slides) and publishes the new index. */
	const moveTo = (target: number, source: Source, velocity?: number) => {
		const { count, loop, slotCount, controlled } = latest.current;
		if (count < 2) return;
		const next = loop ? target : clamp(target, 0, count - 1);
		const nextIndex = mod(next, count);
		targetRef.current = next;
		sourceRef.current = source;
		const changed = nextIndex !== indexRef.current;
		indexRef.current = nextIndex;
		setAnchor(loop ? mod(next, slotCount) : next);
		bumpMoves();
		if (changed) {
			if (source !== "prop") {
				latest.current.index = nextIndex;
				if (controlled) rerender();
				else setInternalIndex(nextIndex);
				latest.current.onIndexChange?.(nextIndex);
			} else if (!controlled) {
				setInternalIndex(nextIndex);
			}
			if (source === "user") {
				setAnnouncement(`Slide ${nextIndex + 1} of ${count}`);
			}
		}
		// A long jump skips ahead first, so only the last two slides glide by.
		const from = position.get();
		if (
			!latest.current.reducedMotion &&
			Math.abs(next - from) > MAX_GLIDE &&
			!dragRef.current?.moved
		) {
			animationRef.current?.stop();
			position.jump(next - Math.sign(next - from) * 2);
		}
		run(next, velocity);
	};

	/** Moves `by` slides from where the carousel is heading. */
	const step = (by: number, source: Source = "user") => {
		const { count, loop } = latest.current;
		if (count < 2) return;
		let target = targetRef.current + by;
		if (!loop) target = clamp(target, 0, count - 1);
		// Fast key repeats queue up, but never run far ahead of the screen.
		if (Math.abs(target - position.get()) > MAX_QUEUE) return;
		if (source === "user") touchRef.current = false;
		moveTo(target, source);
	};

	/** Moves to slide `to`, the short way round when looping. */
	const goTo = (to: number, source: Source = "user") => {
		const { count, loop } = latest.current;
		if (count < 2) return;
		const nextIndex = clamp(Math.round(to), 0, count - 1);
		const delta = loop
			? wrap(nextIndex - indexRef.current, count)
			: nextIndex - indexRef.current;
		if (source === "user") touchRef.current = false;
		moveTo(targetRef.current + delta, source);
	};

	const stepRef = useRef(step);
	const goToRef = useRef(goTo);
	useLayoutEffect(() => {
		stepRef.current = step;
		goToRef.current = goTo;
	});

	useImperativeHandle(
		ref,
		() => ({
			next: () => stepRef.current(1, "api"),
			prev: () => stepRef.current(-1, "api"),
			goTo: (to: number) => goToRef.current(to, "api"),
		}),
		[],
	);

	// A parent changing `index` glides there silently. A parent that keeps the
	// old index after `onIndexChange` sends the carousel back.
	useLayoutEffect(() => {
		if (!controlled || dragRef.current?.moved) return;
		if (index === indexRef.current) return;
		goToRef.current(index, "prop");
	});

	// Autoplay: pauses on hover, keyboard focus, a press, a hidden tab, and the
	// pause button, and starts paused under reduced motion.
	useEffect(() => {
		if (reducedMotion && !userToggledRef.current) setPlayingState(false);
	}, [reducedMotion]);

	useEffect(() => {
		const update = () => setHidden(document.visibilityState === "hidden");
		update();
		document.addEventListener("visibilitychange", update);
		return () => document.removeEventListener("visibilitychange", update);
	}, []);

	const autoplayOn = typeof autoplay === "number" && autoplay > 0 && count > 1;
	const running =
		autoplayOn && playing && !hovered && !focused && !pressed && !hidden;

	useEffect(() => {
		if (!running || typeof autoplay !== "number") return;
		// `moves` restarts the wait after every step, whoever made it.
		void moves;
		const timer = window.setTimeout(() => {
			if (dragRef.current) return;
			stepRef.current(1, "auto");
		}, autoplay);
		return () => window.clearTimeout(timer);
	}, [running, autoplay, moves]);

	const setPlaying = useCallback((next: boolean) => {
		userToggledRef.current = true;
		setPlayingState(next);
	}, []);

	// Wheel and trackpad: one slide per gesture. At a closed end the page
	// scrolls on as normal.
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const onWheel = (event: WheelEvent) => {
			const { count, loop, vertical } = latest.current;
			if (count < 2 || event.ctrlKey) return;
			const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
			const raw = (vertical ? event.deltaY : event.deltaX) * unit;
			const cross = (vertical ? event.deltaX : event.deltaY) * unit;
			if (Math.abs(raw) <= Math.abs(cross)) return;
			const sign = geometryRef.current?.sign ?? 1;
			const direction = Math.sign(raw) * sign;
			const wheel = wheelRef.current;
			const at = targetRef.current;
			const blocked =
				!loop && (direction > 0 ? at >= count - 1 : at <= 0) && !wheel.locked;
			if (blocked) return;
			event.preventDefault();
			window.clearTimeout(wheel.timer);
			wheel.timer = window.setTimeout(() => {
				wheel.total = 0;
				wheel.locked = false;
			}, WHEEL_IDLE);
			if (wheel.locked) return;
			wheel.total += raw;
			if (Math.abs(wheel.total) < WHEEL_STEP) return;
			wheel.locked = true;
			wheel.total = 0;
			touchRef.current = false;
			stepRef.current(direction > 0 ? 1 : -1);
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", onWheel);
	}, []);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget || count < 2) return;
		const rtl = (geometryRef.current?.sign ?? 1) < 0;
		const back = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
		const forward = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
		let handled = true;
		if (event.key === forward) step(1);
		else if (event.key === back) step(-1);
		else if (event.key === "PageDown") step(MAX_QUEUE);
		else if (event.key === "PageUp") step(-MAX_QUEUE);
		else if (event.key === "Home") goTo(0);
		else if (event.key === "End") goTo(count - 1);
		else handled = false;
		if (handled) event.preventDefault();
	};

	/** The slot under a point, in slides from the one at the centre. */
	const slotAt = (clientX: number, clientY: number, scale: number) => {
		const viewport = viewportRef.current;
		const geometry = geometryRef.current;
		if (!viewport || !geometry) return 0;
		const rect = viewport.getBoundingClientRect();
		const along = vertical
			? (clientY - rect.top - rect.height / 2) * scale
			: (clientX - rect.left - rect.width / 2) * scale;
		const offset = (along * geometry.sign) / geometry.pitch;
		const from = position.get() - Math.round(position.get());
		const slots = Math.round(offset + from);
		// Only slots inside the frame count.
		const reachable = Math.floor(
			(geometry.length / 2 + geometry.slide / 2) / geometry.pitch,
		);
		return clamp(slots, -reachable, reachable);
	};

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (count < 2 || dragRef.current) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const target = event.target as Element;
		if (target.closest?.(NO_DRAG_SELECTOR)) return;
		const viewport = event.currentTarget;
		const rect = viewport.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			startX: event.clientX,
			startY: event.clientY,
			startPosition: position.get(),
			scale:
				(vertical
					? viewport.offsetHeight / rect.height
					: viewport.offsetWidth / rect.width) || 1,
			moved: false,
			samples: [],
		};
		setPressed(true);
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		const geometry = geometryRef.current;
		if (!drag || drag.pointerId !== event.pointerId || !geometry) return;
		const dx = (event.clientX - drag.startX) * drag.scale;
		const dy = (event.clientY - drag.startY) * drag.scale;
		const along = vertical ? dy : dx;
		const across = vertical ? dx : dy;
		if (!drag.moved) {
			if (Math.abs(along) < DRAG_SLOP && Math.abs(across) < DRAG_SLOP) return;
			if (Math.abs(across) > Math.abs(along)) {
				endDrag(event);
				return;
			}
			drag.moved = true;
			animationRef.current?.stop();
			animationRef.current = null;
			// Track from where the slides are now, so the slop doesn't jump them.
			drag.startPosition =
				position.get() + (along * geometry.sign) / geometry.pitch;
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {}
		}
		const now = performance.now();
		drag.samples.push({ time: now, along });
		while (
			drag.samples.length > 2 &&
			now - drag.samples[0].time > VELOCITY_WINDOW
		) {
			drag.samples.shift();
		}
		let value = drag.startPosition - (along * geometry.sign) / geometry.pitch;
		if (!loop) {
			const last = count - 1;
			if (value < 0)
				value = band(value * geometry.pitch, RUBBER_LIMIT) / geometry.pitch;
			else if (value > last) {
				value =
					last +
					band((value - last) * geometry.pitch, RUBBER_LIMIT) / geometry.pitch;
			}
		}
		position.set(value);
	};

	const endDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragRef.current = null;
		setPressed(false);
		const geometry = geometryRef.current;
		if (!geometry) return;
		if (!drag.moved) {
			if (cancelled) return;
			// A click on a neighbour brings it to the centre.
			const slots = slotAt(event.clientX, event.clientY, drag.scale);
			if (slots !== 0) {
				suppressClickRef.current = true;
				touchRef.current = drag.pointerType === "touch";
				moveTo(targetRef.current + slots, "user");
			}
			return;
		}
		suppressClickRef.current = true;
		let speed = 0;
		const samples = drag.samples;
		if (!cancelled && samples.length > 1) {
			const first = samples[0];
			const last = samples[samples.length - 1];
			const elapsed = (last.time - first.time) / 1000;
			// A pointer that stopped before letting go carries no speed.
			if (elapsed > 0 && performance.now() - last.time < 60) {
				speed = (last.along - first.along) / elapsed;
			}
		}
		const velocity = -(speed * geometry.sign) / geometry.pitch;
		const value = position.get();
		const home = Math.round(drag.startPosition);
		const projected = Math.round(value + velocity * PROJECTION_SECONDS);
		const target = clamp(projected, home - MAX_FLICK, home + MAX_FLICK);
		touchRef.current = drag.pointerType === "touch";
		moveTo(target, "user", velocity);
	};

	const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
		if (!suppressClickRef.current) return;
		suppressClickRef.current = false;
		event.preventDefault();
		event.stopPropagation();
	};

	const registerControls = useCallback(() => {
		setControlsCount((value) => value + 1);
		return () => setControlsCount((value) => value - 1);
	}, []);

	const sizeVars = (() => {
		const { width, height } = slideSize;
		if (typeof width === "number" && typeof height === "number") {
			// Px sizes shrink to leave room for the flare across the axis.
			const room = vertical ? CROSS_ROOM : 1.2;
			const fit = `min(${width}px, 100cqi / ${room})`;
			const gapLength =
				typeof gap === "number"
					? `calc(var(--lgc-w) * ${round(gap / width)})`
					: gap;
			return {
				"--lgc-w": fit,
				"--lgc-h": `calc(var(--lgc-w) * ${round((height / width) * 1000) / 1000})`,
				"--lgc-gap": gapLength,
				"--lgc-along": vertical ? "var(--lgc-h)" : "var(--lgc-w)",
			};
		}
		return {
			"--lgc-w": cssLength(width),
			"--lgc-h": cssLength(height),
			"--lgc-gap": cssLength(gap),
			"--lgc-along": vertical ? "var(--lgc-h)" : "var(--lgc-w)",
		};
	})();

	const context: CarouselContextValue = {
		count,
		index,
		loop,
		orientation,
		autoplay: autoplayOn,
		playing,
		setPlaying,
		step: (by: number) => step(by),
		registerControls,
	};

	const currentSlot = loop ? mod(anchor, slotCount) : index;

	return (
		<CarouselContext.Provider value={context}>
			<div
				ref={rootRef}
				role="region"
				aria-roledescription="carousel"
				aria-label={ariaLabel}
				data-slot="liquid-glass-carousel"
				data-orientation={orientation}
				className={cn(
					"@container relative flex w-full flex-col items-center",
					className,
				)}
				style={{ ...sizeVars, ...style } as CSSProperties}
				onPointerEnter={(event) => {
					if (event.pointerType === "mouse") setHovered(true);
				}}
				onPointerLeave={(event) => {
					if (event.pointerType === "mouse") setHovered(false);
				}}
				onFocus={(event) => {
					// Keyboard focus pauses autoplay, except on the play button.
					const target = event.target as HTMLElement;
					setFocused(
						target.matches(":focus-visible") &&
							!target.closest("[data-lgc-play]"),
					);
				}}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node)) {
						setFocused(false);
					}
				}}
				{...props}
			>
				<div className="relative w-full">
					<div
						ref={viewportRef}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: the slides take keyboard focus as one stop for the arrow keys
						tabIndex={0}
						role="group"
						aria-label="Slides"
						data-slot="liquid-glass-carousel-viewport"
						className={cn(
							"peer relative w-full select-none overflow-hidden outline-none",
							vertical
								? "h-(--lgc-viewport) touch-pan-x"
								: "h-[calc(var(--lgc-h)*1.4)] touch-pan-y",
						)}
						style={
							{
								"--lgc-viewport": `var(--lgc-length, calc(var(--lgc-h) * ${VIEWPORT_SLIDES}))`,
								maskImage: edgeMask(orientation),
							} as CSSProperties
						}
						onKeyDown={onKeyDown}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={(event) => endDrag(event)}
						onPointerCancel={(event) => endDrag(event, true)}
						onLostPointerCapture={(event) => {
							// A touch's implicit capture on a child is lost when the
							// viewport takes it; only the viewport's own loss ends a drag.
							if (event.target !== event.currentTarget) return;
							if (dragRef.current?.moved) endDrag(event);
						}}
						onClickCapture={onClickCapture}
						onDragStart={(event) => event.preventDefault()}
					>
						<span
							ref={gapRef}
							aria-hidden
							className="invisible absolute h-0 w-(--lgc-gap)"
						/>
						<div
							ref={trackRef}
							data-slot="liquid-glass-carousel-track"
							className="absolute inset-0 overflow-hidden"
							style={{
								filter:
									meltMode === "filter" && lens ? `url(#${lensId})` : undefined,
							}}
						>
							{Array.from({ length: slotCount }, (_, slot) => {
								const slideIndex = slot % Math.max(count, 1);
								const relative = loop
									? wrap(slot - anchor, slotCount)
									: slot - index;
								// The copy nearest the centre is the real slide; others are clones.
								const real = loop
									? relative >= -count / 2 && relative < count / 2
									: true;
								const current = slot === currentSlot;
								const initial = loop
									? wrap(slot - startIndex, slotCount)
									: slot - startIndex;
								return (
									<div
										key={slot}
										ref={(element) => {
											slotRefs.current[slot] = element;
										}}
										data-slot="liquid-glass-carousel-item"
										data-index={slideIndex}
										data-current={current || undefined}
										data-clone={real ? undefined : ""}
										aria-hidden={real ? undefined : true}
										inert={!current}
										className="absolute inset-0 m-auto h-(--lgc-h) w-(--lgc-w)"
										style={{
											transform: vertical
												? `translate3d(0, calc((var(--lgc-along) + var(--lgc-gap)) * ${initial}), 0)`
												: `translate3d(calc((var(--lgc-along) + var(--lgc-gap)) * ${initial}), 0, 0)`,
											visibility:
												Math.abs(initial) > reach ? "hidden" : undefined,
										}}
									>
										<SlideContext.Provider value={{ index: slideIndex, count }}>
											{slides[slideIndex]}
										</SlideContext.Provider>
									</div>
								);
							})}
						</div>
					</div>
					<span
						aria-hidden
						className="pointer-events-none absolute inset-0 rounded-3xl ring-ring/60 ring-offset-2 ring-offset-background peer-focus-visible:ring-2"
					/>
					{autoplayOn && controlsCount === 0 ? (
						<PlayButton
							playing={playing}
							onToggle={() => setPlaying(!playing)}
							className={cn(
								// The face sits at the outer edge of its hit area, flush with the column.
								"absolute justify-end",
								vertical
									? "top-1/2 right-0 -translate-y-1/2 rtl:right-auto rtl:left-0"
									: "right-0 bottom-0 rtl:right-auto rtl:left-0",
							)}
						/>
					) : null}
					{meltMode === "filter" && lens ? (
						<svg
							aria-hidden
							width="0"
							height="0"
							className="pointer-events-none absolute"
						>
							<defs>
								<LensFilter id={lensId} lens={lens} orientation={orientation} />
							</defs>
						</svg>
					) : null}
				</div>
				{extras}
				<div aria-live="polite" aria-atomic className="sr-only">
					{announcement}
				</div>
			</div>
		</CarouselContext.Provider>
	);
}

export interface LiquidGlassCarouselSlideProps extends ComponentProps<"div"> {
	/** Defaults to "n of N". */
	"aria-label"?: string;
}

export function LiquidGlassCarouselSlide({
	className,
	children,
	"aria-label": ariaLabel,
	...props
}: LiquidGlassCarouselSlideProps) {
	const slide = useContext(SlideContext);
	return (
		<div
			role="group"
			aria-roledescription="slide"
			aria-label={
				ariaLabel ??
				(slide ? `${slide.index + 1} of ${slide.count}` : undefined)
			}
			data-slot="liquid-glass-carousel-slide"
			className={cn(
				"relative size-full overflow-hidden rounded-full",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

function PlayButton({
	playing,
	onToggle,
	className,
}: {
	playing: boolean;
	onToggle: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			data-lgc-play=""
			data-slot="liquid-glass-carousel-play"
			aria-label={playing ? "Pause autoplay" : "Start autoplay"}
			onClick={onToggle}
			className={cn(
				"group/lgc-button inline-flex size-11 items-center justify-center rounded-full outline-none",
				className,
			)}
		>
			{/* The face ignores the pointer, so swapping the icon never leaves
			    the pointer over a removed node, which would swallow the
			    carousel's pointerleave and keep autoplay paused. */}
			<span className="pointer-events-none inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover/lgc-button:bg-muted group-hover/lgc-button:text-foreground group-focus-visible/lgc-button:ring-2 group-focus-visible/lgc-button:ring-ring/60">
				{playing ? (
					<PauseIcon className="size-3" fill="currentColor" strokeWidth={0} />
				) : (
					<PlayIcon className="size-3" fill="currentColor" strokeWidth={0} />
				)}
			</span>
		</button>
	);
}

export type LiquidGlassCarouselControlsProps = ComponentProps<"div">;

/** Previous and next buttons, a "03 / 07" counter, and a pause button when autoplay is on. */
export function LiquidGlassCarouselControls({
	className,
	...props
}: LiquidGlassCarouselControlsProps) {
	const carousel = useCarousel("LiquidGlassCarouselControls");
	const { registerControls } = carousel;
	useLayoutEffect(() => registerControls(), [registerControls]);
	if (carousel.count < 2) return null;
	const vertical = carousel.orientation === "vertical";
	const atStart = !carousel.loop && carousel.index === 0;
	const atEnd = !carousel.loop && carousel.index === carousel.count - 1;
	const buttonClass =
		"group/lgc-button inline-flex size-11 items-center justify-center rounded-full outline-none disabled:pointer-events-none disabled:opacity-40";
	const faceClass =
		"pointer-events-none inline-flex size-8 items-center justify-center rounded-full border bg-background text-foreground shadow-xs transition-colors group-hover/lgc-button:bg-muted group-focus-visible/lgc-button:ring-2 group-focus-visible/lgc-button:ring-ring/60";
	const Prev = vertical ? ArrowUpIcon : ArrowLeftIcon;
	const Next = vertical ? ArrowDownIcon : ArrowRightIcon;
	return (
		<div
			data-slot="liquid-glass-carousel-controls"
			className={cn("flex items-center gap-1", className)}
			{...props}
		>
			<button
				type="button"
				aria-label="Previous slide"
				disabled={atStart}
				onClick={() => carousel.step(-1)}
				className={buttonClass}
			>
				<span className={faceClass}>
					<Prev className={cn("size-4", !vertical && "rtl:rotate-180")} />
				</span>
			</button>
			<span
				aria-hidden
				dir="ltr"
				className="min-w-14 text-center font-medium text-muted-foreground text-xs tabular-nums"
			>
				<span className="text-foreground">{pad(carousel.index + 1)}</span> /{" "}
				{pad(carousel.count)}
			</span>
			<button
				type="button"
				aria-label="Next slide"
				disabled={atEnd}
				onClick={() => carousel.step(1)}
				className={buttonClass}
			>
				<span className={faceClass}>
					<Next className={cn("size-4", !vertical && "rtl:rotate-180")} />
				</span>
			</button>
			{carousel.autoplay ? (
				<PlayButton
					playing={carousel.playing}
					onToggle={() => carousel.setPlaying(!carousel.playing)}
				/>
			) : null}
		</div>
	);
}

export default LiquidGlassCarousel;
