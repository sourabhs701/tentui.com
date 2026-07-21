import { RssIcon } from "lucide-react";
import Link from "next/link";

export function DocsFooter() {
	return (
		<footer className="container mx-auto border-border border-t border-dashed">
			<div className="flex min-h-14 items-center justify-center gap-4 px-4 font-mono text-[12px] text-muted-foreground tracking-tight">
				<p>&copy; 2026 TentUI</p>
				<Link
					href="/rss"
					className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
				>
					<RssIcon className="size-3" aria-hidden="true" />
					RSS
				</Link>
			</div>
		</footer>
	);
}
