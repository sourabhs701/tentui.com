import type { Registry } from "shadcn/schema";

import { blocks } from "./blocks/_registry";
import { components } from "./components/_registry";
import { examples } from "./examples/_registry";

export const registry = {
	name: "tentui",
	homepage: "https://tentui.com/blocks",
	items: [...blocks, ...components, ...examples],
} satisfies Registry;
