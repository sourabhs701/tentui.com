/// <reference types="@cloudflare/workers-types" />
/// <reference path="../env.d.ts" />

import { env as cloudflareEnv } from "cloudflare:workers";

import { serverEnvSchema } from "./schema";

function createServerEnv(): Env {
	const result = serverEnvSchema.safeParse({
		CORS_ORIGIN: cloudflareEnv.CORS_ORIGIN,
		BETTER_AUTH_URL: cloudflareEnv.BETTER_AUTH_URL,
		BETTER_AUTH_SECRET: cloudflareEnv.BETTER_AUTH_SECRET,
	});

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		console.error("Invalid server environment variables:", fieldErrors);
		throw new Error(
			`Invalid server environment variables: ${JSON.stringify(fieldErrors)}`,
		);
	}

	return cloudflareEnv;
}

export const env = createServerEnv();

export { serverEnvSchema } from "./schema";
