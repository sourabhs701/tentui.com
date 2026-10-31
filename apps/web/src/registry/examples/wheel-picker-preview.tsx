"use client";

import { WheelPicker } from "@/registry/components/wheel-picker/wheel-picker";

const durations = Array.from({ length: 60 }, (_, index) => ({
	value: String(index + 1),
	label: `${index + 1} min`,
}));

function WheelPickerPreview() {
	return (
		<WheelPicker
			aria-label="Timer duration"
			options={durations}
			defaultValue="15"
			className="w-40"
		/>
	);
}

export default WheelPickerPreview;
