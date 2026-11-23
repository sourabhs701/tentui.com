"use client";

import { RangeSpan } from "@/registry/components/range-span/range-span";

const formatUsd = (value: number) => `$${value}`;

function RangeSpanPreview() {
	return (
		<div className="w-full max-w-[340px] px-4 py-2">
			<RangeSpan
				label="Price range"
				min={0}
				max={600}
				step={10}
				minGap={40}
				defaultValue={[140, 440]}
				format={formatUsd}
			/>
		</div>
	);
}

export default RangeSpanPreview;
