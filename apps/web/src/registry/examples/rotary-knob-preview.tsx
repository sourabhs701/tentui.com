"use client";

import { RotaryKnob } from "@/registry/components/rotary-knob/rotary-knob";

function RotaryKnobPreview() {
	return (
		<RotaryKnob
			aria-label="Volume"
			variant="tactile"
			size="lg"
			defaultValue={40}
			showValue
		/>
	);
}

export default RotaryKnobPreview;
