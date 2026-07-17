export const META_THEME_COLORS = {
	light: "#ffffff",
	dark: "#09090b",
};

export const MAIN_NAV = [
	{ title: "Components", href: "/components" },
	{ title: "Blocks", href: "/blocks" },
] as const;

export const MOBILE_NAV = [{ title: "Home", href: "/" }, ...MAIN_NAV] as const;

export const GITHUB_REPOSITORY = "sourabhs701/tentui.com";

export const UTM_PARAMS = {
	utm_source: "tentui.com",
};
