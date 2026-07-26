import type { ComponentType } from "react";

export type WorkbenchExperiment = {
	slug: string;
	title: string;
	description?: string;
	fullBleed?: boolean;
	component: ComponentType;
};

export const experiments: WorkbenchExperiment[] = [];

export function getExperiment(slug: string) {
	return experiments.find((experiment) => experiment.slug === slug);
}
