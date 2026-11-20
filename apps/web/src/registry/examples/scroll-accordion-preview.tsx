"use client";

import { ScrollAccordion } from "@/registry/components/scroll-accordion/scroll-accordion";

const STEPS = [
	{
		id: "grind",
		title: "Grind",
		meta: "0:00",
		content: (
			<>
				<p>
					Weigh 15 g of beans and grind them medium-fine, like coarse sand.
					Grind just before brewing: ground coffee loses its aroma within
					minutes.
				</p>
				<p className="mt-3">
					Rinse the paper filter with hot water to wash out the papery taste and
					warm the dripper, then pour that water away.
				</p>
			</>
		),
	},
	{
		id: "bloom",
		title: "Bloom",
		meta: "0:30",
		content: (
			<>
				<p>
					Pour 45 g of water just off the boil, enough to wet every grain. The
					bed swells and bubbles as trapped gas escapes.
				</p>
				<p className="mt-3">
					Give it thirty seconds. Water that hits degassed grounds extracts
					evenly instead of channelling around the bubbles.
				</p>
			</>
		),
	},
	{
		id: "first-pour",
		title: "First pour",
		meta: "1:15",
		content: (
			<>
				<p>
					Pour in slow spirals from the centre out to 150 g, keeping the stream
					thin and steady and off the paper walls.
				</p>
				<p className="mt-3">
					A level bed is the goal. If one side sinks faster, aim the next spiral
					there.
				</p>
				<p className="mt-3">
					Keep the spout low, a few centimetres above the bed, so the stream
					stirs the grounds without digging a crater.
				</p>
			</>
		),
	},
	{
		id: "second-pour",
		title: "Second pour",
		meta: "1:45",
		content: (
			<>
				<p>
					Top up to 250 g once the level has dropped about a finger. Swirl the
					dripper gently to flatten the bed.
				</p>
				<p className="mt-3">
					Stop pouring with water still above the grounds so the last of it
					drains through a settled, even bed.
				</p>
			</>
		),
	},
	{
		id: "drawdown",
		title: "Drawdown",
		meta: "3:00",
		content: (
			<>
				<p>
					Let it drain. A flat bed with no grounds on the walls means an even
					extraction, finishing around the three minute mark.
				</p>
				<p className="mt-3">
					Sour? Grind finer next time. Bitter or slow? Grind coarser.
				</p>
			</>
		),
	},
];

function ScrollAccordionPreview({ defaultValue }: { defaultValue?: string }) {
	return (
		<div className="w-full max-w-sm py-8">
			<ScrollAccordion
				aria-label="Pour-over guide"
				items={STEPS}
				defaultValue={defaultValue}
				height={320}
				numbered={false}
			/>
		</div>
	);
}

export default ScrollAccordionPreview;
