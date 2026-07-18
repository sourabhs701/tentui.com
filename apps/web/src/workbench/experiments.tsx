import type { ComponentType } from "react";

import AgencyHero01 from "../registry/blocks/agency-hero-01/agency-hero-01";

export type WorkbenchExperiment = {
	slug: string;
	title: string;
	description?: string;
	fullBleed?: boolean;
	component: ComponentType;
};

export const experiments: WorkbenchExperiment[] = [
	{
		slug: "agency-hero-01",
		title: "Agency Hero 01",
		description: "Animated agency hero with availability badge.",
		fullBleed: true,
		component: AgencyHero01,
	},
];

export function getExperiment(slug: string) {
	return experiments.find((experiment) => experiment.slug === slug);
}
