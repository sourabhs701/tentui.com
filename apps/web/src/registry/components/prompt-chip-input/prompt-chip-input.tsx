"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import {
	AnimatePresence,
	type AnimationPlaybackControls,
	animate,
	domAnimation,
	LazyMotion,
	m,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import {
	type ClipboardEvent,
	type ComponentProps,
	type DragEvent,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	type Ref,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

/** Rows the suggestion list shows at most. */
const MAX_RESULTS = 6;
/** Px the live capsule reaches past the typed text on each side. */
const CAPSULE_PAD = 3;
/** Chip height, in em of the field's font size. */
const CHIP_HEIGHT = 1.45;
/** Px between the capsule and the list, and between the list and the viewport edge. */
const POPOVER_GAP = 6;
const VIEWPORT_PAD = 8;

// Motion. The capsule's width follows the query on a spring; the solidify
// morph is a critically damped spring, so nothing overshoots.
const growSpring = { type: "spring", stiffness: 500, damping: 40 } as const;
const highlightSpring = {
	type: "spring",
	stiffness: 600,
	damping: 45,
} as const;
const solidifySpring = {
	type: "spring",
	duration: 0.26,
	bounce: 0,
	restDelta: 0.001,
} as const;
const MELT_MS = 180;
const APPEAR_MS = 120;
const HIDE_MS = 100;
/** Reduced motion swaps capsule and chip states with a short cross-fade. */
const FADE_MS = 100;
/** Px the icon slides in from the chip's inline-start edge. */
const ICON_SLIDE = 4;

/** Minimum ms between commit and melt sounds. */
const CUE_THROTTLE_MS = 80;
/** Typing within this many ms of the last keystroke undoes as one step. */
const UNDO_GROUP_MS = 1000;
const UNDO_LIMIT = 100;

/** Clipboard type that carries chips between prompt fields. */
const CLIPBOARD_TYPE = "application/x-tentui-prompt-chips+json";
/** Custom highlight that hides raw text while a melting chip covers it. */
const HIDDEN_HIGHLIGHT = "tentui-prompt-chip-hidden";
/** Characters after which a trigger opens, besides whitespace. */
const OPENERS = "([{";

// Hoisted and deduplicated by React, so many fields share one sheet.
// Chip initials are generated content with empty alt text, so they stay out
// of the textbox's value for screen readers.
const STYLES =
	`::highlight(${HIDDEN_HIGHLIGHT}){color:transparent}` +
	'[data-initials]::before{content:attr(data-initials);content:attr(data-initials)/""}';

const CHIP_CLASS =
	"inline-block h-[1.45em] cursor-default whitespace-nowrap rounded-md px-1.5 align-baseline font-medium leading-[1.45em]";
const ICON_CLASS =
	"me-1 inline-block size-3.5 overflow-hidden align-[-0.15em] [&>svg]:block [&>svg]:size-full";
const INITIALS_CLASS =
	"flex size-full items-center justify-center rounded-full bg-current/15 font-semibold text-[7px] uppercase leading-none tracking-tight";
const AVATAR_CLASS = "block size-full rounded-full object-cover";

const SPARKLE_PATH =
	"M8 1.5c.35 2.85 1.25 4.3 2.4 5.1 1 .7 2.2 1.05 3.6 1.4-1.4.35-2.6.7-3.6 1.4-1.15.8-2.05 2.25-2.4 5.1-.35-2.85-1.25-4.3-2.4-5.1C4.6 8.7 3.4 8.35 2 8c1.4-.35 2.6-.7 3.6-1.4C6.75 5.8 7.65 4.35 8 1.5Z";
const SPARKLE_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="${SPARKLE_PATH}"/></svg>`;

// A soft, short tick when a chip solidifies, and a lower, softer one when it
// melts back into text.
const COMMIT_SOUND = {
	name: "prompt-chip-commit",
	baseFreq: 1500,
	noiseColor: "white",
	oscType: "sine",
	filterFreq: 4200,
	filterQ: 3,
	attack: 0.001,
	decay: 0.45,
	brightness: 5200,
} as const;
const MELT_SOUND = {
	...COMMIT_SOUND,
	name: "prompt-chip-melt",
	baseFreq: 880,
	filterFreq: 2400,
	decay: 0.4,
	brightness: 3000,
} as const;

export interface PromptChipItem {
	id: string;
	label: string;
	/** What the chip stands for in `value.text`, after the trigger. Defaults to `label`. */
	value?: string;
	/** Dim secondary text in the suggestion row, such as a team or a price note. */
	description?: string;
	/** Shown before the label in the row and the chip. */
	icon?: ReactNode;
	/** Image URL for a round 14 px avatar in the chip. Takes precedence over `icon`. */
	avatar?: string;
}

export interface PromptChipTrigger {
	/** The character that opens suggestions, such as `"@"`, `"/"`, or `"~"`. */
	char: string;
	/** Which entry of `kinds` styles the chips this trigger makes. */
	kind: string;
	/** Items to filter, or a search called with the query. The latest async result wins. */
	items:
		| PromptChipItem[]
		| ((query: string) => PromptChipItem[] | Promise<PromptChipItem[]>);
	/** Keep the list open across spaces in the query. */
	allowSpaces?: boolean;
	/** `"start"` opens only at the start of a line. Defaults to `"start"` for the `command` kind, else `"any"`. */
	position?: "any" | "start";
}

export interface PromptChipKind {
	/** Read before the label by screen readers, as in "Mention: Ana Lima". */
	label?: string;
	/** Announced after a commit, as in "Ana Lima mentioned". */
	action?: string;
	/** Chip classes: a soft tint background and a text color. The live capsule draws its ring and fill in the text color. */
	className?: string;
	/** Show the trigger in the chip, as in "/summarize". */
	showTrigger?: boolean;
	/** Shown when an item has no `icon` or `avatar`. `"initials"` draws the label's initials and `"sparkle"` a small star. */
	icon?: ReactNode | "initials" | "sparkle";
}

export interface PromptChipData {
	kind: string;
	/** Defaults to the `char` of the first trigger of this kind. */
	trigger?: string;
	id: string;
	label: string;
	/** Defaults to `label`. */
	value?: string;
	avatar?: string;
	icon?: ReactNode;
}

export type PromptChipSegment =
	| { type: "text"; text: string }
	| ({ type: "chip" } & PromptChipData);

export interface PromptChipValue {
	/** Model-ready text, with each chip written as its trigger plus its value: "@ana", "/summarize", "~claude-opus-5-5". */
	text: string;
	chips: { kind: string; id: string; label: string; value: string }[];
	/** Text and chips in order. Pass these back as `value` or `defaultValue`. */
	segments: PromptChipSegment[];
}

export interface PromptChipInputHandle {
	/** Focuses the field with the caret at the end. */
	focus: () => void;
	clear: () => void;
	/** Inserts a chip at the caret, or at the end when the field isn't focused. */
	insertChip: (kind: string, item: PromptChipItem) => void;
	getValue: () => PromptChipValue;
}

export interface PromptChipInputProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultValue" | "onChange" | "onSubmit" | "ref"
	> {
	/** What opens suggestions, and the items each one offers. */
	triggers: PromptChipTrigger[];
	/** Styles and screen reader names per chip kind. `mention`, `model`, and `command` come preset. */
	kinds?: Record<string, PromptChipKind>;
	/** Controlled content. The field re-renders only when this differs from what it last reported. */
	value?: PromptChipSegment[] | string;
	/** Initial content when uncontrolled. */
	defaultValue?: PromptChipSegment[] | string;
	/** Called on every edit, chip commit, and melt. */
	onValueChange?: (value: PromptChipValue) => void;
	/** Called on Enter. Shift+Enter inserts a newline; Enter never submits during IME composition. */
	onSubmit?: (value: PromptChipValue) => void;
	placeholder?: string;
	disabled?: boolean;
	/** Lines the field grows to before it scrolls. */
	maxRows?: number;
	/** Empty the field after `onSubmit`. */
	clearOnSubmit?: boolean;
	/** Backspace after a chip melts it back into editable text first. Off deletes the chip at once. */
	meltOnBackspace?: boolean;
	/** Play a soft tick when a chip commits and a lower one when it melts. */
	sound?: boolean;
	/** A light haptic tick when a chip is committed from touch. */
	haptics?: boolean;
	/** Accessible name of the field. Defaults to "Message" unless `aria-labelledby` is set. */
	"aria-label"?: string;
	"aria-labelledby"?: string;
	/** Classes for the editable text area. */
	editableClassName?: string;
	/** Rendered below the text inside the card, such as a toolbar with a send button. */
	children?: ReactNode;
	ref?: Ref<PromptChipInputHandle>;
}

const DEFAULT_KINDS: Record<string, PromptChipKind> = {
	mention: {
		label: "Mention",
		action: "mentioned",
		icon: "initials",
		className:
			"bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
	},
	model: {
		label: "Model",
		action: "selected",
		icon: "sparkle",
		className:
			"bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
	},
	command: {
		label: "Command",
		action: "added",
		showTrigger: true,
		className: "bg-foreground/[0.06] font-mono text-foreground",
	},
};

interface ResolvedKind {
	label: string;
	action: string;
	className: string;
	showTrigger: boolean;
	icon: ReactNode;
}

interface ChipData {
	kind: string;
	trigger: string;
	id: string;
	label: string;
	value: string;
	avatar?: string;
	icon?: ReactNode;
}

type ChipSegment = { type: "chip" } & ChipData;
type Segment = { type: "text"; text: string } | ChipSegment;

interface Session {
	node: Text;
	start: number;
	end: number;
	triggerIndex: number;
	/** A melted chip keeps its menu open across the spaces in its label. */
	melted: boolean;
}

interface MenuState {
	triggerIndex: number;
	query: string;
	results: PromptChipItem[];
	loading: boolean;
	active: number;
}

interface Snapshot {
	segments: Segment[];
	caret: number | null;
}

interface IconSlot {
	key: number;
	el: Element;
	icon: ReactNode;
}

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

function capitalize(text: string) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function resolveKind(
	kinds: Record<string, PromptChipKind> | undefined,
	name: string,
): ResolvedKind {
	const preset = DEFAULT_KINDS[name];
	const custom = kinds?.[name];
	return {
		label: custom?.label ?? preset?.label ?? capitalize(name),
		action: custom?.action ?? preset?.action ?? "added",
		className:
			custom?.className ??
			preset?.className ??
			"bg-foreground/[0.06] text-foreground",
		showTrigger: custom?.showTrigger ?? preset?.showTrigger ?? false,
		icon: custom && "icon" in custom ? custom.icon : preset?.icon,
	};
}

function triggerPosition(trigger: PromptChipTrigger) {
	return trigger.position ?? (trigger.kind === "command" ? "start" : "any");
}

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function initials(label: string) {
	const words = label.trim().split(/\s+/).filter(Boolean);
	return words
		.slice(0, 2)
		.map((word) => Array.from(word)[0] ?? "")
		.join("");
}

type IconSpec =
	| { type: "avatar"; src: string }
	| { type: "initials" }
	| { type: "sparkle" }
	| { type: "node"; node: ReactNode }
	| null;

function iconSpec(
	chip: { avatar?: string; icon?: ReactNode },
	kind: ResolvedKind,
): IconSpec {
	if (chip.avatar) return { type: "avatar", src: chip.avatar };
	const icon = chip.icon !== undefined ? chip.icon : kind.icon;
	if (icon === "initials") return { type: "initials" };
	if (icon === "sparkle") return { type: "sparkle" };
	if (icon === null || icon === undefined || icon === false) return null;
	return { type: "node", node: icon };
}

function chipText(
	chip: { trigger: string; label: string },
	kind: ResolvedKind,
) {
	return kind.showTrigger ? chip.trigger + chip.label : chip.label;
}

/** A chip's markup. Built as a string so the server renders it too. */
function chipHtml(chip: ChipData, kind: ResolvedKind) {
	const spec = iconSpec(chip, kind);
	let icon = "";
	if (spec) {
		const inner =
			spec.type === "avatar"
				? `<img src="${escapeHtml(spec.src)}" alt="" draggable="false" class="${AVATAR_CLASS}">`
				: spec.type === "initials"
					? `<span data-initials="${escapeHtml(initials(chip.label))}" class="${INITIALS_CLASS}"></span>`
					: spec.type === "sparkle"
						? SPARKLE_SVG
						: "";
		icon = `<span data-slot="prompt-chip-icon" aria-hidden="true" class="${ICON_CLASS}">${inner}</span>`;
	}
	const data = [
		["kind", chip.kind],
		["id", chip.id],
		["label", chip.label],
		["value", chip.value],
		["trigger", chip.trigger],
		...(chip.avatar ? [["avatar", chip.avatar]] : []),
	]
		.map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
		.join(" ");
	return `<span contenteditable="false" data-slot="prompt-chip" ${data} class="${escapeHtml(cn(CHIP_CLASS, kind.className))}"><span class="sr-only">${escapeHtml(kind.label)}: </span>${icon}<span data-slot="prompt-chip-label">${escapeHtml(chipText(chip, kind))}</span></span>`;
}

function segmentsHtml(
	segments: Segment[],
	kinds: Record<string, PromptChipKind> | undefined,
) {
	return `${segments
		.map((segment) =>
			segment.type === "text"
				? escapeHtml(segment.text)
				: chipHtml(segment, resolveKind(kinds, segment.kind)),
		)
		.join("")}<br>`;
}

function isChip(node: Node | null | undefined): node is HTMLElement {
	return (
		!!node &&
		node.nodeType === Node.ELEMENT_NODE &&
		(node as HTMLElement).dataset.slot === "prompt-chip"
	);
}

function isText(node: Node | null | undefined): node is Text {
	return !!node && node.nodeType === Node.TEXT_NODE;
}

/** Fills in each chip's trigger and value, and merges adjacent text. */
function normalizeSegments(
	input: readonly PromptChipSegment[] | string | undefined,
	triggers: readonly PromptChipTrigger[],
): Segment[] {
	if (input === undefined) return [];
	const list: readonly PromptChipSegment[] =
		typeof input === "string" ? [{ type: "text", text: input }] : input;
	const out: Segment[] = [];
	for (const segment of list) {
		if (segment.type === "text") {
			if (!segment.text) continue;
			const last = out[out.length - 1];
			if (last?.type === "text") last.text += segment.text;
			else out.push({ type: "text", text: segment.text });
			continue;
		}
		out.push({
			type: "chip",
			kind: segment.kind,
			trigger:
				segment.trigger ??
				triggers.find((trigger) => trigger.kind === segment.kind)?.char ??
				"",
			id: segment.id,
			label: segment.label,
			value: segment.value ?? segment.label,
			avatar: segment.avatar,
			icon: segment.icon,
		});
	}
	return out;
}

function segmentsKey(segments: readonly Segment[]) {
	return JSON.stringify(
		segments.map((segment) =>
			segment.type === "text"
				? segment.text
				: [segment.kind, segment.id, segment.label, segment.value],
		),
	);
}

function serialize(segments: readonly Segment[], use: "value" | "label") {
	return segments
		.map((segment) =>
			segment.type === "text"
				? segment.text
				: segment.trigger + (use === "value" ? segment.value : segment.label),
		)
		.join("");
}

function toValue(segments: Segment[]): PromptChipValue {
	return {
		text: serialize(segments, "value"),
		chips: segments.flatMap((segment) =>
			segment.type === "chip"
				? [
						{
							kind: segment.kind,
							id: segment.id,
							label: segment.label,
							value: segment.value,
						},
					]
				: [],
		),
		segments: segments.map((segment) => ({ ...segment })),
	};
}

/** Reads text and chips from the field, or from a copied fragment. */
function readSegments(root: Node, icons: WeakMap<Element, ReactNode>) {
	const out: Segment[] = [];
	let text = "";
	const flush = () => {
		if (text) out.push({ type: "text", text });
		text = "";
	};
	// The field always ends in a <br> that holds the last line open.
	const sentinel = root.lastChild?.nodeName === "BR" ? root.lastChild : null;
	const walk = (parent: Node) => {
		for (const node of Array.from(parent.childNodes)) {
			if (isText(node)) {
				text += node.data.replace(/\u00a0/g, " ").replace(/\u200b/g, "");
			} else if (isChip(node)) {
				flush();
				const data = node.dataset;
				out.push({
					type: "chip",
					kind: data.kind ?? "",
					trigger: data.trigger ?? "",
					id: data.id ?? "",
					label: data.label ?? "",
					value: data.value ?? data.label ?? "",
					avatar: data.avatar,
					icon: icons.get(node),
				});
			} else if (node.nodeName === "BR") {
				if (node !== sentinel) text += "\n";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const block = node.nodeName === "DIV" || node.nodeName === "P";
				if (block && (text || out.length) && !text.endsWith("\n")) {
					text += "\n";
				}
				walk(node);
			}
		}
	};
	walk(root);
	flush();
	return out;
}

/** Characters before a point, counting a chip or a line break as one. */
function lengthOf(root: Node) {
	let length = 0;
	const walk = (parent: Node) => {
		for (const node of Array.from(parent.childNodes)) {
			if (isText(node)) length += node.data.length;
			else if (isChip(node) || node.nodeName === "BR") length += 1;
			else walk(node);
		}
	};
	walk(root);
	return length;
}

function rankItems(items: readonly PromptChipItem[], query: string) {
	const q = query.toLowerCase();
	if (!q) return items.slice(0, MAX_RESULTS);
	const ranked: Array<{ item: PromptChipItem; rank: number }> = [];
	for (const item of items) {
		const label = item.label.toLowerCase();
		const value = (item.value ?? "").toLowerCase();
		let rank = -1;
		if (label.startsWith(q)) rank = 0;
		else if (label.split(/[\s\-_.]+/).some((word) => word.startsWith(q)))
			rank = 1;
		else if (value.startsWith(q)) rank = 1;
		if (rank >= 0) ranked.push({ item, rank });
	}
	return ranked
		.sort((a, b) => a.rank - b.rank)
		.slice(0, MAX_RESULTS)
		.map(({ item }) => item);
}

function cssZoom(element: Element) {
	return (element as Element & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
}

/**
 * The box around a range's last line. Bidi text can split one line into
 * several rects, as Latin "@an" in a right-to-left paragraph does.
 */
function lastRect(range: Range) {
	const rects = Array.from(range.getClientRects()).filter(
		(rect) => rect.width > 0 || rect.height > 0,
	);
	const last = rects[rects.length - 1];
	if (!last) return null;
	const line = rects.filter(
		(rect) =>
			Math.abs(rect.top + rect.height / 2 - (last.top + last.height / 2)) <
			last.height / 2,
	);
	const left = Math.min(...line.map((rect) => rect.left));
	const right = Math.max(...line.map((rect) => rect.right));
	const top = Math.min(...line.map((rect) => rect.top));
	const bottom = Math.max(...line.map((rect) => rect.bottom));
	return new DOMRect(left, top, right - left, bottom - top);
}

function clamp(value: number, min = 0, max = 1) {
	return Math.min(Math.max(value, min), max);
}

function lerp(from: number, to: number, t: number) {
	return from + (to - from) * t;
}

function easeOut(t: number) {
	return 1 - (1 - t) ** 3;
}

const RTL_TEXT = /[\u0590-\u08ff\ufb1d-\ufdfd\ufe70-\ufefc]/;

/** A chip's icon or avatar, for list rows and static chips. */
function ItemIcon({
	spec,
	label,
	className,
	initialsClassName,
}: {
	spec: IconSpec;
	label: string;
	className?: string;
	initialsClassName?: string;
}) {
	if (!spec) return null;
	return (
		<span
			aria-hidden
			data-slot="prompt-chip-icon"
			className={cn(ICON_CLASS, className)}
		>
			{spec.type === "avatar" ? (
				// biome-ignore lint/performance/noImgElement: a 14 px avatar in user content
				<img src={spec.src} alt="" draggable={false} className={AVATAR_CLASS} />
			) : spec.type === "initials" ? (
				<span className={cn(INITIALS_CLASS, initialsClassName)}>
					{initials(label)}
				</span>
			) : spec.type === "sparkle" ? (
				<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
					<path d={SPARKLE_PATH} />
				</svg>
			) : (
				spec.node
			)}
		</span>
	);
}

/**
 * A chip outside the field, styled like the ones in it, for rendering sent
 * messages from `value.segments`.
 */
export function PromptChip({
	chip,
	kinds,
	className,
}: {
	chip: PromptChipData;
	kinds?: Record<string, PromptChipKind>;
	className?: string;
}) {
	const kind = resolveKind(kinds, chip.kind);
	return (
		<span
			data-slot="prompt-chip"
			data-kind={chip.kind}
			className={cn(CHIP_CLASS, kind.className, className)}
		>
			<span className="sr-only">{kind.label}: </span>
			<ItemIcon spec={iconSpec(chip, kind)} label={chip.label} />
			<span data-slot="prompt-chip-label">
				{chipText({ trigger: chip.trigger ?? "", label: chip.label }, kind)}
			</span>
		</span>
	);
}

export function PromptChipInput({
	triggers,
	kinds,
	value: valueProp,
	defaultValue,
	onValueChange,
	onSubmit,
	placeholder,
	disabled = false,
	maxRows = 8,
	clearOnSubmit = true,
	meltOnBackspace = true,
	sound = false,
	haptics = true,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	editableClassName,
	className,
	children,
	ref,
	...props
}: PromptChipInputProps) {
	const reducedMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	// Sound stays on under reduced motion; only movement is reduced.
	const { click: playCommit } = useTiks({
		theme: COMMIT_SOUND,
		volume: 0.25,
		respectReducedMotion: false,
	});
	const { click: playMelt } = useTiks({
		theme: MELT_SOUND,
		volume: 0.15,
		respectReducedMotion: false,
	});

	const ids = useId().replace(/[^\w-]/g, "");
	const listId = `prompt-chip-input-${ids}-list`;
	const optionId = (index: number) =>
		`prompt-chip-input-${ids}-option-${index}`;

	const [initial] = useState(() =>
		normalizeSegments(valueProp ?? defaultValue, triggers),
	);
	const [initialHtml] = useState(() => ({
		__html: segmentsHtml(initial, kinds),
	}));
	const [empty, setEmpty] = useState(initial.length === 0);
	const [focused, setFocused] = useState(false);
	const [menu, setMenuState] = useState<MenuState | null>(null);
	const [capsuleKind, setCapsuleKind] = useState(
		() => triggers[0]?.kind ?? "mention",
	);
	const [iconSlots, setIconSlots] = useState<IconSlot[]>([]);
	const [announcement, setAnnouncement] = useState("");

	const rootRef = useRef<HTMLDivElement>(null);
	const editableRef = useRef<HTMLDivElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	const boxRef = useRef<HTMLSpanElement>(null);
	const liveRef = useRef<HTMLSpanElement>(null);
	const solidRef = useRef<HTMLSpanElement>(null);
	const typedRef = useRef<HTMLSpanElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const ghostRef = useRef<HTMLSpanElement>(null);
	const ghostTextRef = useRef<HTMLSpanElement>(null);
	const spinnerRef = useRef<HTMLSpanElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

	// The capsule's box in the overlay, in px.
	const boxX = useMotionValue(0);
	const boxY = useMotionValue(0);
	const boxW = useMotionValue(0);
	const boxH = useMotionValue(0);
	const boxScale = useMotionValue(1);
	const boxOrigin = useMotionValue(0);
	const highlightY = useMotionValue(0);
	const highlightH = useMotionValue(0);

	const menuRef = useRef<MenuState | null>(null);
	const sessionRef = useRef<Session | null>(null);
	/** A trigger closed with Esc stays closed until a new one is typed. */
	const dismissedRef = useRef<{ node: Text; start: number } | null>(null);
	/** What the overlay is drawing: nothing, a live capsule, or a morph. */
	const phaseRef = useRef<"idle" | "live" | "solid" | "melt">("idle");
	const transitionRef = useRef<{
		controls: AnimationPlaybackControls;
		finish: () => void;
	} | null>(null);
	/** The capsule's position and width springs. */
	const geometryRef = useRef<AnimationPlaybackControls[]>([]);
	/** The capsule's fade and scale in or out. */
	const fadeRef = useRef<AnimationPlaybackControls[]>([]);
	const anchorRef = useRef<{
		left: number;
		right: number;
		top: number;
		bottom: number;
	} | null>(null);
	const sideRef = useRef<"top" | "bottom" | null>(null);
	const highlightShownRef = useRef(false);
	const requestRef = useRef(0);
	/** The session waiting to announce its result count. */
	const announceCountRef = useRef(false);
	const lastKeyRef = useRef(segmentsKey(initial));
	/** The chip just committed; one Backspace across its trailing space melts it. */
	const lastCommitRef = useRef<HTMLElement | null>(null);
	const historyRef = useRef({
		past: [] as Snapshot[],
		future: [] as Snapshot[],
		lastKind: "",
		lastAt: 0,
	});
	const composingRef = useRef(false);
	const touchRef = useRef(false);
	const pointerTypeRef = useRef("mouse");
	const lastCueRef = useRef(Number.NEGATIVE_INFINITY);
	const chipIconsRef = useRef(new WeakMap<Element, ReactNode>());
	const itemCacheRef = useRef(new Map<string, PromptChipItem>());
	const pendingSlotsRef = useRef<IconSlot[]>([]);
	const slotKeyRef = useRef(0);
	const iconSlotsRef = useRef<IconSlot[]>([]);

	const kindFor = (name: string) => resolveKind(kinds, name);

	const setMenu = (next: MenuState | null) => {
		menuRef.current = next;
		setMenuState(next);
	};

	const announce = (message: string) => {
		// A zero-width space makes a repeated message announce again.
		setAnnouncement((previous) =>
			previous === message ? `${message}\u200b` : message,
		);
	};

	// --- DOM model -----------------------------------------------------------

	const read = () => {
		const editable = editableRef.current;
		return editable ? readSegments(editable, chipIconsRef.current) : [];
	};

	const lookupItem = (kind: string, id: string) => {
		const cached = itemCacheRef.current.get(`${kind}\u0000${id}`);
		if (cached) return cached;
		for (const trigger of triggers) {
			if (trigger.kind !== kind || typeof trigger.items === "function") {
				continue;
			}
			const item = trigger.items.find((candidate) => candidate.id === id);
			if (item) return item;
		}
		return undefined;
	};

	const createChip = (data: ChipData) => {
		const kind = kindFor(data.kind);
		const template = document.createElement("template");
		template.innerHTML = chipHtml(data, kind);
		const chip = template.content.firstElementChild as HTMLElement;
		if (data.icon !== undefined) chipIconsRef.current.set(chip, data.icon);
		const spec = iconSpec(data, kind);
		const slot = chip.querySelector('[data-slot="prompt-chip-icon"]');
		if (spec?.type === "node" && slot) {
			pendingSlotsRef.current.push({
				key: ++slotKeyRef.current,
				el: slot,
				icon: spec.node,
			});
		}
		return chip;
	};

	/** Mounts icons for new chips and drops the ones that left the field. */
	const syncIconSlots = (sync = false) => {
		const pending = pendingSlotsRef.current;
		const stale = iconSlotsRef.current.some((slot) => !slot.el.isConnected);
		if (pending.length === 0 && !stale) return;
		pendingSlotsRef.current = [];
		const next = [
			...iconSlotsRef.current.filter((slot) => slot.el.isConnected),
			...pending,
		];
		iconSlotsRef.current = next;
		if (sync) flushSync(() => setIconSlots(next));
		else setIconSlots(next);
	};

	const buildFragment = (segments: readonly Segment[]) => {
		const fragment = document.createDocumentFragment();
		for (const segment of segments) {
			fragment.append(
				segment.type === "text"
					? document.createTextNode(segment.text)
					: createChip(segment),
			);
		}
		return fragment;
	};

	const render = (segments: readonly Segment[]) => {
		editableRef.current?.replaceChildren(
			buildFragment(segments),
			document.createElement("br"),
		);
		syncIconSlots();
	};

	// --- Caret ---------------------------------------------------------------

	const selectionRange = () => {
		const editable = editableRef.current;
		const selection = window.getSelection();
		if (!editable || !selection || selection.rangeCount === 0) return null;
		const range = selection.getRangeAt(0);
		return editable.contains(range.commonAncestorContainer) ? range : null;
	};

	const getCaret = () => {
		const range = selectionRange();
		if (!range?.collapsed) return null;
		return { node: range.startContainer, offset: range.startOffset };
	};

	const placeCaret = (node: Node, offset: number) => {
		const selection = window.getSelection();
		if (!selection) return;
		const range = document.createRange();
		range.setStart(node, offset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
	};

	const caretOffset = () => {
		const editable = editableRef.current;
		const caret = getCaret();
		if (!editable || !caret) return null;
		const range = document.createRange();
		range.setStart(editable, 0);
		range.setEnd(caret.node, caret.offset);
		return lengthOf(range.cloneContents());
	};

	const setCaretOffset = (target: number) => {
		const editable = editableRef.current;
		if (!editable) return;
		let remaining = target;
		const nodes = Array.from(editable.childNodes);
		for (const [index, node] of nodes.entries()) {
			if (isText(node)) {
				if (remaining <= node.data.length) {
					placeCaret(node, remaining);
					return;
				}
				remaining -= node.data.length;
			} else if (node === editable.lastChild && node.nodeName === "BR") {
				break;
			} else {
				if (remaining === 0) {
					placeCaret(editable, index);
					return;
				}
				remaining -= 1;
			}
		}
		const last = editable.lastChild;
		placeCaret(
			editable,
			Math.max(0, nodes.length - (last?.nodeName === "BR" ? 1 : 0)),
		);
	};

	/** Merges split text and keeps the trailing <br>, holding the caret in place. */
	const tidy = () => {
		const editable = editableRef.current;
		if (!editable) return;
		const nodes = Array.from(editable.childNodes);
		const messy = nodes.some(
			(node, index) =>
				isText(node) && (node.data === "" || isText(nodes[index + 1])),
		);
		if (messy) {
			const offset = caretOffset();
			editable.normalize();
			if (offset !== null) setCaretOffset(offset);
		}
		if (editable.lastChild?.nodeName !== "BR") {
			editable.appendChild(document.createElement("br"));
		}
	};

	/** The chip right before the caret, or before a just-committed chip's space. */
	const chipBeforeCaret = (allowSpace: boolean) => {
		const caret = getCaret();
		if (!caret) return null;
		const { node, offset } = caret;
		let before: Node | null = null;
		if (isText(node)) {
			const text = node.data.slice(0, offset);
			if (text === "") before = node.previousSibling;
			else if (
				allowSpace &&
				/^[ \u00a0]$/.test(text) &&
				node.previousSibling === lastCommitRef.current
			) {
				before = node.previousSibling;
			}
		} else if (node === editableRef.current) {
			before = node.childNodes[offset - 1] ?? null;
		}
		while (isText(before) && before.data === "")
			before = before.previousSibling;
		return isChip(before) ? before : null;
	};

	const chipAfterCaret = () => {
		const caret = getCaret();
		if (!caret) return null;
		const { node, offset } = caret;
		let after: Node | null = null;
		if (isText(node)) {
			if (offset === node.data.length) after = node.nextSibling;
		} else if (node === editableRef.current) {
			after = node.childNodes[offset] ?? null;
		}
		while (isText(after) && after.data === "") after = after.nextSibling;
		return isChip(after) ? after : null;
	};

	// --- Value and history ---------------------------------------------------

	const emit = () => {
		const segments = read();
		setEmpty(segments.length === 0);
		const key = segmentsKey(segments);
		if (key === lastKeyRef.current) return;
		lastKeyRef.current = key;
		onValueChange?.(toValue(segments));
	};

	const snapshot = (): Snapshot => ({ segments: read(), caret: caretOffset() });

	const record = (kind: "type" | "delete" | "op") => {
		const history = historyRef.current;
		const now = performance.now();
		if (
			kind !== "op" &&
			kind === history.lastKind &&
			now - history.lastAt < UNDO_GROUP_MS
		) {
			history.lastAt = now;
			return;
		}
		history.past.push(snapshot());
		if (history.past.length > UNDO_LIMIT) history.past.shift();
		history.future = [];
		history.lastKind = kind;
		history.lastAt = now;
	};

	// --- Overlay -------------------------------------------------------------

	const stopGeometry = () => {
		for (const controls of geometryRef.current) controls.stop();
		geometryRef.current = [];
	};

	/** The capsule's opacity, written directly so it stays on the JS frame loop. */
	const setBoxOpacity = (opacity: number) => {
		if (boxRef.current) boxRef.current.style.opacity = String(opacity);
	};

	const stopFade = () => {
		for (const controls of fadeRef.current) controls.stop();
		fadeRef.current = [];
	};

	const fadeBox = (to: number, ms: number) => {
		const from = Number(boxRef.current?.style.opacity || 0);
		return animate(from, to, {
			duration: ms / 1000,
			ease: "easeOut",
			onUpdate: setBoxOpacity,
		});
	};

	const resetOverlay = () => {
		if (liveRef.current) liveRef.current.style.opacity = "";
		if (solidRef.current) solidRef.current.style.opacity = "0";
		const typed = typedRef.current;
		if (typed) {
			typed.textContent = "";
			typed.style.opacity = "";
			typed.style.filter = "";
		}
		labelRef.current?.replaceChildren();
		CSS.highlights?.delete(HIDDEN_HIGHLIGHT);
	};

	/** Jumps a running solidify or melt to its end state. */
	const settleTransition = () => {
		transitionRef.current?.finish();
	};

	const runTransition = (
		options: Parameters<typeof animate>[2],
		onFrame: (progress: number) => void,
		onDone: () => void,
	) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			transitionRef.current = null;
			onFrame(1);
			onDone();
		};
		// Paint the first frame now, before the browser does.
		onFrame(0);
		const from: number = 0;
		const controls = animate(from, 1, {
			...options,
			onUpdate: onFrame,
			onComplete: finish,
		} as Parameters<typeof animate>[2]);
		transitionRef.current = {
			controls,
			finish: () => {
				controls.stop();
				finish();
			},
		};
	};

	const layerMetrics = () => {
		const layer = layerRef.current;
		if (!layer) return null;
		return { rect: layer.getBoundingClientRect(), zoom: cssZoom(layer) };
	};

	const toLayer = (
		rect: DOMRect,
		metrics: { rect: DOMRect; zoom: number },
	): Box => ({
		x: (rect.left - metrics.rect.left) / metrics.zoom,
		y: (rect.top - metrics.rect.top) / metrics.zoom,
		w: rect.width / metrics.zoom,
		h: rect.height / metrics.zoom,
	});

	const isRtl = () =>
		!!editableRef.current &&
		getComputedStyle(editableRef.current).direction === "rtl";

	const setKind = (kind: string) => {
		if (kind !== capsuleKind) flushSync(() => setCapsuleKind(kind));
	};

	const hideGhost = () => {
		if (ghostRef.current) ghostRef.current.hidden = true;
	};

	/** The rest of the best match, after the caret, or a spinner while loading. */
	const updateGhost = () => {
		const ghost = ghostRef.current;
		const ghostText = ghostTextRef.current;
		const spinner = spinnerRef.current;
		const session = sessionRef.current;
		const state = menuRef.current;
		const metrics = layerMetrics();
		if (!ghost || !ghostText || !spinner || !metrics) return;
		if (
			!session?.node.isConnected ||
			!state ||
			phaseRef.current !== "live" ||
			composingRef.current
		) {
			hideGhost();
			return;
		}
		// Only when nothing follows on the line, so it never covers text.
		const rest = session.node.data.slice(session.end);
		const line = rest.split("\n")[0];
		const next = session.node.nextSibling;
		const followed =
			line.trim() !== "" ||
			(!rest.includes("\n") && !!next && next.nodeName !== "BR");
		const item = state.results[state.active];
		const query = state.query;
		let text = "";
		if (
			item &&
			!state.loading &&
			item.label.length > query.length &&
			item.label.toLowerCase().startsWith(query.toLowerCase())
		) {
			text = item.label.slice(query.length);
		}
		if (followed || (!text && !state.loading)) {
			hideGhost();
			return;
		}
		const range = document.createRange();
		range.setStart(session.node, session.start);
		range.setEnd(session.node, session.end);
		const rect = lastRect(range);
		if (!rect) return;
		const box = toLayer(rect, metrics);
		// After bidi reordering, a completion only reads right when the label
		// runs in the paragraph's direction.
		const rtl = isRtl();
		if (rtl !== RTL_TEXT.test(item?.label ?? query)) {
			hideGhost();
			return;
		}
		ghostText.textContent = text;
		ghostText.hidden = state.loading;
		spinner.hidden = !state.loading;
		ghost.hidden = false;
		ghost.style.lineHeight = `${box.h}px`;
		ghost.style.top = `${box.y}px`;
		// Starts just past the capsule's ring.
		const gap = CAPSULE_PAD + 1;
		ghost.style.left = `${rtl ? box.x - gap : box.x + box.w + gap}px`;
		ghost.style.transform = rtl ? "translateX(-100%)" : "";
	};

	/** Places the live capsule over the trigger and query. */
	const measureCapsule = (mode: "appear" | "grow" | "jump") => {
		const session = sessionRef.current;
		const editable = editableRef.current;
		const metrics = layerMetrics();
		if (!session?.node.isConnected || !editable || !metrics) return;
		const range = document.createRange();
		range.setStart(session.node, session.start);
		range.setEnd(session.node, session.end);
		const rect = lastRect(range);
		if (!rect) return;
		const box = toLayer(rect, metrics);
		const height =
			Number.parseFloat(getComputedStyle(editable).fontSize) * CHIP_HEIGHT;
		const target = {
			x: box.x - CAPSULE_PAD,
			y: box.y + box.h / 2 - height / 2,
			w: box.w + CAPSULE_PAD * 2,
			h: height,
		};
		const zoom = metrics.zoom;
		anchorRef.current = {
			left: metrics.rect.left + target.x * zoom,
			right: metrics.rect.left + (target.x + target.w) * zoom,
			top: metrics.rect.top + target.y * zoom,
			bottom: metrics.rect.top + (target.y + target.h) * zoom,
		};
		if (phaseRef.current === "live" && mode !== "appear") {
			const wrapped = Math.abs(boxY.get() - target.y) > 2;
			if (mode === "jump" || wrapped || reducedMotion) {
				stopGeometry();
				boxX.jump(target.x);
				boxW.jump(target.w);
			} else {
				stopGeometry();
				geometryRef.current = [
					animate(boxX, target.x, growSpring),
					animate(boxW, target.w, growSpring),
				];
			}
			boxY.jump(target.y);
			boxH.jump(target.h);
			updateGhost();
			return;
		}
		if (phaseRef.current !== "live") {
			// A new capsule fades in, scaled from 0.9 at the trigger.
			settleTransition();
			stopGeometry();
			resetOverlay();
			phaseRef.current = "live";
			boxX.jump(target.x);
			boxY.jump(target.y);
			boxW.jump(target.w);
			boxH.jump(target.h);
			boxOrigin.jump(isRtl() ? 1 : 0);
			stopFade();
			setBoxOpacity(0);
			boxScale.jump(reducedMotion ? 1 : 0.9);
			const duration = (reducedMotion ? FADE_MS : APPEAR_MS) / 1000;
			fadeRef.current = [
				fadeBox(1, reducedMotion ? FADE_MS : APPEAR_MS),
				...(reducedMotion
					? []
					: [animate(boxScale, 1, { duration, ease: "easeOut" })]),
			];
		}
		updateGhost();
	};

	const hideCapsule = () => {
		hideGhost();
		if (phaseRef.current !== "live") return;
		phaseRef.current = "idle";
		stopGeometry();
		stopFade();
		fadeRef.current = [fadeBox(0, HIDE_MS)];
	};

	// --- Suggestions ---------------------------------------------------------

	const remember = (kind: string, items: readonly PromptChipItem[]) => {
		for (const item of items) {
			itemCacheRef.current.set(`${kind}\u0000${item.id}`, item);
		}
	};

	const announceCount = (state: MenuState) => {
		if (!announceCountRef.current || state.loading) return;
		announceCountRef.current = false;
		const count = state.results.length;
		announce(
			count === 0
				? "No matches"
				: `${count} ${count === 1 ? "suggestion" : "suggestions"}`,
		);
	};

	const load = (
		triggerIndex: number,
		query: string,
		keep: MenuState | null,
		activeId?: string,
	) => {
		const trigger = triggers[triggerIndex];
		if (!trigger) return;
		const id = ++requestRef.current;
		const activeFor = (results: PromptChipItem[]) =>
			Math.max(
				0,
				activeId ? results.findIndex((item) => item.id === activeId) : 0,
			);
		const settle = (items: PromptChipItem[]) => {
			const results = items.slice(0, MAX_RESULTS);
			remember(trigger.kind, results);
			const next = {
				triggerIndex,
				query,
				results,
				loading: false,
				active: activeFor(results),
			};
			setMenu(next);
			announceCount(next);
		};
		const source = trigger.items;
		if (typeof source !== "function") {
			settle(rankItems(source, query));
			return;
		}
		let out: PromptChipItem[] | Promise<PromptChipItem[]>;
		try {
			out = source(query);
		} catch {
			out = [];
		}
		if (!(out instanceof Promise) && !("then" in out)) {
			settle(out);
			return;
		}
		// Earlier results stay up while the next ones load.
		const previous = keep?.triggerIndex === triggerIndex ? keep.results : [];
		setMenu({
			triggerIndex,
			query,
			results: previous,
			loading: true,
			active: Math.min(keep?.active ?? 0, Math.max(previous.length - 1, 0)),
		});
		Promise.resolve(out).then(
			(items) => {
				if (id === requestRef.current && sessionRef.current) settle(items);
			},
			() => {
				if (id === requestRef.current && sessionRef.current) settle([]);
			},
		);
	};

	const closeMenu = () => {
		sessionRef.current = null;
		requestRef.current++;
		announceCountRef.current = false;
		if (menuRef.current) setMenu(null);
		hideCapsule();
	};

	const dismiss = () => {
		const session = sessionRef.current;
		if (session) {
			dismissedRef.current = { node: session.node, start: session.start };
		}
		closeMenu();
	};

	/** The character before a text node, as seen by the word-boundary check. */
	const charBefore = (node: Text) => {
		let previous = node.previousSibling;
		while (isText(previous) && previous.data === "") {
			previous = previous.previousSibling;
		}
		if (!previous) return "\n";
		if (previous.nodeName === "BR") return "\n";
		if (isText(previous)) return previous.data.slice(-1);
		return " ";
	};

	/** The trigger and query that end at the caret, if any. */
	const findToken = (): Session | null => {
		const caret = getCaret();
		if (!caret || !isText(caret.node)) return null;
		const node = caret.node;
		const end = caret.offset;
		const data = node.data;
		const session = sessionRef.current;
		if (session && session.node === node && session.start < end) {
			const trigger = triggers[session.triggerIndex];
			if (trigger && data.startsWith(trigger.char, session.start)) {
				const query = data.slice(session.start + trigger.char.length, end);
				if (
					!query.includes("\n") &&
					(trigger.allowSpaces || session.melted || !/\s/.test(query))
				) {
					return { ...session, end };
				}
			}
		}
		for (let index = end - 1; index >= 0; index--) {
			if (/\s/.test(data[index])) return null;
			const triggerIndex = triggers.findIndex(
				(trigger) => trigger.char && data.startsWith(trigger.char, index),
			);
			if (triggerIndex === -1) continue;
			const trigger = triggers[triggerIndex];
			if (index + trigger.char.length > end) continue;
			const before = index > 0 ? data[index - 1] : charBefore(node);
			const lineStart = before === "\n";
			// "a@b.com" never opens: a trigger needs a word boundary before it.
			if (!lineStart && !/\s/.test(before) && !OPENERS.includes(before)) {
				return null;
			}
			if (triggerPosition(trigger) === "start" && !lineStart) return null;
			return { node, start: index, end, triggerIndex, melted: false };
		}
		return null;
	};

	const detect = () => {
		const dismissed = dismissedRef.current;
		if (dismissed) {
			const stillThere =
				dismissed.node.isConnected &&
				triggers.some((trigger) =>
					dismissed.node.data.startsWith(trigger.char, dismissed.start),
				);
			if (!stillThere) dismissedRef.current = null;
		}
		const token = findToken();
		if (
			!token ||
			(dismissedRef.current &&
				token.node === dismissedRef.current.node &&
				token.start === dismissedRef.current.start)
		) {
			closeMenu();
			return;
		}
		const previous = sessionRef.current;
		const fresh =
			!previous ||
			previous.node !== token.node ||
			previous.start !== token.start ||
			previous.triggerIndex !== token.triggerIndex;
		sessionRef.current = token;
		const trigger = triggers[token.triggerIndex];
		const query = token.node.data.slice(
			token.start + trigger.char.length,
			token.end,
		);
		if (fresh) {
			announceCountRef.current = true;
			sideRef.current = null;
			setKind(trigger.kind);
		}
		const state = menuRef.current;
		if (fresh || !state || state.query !== query) {
			load(token.triggerIndex, query, fresh ? null : state);
		}
		measureCapsule(fresh ? "appear" : "grow");
	};

	// --- Commit and melt -----------------------------------------------------

	const cue = (kind: "commit" | "melt", touch: boolean) => {
		if (document.visibilityState === "hidden") return;
		const now = performance.now();
		if (now - lastCueRef.current < CUE_THROTTLE_MS) return;
		lastCueRef.current = now;
		if (sound) (kind === "commit" ? playCommit : playMelt)();
		if (haptics && kind === "commit" && touch) void haptic("light");
	};

	const prepareClone = (chip: HTMLElement) => {
		const clone = chip.cloneNode(true) as HTMLElement;
		clone.removeAttribute("contenteditable");
		clone.removeAttribute("data-slot");
		clone.style.cssText =
			"position:absolute;left:0;top:0;margin:0;background:transparent";
		return clone;
	};

	/**
	 * The capsule morphs into the chip's rect while the typed letters blur out
	 * and the label fades in. The real chip stays hidden underneath and widens
	 * on the same spring, so text after it glides along instead of being
	 * covered, and the chip is revealed in place at the end.
	 */
	const solidify = (
		chip: HTMLElement,
		raw: { rect: DOMRect; text: string } | null,
		from: Box | null,
	) => {
		const metrics = layerMetrics();
		const label = labelRef.current;
		const typed = typedRef.current;
		const live = liveRef.current;
		const solid = solidRef.current;
		if (!metrics || !label || !typed || !live || !solid) return;
		const target = toLayer(chip.getBoundingClientRect(), metrics);
		if (reducedMotion || !raw || !from) {
			chip.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: FADE_MS,
				easing: "ease-out",
			});
			hideCapsule();
			return;
		}
		const clone = prepareClone(chip);
		const rawBox = toLayer(raw.rect, metrics);
		chip.style.width = `${rawBox.w}px`;
		chip.style.opacity = "0";
		phaseRef.current = "solid";
		stopGeometry();
		stopFade();
		hideGhost();
		label.replaceChildren(clone);
		typed.textContent = raw.text;
		typed.style.lineHeight = `${rawBox.h}px`;
		setBoxOpacity(1);
		boxScale.jump(1);
		const icon = clone.querySelector<HTMLElement>(
			'[data-slot="prompt-chip-icon"]',
		);
		const slide = isRtl() ? ICON_SLIDE : -ICON_SLIDE;
		runTransition(
			solidifySpring,
			(progress) => {
				const t = clamp(progress);
				const x = lerp(from.x, target.x, progress);
				const y = lerp(from.y, target.y, progress);
				boxX.jump(x);
				boxY.jump(y);
				boxW.jump(lerp(from.w, target.w, progress));
				boxH.jump(lerp(from.h, target.h, progress));
				chip.style.width = `${lerp(rawBox.w, target.w, progress).toFixed(2)}px`;
				live.style.opacity = String(1 - t);
				solid.style.opacity = String(t);
				typed.style.left = `${rawBox.x - x}px`;
				typed.style.top = `${rawBox.y - y}px`;
				typed.style.opacity = String(1 - clamp(t * 1.6));
				typed.style.filter = `blur(${(t * 2).toFixed(2)}px)`;
				clone.style.left = `${target.x - x}px`;
				clone.style.top = `${target.y - y}px`;
				clone.style.opacity = String(clamp((t - 0.2) / 0.6));
				if (icon) {
					const shown = clamp((t - 0.3) / 0.7);
					icon.style.opacity = String(shown);
					icon.style.transform = `translateX(${(slide * (1 - shown)).toFixed(2)}px)`;
				}
			},
			() => {
				chip.style.removeProperty("width");
				chip.style.removeProperty("opacity");
				if (chip.getAttribute("style") === "") chip.removeAttribute("style");
				setBoxOpacity(0);
				phaseRef.current = "idle";
				resetOverlay();
				// A trigger typed during the morph gets its capsule now.
				if (sessionRef.current) measureCapsule("appear");
			},
		);
	};

	const commit = (item: PromptChipItem, touch: boolean) => {
		const session = sessionRef.current;
		const trigger = session ? triggers[session.triggerIndex] : undefined;
		if (!session?.node.isConnected || !trigger) return;
		settleTransition();
		record("op");
		const kind = kindFor(trigger.kind);
		remember(trigger.kind, [item]);
		const range = document.createRange();
		range.setStart(session.node, session.start);
		range.setEnd(session.node, session.end);
		const rect = lastRect(range);
		const raw = rect
			? { rect, text: session.node.data.slice(session.start, session.end) }
			: null;
		const from =
			phaseRef.current === "live"
				? { x: boxX.get(), y: boxY.get(), w: boxW.get(), h: boxH.get() }
				: null;
		stopGeometry();
		// Swap the trigger and query for the chip and a single space.
		const after = session.node.splitText(session.end);
		const token = session.node.splitText(session.start);
		const chip = createChip({
			kind: trigger.kind,
			trigger: trigger.char,
			id: item.id,
			label: item.label,
			value: item.value ?? item.label,
			avatar: item.avatar,
			icon: item.icon,
		});
		token.replaceWith(chip);
		if (!/^[ \u00a0]/.test(after.data)) after.insertData(0, " ");
		placeCaret(after, 1);
		sessionRef.current = null;
		requestRef.current++;
		setMenu(null);
		// Icons render now, so the morph's copy of the chip has them.
		syncIconSlots(true);
		tidy();
		lastCommitRef.current = chip;
		emit();
		cue("commit", touch);
		announce(`${item.label} ${kind.action}`);
		solidify(chip, raw, from);
	};

	/**
	 * The chip turns back into its raw "@label" text with the caret at its
	 * end and the menu open, and the tint drains to the live capsule.
	 */
	const melt = (chip: HTMLElement) => {
		const editable = editableRef.current;
		const metrics = layerMetrics();
		if (!editable || !metrics) return;
		settleTransition();
		record("op");
		const data = chip.dataset;
		const kindName = data.kind ?? "";
		const kind = kindFor(kindName);
		const triggerChar = data.trigger ?? "";
		const label = data.label ?? "";
		const triggerIndex = Math.max(
			triggers.findIndex(
				(trigger) => trigger.kind === kindName && trigger.char === triggerChar,
			),
			triggers.findIndex((trigger) => trigger.kind === kindName),
		);
		const chipBox = toLayer(chip.getBoundingClientRect(), metrics);
		const clone = prepareClone(chip);
		const rawText = triggerChar + label;
		const text = document.createTextNode(rawText);
		chip.replaceWith(text);
		placeCaret(text, rawText.length);
		lastCommitRef.current = null;
		tidy();
		const caret = getCaret();
		emit();
		cue("melt", false);
		announce(`${kind.label} removed, editing ${label}`);
		if (!caret || !isText(caret.node) || triggerIndex === -1) {
			closeMenu();
			return;
		}
		stopGeometry();
		stopFade();
		resetOverlay();
		setKind(kindName);
		sessionRef.current = {
			node: caret.node,
			start: caret.offset - rawText.length,
			end: caret.offset,
			triggerIndex,
			melted: true,
		};
		announceCountRef.current = false;
		sideRef.current = null;
		load(triggerIndex, label, null, data.id);

		// Where the live capsule lands, over the raw text.
		phaseRef.current = "melt";
		const range = document.createRange();
		range.setStart(caret.node, caret.offset - rawText.length);
		range.setEnd(caret.node, caret.offset);
		const rect = lastRect(range);
		const typed = typedRef.current;
		const labelLayer = labelRef.current;
		const live = liveRef.current;
		const solid = solidRef.current;
		if (!rect || !typed || !labelLayer || !live || !solid) {
			phaseRef.current = "idle";
			measureCapsule("appear");
			return;
		}
		const rawBox = toLayer(rect, metrics);
		const height = chipBox.h;
		const target = {
			x: rawBox.x - CAPSULE_PAD,
			y: rawBox.y + rawBox.h / 2 - height / 2,
			w: rawBox.w + CAPSULE_PAD * 2,
			h: height,
		};
		boxOrigin.jump(isRtl() ? 1 : 0);
		boxScale.jump(1);
		setBoxOpacity(1);
		if (reducedMotion) {
			boxX.jump(target.x);
			boxY.jump(target.y);
			boxW.jump(target.w);
			boxH.jump(target.h);
			setBoxOpacity(0);
			phaseRef.current = "live";
			fadeRef.current = [fadeBox(1, FADE_MS)];
			measureCapsule("jump");
			return;
		}
		labelLayer.replaceChildren(clone);
		typed.textContent = rawText;
		typed.style.lineHeight = `${rawBox.h}px`;
		CSS.highlights?.set(HIDDEN_HIGHLIGHT, new Highlight(range));
		// A spacer holds the chip's extra width and shrinks away, so text after
		// the chip glides back instead of jumping.
		const extra = chipBox.w - rawBox.w;
		const spacer = document.createElement("span");
		spacer.contentEditable = "false";
		spacer.setAttribute("aria-hidden", "true");
		spacer.style.cssText = "display:inline-block;height:1px";
		if (extra > 0.5) {
			caret.node.parentNode?.insertBefore(
				spacer,
				caret.node.splitText(caret.offset),
			);
			placeCaret(caret.node, caret.offset);
		}
		const icon = clone.querySelector<HTMLElement>(
			'[data-slot="prompt-chip-icon"]',
		);
		const slide = isRtl() ? ICON_SLIDE : -ICON_SLIDE;
		runTransition(
			{ duration: MELT_MS / 1000, ease: "linear" },
			(progress) => {
				const t = easeOut(progress);
				const x = lerp(chipBox.x, target.x, t);
				const y = lerp(chipBox.y, target.y, t);
				boxX.jump(x);
				boxY.jump(y);
				boxW.jump(lerp(chipBox.w, target.w, t));
				boxH.jump(lerp(chipBox.h, target.h, t));
				solid.style.opacity = String(1 - t);
				live.style.opacity = String(t);
				clone.style.left = `${chipBox.x - x}px`;
				clone.style.top = `${chipBox.y - y}px`;
				clone.style.opacity = String(1 - clamp(t * 2));
				clone.style.filter = `blur(${(t * 1.5).toFixed(2)}px)`;
				if (icon) {
					icon.style.transform = `translateX(${(slide * t).toFixed(2)}px)`;
				}
				typed.style.left = `${rawBox.x - x}px`;
				typed.style.top = `${rawBox.y - y}px`;
				typed.style.opacity = String(clamp((t - 0.4) / 0.6));
				spacer.style.width = `${(Math.max(extra, 0) * (1 - t)).toFixed(2)}px`;
			},
			() => {
				if (spacer.isConnected) {
					spacer.remove();
					tidy();
				}
				resetOverlay();
				phaseRef.current = "live";
				if (sessionRef.current) measureCapsule("jump");
				else hideCapsule();
			},
		);
	};

	const removeChip = (chip: HTMLElement) => {
		record("op");
		const label = chip.dataset.label ?? "";
		const parent = chip.parentNode;
		const index = parent
			? Array.prototype.indexOf.call(parent.childNodes, chip)
			: -1;
		chip.remove();
		if (parent && index >= 0) placeCaret(parent, index);
		lastCommitRef.current = null;
		tidy();
		syncIconSlots();
		emit();
		announce(`${label} removed`);
	};

	/** Puts text and chips at the selection, replacing it. */
	const insertSegments = (segments: Segment[]) => {
		const editable = editableRef.current;
		if (!editable) return;
		settleTransition();
		record("op");
		let range = selectionRange();
		if (!range) {
			editable.focus({ preventScroll: true });
			setCaretOffset(Number.MAX_SAFE_INTEGER);
			range = selectionRange();
		}
		if (!range) return;
		range.deleteContents();
		const fragment = buildFragment(segments);
		const last = fragment.lastChild;
		if (last) {
			range.insertNode(fragment);
			if (isText(last)) placeCaret(last, last.data.length);
			else if (last.parentNode) {
				placeCaret(
					last.parentNode,
					Array.from(last.parentNode.childNodes).indexOf(last as ChildNode) + 1,
				);
			}
		}
		lastCommitRef.current = null;
		closeMenu();
		syncIconSlots();
		tidy();
		emit();
	};

	const clear = () => {
		settleTransition();
		record("op");
		closeMenu();
		dismissedRef.current = null;
		lastCommitRef.current = null;
		render([]);
		if (document.activeElement === editableRef.current) setCaretOffset(0);
		emit();
	};

	const restore = (snap: Snapshot) => {
		settleTransition();
		closeMenu();
		render(snap.segments);
		if (snap.caret !== null && document.activeElement === editableRef.current) {
			setCaretOffset(snap.caret);
		}
		emit();
	};

	const undo = () => {
		const history = historyRef.current;
		const previous = history.past.pop();
		if (!previous) return;
		history.future.push(snapshot());
		history.lastKind = "op";
		restore(previous);
	};

	const redo = () => {
		const history = historyRef.current;
		const next = history.future.pop();
		if (!next) return;
		history.past.push(snapshot());
		history.lastKind = "op";
		restore(next);
	};

	const submit = () => {
		const value = toValue(read());
		if (!value.text.trim() && value.chips.length === 0) return;
		onSubmit?.(value);
		if (clearOnSubmit) clear();
	};

	const insertChipAt = (kindName: string, item: PromptChipItem) => {
		const editable = editableRef.current;
		if (!editable || disabled) return;
		settleTransition();
		closeMenu();
		if (!selectionRange()) {
			editable.focus({ preventScroll: true });
			setCaretOffset(Number.MAX_SAFE_INTEGER);
		}
		const range = selectionRange();
		if (!range) return;
		record("op");
		remember(kindName, [item]);
		range.deleteContents();
		const chip = createChip({
			kind: kindName,
			trigger:
				triggers.find((trigger) => trigger.kind === kindName)?.char ?? "",
			id: item.id,
			label: item.label,
			value: item.value ?? item.label,
			avatar: item.avatar,
			icon: item.icon,
		});
		range.insertNode(chip);
		const next = chip.nextSibling;
		if (isText(next) && /^[ \u00a0]/.test(next.data)) {
			placeCaret(next, 1);
		} else {
			const space = document.createTextNode(" ");
			chip.parentNode?.insertBefore(space, chip.nextSibling);
			placeCaret(space, 1);
		}
		syncIconSlots(true);
		tidy();
		lastCommitRef.current = chip;
		emit();
		chip.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: reducedMotion ? FADE_MS : 160,
			easing: "ease-out",
		});
	};

	useImperativeHandle(ref, () => ({
		focus: () => {
			editableRef.current?.focus({ preventScroll: true });
			setCaretOffset(Number.MAX_SAFE_INTEGER);
		},
		clear,
		insertChip: insertChipAt,
		getValue: () => toValue(read()),
	}));

	// --- Event handlers ------------------------------------------------------

	const afterInput = () => {
		lastCommitRef.current = null;
		tidy();
		syncIconSlots();
		emit();
		detect();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;
		// IME composition owns Enter, Tab, and the arrows.
		if (
			composingRef.current ||
			event.nativeEvent.isComposing ||
			event.keyCode === 229
		) {
			return;
		}
		touchRef.current = false;
		const mod = event.metaKey || event.ctrlKey;
		const key = event.key;
		if (mod && !event.altKey && (key === "z" || key === "Z" || key === "y")) {
			event.preventDefault();
			if (key === "y" || event.shiftKey) redo();
			else undo();
			return;
		}
		const state = menuRef.current;
		if (state) {
			const count = state.results.length;
			const down = key === "ArrowDown" || (event.ctrlKey && key === "n");
			const up = key === "ArrowUp" || (event.ctrlKey && key === "p");
			if (down || up) {
				event.preventDefault();
				if (count > 0) {
					setMenu({
						...state,
						active: (state.active + (down ? 1 : -1) + count) % count,
					});
				}
				return;
			}
			if ((key === "Enter" || key === "Tab") && !event.shiftKey && !mod) {
				event.preventDefault();
				const item = state.results[state.active];
				if (item) commit(item, false);
				// No match: the typed text stays as plain text.
				else if (!state.loading) dismiss();
				return;
			}
			if (key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				dismiss();
				return;
			}
			if (key === " " && !triggers[state.triggerIndex]?.allowSpaces) {
				const query = state.query.toLowerCase();
				const exact = state.results.filter(
					(item) =>
						item.label.toLowerCase() === query ||
						(item.value ?? "").toLowerCase() === query,
				);
				if (query && exact.length === 1) {
					event.preventDefault();
					commit(exact[0], false);
					return;
				}
				closeMenu();
			}
		}
		if (key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit();
			return;
		}
		if (key === "Backspace" && !event.altKey && !mod) {
			const chip = chipBeforeCaret(meltOnBackspace);
			if (!chip) return;
			event.preventDefault();
			if (meltOnBackspace) melt(chip);
			else removeChip(chip);
			return;
		}
		if (key === "Delete" && !event.altKey && !mod) {
			const chip = chipAfterCaret();
			if (!chip) return;
			event.preventDefault();
			removeChip(chip);
		}
	};

	const handleBeforeInput = (event: InputEvent) => {
		if (disabled) {
			event.preventDefault();
			return;
		}
		const type = event.inputType;
		if (type === "insertParagraph" || type === "insertLineBreak") {
			event.preventDefault();
			insertSegments([{ type: "text", text: "\n" }]);
			return;
		}
		if (type === "historyUndo" || type === "historyRedo") {
			event.preventDefault();
			if (type === "historyUndo") undo();
			else redo();
			return;
		}
		if (type.startsWith("format")) {
			event.preventDefault();
			return;
		}
		if (type === "insertFromDrop" || type.startsWith("insertFromPaste")) return;
		if (type.startsWith("delete")) record("delete");
		else if (type.startsWith("insert") && !composingRef.current) record("type");
	};

	const writeClipboard = (data: DataTransfer, segments: Segment[]) => {
		data.setData("text/plain", serialize(segments, "label"));
		data.setData(
			CLIPBOARD_TYPE,
			JSON.stringify(
				segments.map((segment) =>
					segment.type === "text"
						? segment
						: {
								type: "chip",
								kind: segment.kind,
								trigger: segment.trigger,
								id: segment.id,
								label: segment.label,
								value: segment.value,
								avatar: segment.avatar,
							},
				),
			),
		);
	};

	const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
		const range = selectionRange();
		if (!range || range.collapsed) return;
		event.preventDefault();
		writeClipboard(
			event.clipboardData,
			readSegments(range.cloneContents(), chipIconsRef.current),
		);
	};

	const handleCut = (event: ClipboardEvent<HTMLDivElement>) => {
		const range = selectionRange();
		if (!range || range.collapsed) return;
		event.preventDefault();
		if (disabled) return;
		writeClipboard(
			event.clipboardData,
			readSegments(range.cloneContents(), chipIconsRef.current),
		);
		record("op");
		range.deleteContents();
		closeMenu();
		tidy();
		syncIconSlots();
		emit();
	};

	/** Chips from our own clipboard type; anything else pastes as plain text. */
	const pastedSegments = (data: DataTransfer): Segment[] => {
		const json = data.getData(CLIPBOARD_TYPE);
		if (json) {
			try {
				const parsed = JSON.parse(json) as unknown;
				if (Array.isArray(parsed)) {
					const segments: PromptChipSegment[] = [];
					for (const entry of parsed) {
						if (entry?.type === "text" && typeof entry.text === "string") {
							segments.push({ type: "text", text: entry.text });
						} else if (
							entry?.type === "chip" &&
							typeof entry.id === "string" &&
							typeof entry.label === "string" &&
							typeof entry.kind === "string"
						) {
							const item = lookupItem(entry.kind, entry.id);
							segments.push({
								type: "chip",
								kind: entry.kind,
								trigger:
									typeof entry.trigger === "string" ? entry.trigger : undefined,
								id: entry.id,
								label: entry.label,
								value:
									typeof entry.value === "string" ? entry.value : undefined,
								avatar:
									typeof entry.avatar === "string"
										? entry.avatar
										: item?.avatar,
								icon: item?.icon,
							});
						}
					}
					return normalizeSegments(segments, triggers);
				}
			} catch {
				// Fall back to the plain text below.
			}
		}
		const text = data.getData("text/plain").replace(/\r\n?/g, "\n");
		return text ? [{ type: "text", text }] : [];
	};

	const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (disabled) return;
		insertSegments(pastedSegments(event.clipboardData));
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (disabled) return;
		const segments = pastedSegments(event.dataTransfer);
		const position = document.caretPositionFromPoint?.(
			event.clientX,
			event.clientY,
		);
		if (position && editableRef.current?.contains(position.offsetNode)) {
			editableRef.current.focus({ preventScroll: true });
			placeCaret(position.offsetNode, position.offset);
		}
		insertSegments(segments);
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		touchRef.current = event.pointerType === "touch";
		lastCommitRef.current = null;
	};

	// A click on a chip puts the caret beside it, on the nearer side.
	const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
		const chip = (event.target as Element).closest?.(
			'[data-slot="prompt-chip"]',
		);
		const editable = editableRef.current;
		if (!chip || !editable || disabled || chip.parentNode !== editable) return;
		event.preventDefault();
		editable.focus({ preventScroll: true });
		const rect = chip.getBoundingClientRect();
		const after = event.clientX > rect.left + rect.width / 2 !== isRtl();
		const index = Array.from(editable.childNodes).indexOf(chip as ChildNode);
		placeCaret(editable, index + (after ? 1 : 0));
	};

	const handleRowPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		// Keeps focus, and the caret, in the field.
		event.preventDefault();
		pointerTypeRef.current = event.pointerType;
	};

	const handleCompositionStart = () => {
		composingRef.current = true;
		record("type");
		hideGhost();
	};

	const handleCompositionEnd = () => {
		composingRef.current = false;
		afterInput();
	};

	const handleFocus = () => setFocused(true);

	const handleBlur = () => {
		setFocused(false);
		closeMenu();
	};

	// --- Effects -------------------------------------------------------------

	// Event listeners and timers call through refs to see the latest render.
	const handlers = useRef({
		beforeInput: handleBeforeInput,
		selectionChange: () => {},
		remeasure: () => {},
		position: () => {},
	});
	const positionPopover = () => {
		const list = listRef.current;
		const root = rootRef.current;
		const anchor = anchorRef.current;
		if (!list || !root || !anchor) return;
		const zoom = cssZoom(root);
		const rootRect = root.getBoundingClientRect();
		const width = list.offsetWidth * zoom;
		const height = list.offsetHeight * zoom;
		const viewportWidth = document.documentElement.clientWidth;
		const viewportHeight = window.innerHeight;
		const gap = POPOVER_GAP * zoom;
		const below = anchor.bottom + gap;
		const above = anchor.top - gap - height;
		const fitsBelow = below + height <= viewportHeight - VIEWPORT_PAD;
		const fitsAbove = above >= VIEWPORT_PAD;
		// Keep the side the list opened on while the query changes.
		let side = sideRef.current;
		if (!side || (side === "bottom" && !fitsBelow && fitsAbove)) {
			side = fitsBelow || !fitsAbove ? "bottom" : "top";
		}
		sideRef.current = side;
		const top = side === "bottom" ? below : above;
		const preferred = isRtl() ? anchor.right - width : anchor.left;
		const left = clamp(
			preferred,
			VIEWPORT_PAD,
			Math.max(VIEWPORT_PAD, viewportWidth - VIEWPORT_PAD - width),
		);
		list.style.left = `${(left - rootRect.left) / zoom}px`;
		list.style.top = `${(top - rootRect.top) / zoom}px`;
		list.dataset.side = side;
	};

	useLayoutEffect(() => {
		handlers.current = {
			beforeInput: handleBeforeInput,
			selectionChange: () => {
				if (composingRef.current) return;
				const session = sessionRef.current;
				if (!session) return;
				const caret = getCaret();
				if (caret?.node !== session.node || caret.offset !== session.end) {
					closeMenu();
				}
			},
			remeasure: () => {
				if (sessionRef.current && phaseRef.current === "live") {
					measureCapsule("jump");
					positionPopover();
				}
			},
			position: positionPopover,
		};
	});

	// Builds the field from its segments once mounted, so chips carry their
	// data and icons. The server already rendered the same markup.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mount only
	useLayoutEffect(() => {
		render(initial);
		const editable = editableRef.current;
		const onBeforeInput = (event: InputEvent) =>
			handlers.current.beforeInput(event);
		editable?.addEventListener("beforeinput", onBeforeInput);
		return () => {
			editable?.removeEventListener("beforeinput", onBeforeInput);
			transitionRef.current?.finish();
		};
	}, []);

	// A controlled value re-renders the field only when it differs from what
	// the field last reported.
	const controlledKey =
		valueProp === undefined
			? null
			: segmentsKey(normalizeSegments(valueProp, triggers));
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by content
	useLayoutEffect(() => {
		if (controlledKey === null || controlledKey === lastKeyRef.current) return;
		settleTransition();
		closeMenu();
		render(normalizeSegments(valueProp, triggers));
		lastKeyRef.current = controlledKey;
		setEmpty(controlledKey === "[]");
		if (document.activeElement === editableRef.current) {
			setCaretOffset(Number.MAX_SAFE_INTEGER);
		}
	}, [controlledKey]);

	// Listeners exist only while the field has focus.
	useEffect(() => {
		const editable = editableRef.current;
		if (!focused || !editable) return;
		const onSelectionChange = () => handlers.current.selectionChange();
		document.addEventListener("selectionchange", onSelectionChange);
		const observer = new ResizeObserver(() => handlers.current.remeasure());
		observer.observe(editable);
		return () => {
			document.removeEventListener("selectionchange", onSelectionChange);
			observer.disconnect();
		};
	}, [focused]);

	const open = menu !== null;
	useEffect(() => {
		if (!open) return;
		const onResize = () => handlers.current.remeasure();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [open]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follows the menu
	useLayoutEffect(() => {
		updateGhost();
		if (!menu) {
			highlightShownRef.current = false;
			return;
		}
		positionPopover();
		const row = rowRefs.current[menu.active];
		if (!row || menu.results.length === 0) {
			highlightShownRef.current = false;
			return;
		}
		if (!highlightShownRef.current || reducedMotion) {
			highlightY.jump(row.offsetTop);
			highlightH.jump(row.offsetHeight);
		} else {
			animate(highlightY, row.offsetTop, highlightSpring);
			animate(highlightH, row.offsetHeight, highlightSpring);
		}
		highlightShownRef.current = true;
	}, [menu]);

	// --- Render --------------------------------------------------------------

	const kind = kindFor(capsuleKind);
	const menuTrigger = menu ? triggers[menu.triggerIndex] : undefined;
	const menuKind = menuTrigger ? kindFor(menuTrigger.kind) : kind;
	const activeItem = menu?.results[menu.active];

	return (
		<LazyMotion features={domAnimation}>
			<div
				ref={rootRef}
				data-slot="prompt-chip-input"
				data-disabled={disabled || undefined}
				data-open={open || undefined}
				className={cn(
					"relative flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-3 pointer-coarse:text-base text-[15px] text-foreground leading-6 transition-[border-color,box-shadow] duration-150 has-[[data-slot=prompt-chip-input-editable]:focus-visible]:border-ring/60 has-[[data-slot=prompt-chip-input-editable]:focus-visible]:ring-3 has-[[data-slot=prompt-chip-input-editable]:focus-visible]:ring-ring/15 data-disabled:opacity-60",
					className,
				)}
				{...props}
			>
				<style href="tentui-prompt-chip-input" precedence="default">
					{STYLES}
				</style>
				<div data-slot="prompt-chip-input-field" className="relative">
					{/* Capsule and ghost text sit behind the transparent text layer. */}
					<div
						ref={layerRef}
						aria-hidden
						data-slot="prompt-chip-input-overlay"
						className="pointer-events-none absolute inset-0 overflow-hidden"
					>
						<m.span
							ref={boxRef}
							data-slot="prompt-chip-input-capsule"
							data-kind={capsuleKind}
							className="absolute top-0 left-0 overflow-hidden rounded-md opacity-0"
							style={{
								x: boxX,
								y: boxY,
								width: boxW,
								height: boxH,
								scaleX: boxScale,
								originX: boxOrigin,
							}}
						>
							<span
								ref={liveRef}
								data-slot="prompt-chip-input-capsule-live"
								className={cn(
									kind.className,
									"absolute inset-0 rounded-[inherit] bg-transparent",
								)}
							>
								<span className="absolute inset-0 rounded-[inherit] border border-current/35 bg-current/5" />
							</span>
							<span
								ref={solidRef}
								className={cn(
									"absolute inset-0 rounded-[inherit] opacity-0",
									kind.className,
								)}
							/>
							<span
								ref={typedRef}
								className="absolute top-0 left-0 whitespace-pre text-foreground"
							/>
							<span ref={labelRef} className="absolute inset-0" />
						</m.span>
						<span
							ref={ghostRef}
							hidden
							data-slot="prompt-chip-input-ghost"
							className="absolute top-0 left-0 whitespace-pre"
						>
							<span ref={ghostTextRef} className="text-foreground/40" />
							<span
								ref={spinnerRef}
								hidden
								className="ms-1 inline-block size-3 animate-spin rounded-full border-[1.5px] border-foreground/15 border-t-foreground/50 align-[-0.1em] motion-reduce:animate-none"
							/>
						</span>
					</div>
					{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: ARIA has no multiline combobox, so the textbox carries the combobox state screen readers follow. */}
					<div
						ref={editableRef}
						role="textbox"
						tabIndex={disabled ? undefined : 0}
						contentEditable={!disabled}
						suppressContentEditableWarning
						spellCheck
						aria-multiline
						aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? "Message")}
						aria-labelledby={ariaLabelledBy}
						aria-placeholder={placeholder}
						aria-disabled={disabled || undefined}
						aria-autocomplete="list"
						aria-expanded={open || undefined}
						aria-controls={open ? listId : undefined}
						aria-activedescendant={
							open && activeItem ? optionId(menu.active) : undefined
						}
						data-slot="prompt-chip-input-editable"
						className={cn(
							"relative min-h-12 overflow-y-auto whitespace-pre-wrap break-words outline-none [overflow-wrap:anywhere]",
							disabled && "cursor-not-allowed",
							editableClassName,
						)}
						style={{ maxHeight: `${maxRows * 1.5}rem` }}
						dangerouslySetInnerHTML={initialHtml}
						onKeyDown={handleKeyDown}
						onInput={() => {
							if (!composingRef.current) afterInput();
						}}
						onCompositionStart={handleCompositionStart}
						onCompositionEnd={handleCompositionEnd}
						onCopy={handleCopy}
						onCut={handleCut}
						onPaste={handlePaste}
						onDrop={handleDrop}
						onDragStart={(event) => event.preventDefault()}
						onPointerDown={handlePointerDown}
						onMouseDown={handleMouseDown}
						onScroll={() => handlers.current.remeasure()}
						onFocus={handleFocus}
						onBlur={handleBlur}
					/>
					{empty && placeholder ? (
						<span
							aria-hidden
							data-slot="prompt-chip-input-placeholder"
							className="pointer-events-none absolute inset-x-0 top-0 truncate text-muted-foreground"
						>
							{placeholder}
						</span>
					) : null}
				</div>
				{children}
				<AnimatePresence>
					{menu ? (
						<m.div
							key="list"
							ref={listRef}
							id={listId}
							role="listbox"
							aria-label={`${menuKind.label} suggestions`}
							data-slot="prompt-chip-input-list"
							initial={reducedMotion ? false : { opacity: 0, y: 4 }}
							animate={{
								opacity: 1,
								y: 0,
								transition: { duration: APPEAR_MS / 1000, ease: "easeOut" },
							}}
							exit={{
								opacity: 0,
								transition: { duration: reducedMotion ? 0 : 0.08 },
							}}
							// Keeps the fade on motion's frame loop, which video capture steps.
							onUpdate={() => {}}
							onPointerDown={handleRowPointerDown}
							onMouseDown={(event) => event.preventDefault()}
							className="absolute top-0 left-0 z-50 w-64 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-popover p-1 text-popover-foreground text-sm leading-5 shadow-sm"
						>
							<m.div
								aria-hidden
								data-slot="prompt-chip-input-highlight"
								className="absolute inset-x-1 top-0 rounded-lg bg-accent"
								style={{
									y: highlightY,
									height: highlightH,
									opacity: menu.results.length > 0 ? 1 : 0,
								}}
							/>
							{menu.results.map((item, index) => {
								const itemKind = menuTrigger
									? kindFor(menuTrigger.kind)
									: menuKind;
								return (
									<div
										key={item.id}
										ref={(node) => {
											rowRefs.current[index] = node;
										}}
										id={optionId(index)}
										role="option"
										tabIndex={-1}
										aria-selected={index === menu.active}
										data-active={index === menu.active || undefined}
										data-slot="prompt-chip-input-option"
										className="relative flex min-h-9 pointer-coarse:min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5"
										onPointerMove={(event) => {
											if (
												event.pointerType === "mouse" &&
												menuRef.current &&
												menuRef.current.active !== index
											) {
												setMenu({ ...menuRef.current, active: index });
											}
										}}
										onClick={() =>
											commit(item, pointerTypeRef.current === "touch")
										}
									>
										<ItemIcon
											spec={iconSpec(item, itemKind)}
											label={item.label}
											className={cn(
												"me-0 size-5 shrink-0 align-middle",
												itemKind.className,
												"bg-transparent font-normal",
											)}
											initialsClassName="text-[9px]"
										/>
										<span
											className={cn(
												"min-w-0 truncate font-medium",
												itemKind.showTrigger && "font-mono",
											)}
										>
											{menuTrigger && itemKind.showTrigger
												? menuTrigger.char + item.label
												: item.label}
										</span>
										{item.description ? (
											<span className="ms-auto shrink-0 truncate ps-2 text-muted-foreground text-xs">
												{item.description}
											</span>
										) : null}
									</div>
								);
							})}
							{menu.results.length === 0 ? (
								<div
									role="option"
									tabIndex={-1}
									aria-selected={false}
									aria-disabled
									data-slot="prompt-chip-input-empty"
									className="flex min-h-9 items-center px-2 py-1.5 text-muted-foreground"
								>
									{menu.loading ? "Searching…" : "No matches"}
								</div>
							) : null}
						</m.div>
					) : null}
				</AnimatePresence>
				<span aria-live="polite" aria-atomic className="sr-only">
					{announcement}
				</span>
				{iconSlots.map((slot) => createPortal(slot.icon, slot.el, slot.key))}
			</div>
		</LazyMotion>
	);
}

export default PromptChipInput;
