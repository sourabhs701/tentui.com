"use client";

import {
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	RollingStat,
	type RollingStatPoint,
} from "@/registry/components/rolling-stat/rolling-stat";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

/** Calls `tick` every `ms` while the element is on screen and the tab is visible. */
function useStream(
	ref: RefObject<HTMLElement | null>,
	ms: number,
	tick: () => void,
) {
	const tickRef = useRef(tick);
	useEffect(() => {
		tickRef.current = tick;
	});
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let visible = false;
		let timer: ReturnType<typeof setInterval> | undefined;
		const update = () => {
			clearInterval(timer);
			timer = undefined;
			if (visible && document.visibilityState === "visible") {
				timer = setInterval(() => tickRef.current(), ms);
			}
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			update();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", update);
		return () => {
			clearInterval(timer);
			observer.disconnect();
			document.removeEventListener("visibilitychange", update);
		};
	}, [ref, ms]);
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

/** "Fri, 13 Nov" for `daysAgo` days before 13 Nov 2026. */
function dayLabel(daysAgo: number) {
	const date = new Date(Date.UTC(2026, 10, 13 - daysAgo));
	return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`;
}

function LiveRevenue() {
	const ref = useRef<HTMLDivElement>(null);
	// Starts just under 49,000, so the stream soon carries across it.
	const [history, setHistory] = useState<number[]>(() =>
		Array.from({ length: 24 }, (_, index) =>
			Math.round(48940 - (23 - index) * 38 + Math.sin(index * 1.7) * 90),
		),
	);
	const push = (step: number) =>
		setHistory((current) => [
			...current.slice(1),
			(current.at(-1) ?? 0) + step,
		]);

	useStream(ref, 1800, () => push(Math.round(4 + Math.random() * 44)));

	return (
		<div ref={ref} className="flex w-full max-w-sm flex-col items-center gap-3">
			<RollingStat
				live
				label="Revenue today"
				history={history}
				format={{
					style: "currency",
					currency: "USD",
					maximumFractionDigits: 0,
				}}
			/>
			<button
				type="button"
				onClick={() => push(1000)}
				className="h-8 cursor-pointer rounded-md border bg-background px-3 font-medium text-sm shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				Jump +1,000
			</button>
		</div>
	);
}

const VISITORS = [
	980, 1012, 1104, 1060, 1135, 1188, 1092, 1004, 1046, 1120, 1176, 1230, 1158,
	1066, 1018, 1094, 1162, 1214, 1282, 1196, 1110, 1150, 1226, 1294, 1318, 1236,
	1172, 1208, 1262, 1240,
];

const visitors: RollingStatPoint[] = VISITORS.map((value, index) => ({
	value,
	label: dayLabel(VISITORS.length - 1 - index),
}));

function ScrubHistory() {
	return (
		<div className="flex w-full max-w-sm flex-col items-center gap-2">
			<RollingStat label="Visitors" suffix=" visitors" history={visitors} />
			<p className="text-muted-foreground text-xs">Drag across the line</p>
		</div>
	);
}

const conversion = [
	0.0252, 0.0261, 0.0258, 0.0266, 0.0271, 0.0264, 0.0273, 0.0279, 0.0276,
	0.0284,
];
const followers = [
	10120, 10380, 10710, 10890, 11240, 11560, 11720, 12030, 12210, 12400,
];
const latency = [214, 208, 221, 203, 196, 199, 190, 187, 193, 182];

function Formats() {
	return (
		<div className="grid w-full max-w-2xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
			<RollingStat
				variant="plain"
				size="sm"
				label="Conversion"
				history={conversion}
				format={{ style: "percent", minimumFractionDigits: 2 }}
			/>
			<RollingStat
				variant="plain"
				size="sm"
				label="Followers"
				history={followers}
				format={{ notation: "compact", maximumFractionDigits: 1 }}
			/>
			<RollingStat
				variant="plain"
				size="sm"
				label="p95 latency"
				suffix=" ms"
				invertTrend
				history={latency}
			/>
		</div>
	);
}

function RollingStatDemo() {
	return (
		<div className="flex w-full flex-col items-center gap-12 py-6">
			<Section title="Live revenue">
				<LiveRevenue />
			</Section>
			<Section title="Scrub history">
				<ScrubHistory />
			</Section>
			<Section title="Formats">
				<Formats />
			</Section>
		</div>
	);
}

export default RollingStatDemo;
