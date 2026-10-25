"use client";

import { useEffect, useState } from "react";

import {
	ScribbledText,
	type ScribbledTextVariant,
} from "@/registry/components/scribbled-text";

const variants: ScribbledTextVariant[] = [
	"wavyUnderline",
	"circle",
	"highlight",
	"crossOut",
];

function ScribbledTextPreview() {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const interval = window.setInterval(
			() => setIndex((current) => (current + 1) % variants.length),
			2000,
		);
		return () => window.clearInterval(interval);
	}, []);

	const variant = variants[index];

	return (
		<p className="whitespace-nowrap px-6 text-center font-medium text-3xl text-foreground tracking-tight sm:text-4xl">
			Make it{" "}
			<ScribbledText
				key={variant}
				variant={variant}
				scribbleClassName={
					variant === "highlight" ? undefined : "text-violet-400"
				}
			>
				memorable
			</ScribbledText>
		</p>
	);
}

export default ScribbledTextPreview;
