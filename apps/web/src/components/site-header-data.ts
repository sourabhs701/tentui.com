import type { Route } from "next";

import blocks from "@/registry/__blocks__.json";
import { components } from "@/registry/components/_registry";

export const headerCommandComponents = components.map((component) => ({
	title: component.title ?? component.name,
	href: `/components/${component.name}` as Route,
}));

export const headerCommandBlocks = blocks.map((block) => ({
	title: block.name,
	description: block.description,
	category: block.categories[0],
	href: (block.categories[0]
		? `/blocks/${block.categories[0]}`
		: "/blocks") as Route,
}));
