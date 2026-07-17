export const META_THEME_COLORS = {
	light: "#ffffff",
	dark: "#09090b",
};

export const SITE_INFO = {
	name: "TentUI",
	url: "https://tentui.com",
	description:
		"Beautiful, open-source interface blocks for modern web applications.",
} as const;

export const MAIN_NAV = [
	{ title: "Components", href: "/components" },
	{ title: "Blocks", href: "/blocks" },
] as const;

export const MOBILE_NAV = [{ title: "Home", href: "/" }, ...MAIN_NAV] as const;

export const GITHUB_REPOSITORY = "sourabhs701/tentui.com";
export const SOURCE_CODE_GITHUB_URL = `https://github.com/${GITHUB_REPOSITORY}`;

export const UTM_PARAMS = {
	utm_source: "tentui.com",
};
