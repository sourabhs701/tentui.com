import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextCircleDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Focus on what is <ScribbledText variant="circle">important</ScribbledText>
			.
		</p>
	);
}

export default ScribbledTextCircleDemo;
