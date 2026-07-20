"use client";

import { useDialKit } from "dialkit";
import type { CSSProperties } from "react";

import {
	ScribbledText,
	type ScribbledTextVariant,
} from "@/registry/components/scribbled-text";

const variantOptions: Array<{
	label: string;
	value: ScribbledTextVariant;
}> = [
	{ label: "Wavy underline", value: "wavyUnderline" },
	{ label: "Circle", value: "circle" },
	{ label: "Highlight", value: "highlight" },
	{ label: "Underline", value: "underline" },
	{ label: "Straight underline", value: "straightUnderline" },
	{ label: "Dotted underline", value: "dottedUnderline" },
	{ label: "Double underline", value: "doubleUnderline" },
	{ label: "Strikethrough", value: "strikethrough" },
	{ label: "Cross out", value: "crossOut" },
	{ label: "Arrow underline", value: "arrowUnderline" },
	{ label: "Bracket", value: "bracket" },
	{ label: "Box", value: "box" },
];

type PreviewStyle = CSSProperties & {
	"--scribble-color": string;
};

export function ScribbledTextDemo() {
	const params = useDialKit("Scribbled Text", {
		text: {
			type: "text",
			default: "Scribbled Text",
			placeholder: "Enter text",
		},
		variant: {
			type: "select",
			options: variantOptions,
			default: "wavyUnderline",
		},
		animated: true,
		scribbleColor: {
			type: "color",
			default: "#c4b5fd",
		},
		fontSize: [48, 20, 96, 1],
	});
	const variant = params.variant as ScribbledTextVariant;
	const style: PreviewStyle = {
		"--scribble-color": params.scribbleColor,
		fontSize: params.fontSize,
	};

	return (
		<div className="relative flex min-h-96 w-full items-center justify-center overflow-hidden bg-background px-8 py-14">
			<ScribbledText
				key={`${variant}-${params.animated}`}
				animated={params.animated}
				variant={variant}
				scribbleClassName="text-(--scribble-color)"
				style={style}
			>
				{params.text || "Scribbled Text"}
			</ScribbledText>
		</div>
	);
}

export default ScribbledTextDemo;
