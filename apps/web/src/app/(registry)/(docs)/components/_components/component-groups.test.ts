import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { components } from "@/registry/components/_registry";

import {
	COMPONENT_GROUP_DEFINITIONS,
	getComponentGroups,
} from "./component-groups";

const registryNames = components.map((component) => component.name);
const groupedNames = COMPONENT_GROUP_DEFINITIONS.flatMap(
	(group) => group.components,
);

// Every grouped name is a real registry component, listed once.
assert.deepEqual(
	groupedNames.filter((name) => !registryNames.includes(name)),
	[],
);
assert.equal(new Set(groupedNames).size, groupedNames.length);

// Every registry component is grouped, so the fallback group stays unused.
assert.deepEqual(
	registryNames.filter((name) => !groupedNames.includes(name)),
	[],
);

// Every linked component has a published docs page.
const docsDirectory = path.join(process.cwd(), "src/content/components");
for (const name of registryNames) {
	assert.ok(
		fs.existsSync(path.join(docsDirectory, `${name}.mdx`)),
		`missing docs page for ${name}`,
	);
}

const groups = getComponentGroups(components);
assert.equal(
	groups.reduce((count, group) => count + group.components.length, 0),
	components.length,
);
assert.ok(groups.every((group) => group.id !== "more-components"));

// Unknown and ungrouped components fall back instead of disappearing.
const fallback = getComponentGroups([
	{ name: "copy-button", type: "registry:component" },
	{ name: "brand-new", type: "registry:component" },
]);
assert.deepEqual(
	fallback.map((group) => [group.id, group.components.map((c) => c.name)]),
	[
		["buttons-and-toggles", ["copy-button"]],
		["more-components", ["brand-new"]],
	],
);
