import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
	title: "Workbench",
	robots: { index: false, follow: false },
};

export default function WorkbenchLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	if (process.env.NODE_ENV !== "development") {
		notFound();
	}

	return (
		<div className="grid min-h-svh min-w-0 grid-rows-[auto_1fr] bg-background text-foreground">
			<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
				<div className="flex items-center justify-between gap-4 px-4 py-2">
					<div className="flex min-w-0 items-center gap-3">
						<Link
							href={"/workbench" as Route}
							className="font-medium text-sm tracking-tight hover:opacity-80"
						>
							Workbench
						</Link>
					</div>
					<div className="flex items-center gap-1">
						<ThemeToggle />
					</div>
				</div>
			</header>
			<main className="min-h-0 min-w-0">{children}</main>
		</div>
	);
}
