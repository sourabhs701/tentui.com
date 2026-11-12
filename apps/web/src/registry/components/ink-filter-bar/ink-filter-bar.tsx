"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { useReducedMotion } from "motion/react";
import {
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Layout, in px. Chips and the pill share one height, so the capsule is one
// straight-sided shape once they dock.
const HEIGHT = 36;
const RADIUS = HEIGHT / 2;

// Motion, in ms from the click. A merge buds a bead from the capsule, joins it
// to the chip through a neck, floods the chip from its near edge, and docks it.
/** The bead grows and travels across the gap. */
const BEAD_DURATION = 200;
/** The neck reaches about half the chip's height. */
const NECK_DURATION = 180;
/** Ink starts flooding the chip once the neck has formed. */
const FLOOD_DELAY = 120;
const FLOOD_DURATION = 300;
/** The chip holds still while the bead buds, then springs into the capsule. */
const DOCK_DELAY = 90;
const dockSpring = { stiffness: 420, damping: 36 } as const;
/** A detaching chip's neck thins out and snaps about 40% of the way through. */
const SNAP_DURATION = 170;
const DRAIN_DURATION = 320;
const DETACH_DURATION = 380;
const MERGE_DURATION = 560;
/** Gap between chips draining back one after another when cleared. */
const CLEAR_STAGGER = 40;
/** The divider fades in as the chip lands and out as soon as the last leaves. */
const DIVIDER_IN_DELAY = 260;
const DIVIDER_IN = 160;
const DIVIDER_OUT = 100;
/** The clear button sinks into the capsule while chips move, then buds back. */
const CLEAR_OUT = 80;
const CLEAR_IN_DELAY = 440;
const CLEAR_IN = 160;
/** How fast a neck fades when another chip lies across its path. */
const OPEN_RATE = 50;
/** Blur of the goo filter, in px. A 0.5 alpha threshold keeps straight edges in place. */
const GOO_BLUR = 4.5;

// The count rolls one digit at a time as the ink floods.
const ROLL_DURATION = 320;
const ROLL_STAGGER = 30;
const ROLL_EASE = "cubic-bezier(0.3, 0.7, 0.2, 1)";
/** Reduced motion swaps the digits with a short fade instead. */
const SWAP_FADE = 120;
/** Reduced motion moves chips at once and fades them in where they land. */
const CROSS_FADE = 150;
/** The hover wobble: how far the outline ripples, in px, and one cycle. */
const WOBBLE_AMPLITUDE = 0.9;
const WOBBLE_PERIOD = 1800;
/** Ms of quiet before the live region announces the count. */
const ANNOUNCE_DELAY = 300;

// A soft wet drop when a chip is absorbed: a short sine blip that rises, over
// a puff of filtered pink noise.
const DROP_SOUND = {
	name: "ink-filter-bar-drop",
	baseFreq: 470,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 1400,
	filterQ: 1,
	attack: 0.002,
	decay: 1.4,
	brightness: 3000,
} as const;
/** Lighter and shorter, falling, when a chip tears free. */
const UNSTICK_SOUND = {
	...DROP_SOUND,
	name: "ink-filter-bar-unstick",
	baseFreq: 640,
	decay: 0.9,
} as const;

export interface InkFilterBarOption {
	value: string;
	label: ReactNode;
	/** Results for this option alone, shown after the label. */
	count?: number;
}

export interface InkFilterBarProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultValue" | "onChange" | "role"
	> {
	options: readonly InkFilterBarOption[];
	/** Controlled selection, in the order the chips joined the capsule. */
	value?: string[];
	/** Initial selection when uncontrolled. */
	defaultValue?: string[];
	/** Called with the new selection when a chip is toggled or cleared. */
	onValueChange?: (value: string[]) => void;
	/** `single` swaps the selected chip for the new one in one motion. */
	type?: "multiple" | "single";
	/** The live result total shown in the pill. */
	count: number;
	/** Text after the number in the pill and the live region. */
	label?: string;
	/** Formats the count. Defaults to `en-US` grouping, such as `1,204`. */
	formatCount?: (count: number) => string;
	/** Wrap chips onto more lines instead of scrolling the row. */
	wrap?: boolean;
	/** Shows a clear button at the end of the capsule; called after it clears. */
	onClear?: () => void;
	/** Play a soft drop when a chip is absorbed and a lighter one when it detaches. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	/** Accessible name of the group of chips. */
	"aria-label": string;
}

interface Box {
	left: number;
	top: number;
	width: number;
}

interface Tween {
	from: number;
	to: number;
	start: number;
	duration: number;
}

interface ChipMotion {
	/** Offset from the chip's layout slot, in px, sprung back to 0. */
	dx: number;
	dy: number;
	vx: number;
	vy: number;
	/** Time the spring has been stepped to; it holds until `holdUntil`. */
	time: number;
	holdUntil: number;
	/** Distance from its slot when the current merge began. */
	distance: number;
	/** Share of the chip flooded with ink, from its near edge. */
	ink: Tween;
	kind: "merge" | "detach" | null;
	start: number;
	/** How open the path to its anchor is: 0 while another chip lies across it. */
	open: number;
	/** Painted values, read by the next frame. */
	flood: number;
	bond: number;
}

function clamp(value: number, min = 0, max = 1) {
	return Math.min(Math.max(value, min), max);
}

function round(value: number) {
	return Math.round(value * 100) / 100;
}

function smoothstep(t: number) {
	return t * t * (3 - 2 * t);
}

function easeOut(t: number) {
	return 1 - (1 - t) ** 3;
}

function tweenAt(tween: Tween, now: number) {
	if (now <= tween.start) return tween.from;
	const t =
		tween.duration > 0 ? clamp((now - tween.start) / tween.duration) : 1;
	return tween.from + (tween.to - tween.from) * smoothstep(t);
}

function tweenEnd(tween: Tween) {
	return tween.start + tween.duration;
}

function hold(value: number): Tween {
	return { from: value, to: value, start: 0, duration: 0 };
}

/**
 * A chip's outline as a closed curve whose edge ripples by up to `amplitude`
 * px, for the hover wobble. Every phase has the same commands, so SMIL can
 * morph between them.
 */
function wobblePath(width: number, phase: number, amplitude: number) {
	const inset = 0.75;
	const radius = HEIGHT / 2 - inset;
	const straight = Math.max(width - inset * 2 - radius * 2, 0);
	const arc = Math.PI * radius;
	const perimeter = straight * 2 + arc * 2;
	const count = 36;
	const points: Array<[number, number]> = [];
	for (let index = 0; index < count; index++) {
		const along = (index / count) * perimeter;
		// Round the stadium: top edge, right cap, bottom edge, left cap.
		const capRight = along - straight;
		const bottom = capRight - arc;
		const capLeft = bottom - straight;
		let x: number;
		let y: number;
		let nx: number;
		let ny: number;
		if (along < straight) {
			x = inset + radius + along;
			y = inset;
			nx = 0;
			ny = -1;
		} else if (capRight < arc) {
			const angle = -Math.PI / 2 + capRight / radius;
			nx = Math.cos(angle);
			ny = Math.sin(angle);
			x = inset + radius + straight + nx * radius;
			y = HEIGHT / 2 + ny * radius;
		} else if (bottom < straight) {
			x = inset + radius + straight - bottom;
			y = HEIGHT - inset;
			nx = 0;
			ny = 1;
		} else {
			const angle = Math.PI / 2 + capLeft / radius;
			nx = Math.cos(angle);
			ny = Math.sin(angle);
			x = inset + radius + nx * radius;
			y = HEIGHT / 2 + ny * radius;
		}
		const t = (index / count) * Math.PI * 2;
		const offset =
			amplitude *
			(0.6 * Math.sin(t * 5 + phase) + 0.4 * Math.sin(t * 3 - phase * 1.3));
		points.push([x + nx * offset, y + ny * offset]);
	}
	// Closed Catmull-Rom through the points, as cubic Béziers.
	const at = (index: number) => points[(index + count) % count];
	let d = `M${round(points[0][0])} ${round(points[0][1])}`;
	for (let index = 0; index < count; index++) {
		const [x0, y0] = at(index - 1);
		const [x1, y1] = at(index);
		const [x2, y2] = at(index + 1);
		const [x3, y3] = at(index + 2);
		d += `C${round(x1 + (x2 - x0) / 6)} ${round(y1 + (y2 - y0) / 6)} ${round(x2 - (x3 - x1) / 6)} ${round(y2 - (y3 - y1) / 6)} ${round(x2)} ${round(y2)}`;
	}
	return `${d}Z`;
}

function defaultFormat(count: number) {
	return count.toLocaleString("en-US");
}

function sameList(a: readonly string[], b: readonly string[]) {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** The hovered chip's outline, rippling slowly like a wet edge. */
function WobbleOutline({ width }: { width: number | undefined }) {
	if (!width) return null;
	const frames = [0, 2.1, 4.2, 0].map((phase) =>
		wobblePath(width, phase, WOBBLE_AMPLITUDE),
	);
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 size-full overflow-visible"
			viewBox={`0 0 ${width} ${HEIGHT}`}
		>
			<path d={frames[0]} fill="none" stroke="currentColor" strokeWidth={1.5}>
				<animate
					attributeName="d"
					dur={`${WOBBLE_PERIOD}ms`}
					values={frames.join(";")}
					repeatCount="indefinite"
				/>
			</path>
		</svg>
	);
}

/** One digit as a vertical strip of 0 to 9, rolled to `digit`. */
function RollingDigit({
	digit,
	delay,
	reduced,
}: {
	digit: number;
	delay: number;
	reduced: boolean;
}) {
	return (
		<span className="relative inline-block h-[1lh] overflow-hidden">
			<span
				className="flex flex-col"
				style={{
					transform: `translateY(${-digit * 10}%)`,
					transition: reduced
						? undefined
						: `transform ${ROLL_DURATION}ms ${ROLL_EASE} ${delay}ms`,
				}}
			>
				{Array.from({ length: 10 }, (_, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: the strip is fixed
						key={index}
						className="block h-[1lh] text-center"
					>
						{index}
					</span>
				))}
			</span>
		</span>
	);
}

/** The pill's number. Each digit rolls on its own, a beat after the last. */
function RollingNumber({
	text,
	delay,
	reduced,
}: {
	text: string;
	delay: number;
	reduced: boolean;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const shown = useRef(text);
	const chars = [...text];
	let digitIndex = 0;

	useEffect(() => {
		if (shown.current === text) return;
		shown.current = text;
		if (reduced) {
			ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: SWAP_FADE,
				easing: "ease-out",
			});
		}
	}, [text, reduced]);

	return (
		// Numbers read left to right in RTL text too.
		<span ref={ref} dir="ltr" className="inline-flex tabular-nums">
			{chars.map((char, index) => {
				// Places are keyed from the right, so units stay units.
				const place = chars.length - index;
				if (reduced || !/\d/.test(char)) {
					return <span key={`c${place}`}>{char}</span>;
				}
				const order = digitIndex++;
				return (
					<RollingDigit
						key={`d${place}`}
						digit={Number(char)}
						delay={delay + order * ROLL_STAGGER}
						reduced={reduced}
					/>
				);
			})}
		</span>
	);
}

export function InkFilterBar({
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	type = "multiple",
	count,
	label = "results",
	formatCount = defaultFormat,
	wrap = false,
	onClear,
	sound = true,
	haptics = true,
	className,
	onKeyDown,
	...props
}: InkFilterBarProps) {
	const [internalValue, setInternalValue] = useState<string[]>(
		() => defaultValue ?? [],
	);
	const controlled = valueProp !== undefined;
	const rawValue = controlled ? valueProp : internalValue;
	const selected = rawValue.filter(
		(item, index) =>
			rawValue.indexOf(item) === index &&
			options.some((option) => option.value === item),
	);
	const selectedKey = selected.join("\u0000");
	const clearable = onClear !== undefined;
	const showClear = clearable && selected.length > 0;

	const reducedMotion = useReducedMotion() ?? false;
	const [animating, setAnimating] = useState(false);
	const [hovered, setHovered] = useState<string | null>(null);
	const [focusValue, setFocusValue] = useState<string | null>(null);
	const [announcement, setAnnouncement] = useState("");

	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { toggle: playDrop } = useTiks({
		theme: DROP_SOUND,
		respectReducedMotion: false,
	});
	const { toggle: playUnstick } = useTiks({
		theme: UNSTICK_SOUND,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const gooId = `ink-filter-bar-${ids}-goo`;

	const rootRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const pillRef = useRef<HTMLDivElement>(null);
	const dividerRef = useRef<HTMLSpanElement>(null);
	const clearRef = useRef<HTMLButtonElement>(null);
	const chipRefs = useRef(new Map<string, HTMLButtonElement>());
	const inkRefs = useRef(new Map<string, HTMLSpanElement>());
	const svgRef = useRef<SVGSVGElement>(null);
	const gooRef = useRef<SVGFilterElement>(null);
	const flipRef = useRef<SVGGElement>(null);
	const shapeRefs = useRef(
		new Map<string, SVGRectElement | SVGCircleElement>(),
	);

	/** Layout slots, in px within the row, from the last commit. */
	const boxesRef = useRef(new Map<string, Box>());
	const motionsRef = useRef(new Map<string, ChipMotion>());
	const previousRef = useRef<string[]>(selected);
	const dividerTweenRef = useRef<Tween>(hold(selected.length > 0 ? 1 : 0));
	/** The clear button sinks with `clearOut`, then buds back with `clearIn`. */
	const clearOutRef = useRef<Tween>(hold(showClear ? 1 : 0));
	const clearInRef = useRef<Tween | null>(null);
	const frameRef = useRef(0);
	const lastFrameRef = useRef(0);
	const rtlRef = useRef(false);
	const rowSizeRef = useRef({ width: 0, height: 0 });
	/** When the last user toggle happened, so the count rolls with the flood. */
	const toggledAtRef = useRef(Number.NEGATIVE_INFINITY);

	// Event handlers and the render loop read the latest props through refs.
	const latest = useRef({
		selected,
		controlled,
		onValueChange,
		onClear,
		type,
		sound,
		haptics,
		reducedMotion,
		options,
		showClear,
	});
	useLayoutEffect(() => {
		latest.current = {
			selected,
			controlled,
			onValueChange,
			onClear,
			type,
			sound,
			haptics,
			reducedMotion,
			options,
			showClear,
		};
	});

	const clearAt = (now: number) => {
		const clearIn = clearInRef.current;
		return clearIn && now >= clearIn.start
			? tweenAt(clearIn, now)
			: tweenAt(clearOutRef.current, now);
	};

	const motionFor = (key: string, on: boolean) => {
		let motion = motionsRef.current.get(key);
		if (!motion) {
			motion = {
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				time: 0,
				holdUntil: 0,
				distance: 0,
				ink: hold(on ? 1 : 0),
				kind: null,
				start: 0,
				open: 1,
				flood: 0,
				bond: 0,
			};
			motionsRef.current.set(key, motion);
		}
		return motion;
	};

	const measure = useCallback(() => {
		const row = rowRef.current;
		if (!row) return;
		const boxes = new Map<string, Box>();
		const read = (key: string, element: HTMLElement | null) => {
			if (!element || element.hidden) return;
			boxes.set(key, {
				left: element.offsetLeft,
				top: element.offsetTop,
				width: element.offsetWidth,
			});
		};
		read("\u0000pill", pillRef.current);
		read("\u0000clear", clearRef.current);
		for (const [key, element] of chipRefs.current) read(key, element);
		boxesRef.current = boxes;
		rowSizeRef.current = { width: row.offsetWidth, height: row.offsetHeight };
		rtlRef.current = getComputedStyle(row).direction === "rtl";
	}, []);

	/** Draws one frame: chip offsets, ink clips, and the goo shapes beneath. */
	const paint = (now: number) => {
		const boxes = boxesRef.current;
		const rtl = rtlRef.current;
		const { width: rowWidth, height: rowHeight } = rowSizeRef.current;

		// Logical boxes run from the capsule's side, so RTL is LTR mirrored.
		type Shape = { key: string; x: number; y: number; w: number; ink: boolean };
		const shapes: Shape[] = [];
		const logical = (box: Box, dx: number, dy: number, width = box.width) => ({
			x: rtl ? rowWidth - (box.left + dx + box.width) : box.left + dx,
			y: box.top + dy,
			w: width,
		});

		const pillBox = boxes.get("\u0000pill");
		if (pillBox)
			shapes.push({ key: "pill", ...logical(pillBox, 0, 0), ink: true });

		const clearBox = boxes.get("\u0000clear");
		const clearShown = clearAt(now);
		if (clearRef.current) {
			clearRef.current.style.opacity = String(round(clearShown));
		}

		const chips: Array<{ key: string; motion: ChipMotion; shape: Shape }> = [];
		for (const [key, motion] of motionsRef.current) {
			const box = boxes.get(key);
			const chip = chipRefs.current.get(key);
			const ink = inkRefs.current.get(key);
			if (!box || !chip || !ink) continue;
			chip.style.transform =
				motion.dx || motion.dy
					? `translate(${round(motion.dx)}px, ${round(motion.dy)}px)`
					: "";
			chip.style.zIndex = motion.kind ? "2" : "";
			const flood = motion.flood;
			const cut = round((1 - flood) * box.width);
			ink.style.opacity = flood > 0.001 ? "1" : "0";
			ink.style.clipPath = rtl
				? `inset(0 0 0 ${cut}px round ${RADIUS}px)`
				: `inset(0 ${cut}px 0 0 round ${RADIUS}px)`;
			const shape = {
				key,
				...logical(box, motion.dx, motion.dy),
				ink: flood > 0.02,
			};
			chips.push({ key, motion, shape });
		}

		const divider = dividerRef.current;
		if (divider) {
			divider.style.opacity = String(
				round(tweenAt(dividerTweenRef.current, now)),
			);
		}

		const svg = svgRef.current;
		if (!svg) return;
		const goo = gooRef.current;
		goo?.setAttribute("x", "-24");
		goo?.setAttribute("y", "-24");
		goo?.setAttribute("width", String(rowWidth + 48));
		goo?.setAttribute("height", String(rowHeight + 48));
		flipRef.current?.setAttribute(
			"transform",
			rtl ? `matrix(-1 0 0 1 ${rowWidth} 0)` : "",
		);

		const setRect = (
			key: string,
			x: number,
			y: number,
			w: number,
			h: number,
			square = false,
		) => {
			const rect = shapeRefs.current.get(key);
			if (!rect) return;
			const visible = w > 0.5 && h > 0.5;
			const r = square ? 0 : Math.min(w, h) / 2;
			rect.setAttribute("x", String(round(x)));
			rect.setAttribute("y", String(round(y)));
			rect.setAttribute("width", String(round(visible ? w : 0)));
			rect.setAttribute("height", String(round(visible ? h : 0)));
			rect.setAttribute("rx", String(round(r)));
		};

		if (pillBox) {
			const pill = shapes[0];
			setRect("pill", pill.x, pill.y, pill.w, HEIGHT);
		}
		const anchors = [...shapes];
		if (clearBox && clearShown > 0.01) {
			const clear = logical(clearBox, 0, 0);
			const width = clearBox.width * clearShown;
			setRect("clear", clear.x, clear.y, width, HEIGHT);
			anchors.push({ key: "clear", ...clear, w: width, ink: true });
		} else {
			setRect("clear", 0, 0, 0, 0);
		}
		for (const { shape, motion } of chips) {
			setRect(
				`ink:${shape.key}`,
				shape.x,
				shape.y,
				shape.w * motion.flood,
				HEIGHT,
			);
			if (shape.ink) anchors.push(shape);
		}

		for (const { key, shape, motion } of chips) {
			const neck = shapeRefs.current.get(`neck:${key}`);
			const bead = shapeRefs.current.get(`bead:${key}`) as
				| SVGCircleElement
				| undefined;
			if (!neck || !bead) continue;
			// The anchor is the inked shape whose end sits nearest this chip's
			// near edge, on the same line.
			let anchor: Shape | null = null;
			for (const candidate of anchors) {
				if (candidate.key === key) continue;
				if (Math.abs(candidate.y - shape.y) > HEIGHT / 2) continue;
				const end = candidate.x + candidate.w;
				if (end > shape.x + shape.w / 2) continue;
				if (!anchor || end > anchor.x + anchor.w) anchor = candidate;
			}
			const hide = () => {
				setRect(`neck:${key}`, 0, 0, 0, 0);
				bead.setAttribute("r", "0");
			};
			if (!anchor || motion.bond <= 0.001) {
				hide();
				continue;
			}
			const from = anchor.x + anchor.w;
			const to = shape.x;
			const middle = shape.y + HEIGHT / 2;
			const thickness = HEIGHT * motion.bond * motion.open;
			if (to - from > -RADIUS) {
				// Square ends that reach a full radius into both shapes, so a
				// docked chip fills the notches between the rounded inks. On the
				// chip's side it reaches in only as far as the ink has.
				const start = from - RADIUS;
				const end = to + RADIUS * Math.max(0.4, motion.flood);
				setRect(
					`neck:${key}`,
					start,
					middle - thickness / 2,
					end - start,
					thickness,
					true,
				);
			} else {
				setRect(`neck:${key}`, 0, 0, 0, 0);
			}
			// The bead buds from the capsule's end and runs to the chip.
			const elapsed = now - motion.start;
			if (motion.kind === "merge" && elapsed < BEAD_DURATION + 120) {
				const travel = easeOut(clamp(elapsed / BEAD_DURATION));
				const fade = 1 - smoothstep(clamp((elapsed - BEAD_DURATION) / 120));
				const radius = HEIGHT * (0.14 + 0.14 * travel) * fade * motion.open;
				const gap = Math.max(to - from, 0);
				bead.setAttribute(
					"cx",
					String(round(from - radius * 0.4 + gap * travel * 0.9)),
				);
				bead.setAttribute("cy", String(round(middle)));
				bead.setAttribute("r", String(round(radius)));
			} else {
				bead.setAttribute("r", "0");
			}
		}
	};

	/** Advances springs and timelines to `now`; returns true once all is still. */
	const step = (now: number) => {
		const selectedNow = latest.current.selected;
		const dt = Math.min(Math.max(now - lastFrameRef.current, 0), 64);
		lastFrameRef.current = now;
		let busy = false;
		const boxes = boxesRef.current;
		const rtl = rtlRef.current;
		const rowWidth = rowSizeRef.current.width;

		for (const [key, motion] of motionsRef.current) {
			// The dock spring, stepped in small slices so it's frame-rate proof.
			if (now < motion.holdUntil) {
				motion.time = now;
			} else {
				let time = Math.max(motion.time, motion.holdUntil);
				while (time < now) {
					const h = Math.min(4, now - time) / 1000;
					const ax =
						-dockSpring.stiffness * motion.dx - dockSpring.damping * motion.vx;
					const ay =
						-dockSpring.stiffness * motion.dy - dockSpring.damping * motion.vy;
					motion.vx += ax * h;
					motion.vy += ay * h;
					motion.dx += motion.vx * h;
					motion.dy += motion.vy * h;
					time += h * 1000;
				}
				motion.time = now;
				if (
					Math.abs(motion.dx) < 0.25 &&
					Math.abs(motion.dy) < 0.25 &&
					Math.abs(motion.vx) < 8 &&
					Math.abs(motion.vy) < 8
				) {
					motion.dx = 0;
					motion.dy = 0;
					motion.vx = 0;
					motion.vy = 0;
				}
			}
			if (motion.dx || motion.dy || now < motion.holdUntil) busy = true;

			motion.flood = clamp(tweenAt(motion.ink, now));
			if (now < tweenEnd(motion.ink)) busy = true;

			const isSelected = selectedNow.includes(key);
			const elapsed = now - motion.start;
			if (motion.kind === "merge") {
				const grow = easeOut(clamp(elapsed / NECK_DURATION));
				const docked =
					motion.distance > 0.5
						? 1 - clamp(Math.hypot(motion.dx, motion.dy) / motion.distance)
						: 1;
				motion.bond = grow * (0.45 + 0.55 * docked);
				if (elapsed >= MERGE_DURATION) motion.kind = null;
				else busy = true;
			} else if (motion.kind === "detach") {
				motion.bond =
					elapsed < 0 ? 1 : 1 - smoothstep(clamp(elapsed / SNAP_DURATION));
				if (elapsed >= DETACH_DURATION) motion.kind = null;
				else busy = true;
			} else {
				motion.bond = isSelected ? 1 : 0;
			}

			// A neck fades while an outlined chip lies across its path, so ink
			// never shows through another chip's label.
			let blocked = false;
			const box = boxes.get(key);
			if (box && motion.kind) {
				// A merge checks where chips are drawn now; a detach checks the
				// slots they're heading for, so its neck never forms across one.
				const live = motion.kind === "merge" ? 1 : 0;
				const x = rtl
					? rowWidth - (box.left + motion.dx * live + box.width)
					: box.left + motion.dx * live;
				const pill = boxes.get("\u0000pill");
				const from = pill
					? rtl
						? rowWidth - pill.left
						: pill.left + pill.width
					: 0;
				for (const [other, otherMotion] of motionsRef.current) {
					if (other === key || otherMotion.flood > 0.05) continue;
					const otherBox = boxes.get(other);
					if (
						!otherBox ||
						Math.abs(
							otherBox.top + otherMotion.dy * live - box.top - motion.dy * live,
						) >
							HEIGHT / 2
					)
						continue;
					const ox = rtl
						? rowWidth -
							(otherBox.left + otherMotion.dx * live + otherBox.width)
						: otherBox.left + otherMotion.dx * live;
					if (ox < x && ox + otherBox.width > from) blocked = true;
				}
			}
			const target = blocked ? 0 : 1;
			motion.open += (target - motion.open) * (1 - Math.exp(-dt / OPEN_RATE));
			if (Math.abs(target - motion.open) < 0.01) motion.open = target;
			else busy = true;
		}

		if (now < tweenEnd(dividerTweenRef.current)) busy = true;
		if (now < tweenEnd(clearOutRef.current)) busy = true;
		if (clearInRef.current && now < tweenEnd(clearInRef.current)) busy = true;
		return !busy;
	};

	const finish = () => {
		cancelAnimationFrame(frameRef.current);
		frameRef.current = 0;
		for (const [key, motion] of motionsRef.current) {
			motion.kind = null;
			const chip = chipRefs.current.get(key);
			const ink = inkRefs.current.get(key);
			chip?.style.removeProperty("transform");
			chip?.style.removeProperty("z-index");
			ink?.style.removeProperty("opacity");
			ink?.style.removeProperty("clip-path");
		}
		dividerRef.current?.style.removeProperty("opacity");
		clearRef.current?.style.removeProperty("opacity");
		// Swap back to the plain CSS capsule before the next paint.
		flushSync(() => setAnimating(false));
	};

	const tick = (now: number) => {
		const done = step(now);
		paint(now);
		if (done) finish();
		else frameRef.current = requestAnimationFrame(tick);
	};

	const startLoop = (now: number) => {
		if (!frameRef.current) {
			lastFrameRef.current = now;
			frameRef.current = requestAnimationFrame(tick);
		}
	};

	// Every commit: spring any chip whose slot moved from where it's drawn, and
	// start a merge or detach for chips that joined or left the selection.
	useLayoutEffect(() => {
		const previousBoxes = boxesRef.current;
		measure();
		const boxes = boxesRef.current;
		const previous = previousRef.current;
		const next = latest.current.selected;
		const changed = !sameList(previous, next);
		previousRef.current = next;
		const reduced = latest.current.reducedMotion;

		if (reduced) {
			if (changed) {
				// No goo, no neck: chips that moved fade in where they land.
				for (const [key, element] of chipRefs.current) {
					const before = previousBoxes.get(key);
					const after = boxes.get(key);
					if (
						before &&
						after &&
						(before.left !== after.left || before.top !== after.top)
					) {
						element.animate([{ opacity: 0 }, { opacity: 1 }], {
							duration: CROSS_FADE,
							easing: "ease-out",
						});
					}
				}
			}
			return;
		}

		const now = performance.now();
		let moving = false;
		const added = next.filter((item) => !previous.includes(item));
		const removed = previous.filter((item) => !next.includes(item));
		const merging = added.length > 0;
		// Cleared chips drain back from the capsule's far end, one after another.
		const staggered = removed.length > 1 ? [...removed].reverse() : removed;

		for (const [key] of chipRefs.current) {
			const motion = motionFor(key, previous.includes(key));
			const before = previousBoxes.get(key);
			const after = boxes.get(key);
			if (before && after) {
				const dx = before.left - after.left;
				const dy = before.top - after.top;
				if (dx || dy) {
					motion.dx += dx;
					motion.dy += dy;
					motion.time = now;
					motion.holdUntil = Math.max(
						motion.holdUntil,
						now + (merging ? DOCK_DELAY : 0),
					);
					moving = true;
				}
			}
			const current = clamp(tweenAt(motion.ink, now));
			if (added.includes(key)) {
				motion.kind = "merge";
				motion.start = now;
				motion.distance = Math.hypot(motion.dx, motion.dy);
				motion.open = 1;
				// A chip caught mid-drain floods back at once.
				const delay = current > 0.05 ? 0 : FLOOD_DELAY;
				motion.ink = {
					from: current,
					to: 1,
					start: now + delay,
					duration: FLOOD_DURATION * (1 - current),
				};
				moving = true;
			} else if (removed.includes(key)) {
				const start = now + staggered.indexOf(key) * CLEAR_STAGGER;
				motion.kind = "detach";
				motion.start = start;
				motion.holdUntil = Math.max(motion.holdUntil, start);
				motion.ink = {
					from: current,
					to: 0,
					start,
					duration: DRAIN_DURATION * current,
				};
				moving = true;
			}
		}

		if (changed) {
			const divider = clamp(tweenAt(dividerTweenRef.current, now));
			const target = next.length > 0 ? 1 : 0;
			if (target !== dividerTweenRef.current.to) {
				dividerTweenRef.current =
					target === 1
						? {
								from: divider,
								to: 1,
								start: now + DIVIDER_IN_DELAY,
								duration: DIVIDER_IN,
							}
						: { from: divider, to: 0, start: now, duration: DIVIDER_OUT };
			}
			// The clear button sinks into the capsule while chips move and buds
			// back out once they've docked.
			const shown = clamp(clearAt(now));
			clearOutRef.current = {
				from: shown,
				to: 0,
				start: now,
				duration: CLEAR_OUT * shown,
			};
			clearInRef.current = latest.current.showClear
				? { from: 0, to: 1, start: now + CLEAR_IN_DELAY, duration: CLEAR_IN }
				: null;
			moving = true;
		}

		if (!moving) return;
		if (!animating) setAnimating(true);
		paint(now);
		startLoop(now);
	});

	// Once the SVG has mounted, draw it before the browser paints.
	useLayoutEffect(() => {
		if (animating) paint(performance.now());
	});

	useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

	// Slots move without animating when the row resizes at rest.
	useEffect(() => {
		const row = rowRef.current;
		const scroller = scrollerRef.current;
		if (!row || !scroller) return;
		const fades = () => {
			const max = scroller.scrollWidth - scroller.clientWidth;
			const at = scroller.scrollLeft;
			const rtl = getComputedStyle(scroller).direction === "rtl";
			const left = rtl ? max + at : at;
			const right = rtl ? -at : max - at;
			scroller.style.setProperty("--ifb-fade-l", left > 1 ? "20px" : "0px");
			scroller.style.setProperty("--ifb-fade-r", right > 1 ? "20px" : "0px");
		};
		const observer = new ResizeObserver(() => {
			if (!frameRef.current) measure();
			fades();
		});
		observer.observe(row);
		observer.observe(scroller);
		scroller.addEventListener("scroll", fades, { passive: true });
		fades();
		return () => {
			observer.disconnect();
			scroller.removeEventListener("scroll", fades);
		};
	}, [measure]);

	const countText = formatCount(count);
	const announcedRef = useRef(countText);
	useEffect(() => {
		if (countText === announcedRef.current) return;
		const timer = setTimeout(() => {
			announcedRef.current = countText;
			// A zero-width space makes a repeated count announce again.
			setAnnouncement((previous) =>
				previous === `${countText} ${label}`
					? `${countText} ${label}​`
					: `${countText} ${label}`,
			);
		}, ANNOUNCE_DELAY);
		return () => clearTimeout(timer);
	}, [countText, label]);

	const silent = () =>
		typeof document !== "undefined" && document.visibilityState === "hidden";

	// Called only for user input, so the first render and prop changes stay quiet.
	const commit = (next: string[], cue: "absorb" | "detach") => {
		const current = latest.current;
		if (sameList(next, current.selected)) return;
		toggledAtRef.current = performance.now();
		if (!current.controlled) setInternalValue(next);
		current.onValueChange?.(next);
		if (!silent()) {
			if (current.sound) {
				if (cue === "absorb") playDrop(true);
				else playUnstick(false);
			}
			if (current.haptics)
				void haptic(cue === "absorb" ? "light" : "selection");
		}
		// A chip picked while the row is scrolled lands in view at the start.
		const scroller = scrollerRef.current;
		if (cue === "absorb" && scroller && scroller.scrollLeft !== 0) {
			scroller.scrollTo({
				left: 0,
				behavior: current.reducedMotion ? "auto" : "smooth",
			});
		}
	};

	const toggle = (item: string) => {
		const current = latest.current.selected;
		const on = !current.includes(item);
		if (latest.current.type === "single") {
			commit(on ? [item] : [], on ? "absorb" : "detach");
		} else {
			commit(
				on ? [...current, item] : current.filter((entry) => entry !== item),
				on ? "absorb" : "detach",
			);
		}
	};

	const clearAll = () => {
		commit([], "detach");
		latest.current.onClear?.();
		// The clear button hides, so focus moves to the first chip, which is
		// the first option once nothing is picked.
		const first = latest.current.options[0]?.value;
		if (first) {
			setFocusValue(first);
			requestAnimationFrame(() => chipRefs.current.get(first)?.focus());
		}
	};

	/** Chip values in the order they're drawn: the capsule first. */
	const visualOrder = () => {
		const chosen = latest.current.selected;
		return [
			...chosen,
			...latest.current.options
				.map((option) => option.value)
				.filter((item) => !chosen.includes(item)),
		];
	};
	const order = [
		...selected,
		...options
			.map((option) => option.value)
			.filter((item) => !selected.includes(item)),
	];
	const roving =
		focusValue && order.includes(focusValue) ? focusValue : order[0];

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement;
		const item = target.dataset.value;
		if (!item || target.dataset.slot !== "ink-filter-bar-chip") return;
		const list = visualOrder();
		const index = list.indexOf(item);
		const rtl = rtlRef.current;
		let nextIndex: number;
		switch (event.key) {
			case "ArrowRight":
				nextIndex = index + (rtl ? -1 : 1);
				break;
			case "ArrowLeft":
				nextIndex = index + (rtl ? 1 : -1);
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = list.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		const nextItem = list[clamp(nextIndex, 0, list.length - 1)];
		if (!nextItem) return;
		setFocusValue(nextItem);
		chipRefs.current.get(nextItem)?.focus();
	};

	const canHover = () =>
		typeof window !== "undefined" &&
		window.matchMedia("(hover: hover) and (pointer: fine)").matches;

	const rollDelay = Math.max(
		0,
		FLOOD_DELAY -
			(typeof performance === "undefined"
				? FLOOD_DELAY
				: performance.now() - toggledAtRef.current),
	);
	const joined = selected.length > 0;
	const lastDocked = selected[selected.length - 1];

	return (
		<div
			{...props}
			ref={rootRef}
			role="group"
			data-slot="ink-filter-bar"
			className={cn("relative w-full min-w-0 text-foreground", className)}
		>
			<div
				ref={scrollerRef}
				data-slot="ink-filter-bar-viewport"
				className={cn(
					"-m-1.5 scroll-px-1.5 p-1.5",
					wrap
						? null
						: "snap-x snap-proximity overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				)}
				style={
					wrap
						? undefined
						: {
								maskImage:
									"linear-gradient(to right, transparent, #000 var(--ifb-fade-l, 0px), #000 calc(100% - var(--ifb-fade-r, 0px)), transparent)",
							}
				}
			>
				<div
					ref={rowRef}
					onKeyDown={handleKeyDown}
					className={cn(
						"relative isolate flex items-center",
						wrap ? "flex-wrap gap-y-2" : "w-max",
					)}
				>
					{animating ? (
						<svg
							ref={svgRef}
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible text-foreground"
						>
							<defs>
								<filter
									ref={gooRef}
									id={gooId}
									filterUnits="userSpaceOnUse"
									colorInterpolationFilters="sRGB"
								>
									<feGaussianBlur stdDeviation={GOO_BLUR} />
									{/* Thresholds alpha at 0.5, so straight edges stay put. */}
									<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10" />
								</filter>
							</defs>
							<g ref={flipRef}>
								<g filter={`url(#${gooId})`} fill="currentColor">
									{["pill", "clear"].map((key) => (
										<rect
											key={key}
											ref={(node) => {
												if (node) shapeRefs.current.set(key, node);
												else shapeRefs.current.delete(key);
											}}
										/>
									))}
									{options.map((option) =>
										["ink", "neck", "bead"].map((part) => {
											const key = `${part}:${option.value}`;
											const ref = (
												node: SVGRectElement | SVGCircleElement | null,
											) => {
												if (node) shapeRefs.current.set(key, node);
												else shapeRefs.current.delete(key);
											};
											return part === "bead" ? (
												<circle key={key} ref={ref} r={0} />
											) : (
												<rect key={key} ref={ref} />
											);
										}),
									)}
								</g>
							</g>
						</svg>
					) : null}

					<div
						ref={pillRef}
						data-slot="ink-filter-bar-count"
						style={{ order: 0 }}
						className={cn(
							"relative z-[1] inline-flex h-9 shrink-0 snap-start items-center gap-1 whitespace-nowrap rounded-full bg-foreground px-3.5 text-background text-sm leading-5",
							joined ? "me-0" : "me-2",
							joined && !animating && "rounded-e-none",
						)}
					>
						<span className="sr-only">
							{countText} {label}
						</span>
						<span aria-hidden="true" className="flex items-center gap-1">
							<span className="font-semibold">
								<RollingNumber
									text={countText}
									delay={rollDelay}
									reduced={reducedMotion}
								/>
							</span>
							<span className="font-medium text-background/60">{label}</span>
						</span>
						<span
							ref={dividerRef}
							aria-hidden="true"
							data-slot="ink-filter-bar-divider"
							className={cn(
								"pointer-events-none absolute inset-y-2 end-0 w-px bg-background/25",
								joined ? "opacity-100" : "opacity-0",
							)}
						/>
					</div>

					{options.map((option, index) => {
						const isSelected = selected.includes(option.value);
						const position = isSelected
							? 1 + selected.indexOf(option.value)
							: selected.length + 2 + index;
						const capsuleEnd =
							isSelected && option.value === lastDocked && !showClear;
						// Only an outlined chip at rest wobbles; never while ink moves.
						const wobble =
							hovered === option.value &&
							!isSelected &&
							!animating &&
							!reducedMotion;
						return (
							<button
								key={option.value}
								ref={(node) => {
									if (node) chipRefs.current.set(option.value, node);
									else chipRefs.current.delete(option.value);
								}}
								type="button"
								aria-pressed={isSelected}
								tabIndex={option.value === roving ? 0 : -1}
								data-slot="ink-filter-bar-chip"
								data-state={isSelected ? "on" : "off"}
								data-value={option.value}
								style={{ order: position }}
								onClick={() => toggle(option.value)}
								onFocus={() => setFocusValue(option.value)}
								onPointerEnter={(event) => {
									if (event.pointerType === "mouse" && canHover()) {
										setHovered(option.value);
									}
								}}
								onPointerLeave={() =>
									setHovered((current) =>
										current === option.value ? null : current,
									)
								}
								className={cn(
									"group/chip relative z-[1] inline-flex h-9 shrink-0 cursor-pointer touch-manipulation select-none snap-start items-center whitespace-nowrap rounded-full px-3.5 font-medium text-sm leading-5 outline-offset-2 transition-[scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid active:scale-[0.97] motion-reduce:transition-none",
									// A 44 px tall hit area around the 36 px chip.
									"before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
									isSelected && !capsuleEnd ? "me-0" : "me-2",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute inset-0 rounded-full border-[1.5px] border-current",
										wobble && "border-transparent",
									)}
								/>
								{wobble ? (
									<WobbleOutline
										width={boxesRef.current.get(option.value)?.width}
									/>
								) : null}
								<span className="relative z-[1] inline-flex items-center gap-1.5">
									{option.label}
									{option.count !== undefined ? (
										<span className="tabular-nums opacity-60">
											{option.count}
										</span>
									) : null}
								</span>
								{/* The same label in the inverted color, revealed by the ink. */}
								<span
									ref={(node) => {
										if (node) inkRefs.current.set(option.value, node);
										else inkRefs.current.delete(option.value);
									}}
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute inset-0 z-[2] flex items-center rounded-full bg-foreground px-3.5 text-background",
										isSelected ? "opacity-100" : "opacity-0",
										isSelected && !animating && "rounded-s-none",
										isSelected && !animating && !capsuleEnd && "rounded-e-none",
									)}
								>
									<span className="inline-flex items-center gap-1.5">
										{option.label}
										{option.count !== undefined ? (
											<span className="tabular-nums opacity-60">
												{option.count}
											</span>
										) : null}
									</span>
								</span>
							</button>
						);
					})}

					{clearable ? (
						<button
							ref={clearRef}
							type="button"
							hidden={!showClear}
							aria-label="Clear filters"
							data-slot="ink-filter-bar-clear"
							style={{ order: selected.length + 1 }}
							onClick={clearAll}
							className={cn(
								"relative z-[1] me-2 inline-flex h-9 w-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-foreground text-background/70 outline-offset-2 transition-colors hover:text-background focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid",
								"before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
								!animating && "rounded-s-none",
							)}
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 16 16"
								className="size-3.5 -translate-x-0.5 rtl:translate-x-0.5"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
							>
								<path d="M4 4l8 8M12 4l-8 8" />
							</svg>
						</button>
					) : null}
				</div>
			</div>

			<span role="status" aria-live="polite" className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export default InkFilterBar;
