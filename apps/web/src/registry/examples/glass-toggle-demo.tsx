"use client";

import { type ReactNode, useId, useState } from "react";

import { GlassToggle } from "@/registry/components/glass-toggle/glass-toggle";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function SettingRow({
	title,
	description,
	size,
	defaultChecked,
}: {
	title: string;
	description: string;
	size?: "sm" | "md";
	defaultChecked?: boolean;
}) {
	const id = useId();

	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3">
			<div className="min-w-0">
				<p id={`${id}-title`} className="font-medium text-foreground text-sm">
					{title}
				</p>
				<p
					id={`${id}-description`}
					className="truncate text-muted-foreground text-xs"
				>
					{description}
				</p>
			</div>
			<GlassToggle
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-description`}
				size={size}
				defaultChecked={defaultChecked}
			/>
		</div>
	);
}

const STARS = [
	{ left: "14%", top: "22%" },
	{ left: "31%", top: "58%" },
	{ left: "47%", top: "16%" },
	{ left: "68%", top: "40%" },
	{ left: "84%", top: "20%" },
	{ left: "78%", top: "66%" },
];

function Sky({ day }: { day: boolean }) {
	return (
		<div
			data-day={day || undefined}
			className="group/sky relative h-24 w-48 overflow-hidden rounded-xl border shadow-xs"
		>
			{/* Night, with a few stars, cross-fading to a warm day. */}
			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0f1230,#2a2f5e_70%,#4b4f86)]" />
			{STARS.map((star) => (
				<span
					key={`${star.left}-${star.top}`}
					className="absolute size-0.5 rounded-full bg-white/80 transition-opacity duration-500 group-data-day/sky:opacity-0 motion-reduce:transition-none"
					style={star}
				/>
			))}
			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,#9fd0ff,#ffe2b0_75%,#ffc98a)] opacity-0 transition-opacity duration-500 group-data-day/sky:opacity-100 motion-reduce:transition-none" />
			<div className="absolute top-3 right-4 size-6 rounded-full bg-[radial-gradient(circle,#fff6d8,#ffd27a_60%,#ffb347)] opacity-0 shadow-[0_0_24px_rgb(255_190_90/0.8)] transition-opacity duration-500 group-data-day/sky:opacity-100 motion-reduce:transition-none" />
			<p className="absolute bottom-2 left-3 font-medium text-white/90 text-xs transition-colors duration-500 group-data-day/sky:text-[#6b3d0a] motion-reduce:transition-none">
				{day ? "Day" : "Night"}
			</p>
		</div>
	);
}

function GlassToggleDemo() {
	const [day, setDay] = useState(false);

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="In a settings list">
				<div className="w-full max-w-72 divide-y rounded-xl border bg-card shadow-xs">
					<SettingRow
						title="Night light"
						description="Warmer after sunset"
						defaultChecked
					/>
					<SettingRow
						title="Keyboard sounds"
						description="A tap on every key"
					/>
					<SettingRow
						title="Auto-dim"
						description="Dim the screen when idle"
						size="sm"
					/>
				</div>
			</Section>

			<Section title="Controlled">
				<div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
					<GlassToggle
						label="Daylight"
						checked={day}
						onCheckedChange={setDay}
					/>
					<Sky day={day} />
				</div>
			</Section>

			<Section title="Sound off">
				<GlassToggle label="Silent switch" sound={false} />
			</Section>
		</div>
	);
}

export default GlassToggleDemo;
