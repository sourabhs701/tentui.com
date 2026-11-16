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
		seoTitle: "Shadcn Testimonial Blocks for React Landing Pages",
		heading: "Shadcn testimonial blocks",
		description:
			"Testimonial sections for credible, visually engaging customer proof.",
	},
	{
		name: "cta",
		title: "CTA",
		seoTitle: "Shadcn CTA Blocks for React Landing Pages",
		heading: "Shadcn CTA blocks",
		description: "Call-to-action sections that turn interest into momentum.",
	},
	{
		name: "legal",
		title: "Legal",
		seoTitle: "Shadcn Legal Page Blocks for Privacy Policies",
		heading: "Shadcn legal page blocks",
		description:
			"Legal pages for presenting policies, terms, licenses, and notices clearly.",
	},
	{
		name: "404",
		title: "404 Pages",
		seoTitle: "Shadcn 404 Page Blocks for React and Next.js",
		heading: "Shadcn 404 page blocks",
		description:
			"404 pages that turn a dead end into a useful, memorable way back.",
	},
	{
		name: "footer",
		title: "Footer",
		seoTitle: "Shadcn Footer Blocks for React and Next.js Sites",
		heading: "Shadcn footer blocks",
		description:
			"Footer sections for product navigation, trust, and conversion.",
	},
	{
		name: "pricing",
		title: "Pricing",
		seoTitle: "Shadcn Pricing Section Blocks for React SaaS Pages",
		heading: "Shadcn pricing blocks",
		description:
			"Pricing sections for clear plan selection and feature comparison.",
	},
	{
		name: "faq",
		title: "FAQ",
		seoTitle: "Shadcn FAQ Section Blocks for React and Tailwind",
		heading: "Shadcn FAQ blocks",
		description:
			"FAQ sections for clear, approachable answers to common customer questions.",
	},
	{
		name: "hero",
		title: "Hero",
		seoTitle: "Shadcn Hero Section Blocks for React Landing Pages",
		heading: "Shadcn hero section blocks",
		description: "Hero sections for polished, production-ready landing pages.",
	},
] as const;
