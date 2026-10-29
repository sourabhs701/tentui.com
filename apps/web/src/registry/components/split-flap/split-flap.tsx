"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	type AnimationPlaybackControls,
	animate,
	useReducedMotion,
} from "motion/react";
import {
	type CSSProperties,
	memo,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const DEFAULT_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-/!?";
const ELLIPSIS = "…";

/** Most cells allowed mid-flap at once; the rest wait for a free slot. */
const MAX_FLIPPING = 120;
/** Each row starts this many cells' worth of `stagger` after the row above. */
const ROW_STAGGER = 2;
/** The last two flaps of a cell take this much longer, so it slows to a stop. */
const SECOND_LAST_FLAP = 1.3;
const LAST_FLAP = 1.7;
/** The final flap bounces this far past rest, in degrees. */
const OVERSHOOT_DEG = 2;
const settleSpring = { type: "spring", stiffness: 500, damping: 25 } as const;
/** Darkest a flap gets while it is edge-on to the light. */
const SHADE = 0.6;
/** Reduced motion swaps characters with a cross-fade this long, in ms. */
const FADE_MS = 120;
/** At most one rattle click per this many ms for the whole board. */
const RATTLE_MS = 28;
/** Minimum ms between flap haptics, and the most per transition. */
const HAPTIC_MS = 60;
const MAX_HAPTICS = 10;
/** A value change this soon after a press or key counts as user-triggered. */
const GESTURE_WINDOW_MS = 1000;
/** Autoplay never rotates faster than this under reduced motion. */
const REDUCED_MIN_INTERVAL = 5000;

/** A short, dry clack; its pitch and level are jittered per click. */
const clackTheme = {
	name: "split-flap-clack",
	baseFreq: 440,
	noiseColor: "white",
	oscType: "triangle",
	filterFreq: 2400,
	filterQ: 1.4,
	attack: 0.001,
	decay: 0.7,
	brightness: 3200,
} as const;

/** A lower, longer pop for the moment the board comes to rest. */
const thunkTheme = {
	...clackTheme,
	name: "split-flap-thunk",
	baseFreq: 290,
	oscType: "sine",
	decay: 1.3,
} as const;

/** All lengths are the largest a cell gets; cells shrink to fit the container. */
const sizes = {
	sm: { cell: "1.5rem", gap: "2px", pad: "6px" },
	md: { cell: "2.25rem", gap: "3px", pad: "8px" },
	lg: { cell: "3.25rem", gap: "4px", pad: "10px" },
} as const;

const tones = {
	ink: {
		"--sf-housing": "#0a0a0a",
		"--sf-flap-top": "#181818",
		"--sf-flap-bottom": "#111111",
		"--sf-glyph": "#f2efe6",
		"--sf-hinge": "rgba(0, 0, 0, 0.9)",
		"--sf-pin": "#3a3a3a",
		"--sf-edge": "rgba(255, 255, 255, 0.06)",
		"--sf-control": "rgba(242, 239, 230, 0.6)",
		"--sf-shade": "#000000",
	},
	paper: {
		"--sf-housing": "#d9d7d0",
		"--sf-flap-top": "#fbfaf6",
		"--sf-flap-bottom": "#f0eee8",
		"--sf-glyph": "#161616",
		"--sf-hinge": "rgba(0, 0, 0, 0.3)",
		"--sf-pin": "#aeaba2",
		"--sf-edge": "rgba(255, 255, 255, 0.8)",
		"--sf-control": "rgba(22, 22, 22, 0.6)",
		"--sf-shade": "rgba(70, 64, 52, 0.5)",
	},
} as const;

type Align = "start" | "center" | "end";
type Message = string | string[];

export interface SplitFlapAccent {
	/** Called with each cell's target character (or word), row, and column. */
	match: (char: string, rowIndex: number, colIndex: number) => boolean;
	className: string;
}

export interface SplitFlapProps {
	/** The text to show. Pass an array for a multi-row board, one string per row. */
	value?: Message;
	/** Cells per row. Defaults to the longest row; longer text is cropped. */
	length?: number;
	/** Rows on the board. Defaults to the most rows in `value` or `values`. */
	rows?: number;
	/** Which side short text sits on; the rest is padded with blanks. */
	align?: Align;
	/** The deck, in flip order. Cells only ever flip forward through it. */
	chars?: string;
	/** Whole-word flaps for the first cell of each row, like "ON TIME" or "DELAYED". */
	words?: string[];
	/** Duration of one flap, in ms. */
	flipMs?: number;
	/** Delay between cells starting, in ms, left to right then top to bottom. */
	stagger?: number;
	/** Slow the last two flaps of each cell and bounce the final one. */
	settle?: boolean;
	/** `ink` is light on dark; `paper` is dark on light. */
	tone?: keyof typeof tones;
	size?: keyof typeof sizes;
	/** Colors specific cells, such as status words. */
	accent?: SplitFlapAccent;
	/** Messages to rotate through with `autoplay`. Replaces `value`. */
	values?: Message[];
	/** Ms each message stays up once it lands, with `autoplay`. At least 5000 under reduced motion. */
	interval?: number;
	/** Loop through `values`, pausing while off-screen or in a hidden tab. */
	autoplay?: boolean;
	/** Play the flap rattle and the settle thunk. Off under reduced motion unless set to `true`. */
	sound?: boolean;
	/** Trigger haptics for user-triggered changes. Off under reduced motion unless set to `true`. */
	haptics?: boolean;
	/** Sound volume, 0 to 1. */
	volume?: number;
	/** Show a button that mutes and unmutes the board. */
	soundToggle?: boolean;
	/** Announce the final text through a polite live region once the board settles. */
	announce?: boolean;
	/** Makes the board a button. */
	onClick?: () => void;
	/** Called when a change starts flipping a resting board. */
	onFlipStart?: () => void;
	/** Called once every cell has landed, with the value it shows. */
	onSettled?: (value: Message) => void;
	"aria-label"?: string;
	className?: string;
	cellClassName?: string;
}

interface Deck {
	glyphs: string[];
	index: Map<string, number>;
	blank: number;
}

/** A deck of unique characters; the blank is a space, or the first card without one. */
function buildDeck(chars: string): Deck {
	const glyphs = Array.from(new Set(Array.from(chars)));
	if (glyphs.length === 0) glyphs.push(" ");
	const index = new Map(glyphs.map((glyph, i) => [glyph, i]));
	return { glyphs, index, blank: index.get(" ") ?? 0 };
}

/** Word decks start with a blank flap and match case-insensitively. */
function buildWordDeck(words: string[]): Deck | null {
	const unique = Array.from(
		new Set(words.map((word) => word.trim()).filter(Boolean)),
	);
	if (unique.length === 0) return null;
	const glyphs = [" ", ...unique];
	const index = new Map(glyphs.map((word, i) => [word.toUpperCase(), i]));
	return { glyphs, index, blank: 0 };
}

function toRows(message: Message | undefined): string[] {
	if (message === undefined) return [""];
	return typeof message === "string" ? [message] : message;
}

/** Splits a leading deck word off a row, so "DELAYED 10:40" is a word and "10:40". */
function splitWord(row: string, wordDeck: Deck | null) {
	if (!wordDeck) return { word: -1, rest: row };
	const upper = row.toUpperCase();
	let best = -1;
	let bestLength = 0;
	wordDeck.glyphs.forEach((word, index) => {
		if (index === wordDeck.blank || word.length <= bestLength) return;
		const ends = upper.length === word.length || upper[word.length] === " ";
		if (ends && upper.startsWith(word.toUpperCase())) {
			best = index;
			bestLength = word.length;
		}
	});
	if (best < 0) return { word: wordDeck.blank, rest: row };
	return { word: best, rest: row.slice(bestLength).replace(/^ /, "") };
}

/** Characters not in the deck are uppercased, then fall back to blank. */
function cardOf(char: string, deck: Deck) {
	return (
		deck.index.get(char) ?? deck.index.get(char.toUpperCase()) ?? deck.blank
	);
}

function fitRow(text: string, length: number, align: Align, deck: Deck) {
	let chars = Array.from(text);
	if (chars.length > length) {
		chars = chars.slice(0, length);
		if (length > 0 && deck.index.has(ELLIPSIS)) chars[length - 1] = ELLIPSIS;
	}
	const cards = chars.map((char) => cardOf(char, deck));
	const pad = length - cards.length;
	const before =
		align === "end" ? pad : align === "center" ? Math.floor(pad / 2) : 0;
	return [
		...Array<number>(before).fill(deck.blank),
		...cards,
		...Array<number>(pad - before).fill(deck.blank),
	];
}

interface CellSpec {
	deck: Deck;
	target: number;
	/** Position in the start order, in units of `stagger`. */
	order: number;
	row: number;
	col: number;
	word: boolean;
}

interface CellState {
	deck: Deck;
	glyph: number;
	target: number;
	/** The card the flap in progress lands on, or -1 at rest. */
	next: number;
	startAt: number;
	endAt: number;
	/** The flap in progress is the last before the target. */
	final: boolean;
	fading: boolean;
	animations: AnimationPlaybackControls[];
}

interface CellElements {
	root: HTMLElement;
	flapTop: HTMLElement;
	flapBottom: HTMLElement;
	shadeTop: HTMLElement;
	shadeBottom: HTMLElement;
	/** Static top, static bottom, falling top flap, incoming bottom flap. */
	faces: HTMLElement[];
}

interface BoardOptions {
	flipMs: number;
	stagger: number;
	settle: boolean;
	reduced: boolean;
	sound: boolean;
	haptics: boolean;
	/** False while the board is off-screen or the tab is hidden. */
	audible: () => boolean;
	click: (flipping: number) => void;
	thunk: () => void;
	haptic: (kind: "selection" | "rigid") => void;
	flipStart: () => void;
	settled: () => void;
}

const FACES = ["static-top", "static-bottom", "flap-top", "flap-bottom"];

function setText(element: HTMLElement | undefined, text: string) {
	if (!element) return;
	const node = element.firstChild;
	if (node && node.nodeType === Node.TEXT_NODE) {
		if (node.nodeValue !== text) node.nodeValue = text;
	} else {
		element.textContent = text;
	}
}

/**
 * The sequencer. It owns every cell's current card and drives the flaps, the
 * rattle, and the haptics from one animation frame loop, so sound and touch
 * land with the flap they belong to. React renders the settled text once and
 * the board paints each card from then on.
 */
class FlapBoard {
	cells: CellState[] = [];
	elements: (CellElements | null)[] = [];
	options: BoardOptions;
	private roots: (HTMLElement | null)[] = [];
	private stale = new Set<number>();
	private frame = 0;
	private synced = false;
	private alive = false;
	private busy = false;
	private moved = false;
	private user = false;
	private lastClickAt = Number.NEGATIVE_INFINITY;
	private lastHapticAt = Number.NEGATIVE_INFINITY;
	private hapticCount = 0;

	constructor(options: BoardOptions) {
		this.options = options;
	}

	attach(id: number, root: HTMLElement | null) {
		if (!root) {
			this.elements[id] = null;
			return;
		}
		// A cell that remounted shows React's text, not the sequencer's card.
		if (this.roots[id] && this.roots[id] !== root) this.stale.add(id);
		this.roots[id] = root;
		const part = (name: string) =>
			root.querySelector<HTMLElement>(`[data-part="${name}"]`) ?? root;
		this.elements[id] = {
			root,
			flapTop: part("flap-top"),
			flapBottom: part("flap-bottom"),
			shadeTop: part("shade-top"),
			shadeBottom: part("shade-bottom"),
			faces: FACES.map((face) => part(`face-${face}`)),
		};
	}

	/** Points every cell at its new target and starts the cells that differ. */
	sync(specs: CellSpec[], user: boolean) {
		const now = performance.now();
		const first = !this.synced;
		this.synced = true;
		for (let id = specs.length; id < this.cells.length; id++) {
			const cell = this.cells[id];
			if (cell) this.stopAnimations(cell);
		}
		this.cells = specs.map((spec, id) => {
			let cell = this.cells[id];
			if (!cell || cell.deck !== spec.deck || this.stale.has(id)) {
				if (cell) this.stopAnimations(cell);
				// New cells start blank and flip in; on first render they are already set.
				const glyph = first ? spec.target : spec.deck.blank;
				cell = {
					deck: spec.deck,
					glyph,
					target: glyph,
					next: -1,
					startAt: now,
					endAt: now,
					final: false,
					fading: false,
					animations: [],
				};
				this.rest(id, cell, false);
			}
			const startAt = this.options.reduced
				? now
				: now + spec.order * this.options.stagger;
			// Cells already flipping keep going; resting ones queue behind the stagger.
			if (cell.next < 0 && cell.glyph === cell.target) cell.startAt = startAt;
			cell.target = spec.target;
			return cell;
		});
		this.stale.clear();
		if (first) return;

		const pending = this.cells.some(
			(cell) => cell.next >= 0 || cell.glyph !== cell.target,
		);
		if (!pending) return;
		if (!this.busy) {
			this.busy = true;
			this.moved = false;
			this.user = user;
			this.hapticCount = 0;
			this.options.flipStart();
		} else if (user) {
			this.user = true;
			this.hapticCount = 0;
		}
		this.run();
	}

	mount() {
		this.alive = true;
		this.run();
	}

	unmount() {
		this.alive = false;
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		for (const cell of this.cells) this.stopAnimations(cell);
	}

	/** Hidden tab: stop where it is. */
	pause() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		for (const cell of this.cells) this.stopAnimations(cell);
	}

	/** Back from a hidden tab: jump every cell to its target, silently. */
	resume() {
		if (!this.alive || !this.busy) return;
		this.cells.forEach((cell, id) => {
			cell.glyph = cell.target;
			cell.next = -1;
			this.rest(id, cell, false);
		});
		this.finish(false);
	}

	private run() {
		if (!this.alive || this.frame || !this.busy) return;
		if (typeof document !== "undefined" && document.hidden) return;
		this.frame = requestAnimationFrame(this.tick);
	}

	private tick = (now: number) => {
		this.frame = 0;
		const { reduced } = this.options;
		let flipping = 0;
		for (const cell of this.cells) if (cell.next >= 0) flipping++;
		let landed = 0;
		let pending = false;

		this.cells.forEach((cell, id) => {
			if (cell.next >= 0) {
				if (now < cell.endAt) {
					pending = true;
					return;
				}
				const flap = !cell.fading;
				this.land(id, cell);
				flipping--;
				if (flap) landed++;
				if (cell.glyph === cell.target) {
					this.rest(id, cell, flap && cell.final);
					return;
				}
			}
			if (cell.glyph === cell.target) return;
			pending = true;
			if (now < cell.startAt || flipping >= MAX_FLIPPING) return;
			if (reduced) this.fade(id, cell, now);
			else this.flap(id, cell, now);
			flipping++;
		});

		if (landed > 0) this.rattle(now, flipping + landed);
		if (pending) this.frame = requestAnimationFrame(this.tick);
		else this.finish(true);
	};

	private flap(id: number, cell: CellState, now: number) {
		const { flipMs, settle } = this.options;
		const count = cell.deck.glyphs.length;
		const remaining = (cell.target - cell.glyph + count) % count;
		const next = (cell.glyph + 1) % count;
		const factor = !settle
			? 1
			: remaining === 1
				? LAST_FLAP
				: remaining === 2
					? SECOND_LAST_FLAP
					: 1;
		const duration = flipMs * factor;
		this.stopAnimations(cell);
		cell.next = next;
		cell.endAt = now + duration;
		cell.final = remaining === 1;
		cell.fading = false;
		this.moved = true;

		const elements = this.elements[id];
		if (!elements) return;
		const text = cell.deck.glyphs[next] ?? " ";
		// The next card waits behind the falling flap and on the incoming one.
		setText(elements.faces[0], text);
		setText(elements.faces[3], text);
		const { flapTop, flapBottom, shadeTop, shadeBottom } = elements;
		flapTop.style.willChange = "transform";
		flapBottom.style.willChange = "transform";
		flapBottom.style.transform = "rotateX(90deg)";
		const half = duration / 2000;
		const bounce = cell.final && settle;
		cell.animations = [
			animate(
				flapTop,
				{ transform: ["rotateX(0deg)", "rotateX(-90deg)"] },
				{ duration: half, ease: "easeIn" },
			),
			animate(
				shadeTop,
				{ opacity: [0, SHADE] },
				{ duration: half, ease: "easeIn" },
			),
			animate(
				flapBottom,
				{
					transform: bounce
						? [
								"rotateX(90deg)",
								"rotateX(0deg)",
								`rotateX(${OVERSHOOT_DEG}deg)`,
							]
						: ["rotateX(90deg)", "rotateX(0deg)"],
				},
				{
					duration: half,
					delay: half,
					ease: bounce ? ["easeIn", "easeOut"] : "easeIn",
					...(bounce ? { times: [0, 0.8, 1] } : null),
				},
			),
			animate(
				shadeBottom,
				{ opacity: [SHADE, 0] },
				{ duration: half, delay: half, ease: "easeOut" },
			),
		];
	}

	/** Reduced motion: the old card fades out over the new one, no flaps. */
	private fade(id: number, cell: CellState, now: number) {
		this.stopAnimations(cell);
		cell.next = cell.target;
		cell.endAt = now + FADE_MS;
		cell.final = true;
		cell.fading = true;
		this.moved = true;
		const elements = this.elements[id];
		if (!elements) return;
		const text = cell.deck.glyphs[cell.target] ?? " ";
		setText(elements.faces[0], text);
		setText(elements.faces[1], text);
		cell.animations = [elements.flapTop, elements.flapBottom].map((flap) =>
			animate(
				flap,
				{ opacity: [1, 0] },
				{ duration: FADE_MS / 1000, ease: "easeOut" },
			),
		);
	}

	private land(id: number, cell: CellState) {
		this.stopAnimations(cell);
		cell.glyph = cell.next;
		cell.next = -1;
		const elements = this.elements[id];
		if (!elements) return;
		const text = cell.deck.glyphs[cell.glyph] ?? " ";
		for (const face of elements.faces) setText(face, text);
		elements.flapTop.style.transform = "";
		elements.flapBottom.style.transform = "";
		elements.flapTop.style.opacity = "";
		elements.flapBottom.style.opacity = "";
		elements.shadeTop.style.opacity = "";
		elements.shadeBottom.style.opacity = "";
	}

	/** Paints a resting cell; `bounce` springs the last flap back from its overshoot. */
	private rest(id: number, cell: CellState, bounce: boolean) {
		this.stopAnimations(cell);
		const elements = this.elements[id];
		if (!elements) return;
		const text = cell.deck.glyphs[cell.glyph] ?? " ";
		for (const face of elements.faces) setText(face, text);
		for (const element of [
			elements.flapTop,
			elements.flapBottom,
			elements.shadeTop,
			elements.shadeBottom,
		]) {
			element.style.transform = "";
			element.style.opacity = "";
			element.style.willChange = "";
		}
		if (bounce && this.options.settle && !this.options.reduced) {
			elements.flapBottom.style.transform = `rotateX(${OVERSHOOT_DEG}deg)`;
			cell.animations = [
				animate(
					elements.flapBottom,
					{
						transform: [`rotateX(${OVERSHOOT_DEG}deg)`, "rotateX(0deg)"],
					},
					settleSpring,
				),
			];
		}
	}

	private stopAnimations(cell: CellState) {
		for (const animation of cell.animations) animation.stop();
		cell.animations = [];
	}

	/** The board-level rattle: one click at most per `RATTLE_MS`, however many flaps land. */
	private rattle(now: number, flipping: number) {
		const { sound, haptics, reduced, audible } = this.options;
		if (reduced || !this.alive || !audible()) return;
		// A lone cell clacks on every flap; a busy board thins out into a dense rattle.
		const chance = flipping <= 1 ? 1 : Math.min(1, 0.45 + flipping / 40);
		if (
			sound &&
			now - this.lastClickAt >= RATTLE_MS &&
			Math.random() < chance
		) {
			this.lastClickAt = now;
			this.options.click(flipping);
		}
		if (
			haptics &&
			this.user &&
			this.hapticCount < MAX_HAPTICS &&
			now - this.lastHapticAt >= HAPTIC_MS
		) {
			this.lastHapticAt = now;
			this.hapticCount++;
			this.options.haptic("selection");
		}
	}

	private finish(cue: boolean) {
		if (!this.busy) return;
		this.busy = false;
		const { sound, haptics, audible } = this.options;
		if (cue && this.moved && this.alive && audible()) {
			if (sound) this.options.thunk();
			if (haptics && this.user) this.options.haptic("rigid");
		}
		this.user = false;
		this.options.settled();
	}
}

const Cell = memo(function Cell({
	id,
	initial,
	word,
	span,
	board,
	className,
}: {
	id: number;
	initial: string;
	word: boolean;
	span: number;
	board: FlapBoard;
	className?: string;
}) {
	// React paints the first card only; the sequencer owns the text after that.
	const [text] = useState(initial);
	const half =
		"absolute inset-x-0 h-1/2 overflow-hidden shadow-[inset_0_0_0_1px_var(--sf-edge)]";
	const top = cn(half, "top-0 rounded-t-[4px] bg-(--sf-flap-top)");
	const bottom = cn(half, "bottom-0 rounded-b-[4px] bg-(--sf-flap-bottom)");
	const glyph = (face: string, position: "top" | "bottom") => (
		<span
			data-part={`face-${face}`}
			className={cn(
				"absolute inset-x-0 flex h-[200%] items-center justify-center whitespace-pre",
				position === "top" ? "top-0" : "bottom-0",
			)}
		>
			{text}
		</span>
	);
	const shade = (name: string) => (
		<span
			data-part={name}
			className="pointer-events-none absolute inset-0 bg-(--sf-shade) opacity-0"
		/>
	);

	return (
		<div
			ref={(element) => board.attach(id, element)}
			data-word={word || undefined}
			className={cn(
				"text-(color:--sf-glyph) perspective-[400px] relative shrink-0 rounded-[4px] font-semibold leading-none",
				className,
			)}
			style={{
				width:
					span > 1
						? `calc(var(--sf-cell) * ${span} + var(--sf-gap) * ${span - 1})`
						: "var(--sf-cell)",
				height: "calc(var(--sf-cell) * 1.4)",
				fontSize: word
					? "calc(var(--sf-cell) * 0.5)"
					: "calc(var(--sf-cell) * 0.9)",
			}}
		>
			<div className={top}>{glyph("static-top", "top")}</div>
			<div className={bottom}>{glyph("static-bottom", "bottom")}</div>
			<div
				data-part="flap-bottom"
				className={cn(bottom, "backface-hidden origin-top")}
			>
				{glyph("flap-bottom", "bottom")}
				{shade("shade-bottom")}
			</div>
			<div
				data-part="flap-top"
				className={cn(top, "backface-hidden origin-bottom")}
			>
				{glyph("flap-top", "top")}
				{shade("shade-top")}
			</div>
			<span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-(--sf-hinge)" />
			<span className="pointer-events-none absolute top-1/2 left-0 h-[12%] w-[2px] -translate-y-1/2 rounded-r-[1px] bg-(--sf-pin)" />
			<span className="pointer-events-none absolute top-1/2 right-0 h-[12%] w-[2px] -translate-y-1/2 rounded-l-[1px] bg-(--sf-pin)" />
		</div>
	);
});

function SpeakerIcon({ muted }: { muted: boolean }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-3.5"
			aria-hidden
		>
			<path d="M2.5 6v4h2.5l3.5 3V3L5 6H2.5Z" />
			{muted ? (
				<path d="m11 6 3 4m0-4-3 4" />
			) : (
				<path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.75 3.75a6 6 0 0 1 0 8.5" />
			)}
		</svg>
	);
}

function PlayPauseIcon({ paused }: { paused: boolean }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="currentColor"
			className="size-3.5"
			aria-hidden
		>
			{paused ? (
				<path d="M5 3.5v9l7.5-4.5L5 3.5Z" />
			) : (
				<path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z" />
			)}
		</svg>
	);
}

export function SplitFlap({
	value,
	length: lengthProp,
	rows: rowsProp,
	align = "start",
	chars = DEFAULT_CHARS,
	words,
	flipMs = 90,
	stagger = 45,
	settle = true,
	tone = "ink",
	size = "md",
	accent,
	values,
	interval = 4000,
	autoplay = false,
	sound: soundProp,
	haptics: hapticsProp,
	volume = 0.6,
	soundToggle = false,
	announce = false,
	onClick,
	onFlipStart,
	onSettled,
	"aria-label": ariaLabel,
	className,
	cellClassName,
}: SplitFlapProps) {
	const reduced = useReducedMotion() ?? false;
	const sound = soundProp ?? !reduced;
	const haptics = hapticsProp ?? !reduced;
	const safeVolume = Math.min(
		Math.max(Number.isFinite(volume) ? volume : 0.6, 0),
		1,
	);

	const { trigger: haptic } = useWebHaptics();
	const tiks = useTiks({
		volume: safeVolume,
		// Reduced motion is handled here, so an explicit `sound` still plays.
		respectReducedMotion: false,
	});

	const [step, setStep] = useState(0);
	// Counts landings, so autoplay holds each message for `interval` after it lands.
	const [landings, setLandings] = useState(0);
	const [paused, setPaused] = useState(false);
	const [inView, setInView] = useState(true);
	const [pageHidden, setPageHidden] = useState(false);
	const [muted, setMuted] = useState(false);
	const [activated, setActivated] = useState(false);

	const rotating = values !== undefined && values.length > 0;
	const message: Message = rotating
		? (values[step % values.length] ?? "")
		: (value ?? "");
	const [settledMessage, setSettledMessage] = useState<Message>(message);

	const deck = useMemo(() => buildDeck(chars), [chars]);
	const wordsKey = words?.join("\u0000") ?? "";
	const wordDeck = useMemo(
		() => (wordsKey ? buildWordDeck(wordsKey.split("\u0000")) : null),
		[wordsKey],
	);

	const messageKey = JSON.stringify(message);
	const messagesKey = JSON.stringify(rotating ? values : [message]);
	const model = useMemo(() => {
		const current = toRows(JSON.parse(messageKey) as Message);
		const all = (JSON.parse(messagesKey) as Message[]).map(toRows);
		const split = (row: string) => splitWord(row, wordDeck);
		const longest = Math.max(
			1,
			...all.flatMap((rows) =>
				rows.map((row) => Array.from(split(row).rest).length),
			),
		);
		const length =
			lengthProp !== undefined && Number.isFinite(lengthProp) && lengthProp > 0
				? Math.floor(lengthProp)
				: longest;
		const rowCount =
			rowsProp !== undefined && Number.isFinite(rowsProp) && rowsProp > 0
				? Math.floor(rowsProp)
				: Math.max(1, ...all.map((rows) => rows.length));
		const longestWord = wordDeck
			? Math.max(...wordDeck.glyphs.map((word) => word.length))
			: 0;
		// Word flaps use a half-size font, so a word fits in about 0.4 cells a letter.
		const wordSpan = wordDeck ? Math.max(2, Math.ceil(longestWord * 0.4)) : 0;

		const specs: CellSpec[] = [];
		for (let row = 0; row < rowCount; row++) {
			const { word, rest } = split(current[row] ?? "");
			let col = 0;
			if (wordDeck) {
				specs.push({
					deck: wordDeck,
					target: word,
					order: row * ROW_STAGGER,
					row,
					col: col++,
					word: true,
				});
			}
			for (const target of fitRow(rest, length, align, deck)) {
				specs.push({
					deck,
					target,
					order: col + row * ROW_STAGGER,
					row,
					col: col++,
					word: false,
				});
			}
		}
		const lines = Array.from({ length: rowCount }, (_, row) => ({
			row,
			ids: specs.flatMap((spec, id) => (spec.row === row ? [id] : [])),
		}));
		return {
			specs,
			lines,
			length,
			wordSpan,
			key: `${chars}|${wordsKey}|${rowCount}x${length}|${specs.map((spec) => spec.target).join(",")}`,
		};
	}, [
		messageKey,
		messagesKey,
		deck,
		wordDeck,
		lengthProp,
		rowsProp,
		align,
		chars,
		wordsKey,
	]);

	const inViewRef = useRef(true);
	const lastGestureAtRef = useRef(Number.NEGATIVE_INFINITY);
	const stepRef = useRef(step);
	const messageRef = useRef(message);

	const [board] = useState(
		() =>
			new FlapBoard({
				flipMs,
				stagger,
				settle,
				reduced,
				sound,
				haptics,
				audible: () => false,
				click: () => {},
				thunk: () => {},
				haptic: () => {},
				flipStart: () => {},
				settled: () => {},
			}),
	);

	// The sequencer reads the latest props and callbacks on every frame.
	useLayoutEffect(() => {
		messageRef.current = message;
		board.options = {
			flipMs: Math.max(16, Number.isFinite(flipMs) ? flipMs : 90),
			stagger: Math.max(0, Number.isFinite(stagger) ? stagger : 45),
			settle,
			reduced,
			sound: sound && !muted,
			haptics,
			audible: () =>
				inViewRef.current &&
				typeof document !== "undefined" &&
				!document.hidden,
			click: (flipping) => {
				// Jitter pitch and level a little so the rattle never sounds looped.
				const busy = Math.min(flipping / 24, 1);
				tiks.setTheme({
					...clackTheme,
					filterFreq: clackTheme.filterFreq * (0.85 + Math.random() * 0.3),
					filterQ: clackTheme.filterQ * (0.8 + Math.random() * 0.6 + busy),
				});
				tiks.click();
			},
			thunk: () => {
				tiks.setTheme(thunkTheme);
				tiks.pop();
			},
			haptic: (kind) => void haptic(kind),
			flipStart: () => onFlipStart?.(),
			settled: () => {
				const settledValue = messageRef.current;
				setSettledMessage(settledValue);
				setLandings((current) => current + 1);
				onSettled?.(settledValue);
			},
		};
	});

	useLayoutEffect(() => {
		const autoplayStep = stepRef.current !== step;
		stepRef.current = step;
		// Haptics follow a press or key, never autoplay or a first render.
		const user =
			!autoplayStep &&
			performance.now() - lastGestureAtRef.current < GESTURE_WINDOW_MS;
		board.sync(model.specs, user);
	}, [board, model, step]);

	useEffect(() => {
		board.mount();
		return () => board.unmount();
	}, [board]);

	useEffect(() => {
		const onGesture = (event: Event) => {
			if (!event.isTrusted) return;
			// The sound toggle handles its own first press.
			if (
				event.target instanceof Element &&
				event.target.closest("[data-split-flap-sound]")
			) {
				return;
			}
			lastGestureAtRef.current = performance.now();
			setActivated(true);
		};
		const onVisibility = () => {
			setPageHidden(document.hidden);
			if (document.hidden) board.pause();
			else board.resume();
		};
		if (navigator.userActivation?.hasBeenActive) setActivated(true);
		setPageHidden(document.hidden);
		const options = { capture: true, passive: true };
		document.addEventListener("pointerdown", onGesture, options);
		document.addEventListener("keydown", onGesture, options);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			document.removeEventListener("pointerdown", onGesture, options);
			document.removeEventListener("keydown", onGesture, options);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [board]);

	const rootRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const root = rootRef.current;
		if (!root || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(([entry]) => {
			const visible = entry?.isIntersecting ?? true;
			inViewRef.current = visible;
			setInView(visible);
		});
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	const count = values?.length ?? 0;
	const delay = reduced
		? Math.max(interval, REDUCED_MIN_INTERVAL)
		: Math.max(interval, 0);
	const playing = autoplay && count > 1 && !paused && inView && !pageHidden;
	// biome-ignore lint/correctness/useExhaustiveDependencies: each landing restarts the hold
	useEffect(() => {
		if (!playing) return;
		const timer = setTimeout(() => setStep((current) => current + 1), delay);
		return () => clearTimeout(timer);
	}, [playing, delay, landings]);

	const { cell, gap, pad } = sizes[size];
	const units = model.length + model.wordSpan;
	const rootStyle: CSSProperties & Record<`--${string}`, string | number> = {
		...tones[tone],
		"--sf-units": units,
		"--sf-cell-max": cell,
		"--sf-gap": gap,
		"--sf-pad": pad,
		maxWidth:
			"calc(var(--sf-units) * var(--sf-cell-max) + (var(--sf-units) - 1) * var(--sf-gap) + 2 * var(--sf-pad))",
	};

	const currentRows = toRows(message);
	const settledRows = toRows(settledMessage);
	// Announce mode only updates once the board settles, never mid-flip.
	const spokenRows = announce ? settledRows : currentRows;
	const label = ariaLabel ?? currentRows.join(", ");
	const audible = !muted && activated;

	const cells = (
		<div
			aria-hidden
			className="flex select-none flex-col gap-[calc(var(--sf-gap)*2)]"
			style={
				{
					"--sf-cell":
						"min(var(--sf-cell-max), calc((100cqw - (var(--sf-units) - 1) * var(--sf-gap)) / var(--sf-units)))",
				} as CSSProperties
			}
		>
			{model.lines.map((line) => (
				<div key={line.row} className="flex gap-(--sf-gap)">
					{line.ids.map((id) => {
						const spec = model.specs[id];
						if (!spec) return null;
						const glyph = spec.deck.glyphs[spec.target] ?? " ";
						return (
							<Cell
								key={spec.col}
								id={id}
								initial={glyph}
								word={spec.word}
								span={spec.word ? model.wordSpan : 1}
								board={board}
								className={cn(
									cellClassName,
									accent?.match(glyph, line.row, spec.col) && accent.className,
								)}
							/>
						);
					})}
				</div>
			))}
		</div>
	);

	const text = (
		<span className="sr-only">
			{spokenRows
				.map((row, line) => ({ row, line }))
				.map(({ row, line }) => (
					<span key={line} className="block">
						{row}
					</span>
				))}
		</span>
	);

	const controlClass =
		"inline-flex size-6 items-center justify-center rounded-md text-(--sf-control) outline-none transition-[color,scale] duration-150 ease-out hover:text-(--sf-glyph) focus-visible:ring-2 focus-visible:ring-(--sf-glyph)/50 active:scale-[0.96]";

	return (
		<div
			ref={rootRef}
			data-slot="split-flap"
			data-tone={tone}
			className={cn(
				"@container w-full rounded-lg bg-(--sf-housing) p-(--sf-pad) shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.06)]",
				className,
			)}
			style={rootStyle}
		>
			{onClick ? (
				<button
					type="button"
					onClick={onClick}
					aria-label={label}
					className="block w-full cursor-pointer rounded-md text-left outline-none focus-visible:ring-(--sf-glyph)/50 focus-visible:ring-2"
				>
					{announce ? null : text}
					{cells}
				</button>
			) : announce ? (
				<div role="status" aria-live="polite" aria-atomic>
					{text}
					{cells}
				</div>
			) : (
				<div role="img" aria-label={label}>
					{text}
					{cells}
				</div>
			)}
			{onClick && announce ? (
				<div role="status" aria-live="polite" aria-atomic>
					{text}
				</div>
			) : null}
			{soundToggle || (autoplay && count > 1) ? (
				<div className="mt-(--sf-pad) flex justify-end gap-1">
					{autoplay && count > 1 ? (
						<button
							type="button"
							className={controlClass}
							aria-label={paused ? "Play board" : "Pause board"}
							onClick={() => setPaused((current) => !current)}
						>
							<PlayPauseIcon paused={paused} />
						</button>
					) : null}
					{soundToggle ? (
						<button
							type="button"
							data-split-flap-sound=""
							className={controlClass}
							aria-label={audible ? "Mute board sound" : "Unmute board sound"}
							onClick={() => {
								// Browsers block audio until a gesture, so the first press unmutes.
								setActivated(true);
								setMuted(audible);
							}}
						>
							<SpeakerIcon muted={!audible} />
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
