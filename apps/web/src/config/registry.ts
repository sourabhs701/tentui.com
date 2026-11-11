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
		heading: "Shadcn testimonial blocks",
		description:
			"Testimonial sections for credible, visually engaging customer proof.",
	},
	{
		name: "cta",
		title: "CTA",
		heading: "Shadcn CTA blocks",
		description: "Call-to-action sections that turn interest into momentum.",
	},
	{
		name: "legal",
		title: "Legal",
		heading: "Shadcn legal page blocks",
		description:
			"Legal pages for presenting policies, terms, licenses, and notices clearly.",
	},
	{
		name: "404",
		title: "404 Pages",
		heading: "Shadcn 404 page blocks",
		description:
			"404 pages that turn a dead end into a useful, memorable way back.",
	},
	{
		name: "footer",
		title: "Footer",
		heading: "Shadcn footer blocks",
		description:
			"Footer sections for product navigation, trust, and conversion.",
	},
	{
		name: "pricing",
		title: "Pricing",
		heading: "Shadcn pricing blocks",
		description:
			"Pricing sections for clear plan selection and feature comparison.",
	},
	{
		name: "faq",
		title: "FAQ",
		heading: "Shadcn FAQ blocks",
		description:
			"FAQ sections for clear, approachable answers to common customer questions.",
	},
	{
		name: "hero",
		title: "Hero",
		heading: "Shadcn hero section blocks",
		description: "Hero sections for polished, production-ready landing pages.",
	},
] as const;
