"use client";

import { useState } from "react";

import { AnimatedTabs } from "@/registry/components/animated-tabs";

const TABS = [
	{ value: "overview", label: "Overview" },
	{ value: "analytics", label: "Analytics" },
	{ value: "settings", label: "Settings" },
];

export default function AnimatedTabsDemo() {
	const [value, setValue] = useState("overview");

	return (
		<div className="flex w-full flex-col items-center gap-4 p-4">
			<AnimatedTabs
				aria-label="Dashboard view"
				onValueChange={setValue}
				tabs={TABS}
				value={value}
			/>
		</div>
	);
}
