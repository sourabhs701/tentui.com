"use client";

import { type ReactNode, useState } from "react";

import {
	WindChimes,
	type WindChimesScale,
} from "@/registry/components/wind-chimes/wind-chimes";

const scaleOptions = ["pentatonic", "hirajoshi", "whole-tone"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex w-full flex-col items-center gap-1.5">
			{children}
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

function WindChimesDemo() {
	const [scale, setScale] = useState<WindChimesScale>("pentatonic");

	return (
		<div className="flex w-full max-w-2xl flex-col items-center gap-12 py-4">
			<Section title="Default">
				<WindChimes />
			</Section>

			<Section title="Materials">
				<div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
					<Labelled label="Metal">
						<WindChimes aria-label="Metal chimes" material="metal" size="sm" />
					</Labelled>
					<Labelled label="Bamboo">
						<WindChimes
							aria-label="Bamboo chimes"
							material="bamboo"
							size="sm"
						/>
					</Labelled>
					<Labelled label="Glass">
						<WindChimes aria-label="Glass chimes" material="glass" size="sm" />
					</Labelled>
				</div>
			</Section>

			<Section title="Scale">
				<div
					role="group"
					aria-label="Scale"
					className="inline-flex rounded-md border border-border p-0.5"
				>
					{scaleOptions.map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={scale === option}
							onClick={() => setScale(option)}
							className="rounded-[5px] px-2.5 py-1 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground"
						>
							{option}
						</button>
					))}
				</div>
				<WindChimes aria-label="Tuned chimes" scale={scale} showNotes />
			</Section>

			<Section title="Wind">
				<WindChimes aria-label="Chimes in the wind" wind windStrength={0.5} />
			</Section>
		</div>
	);
}

export default WindChimesDemo;
