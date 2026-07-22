import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const blocks: Registry["items"] = [
	{
		name: "saas-hero-01",
		title: "SaaS Hero 01",
		description:
			"An editorial SaaS hero with a playful pricing CTA and support dashboard preview.",
		type: "registry:block",
		dependencies: ["motion"],
		registryDependencies: [
			"button",
			getRegistryItemUrl("brand-context-menu"),
			getRegistryItemUrl("peeping-button"),
		],
		files: [
			{
				path: "blocks/saas-hero-01/saas-hero-01.tsx",
				target: "@components/saas-hero-01/index.tsx",
				type: "registry:component",
			},
			{
				path: "blocks/saas-hero-01/header.tsx",
				target: "@components/saas-hero-01/header.tsx",
				type: "registry:component",
			},
			{
				path: "public/tkit-logo.svg",
				target: "~/public/tkit-logo.svg",
				type: "registry:file",
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
			{
				path: "public/cta-01-landscape.svg",
				target: "~/public/cta-01-landscape.svg",
				type: "registry:file",
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
			{
				path: "public/tkit-logo.svg",
				target: "~/public/tkit-logo.svg",
				type: "registry:file",
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
		name: "agency-hero-01",
		title: "Agency Hero 01",
		description: "Animated agency hero.",
		type: "registry:block",
		dependencies: ["motion", "react-fast-marquee"],
		files: [
			{
				path: "blocks/agency-hero-01/agency-hero-01.tsx",
				target: "@components/agency-hero-01.tsx",
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
];
