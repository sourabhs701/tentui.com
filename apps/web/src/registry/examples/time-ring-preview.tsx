"use client";

import { TimeRing } from "@/registry/components/time-ring/time-ring";

function TimeRingPreview() {
	return (
		<div className="flex w-full min-w-0 items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
			<TimeRing
				aria-label="Sleep schedule"
				defaultValue={{ start: 23 * 60, end: 7 * 60 }}
				minDuration={4 * 60}
				maxDuration={12 * 60}
			/>
		</div>
	);
}

export default TimeRingPreview;
