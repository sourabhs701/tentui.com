import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextBoxDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Save this <ScribbledText variant="box">final thought</ScribbledText>.
		</p>
	);
}

export default ScribbledTextBoxDemo;
