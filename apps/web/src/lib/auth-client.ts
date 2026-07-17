import { env } from "@tentui.com/env/web";
import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_SERVER_URL from packages/env (.env / .env.prod), validated by @tentui.com/env/web.
export const authClient = createAuthClient({
	baseURL: new URL("/api/auth", env.NEXT_PUBLIC_SERVER_URL).toString(),
});
