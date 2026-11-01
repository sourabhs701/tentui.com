"use client";

import { SplitFlap } from "@/registry/components/split-flap/split-flap";

const words = ["BOARDING", "ON TIME", "DEPARTED"];

function SplitFlapPreview() {
	return (
		<SplitFlap values={words} length={8} size="lg" autoplay interval={2500} />
	);
}

export default SplitFlapPreview;
