import type { Registry } from "shadcn/schema";

import { blocks } from "./blocks/_registry";

export const registry = {
	name: "tentui",
	homepage: "https://tentui.com/blocks",
	items: [...blocks],
} satisfies Registry;
