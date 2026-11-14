"use client";

import { useState } from "react";

import { InkFilterBar } from "@/registry/components/ink-filter-bar/ink-filter-bar";

const OPTIONS = [
	{ value: "cycling", label: "Cycling" },
	{ value: "tennis", label: "Tennis" },
	{ value: "running", label: "Running" },
	{ value: "climbing", label: "Climbing" },
];

// 24 sports clubs and what each one offers. A club matches when it offers
// every picked sport, so each chip narrows the count.
const CLUBS = [
	"cycling running",
	"cycling running climbing",
	"cycling",
	"cycling running",
	"cycling climbing",
	"cycling running",
	"cycling tennis running",
	"cycling tennis",
	"cycling tennis climbing",
	"cycling tennis running",
	"cycling tennis",
	"cycling tennis running climbing",
	"cycling tennis",
	"cycling tennis running",
	"cycling tennis",
	"cycling tennis climbing",
	"cycling tennis running",
	"tennis running",
	"tennis",
	"tennis climbing",
	"tennis running",
	"tennis",
	"running",
	"climbing",
].map((sports) => sports.split(" "));

function InkFilterBarPreview({
	defaultValue = [],
}: {
	defaultValue?: string[];
}) {
	const [value, setValue] = useState(defaultValue);
	const count = CLUBS.filter((sports) =>
		value.every((sport) => sports.includes(sport)),
	).length;

	return (
		<div className="w-full max-w-[360px]">
			<InkFilterBar
				aria-label="Filter clubs by sport"
				options={OPTIONS}
				value={value}
				onValueChange={setValue}
				count={count}
			/>
		</div>
	);
}

export default InkFilterBarPreview;
