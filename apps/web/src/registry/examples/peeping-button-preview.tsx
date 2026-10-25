"use client";

import { PeepingButton } from "@/registry/components/peeping-button/peeping-button";

function PeepingButtonPreview() {
	return (
		<PeepingButton
			className="min-w-44"
			coverClassName="px-7 py-3.5"
			peekDelay={[700, 1200]}
			peekDuration={2600}
		>
			Don&apos;t look away
		</PeepingButton>
	);
}

export default PeepingButtonPreview;
