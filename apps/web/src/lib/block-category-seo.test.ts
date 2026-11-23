import assert from "node:assert/strict";

import { blockCategories } from "../config/registry";
import { blocks as registryBlocks } from "../registry/blocks/_registry";
import { getBlockCategoryCopy } from "./block-category-seo";

const footer = blockCategories.find((category) => category.name === "footer");
const cta = blockCategories.find((category) => category.name === "cta");
assert.ok(footer && cta);

const footerCopy = getBlockCategoryCopy(footer, [
	{
		name: "footer-02",
		title: "Footer 02",
		description: "A grain-textured footer.",
		dependencies: ["lucide-react"],
		registryDependencies: [
			"button",
			"separator",
			"https://tentui.com/r/peeping-button.json",
		],
	},
	{ name: "footer-01", title: "Footer 01", description: "A product footer." },
]);
assert.equal(
	footerCopy.intro,
	"TentUI's 2 shadcn footer blocks are free, source-available, copy-paste React sections built with shadcn/ui and Tailwind CSS.",
);
assert.equal(
	footerCopy.installCommand,
	"npx shadcn@latest add @tentui/footer-02",
);
assert.equal(footerCopy.faq.length, 4);
assert.ok(
	footerCopy.faq[0].answer.endsWith(
		"installs the lucide-react package, the shadcn/ui button and separator components, and the TentUI peeping-button component.",
	),
);
assert.equal(
	footerCopy.faq[1].answer,
	"TentUI has 2 shadcn footer blocks. Footer 02: A grain-textured footer. Footer 01: A product footer.",
);

const ctaCopy = getBlockCategoryCopy(cta, [{ name: "cta-01" }]);
assert.ok(ctaCopy.intro.startsWith("TentUI's shadcn CTA block is a free"));
assert.equal(ctaCopy.faq[0].question, "How do I install the shadcn CTA block?");
assert.equal(
	ctaCopy.faq[0].answer.includes("swapping in"),
	false,
	"single-block install answer",
);
assert.deepEqual(getBlockCategoryCopy(cta, []).faq, []);

// Every category has blocks, an SEO title that fits 60 characters with the
// " – TentUI" suffix, and FAQ questions that end in "?".
for (const category of blockCategories) {
	const categoryBlocks = registryBlocks.filter((block) =>
		block.categories?.includes(category.name),
	);
	assert.ok(categoryBlocks.length > 0, `${category.name}: no blocks`);
	assert.ok(
		`${category.seoTitle} – TentUI`.length <= 60,
		`${category.name}: seoTitle too long`,
	);
	assert.ok(
		category.description.length <= 160,
		`${category.name}: description too long`,
	);
	assert.ok(!/open[- ]source/i.test(category.description), category.name);

	for (const item of getBlockCategoryCopy(category, categoryBlocks).faq) {
		assert.ok(item.question.endsWith("?"), item.question);
		assert.ok(!/open[- ]source/i.test(item.answer), item.question);
	}
}
