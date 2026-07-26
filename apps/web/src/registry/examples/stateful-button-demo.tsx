"use client";

import { useDialKit } from "dialkit";

import { StatefulButton } from "@/registry/components/stateful-button";

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

function StatefulButtonDemo() {
	const labels = useDialKit("Stateful Button", {
		idle: {
			type: "text",
			default: "Save changes",
			placeholder: "Idle label",
		},
		loading: {
			type: "text",
			default: "Saving",
			placeholder: "Loading label",
		},
		success: {
			type: "text",
			default: "Saved",
			placeholder: "Success label",
		},
		error: {
			type: "text",
			default: "Try again",
			placeholder: "Error label",
		},
	});
	const feedbackLabels = {
		loading: labels.loading,
		success: labels.success,
		error: labels.error,
	};

	return (
		<div className="grid w-full max-w-xl gap-8 px-4 sm:grid-cols-2">
			<section className="flex flex-col items-center gap-4">
				<StatefulButton
					labels={feedbackLabels}
					onClick={() => simulateAction("success")}
				>
					{labels.idle}
				</StatefulButton>
				<p className="text-muted-foreground text-xs">Successful actions</p>
			</section>

			<section className="flex flex-col items-center gap-4">
				<StatefulButton
					labels={feedbackLabels}
					onClick={() => simulateAction("error")}
				>
					{labels.idle}
				</StatefulButton>
				<p className="text-muted-foreground text-xs">Failed actions</p>
			</section>
		</div>
	);
}

export default StatefulButtonDemo;
