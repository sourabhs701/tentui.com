import {
	SITE_INFO,
	SOURCE_CODE_GITHUB_URL,
	X_PROFILE_URL,
} from "@/config/site";

export const JSON_LD_ID = {
	website: `${SITE_INFO.url}/#website`,
	organization: `${SITE_INFO.url}/#organization`,
	library: `${SITE_INFO.url}/#library`,
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

/** Licensing, language, and ownership shared by every SoftwareSourceCode node. */
export function sourceCodeJsonLdProperties() {
	return {
		codeRepository: SOURCE_CODE_GITHUB_URL,
		programmingLanguage: [
			{ "@type": "ComputerLanguage", name: "TypeScript" },
			{ "@type": "ComputerLanguage", name: "JSX" },
		],
		runtimePlatform: "React",
		license: absoluteUrl("/license"),
		isAccessibleForFree: true,
		author: { "@id": JSON_LD_ID.organization },
		publisher: { "@id": JSON_LD_ID.organization },
	};
}

function organizationJsonLd() {
	return {
		"@type": "Organization",
		"@id": JSON_LD_ID.organization,
		name: SITE_INFO.name,
		url: SITE_INFO.url,
		logo: {
			"@type": "ImageObject",
			url: absoluteUrl("/favicon_io/android-chrome-512x512.png"),
			width: 512,
			height: 512,
		},
		sameAs: [SOURCE_CODE_GITHUB_URL, X_PROFILE_URL],
	};
}

/** Site-wide graph: the publisher Organization and the WebSite it owns. */
export function websiteJsonLd() {
	return {
		"@context": "https://schema.org",
		"@graph": [
			organizationJsonLd(),
			{
				"@type": "WebSite",
				"@id": JSON_LD_ID.website,
				name: SITE_INFO.name,
				url: SITE_INFO.url,
				description: SITE_INFO.description,
				inLanguage: "en-US",
				publisher: { "@id": JSON_LD_ID.organization },
			},
		],
	};
}

/** The TentUI component and block library as a whole, for the home page. */
export function libraryJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareSourceCode",
		"@id": JSON_LD_ID.library,
		name: `${SITE_INFO.name} components and blocks`,
		description:
			"Free, source-available React components and landing-page blocks for shadcn/ui and Tailwind CSS. Install them with the shadcn CLI and customize the source.",
		url: SITE_INFO.url,
		keywords: [
			"React components",
			"shadcn/ui",
			"shadcn blocks",
			"Tailwind CSS",
			"TypeScript",
			"UI components",
		].join(", "),
		...sourceCodeJsonLdProperties(),
		isPartOf: { "@id": JSON_LD_ID.website },
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
