const SITE_URL = "https://tentui.com";

export function absoluteUrl(pathname: string) {
	return new URL(pathname, SITE_URL).toString();
}

export function breadcrumbJsonLd(items: Array<{ name: string; href: string }>) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: absoluteUrl(item.href),
		})),
	};
}

export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replaceAll("<", "\\u003c"),
			}}
		/>
	);
}
