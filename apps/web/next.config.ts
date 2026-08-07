import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { loadEnvFiles } from "@tentui.com/env/load";
import type { NextConfig } from "next";

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
				hostname: "cdn.srb.codes",
			},
			{
				protocol: "https",
				hostname: "cdn.tentui.com",
				pathname: "/images/**",
			},
			{
				protocol: "https",
				hostname: "cdn.dribbble.com",
				pathname: "/userupload/**",
			},
		],
	},
	async redirects() {
		return [
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
				source: "/docs/components/animated-tabs",
				destination: "/components/animated-tabs",
				permanent: true,
			},
			{
				source: "/docs/components/animated-arrow",
				destination: "/components/animated-arrow",
				permanent: true,
			},
			{
				source: "/docs/components/password-input",
				destination: "/blog/accessible-password-input-shadcn",
				permanent: true,
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
