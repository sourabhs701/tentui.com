"use client";

import { useEffect, useState } from "react";

import { UploadChip } from "@/registry/components/upload-chip/upload-chip";
import UploadChipPreview from "@/registry/examples/upload-chip-preview";

/** Where the still's upload is, and how fast it creeps on, per second. */
const STILL_PROGRESS = 0.6;
const STILL_RATE = 0.01;

/**
 * The still is one chip mid-upload, about 60% full. It keeps creeping so the
 * meniscus has its wave. Motion takes load the page with `?motion` and get
 * the preview's scripted run, which waits for the scenario to dispatch
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
			setProgress(
				Math.min(
					0.66,
					STILL_PROGRESS + ((Date.now() - start) / 1000) * STILL_RATE,
				),
			);
		}, 100);
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
