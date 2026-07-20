import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextDoubleUnderlineDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			This point deserves{" "}
			<ScribbledText variant="doubleUnderline">extra emphasis</ScribbledText>.
		</p>
	);
}

export default ScribbledTextDoubleUnderlineDemo;
