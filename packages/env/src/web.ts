import { createEnv } from "@t3-oss/env-nextjs";

import { webEnvSchema } from "./schema";
export const env = createEnv({
	client: {
		NEXT_PUBLIC_SERVER_URL: webEnvSchema.shape.NEXT_PUBLIC_SERVER_URL,
	},
	runtimeEnv: {
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

export { webEnvSchema } from "./schema";
