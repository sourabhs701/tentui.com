"use client";

import { DateScrubField } from "@/registry/components/date-scrub-field/date-scrub-field";

function DateScrubFieldPreview() {
	return (
		<DateScrubField label="Release date" defaultValue="2026-05-14" size="lg" />
	);
}

export default DateScrubFieldPreview;
