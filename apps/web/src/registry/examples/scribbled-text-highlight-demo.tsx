import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextHighlightDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Remember the <ScribbledText variant="highlight">key detail</ScribbledText>
			.
		</p>
	);
}

export default ScribbledTextHighlightDemo;
