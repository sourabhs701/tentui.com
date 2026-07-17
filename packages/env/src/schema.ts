import { z } from "zod";

export const webEnvSchema = z.object({
	GITHUB_API_TOKEN: z.string().min(1),
	NEXT_PUBLIC_SERVER_URL: z.url(),
});

export const serverEnvSchema = z.object({
	CORS_ORIGIN: z.url(),
	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string().min(32),
});

export const envFileSchema = serverEnvSchema.extend({
	NEXT_PUBLIC_SERVER_URL: z.url(),
	ALCHEMY_PASSWORD: z.string().min(1),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type EnvFile = z.infer<typeof envFileSchema>;
