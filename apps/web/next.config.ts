import "@tentui.com/env/web";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	turbopack: {
		root: path.resolve(import.meta.dirname, "../.."),
	},
};

export default nextConfig;

initOpenNextCloudflareForDev();
