"use client";

import { Volume1, Volume2 } from "lucide-react";

import { ElasticSlider } from "@/registry/components/elastic-slider/elastic-slider";

function ElasticSliderPreview() {
	return (
		<ElasticSlider
			label="Volume"
			defaultValue={40}
			startIcon={<Volume1 />}
			endIcon={<Volume2 />}
			className="w-[280px] max-w-full"
		/>
	);
}

export default ElasticSliderPreview;
