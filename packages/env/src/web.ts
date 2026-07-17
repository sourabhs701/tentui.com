import { createEnv } from "@t3-oss/env-nextjs";

import { webEnvSchema } from "./schema";
export const env = createEnv({
	server: {
		GITHUB_API_TOKEN: webEnvSchema.shape.GITHUB_API_TOKEN,
	},
	client: {
		NEXT_PUBLIC_SERVER_URL: webEnvSchema.shape.NEXT_PUBLIC_SERVER_URL,
	},
	runtimeEnv: {
		GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN,
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

export { webEnvSchema } from "./schema";
