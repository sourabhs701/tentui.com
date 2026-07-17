import type { Registry } from "shadcn/schema";

import { blocks } from "./blocks/_registry";
import { components } from "./components/_registry";

export const registry = {
	name: "tentui",
	homepage: "https://tentui.com/blocks",
	items: [...blocks, ...components],
} satisfies Registry;
