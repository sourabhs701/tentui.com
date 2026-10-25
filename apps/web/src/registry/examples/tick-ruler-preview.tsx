"use client";

import { TickRuler } from "@/registry/components/tick-ruler/tick-ruler";

function TickRulerPreview() {
	return (
		<div className="w-full max-w-[360px]">
			<TickRuler
				label="Duration"
				defaultValue={25}
				min={0}
				max={90}
				majorEvery={5}
				labelEvery={15}
				unit="min"
			/>
		</div>
	);
}

export default TickRulerPreview;
