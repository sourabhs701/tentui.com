import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextWavyUnderlineDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Turn ideas into{" "}
			<ScribbledText variant="wavyUnderline">rough sketches</ScribbledText>.
		</p>
	);
}

export default ScribbledTextWavyUnderlineDemo;
