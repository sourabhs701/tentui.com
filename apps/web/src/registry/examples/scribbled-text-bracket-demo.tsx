import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextBracketDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Keep these <ScribbledText variant="bracket">ideas together</ScribbledText>
			.
		</p>
	);
}

export default ScribbledTextBracketDemo;
