"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	CircleAlert,
	FileArchive,
	File as FileGlyph,
	FileImage,
	FileMusic,
	FileText,
	FileVideoCamera,
	Paperclip,
	X,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
	type ChangeEvent,
	type ComponentProps,
	type DragEvent,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

// Layout, in px. Chips are pills of one height; a deck tucks the extra files
// behind the first chip as offset edges.
const HEIGHT = { sm: 28, md: 32, lg: 40 } as const;
/** The file icon's size, per chip size. */
const ICON = { sm: 14, md: 16, lg: 18 } as const;
type Size = keyof typeof HEIGHT;
/** Gap between fanned chips, and before the attach button. */
const GAP = 6;
/** Room between a deck's last edge and its "+2" count. */
const COUNT_GAP = 6;
/** How far each tucked chip peeks out past the one in front. */
const EDGE = 4;
/** Tucked chips shrink a little per layer, from their far edge. */
const EDGE_SCALE = 0.08;
/** At most this many edges show behind the front chip. */
const MAX_EDGES = 2;

// Motion. Widths spring with no visible overshoot (about 1%); the fill
// springs toward the reported progress, so jumpy reports still flow.
const widthSpring = { stiffness: 380, damping: 32 } as const;
const fanSpring = { stiffness: 420, damping: 34 } as const;
const fillSpring = { stiffness: 110, damping: 21 } as const;
/** Once the upload is done the fill runs to the end a little quicker. */
const finishSpring = { stiffness: 170, damping: 26 } as const;
/** Delay between chips as the deck fans out or folds back. */
const FAN_STAGGER = 30;
/** The deck folds back this long after the pointer or focus leaves. */
const FAN_CLOSE_DELAY = 400;
/** On error the fill drains back to empty. */
const DRAIN_DURATION = 300;
/** No progress for this long and the chip says it's waiting. */
const STALL_DELAY = 2000;
/** How long a rejected drop shows its note on the attach button. */
const NOTE_DURATION = 1600;
/** The check shows this long after an upload completes, then the file icon returns. */
const CHECK_HOLD = 1400;
/** A chip removed from a deck fades out before it unmounts. */
const LEAVE_DURATION = 180;
/** How long a percent digit takes to roll to its new value, in ms. */
const DIGIT_ROLL = 180;
/**
 * How far a rolling digit travels, as a share of the line. Short enough that
 * no glyph reaches the clip, so a roll never shows half a digit.
 */
const DIGIT_TRAVEL = 0.3;
/** Ms of quiet before the live region speaks. */
const ANNOUNCE_DELAY = 350;
/** Two cues closer than this play once. */
const CUE_GAP = 90;

// A soft tik when files land, a brighter one when an upload completes, and a
// low one when it fails.
const ATTACH_SOUND = {
	name: "upload-chip-attach",
	baseFreq: 880,
	noiseColor: "pink",
	oscType: "sine",
	filterFreq: 2600,
	filterQ: 1.4,
	attack: 0.002,
	decay: 0.45,
	brightness: 2400,
} as const;
const DONE_SOUND = {
	...ATTACH_SOUND,
	name: "upload-chip-done",
	baseFreq: 1560,
	filterFreq: 5200,
	decay: 0.4,
	brightness: 4600,
} as const;
const ERROR_SOUND = {
	...ATTACH_SOUND,
	name: "upload-chip-error",
	baseFreq: 300,
	oscType: "triangle",
	filterFreq: 900,
	decay: 0.7,
	brightness: 1200,
} as const;

// Hoisted and deduplicated by React, so every instance shares one sheet.
const STYLES =
	"@keyframes upload-chip-in{from{opacity:0;filter:blur(1px)}}" +
	"@keyframes upload-chip-out{to{opacity:0;filter:blur(1px)}}" +
	"@keyframes upload-chip-enter{from{opacity:0}}" +
	"[data-slot=upload-chip] [data-fade-in]{animation:upload-chip-in .2s ease-out both}" +
	"[data-slot=upload-chip] [data-ghost]{animation:upload-chip-out .12s ease-out both}" +
	"[data-slot=upload-chip] [data-entering]{animation:upload-chip-enter .2s ease-out both}" +
	// While the size is unknown a soft sheen sweeps across behind the text,
	// rests a moment off the far end, and goes again.
	"@keyframes upload-chip-sheen{from{transform:translateX(-100%)}70%,to{transform:translateX(100%)}}" +
	"[data-slot=upload-chip] [data-sheen]{animation:upload-chip-sheen 2.2s cubic-bezier(.45,0,.4,1) infinite}" +
	"[data-slot=upload-chip] [data-offscreen] [data-sheen]{animation-play-state:paused}" +
	// Once measured, chips are placed by the layout loop. Before that (the
	// server render) they sit side by side in the list's own flow.
	"[data-slot=upload-chip-list][data-ready]>li{position:absolute;top:0;inset-inline-start:0}" +
	"[data-slot=upload-chip][data-static] *{animation-duration:.12s!important;animation-delay:0s!important}" +
	"[data-slot=upload-chip][data-static] [data-check]{transition:none!important}" +
	// Icon faces only cross-fade.
	"[data-slot=upload-chip][data-static] [data-face]{scale:none!important;filter:none!important}" +
	// Without motion the sheen rests as an even wash.
	"[data-slot=upload-chip][data-static] [data-sheen]{animation:none!important;transform:none;background:currentColor!important;opacity:.5}";

export interface UploadChipFile {
	id: string;
	name: string;
	/** Bytes. Shown as "2.4 MB" once the upload is done; 0 hides it. */
	size?: number;
	/** MIME type, used with the extension to pick the file icon. */
	type?: string;
	/** 0 to 1. Leave it out while the size of the upload isn't known. */
	progress?: number;
	status: "idle" | "uploading" | "done" | "error";
	/** Why it failed, read out with the failure and shown as a tooltip. */
	error?: string;
	/** An image URL shown as a tiny thumbnail in place of the file icon. */
	previewUrl?: string;
}

export interface UploadChipProps
	extends Omit<ComponentProps<"div">, "children" | "onDrop"> {
	/** The files to show, in order. Upload logic and progress are yours. */
	files?: readonly UploadChipFile[];
	/** Called with the files picked or dropped that pass `accept` and `maxFiles`. */
	onFilesAdded?: (files: File[]) => void;
	/** Called from a chip's remove button once it's done or failed. */
	onRemove?: (id: string) => void;
	/** Called from the Retry button of a failed chip. */
	onRetry?: (id: string) => void;
	/** Called from the remove button while uploading. Falls back to `onRemove`. */
	onCancel?: (id: string) => void;
	/** File types to accept, as for `<input type="file">`, such as `"image/*,.pdf"`. */
	accept?: string;
	/** Allow more than one file. */
	multiple?: boolean;
	/** The most files the chip holds at once. */
	maxFiles?: number;
	disabled?: boolean;
	/** The attach button's label. */
	label?: string;
	/** The attach button's label while files are dragged over the page. */
	dropLabel?: string;
	/** `sm` is 28 px tall, `md` 32 px, and `lg` 40 px. */
	size?: Size;
	/** Tuck extra files into a deck that fans out on hover or focus. `false` lays chips side by side. */
	stack?: boolean;
	/** An element that also accepts dropped files, such as a whole composer. */
	dropTargetRef?: RefObject<HTMLElement | null>;
	/** Play soft tiks on attach, done, and error. */
	sound?: boolean;
	/** Haptics on attach, done, and error, on touch devices only. */
	haptics?: boolean;
	/** Set `false` to skip the springs and the rolling digits, as with reduced motion. */
	animated?: boolean;
}

interface Spring {
	value: number;
	velocity: number;
	target: number;
}

type Phase = "idle" | "uploading" | "done" | "error";

interface Geo {
	w: Spring;
	x: Spring;
	y: Spring;
	s: Spring;
	/** The row's own width, measured. */
	natural: number;
	/** Springs hold still until this time, for the fan stagger. */
	holdUntil: number;
	behind: boolean;
	/** Set until the first layout places the chip. */
	fresh: boolean;
	entering: boolean;
	morph: boolean;
	li: HTMLLIElement | null;
	clip: HTMLDivElement | null;
	row: HTMLDivElement | null;
}

interface ListItem {
	file: UploadChipFile;
	leaving: boolean;
}

function clamp(value: number, min = 0, max = 1) {
	return Math.min(Math.max(value, min), max);
}

function spring(value: number): Spring {
	return { value, velocity: 0, target: value };
}

function jump(s: Spring, value = s.target) {
	s.value = value;
	s.target = value;
	s.velocity = 0;
}

/** Steps a spring by `dt` seconds. Returns whether it's still moving. */
function stepSpring(
	s: Spring,
	dt: number,
	{ stiffness, damping }: { stiffness: number; damping: number },
	epsilon: number,
) {
	let left = dt;
	while (left > 0) {
		const h = Math.min(left, 1 / 240);
		const accel = -stiffness * (s.value - s.target) - damping * s.velocity;
		s.velocity += accel * h;
		s.value += s.velocity * h;
		left -= h;
	}
	if (
		Math.abs(s.value - s.target) < epsilon &&
		Math.abs(s.velocity) < epsilon * 10
	) {
		jump(s);
		return false;
	}
	return true;
}

function smoothstep(t: number) {
	return t * t * (3 - 2 * t);
}

/** Runs `step` once per frame while it returns `true`. Nothing runs at rest. */
function useFrameLoop(step: (dt: number, now: number) => boolean) {
	const stepRef = useRef(step);
	stepRef.current = step;
	const frameRef = useRef(0);
	const lastRef = useRef(0);

	const tick = useCallback((now: number) => {
		const dt = clamp((now - lastRef.current) / 1000, 0, 1 / 20);
		lastRef.current = now;
		frameRef.current = stepRef.current(dt, now)
			? requestAnimationFrame(tick)
			: 0;
	}, []);

	useEffect(
		() => () => {
			cancelAnimationFrame(frameRef.current);
			frameRef.current = 0;
		},
		[],
	);

	return useCallback(() => {
		if (frameRef.current) return;
		lastRef.current = performance.now();
		frameRef.current = requestAnimationFrame(tick);
	}, [tick]);
}

/** "2.4 MB", in SI units like the file managers on macOS and iOS. */
export function formatFileSize(bytes: number) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000;
		unit++;
	}
	const digits = unit === 0 || value >= 10 ? 0 : 1;
	return `${value.toFixed(digits).replace(/\.0$/, "")} ${units[unit]}`;
}

function graphemes(text: string) {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		return Array.from(
			new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
			(part) => part.segment,
		);
	}
	return Array.from(text);
}

/**
 * The ways to split a name so its end survives truncation: "quarterly-rep"
 * may be cut short, "ort.pdf" always shows. Each split keeps the extension and
 * a few characters before it (or the last few, with no extension); trying a
 * few tail lengths lets the fit land closer to the room it has.
 */
function nameSplits(name: string): Array<[string[], string]> {
	const chars = graphemes(name);
	const dot = name.lastIndexOf(".");
	const extension =
		dot > 0 && name.length - dot <= 9 ? graphemes(name.slice(dot)).length : 0;
	const least = extension + (extension ? 2 : 4);
	const splits: Array<[string[], string]> = [];
	for (let keep = least; keep <= least + 3; keep++) {
		if (chars.length - keep < 2) break;
		splits.push([
			chars.slice(0, chars.length - keep),
			chars.slice(chars.length - keep).join(""),
		]);
	}
	return splits;
}

type FileKind = "image" | "video" | "audio" | "archive" | "document" | "file";

function fileKind(file: { name: string; type?: string }): FileKind {
	const type = file.type ?? "";
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (
		type.startsWith("image/") ||
		/^(png|jpe?g|gif|webp|avif|heic|svg|bmp|tiff?)$/.test(extension)
	)
		return "image";
	if (
		type.startsWith("video/") ||
		/^(mp4|mov|m4v|webm|mkv|avi)$/.test(extension)
	)
		return "video";
	if (
		type.startsWith("audio/") ||
		/^(mp3|wav|m4a|aac|flac|ogg|opus|aiff?)$/.test(extension)
	)
		return "audio";
	if (
		/zip|compressed|x-tar|gzip|x-7z|x-rar/.test(type) ||
		/^(zip|rar|7z|tar|gz|tgz|bz2|xz)$/.test(extension)
	)
		return "archive";
	if (
		type.startsWith("text/") ||
		/pdf|document|msword|sheet|presentation|rtf/.test(type) ||
		/^(pdf|docx?|txt|md|rtf|odt|pages|key|pptx?|xlsx?|csv|numbers)$/.test(
			extension,
		)
	)
		return "document";
	return "file";
}

/** Matches a file against an `accept` string: extensions, `type/*`, or exact types. */
function accepts(file: File, accept: string | undefined) {
	if (!accept?.trim()) return true;
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return accept
		.split(",")
		.map((rule) => rule.trim().toLowerCase())
		.filter(Boolean)
		.some((rule) => {
			if (rule.startsWith(".")) return name.endsWith(rule);
			if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
			return type === rule;
		});
}

function hasFiles(event: { dataTransfer: DataTransfer | null }) {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function isTouchDevice() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(pointer: coarse)").matches
	);
}

/** The whole percent the chip reports for a file. */
function percentOf(status: Phase, determinate: boolean, progress: number) {
	if (status === "done") return 100;
	return determinate ? Math.round(progress * 100) : 0;
}

/** One percent place rolling from one digit to the next; -1 is blank. */
interface DigitRoll {
	from: number;
	to: number;
	/** 0 to 1 through the roll. */
	t: number;
	/** 1 rolls up, for a rising number; -1 rolls down. */
	dir: number;
}

/**
 * Points each place at the number `n`. A changed place rolls straight to its
 * new digit, up for a rise and down for a fall; leading places are blank.
 */
function rollTo(
	e: { digits: DigitRoll[]; n: number },
	n: number,
	instant: boolean,
) {
	if (n === e.n && !instant) return;
	const next = [
		n >= 100 ? Math.floor(n / 100) % 10 : -1,
		n >= 10 ? Math.floor(n / 10) % 10 : -1,
		n % 10,
	];
	const dir = n >= e.n ? 1 : -1;
	for (const [place, d] of e.digits.entries()) {
		if (instant || e.n < 0) {
			d.from = next[place];
			d.to = next[place];
			d.t = 1;
		} else if (d.to !== next[place]) {
			// From whichever digit reads more right now.
			d.from = d.t < 0.5 ? d.from : d.to;
			d.to = next[place];
			d.t = 0;
			d.dir = dir;
		}
	}
	e.n = n;
}

/** Shows `digit` (blank below 0) shifted by `y` lines, at `opacity`. */
function writeDigit(
	node: HTMLSpanElement,
	digit: number,
	y: number,
	opacity: number,
) {
	const text = digit < 0 ? "" : String(digit);
	if (node.textContent !== text) node.textContent = text;
	node.style.transform = `translateY(${(y * 100).toFixed(2)}%)`;
	node.style.opacity = opacity.toFixed(3);
}

let measureContext: CanvasRenderingContext2D | null = null;

/**
 * A name cut in the middle when it doesn't fit: "quarterly-rep…ort.pdf".
 * The full name, hidden, sizes the box; the visible text is fitted to it.
 */
function MiddleName({ name }: { name: string }) {
	const boxRef = useRef<HTMLSpanElement>(null);
	const fullRef = useRef<HTMLSpanElement>(null);
	const [label, setLabel] = useState(name);

	useLayoutEffect(() => {
		const box = boxRef.current;
		const full = fullRef.current;
		if (!box || !full) return;
		const fit = () => {
			const room = box.clientWidth;
			if (full.offsetWidth <= room + 0.5) {
				setLabel(name);
				return;
			}
			measureContext ??= document.createElement("canvas").getContext("2d");
			if (!measureContext) return;
			const style = getComputedStyle(full);
			measureContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			// The split and the longest start that fill the room most closely,
			// leaving a px for rounding.
			let best = name;
			let bestWidth = Number.POSITIVE_INFINITY;
			let bestFits = false;
			for (const [chars, tail] of nameSplits(name)) {
				const text = (count: number) =>
					`${chars
						.slice(0, count)
						.join("")
						.replace(/[\s._-]+$/, "")}\u2026${tail}`;
				const width = (count: number) =>
					measureContext?.measureText(text(count)).width ?? 0;
				let low = 1;
				let high = chars.length;
				while (low < high) {
					const mid = Math.ceil((low + high) / 2);
					if (width(mid) <= room - 1) low = mid;
					else high = mid - 1;
				}
				const fitted = width(low);
				const fits = fitted <= room - 1;
				// A fit beats an overflow; then the wider fit, or the narrower overflow.
				if (
					(fits && (!bestFits || fitted > bestWidth)) ||
					(!fits && !bestFits && fitted < bestWidth)
				) {
					best = text(low);
					bestWidth = fitted;
					bestFits = fits;
				}
			}
			setLabel(best);
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(box);
		return () => observer.disconnect();
	}, [name]);

	return (
		<span
			ref={boxRef}
			className="grid min-w-0 overflow-hidden"
			style={{ gridTemplateColumns: "minmax(0, max-content)" }}
		>
			<span
				ref={fullRef}
				className="invisible col-start-1 row-start-1 justify-self-start whitespace-pre"
			>
				{name}
			</span>
			<span className="col-start-1 row-start-1 truncate whitespace-pre">
				{label}
			</span>
		</span>
	);
}

/**
 * A check drawn with one stroke as an upload completes. It fades out whole,
 * and only rewinds once it's gone.
 */
function CheckGlyph({
	drawn,
	className,
}: {
	drawn: boolean;
	className: string;
}) {
	return (
		<svg
			data-face=""
			aria-hidden="true"
			viewBox="0 0 16 16"
			fill="none"
			className={className}
		>
			<path
				data-check=""
				d="M3.25 8.4l3.1 3.1 6.4-6.9"
				pathLength={1}
				stroke="currentColor"
				strokeWidth={1.6}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray="1 1"
				style={{
					strokeDashoffset: drawn ? 0 : 1,
					transition: drawn
						? "stroke-dashoffset 260ms cubic-bezier(.3,.7,.2,1) 70ms"
						: "stroke-dashoffset 0s linear 200ms",
				}}
			/>
		</svg>
	);
}

const KIND_ICONS = {
	image: FileImage,
	video: FileVideoCamera,
	audio: FileMusic,
	archive: FileArchive,
	document: FileText,
	file: FileGlyph,
} as const;

/** The file-type glyph, which cross-fades into a check or an alert. */
function ChipIcon({
	file,
	state,
	px,
}: {
	file: UploadChipFile;
	state: "file" | "check" | "alert";
	px: number;
}) {
	const Glyph = KIND_ICONS[fileKind(file)];
	// A thumbnail that fails to load falls back to the file-type glyph.
	const [broken, setBroken] = useState<string | null>(null);
	const thumbnail = file.previewUrl && file.previewUrl !== broken;
	const face =
		"absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(.23,1,.32,1)]";
	const hidden = "scale-75 opacity-0 blur-[2px]";
	return (
		<span
			aria-hidden="true"
			className="relative shrink-0"
			style={{ width: px, height: px }}
		>
			<span data-face="" className={cn(face, state !== "file" && hidden)}>
				{thumbnail ? (
					// biome-ignore lint/performance/noImgElement: a 16 px thumbnail from any URL
					<img
						src={file.previewUrl}
						alt=""
						draggable={false}
						onError={() => setBroken(file.previewUrl ?? null)}
						className="size-full rounded-[4px] object-cover ring-1 ring-foreground/10"
					/>
				) : (
					<Glyph className="size-full" strokeWidth={1.75} />
				)}
			</span>
			<span
				data-face=""
				className={cn(face, state !== "alert" && hidden, "text-destructive")}
			>
				<CircleAlert className="size-full" strokeWidth={1.75} />
			</span>
			<CheckGlyph
				drawn={state === "check"}
				className={cn(
					face,
					"size-full overflow-visible",
					state !== "check" && hidden,
				)}
			/>
		</span>
	);
}

/**
 * Percent in tabular places. Each place is clipped to one line and holds an
 * in-flow "0" for its width and baseline, so a rolling digit sits on the same
 * baseline as the rest and nothing shows past the line. A leading place takes
 * no room until the number reaches it, and the chip's width springs to fit.
 */
function PercentDigits({
	placesRef,
	digitsRef,
}: {
	placesRef: RefObject<Array<HTMLSpanElement | null>>;
	digitsRef: RefObject<Array<HTMLSpanElement | null>>;
}) {
	return (
		// Numbers read left to right in right-to-left text too.
		<span
			aria-hidden="true"
			dir="ltr"
			className="inline-flex shrink-0 tabular-nums"
		>
			{[0, 1, 2].map((place) => (
				<span
					key={place}
					className="relative"
					ref={(node) => {
						placesRef.current[place] = node;
					}}
				>
					<span className="invisible">0</span>
					<span className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(transparent,#000_20%,#000_80%,transparent)]">
						{[0, 1].map((slot) => (
							<span
								key={slot}
								className="absolute inset-0 text-center will-change-transform"
								ref={(node) => {
									digitsRef.current[place * 2 + slot] = node;
								}}
							/>
						))}
					</span>
				</span>
			))}
			<span className="-ms-[0.04em]">%</span>
		</span>
	);
}

interface ChipProps {
	file: UploadChipFile;
	size: Size;
	leaving: boolean;
	behind: boolean;
	morph: boolean;
	label: string;
	still: boolean;
	disabled: boolean;
	onRemove?: (id: string) => void;
	onRetry?: (id: string) => void;
	onCancel?: (id: string) => void;
	register: (
		id: string,
		part: "li" | "clip" | "row",
		node: Element | null,
	) => void;
	onMeasure: (id: string, width: number) => void;
	onSettle: (file: UploadChipFile, outcome: "done" | "error") => void;
	onAction: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
}

function Chip({
	file,
	size,
	leaving,
	behind,
	morph,
	label,
	still,
	disabled,
	onRemove,
	onRetry,
	onCancel,
	register,
	onMeasure,
	onSettle,
	onAction,
}: ChipProps) {
	const height = HEIGHT[size];
	const status = file.status;
	const determinate =
		typeof file.progress === "number" && Number.isFinite(file.progress);
	const progress = determinate ? clamp(file.progress as number) : 0;

	// A chip that mounts done or failed shows it at once; one that gets there
	// while you watch fills to the end first.
	const [phase, setPhase] = useState<Phase>(status);
	const [stalled, setStalled] = useState(false);
	const [ghost, setGhost] = useState(morph);
	// The check shows for a beat after an upload completes, then the file icon
	// returns, so a row of finished files still reads by type.
	const [checked, setChecked] = useState(false);
	const mountedRef = useRef(false);

	const rowRef = useRef<HTMLDivElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLSpanElement>(null);
	const placesRef = useRef<Array<HTMLSpanElement | null>>([]);
	const digitsRef = useRef<Array<HTMLSpanElement | null>>([]);

	const engine = useRef({
		level: spring(status === "done" ? 1 : determinate ? progress : 0),
		drain: null as null | { from: number; start: number },
		/** Each percent place's roll. */
		digits: [0, 1, 2].map(
			(): DigitRoll => ({ from: -1, to: -1, t: 1, dir: 1 }),
		),
		n: -1,
		onScreen: true,
	});
	const latest = useRef({ status, determinate, progress, phase, still });
	latest.current = { status, determinate, progress, phase, still };

	const paint = useCallback(() => {
		const e = engine.current;
		const fill = fillRef.current;
		if (fill) fill.style.transform = `scaleX(${e.level.value.toFixed(4)})`;
		// The outgoing digit lifts away and fades out before the incoming one
		// settles in from below, so the two never overlap. Leading places take
		// no room until the number reaches them.
		for (const [place, d] of e.digits.entries()) {
			const incoming = digitsRef.current[place * 2];
			const outgoing = digitsRef.current[place * 2 + 1];
			if (!incoming || !outgoing) continue;
			const box = placesRef.current[place];
			if (box) box.style.display = d.to < 0 && d.t >= 1 ? "none" : "";
			const k = 1 - (1 - d.t) ** 3;
			writeDigit(
				incoming,
				d.to,
				d.dir * (1 - k) * DIGIT_TRAVEL,
				clamp((k - 0.3) / 0.7),
			);
			writeDigit(
				outgoing,
				d.t < 1 ? d.from : -1,
				-d.dir * k * DIGIT_TRAVEL,
				clamp(1 - k / 0.5),
			);
		}
	}, []);

	const step = useCallback(
		(dt: number, now: number) => {
			const e = engine.current;
			const { status, determinate, progress, phase, still } = latest.current;
			if (!e.onScreen || still) {
				// Off screen or without motion: land on the end state at once.
				if (e.drain) e.drain = null;
				jump(
					e.level,
					status === "error" ? 0 : status === "done" ? 1 : progress,
				);
				rollTo(e, percentOf(status, determinate, progress), true);
				paint();
				if (status === "done" && phase !== "done") setPhase("done");
				return false;
			}

			let moving = false;
			if (e.drain) {
				const t = clamp((now - e.drain.start) / DRAIN_DURATION);
				jump(e.level, e.drain.from * (1 - smoothstep(t)));
				if (t >= 1) e.drain = null;
				else moving = true;
			} else {
				// While the size is unknown the fill stays empty and the sheen,
				// a CSS animation, shows the upload is alive.
				e.level.target =
					status === "done"
						? 1
						: status === "uploading"
							? progress
							: e.level.target;
				moving = stepSpring(
					e.level,
					dt,
					status === "done" ? finishSpring : fillSpring,
					0.0004,
				);
			}

			// Each changed digit rolls to its new value.
			rollTo(e, percentOf(status, determinate, progress), false);
			let rolling = false;
			for (const d of e.digits) {
				if (d.t >= 1) continue;
				d.t = Math.min(1, d.t + (dt * 1000) / DIGIT_ROLL);
				rolling = true;
			}
			paint();

			if (status === "done" && phase !== "done" && e.level.value >= 0.99) {
				setPhase("done");
			}
			return moving || rolling;
		},
		[paint],
	);
	const kick = useFrameLoop(step);

	// Phase follows the status, except that "done" waits for the fill. Each
	// new progress report wakes the loop.
	useLayoutEffect(() => {
		const e = engine.current;
		if (!mountedRef.current) {
			mountedRef.current = true;
			rollTo(e, percentOf(status, determinate, progress), true);
			paint();
			return;
		}
		if (status === "error" && phase !== "error") {
			setPhase("error");
			e.drain = { from: e.level.value, start: performance.now() };
		} else if (status !== "done" && status !== "error" && phase !== status) {
			setPhase(status);
		}
		kick();
	}, [status, progress, determinate, phase, kick, paint]);

	// Cues for the outcome, only for changes seen after mount.
	const settledRef = useRef<Phase>(phase);
	useEffect(() => {
		if (settledRef.current === phase) return;
		settledRef.current = phase;
		if (phase === "done" || phase === "error") onSettle(file, phase);
	}, [phase, file, onSettle]);

	// Only for a chip that finishes while you watch, not one that mounts done.
	const checkFromRef = useRef(phase);
	useEffect(() => {
		const from = checkFromRef.current;
		checkFromRef.current = phase;
		if (phase !== "done" || from === "done") return;
		setChecked(true);
		const timer = window.setTimeout(() => setChecked(false), CHECK_HOLD);
		return () => {
			clearTimeout(timer);
			setChecked(false);
		};
	}, [phase]);

	// No progress for a while reads as waiting.
	useEffect(() => {
		setStalled(false);
		if (status !== "uploading" || !determinate || progress >= 1) return;
		const timer = window.setTimeout(() => setStalled(true), STALL_DELAY);
		return () => clearTimeout(timer);
	}, [status, determinate, progress]);

	// The fill and the sheen only run while the chip is on screen.
	useEffect(() => {
		const node = shellRef.current;
		if (!node || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(([entry]) => {
			const onScreen = entry?.isIntersecting ?? true;
			engine.current.onScreen = onScreen;
			node.toggleAttribute("data-offscreen", !onScreen);
			kick();
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [kick]);

	// The deck springs the chip's width toward the row's own.
	useLayoutEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		onMeasure(file.id, Number.parseFloat(getComputedStyle(row).width) || 0);
		const observer = new ResizeObserver(([entry]) => {
			const box = entry?.borderBoxSize?.[0];
			onMeasure(file.id, box ? box.inlineSize : row.offsetWidth);
		});
		observer.observe(row);
		return () => observer.disconnect();
	}, [file.id, onMeasure]);

	const done = phase === "done";
	const failed = phase === "error";
	const uploading = !done && !failed && status !== "idle";
	const indeterminate = uploading && !determinate;
	const sizeText = formatFileSize(file.size ?? 0);
	const removeLabel = uploading ? `Cancel ${file.name}` : `Remove ${file.name}`;
	const removeHandler = uploading ? (onCancel ?? onRemove) : onRemove;
	const iconPx = ICON[size];

	let meta: ReactNode = null;
	let metaKey = "none";
	if (failed) {
		metaKey = "error";
		meta = onRetry ? (
			<span className="flex items-center whitespace-nowrap text-foreground/65">
				<span aria-hidden="true">·&nbsp;</span>
				<button
					type="button"
					data-slot="upload-chip-retry"
					disabled={disabled}
					aria-label={`Retry ${file.name}`}
					onClick={(event) => {
						onAction(event, file.id);
						onRetry(file.id);
					}}
					className="relative -mx-0.5 cursor-pointer rounded-sm px-0.5 font-medium text-foreground underline-offset-2 outline-none pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3 hover:underline focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid"
				>
					Retry
				</button>
			</span>
		) : (
			<span className="text-foreground/65">Failed</span>
		);
	} else if (done) {
		metaKey = "size";
		meta = sizeText ? (
			<span className="whitespace-nowrap text-foreground/65 tabular-nums">
				<span aria-hidden="true">·&nbsp;</span>
				{sizeText}
			</span>
		) : null;
	} else if (status === "idle") {
		metaKey = "queued";
		meta = <span className="text-foreground/65">Queued</span>;
	} else if (!determinate) {
		metaKey = "indeterminate";
		meta = <span className="text-foreground/65">Uploading</span>;
	} else {
		metaKey = "percent";
		meta = (
			<span className="inline-flex items-center gap-1.5 text-foreground/65">
				{stalled ? <span data-fade-in="">Waiting</span> : null}
				<PercentDigits placesRef={placesRef} digitsRef={digitsRef} />
			</span>
		);
	}

	const progressProps = uploading
		? {
				role: "progressbar",
				"aria-label": file.name,
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				...(determinate
					? {
							"aria-valuenow": Math.round(progress * 100),
							"aria-valuetext": `${Math.round(progress * 100)} percent`,
						}
					: { "aria-valuetext": "Uploading" }),
			}
		: {};

	return (
		<li
			ref={(node) => register(file.id, "li", node)}
			data-slot="upload-chip-item"
			data-status={status}
			data-phase={phase}
			data-behind={behind ? "" : undefined}
			data-leaving={leaving ? "" : undefined}
			inert={leaving || undefined}
			title={file.error ? `${file.name}: ${file.error}` : file.name}
			className={cn(
				"group/chip transition-opacity duration-150 ease-out will-change-transform",
				leaving && "pointer-events-none opacity-0",
			)}
		>
			<div
				ref={shellRef}
				data-slot="upload-chip-shell"
				className="relative rounded-full"
				style={{ height }}
			>
				{/* The chip's surface and its progress fill, clipped to the pill. */}
				<span
					aria-hidden="true"
					className={cn(
						"absolute inset-0 overflow-hidden rounded-full ring-1 ring-inset transition-[background-color,box-shadow] duration-200",
						// A failed chip is tinted, except as a tucked edge: the deck's
						// count says so instead.
						failed && !behind
							? "bg-[color-mix(in_oklab,var(--color-destructive)_5%,var(--color-background))] ring-destructive/25 dark:bg-[color-mix(in_oklab,var(--color-destructive)_10%,var(--color-background))] dark:ring-destructive/30"
							: "bg-[color-mix(in_oklab,var(--color-muted)_60%,var(--color-background))] in-data-[wake]:ring-foreground/20 ring-foreground/8",
						behind && "ring-foreground/12",
					)}
				>
					<span
						className={cn(
							"absolute inset-0 transition-opacity ease-out",
							done ? "opacity-0 duration-500" : "opacity-100 duration-150",
						)}
					>
						<span
							ref={fillRef}
							className="absolute inset-0 origin-left bg-foreground/[.06] rtl:origin-right dark:bg-foreground/[.08]"
							style={{ transform: "scaleX(0)" }}
						/>
						{indeterminate ? (
							// No size yet: a soft sheen sweeps behind the text instead.
							<div
								data-fade-in=""
								className="absolute inset-0 text-foreground opacity-[.08] rtl:-scale-x-100 dark:opacity-[.1]"
							>
								<span
									data-sheen=""
									className="absolute inset-0"
									style={{
										backgroundImage:
											"linear-gradient(90deg,transparent 12%,currentColor 50%,transparent 88%)",
									}}
								/>
							</div>
						) : null}
					</span>
				</span>
				<div
					ref={(node) => register(file.id, "clip", node)}
					className="relative h-full overflow-hidden rounded-full data-[rest]:overflow-visible"
				>
					{ghost ? (
						<span
							data-ghost=""
							aria-hidden="true"
							onAnimationEnd={() => setGhost(false)}
							className={cn(
								"pointer-events-none absolute inset-y-0 start-0 flex items-center gap-1.5 whitespace-nowrap font-medium",
								{ sm: "ps-2.5", md: "ps-3", lg: "gap-2 ps-3.5" }[size],
							)}
						>
							<Paperclip
								style={{ width: iconPx, height: iconPx }}
								strokeWidth={1.75}
							/>
							{label}
						</span>
					) : null}
					<div
						ref={(node) => {
							rowRef.current = node;
							register(file.id, "row", node);
						}}
						data-fade-in={morph ? "" : undefined}
						className={cn(
							"flex h-full w-max items-center whitespace-nowrap transition-opacity duration-150",
							// The remove button sits in the pill's end cap, concentric with it.
							removeHandler
								? {
										sm: "gap-1.5 ps-2 pe-1.5",
										md: "gap-1.5 ps-2.5 pe-1.5",
										lg: "gap-2 ps-3 pe-2",
									}[size]
								: {
										sm: "gap-1.5 ps-2 pe-2.5",
										md: "gap-1.5 ps-2.5 pe-3",
										lg: "gap-2 ps-3 pe-3.5",
									}[size],
							// Folding, the content fades as the chip tucks in, not before.
							behind && "opacity-0 delay-100",
						)}
						style={morph ? { animationDelay: "50ms" } : undefined}
					>
						<ChipIcon
							file={file}
							px={iconPx}
							state={failed ? "alert" : done && checked ? "check" : "file"}
						/>
						<span
							{...progressProps}
							className="flex min-w-0 items-center gap-1.5"
						>
							<span className="sr-only">{file.name}</span>
							{/* Its own direction, so a Latin name in an RTL page keeps its order. */}
							<span
								aria-hidden="true"
								dir="auto"
								className={cn(
									"flex min-w-0 font-medium text-foreground",
									{
										sm: "max-w-[10rem]",
										md: "max-w-[13rem]",
										lg: "max-w-[16rem]",
									}[size],
								)}
							>
								<MiddleName name={file.name} />
							</span>
							{meta ? (
								<span
									key={metaKey}
									data-fade-in={mountedRef.current ? "" : undefined}
									className="flex shrink-0 items-center"
								>
									{meta}
								</span>
							) : null}
						</span>
						{removeHandler ? (
							<button
								type="button"
								data-slot="upload-chip-remove"
								disabled={disabled}
								aria-label={removeLabel}
								onClick={(event) => {
									onAction(event, file.id);
									removeHandler(file.id);
								}}
								className={cn(
									"relative flex shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/55 outline-none transition-[color,background-color] duration-150 pointer-coarse:after:absolute hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid",
									{
										sm: "size-4 pointer-coarse:after:-inset-3.5 [&_svg]:size-3",
										md: "size-5 pointer-coarse:after:-inset-3 [&_svg]:size-3.5",
										lg: "size-6 pointer-coarse:after:-inset-2.5 [&_svg]:size-4",
									}[size],
								)}
							>
								<X strokeWidth={2} />
							</button>
						) : null}
					</div>
				</div>
			</div>
		</li>
	);
}

/**
 * The attach button. Its width springs to fit its label, so "Attach" grows
 * into "Drop to attach" and a chip collapses back into it. `compact` is the
 * round button beside a deck, which shows a label only for a note.
 */
function AttachButton({
	buttonRef,
	text,
	compact,
	wake,
	size,
	fromRef,
	still,
	disabled,
	ariaLabel,
	onClick,
	widthRef,
}: {
	buttonRef: RefObject<HTMLButtonElement | null>;
	text: string | null;
	compact: boolean;
	wake: boolean;
	size: Size;
	/** The last chip's width, when that chip collapses into this pill. */
	fromRef: RefObject<number> | null;
	still: boolean;
	disabled: boolean;
	ariaLabel: string;
	onClick: () => void;
	widthRef?: RefObject<number>;
}) {
	const height = HEIGHT[size];
	const iconPx = ICON[size];
	const rowRef = useRef<HTMLSpanElement>(null);
	const clipRef = useRef<HTMLSpanElement>(null);
	const width = useRef(spring(0));
	const morphRef = useRef(fromRef?.current ?? 0);
	const naturalRef = useRef(0);
	const stillRef = useRef(still);
	stillRef.current = still;

	const write = useCallback(() => {
		const w = width.current;
		const button = buttonRef.current;
		if (button) button.style.width = `${w.value}px`;
		if (widthRef) widthRef.current = w.value;
		const clip = clipRef.current;
		if (clip) {
			if (Math.abs(w.value - naturalRef.current) < 0.5)
				clip.setAttribute("data-rest", "");
			else clip.removeAttribute("data-rest");
		}
	}, [buttonRef, widthRef]);

	const kick = useFrameLoop((dt) => {
		const active = stepSpring(width.current, dt, widthSpring, 0.05);
		write();
		return active;
	});

	useLayoutEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const measure = (next: number) => {
			naturalRef.current = next;
			const w = width.current;
			w.target = next;
			if (stillRef.current) jump(w, next);
			else if (w.value === 0) {
				// First measure: start at the chip's width if it's morphing back.
				jump(w, morphRef.current || next);
				w.target = next;
			}
			write();
			kick();
		};
		measure(Number.parseFloat(getComputedStyle(row).width) || 0);
		const observer = new ResizeObserver(([entry]) => {
			const box = entry?.borderBoxSize?.[0];
			measure(box ? box.inlineSize : row.offsetWidth);
		});
		observer.observe(row);
		return () => observer.disconnect();
	}, [kick, write]);

	return (
		<button
			ref={buttonRef}
			type="button"
			data-slot="upload-chip-attach"
			data-wake={wake ? "" : undefined}
			disabled={disabled}
			aria-label={ariaLabel}
			onClick={onClick}
			className={cn(
				"group/attach relative shrink-0 cursor-pointer touch-manipulation select-none rounded-full font-medium text-foreground text-sm outline-none transition-[scale] duration-150 ease-out pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid focus-visible:outline-offset-2 active:scale-[0.97] disabled:cursor-not-allowed",
				{
					sm: "text-xs pointer-coarse:after:-inset-y-2",
					md: "pointer-coarse:after:-inset-y-1.5",
					lg: "text-[15px] pointer-coarse:after:-inset-y-0.5",
				}[size],
				compact &&
					"text-foreground/65 transition-[scale,color] hover:text-foreground data-[wake]:text-foreground",
			)}
			style={{ height, minWidth: height }}
		>
			<span
				aria-hidden="true"
				className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--color-muted)_60%,var(--color-background))] ring-1 ring-foreground/8 ring-inset transition-[background-color,box-shadow] duration-150 group-hover/attach:bg-muted group-data-[wake]/attach:bg-muted group-data-[wake]/attach:ring-foreground/25"
			/>
			<span
				ref={clipRef}
				className="relative flex h-full overflow-hidden rounded-full data-[rest]:overflow-visible"
			>
				<span
					ref={rowRef}
					data-fade-in={fromRef ? "" : undefined}
					className={cn(
						"flex h-full w-max items-center gap-1.5 whitespace-nowrap",
						size === "lg" && "gap-2",
						compact && !text
							? "justify-center"
							: { sm: "ps-2.5 pe-3", md: "ps-3 pe-3.5", lg: "ps-3.5 pe-4" }[
									size
								],
					)}
					style={compact && !text ? { width: height } : undefined}
				>
					<Paperclip
						aria-hidden="true"
						className="shrink-0"
						style={{ width: iconPx, height: iconPx }}
						strokeWidth={1.75}
					/>
					{text ? (
						<span key={text} data-fade-in="">
							{text}
						</span>
					) : null}
				</span>
			</span>
		</button>
	);
}

/**
 * An attach button that becomes the upload itself. Pick or drop a file and the
 * pill springs into a chip that fills as bytes go up, rolls its percent, and
 * turns its file icon into a check. More files tuck into a deck.
 */
export function UploadChip({
	files = [],
	onFilesAdded,
	onRemove,
	onRetry,
	onCancel,
	accept,
	multiple = true,
	maxFiles,
	disabled = false,
	label = "Attach",
	dropLabel = "Drop to attach",
	size = "md",
	stack = true,
	dropTargetRef,
	sound = false,
	haptics = true,
	animated = true,
	className,
	onKeyDown,
	...props
}: UploadChipProps) {
	// The preference applies after hydration, so server and client markup match.
	const reducedMotion = useReducedMotion() ?? false;
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	const still = !animated || (hydrated && reducedMotion);
	const height = HEIGHT[size];

	const { trigger: haptic } = useWebHaptics();
	const { click: playAttach } = useTiks({
		theme: ATTACH_SOUND,
		volume: 0.16,
		respectReducedMotion: false,
	});
	const { click: playDone } = useTiks({
		theme: DONE_SOUND,
		volume: 0.18,
		respectReducedMotion: false,
	});
	const { click: playError } = useTiks({
		theme: ERROR_SOUND,
		volume: 0.2,
		respectReducedMotion: false,
	});

	// Rendered chips: the files, plus any just removed that are fading out.
	const [list, setList] = useState(() => ({
		files,
		items: files.map((file): ListItem => ({ file, leaving: false })),
		morphId: null as string | null,
		pillMorph: false,
	}));
	let current = list;
	if (list.files !== files) {
		const ids = new Set(files.map((file) => file.id));
		const items: ListItem[] = files.map((file) => ({ file, leaving: false }));
		if (files.length > 0) {
			list.items.forEach((item, index) => {
				if (!ids.has(item.file.id) && !item.leaving) {
					items.splice(Math.min(index, items.length), 0, {
						file: item.file,
						leaving: true,
					});
				}
			});
		}
		current = {
			files,
			items,
			morphId:
				list.files.length === 0 && files.length > 0
					? (files[0]?.id ?? null)
					: list.morphId,
			pillMorph: list.files.length > 0 && files.length === 0,
		};
		setList(current);
	}
	const items = current.items;
	const live = items.filter((item) => !item.leaving);
	const count = files.length;
	const limit = multiple ? (maxFiles ?? Number.POSITIVE_INFINITY) : 1;
	const canAdd = !disabled && count < limit;

	const [wake, setWake] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [fanned, setFanned] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const fanOpen = !stack || (fanned && live.length > 1);
	/** A tucked file failed, which the count shows with a dot. */
	const hiddenError = live
		.slice(1)
		.some((item) => item.file.status === "error");

	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const countRef = useRef<HTMLSpanElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const attachRef = useRef<HTMLButtonElement>(null);
	const compactRef = useRef<HTMLButtonElement>(null);
	const pillWidthRef = useRef(0);
	const frontWidthRef = useRef(0);

	const latest = useRef({
		sound,
		haptics,
		still,
		onFilesAdded,
		accept,
		limit,
		count,
		canAdd,
	});
	latest.current = {
		sound,
		haptics,
		still,
		onFilesAdded,
		accept,
		limit,
		count,
		canAdd,
	};

	// Cues. Never on mount, never while the tab is hidden.
	const lastCueRef = useRef(Number.NEGATIVE_INFINITY);
	const cue = useCallback(
		(kind: "attach" | "done" | "error") => {
			if (document.visibilityState === "hidden") return;
			const now = performance.now();
			if (now - lastCueRef.current < CUE_GAP) return;
			lastCueRef.current = now;
			const { sound, haptics } = latest.current;
			if (sound) {
				if (kind === "attach") playAttach();
				else if (kind === "done") playDone();
				else playError();
			}
			// Browsers block vibration until the page has had a tap.
			if (
				haptics &&
				isTouchDevice() &&
				(navigator.userActivation?.hasBeenActive ?? true)
			) {
				void haptic(
					kind === "attach" ? "light" : kind === "done" ? "success" : "error",
				);
			}
		},
		[haptic, playAttach, playDone, playError],
	);

	// The live region speaks once things settle, not for every change.
	const pendingRef = useRef<string[]>([]);
	const announceTimer = useRef(0);
	const announce = useCallback((message: string) => {
		pendingRef.current.push(message);
		clearTimeout(announceTimer.current);
		announceTimer.current = window.setTimeout(() => {
			setAnnouncement(pendingRef.current.join(". "));
			pendingRef.current = [];
		}, ANNOUNCE_DELAY);
	}, []);
	useEffect(() => () => clearTimeout(announceTimer.current), []);

	const onSettle = useCallback(
		(file: UploadChipFile, outcome: "done" | "error") => {
			cue(outcome);
			announce(
				outcome === "done"
					? `${file.name} uploaded`
					: `${file.name} failed${file.error ? `: ${file.error}` : ""}${onRetry ? ", Retry" : ""}`,
			);
		},
		[announce, cue, onRetry],
	);

	const noteTimer = useRef(0);
	const showNote = useCallback((text: string) => {
		setNote(text);
		clearTimeout(noteTimer.current);
		noteTimer.current = window.setTimeout(() => setNote(null), NOTE_DURATION);
	}, []);
	useEffect(() => () => clearTimeout(noteTimer.current), []);

	/** Filters picked or dropped files by `accept` and the limit, then hands them on. */
	const addFiles = useCallback(
		(incoming: File[]) => {
			const { accept, limit, count, canAdd, onFilesAdded } = latest.current;
			if (!canAdd || incoming.length === 0) return;
			const supported = incoming.filter((file) => accepts(file, accept));
			const room = Math.max(0, limit - count);
			const taken = supported.slice(0, room);
			if (supported.length < incoming.length) {
				showNote("Not supported");
				const rejected = incoming.find((file) => !accepts(file, accept));
				announce(
					rejected ? `${rejected.name} is not supported` : "File not supported",
				);
				cue("error");
			} else if (taken.length < supported.length) {
				showNote("Limit reached");
				announce(
					limit === 1
						? "Only one file can be attached"
						: `Only ${limit} files can be attached`,
				);
				cue("error");
			}
			if (taken.length === 0) return;
			cue("attach");
			onFilesAdded?.(taken);
		},
		[announce, cue, showNote],
	);

	// Deck layout: every chip's width, place, and scale spring together.
	const geos = useRef(new Map<string, Geo>());
	const deck = useRef({
		order: [] as string[],
		fan: spring(0),
		fanned: false,
		avail: Number.POSITIVE_INFINITY,
		rtl: false,
		ready: false,
		height,
		stack,
	});

	const geo = useCallback((id: string) => {
		let entry = geos.current.get(id);
		if (!entry) {
			entry = {
				w: spring(0),
				x: spring(0),
				y: spring(0),
				s: spring(1),
				natural: 0,
				holdUntil: 0,
				behind: false,
				fresh: true,
				entering: false,
				morph: false,
				li: null,
				clip: null,
				row: null,
			};
			geos.current.set(id, entry);
		}
		return entry;
	}, []);

	const writeDeck = useCallback(() => {
		const d = deck.current;
		const sign = d.rtl ? -1 : 1;
		let right = 0;
		let bottom = 0;
		let frontRight = 0;
		for (const [index, id] of d.order.entries()) {
			const g = geos.current.get(id);
			if (!g) continue;
			if (g.li) {
				g.li.style.transform = `translate3d(${(sign * g.x.value).toFixed(2)}px,${g.y.value.toFixed(2)}px,0) scale(${g.s.value.toFixed(4)})`;
				g.li.style.transformOrigin = d.rtl ? "left center" : "right center";
				g.li.style.zIndex = String(d.order.length - index);
				const shell = g.li.firstElementChild as HTMLElement | null;
				if (shell) shell.style.width = `${g.w.value.toFixed(2)}px`;
			}
			if (g.clip) {
				if (!g.behind && Math.abs(g.w.value - g.natural) < 0.5)
					g.clip.setAttribute("data-rest", "");
				else g.clip.removeAttribute("data-rest");
			}
			right = Math.max(right, g.x.value + g.w.value);
			bottom = Math.max(bottom, g.y.value + d.height);
			if (index === 0) {
				frontRight = g.x.value + g.w.value;
				frontWidthRef.current = g.w.value;
			}
		}
		const tucked = Math.min(d.order.length - 1, MAX_EDGES);
		const counter = countRef.current;
		if (counter) {
			const at = frontRight + tucked * EDGE + COUNT_GAP;
			counter.style.transform = `translateX(${(sign * at).toFixed(2)}px)`;
			const reach = (at + counter.offsetWidth) * (1 - d.fan.value);
			if (d.order.length > 1 && d.stack) right = Math.max(right, reach);
		}
		const ul = listRef.current;
		if (ul) {
			// Never wider than the room, so the attach button beside it stays on
			// its line while the deck folds.
			ul.style.width = `${Math.ceil(Math.min(right, d.avail))}px`;
			ul.style.height = `${Math.ceil(bottom)}px`;
		}
	}, []);

	const deckStep = useCallback(
		(dt: number, now: number) => {
			const d = deck.current;
			let active = stepSpring(d.fan, dt, fanSpring, 0.002);
			for (const id of d.order) {
				const g = geos.current.get(id);
				if (!g) continue;
				if (now < g.holdUntil) {
					active = true;
					continue;
				}
				const a = stepSpring(g.w, dt, widthSpring, 0.05);
				const b = stepSpring(g.x, dt, fanSpring, 0.05);
				const c = stepSpring(g.y, dt, fanSpring, 0.05);
				const e = stepSpring(g.s, dt, fanSpring, 0.0005);
				active = active || a || b || c || e;
			}
			writeDeck();
			return active;
		},
		[writeDeck],
	);
	const kickDeck = useFrameLoop(deckStep);

	/** Sets every chip's targets for the current files, fan state, and room. */
	const relayout = useCallback(
		(stagger: "open" | "close" | null = null) => {
			const d = deck.current;
			const order = d.order;
			const fannedNow = d.fanned;
			const now = performance.now();
			const tucked = Math.min(order.length - 1, MAX_EDGES);
			const counterWidth = countRef.current?.offsetWidth ?? 0;
			const collapsedRoom =
				d.avail -
				(order.length > 1 ? tucked * EDGE + COUNT_GAP + counterWidth : 0);
			let x = 0;
			let y = 0;
			let frontTarget = 0;
			d.fan.target = fannedNow ? 1 : 0;
			for (const [index, id] of order.entries()) {
				const g = geos.current.get(id);
				if (!g) continue;
				const room = Math.max(
					height * 2,
					fannedNow || index > 0 ? d.avail : collapsedRoom,
				);
				if (g.row) g.row.style.maxWidth = `${room}px`;
				const own = Math.min(g.natural, room);
				let tx: number;
				let ty: number;
				let ts: number;
				let tw: number;
				if (fannedNow) {
					if (x > 0 && x + own > d.avail) {
						x = 0;
						y += height + GAP;
					}
					tx = x;
					ty = y;
					ts = 1;
					tw = own;
					x += own + GAP;
					g.behind = false;
				} else if (index === 0) {
					tx = 0;
					ty = 0;
					ts = 1;
					tw = own;
					frontTarget = own;
					g.behind = false;
				} else {
					const layer = Math.min(index, MAX_EDGES);
					tx = layer * EDGE;
					ty = 0;
					ts = 1 - layer * EDGE_SCALE;
					tw = frontTarget;
					g.behind = true;
				}
				g.x.target = tx;
				g.y.target = ty;
				g.s.target = ts;
				g.w.target = tw;
				if (g.fresh) {
					g.fresh = false;
					jump(g.x);
					jump(g.y);
					jump(g.s);
					jump(g.w);
					if (g.morph && pillWidthRef.current > 0) {
						// The pill becomes this chip: start at its width.
						jump(g.w, pillWidthRef.current);
						g.w.target = tw;
					} else if (g.entering && !d.fanned) {
						// A new file slides in behind the deck.
						g.x.value += 10;
						g.s.value *= 0.92;
					} else if (g.entering) {
						g.s.value = 0.9;
					}
				}
				if (stagger && !g.fresh) {
					const rank = stagger === "open" ? index : order.length - 1 - index;
					g.holdUntil = now + rank * FAN_STAGGER;
				}
				if (latest.current.still) {
					jump(g.x);
					jump(g.y);
					jump(g.s);
					jump(g.w);
				}
			}
			if (latest.current.still) jump(d.fan);
			writeDeck();
			kickDeck();
		},
		[height, kickDeck, writeDeck],
	);

	const register = useCallback(
		(id: string, part: "li" | "clip" | "row", node: Element | null) => {
			const g = node ? geo(id) : geos.current.get(id);
			if (!g) return;
			if (part === "li") g.li = node as HTMLLIElement | null;
			else if (part === "clip") g.clip = node as HTMLDivElement | null;
			else g.row = node as HTMLDivElement | null;
		},
		[geo],
	);

	const onMeasure = useCallback(
		(id: string, width: number) => {
			const g = geo(id);
			if (Math.abs(g.natural - width) < 0.25) return;
			g.natural = width;
			if (deck.current.ready) relayout();
		},
		[geo, relayout],
	);

	// Keep the deck's order in step with the rendered chips.
	const orderKey = items
		.filter((item) => !item.leaving)
		.map((item) => item.file.id)
		.join("\u0000");
	const leavingKey = items
		.filter((item) => item.leaving)
		.map((item) => item.file.id)
		.join("\u0000");
	const firstLayout = useRef(true);
	useLayoutEffect(() => {
		const d = deck.current;
		const ids = orderKey ? orderKey.split("\u0000") : [];
		for (const id of ids) {
			const g = geo(id);
			if (g.fresh) {
				g.entering = !firstLayout.current && id !== current.morphId;
				g.morph = id === current.morphId;
				g.li?.toggleAttribute("data-entering", g.entering);
			}
		}
		for (const id of geos.current.keys()) {
			if (!ids.includes(id) && !leavingKey.split("\u0000").includes(id))
				geos.current.delete(id);
		}
		d.order = ids;
		d.height = height;
		d.stack = stack;
		d.rtl = rootRef.current
			? getComputedStyle(rootRef.current).direction === "rtl"
			: false;
		const stagger =
			d.fanned !== fanOpen && !firstLayout.current
				? fanOpen
					? "open"
					: "close"
				: null;
		d.fanned = fanOpen;
		firstLayout.current = false;
		if (ids.length === 0) {
			d.ready = false;
			return;
		}
		d.ready = true;
		listRef.current?.setAttribute("data-ready", "");
		relayout(stagger);
	}, [
		orderKey,
		height,
		stack,
		fanOpen,
		geo,
		relayout,
		leavingKey,
		current.morphId,
	]);

	// The count's failure dot changes its width.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-runs when the dot shows or hides
	useLayoutEffect(() => {
		if (deck.current.ready) relayout();
	}, [hiddenError, relayout]);

	// A deck down to one chip forgets it was fanned.
	useEffect(() => {
		if (live.length <= 1 && fanned) setFanned(false);
	}, [live.length, fanned]);

	// The room the deck has: its parent's content box, less the attach button.
	const showCompact = count > 0 && (canAdd || note !== null);
	useLayoutEffect(() => {
		const root = rootRef.current;
		const parent = root?.parentElement;
		if (!root || !parent) return;
		const update = () => {
			const style = getComputedStyle(parent);
			const inner =
				parent.clientWidth -
				Number.parseFloat(style.paddingLeft) -
				Number.parseFloat(style.paddingRight);
			const avail = Math.max(
				height * 3,
				inner - (showCompact ? height + GAP : 0),
			);
			if (Math.abs(avail - deck.current.avail) < 0.5) return;
			deck.current.avail = avail;
			if (deck.current.ready) relayout();
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(parent);
		return () => observer.disconnect();
	}, [height, showCompact, relayout]);

	// Fade out removed chips, then drop them.
	useEffect(() => {
		if (!leavingKey) return;
		const timer = window.setTimeout(() => {
			setList((state) => ({
				...state,
				items: state.items.filter((item) => !item.leaving),
			}));
		}, LEAVE_DURATION);
		return () => clearTimeout(timer);
	}, [leavingKey]);

	// Focus follows a keyboard removal to the next chip, or to the attach button.
	const keyboardActionRef = useRef<{ id: string; index: number } | null>(null);
	const onAction = useCallback(
		(event: MouseEvent<HTMLButtonElement>, id: string) => {
			// A click with no pointer behind it (`detail` 0) came from the keyboard.
			keyboardActionRef.current =
				event.detail === 0
					? { id, index: deck.current.order.indexOf(id) }
					: null;
		},
		[],
	);
	useLayoutEffect(() => {
		const action = keyboardActionRef.current;
		const root = rootRef.current;
		if (!action || !root) return;
		const active = document.activeElement;
		const lost =
			!active ||
			active === document.body ||
			!!active.closest("[data-leaving]") ||
			!root.contains(active);
		if (!lost) return;
		keyboardActionRef.current = null;
		// The same chip (a retry swaps its buttons), else the one now in its place.
		const chips = Array.from(
			root.querySelectorAll<HTMLElement>(
				"[data-slot=upload-chip-item]:not([data-leaving])",
			),
		);
		const same = chips.find((chip) => geos.current.get(action.id)?.li === chip);
		const target =
			same ?? chips[Math.min(action.index, chips.length - 1)] ?? null;
		const next =
			target?.querySelector<HTMLElement>("button:not(:disabled)") ??
			attachRef.current ??
			compactRef.current;
		next?.focus({ preventScroll: true });
	});

	// Fan out on hover (mouse) or focus, fold back a beat after leaving.
	const closeTimer = useRef(0);
	const suppressRef = useRef(false);
	const hoverRef = useRef(false);
	const movingFocusRef = useRef(false);
	const openFan = useCallback(() => {
		clearTimeout(closeTimer.current);
		if (!suppressRef.current) setFanned(true);
	}, []);
	const closeFanSoon = useCallback(() => {
		clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(
			() => setFanned(false),
			FAN_CLOSE_DELAY,
		);
	}, []);
	useEffect(() => () => clearTimeout(closeTimer.current), []);

	// A tap outside folds a deck fanned by touch.
	useEffect(() => {
		if (!fanned) return;
		const onDown = (event: globalThis.PointerEvent) => {
			if (!listRef.current?.contains(event.target as Node)) setFanned(false);
		};
		document.addEventListener("pointerdown", onDown);
		return () => document.removeEventListener("pointerdown", onDown);
	}, [fanned]);

	// Files dragged anywhere over the page wake the attach button.
	useEffect(() => {
		if (disabled) return;
		let timer = 0;
		const onOver = (event: globalThis.DragEvent) => {
			if (!hasFiles(event)) return;
			// A stray drop outside any drop zone would open the file in the tab.
			if (!event.defaultPrevented) {
				event.preventDefault();
				if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
			}
			setWake(true);
			clearTimeout(timer);
			timer = window.setTimeout(() => setWake(false), 160);
		};
		const onDrop = (event: globalThis.DragEvent) => {
			if (hasFiles(event) && !event.defaultPrevented) event.preventDefault();
			clearTimeout(timer);
			setWake(false);
		};
		window.addEventListener("dragover", onOver);
		window.addEventListener("dragenter", onOver);
		window.addEventListener("drop", onDrop);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("dragover", onOver);
			window.removeEventListener("dragenter", onOver);
			window.removeEventListener("drop", onDrop);
		};
	}, [disabled]);

	const [over, setOver] = useState(false);
	const onDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!hasFiles(event) || !latest.current.canAdd) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setOver(true);
	};
	const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null))
			return;
		setOver(false);
	};
	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!hasFiles(event)) return;
		event.preventDefault();
		setOver(false);
		addFiles(Array.from(event.dataTransfer.files));
	};

	// An outside container can take drops too.
	useEffect(() => {
		const target = dropTargetRef?.current;
		if (!target || disabled) return;
		const onOver = (event: globalThis.DragEvent) => {
			if (!hasFiles(event) || !latest.current.canAdd) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
		};
		const onDropHere = (event: globalThis.DragEvent) => {
			if (!hasFiles(event)) return;
			event.preventDefault();
			addFiles(Array.from(event.dataTransfer?.files ?? []));
		};
		target.addEventListener("dragover", onOver);
		target.addEventListener("drop", onDropHere);
		return () => {
			target.removeEventListener("dragover", onOver);
			target.removeEventListener("drop", onDropHere);
		};
	}, [dropTargetRef, disabled, addFiles]);

	const openPicker = () => {
		if (!latest.current.canAdd) {
			showNote("Limit reached");
			return;
		}
		inputRef.current?.click();
	};
	const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		addFiles(Array.from(event.target.files ?? []));
		event.target.value = "";
	};

	const listPointer = {
		onPointerEnter: (event: PointerEvent<HTMLUListElement>) => {
			if (event.pointerType === "touch") return;
			hoverRef.current = true;
			openFan();
		},
		onPointerLeave: (event: PointerEvent<HTMLUListElement>) => {
			suppressRef.current = false;
			if (event.pointerType === "touch") return;
			hoverRef.current = false;
			closeFanSoon();
		},
		onClick: () => {
			// A tap on a folded deck fans it out, so tucked chips can be reached.
			if (!fanned && live.length > 1) openFan();
		},
		onFocus: (event: FocusEvent<HTMLUListElement>) => {
			// Focus moving on after Escape (a Tab, not the Escape itself)
			// fans the deck out again, so the focused chip shows.
			if (movingFocusRef.current) return;
			if (
				suppressRef.current &&
				event.relatedTarget &&
				event.currentTarget.contains(event.relatedTarget as Node)
			) {
				suppressRef.current = false;
			}
			openFan();
		},
		onBlur: (event: FocusEvent<HTMLUListElement>) => {
			if (event.currentTarget.contains(event.relatedTarget as Node | null))
				return;
			suppressRef.current = false;
			// A clicked remove button loses focus as its chip leaves; the pointer
			// is still over the deck, so it stays fanned.
			if (!hoverRef.current) closeFanSoon();
		},
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented || event.key !== "Escape" || !fanned) return;
		event.preventDefault();
		clearTimeout(closeTimer.current);
		suppressRef.current = true;
		setFanned(false);
		// Focus on a chip about to tuck away moves to the front chip, or to the
		// attach button, so it never sits on a hidden control.
		const active = document.activeElement;
		const chip = active?.closest("[data-slot=upload-chip-item]");
		const frontChip = front ? geos.current.get(front)?.li : null;
		if (chip && chip !== frontChip) {
			const next =
				frontChip?.querySelector<HTMLElement>("button:not(:disabled)") ??
				compactRef.current;
			movingFocusRef.current = true;
			next?.focus({ preventScroll: true });
			movingFocusRef.current = false;
		}
	};

	const front = live[0]?.file.id;
	const pillText = note ?? (wake || over ? dropLabel : label);
	const extra = live.length - 1;

	return (
		<div
			ref={rootRef}
			data-slot="upload-chip"
			data-wake={(wake || over) && canAdd ? "" : undefined}
			data-static={still ? "" : undefined}
			data-disabled={disabled ? "" : undefined}
			aria-disabled={disabled || undefined}
			className={cn(
				"relative inline-flex max-w-full align-middle text-sm data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				size === "sm" && "text-xs",
				size === "lg" && "text-[15px]",
				className,
			)}
			onDragOver={onDragOver}
			onDragEnter={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onKeyDown={handleKeyDown}
			{...props}
		>
			<style href="tentui-upload-chip" precedence="default">
				{STYLES}
			</style>
			<input
				ref={inputRef}
				type="file"
				hidden
				tabIndex={-1}
				accept={accept}
				multiple={multiple}
				disabled={disabled}
				onChange={onInputChange}
				data-slot="upload-chip-input"
			/>
			<div
				className="flex max-w-full flex-wrap items-start"
				style={{ gap: GAP }}
			>
				{items.length === 0 ? (
					<AttachButton
						buttonRef={attachRef}
						widthRef={pillWidthRef}
						text={pillText}
						compact={false}
						wake={(wake || over) && canAdd}
						size={size}
						fromRef={current.pillMorph ? frontWidthRef : null}
						still={still}
						disabled={disabled}
						ariaLabel={label === "Attach" ? "Attach files" : label}
						onClick={openPicker}
					/>
				) : (
					<ul
						ref={listRef}
						data-slot="upload-chip-list"
						aria-label="Attached files"
						className="relative flex max-w-full shrink-0 flex-wrap"
						style={{ gap: GAP, minHeight: height }}
						{...listPointer}
					>
						{items.map((item) => (
							<Chip
								key={item.file.id}
								file={item.file}
								size={size}
								leaving={item.leaving}
								behind={
									stack && !fanOpen && !item.leaving && item.file.id !== front
								}
								morph={item.file.id === current.morphId}
								label={label}
								still={still}
								disabled={disabled}
								onRemove={onRemove}
								onRetry={onRetry}
								onCancel={onCancel}
								register={register}
								onMeasure={onMeasure}
								onSettle={onSettle}
								onAction={onAction}
							/>
						))}
						{stack && extra > 0 ? (
							<span
								ref={countRef}
								data-slot="upload-chip-count"
								aria-hidden="true"
								className={cn(
									"pointer-events-none absolute start-0 top-0 flex items-center font-medium text-foreground/60 tabular-nums transition-opacity duration-150",
									size === "lg" ? "text-[13px]" : "text-xs",
									fanOpen ? "opacity-0" : "opacity-100 delay-75",
								)}
								style={{ height }}
							>
								+{extra}
								{hiddenError ? (
									// A tucked file failed.
									<span
										data-fade-in=""
										className="ms-[3px] size-[5px] -translate-y-[0.35em] rounded-full bg-destructive"
									/>
								) : null}
							</span>
						) : null}
					</ul>
				)}
				{showCompact ? (
					<AttachButton
						key="compact"
						buttonRef={compactRef}
						// Beside a deck a drag only wakes it; a label would push it onto
						// a new line in a narrow layout.
						text={note}
						compact
						wake={(wake || over) && canAdd}
						size={size}
						fromRef={null}
						still={still}
						disabled={disabled}
						ariaLabel="Attach more files"
						onClick={openPicker}
					/>
				) : null}
			</div>
			<span role="status" aria-live="polite" aria-atomic className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export default UploadChip;
