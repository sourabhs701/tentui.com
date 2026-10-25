"use client";

import { NumberStepper } from "@/registry/components/number-stepper/number-stepper";

function NumberStepperPreview() {
	return (
		<NumberStepper
			label="Quantity"
			variant="pill"
			size="lg"
			defaultValue={3}
			min={1}
			max={12}
		/>
	);
}

export default NumberStepperPreview;
