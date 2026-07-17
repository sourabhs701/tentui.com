import { SITE_INFO } from "@/config/site";

export const JSON_LD_ID = {
	website: `${SITE_INFO.url}/#website`,
} as const;

export function absoluteUrl(pathname: string) {
	return new URL(pathname, SITE_INFO.url).toString();
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

export function websiteJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": JSON_LD_ID.website,
		name: SITE_INFO.name,
		url: SITE_INFO.url,
		description: SITE_INFO.description,
	};
}

export function JsonLdScript({ data }: { data: unknown }) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replaceAll("<", "\\u003c"),
			}}
		/>
	);
}
