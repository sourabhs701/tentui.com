"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@tentui.com/ui/components/sonner";
import { TooltipProvider } from "@tentui.com/ui/components/tooltip";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { queryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			enableColorScheme
			storageKey="theme"
		>
			<TooltipProvider>
				<QueryClientProvider client={queryClient}>
					<NuqsAdapter>{children}</NuqsAdapter>
					<ReactQueryDevtools />
				</QueryClientProvider>
			</TooltipProvider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
