"use client";

import {
	PrimaryButton,
	SecondaryButton,
	ThreeDButton,
	ThreeDDestructiveButton,
} from "@/registry/components/tailwindcss-buttons";

function TailwindcssButtonsPreview() {
	return (
		<div className="grid grid-cols-2 place-items-center gap-x-10 gap-y-14 max-sm:gap-x-6 max-sm:gap-y-10">
			<PrimaryButton />
			<SecondaryButton />
			<ThreeDButton />
			<ThreeDDestructiveButton />
		</div>
	);
}

export default TailwindcssButtonsPreview;
