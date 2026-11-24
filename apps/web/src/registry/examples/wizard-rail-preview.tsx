"use client";

import { useState } from "react";

import {
	WizardRail,
	type WizardRailStep,
} from "@/registry/components/wizard-rail/wizard-rail";

const REGIONS = [
	{ id: "iad1", label: "US East", code: "iad1" },
	{ id: "fra1", label: "EU Central", code: "fra1" },
	{ id: "sin1", label: "AP South", code: "sin1" },
] as const;

export default function WizardRailPreview() {
	const [region, setRegion] = useState<string>("iad1");

	const selectedRegion =
		REGIONS.find((item) => item.id === region) ?? REGIONS[0];

	const steps: WizardRailStep[] = [
		{
			id: "project",
			title: "Project",
			content: (
				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs">
						<span className="font-medium text-foreground">tentui-web</span>
						<span className="font-mono text-[11px] text-muted-foreground">
							main
						</span>
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Next.js application detected with automatic preview builds enabled.
					</p>
				</div>
			),
		},
		{
			id: "region",
			title: "Region",
			content: (
				<div className="space-y-2.5">
					<p className="text-muted-foreground text-xs">
						Select primary edge compute region
					</p>
					<div className="grid grid-cols-3 gap-1.5">
						{REGIONS.map((item) => {
							const active = item.id === region;
							return (
								<button
									className={`cursor-pointer rounded-lg border px-2 py-1.5 text-left transition-colors ${
										active
											? "border-foreground bg-foreground/5 text-foreground"
											: "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
									}`}
									key={item.id}
									onClick={() => setRegion(item.id)}
									type="button"
								>
									<span className="block truncate font-medium text-[11px]">
										{item.label}
									</span>
									<span className="block font-mono text-[10px] opacity-70">
										{item.code}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			),
		},
		{
			id: "domain",
			title: "Domain",
			optional: true,
			content: (
				<div className="space-y-2">
					<div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-xs">
						<span className="font-mono text-foreground">app.tentui.com</span>
						<span className="text-[11px] text-muted-foreground">TLS ready</span>
					</div>
					<p className="text-muted-foreground text-xs">
						Optional custom hostname — skip to use the default preview domain.
					</p>
				</div>
			),
		},
		{
			id: "launch",
			title: "Launch",
			nextLabel: "Deploy",
			content: (
				<div className="space-y-1.5 text-xs">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Target</span>
						<span className="font-medium text-foreground">
							tentui-web · {selectedRegion.code}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Domain</span>
						<span className="font-mono text-foreground">app.tentui.com</span>
					</div>
				</div>
			),
		},
	];

	return (
		<div className="w-full max-w-[420px]">
			<WizardRail
				aria-label="Deployment wizard preview"
				completeLabel="Deploy"
				completedContent={
					<div className="space-y-1 py-1 text-center">
						<p className="font-medium text-foreground text-sm tracking-tight">
							Deployment queued
						</p>
						<p className="text-muted-foreground text-xs">
							Building <span className="font-mono">tentui-web</span> in{" "}
							{selectedRegion.label}.
						</p>
					</div>
				}
				showDescriptions={false}
				size="sm"
				steps={steps}
			/>
		</div>
	);
}
