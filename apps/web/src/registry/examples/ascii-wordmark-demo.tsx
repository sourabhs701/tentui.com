"use client";

import { useDialKit } from "dialkit";
import { useDeferredValue } from "react";

import { AsciiWordmark } from "@/registry/components/ascii-wordmark/ascii-wordmark";

export default function AsciiWordmarkDemo() {
	const params = useDialKit("ASCII Wordmark", {
		text: {
			type: "text",
			default: "Localhost",
			placeholder: "Enter text",
		},
		inkColor: {
			type: "color",
			default: "#8278ff",
		},
	});
	const word = useDeferredValue(params.text.trim() || "Localhost");
	const inkColor = useDeferredValue(params.inkColor);

	return (
		<div className="flex min-h-[32rem] w-full items-center bg-background px-4 py-12 sm:px-8">
			<AsciiWordmark
				className="min-h-64 sm:min-h-80"
				inkColor={inkColor}
				word={word}
			/>
		</div>
	);
}
