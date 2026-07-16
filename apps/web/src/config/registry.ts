export const registryConfig = {
	/** Registry namespace used by the shadcn CLI. */
	namespace: "@tentui",
	/** Public item URL. The shadcn CLI replaces `{name}` with the item name. */
	namespaceUrl: "https://tentui.com/r/{name}.json",
} as const;

export const blockCategories = [
	{
		name: "marketing",
		title: "Marketing",
		description:
			"Landing pages, sections, blog templates, and high-converting testimonial blocks.",
	},
	{
		name: "application",
		title: "Application",
		description:
			"Dashboard layouts, metric cards, settings pages, and core web app interfaces.",
	},
	{
		name: "ecommerce",
		title: "Ecommerce",
		description:
			"Product grids, shopping carts, filters, and streamlined checkout components.",
	},
] as const;
