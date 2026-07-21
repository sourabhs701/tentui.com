export const registryConfig = {
	/** Registry namespace used by the shadcn CLI. */
	namespace: "@tentui",
	/** Public item URL. The shadcn CLI replaces `{name}` with the item name. */
	namespaceUrl: "https://tentui.com/r/{name}.json",
} as const;

export const blockCategories = [
	{
		name: "testimonials",
		title: "Testimonials",
		description:
			"Testimonial sections for credible, visually engaging customer proof.",
	},
	{
		name: "cta",
		title: "CTA",
		description: "Call-to-action sections that turn interest into momentum.",
	},
	{
		name: "legal",
		title: "Legal",
		description:
			"Legal pages for presenting policies, terms, licenses, and notices clearly.",
	},
	{
		name: "footer",
		title: "Footer",
		description:
			"Footer sections for product navigation, trust, and conversion.",
	},
	{
		name: "pricing",
		title: "Pricing",
		description:
			"Pricing sections for clear plan selection and feature comparison.",
	},
	{
		name: "faq",
		title: "FAQ",
		description:
			"FAQ sections for clear, approachable answers to common customer questions.",
	},
	{
		name: "hero",
		title: "Hero",
		description: "Hero sections for polished, production-ready landing pages.",
	},
] as const;
