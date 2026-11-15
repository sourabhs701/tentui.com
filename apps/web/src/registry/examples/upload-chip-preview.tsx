"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import {
	UploadChip,
	type UploadChipFile,
} from "@/registry/components/upload-chip/upload-chip";

// One scripted run, in ms: a file is dragged in and dropped, fills, and
// settles; two more join the deck, which fans out once and folds back.
const DRAG_IN = [500, 1100];
const DROP_AT = 1100;
/** Progress reports for the first file, as jumpy as a real upload. */
const REPORTS: Array<[number, number]> = [
	[1250, 0.06],
	[1420, 0.19],
	[1560, 0.27],
	[1820, 0.44],
	[2000, 0.52],
	[2240, 0.68],
	[2420, 0.79],
	[2600, 0.9],
	[2760, 1],
];
const SECOND_DRAG = [3500, 3900];
const SECOND_DROP = 3900;
const FAN_OPEN = 5000;
const FAN_CLOSE = 6000;
const RESET_AT = 6800;
const LOOP_AT = 7600;

function fileAt(
	elapsed: number,
	id: string,
	name: string,
	size: number,
	type: string,
	from: number,
	to: number,
): UploadChipFile {
	const t = Math.min(Math.max((elapsed - from) / (to - from), 0), 1);
	// Quick uploads still report in steps.
	const progress = Math.round(t * 8) / 8;
	return {
		id,
		name,
		size,
		type,
		progress,
		status: elapsed >= to ? "done" : "uploading",
	};
}

/** The files on screen `elapsed` ms into a run. */
export function filesAt(elapsed: number, run: number): UploadChipFile[] {
	if (elapsed < DROP_AT || elapsed >= RESET_AT) return [];
	const report = REPORTS.filter(([at]) => elapsed >= at).pop();
	const files: UploadChipFile[] = [
		{
			id: `${run}-brand`,
			name: "brand-guidelines.pdf",
			size: 2_400_000,
			type: "application/pdf",
			progress: report?.[1] ?? 0,
			status: report?.[1] === 1 ? "done" : "uploading",
		},
	];
	if (elapsed >= SECOND_DROP) {
		files.push(
			fileAt(
				elapsed,
				`${run}-moodboard`,
				"moodboard.png",
				860_000,
				"image/png",
				SECOND_DROP,
				SECOND_DROP + 700,
			),
			fileAt(
				elapsed,
				`${run}-voiceover`,
				"voiceover.m4a",
				5_100_000,
				"audio/mp4",
				SECOND_DROP,
				SECOND_DROP + 950,
			),
		);
	}
	return files;
}

/** True while the element is on screen and the tab is visible. */
function useActive(ref: RefObject<HTMLElement | null>) {
	const [active, setActive] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let onScreen = false;
		const update = () =>
			setActive(onScreen && document.visibilityState !== "hidden");
		const observer = new IntersectionObserver(([entry]) => {
			onScreen = entry?.isIntersecting ?? false;
			update();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", update);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", update);
		};
	}, [ref]);
	return active;
}

/** A synthetic file drag over the chip: it wakes and leans toward the pointer. */
function dragOver(root: HTMLElement | null, files: string[], drop: boolean) {
	const target = root?.querySelector<HTMLElement>(
		"[data-slot=upload-chip-attach]",
	);
	if (!target) return;
	const box = target.getBoundingClientRect();
	const dataTransfer = new DataTransfer();
	for (const name of files) dataTransfer.items.add(new File([""], name));
	target.dispatchEvent(
		new DragEvent(drop ? "drop" : "dragover", {
			bubbles: true,
			cancelable: true,
			dataTransfer,
			clientX: box.left + box.width / 2 - 40,
			clientY: box.top + box.height / 2 - 18,
		}),
	);
}

/** Hover in or out of the deck, as a mouse would. */
function hoverDeck(root: HTMLElement | null, enter: boolean) {
	const chip = root?.querySelector("[data-slot=upload-chip-item]");
	if (!chip) return;
	chip.dispatchEvent(
		new PointerEvent(enter ? "pointerover" : "pointerout", {
			bubbles: true,
			pointerType: "mouse",
			// From or to outside the page: React treats <body> as its own.
			relatedTarget: null,
		}),
	);
}

/**
 * A looping scripted run on its own clock. It only advances while on screen
 * with the tab visible. With `trigger`, it waits at the start until that
 * window event fires, so a video take starts on its first frame.
 */
function UploadChipPreview({ trigger }: { trigger?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const active = useActive(ref);
	const [clock, setClock] = useState({ run: 0, elapsed: 0 });
	const [armed, setArmed] = useState(!trigger);
	const elapsedRef = useRef(0);
	const runRef = useRef(0);

	useEffect(() => {
		if (!trigger) return;
		const start = () => {
			elapsedRef.current = 0;
			runRef.current += 1;
			setClock({ run: runRef.current, elapsed: 0 });
			setArmed(true);
		};
		window.addEventListener(trigger, start);
		return () => window.removeEventListener(trigger, start);
	}, [trigger]);

	useEffect(() => {
		if (!active || !armed) return;
		let epoch = Date.now() - elapsedRef.current;
		const tick = () => {
			const previous = elapsedRef.current;
			let elapsed = Date.now() - epoch;
			if (elapsed >= LOOP_AT) {
				runRef.current += 1;
				epoch = Date.now();
				elapsed = 0;
			}
			elapsedRef.current = elapsed;
			const root = ref.current;
			const crossed = (at: number) => previous < at && elapsed >= at;
			const within = ([from, to]: number[]) => elapsed >= from && elapsed < to;
			if (within(DRAG_IN)) dragOver(root, ["brand-guidelines.pdf"], false);
			if (crossed(DROP_AT)) dragOver(root, ["brand-guidelines.pdf"], true);
			if (within(SECOND_DRAG))
				dragOver(root, ["moodboard.png", "voiceover.m4a"], false);
			if (crossed(SECOND_DROP))
				dragOver(root, ["moodboard.png", "voiceover.m4a"], true);
			if (crossed(FAN_OPEN)) hoverDeck(root, true);
			if (crossed(FAN_CLOSE)) hoverDeck(root, false);
			setClock({ run: runRef.current, elapsed });
		};
		tick();
		const interval = window.setInterval(tick, 50);
		return () => window.clearInterval(interval);
	}, [active, armed]);

	return (
		<div ref={ref} className="flex min-h-10 w-full justify-center">
			<UploadChip files={filesAt(clock.elapsed, clock.run)} />
		</div>
	);
}

export default UploadChipPreview;
