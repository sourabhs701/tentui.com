import type { ComponentType } from "react";

import AgencyHero01 from "../registry/blocks/agency-hero-01/agency-hero-01";
import { ThreeDButtonDemo } from "../registry/examples/3d-button-demo";
import { ScribbledTextDemo } from "../registry/examples/scribbled-text-demo";
import { WorldMapDemo } from "../registry/examples/world-map-demo";

export type WorkbenchExperiment = {
	slug: string;
	title: string;
	description?: string;
	fullBleed?: boolean;
	component: ComponentType;
};

export const experiments: WorkbenchExperiment[] = [
	{
		slug: "3d-button",
		title: "3D Button",
		description:
			"Raised actions with default, secondary, outline, and destructive surfaces.",
		component: ThreeDButtonDemo,
	},
	{
		slug: "agency-hero-01",
		title: "Agency Hero 01",
		description: "Animated agency hero with availability badge.",
		fullBleed: true,
		component: AgencyHero01,
	},
	{
		slug: "world-map",
		title: "World Map",
		description:
			"Interactive world map with selected countries and user counts.",
		component: WorldMapDemo,
	},
	{
		slug: "scribbled-text",
		title: "Scribbled Text",
		description: "Twelve colorful hand-drawn annotations for inline text.",
		component: ScribbledTextDemo,
	},
];

export function getExperiment(slug: string) {
	return experiments.find((experiment) => experiment.slug === slug);
}
