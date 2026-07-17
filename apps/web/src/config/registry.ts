export const registryConfig = {
	/** Registry namespace used by the shadcn CLI. */
	namespace: "@tentui",
	/** Public item URL. The shadcn CLI replaces `{name}` with the item name. */
	namespaceUrl: "https://tentui.com/r/{name}.json",
} as const;

export const blockCategories = [
	{
		name: "hero",
		title: "Hero",
		description: "Hero sections for polished, production-ready landing pages.",
	},
] as const;
