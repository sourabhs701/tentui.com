import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const blocks: Registry["items"] = [
	{
		name: "footer-04",
		title: "Footer 04",
		description:
			"A tactile plaster footer with a custom logo pressed into its surface.",
		type: "registry:block",
		registryDependencies: [getRegistryItemUrl("realistic-emboss")],
		files: [
			{
				path: "blocks/footer-04/footer-04.tsx",
				target: "@components/footer-04.tsx",
				type: "registry:component",
			},
		],
		categories: ["footer"],
		meta: {
			createdAt: "2026-07-30",
			iframeHeight: 840,
			previewClassName: "flex min-h-svh items-end",
		},
	},
	{
		name: "pricing-03",
		title: "Pricing 03",
		description:
			"A focused two-plan pricing section with an ambient fluid treatment for the popular plan.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		files: [
			{
				path: "blocks/pricing-03/pricing-03.tsx",
				target: "@components/pricing-03/pricing-03.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/pricing-03/fluid-wave.tsx",
				target: "@components/pricing-03/fluid-wave.tsx",
				type: "registry:component",
			},
			{
				path: "src/lib/webgl.ts",
				target: "@lib/webgl.ts",
				type: "registry:lib",
			},
		],
		categories: ["pricing"],
		meta: {
			createdAt: "2026-07-30",
			iframeHeight: 940,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "footer-03",
		title: "Footer 03",
		description:
			"A rounded dark footer with an overlapping brand mark, centered calls to action, and compact navigation.",
		type: "registry:block",
		files: [
			{
				path: "blocks/footer-03/footer-03.tsx",
				target: "@components/footer-03.tsx",
				type: "registry:component",
			},
		],
		categories: ["footer"],
		meta: {
			createdAt: "2026-07-26",
			iframeHeight: 860,
			previewClassName: "flex min-h-svh items-end",
		},
	},
	{
		name: "faq-03",
		title: "FAQ 03",
		description:
			"A conversational FAQ section with chat bubbles and a compact contact prompt.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		registryDependencies: [
			"accordion",
			"avatar",
			"bubble",
			"button",
			"message",
			"separator",
		],
		files: [
			{
				path: "blocks/faq-03/faq-03.tsx",
				target: "@components/faq-03.tsx",
				type: "registry:component",
			},
		],
		categories: ["faq"],
		meta: {
			createdAt: "2026-07-22",
			iframeHeight: 980,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "pricing-02",
		title: "Pricing 02",
		description:
			"Tabbed project pricing paired with a highlighted ongoing retainer.",
		type: "registry:block",
		dependencies: ["lucide-react", "motion"],
		files: [
			{
				path: "blocks/pricing-02/pricing-02.tsx",
				target: "@components/pricing-02/pricing-02.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/pricing-02/icons.tsx",
				target: "@components/pricing-02/icons.tsx",
				type: "registry:component",
			},
		],
		categories: ["pricing"],
		meta: {
			createdAt: "2026-07-22",
			iframeHeight: 980,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "hero-02",
		title: "Hero 02",
		description:
			"An editorial hero with a playful pricing CTA and support dashboard preview.",
		type: "registry:block",
		dependencies: ["motion"],
		registryDependencies: [
			"button",
			getRegistryItemUrl("brand-context-menu"),
			getRegistryItemUrl("peeping-button"),
		],
		files: [
			{
				path: "blocks/hero-02/hero-02.tsx",
				target: "@components/hero-02/index.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/hero-02/header.tsx",
				target: "@components/hero-02/header.tsx",
				type: "registry:component",
			},
		],
		categories: ["hero"],
		meta: {
			createdAt: "2026-07-22",
			iframeHeight: 1120,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "testimonials-01",
		title: "Testimonials 01",
		description:
			"A live X testimonial mosaic with resilient fallbacks and cursor-tracking glow.",
		type: "registry:block",
		dependencies: ["motion", "react-tweet"],
		registryDependencies: ["avatar", "card", getRegistryItemUrl("glow-card")],
		files: [
			{
				path: "blocks/testimonials-01/testimonials-01.tsx",
				target: "@components/testimonials-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["testimonials"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 1320,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "cta-01",
		title: "CTA 01",
		description: "A responsive call-to-action with a wide landscape image.",
		type: "registry:block",
		registryDependencies: ["button"],
		files: [
			{
				path: "blocks/cta-01/cta-01.tsx",
				target: "@components/cta-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["cta"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 590,
			previewClassName: "content-center",
		},
	},
	{
		name: "legal-page-01",
		title: "Legal Page 01",
		description:
			"A two-file App Router legal route group with sidebar navigation and numbered clauses.",
		type: "registry:block",
		registryDependencies: ["separator"],
		files: [
			{
				path: "blocks/legal-page-01/layout.tsx",
				target: "app/(legal)/layout.tsx",
				type: "registry:page",
			},
			{
				path: "blocks/legal-page-01/privacy/page.tsx",
				target: "app/(legal)/privacy/page.tsx",
				type: "registry:page",
			},
		],
		categories: ["legal"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 1120,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "footer-02",
		title: "Footer 02",
		description:
			"A grain-textured footer with dashed grid lines, navigation columns, and an oversized wordmark.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		files: [
			{
				path: "blocks/footer-02/footer-02.tsx",
				target: "@components/footer-02.tsx",
				type: "registry:component",
			},
		],
		categories: ["footer"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 720,
			previewClassName: "flex min-h-svh items-end",
		},
	},
	{
		name: "footer-01",
		title: "Footer 01",
		description:
			"A structured product footer with newsletter, navigation, status, and theme controls.",
		type: "registry:block",
		dependencies: ["lucide-react", "next-themes"],
		registryDependencies: ["button", "input-group", "separator"],
		files: [
			{
				path: "blocks/footer-01/footer-01.tsx",
				target: "@components/footer-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["footer"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 860,
			previewClassName: "flex min-h-svh items-end",
		},
	},
	{
		name: "pricing-01",
		title: "Pricing 01",
		description: "Pricing plans with a billing toggle and usage comparison.",
		type: "registry:block",
		dependencies: ["lucide-react", "motion"],
		registryDependencies: [
			"badge",
			"button",
			getRegistryItemUrl("animated-tabs"),
		],
		files: [
			{
				path: "blocks/pricing-01/pricing-01.tsx",
				target: "@components/pricing-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["pricing"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 1040,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "faq-02",
		title: "FAQ 02",
		description:
			"A numbered editorial FAQ section with focused disclosure rows.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		registryDependencies: ["accordion"],
		files: [
			{
				path: "blocks/faq-02/faq-02.tsx",
				target: "@components/faq-02.tsx",
				type: "registry:component",
			},
		],
		categories: ["faq"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 860,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "faq-01",
		title: "FAQ 01",
		description: "A split-layout FAQ section with subtle grid detailing.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		registryDependencies: ["accordion"],
		files: [
			{
				path: "blocks/faq-01/faq-01.tsx",
				target: "@components/faq-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["faq"],
		meta: {
			createdAt: "2026-07-21",
			iframeHeight: 760,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "hero-01",
		title: "Hero 01",
		description:
			"An animated hero with availability, service CTAs, and a technology carousel.",
		type: "registry:block",
		dependencies: ["motion", "react-fast-marquee"],
		files: [
			{
				path: "blocks/hero-01/hero-01.tsx",
				target: "@components/hero-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["hero"],
		meta: {
			createdAt: "2026-07-17",
			iframeHeight: 760,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "404-01",
		title: "404 01",
		description:
			"An interactive 404 page with Figma-inspired vector controls and editable Bézier points.",
		type: "registry:block",
		dependencies: ["lucide-react"],
		registryDependencies: ["button"],
		files: [
			{
				path: "blocks/404-01/404-01.tsx",
				target: "@components/404-01/404-01.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/404-01/vector-editor.tsx",
				target: "@components/404-01/vector-editor.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/404-01/parse.ts",
				target: "@components/404-01/parse.ts",
				type: "registry:component",
			},
			{
				path: "blocks/404-01/types.ts",
				target: "@components/404-01/types.ts",
				type: "registry:component",
			},
		],
		categories: ["404"],
		meta: {
			createdAt: "2026-06-25",
			iframeHeight: 900,
			previewClassName: "min-h-screen",
			company: "Figma",
			tags: ["SVG", "Bezier", "Editor"],
			source: "https://figma.com",
		},
	},
];
