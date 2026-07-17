import { cn } from "@/lib/utils";

export function ComponentContainer({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="Component-container"
			className={cn(
				"mx-auto w-full border-line border-x md:max-w-3xl",
				className,
			)}
			{...props}
		/>
	);
}

export function ComponentGrid({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="Component-grid"
			className={cn(
				"mx-auto grid w-full grid-cols-1 lg:grid-cols-[1fr_var(--container-6xl)_1fr]",
				className,
			)}
			{...props}
		/>
	);
}

export function ComponentLeftCol({
	className,
	...props
}: React.ComponentProps<"aside">) {
	return (
		<aside
			data-slot="Component-left-col"
			className={cn("max-lg:hidden", className)}
			{...props}
		/>
	);
}

export function ComponentContentCol(
	props: React.ComponentProps<typeof ComponentContainer>,
) {
	return <ComponentContainer data-slot="Component-content-col" {...props} />;
}

export function ComponentRightCol({
	className,
	...props
}: React.ComponentProps<"aside">) {
	return (
		<aside
			data-slot="Component-right-col"
			className={cn("max-lg:hidden", className)}
			{...props}
		/>
	);
}
