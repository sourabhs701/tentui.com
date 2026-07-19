"use client";

import { WorldMap } from "@/registry/components/world-map/world-map";

const userCounts: Record<string, number> = {
	"United States": 1240,
	Brazil: 580,
	India: 920,
};

const selected = new Set(Object.keys(userCounts));

export function WorldMapDemo() {
	return <WorldMap selectedCountries={selected} userCounts={userCounts} />;
}

export default WorldMapDemo;
