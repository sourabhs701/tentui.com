"use client";

import { StatefulButton } from "@/registry/components/stateful-button";

function simulateAction() {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, 1200);
	});
}

function StatefulButtonPreview() {
	return (
		<StatefulButton
			labels={{ loading: "Saving", success: "Saved", error: "Try again" }}
			onClick={simulateAction}
		>
			Save changes
		</StatefulButton>
	);
}

export default StatefulButtonPreview;
