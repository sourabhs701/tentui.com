"use client";

import { useEffect, useState } from "react";

import { UploadChip } from "@/registry/components/upload-chip/upload-chip";
import UploadChipPreview from "@/registry/examples/upload-chip-preview";

/** Where the still's upload is, and how far it creeps either side of it. */
const STILL_PROGRESS = 0.6;
const STILL_SWAY = 0.002;

/**
 * The still is one chip mid-upload, 60% full. Its progress creeps a fraction
 * of a percent so the chip never reads as stalled ("Waiting"), but never far
 * enough to roll the percent. Motion takes load the page with `?motion` and
 * get the preview's scripted run, which waits for the scenario to dispatch
 * `upload-chip-capture` so it starts on the take's first frame.
 */
export function UploadChipCapture() {
	const [motion, setMotion] = useState<boolean | null>(null);
	const [progress, setProgress] = useState(STILL_PROGRESS);

	useEffect(() => {
		const isMotion = new URLSearchParams(window.location.search).has("motion");
		setMotion(isMotion);
		if (isMotion) return;
		const start = Date.now();
		const interval = window.setInterval(() => {
			const seconds = (Date.now() - start) / 1000;
			setProgress(STILL_PROGRESS + STILL_SWAY * Math.sin(seconds * Math.PI));
		}, 500);
		return () => window.clearInterval(interval);
	}, []);

	if (motion === null) return null;
	if (motion) return <UploadChipPreview trigger="upload-chip-capture" />;
	return (
		// One file only, so the chip stands alone without the attach button.
		<UploadChip
			multiple={false}
			files={[
				{
					id: "still",
					name: "brand-guidelines.pdf",
					size: 2_400_000,
					type: "application/pdf",
					progress,
					status: "uploading",
				},
			]}
		/>
	);
}
