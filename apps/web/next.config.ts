import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { loadEnvFiles } from "@tentui.com/env/load";
import type { NextConfig } from "next";

// Load packages/env/.env (+ .env.prod in production) before Next reads process.env.
// Keep this out of @tentui.com/env/web so client components never pull in node:fs.
loadEnvFiles();

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	turbopack: {
		root: path.resolve(import.meta.dirname, "../.."),
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cdn.dribbble.com",
				pathname: "/userupload/**",
			},
		],
	},
	async headers() {
		return [
			{
				// This URL content-negotiates on Accept, so keep its variants out of shared caches.
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
				source: "/components/:slug.mdx",
				destination: "/doc.mdx/:slug",
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
