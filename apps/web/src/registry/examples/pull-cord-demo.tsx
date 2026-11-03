"use client";

import { Star } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";
import { PullCord } from "@/registry/components/pull-cord/pull-cord";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ThemeCard() {
	const [dark, setDark] = useState(false);

	return (
		<div className="flex items-start">
			<div
				className={cn(
					"mt-3 flex w-36 flex-col gap-2 rounded-xl border p-3 shadow-xs transition-colors duration-200 motion-reduce:transition-none",
					dark
						? "border-zinc-800 bg-zinc-900 text-zinc-50"
						: "border-zinc-200 bg-white text-zinc-900",
				)}
			>
				<p className="font-medium text-sm">Reading mode</p>
				<span
					className={cn(
						"h-1.5 w-full rounded-full",
						dark ? "bg-zinc-700" : "bg-zinc-200",
					)}
				/>
				<span
					className={cn(
						"h-1.5 w-2/3 rounded-full",
						dark ? "bg-zinc-700" : "bg-zinc-200",
					)}
				/>
				<p className="text-xs opacity-60">{dark ? "Dark" : "Light"}</p>
			</div>
			<PullCord
				variant="minimal"
				size="sm"
				label="Dark reading mode"
				checked={dark}
				onCheckedChange={setDark}
				chainLength={64}
				className="-ms-5"
			/>
		</div>
	);
}

function ControlledCord() {
	const [on, setOn] = useState(true);

	return (
		<div className="flex flex-col items-center gap-3">
			<PullCord
				label="Porch light"
				checked={on}
				onCheckedChange={setOn}
				chainLength={72}
			/>
			<p className="text-muted-foreground text-xs">
				Porch light is {on ? "on" : "off"}
			</p>
			<button
				type="button"
				onClick={() => setOn((value) => !value)}
				className="h-8 rounded-md border px-3 font-medium text-xs shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				Toggle from parent
			</button>
		</div>
	);
}

function PullCordDemo() {
	return (
		<div className="grid w-full max-w-3xl grid-cols-1 gap-x-6 gap-y-10 py-4 md:grid-cols-3 min-[480px]:grid-cols-2">
			<Section title="Lit panel">
				<PullCord label="Desk lamp" chainLength={72} />
			</Section>

			<Section title="Minimal, controlling a card">
				<ThemeCard />
			</Section>

			<Section title="Custom handle">
				<PullCord
					label="Night light"
					chainLength={72}
					handle={<Star className="fill-current" />}
				>
					<div className="flex size-14 items-center justify-center rounded-full border border-border bg-card shadow-xs transition-colors duration-200 group-data-[state=checked]/pull-cord:border-amber-200 group-data-[state=checked]/pull-cord:bg-amber-50 motion-reduce:transition-none dark:group-data-[state=checked]/pull-cord:border-amber-300/25 dark:group-data-[state=checked]/pull-cord:bg-amber-300/10">
						<Star className="size-5 text-zinc-300 transition-colors duration-200 group-data-[state=checked]/pull-cord:fill-amber-400 group-data-[state=checked]/pull-cord:text-amber-400 motion-reduce:transition-none dark:text-zinc-600" />
					</div>
				</PullCord>
			</Section>

			<Section title="Controlled">
				<ControlledCord />
			</Section>

			<Section title="Disabled">
				<PullCord
					label="Hallway light"
					chainLength={72}
					defaultChecked
					disabled
				/>
			</Section>

			<Section title="Sound off">
				<PullCord label="Bedside lamp" chainLength={72} sound={false} />
			</Section>
		</div>
	);
}

export default PullCordDemo;
