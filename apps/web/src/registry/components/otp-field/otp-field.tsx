"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { Check } from "lucide-react";
import {
	AnimatePresence,
	animate,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import {
	type ChangeEvent,
	type ClipboardEvent,
	Fragment,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type SyntheticEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

const riseSpring = { type: "spring", stiffness: 600, damping: 30 } as const;
const ringSpring = { type: "spring", stiffness: 500, damping: 40 } as const;

/** Ms between digits landing on a paste or autofill. */
const CASCADE_STAGGER_MS = 30;
/** Ms between slots popping on success. */
const SUCCESS_STAGGER_MS = 40;
/** Ms between digits dropping out, right to left, after an error. */
const DROP_STAGGER_MS = 30;
/** Ms an error shows before the code clears. */
const ERROR_CLEAR_MS = 600;
/** Minimum ms between typing and delete sounds and haptics. */
const CUE_THROTTLE_MS = 35;
/** Volume of the delete click; typed digits play at the tiks default of 0.3. */
const DELETE_VOLUME = 0.15;
/** Px offsets of the error shake, played over 400 ms. */
const SHAKE = [0, -8, 8, -6, 6, -3, 0];

// Hoisted and deduplicated by React, so many fields share one sheet. The
// selection rule outranks a global `::selection` color on the hidden text.
const STYLES =
	"@keyframes otp-field-caret-blink{0%,70%,100%{opacity:1}20%,50%{opacity:0}}" +
	"[data-slot=otp-field-input]::selection{background:transparent;color:transparent;-webkit-text-fill-color:transparent}";

/** Whitespace and dashes that pasted or autofilled codes often carry. */
const SEPARATORS = /[\s\-‐‑‒–—−]/g;

const patterns = {
	digits: /^\d$/,
	alphanumeric: /^[a-z\d]$/i,
} as const;

const sizes = {
	sm: {
		slot: "size-8 rounded-md text-sm",
		gap: "gap-1.5",
		caret: "h-3.5",
		separator: "w-2",
		check: "size-4",
	},
	md: {
		slot: "size-10 rounded-lg text-lg",
		gap: "gap-2",
		caret: "h-5",
		separator: "w-2.5",
		check: "size-5",
	},
	lg: {
		slot: "size-12 rounded-lg text-2xl",
		gap: "gap-2.5",
		caret: "h-6",
		separator: "w-3",
		check: "size-6",
	},
} as const;

const statusSlot = {
	idle: "",
	verifying: "text-muted-foreground",
	success: "border-success/50 bg-success/10 text-success dark:bg-success/15",
	error:
		"border-destructive/60 bg-destructive/5 text-destructive dark:bg-destructive/10",
} as const;

const announcements = {
	idle: "",
	verifying: "Verifying code",
	success: "Code verified",
	error: "Incorrect code, try again",
} as const;

export type OTPFieldStatus = keyof typeof announcements;
export type OTPFieldPattern = keyof typeof patterns | RegExp;

/** How the digits of the latest value arrived. */
type EntryMode = "type" | "cascade" | "drop";

type CharMotion = {
	reduce: boolean;
	/** Seconds before an entering digit rises. */
	delay: number;
	drop: boolean;
	/** Seconds before an exiting digit drops. */
	dropDelay: number;
};

const charVariants: Variants = {
	hidden: ({ reduce }: CharMotion) =>
		reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.85 },
	shown: ({ reduce, delay }: CharMotion) => ({
		opacity: 1,
		y: 0,
		scale: 1,
		transition: reduce ? { duration: 0 } : { ...riseSpring, delay },
	}),
	exit: ({ reduce, drop, dropDelay }: CharMotion) => {
		if (reduce) return { opacity: 0, transition: { duration: 0 } };
		if (drop) {
			return {
				opacity: 0,
				y: 10,
				transition: {
					duration: 0.2,
					ease: [0.23, 1, 0.32, 1],
					delay: dropDelay,
				},
			};
		}
		return {
			opacity: 0,
			scale: 0.85,
			transition: { duration: 0.1, ease: "easeOut" },
		};
	},
};

export interface OTPFieldProps {
	/** Controlled value. Characters outside `pattern` are dropped for display. */
	value?: string;
	/** Initial value when uncontrolled. */
	defaultValue?: string;
	/** Called on every edit: typing, deleting, pasting, autofill, and the clear after an error. */
	onValueChange?: (value: string) => void;
	/** Called once each time the code becomes complete. */
	onComplete?: (value: string) => void;
	/** Number of slots. */
	length?: number;
	/** Slots per group, e.g. `[3, 3]`, with a separator between groups. Must add up to `length`. */
	groups?: number[];
	/** Characters a slot accepts: `"digits"`, `"alphanumeric"`, or a RegExp that matches one allowed character. */
	pattern?: OTPFieldPattern;
	/** `verifying` shimmers and pauses typing, `success` locks the code, and `error` shakes and clears it. */
	status?: OTPFieldStatus;
	/** Clear the code and refocus the first slot 600 ms after `status` turns `error`. */
	clearOnError?: boolean;
	/** Show a dot in place of each character. */
	mask?: boolean;
	disabled?: boolean;
	autoFocus?: boolean;
	/** Submits the code with a native form through a hidden input. */
	name?: string;
	/** Id of the input, for a `<label htmlFor>`. */
	id?: string;
	size?: keyof typeof sizes;
	/** Play a click per character, a pop on paste, and a tone on success and error. */
	sound?: boolean;
	/** Trigger haptics on supported devices. */
	haptics?: boolean;
	className?: string;
	/** Classes for every slot. */
	slotClassName?: string;
	/** Accessible name for the input. Defaults to "One-time code" unless `aria-labelledby` is set. */
	"aria-label"?: string;
	"aria-labelledby"?: string;
	/** Id of helper or error text read with the input. */
	"aria-describedby"?: string;
}

function isAllowed(char: string, pattern: OTPFieldPattern) {
	const test = typeof pattern === "string" ? patterns[pattern] : pattern;
	// A global or sticky RegExp keeps state between tests.
	test.lastIndex = 0;
	return test.test(char);
}

/** Drops whitespace and dashes, keeps allowed characters, and truncates. */
function sanitize(text: string, pattern: OTPFieldPattern, length: number) {
	return Array.from(text.replace(SEPARATORS, ""))
		.filter((char) => isAllowed(char, pattern))
		.slice(0, length)
		.join("");
}

/** Indexes of the last slot in every group but the final one. */
function groupEnds(groups: number[] | undefined, length: number) {
	const ends = new Set<number>();
	if (!groups || groups.length < 2) return ends;
	const valid =
		groups.every((size) => Number.isInteger(size) && size > 0) &&
		groups.reduce((total, size) => total + size, 0) === length;
	if (!valid) return ends;
	let total = 0;
	for (const size of groups.slice(0, -1)) {
		total += size;
		ends.add(total - 1);
	}
	return ends;
}

/** Selects the character in a filled slot so typing replaces it, or puts a caret in an empty one. */
function selectSlot(input: HTMLInputElement, index: number, filled: number) {
	if (document.activeElement !== input) return;
	const end = index < filled ? index + 1 : index;
	if (input.selectionStart !== index || input.selectionEnd !== end) {
		input.setSelectionRange(index, end);
	}
}

export function OTPField({
	value: valueProp,
	defaultValue = "",
	onValueChange,
	onComplete,
	length: lengthProp = 6,
	groups,
	pattern = "digits",
	status = "idle",
	clearOnError = true,
	mask = false,
	disabled = false,
	autoFocus = false,
	name,
	id,
	size = "md",
	sound = true,
	haptics = true,
	className,
	slotClassName,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	"aria-describedby": ariaDescribedBy,
}: OTPFieldProps) {
	const length = Math.max(1, Math.round(lengthProp));
	const last = length - 1;
	const locked = status === "success" || status === "verifying";
	const interactive = !disabled && !locked;

	const controlled = valueProp !== undefined;
	const [internalValue, setInternalValue] = useState(() =>
		sanitize(defaultValue, pattern, length),
	);
	const value = sanitize(
		controlled ? valueProp : internalValue,
		pattern,
		length,
	);

	const [caret, setCaret] = useState(0);
	const [focused, setFocused] = useState(false);
	const [entry, setEntry] = useState<{ value: string; mode: EntryMode }>({
		value,
		mode: "type",
	});
	const [announcement, setAnnouncement] = useState("");

	// The caret never sits past the first empty slot.
	const active = Math.min(caret, value.length, last);
	// A value from props, not from input, enters without a cascade.
	const entryMode = entry.value === value ? entry.mode : "type";

	const shouldReduceMotion = useReducedMotion() ?? false;
	const { trigger: haptic } = useWebHaptics();
	const {
		click: playClick,
		pop: playPop,
		success: playSuccess,
		error: playError,
	} = useTiks({
		// Sound stays on under reduced motion; only movement is reduced.
		respectReducedMotion: false,
	});
	const { click: playDeleteClick } = useTiks({
		respectReducedMotion: false,
		volume: DELETE_VOLUME,
	});

	const generatedId = useId();
	const inputId = id ?? `${generatedId}-input`;
	const ringLayoutId = `${generatedId}-ring`;

	const inputRef = useRef<HTMLInputElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
	const valueRef = useRef(value);
	const activeRef = useRef(active);
	const completedRef = useRef<string | null>(
		value.length === length ? value : null,
	);
	const lastCueAtRef = useRef(Number.NEGATIVE_INFINITY);
	const pointerRef = useRef(false);
	const pointerSlotRef = useRef<number | null>(null);
	const statusRef = useRef(status);
	const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useLayoutEffect(() => {
		valueRef.current = value;
		activeRef.current = active;
		if (value.length < length) completedRef.current = null;
	});

	// Keep the native selection on the active slot after every render.
	useLayoutEffect(() => {
		const input = inputRef.current;
		if (focused && input) selectSlot(input, active, value.length);
	}, [active, focused, value.length]);

	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);

	const throttled = () => {
		const now = performance.now();
		if (now - lastCueAtRef.current < CUE_THROTTLE_MS) return true;
		lastCueAtRef.current = now;
		return false;
	};

	const typeCue = () => {
		if (throttled()) return;
		if (sound) playClick();
		if (haptics) void haptic("selection");
	};

	const deleteCue = () => {
		if (throttled()) return;
		if (sound) playDeleteClick();
		if (haptics) void haptic("selection");
	};

	const fillCue = () => {
		lastCueAtRef.current = performance.now();
		if (sound) playPop();
		if (haptics) void haptic("light");
	};

	// A rejected character is felt, not heard.
	const rejectCue = () => {
		if (throttled()) return;
		if (haptics) void haptic("soft");
	};

	const cancelClear = () => {
		if (clearTimerRef.current === null) return;
		clearTimeout(clearTimerRef.current);
		clearTimerRef.current = null;
	};

	/** Moves the caret, clamped to the first empty slot. */
	const moveCaret = (index: number) => {
		const next = Math.max(0, Math.min(index, valueRef.current.length, last));
		activeRef.current = next;
		setCaret(next);
		return next;
	};

	/** Re-applies the selection once React restores the input's value. */
	const restoreSelection = (input: HTMLInputElement) => {
		queueMicrotask(() =>
			selectSlot(input, activeRef.current, valueRef.current.length),
		);
	};

	const emit = (next: string, mode: EntryMode) => {
		if (next === valueRef.current) return false;
		cancelClear();
		valueRef.current = next;
		setEntry({ value: next, mode });
		if (!controlled) setInternalValue(next);
		onValueChange?.(next);
		if (next.length < length) {
			completedRef.current = null;
		} else if (completedRef.current !== next) {
			completedRef.current = next;
			onComplete?.(next);
		}
		return true;
	};

	const typeChar = (char: string) => {
		if (!isAllowed(char, pattern)) {
			rejectCue();
			return;
		}
		const current = valueRef.current;
		const index = activeRef.current;
		emit(current.slice(0, index) + char + current.slice(index + 1), "type");
		typeCue();
		moveCaret(index + 1);
	};

	/** Fills from the first slot, as paste and autofill do. */
	const fill = (text: string) => {
		const next = sanitize(text, pattern, length);
		if (next === "") {
			rejectCue();
			return;
		}
		if (emit(next, "cascade")) fillCue();
		moveCaret(next.length);
	};

	/** Clears the selected slot, or the one before an empty caret. */
	const deleteBackward = () => {
		const current = valueRef.current;
		const index = activeRef.current;
		const at = index < current.length ? index : index - 1;
		if (at < 0) return;
		emit(current.slice(0, at) + current.slice(at + 1), "type");
		deleteCue();
		moveCaret(at);
	};

	const deleteForward = () => {
		const current = valueRef.current;
		const index = activeRef.current;
		if (index >= current.length) return;
		emit(current.slice(0, index) + current.slice(index + 1), "type");
		deleteCue();
		moveCaret(index);
	};

	const slotAt = (clientX: number) => {
		let nearest = 0;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (let index = 0; index < length; index++) {
			const slot = slotRefs.current[index];
			if (!slot) continue;
			const rect = slot.getBoundingClientRect();
			const distance = Math.max(rect.left - clientX, clientX - rect.right, 0);
			if (distance < nearestDistance) {
				nearest = index;
				nearestDistance = distance;
			}
		}
		return nearest;
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		restoreSelection(input);
		if (!interactive) return;
		const native = event.nativeEvent as InputEvent;
		const inputType = native.inputType ?? "";
		const data = native.data ?? "";

		// Backspace from a virtual keyboard that skips `keydown`.
		if (inputType.startsWith("delete")) {
			if (inputType.endsWith("Forward")) deleteForward();
			else deleteBackward();
			return;
		}
		if (inputType === "insertText" && Array.from(data).length === 1) {
			typeChar(data);
			return;
		}
		// An IME composes in place, so take what the field now holds.
		if (inputType === "insertCompositionText") {
			const next = sanitize(input.value, pattern, length);
			if (emit(next, "type")) typeCue();
			moveCaret(next.length);
			return;
		}
		// Paste without a clipboard event, drop, SMS and password manager
		// autofill, and multi-character inserts all fill from the start.
		fill(data || input.value);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		pointerRef.current = false;
		if (disabled) return;
		const index = activeRef.current;
		switch (event.key) {
			case "ArrowLeft":
				event.preventDefault();
				if (interactive) moveCaret(index - 1);
				return;
			case "ArrowRight":
				event.preventDefault();
				if (interactive) moveCaret(index + 1);
				return;
			case "Home":
			case "ArrowUp":
				event.preventDefault();
				if (interactive) moveCaret(0);
				return;
			case "End":
			case "ArrowDown":
				event.preventDefault();
				if (interactive) moveCaret(length);
				return;
			case "Backspace":
				event.preventDefault();
				if (interactive) deleteBackward();
				return;
			case "Delete":
				event.preventDefault();
				if (interactive) deleteForward();
				return;
		}
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		if (interactive) fill(event.clipboardData.getData("text"));
	};

	// The browser places its own caret by the invisible text, so a tap or
	// click picks the slot under the pointer instead.
	const handlePointerDown = (event: PointerEvent<HTMLInputElement>) => {
		pointerRef.current = true;
		pointerSlotRef.current = slotAt(event.clientX);
	};

	const handleClick = (event: MouseEvent<HTMLInputElement>) => {
		pointerRef.current = false;
		pointerSlotRef.current = null;
		if (!interactive) return;
		const index = moveCaret(slotAt(event.clientX));
		selectSlot(event.currentTarget, index, valueRef.current.length);
	};

	// Anything else that moves the selection, like select-all or a long
	// press, snaps back to a slot. React can report a selection read before
	// a key handler moved the caret, so check once the frame has settled.
	const handleSelect = (event: SyntheticEvent<HTMLInputElement>) => {
		if (pointerRef.current) return;
		const input = event.currentTarget;
		requestAnimationFrame(() => {
			if (pointerRef.current || document.activeElement !== input) return;
			const filled = valueRef.current.length;
			const index = activeRef.current;
			const end = index < filled ? index + 1 : index;
			if (input.selectionStart === index && input.selectionEnd === end) return;
			selectSlot(input, moveCaret(input.selectionStart ?? filled), filled);
		});
	};

	const handleFocus = () => {
		setFocused(true);
		moveCaret(pointerSlotRef.current ?? valueRef.current.length);
	};

	const handleBlur = () => {
		setFocused(false);
		pointerRef.current = false;
		pointerSlotRef.current = null;
	};

	const clearAfterError = () => {
		clearTimerRef.current = null;
		emit("", "drop");
		moveCaret(0);
		if (!disabled) inputRef.current?.focus({ preventScroll: true });
	};

	const enterStatus = (next: OTPFieldStatus) => {
		setAnnouncement(announcements[next]);
		if (disabled) return;
		if (next === "success") {
			if (sound) playSuccess();
			if (haptics) void haptic("success");
			if (shouldReduceMotion) return;
			slotRefs.current.slice(0, length).forEach((slot, index) => {
				if (!slot) return;
				animate(
					slot,
					{ scale: [1, 1.06, 1] },
					{
						duration: 0.3,
						delay: (index * SUCCESS_STAGGER_MS) / 1000,
						ease: "easeOut",
					},
				);
			});
		} else if (next === "error") {
			if (sound) playError();
			if (haptics) void haptic("error");
			if (!shouldReduceMotion && rowRef.current) {
				animate(
					rowRef.current,
					{ x: SHAKE },
					{ duration: 0.4, ease: "easeOut" },
				);
			}
			if (clearOnError) {
				clearTimerRef.current = setTimeout(
					() => clearAfterErrorRef.current(),
					ERROR_CLEAR_MS,
				);
			}
		}
	};

	// Timers and effects call through refs so they always see the latest props.
	const enterStatusRef = useRef(enterStatus);
	const clearAfterErrorRef = useRef(clearAfterError);
	useLayoutEffect(() => {
		enterStatusRef.current = enterStatus;
		clearAfterErrorRef.current = clearAfterError;
	});

	// Status cues play on a change, never for the status a field mounts with.
	useEffect(() => {
		if (statusRef.current === status) return;
		statusRef.current = status;
		enterStatusRef.current(status);
		return () => {
			if (clearTimerRef.current === null) return;
			clearTimeout(clearTimerRef.current);
			clearTimerRef.current = null;
		};
	}, [status]);

	const sizeStyle = sizes[size];
	const ends = groupEnds(groups, length);
	const chars = Array.from(value);
	const showCaret = focused && interactive;

	return (
		<div
			dir="ltr"
			data-slot="otp-field"
			data-status={status}
			data-size={size}
			data-complete={value.length === length || undefined}
			data-disabled={disabled || undefined}
			className={cn(
				"relative inline-flex w-fit data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
		>
			<style href="tentui-otp-field" precedence="default">
				{STYLES}
			</style>
			<div
				ref={rowRef}
				data-slot="otp-field-row"
				className={cn("relative flex items-center", sizeStyle.gap)}
			>
				{Array.from({ length }, (_, index) => {
					const char = chars[index];
					const isActive = showCaret && index === active;
					const custom: CharMotion = {
						reduce: shouldReduceMotion,
						delay:
							entryMode === "cascade" ? (index * CASCADE_STAGGER_MS) / 1000 : 0,
						drop: entryMode === "drop",
						dropDelay: ((last - index) * DROP_STAGGER_MS) / 1000,
					};
					return (
						<Fragment key={index}>
							<div
								ref={(node) => {
									slotRefs.current[index] = node;
								}}
								aria-hidden
								data-slot="otp-field-slot"
								data-active={isActive || undefined}
								data-filled={char !== undefined || undefined}
								className={cn(
									"relative flex shrink-0 items-center justify-center border border-input bg-background font-medium text-foreground tabular-nums shadow-xs transition-[color,background-color,border-color] duration-200 motion-reduce:transition-none dark:bg-input/30",
									sizeStyle.slot,
									statusSlot[status],
									slotClassName,
								)}
							>
								<AnimatePresence initial={false} custom={custom}>
									{char === undefined ? null : (
										<motion.span
											key={char}
											custom={custom}
											variants={charVariants}
											initial="hidden"
											animate="shown"
											exit="exit"
											className="absolute inset-0 grid place-items-center"
										>
											{mask ? (
												<span className="size-[0.4em] rounded-full bg-current" />
											) : (
												char
											)}
										</motion.span>
									)}
								</AnimatePresence>
								{isActive && char === undefined ? (
									<span
										data-slot="otp-field-caret"
										className={cn(
											"pointer-events-none absolute w-0.5 animate-[otp-field-caret-blink_1.2s_ease-out_infinite] rounded-full bg-foreground motion-reduce:animate-none",
											sizeStyle.caret,
										)}
									/>
								) : null}
								{isActive ? (
									<motion.span
										layoutId={ringLayoutId}
										transition={
											shouldReduceMotion ? { duration: 0 } : ringSpring
										}
										data-slot="otp-field-ring"
										className={cn(
											"pointer-events-none absolute -inset-px rounded-[inherit] border border-ring ring-3 ring-ring/50",
											status === "error" &&
												"border-destructive ring-destructive/20 dark:ring-destructive/40",
										)}
									/>
								) : null}
								{status === "verifying" && !shouldReduceMotion ? (
									<span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
										<motion.span
											data-slot="otp-field-shimmer"
											className="absolute inset-y-0 -start-full w-full bg-linear-to-r from-transparent via-foreground/10 to-transparent"
											initial={{ x: "0%" }}
											animate={{ x: "200%" }}
											transition={{
												duration: 0.9,
												ease: "easeInOut",
												repeat: Number.POSITIVE_INFINITY,
												repeatDelay: 0.4,
												delay: index * 0.07,
											}}
										/>
									</span>
								) : null}
							</div>
							{ends.has(index) ? (
								<span
									aria-hidden
									data-slot="otp-field-separator"
									className={cn(
										"h-0.5 shrink-0 rounded-full bg-border",
										sizeStyle.separator,
									)}
								/>
							) : null}
						</Fragment>
					);
				})}
				<input
					ref={inputRef}
					id={inputId}
					type="text"
					inputMode={pattern === "digits" ? "numeric" : "text"}
					autoComplete="one-time-code"
					autoCorrect="off"
					autoCapitalize="off"
					spellCheck={false}
					aria-label={
						ariaLabelledBy ? ariaLabel : (ariaLabel ?? "One-time code")
					}
					aria-labelledby={ariaLabelledBy}
					aria-describedby={ariaDescribedBy}
					aria-invalid={status === "error" || undefined}
					disabled={disabled}
					readOnly={locked}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					onSelect={handleSelect}
					onPointerDown={handlePointerDown}
					onPointerCancel={() => {
						pointerRef.current = false;
					}}
					onClick={handleClick}
					onFocus={handleFocus}
					onBlur={handleBlur}
					data-slot="otp-field-input"
					className={cn(
						// 16px text keeps iOS from zooming in on focus. The text, caret,
						// and autofill tint stay invisible over the slots.
						"absolute inset-0 size-full min-w-0 cursor-text bg-transparent text-base text-transparent caret-transparent outline-none disabled:cursor-not-allowed autofill:[transition:background-color_0s_600000s]",
						mask && "[-webkit-text-security:disc]",
						locked && "cursor-default",
					)}
				/>
			</div>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-y-0 start-full ms-2.5 flex items-center text-success"
			>
				<AnimatePresence initial={false}>
					{status === "success" ? (
						<motion.span
							key="check"
							data-slot="otp-field-check"
							initial={
								shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }
							}
							animate={{
								opacity: 1,
								scale: 1,
								transition: shouldReduceMotion
									? { duration: 0 }
									: {
											...riseSpring,
											delay: (length * SUCCESS_STAGGER_MS) / 1000,
										},
							}}
							exit={{
								opacity: 0,
								transition: { duration: shouldReduceMotion ? 0 : 0.15 },
							}}
							className="grid place-items-center"
						>
							<Check className={sizeStyle.check} strokeWidth={2.5} />
						</motion.span>
					) : null}
				</AnimatePresence>
			</span>
			{name ? (
				<input type="hidden" name={name} value={value} disabled={disabled} />
			) : null}
			<span aria-live="polite" aria-atomic className="sr-only">
				{announcement}
			</span>
		</div>
	);
}

export default OTPField;
