"use client";

import { TickRuler } from "@/registry/components/tick-ruler/tick-ruler";

function TickRulerDemo() {
	return (
		<div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
			<div className="mb-4">
				<p className="font-medium text-sm">Focus session</p>
				<p className="text-muted-foreground text-xs">
					How long should this block run?
				</p>
			</div>
			<TickRuler
				label="Focus session length"
				defaultValue={25}
				min={0}
				max={90}
				majorEvery={5}
				labelEvery={15}
				unit="min"
				presets={[5, 15, 25, 45]}
			/>
		</div>
	);
}

export default TickRulerDemo;
