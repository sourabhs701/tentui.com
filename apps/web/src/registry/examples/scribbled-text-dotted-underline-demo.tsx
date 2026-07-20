import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextDottedUnderlineDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Leave room for{" "}
			<ScribbledText variant="dottedUnderline">small ideas</ScribbledText>.
		</p>
	);
}

export default ScribbledTextDottedUnderlineDemo;
