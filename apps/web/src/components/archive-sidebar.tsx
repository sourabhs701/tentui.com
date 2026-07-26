import { cn } from "@/lib/utils";

export const ARCHIVE_SIDEBAR_ROW =
	"relative flex h-11 w-full cursor-pointer touch-manipulation items-center px-6 text-left font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 active:bg-muted [@media(hover:hover)_and_(pointer:fine)]:h-8";

export function ArchiveSidebar({
	title,
	children,
	className,
	...props
}: React.ComponentProps<"nav"> & {
	title: string;
}) {
	return (
		<nav
			className={cn(
				"self-start py-2 md:sticky md:top-(--header-height)",
				className,
			)}
			{...props}
		>
			<div className="bg-primary px-6 py-2">
				<span className="font-medium text-primary-foreground text-xs uppercase tracking-wide">
					{title}
				</span>
			</div>
			<ul className="flex flex-col">{children}</ul>
		</nav>
	);
}

export function ArchiveSidebarActiveRail() {
	return (
		<span
			aria-hidden="true"
			className="absolute top-0 left-0 h-full w-0.5 bg-primary"
		/>
	);
}
