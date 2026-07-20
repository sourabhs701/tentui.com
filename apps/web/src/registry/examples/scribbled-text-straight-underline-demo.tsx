import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextStraightUnderlineDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Keep the message{" "}
			<ScribbledText variant="straightUnderline">
				clear and direct
			</ScribbledText>
			.
		</p>
	);
}

export default ScribbledTextStraightUnderlineDemo;
