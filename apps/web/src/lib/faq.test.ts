import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { faqPageJsonLd, getFaqItems } from "./faq";

// Questions are `###` headings under `## FAQ`; answers are plain text.
const fixture = `
## Usage

### Not a question

Ignored.

## FAQ

### Is it accessible?

Yes. It is a \`slider\` named by \`aria-label\`, see the
[guide](/docs/installation).

<Callout>Extra **detail**.</Callout>

### Has no answer?

### Can I list things?

- One
- Two

## API reference

### Props

Ignored.
`;

assert.deepEqual(getFaqItems(fixture), [
	{
		question: "Is it accessible?",
		answer:
			"Yes. It is a slider named by aria-label, see the guide. Extra detail.",
	},
	{ question: "Can I list things?", answer: "One Two" },
]);
assert.deepEqual(getFaqItems("## Usage\n\n### Question?\n\nAnswer."), []);

const jsonLd = faqPageJsonLd(getFaqItems(fixture), "https://tentui.com/x");
assert.equal(jsonLd["@type"], "FAQPage");
assert.equal(jsonLd.mainEntity.length, 2);
assert.equal(jsonLd.mainEntity[0].acceptedAnswer.text.includes("`"), false);

// Every component FAQ parses: each `###` under it is a question with an answer.
const docsDirectory = path.join(process.cwd(), "src/content/components");
for (const file of fs.readdirSync(docsDirectory)) {
	if (path.extname(file) !== ".mdx") continue;

	const { content } = matter(
		fs.readFileSync(path.join(docsDirectory, file), "utf8"),
	);
	const section = content.split(/^## FAQ$/m)[1]?.split(/^## /m)[0];
	if (section === undefined) continue;

	const questions = section.match(/^### .+$/gm) ?? [];
	const items = getFaqItems(content);
	assert.ok(items.length > 0, `${file}: empty FAQ section`);
	assert.equal(items.length, questions.length, `${file}: unanswered question`);
	for (const item of items) {
		assert.ok(item.question.endsWith("?"), `${file}: "${item.question}"`);
	}
}
