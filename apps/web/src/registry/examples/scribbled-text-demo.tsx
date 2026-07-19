import {
	ScribbledText,
	type ScribbledTextVariant,
} from "@/registry/components/scribbled-text";

const examples: Array<{
	label: string;
	variant: ScribbledTextVariant;
	scribbleClassName?: string;
}> = [
	{ label: "Wavy underline", variant: "wavyUnderline" },
	{ label: "Circled text", variant: "circle" },
	{ label: "Highlighted text", variant: "highlight" },
	{
		label: "Simple underline",
		variant: "underline",
		scribbleClassName: "text-cyan-300",
	},
	{
		label: "Straight line",
		variant: "straightUnderline",
		scribbleClassName: "text-orange-300",
	},
	{ label: "Dotted underline", variant: "dottedUnderline" },
	{ label: "Double underline", variant: "doubleUnderline" },
	{ label: "Strikethrough", variant: "strikethrough" },
	{ label: "Crossed out", variant: "crossOut" },
	{
		label: "Arrow underline",
		variant: "arrowUnderline",
		scribbleClassName: "text-rose-300",
	},
	{ label: "Bracketed text", variant: "bracket" },
	{ label: "Boxed text", variant: "box" },
];

export function ScribbledTextDemo() {
	return (
		<div className="relative flex min-h-[56rem] w-full items-center justify-center overflow-hidden bg-background px-8 py-14">
			<div className="relative flex flex-col items-start gap-7 text-2xl text-foreground sm:text-3xl">
				{examples.map(({ label, variant, scribbleClassName }) => (
					<ScribbledText
						key={variant}
						variant={variant}
						scribbleClassName={scribbleClassName}
					>
						{label}
					</ScribbledText>
				))}
			</div>
		</div>
	);
}

export default ScribbledTextDemo;
