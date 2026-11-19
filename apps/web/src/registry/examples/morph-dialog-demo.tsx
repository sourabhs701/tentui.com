"use client";

import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import {
	MorphDialog,
	MorphDialogClose,
	MorphDialogContent,
	MorphDialogDescription,
	MorphDialogMedia,
	MorphDialogSubtitle,
	MorphDialogTitle,
	MorphDialogTrigger,
} from "@/registry/components/morph-dialog/morph-dialog";

const guides = [
	{
		title: "Above the cloud line",
		subtitle: "A slow week in the Dolomites",
		src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=960&h=600&q=75",
		alt: "Snowy peaks rising through clouds",
		body: [
			"Seven days hut to hut, starting in Val Gardena. Mornings begin above the fog, and the trail drops into it by noon.",
			"Pack light layers, a headlamp for the first hour, and cash for the rifugi.",
		],
	},
	{
		title: "Low tide",
		subtitle: "Three coves at sunrise",
		src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=960&h=600&q=75",
		alt: "Soft waves rolling onto a sandy beach at sunrise",
		body: [
			"The tide is lowest just after sunrise this month, which opens the rock pools between the three coves.",
			"Walk south first, so the light is behind you on the way back.",
		],
	},
	{
		title: "Still water",
		subtitle: "A long read on mountain lakes",
		src: "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=960&h=600&q=75",
		alt: "Turquoise lake between steep mountain slopes",
		body: [
			"Glacial lakes get their colour from rock flour: silt ground so fine by the ice that it hangs in the water and scatters blue and green light.",
			"The colour changes through the year. Early in the summer the meltwater carries the most flour, and the lakes look almost milky. By autumn the silt has settled and the water clears to a deeper green.",
			"Most of these lakes sit in cirques, bowls carved by the head of a glacier. A lip of harder rock or a moraine holds the water in.",
			"Swimming is allowed in most of them, but the water rarely passes 12 °C, even in August. Get in slowly and keep it short.",
			"The best light is early. Before the wind picks up, the surface is still enough to hold a reflection of the ridge, and the colour reads strongest with the sun behind you.",
			"Most trailheads fill by eight in summer. The first bus up the valley usually gets you to the shore before the day hikers, and the walk back down is easier in the afternoon heat.",
			"Bring a warm layer for after, and leave the shore as you found it: these lakes have no outflow to carry anything away.",
		],
	},
];

export default function MorphDialogDemo() {
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	return (
		<div className="flex w-full max-w-2xl flex-col gap-10 py-6">
			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">Cards</h3>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{guides.map((guide) => (
						<MorphDialog key={guide.title}>
							<MorphDialogTrigger className="rounded-2xl bg-card p-2 shadow-black/5 shadow-sm ring-1 ring-foreground/10">
								<MorphDialogMedia
									src={guide.src}
									alt={guide.alt}
									className="aspect-[4/3] w-full rounded-lg"
								/>
								<span className="block px-1.5 pt-2.5 pb-1">
									<MorphDialogTitle className="text-[15px] leading-5">
										{guide.title}
									</MorphDialogTitle>
									<MorphDialogSubtitle className="mt-0.5 text-[13px] leading-5">
										{guide.subtitle}
									</MorphDialogSubtitle>
								</span>
							</MorphDialogTrigger>
							<MorphDialogContent className="w-[min(calc(100vw-2rem),26rem)]">
								<div className="p-2">
									<MorphDialogMedia
										src={guide.src}
										alt={guide.alt}
										className="aspect-[2/1] w-full rounded-2xl"
									/>
								</div>
								<div className="px-5 pt-2 pb-5">
									<MorphDialogTitle className="text-xl leading-7">
										{guide.title}
									</MorphDialogTitle>
									<MorphDialogSubtitle className="text-sm leading-5">
										{guide.subtitle}
									</MorphDialogSubtitle>
									<MorphDialogDescription className="mt-4 space-y-3 text-muted-foreground text-sm leading-relaxed">
										{guide.body.map((paragraph) => (
											<p key={paragraph}>{paragraph}</p>
										))}
									</MorphDialogDescription>
								</div>
								<MorphDialogClose />
							</MorphDialogContent>
						</MorphDialog>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					Anchored form
				</h3>
				<div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed p-4">
					<p className="text-muted-foreground text-sm">
						The button grows into the form, right where it is.
					</p>
					<MorphDialog
						placement="anchor"
						open={feedbackOpen}
						onOpenChange={setFeedbackOpen}
					>
						<MorphDialogTrigger className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-card px-4 shadow-black/5 shadow-sm ring-1 ring-foreground/10">
							<MessageSquareIcon
								aria-hidden
								className="size-4 text-muted-foreground"
							/>
							<MorphDialogTitle className="font-medium text-sm">
								Feedback
							</MorphDialogTitle>
						</MorphDialogTrigger>
						<MorphDialogContent className="w-[min(calc(100vw-2rem),20rem)] rounded-[1.25rem]">
							<div className="px-4 pt-3.5">
								<MorphDialogTitle className="font-medium text-base leading-6">
									Feedback
								</MorphDialogTitle>
							</div>
							<MorphDialogDescription className="p-3 pt-2">
								<form
									className="flex flex-col gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										setFeedbackOpen(false);
									}}
								>
									<label htmlFor="morph-dialog-feedback" className="sr-only">
										Your feedback
									</label>
									<textarea
										id="morph-dialog-feedback"
										rows={4}
										placeholder="What would make this better?"
										className="w-full resize-none rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-ring/50 placeholder:text-muted-foreground focus-visible:ring-2"
									/>
									<div className="flex justify-end">
										<button
											type="submit"
											className="h-8 cursor-pointer rounded-full bg-primary px-3.5 font-medium text-primary-foreground text-sm outline-none ring-ring ring-offset-2 ring-offset-popover focus-visible:ring-2"
										>
											Send
										</button>
									</div>
								</form>
							</MorphDialogDescription>
							<MorphDialogClose className="top-2.5 right-2.5 size-7 bg-transparent shadow-none ring-0 backdrop-blur-none hover:bg-muted" />
						</MorphDialogContent>
					</MorphDialog>
				</div>
			</section>
		</div>
	);
}
