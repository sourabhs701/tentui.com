import type { FaqItem } from "@/lib/faq";

export type LandingFaqItem = FaqItem & { id: string };

/**
 * Home page FAQ. The same items render in the accordion and in the FAQPage
 * JSON-LD, so keep answers as plain text that matches the docs.
 */
export function getLandingFaqItems({
	componentCount,
	blockCount,
}: {
	componentCount: number;
	blockCount: number;
}): LandingFaqItem[] {
	return [
		{
			id: "what-is-tentui",
			question: "What is TentUI?",
			answer: `TentUI is a free, source-available library of ${componentCount} animated React components and ${blockCount} landing-page blocks, built with Tailwind CSS for shadcn/ui projects. Each item installs with the shadcn CLI, which copies its source into your codebase.`,
		},
		{
			id: "install",
			question: "How do I install TentUI components?",
			answer:
				'Add "@tentui": "https://tentui.com/r/{name}.json" to the registries object in components.json, then run npx shadcn@latest add @tentui/animated-arrow with the item you want. You can also skip the registry setup and pass the full URL, for example npx shadcn@latest add https://tentui.com/r/animated-arrow.json.',
		},
		{
			id: "frameworks",
			question: "Does TentUI work with Next.js and shadcn/ui?",
			answer:
				"Yes. TentUI works in any React framework that shadcn/ui supports, including Next.js, as long as Tailwind CSS is configured and the project has a components.json file. The components are written in TypeScript.",
		},
		{
			id: "free",
			question: "Is TentUI free to use?",
			answer:
				"Yes. TentUI is free and source-available. You can use the components and blocks in unlimited personal and client projects under the TentUI License, but you can't resell or redistribute them as components or templates.",
		},
		{
			id: "customize",
			question: "Can I customize every component?",
			answer:
				"Yes. There is no TentUI runtime package: the CLI copies the source into your project, so you can change tokens, layout, behavior, and motion directly.",
		},
		{
			id: "updates",
			question: "How do I get updates?",
			answer:
				"Installed components don't update automatically. To pull a newer version, run the add command again and review the CLI's overwrite prompt and diff before accepting it.",
		},
	];
}
