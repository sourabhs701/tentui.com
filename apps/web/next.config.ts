import { readdirSync } from "node:fs";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { loadEnvFiles } from "@tentui.com/env/load";
import type { NextConfig } from "next";

loadEnvFiles();

// Legacy /docs/components/<slug> URLs only redirect to /components/<slug> when
// that component page exists; anything else falls through to /components.
const componentSlugs = readdirSync(
	path.join(import.meta.dirname, "src/content/components"),
)
	.filter((file) => file.endsWith(".mdx"))
	.map((file) => file.slice(0, -".mdx".length));

const nextConfig: NextConfig = {
	allowedDevOrigins: ["tentui.localhost", "*.tentui.localhost"],
	typedRoutes: true,
	reactCompiler: true,
	// Next externalizes shiki by default, and OpenNext then bundles the package
	// root (every language and theme) into the Worker. Bundling it lets
	// Turbopack keep only the grammars src/components/mdx/highlighter.ts imports.
	transpilePackages: ["shiki"],
	turbopack: {
		root: path.resolve(import.meta.dirname, "../.."),
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cdn.tentui.com",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/:path*",
				has: [{ type: "host", value: "www\\.tentui\\.com" }],
				destination: "https://tentui.com/:path*",
				statusCode: 301,
			},
			{
				source: "/about",
				destination: "/",
				permanent: true,
			},
			{
				source: "/brand",
				destination: "/",
				permanent: true,
			},
			{
				source: "/sponsors",
				destination: "/sponsor",
				permanent: true,
			},
			{
				source: "/pricing",
				destination: "/blocks/pricing",
				permanent: true,
			},
			{
				source: "/docs/components",
				destination: "/components",
				permanent: true,
			},
			{
				source: "/docs/setup",
				destination: "/docs/installation",
				permanent: true,
			},
			{
				source: "/docs/usage",
				destination: "/docs/installation",
				permanent: true,
			},
			{
				source: "/docs/components/password-input",
				destination: "/blog/accessible-password-input-shadcn",
				permanent: true,
			},
			{
				source: `/docs/components/:slug(${componentSlugs.join("|")})`,
				destination: "/components/:slug",
				statusCode: 301,
			},
			// Removed components (e.g. world-map) have no replacement page.
			{
				source: "/docs/components/:path+",
				destination: "/components",
				statusCode: 301,
			},
			// Indexed post that never shipped here; no chart content to point at.
			{
				source: "/blog/react-pie-chart-recharts-tailwind",
				destination: "/blog",
				statusCode: 301,
			},
			{
				source: "/demo/email-dock",
				destination: "/components/email-dock",
				permanent: true,
			},
		];
	},
	async headers() {
		return [
			{
				source: "/components/:slug([^.]+)",
				headers: [
					{
						key: "Cache-Control",
						value: "private, no-store",
					},
				],
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/docs/:slug.mdx",
				destination: "/docs.mdx/:slug",
			},
			{
				source: "/components/:slug.mdx",
				destination: "/doc.mdx/:slug",
			},
			{
				source: "/blog/:slug.mdx",
				destination: "/blog.mdx/:slug",
			},
			{
				source: "/blocks/:name.mdx",
				destination: "/block.mdx/:name",
			},
			{
				source: "/registry/rss",
				destination: "/rss",
			},
		];
	},
};

export default nextConfig;

initOpenNextCloudflareForDev();
