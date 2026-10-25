import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Only the grammars and themes the docs use. Importing `shiki` itself would
// bundle every language and theme into the Worker, even though content pages
// are highlighted at build time. Unknown languages fall back to plain text, so
// add a grammar here before using a new fence language in MDX.
let highlighter: Promise<HighlighterCore> | undefined;

export function getHighlighter() {
	highlighter ??= createHighlighterCore({
		themes: [
			import("shiki/themes/vesper.mjs"),
			import("shiki/themes/github-light.mjs"),
			import("shiki/themes/github-light-default.mjs"),
		],
		langs: [
			import("shiki/langs/tsx.mjs"),
			import("shiki/langs/typescript.mjs"),
			import("shiki/langs/bash.mjs"),
			import("shiki/langs/json.mjs"),
		],
		engine: createJavaScriptRegexEngine(),
	});
	return highlighter;
}
