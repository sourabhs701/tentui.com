export const registryConfig = {
	/** Registry namespace used by the shadcn CLI. */
	namespace: "@tentui",
	/** Public item URL. The shadcn CLI replaces `{name}` with the item name. */
	namespaceUrl: "https://tentui.com/r/{name}.json",
} as const;

/**
 * Block category pages (`/blocks/<name>`). `noun` fills the answer-first intro
 * and FAQ ("shadcn <noun> blocks"), and `updatedAt` is the last edit to the
 * page copy, which the sitemap `lastmod` takes alongside the blocks' dates.
 */
export const blockCategories = [
	{
		name: "testimonials",
		title: "Testimonials",
		noun: "testimonial",
		seoTitle: "shadcn Testimonial Blocks for React & Next.js",
		heading: "Shadcn testimonial blocks",
		description:
			"Free, source-available shadcn testimonial block for React and Next.js: a copy-paste shadcn/ui + Tailwind CSS mosaic of live X posts with fallbacks.",
		updatedAt: "2026-11-20",
	},
	{
		name: "cta",
		title: "CTA",
		noun: "CTA",
		seoTitle: "shadcn CTA Section Blocks for React & Next.js",
		heading: "Shadcn CTA blocks",
		description:
			"Free, source-available shadcn CTA block for React and Next.js: a copy-paste shadcn/ui + Tailwind CSS call-to-action with a wide landscape image.",
		updatedAt: "2026-11-20",
	},
	{
		name: "legal",
		title: "Legal",
		noun: "legal page",
		seoTitle: "shadcn Legal Page Blocks for Privacy & Terms",
		heading: "Shadcn legal page blocks",
		description:
			"Free, source-available shadcn legal page block for Next.js: a copy-paste App Router route group for privacy policies, terms, and notices.",
		updatedAt: "2026-11-20",
	},
	{
		name: "404",
		title: "404 Pages",
		noun: "404 page",
		seoTitle: "shadcn 404 Page Blocks for React & Next.js",
		heading: "Shadcn 404 page blocks",
		description:
			"Free, source-available shadcn 404 page block for React and Next.js: a copy-paste shadcn/ui + Tailwind CSS not-found page with editable vector controls.",
		updatedAt: "2026-11-20",
	},
	{
		name: "footer",
		title: "Footer",
		noun: "footer",
		seoTitle: "shadcn Footer Blocks for React & Next.js",
		heading: "Shadcn footer blocks",
		description:
			"Free, source-available shadcn footer blocks for React and Next.js. Copy-paste shadcn/ui + Tailwind CSS footers with link columns, newsletter signup, and CTAs.",
		updatedAt: "2026-11-20",
	},
	{
		name: "pricing",
		title: "Pricing",
		noun: "pricing",
		seoTitle: "shadcn Pricing Section Blocks for React & Next.js",
		heading: "Shadcn pricing blocks",
		description:
			"Free, source-available shadcn pricing blocks for React and Next.js. Copy-paste shadcn/ui + Tailwind CSS pricing sections with billing toggles and plan tabs.",
		updatedAt: "2026-11-20",
	},
	{
		name: "faq",
		title: "FAQ",
		noun: "FAQ",
		seoTitle: "shadcn FAQ Section Blocks for React & Next.js",
		heading: "Shadcn FAQ blocks",
		description:
			"Free, source-available shadcn FAQ blocks for React and Next.js. Copy-paste shadcn/ui + Tailwind CSS FAQ sections built on the shadcn/ui accordion.",
		updatedAt: "2026-11-20",
	},
	{
		name: "hero",
		title: "Hero",
		noun: "hero section",
		seoTitle: "shadcn Hero Section Blocks for React & Next.js",
		heading: "Shadcn hero section blocks",
		description:
			"Free, source-available shadcn hero section blocks for React and Next.js. Copy-paste shadcn/ui + Tailwind CSS animated heroes with CTAs and a dashboard preview.",
		updatedAt: "2026-11-20",
	},
] as const;
