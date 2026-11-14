"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";

import { InkFilterBar } from "@/registry/components/ink-filter-bar/ink-filter-bar";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

const SPORTS = [
	{ value: "cycling", label: "Cycling" },
	{ value: "running", label: "Running" },
	{ value: "tennis", label: "Tennis" },
	{ value: "climbing", label: "Climbing" },
];

const ACTIVITIES = [
	{
		id: 1,
		title: "Morning loop",
		sport: "cycling",
		detail: "42 km · 1 h 38 m",
	},
	{ id: 2, title: "Track intervals", sport: "running", detail: "8 km · 41 m" },
	{
		id: 3,
		title: "Doubles at the club",
		sport: "tennis",
		detail: "2 sets · 1 h 10 m",
	},
	{
		id: 4,
		title: "Bouldering session",
		sport: "climbing",
		detail: "14 problems",
	},
	{ id: 5, title: "Coffee ride", sport: "cycling", detail: "28 km · 1 h 04 m" },
	{ id: 6, title: "Long run", sport: "running", detail: "21 km · 1 h 52 m" },
	{
		id: 7,
		title: "Hill repeats",
		sport: "cycling",
		detail: "36 km · 1 h 45 m",
	},
	{ id: 8, title: "Lead climbing", sport: "climbing", detail: "6 routes" },
];

const SPORT_LABELS = Object.fromEntries(
	SPORTS.map((sport) => [sport.value, sport.label]),
);

function ActivityList() {
	const [sports, setSports] = useState<string[]>([]);
	const shown = ACTIVITIES.filter(
		(activity) => sports.length === 0 || sports.includes(activity.sport),
	);

	return (
		<div className="flex w-full flex-col gap-3">
			<InkFilterBar
				aria-label="Filter activities by sport"
				options={SPORTS}
				value={sports}
				onValueChange={setSports}
				count={shown.length}
				label={shown.length === 1 ? "activity" : "activities"}
			/>
			<ul className="flex flex-col overflow-hidden rounded-xl border">
				<AnimatePresence initial={false}>
					{shown.map((activity) => (
						<motion.li
							key={activity.id}
							layout="position"
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ type: "spring", duration: 0.35, bounce: 0 }}
							className="overflow-hidden border-b last:border-b-0"
						>
							<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
								<div className="min-w-0">
									<p className="truncate font-medium text-foreground text-sm">
										{activity.title}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{activity.detail}
									</p>
								</div>
								<span className="shrink-0 text-muted-foreground text-xs">
									{SPORT_LABELS[activity.sport]}
								</span>
							</div>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</div>
	);
}

const CATEGORIES = [
	{ value: "landing", label: "Landing", count: 18 },
	{ value: "dashboard", label: "Dashboard", count: 9 },
	{ value: "blog", label: "Blog", count: 6 },
];

function CategoryPicker() {
	const [category, setCategory] = useState<string[]>(["dashboard"]);
	const picked = CATEGORIES.find((item) => item.value === category[0]);
	const count =
		picked?.count ?? CATEGORIES.reduce((sum, item) => sum + item.count, 0);

	return (
		<InkFilterBar
			type="single"
			aria-label="Template category"
			options={CATEGORIES}
			value={category}
			onValueChange={setCategory}
			count={count}
			label="templates"
		/>
	);
}

const CUISINES = [
	"Thai",
	"Italian",
	"Ramen",
	"Tacos",
	"Vegan",
	"Sushi",
	"Burgers",
	"Indian",
].map((name) => ({ value: name.toLowerCase(), label: name }));

/** A made-up count that shrinks with each cuisine you pick. */
function placesFor(picked: string[]) {
	return picked.reduce(
		(count, cuisine) =>
			Math.max(1, Math.round(count * (0.42 + cuisine.length * 0.04))),
		128,
	);
}

function CuisineFilter() {
	const [picked, setPicked] = useState<string[]>([]);

	return (
		<InkFilterBar
			wrap
			sound={false}
			aria-label="Filter places by cuisine"
			options={CUISINES}
			value={picked}
			onValueChange={setPicked}
			onClear={() => undefined}
			count={placesFor(picked)}
			label="places"
		/>
	);
}

function InkFilterBarDemo() {
	return (
		<div className="flex w-full max-w-[360px] flex-col items-center gap-10 py-4">
			<Section title="Filters a list">
				<ActivityList />
			</Section>

			<Section title="Single choice">
				<div className="w-full">
					<CategoryPicker />
				</div>
			</Section>

			<Section title="Wrapping, sound off">
				<div className="w-full">
					<CuisineFilter />
				</div>
			</Section>
		</div>
	);
}

export default InkFilterBarDemo;
