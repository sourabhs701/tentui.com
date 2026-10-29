"use client";

import { type ComponentProps, type ReactNode, useState } from "react";

import { SplitFlap } from "@/registry/components/split-flap/split-flap";

const stations = ["AMSTERDAM", "BERLIN", "LONDON", "MILAN", "PARIS", "ZURICH"];

const departures = [
	[
		{ station: "LONDON", time: "10:40", status: "ON TIME" },
		{ station: "PARIS", time: "10:55", status: "BOARDING" },
		{ station: "BERLIN", time: "11:05", status: "DELAYED" },
		{ station: "AMSTERDAM", time: "11:20", status: "ON TIME" },
	],
	[
		{ station: "PARIS", time: "10:55", status: "DEPARTED" },
		{ station: "BERLIN", time: "11:05", status: "BOARDING" },
		{ station: "AMSTERDAM", time: "11:20", status: "ON TIME" },
		{ station: "ZURICH", time: "11:45", status: "DELAYED" },
	],
	[
		{ station: "BERLIN", time: "11:05", status: "DEPARTED" },
		{ station: "AMSTERDAM", time: "11:20", status: "BOARDING" },
		{ station: "ZURICH", time: "11:45", status: "DELAYED" },
		{ station: "MILAN", time: "12:10", status: "ON TIME" },
	],
];

/** Status starts after the station word (column 0), the time, and a space. */
const STATUS_COLUMN = 7;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function DemoButton({ children, ...props }: ComponentProps<"button">) {
	return (
		<button
			type="button"
			className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-background px-3 font-medium text-sm shadow-xs outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
			{...props}
		>
			{children}
		</button>
	);
}

function SplitFlapDemo() {
	const [page, setPage] = useState(0);
	const [count, setCount] = useState(42);
	const [word, setWord] = useState(0);

	const board = departures[page % departures.length] ?? [];
	const rows = board.map(
		(departure) => `${departure.station} ${departure.time} ${departure.status}`,
	);
	const tonesText = ["HELLO", "WORLD"][word % 2] ?? "";

	return (
		<div className="flex w-full max-w-xl flex-col items-center gap-10 py-4">
			<Section title="Departures">
				<SplitFlap
					value={rows}
					words={stations}
					length={14}
					soundToggle
					accent={{
						match: (_, row, col) =>
							col >= STATUS_COLUMN && board[row]?.status === "DELAYED",
						className: "text-amber-400",
					}}
					aria-label={board
						.map(
							(departure) =>
								`${departure.station}, ${departure.time}, ${departure.status.toLowerCase()}`,
						)
						.join(". ")}
				/>
				<DemoButton onClick={() => setPage((current) => current + 1)}>
					Next
				</DemoButton>
			</Section>

			<Section title="Counter">
				<div className="flex w-full max-w-xs items-center justify-center gap-3">
					<DemoButton
						aria-label="Decrease"
						onClick={() => setCount((current) => Math.max(0, current - 1))}
					>
						-
					</DemoButton>
					<SplitFlap
						value={String(count)}
						chars="0123456789"
						length={4}
						align="end"
						size="lg"
						className="flex-1"
					/>
					<DemoButton
						aria-label="Increase"
						onClick={() => setCount((current) => Math.min(9999, current + 1))}
					>
						+
					</DemoButton>
				</div>
			</Section>

			<Section title="Ink and paper">
				<div className="grid w-full grid-cols-2 justify-items-center gap-4">
					<SplitFlap value={tonesText} length={5} tone="ink" />
					<SplitFlap value={tonesText} length={5} tone="paper" />
				</div>
				<DemoButton onClick={() => setWord((current) => current + 1)}>
					Flip
				</DemoButton>
			</Section>
		</div>
	);
}

export default SplitFlapDemo;
