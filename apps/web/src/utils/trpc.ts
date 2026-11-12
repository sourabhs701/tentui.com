import type { AppRouter } from "@tentui.com/api/routers/index";
import { env } from "@tentui.com/env/web";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { queryClient } from "./query-client";

export { queryClient };

const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: new URL("/trpc", env.NEXT_PUBLIC_SERVER_URL).toString(),
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
				});
			},
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
