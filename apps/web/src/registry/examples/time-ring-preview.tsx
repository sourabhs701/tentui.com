"use client";

import { TimeRing } from "@/registry/components/time-ring/time-ring";

function TimeRingPreview() {
	return (
		<TimeRing
			aria-label="Sleep schedule"
			defaultValue={{ start: 23 * 60, end: 7 * 60 }}
			minDuration={4 * 60}
			maxDuration={12 * 60}
		/>
	);
}

export default TimeRingPreview;
