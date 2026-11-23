import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { SITE_INFO } from "../config/site";

// Search engines cut titles past ~60 characters and descriptions past ~160.
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;
const TITLE_SUFFIX = ` – ${SITE_INFO.name}`;

const contentDir = path.join(import.meta.dirname, "../content/components");

function frontmatterValue(source: string, key: string) {
	const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
	return match?.[1]?.trim().replace(/^"(.*)"$/, "$1");
}

for (const file of readdirSync(contentDir).filter((f) => f.endsWith(".mdx"))) {
	const source = readFileSync(path.join(contentDir, file), "utf8");
	const seoTitle = frontmatterValue(source, "seoTitle");
	const seoDescription = frontmatterValue(source, "seoDescription");

	if (seoTitle) {
		assert.ok(
			`${seoTitle}${TITLE_SUFFIX}`.length <= MAX_TITLE_LENGTH,
			`${file}: seoTitle is too long with the site suffix`,
		);
	}
	if (seoDescription) {
		assert.ok(
			seoDescription.length <= MAX_DESCRIPTION_LENGTH,
			`${file}: seoDescription is ${seoDescription.length} characters (max ${MAX_DESCRIPTION_LENGTH})`,
		);
	}
}

console.log("component SEO frontmatter ok");
