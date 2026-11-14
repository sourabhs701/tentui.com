import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Kept apart from ./trpc so the providers on every page don't bundle the tRPC
// client and the validated env schema (zod) just to create the query client.
export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(error.message, {
				action: {
					label: "retry",
					onClick: () => {
						query.invalidate();
					},
				},
			});
		},
	}),
});
