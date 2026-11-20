"use client";

import { useEffect, useRef, useState } from "react";

import {
	LiveSaveStatus,
	type LiveSaveStatusState,
} from "@/registry/components/live-save-status/live-save-status";

/**
 * Deterministic capture scene for the 480x360 component thumbnail and video.
 *
 * Still image (no `?motion`): calm `Saved · just now` capsule centered cleanly.
 * Motion take (`?motion`): starts in `saved`, then accepts scripted
 * `live-save-status-capture` custom events from `component-video-scenarios.mjs`
 * (or clicks on Save/Retry/trigger) so every transition — unsaved with Save
 * chip, saving ink arc, drawn check + confirmation ripple, error shake + Retry
 * chip, and anchored popover — plays on the exact virtual clock.
 */
export function LiveSaveStatusCapture() {
	const [ready, setReady] = useState(false);
	const [status, setStatus] = useState<LiveSaveStatusState>("saved");
	const [pendingCount, setPendingCount] = useState<number | undefined>(
		undefined,
	);
	const [lastSavedAt, setLastSavedAt] = useState<number>(0);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const isMotion = new URLSearchParams(window.location.search).has("motion");
		setLastSavedAt(Date.now() - (isMotion ? 120_000 : 12_000));
		setStatus("saved");
		setReady(true);

		if (!isMotion) return;

		const onCommand = (event: Event) => {
			const detail = (
				event as CustomEvent<{
					status: LiveSaveStatusState;
					pendingCount?: number;
				}>
			).detail;
			if (!detail) return;
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			setPendingCount(detail.pendingCount);
			if (detail.status === "saved") {
				setLastSavedAt(Date.now());
			}
			setStatus(detail.status);
		};

		window.addEventListener("live-save-status-capture", onCommand);
		return () => {
			window.removeEventListener("live-save-status-capture", onCommand);
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	const runSave = () => {
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		setPendingCount(undefined);
		setStatus("saving");
		saveTimerRef.current = setTimeout(() => {
			setLastSavedAt(Date.now());
			setStatus("saved");
		}, 900);
	};

	if (!ready) return null;

	return (
		<div className="flex flex-col items-center">
			<LiveSaveStatus
				status={status}
				lastSavedAt={lastSavedAt}
				pendingCount={pendingCount}
				errorMessage="Connection timed out."
				onSave={runSave}
				onRetry={runSave}
				showPopover
				popoverAlign="center"
				shortcut="⌘S"
				sound
			/>
		</div>
	);
}
