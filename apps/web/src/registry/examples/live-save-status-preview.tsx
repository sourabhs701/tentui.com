"use client";

import { useEffect, useRef, useState } from "react";

import {
	LiveSaveStatus,
	type LiveSaveStatusState,
} from "@/registry/components/live-save-status/live-save-status";

type PreviewStep = {
	status: LiveSaveStatusState;
	pendingCount?: number;
	errorMessage?: string;
	durationMs: number;
};

const SEQUENCE: PreviewStep[] = [
	{ status: "saved", durationMs: 2200 },
	{ status: "unsaved", pendingCount: 2, durationMs: 1800 },
	{ status: "saving", durationMs: 1200 },
	{ status: "saved", durationMs: 2600 },
	{ status: "offline", pendingCount: 1, durationMs: 1900 },
	{
		status: "error",
		errorMessage: "Connection timed out.",
		durationMs: 2000,
	},
	{ status: "saving", durationMs: 1100 },
];

export default function LiveSaveStatusPreview() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [stepIndex, setStepIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const [manualStatus, setManualStatus] = useState<LiveSaveStatusState | null>(
		null,
	);
	const [lastSavedAt, setLastSavedAt] = useState<number>(
		() => Date.now() - 120_000,
	);
	const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		let visible = true;
		const update = () => {
			setPaused(!visible || document.visibilityState === "hidden");
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry?.isIntersecting ?? false;
			update();
		});
		observer.observe(el);
		document.addEventListener("visibilitychange", update);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", update);
		};
	}, []);

	useEffect(() => {
		if (paused || manualStatus !== null) return;
		const current = SEQUENCE[stepIndex];
		const timer = setTimeout(() => {
			const nextIndex = (stepIndex + 1) % SEQUENCE.length;
			if (SEQUENCE[nextIndex].status === "saved") {
				setLastSavedAt(Date.now());
			}
			setStepIndex(nextIndex);
		}, current.durationMs);
		return () => clearTimeout(timer);
	}, [manualStatus, paused, stepIndex]);

	useEffect(
		() => () => {
			if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
		},
		[],
	);

	const triggerSave = () => {
		if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
		setManualStatus("saving");
		manualTimerRef.current = setTimeout(() => {
			setLastSavedAt(Date.now());
			setManualStatus("saved");
			manualTimerRef.current = setTimeout(() => {
				setManualStatus(null);
				setStepIndex(0);
			}, 2600);
		}, 950);
	};

	const step = SEQUENCE[stepIndex];
	const activeStatus = manualStatus ?? step.status;

	return (
		<div
			ref={containerRef}
			className="flex min-h-36 w-full items-center justify-center"
		>
			<LiveSaveStatus
				status={activeStatus}
				lastSavedAt={lastSavedAt}
				pendingCount={manualStatus ? undefined : step.pendingCount}
				errorMessage={step.errorMessage}
				onSave={triggerSave}
				onRetry={triggerSave}
				showPopover
				popoverAlign="center"
				shortcut="⌘S"
			/>
		</div>
	);
}
