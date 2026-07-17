import { LRUCache } from "lru-cache";
import { codeToHtml } from "shiki";

const highlightCache = new LRUCache<string, string>({
	max: 500,
	ttl: 1000 * 60 * 60,
});

async function hashKey(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function highlightCode(code: string, language = "tsx") {
	const cacheKey = await hashKey(`${language}:${code}`);
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
