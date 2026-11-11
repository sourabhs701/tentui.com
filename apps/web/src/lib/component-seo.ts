import { SITE_INFO } from "@/config/site";
import type { Doc } from "@/lib/documents";

const TITLE_SUFFIX = ` – ${SITE_INFO.name}`;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

/**
 * Full search title, including the site suffix. Uses the longest keyword
 * pattern that fits in ~60 characters, or the `seoTitle` frontmatter override.
 */
export function getComponentSeoTitle(doc: Doc) {
	const { title, seoTitle } = doc.metadata;
	if (seoTitle) return `${seoTitle}${TITLE_SUFFIX}`;

	const candidates = [
		`React ${title} Component for shadcn/ui`,
		`React ${title} for shadcn/ui`,
		`${title} React Component`,
	];
	const match = candidates.find(
		(candidate) => candidate.length + TITLE_SUFFIX.length <= MAX_TITLE_LENGTH,
	);

	return `${match ?? title}${TITLE_SUFFIX}`;
}

/**
 * Meta description. Prefers the `seoDescription` frontmatter override, then
 * appends stack context to the visible description when it fits.
 */
export function getComponentSeoDescription(doc: Doc) {
	const { description, seoDescription } = doc.metadata;
	if (seoDescription) return seoDescription;
	if (/\breact\b/i.test(description)) return description;

	const withStack = `${description} A React component for shadcn/ui and Tailwind CSS.`;
	return withStack.length <= MAX_DESCRIPTION_LENGTH ? withStack : description;
}

export function getComponentKeywords(doc: Doc) {
	// Titles like "Animated Tabs for React and shadcn/ui" already carry the stack.
	const name = doc.metadata.title.replace(/\s+for\s+React\b.*$/i, "");

	return [
		name,
		`React ${name}`,
		`${name} component`,
		"React",
		"shadcn/ui",
		"Tailwind CSS",
		"TypeScript",
	];
}
