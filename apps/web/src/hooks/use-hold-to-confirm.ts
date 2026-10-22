"use client";

import {
	type AnimationPlaybackControls,
	animate,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
} from "motion/react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";

export type HoldState = "idle" | "holding" | "confirmed";

export type UseHoldToConfirmOptions = {
	/** How long the button must be held before confirming, in milliseconds. */
	holdDuration?: number;
	/** Delay before returning to idle after confirming. Pass `false` to stay confirmed. */
	resetDelay?: number | false;
	/** Called once the hold completes. */
	onConfirm?: () => void;
	/** Called with the reached progress (0-1) when the hold is released early. */
	onCancel?: (progress: number) => void;
	/** Play a rising tone while holding and a chime on confirm. */
	sound?: boolean;
	/** Tick haptics while holding and a success pattern on confirm. */
	haptics?: boolean;
	/** Ignore all hold input. */
	disabled?: boolean;
};

const TICK_COUNT = 10;
// The riser climbs two octaves from G3 to G5, then resolves up to a C6 chime.
const MIN_FREQUENCY = 196;
const MAX_FREQUENCY = 784;
const CHIME_FREQUENCIES = [1046.5, 1568];

let audioContext: AudioContext | null = null;

function getAudioContext() {
	if (typeof window === "undefined" || !("AudioContext" in window)) {
		return null;
	}

	audioContext ??= new AudioContext();
	if (audioContext.state === "suspended") void audioContext.resume();
	return audioContext;
}

function frequencyAt(progress: number) {
	return MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** progress;
}

function holdParam(param: AudioParam, time: number) {
	if (typeof param.cancelAndHoldAtTime === "function") {
		param.cancelAndHoldAtTime(time);
		return;
	}

	const value = param.value;
	param.cancelScheduledValues(time);
	param.setValueAtTime(value, time);
}

type Riser = {
	release: () => void;
	finish: () => void;
};

function startRiser(progress: number, remaining: number): Riser | null {
	const ctx = getAudioContext();
	if (!ctx) return null;

	const now = ctx.currentTime;
	const oscillator = ctx.createOscillator();
	const filter = ctx.createBiquadFilter();
	const gain = ctx.createGain();

	oscillator.type = "triangle";
	oscillator.frequency.setValueAtTime(frequencyAt(progress), now);
	oscillator.frequency.exponentialRampToValueAtTime(
		MAX_FREQUENCY,
		now + Math.max(remaining, 0.01),
	);

	filter.type = "lowpass";
	filter.frequency.value = 2400;

	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(0.05, now + 0.05);

	oscillator.connect(filter).connect(gain).connect(ctx.destination);
	oscillator.start(now);

	let stopped = false;
	const stop = (fade: number, drop: boolean) => {
		if (stopped) return;
		stopped = true;

		const time = ctx.currentTime;
		holdParam(oscillator.frequency, time);
		holdParam(gain.gain, time);
		if (drop) {
			oscillator.frequency.exponentialRampToValueAtTime(
				MIN_FREQUENCY,
				time + fade,
			);
		}
		gain.gain.linearRampToValueAtTime(0, time + fade);
		oscillator.stop(time + fade + 0.02);
	};

	return {
		release: () => stop(0.18, true),
		finish: () => stop(0.04, false),
	};
}

function playChime() {
	const ctx = getAudioContext();
	if (!ctx) return;

	const now = ctx.currentTime;
	CHIME_FREQUENCIES.forEach((frequency, index) => {
		const start = now + index * 0.08;
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();

		oscillator.type = "sine";
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0, start);
		gain.gain.linearRampToValueAtTime(0.08, start + 0.005);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);

		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(start);
		oscillator.stop(start + 0.65);
	});
}

function isHoldKey(key: string) {
	return key === " " || key === "Enter";
}

export function useHoldToConfirm({
	holdDuration = 1500,
	resetDelay = 2000,
	onConfirm,
	onCancel,
	sound = true,
	haptics = true,
	disabled = false,
}: UseHoldToConfirmOptions = {}) {
	const [state, setState] = useState<HoldState>("idle");
	const stateRef = useRef<HoldState>("idle");
	const progress = useMotionValue(0);
	const fillOpacity = useMotionValue(1);
	const animationRef = useRef<AnimationPlaybackControls | null>(null);
	const riserRef = useRef<Riser | null>(null);
	const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastTickRef = useRef(0);
	const callbacksRef = useRef({ onConfirm, onCancel });
	const { trigger: haptic } = useWebHaptics();

	// Sound follows the same reduced-motion opt-out as the other TentUI sounds.
	const shouldReduceMotion = useReducedMotion();
	const soundEnabled = sound && !shouldReduceMotion;

	useEffect(() => {
		callbacksRef.current = { onConfirm, onCancel };
	}, [onConfirm, onCancel]);

	const updateState = useCallback((next: HoldState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const clearResetTimeout = useCallback(() => {
		if (resetTimeoutRef.current) {
			clearTimeout(resetTimeoutRef.current);
			resetTimeoutRef.current = null;
		}
	}, []);

	const reset = useCallback(() => {
		clearResetTimeout();
		animationRef.current?.stop();

		if (stateRef.current !== "confirmed") {
			progress.set(0);
			updateState("idle");
			return;
		}

		animationRef.current = animate(fillOpacity, 0, {
			duration: 0.2,
			ease: [0.23, 1, 0.32, 1],
			onComplete: () => {
				progress.set(0);
				fillOpacity.set(1);
				updateState("idle");
			},
		});
	}, [clearResetTimeout, fillOpacity, progress, updateState]);

	const confirm = useCallback(() => {
		updateState("confirmed");
		progress.set(1);

		riserRef.current?.finish();
		riserRef.current = null;
		if (soundEnabled) playChime();
		if (haptics) void haptic("success");

		callbacksRef.current.onConfirm?.();

		if (resetDelay !== false) {
			resetTimeoutRef.current = setTimeout(reset, resetDelay);
		}
	}, [haptic, haptics, progress, reset, resetDelay, soundEnabled, updateState]);

	const start = useCallback(() => {
		if (disabled || stateRef.current !== "idle") return;

		updateState("holding");
		const from = Math.min(Math.max(progress.get(), 0), 1);
		const remaining = (holdDuration / 1000) * (1 - from);
		lastTickRef.current = Math.floor(from * TICK_COUNT);

		animationRef.current?.stop();
		animationRef.current = animate(progress, 1, {
			duration: remaining,
			ease: "linear",
			onComplete: confirm,
		});

		if (soundEnabled) riserRef.current = startRiser(from, remaining);
		if (haptics) void haptic([{ duration: 10, intensity: 0.4 }]);
	}, [
		confirm,
		disabled,
		haptic,
		haptics,
		holdDuration,
		progress,
		soundEnabled,
		updateState,
	]);

	const cancel = useCallback(() => {
		if (stateRef.current !== "holding") return;

		updateState("idle");
		const reached = progress.get();

		animationRef.current?.stop();
		animationRef.current = animate(
			progress,
			0,
			shouldReduceMotion
				? { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
				: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
		);

		riserRef.current?.release();
		riserRef.current = null;

		callbacksRef.current.onCancel?.(reached);
	}, [progress, shouldReduceMotion, updateState]);

	// Tick a little harder at each step so the phone feels the hold building.
	useMotionValueEvent(progress, "change", (value) => {
		if (!haptics || stateRef.current !== "holding") return;

		const tick = Math.floor(value * TICK_COUNT);
		if (tick > lastTickRef.current && tick < TICK_COUNT) {
			lastTickRef.current = tick;
			void haptic([{ duration: 8, intensity: 0.3 + 0.6 * value }]);
		}
	});

	useEffect(() => {
		if (disabled) cancel();
	}, [disabled, cancel]);

	useEffect(() => {
		return () => {
			clearResetTimeout();
			animationRef.current?.stop();
			riserRef.current?.finish();
		};
	}, [clearResetTimeout]);

	const handlers = {
		onPointerDown: (event: PointerEvent<HTMLElement>) => {
			if (event.button !== 0) return;
			event.currentTarget.setPointerCapture(event.pointerId);
			start();
		},
		onPointerUp: cancel,
		onPointerCancel: cancel,
		onLostPointerCapture: cancel,
		onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
			if (!isHoldKey(event.key)) return;
			event.preventDefault();
			if (!event.repeat) start();
		},
		onKeyUp: (event: KeyboardEvent<HTMLElement>) => {
			if (isHoldKey(event.key)) cancel();
		},
		onBlur: cancel,
		onContextMenu: (event: { preventDefault: () => void }) => {
			event.preventDefault();
		},
	};

	return { state, progress, fillOpacity, handlers, reset } as const;
}
