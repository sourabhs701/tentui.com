"use client";

import { useEffect, useRef, useState } from "react";

import {
	RollingStat,
	type RollingStatPoint,
} from "@/registry/components/rolling-stat/rolling-stat";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/** "Fri, 13 Nov" for `daysAgo` days before 13 Nov 2026. */
export function dayLabel(daysAgo: number) {
	const date = new Date(Date.UTC(2026, 10, 13 - daysAgo));
	return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

// 30 days of revenue: up 12.4% since the first day, with a dip mid-month.
const REVENUE = [
	42963, 43410, 43180, 44020, 44650, 44310, 45120, 45480, 44890, 44210, 43560,
	42870, 42140, 41720, 41960, 42630, 43380, 44150, 44020, 44890, 45610, 45330,
	46180, 46740, 46510, 47220, 47680, 47450, 47960, 48290,
];

export const revenueHistory: RollingStatPoint[] = REVENUE.map(
	(value, index) => ({ value, label: dayLabel(REVENUE.length - 1 - index) }),
);

const TICK_MS = 2500;

/** `value` and `ticking` are only used by the capture scenes. */
function RollingStatPreview({
	value,
	ticking = value === undefined,
}: {
	value?: number;
	ticking?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [history, setHistory] = useState(revenueHistory);

	// A new figure every few seconds, paused while offscreen or hidden.
	useEffect(() => {
		const element = ref.current;
		if (!ticking || !element) return;
		let visible = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let day = 0;
		const schedule = () => {
			clearTimeout(timer);
			if (!visible || document.visibilityState === "hidden") return;
			timer = setTimeout(() => {
				day += 1;
				setHistory((current) => {
					const last = current[current.length - 1];
					const previous = typeof last === "number" ? last : last.value;
					const step = Math.round((Math.random() - 0.35) * 160);
					return [
						...current.slice(1),
						{ value: previous + step, label: dayLabel(-day) },
					];
				});
				schedule();
			}, TICK_MS);
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			schedule();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", schedule);
		return () => {
			clearTimeout(timer);
			observer.disconnect();
			document.removeEventListener("visibilitychange", schedule);
		};
	}, [ticking]);

	// The capture scenes move the live value; the last point follows it.
	const shown =
		value === undefined
			? history
			: [...revenueHistory.slice(0, -1), { value, label: dayLabel(0) }];

	return (
		<div ref={ref} className="w-full max-w-80">
			<RollingStat
				variant="plain"
				label="Monthly revenue"
				history={shown}
				format={{
					style: "currency",
					currency: "USD",
					maximumFractionDigits: 0,
				}}
			/>
		</div>
	);
}

export default RollingStatPreview;
