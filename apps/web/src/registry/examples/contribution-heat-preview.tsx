"use client";

import {
	ContributionHeat,
	type ContributionHeatDay,
} from "@/registry/components/contribution-heat/contribution-heat";

const MILESTONES: Record<string, string> = {
	"2026-08-14": "v2.4 release",
	"2026-09-18": "Registry overhaul",
	"2026-10-08": "Motion springs pass",
	"2026-10-29": "v2.8 launch",
	"2026-11-12": "Sprint 1 ship",
};

function buildPreviewData(): ContributionHeatDay[] {
	const end = new Date(Date.UTC(2026, 10, 22));
	const totalDays = 20 * 7;
	const start = new Date(end.getTime() - (totalDays - 1) * 86_400_000);
	const rows: ContributionHeatDay[] = [];

	for (let i = 0; i < totalDays; i++) {
		const date = new Date(start.getTime() + i * 86_400_000);
		const iso = date.toISOString().slice(0, 10);
		const dow = date.getUTCDay();
		const week = Math.floor(i / 7);

		// Deterministic pseudo-organic engineering cadence: busy midweeks, quieter weekends, sprint surges.
		const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
		const rand = hash - Math.floor(hash);
		const isWeekend = dow === 0 || dow === 6;
		const sprintWave = Math.sin((week / 3.4) * Math.PI) * 0.5 + 0.5;

		let count = 0;
		if (MILESTONES[iso]) {
			count = 14 + (i % 5);
		} else if (isWeekend) {
			count = rand > 0.68 ? Math.ceil(rand * 4) : 0;
		} else if (rand > 0.14) {
			const base = Math.round(rand * 10 * (0.55 + sprintWave * 0.85));
			count = Math.max(1, base);
		}

		rows.push({
			date: iso,
			count,
			...(MILESTONES[iso] ? { label: MILESTONES[iso] } : {}),
		});
	}

	return rows;
}

const PREVIEW_DATA = buildPreviewData();

export default function ContributionHeatPreview() {
	return (
		<div className="flex w-full min-w-0 items-center justify-center px-2 py-4 sm:px-0">
			<ContributionHeat
				aria-label="Engineering contributions over 20 weeks"
				data={PREVIEW_DATA}
				summaryLabel="Last 20 weeks"
				unit={["commit", "commits"]}
				weeks={20}
			/>
		</div>
	);
}
