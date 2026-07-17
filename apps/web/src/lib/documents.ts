import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";

export type DocMetadata = {
	title: string;
	description: string;
	image?: string;
	new?: boolean;
	createdAt: string;
	updatedAt: string;
};

export type Doc = {
	metadata: DocMetadata;
	slug: string;
	content: string;
};

const CONTENT_DIRECTORY = path.join(process.cwd(), "src/content/components");

export const getComponentDocs = cache(() => {
	return fs
		.readdirSync(CONTENT_DIRECTORY)
		.filter((file) => path.extname(file) === ".mdx")
		.map<Doc>((file) => {
			const parsed = matter(
				fs.readFileSync(path.join(CONTENT_DIRECTORY, file), "utf8"),
			);

			return {
				metadata: parsed.data as DocMetadata,
				slug: path.basename(file, ".mdx"),
				content: parsed.content,
			};
		})
		.sort((a, b) =>
			a.metadata.title.localeCompare(b.metadata.title, "en", {
				sensitivity: "base",
			}),
		);
});

export function getComponentDocBySlug(slug: string) {
	return getComponentDocs().find((doc) => doc.slug === slug);
}

export function findNeighbour(docs: Doc[], slug: string) {
	const index = docs.findIndex((doc) => doc.slug === slug);

	return {
		previous: index > 0 ? docs[index - 1] : null,
		next: index >= 0 && index < docs.length - 1 ? docs[index + 1] : null,
	};
}
