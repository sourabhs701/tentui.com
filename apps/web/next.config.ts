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
};

export default nextConfig;

initOpenNextCloudflareForDev();
