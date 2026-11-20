"use client";

import { RangeSpan } from "@/registry/components/range-span/range-span";

const formatUsd = (value: number) => `$${value}`;

function RangeSpanPreview() {
	return (
		<RangeSpan
			label="Price range"
			min={0}
			max={600}
			step={10}
			minGap={40}
			defaultValue={[140, 440]}
			format={formatUsd}
			className="w-[300px] max-w-full"
		/>
	);
}

export default RangeSpanPreview;
