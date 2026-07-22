"use client";

import { PeepingButton } from "@/registry/components/peeping-button";

export function PeepingButtonDemo() {
	return (
		<div className="flex w-full flex-col items-center gap-5 px-6 text-center">
			<PeepingButton
				className="min-w-44"
				coverClassName="px-7 py-3.5"
				peekDelay={[700, 1200]}
				peekDuration={2600}
			>
				Don&apos;t look away
			</PeepingButton>
			<p className="max-w-xs text-balance text-muted-foreground text-sm">
				Move your pointer around the preview when the eyes appear.
			</p>
		</div>
	);
}

export default PeepingButtonDemo;
