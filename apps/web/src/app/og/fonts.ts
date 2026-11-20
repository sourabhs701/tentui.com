type OgFont = {
	name: string;
	data: ArrayBuffer;
	weight: 400 | 500 | 600 | 700;
	style: "normal";
};

/**
 * Fetches a Google Font as TTF, subset to `text` so each request stays small.
 * Without a browser user agent the CSS API answers with `format('truetype')`,
 * which Satori can parse (it can't read woff2).
 */
async function loadGoogleFont(
	family: string,
	weight: OgFont["weight"],
	text: string,
): Promise<OgFont | null> {
	try {
		const css = await fetch(
			`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`,
		).then((response) => (response.ok ? response.text() : ""));
		const url = css.match(
			/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
		)?.[1];
		if (!url) return null;

		const response = await fetch(url);
		if (!response.ok) return null;

		return {
			name: family,
			data: await response.arrayBuffer(),
			weight,
			style: "normal",
		};
	} catch {
		return null;
	}
}

/**
 * Inter, matching the site, subset to `text`. Any weight that fails to load is
 * dropped, so the image still renders in the bundled fallback instead of
 * erroring.
 */
export async function loadOgFonts(text: string) {
	const fonts = await Promise.all([
		loadGoogleFont("Inter", 500, text),
		loadGoogleFont("Inter", 600, text),
	]);

	return fonts.filter((font): font is OgFont => font !== null);
}
