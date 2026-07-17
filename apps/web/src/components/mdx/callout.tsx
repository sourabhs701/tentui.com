import { cn } from "@/lib/utils";

export function Callout({
	title,
	icon,
	className,
	children,
	...props
}: React.ComponentProps<"aside"> & { title?: string; icon?: React.ReactNode }) {
	return (
		<aside
			className={cn(
				"my-5 rounded-xl border border-border bg-surface p-4 text-sm",
				className,
			)}
			{...props}
		>
			{icon}
			{title ? (
				<p className="mb-1 font-medium text-foreground">{title}</p>
			) : null}
			<div className="text-muted-foreground">{children}</div>
		</aside>
	);
}
