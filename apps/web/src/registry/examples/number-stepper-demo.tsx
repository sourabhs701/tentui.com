"use client";

import type { ReactNode } from "react";

import { NumberStepper } from "@/registry/components/number-stepper/number-stepper";

function Row({
	title,
	hint,
	children,
}: {
	title: string;
	hint: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<div className="min-w-0">
				<p className="font-medium text-sm">{title}</p>
				<p className="text-muted-foreground text-xs">{hint}</p>
			</div>
			{children}
		</div>
	);
}

function NumberStepperDemo() {
	return (
		<div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
			<div className="mb-4">
				<p className="font-medium text-sm">Book a table</p>
				<p className="text-muted-foreground text-xs">
					Friday at the harbour, 8:00 pm
				</p>
			</div>
			<div className="divide-y">
				<Row title="Guests" hint="Up to 12 per table">
					<NumberStepper
						label="Guests"
						variant="pill"
						defaultValue={2}
						min={1}
						max={12}
					/>
				</Row>
				<Row title="Nights" hint="Stay at the inn upstairs">
					<NumberStepper
						label="Nights"
						variant="outline"
						defaultValue={3}
						min={1}
						max={14}
					/>
				</Row>
				<Row title="Tip" hint="Added to the bill">
					<NumberStepper
						label="Tip"
						variant="ghost"
						defaultValue={0.15}
						min={0}
						max={0.3}
						step={0.05}
						format={{ style: "percent" }}
					/>
				</Row>
			</div>
		</div>
	);
}

export default NumberStepperDemo;
