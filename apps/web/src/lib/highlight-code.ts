import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import { codeToHtml } from "shiki";

const highlightCache = new LRUCache<string, string>({
	max: 500,
	ttl: 1000 * 60 * 60,
});

export async function highlightCode(code: string, language = "tsx") {
	const cacheKey = createHash("sha256")
		.update(`${language}:${code}`)
		.digest("hex");
	const cached = highlightCache.get(cacheKey);

	if (cached) {
		return cached;
	}

	const html = await codeToHtml(code, {
		lang: language,
		themes: {
			dark: "vesper",
			light: "github-light",
		},
		defaultColor: false,
		transformers: [
			{
				pre(node) {
					node.properties.style = "";
				},
				code(node) {
					node.properties["data-line-numbers"] = "";
					node.properties.style = "display: grid";
				},
				line(node) {
					node.properties["data-line"] = "";
				},
			},
		],
	});

	highlightCache.set(cacheKey, html);
	return html;
}
