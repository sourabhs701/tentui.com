"use client";

import { ChartBrush } from "@/registry/components/chart-brush/chart-brush";

/** Ninety days of revenue: a slow climb, a soft weekly rhythm, and a mid-quarter dip. */
const revenue = Array.from({ length: 90 }, (_, day) => {
	const trend = 3000 + day * 16;
	const swell = Math.sin(day / 9) * 320;
	const weekly = Math.sin((day / 7) * Math.PI * 2) * 70;
	const dip = -900 * Math.exp(-(((day - 47) / 6) ** 2));
	return {
		date: Date.UTC(2026, 7, 1 + day),
		value: Math.round(trend + swell + weekly + dip),
	};
});

function ChartBrushPreview() {
	return (
		<div className="w-full max-w-[420px] px-2 py-2 sm:px-3 sm:py-2">
			<ChartBrush
				label="Revenue"
				data={revenue}
				defaultValue={{ start: 34, end: 72 }}
				valueFormat={{
					style: "currency",
					currency: "USD",
					maximumFractionDigits: 0,
				}}
				dateFormat={{ month: "short", day: "numeric", timeZone: "UTC" }}
			/>
		</div>
	);
}

export default ChartBrushPreview;
