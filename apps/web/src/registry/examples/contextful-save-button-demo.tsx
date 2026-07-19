"use client";

import { ContextfulSaveButton } from "@/registry/components/contextful-save-button";

type DemoOutcome = "success" | "error";

function simulateAction(outcome: DemoOutcome) {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => {
			if (outcome === "error") {
				reject(new Error("Demo action failed"));
				return;
			}

			resolve();
		}, 1200);
	});
}

function ContextfulSaveButtonDemo() {
	return (
		<div className="grid w-full max-w-xl gap-8 px-4 sm:grid-cols-2">
			<section className="flex flex-col items-center gap-4">
				<ContextfulSaveButton onClick={() => simulateAction("success")} />
				<p className="text-muted-foreground text-xs">Successful actions</p>
			</section>

			<section className="flex flex-col items-center gap-4">
				<ContextfulSaveButton onClick={() => simulateAction("error")} />
				<p className="text-muted-foreground text-xs">Failed actions</p>
			</section>
		</div>
	);
}

export default ContextfulSaveButtonDemo;
