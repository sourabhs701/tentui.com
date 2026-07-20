import { ScribbledText } from "@/registry/components/scribbled-text";

export function ScribbledTextCrossOutDemo() {
	return (
		<p className="px-8 text-center text-2xl text-foreground sm:text-3xl">
			Rethink the <ScribbledText variant="crossOut">first draft</ScribbledText>.
		</p>
	);
}

export default ScribbledTextCrossOutDemo;
