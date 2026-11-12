import { CodeCollapsibleWrapper } from "./code-collapsible-wrapper";
import { DeferredCodeBlock } from "./deferred-code-block";

export function ComponentSource({
	className,
	collapsible = "true",
	deferredSrc,
	title,
	children,
}: React.ComponentProps<"div"> & {
	name?: string;
	src?: string;
	title?: string;
	showLineNumbers?: boolean;
	collapsible?: "true" | "false";
	/** Set by rehypeComponent for source in a hidden tab; fetched on mount. */
	deferredSrc?: string;
}) {
	const content = deferredSrc ? (
		<DeferredCodeBlock src={deferredSrc} title={title} />
	) : (
		children
	);

	if (collapsible === "false") {
		return <div className={className}>{content}</div>;
	}

	return (
		<CodeCollapsibleWrapper className={className}>
			{content}
		</CodeCollapsibleWrapper>
	);
}
