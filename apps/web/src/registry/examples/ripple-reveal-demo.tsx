"use client";

import { type ReactNode, useState } from "react";

import {
	RippleReveal,
	RippleRevealSurface,
	RippleRevealTrigger,
} from "@/registry/components/ripple-reveal/ripple-reveal";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function RippleRevealDemo() {
	const [salaryShown, setSalaryShown] = useState(false);

	return (
		<div className="flex w-full max-w-sm flex-col items-center gap-10 py-4">
			<Section title="Inline, on any surface">
				<div className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card py-2 pr-2 pl-4 shadow-xs">
					<p className="text-muted-foreground text-sm">Available balance</p>
					<RippleReveal className="flex items-center gap-1">
						<RippleRevealSurface className="font-semibold text-base text-foreground tabular-nums">
							$8,240.15
						</RippleRevealSurface>
						<RippleRevealTrigger label="Show available balance" />
					</RippleReveal>
				</div>
			</Section>

			<Section title="Controlled, sound off">
				<div className="flex w-full flex-col gap-1 rounded-xl border bg-card py-2 pr-2 pl-4 shadow-xs">
					<div className="flex items-center justify-between gap-3">
						<p className="text-muted-foreground text-sm">October salary</p>
						<RippleReveal
							revealed={salaryShown}
							onRevealedChange={setSalaryShown}
							sound={false}
							className="flex items-center gap-1"
						>
							<RippleRevealSurface
								hiddenLabel="Salary hidden"
								className="font-semibold text-base text-foreground tabular-nums"
							>
								$6,450.00
							</RippleRevealSurface>
							<RippleRevealTrigger label="Show salary" />
						</RippleReveal>
					</div>
					<p className="pb-1 text-muted-foreground text-xs">
						{salaryShown ? "Salary is shown. " : "Salary is hidden. "}
						<button
							type="button"
							onClick={() => setSalaryShown((shown) => !shown)}
							className="rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							{salaryShown ? "Hide it" : "Show it"} from outside
						</button>
					</p>
				</div>
			</Section>
		</div>
	);
}

export default RippleRevealDemo;
