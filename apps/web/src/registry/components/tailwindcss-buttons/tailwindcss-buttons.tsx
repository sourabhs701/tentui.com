"use client";

import type { ReactElement } from "react";
import reactElementToJSXString from "react-element-to-jsx-string";
import { CopyButton } from "@/registry/components/copy-button/copy-button";

type TailwindButton = {
	name: string;
	description: string;
	component: () => ReactElement;
};

type ButtonsCardProps = {
	button: TailwindButton;
};

export function ButtonsCard({ button }: ButtonsCardProps) {
	const component = button.component();
	const code = reactElementToJSXString(component, {
		sortProps: false,
		useBooleanShorthandSyntax: true,
	});

	return (
		<div className="relative flex w-full flex-col overflow-hidden rounded-xl border bg-muted shadow-card">
			<div className="flex items-center justify-between px-4 py-2">
				<span className="text-muted-foreground text-xs">{button.name}</span>
				<CopyButton
					variant="ghost"
					size="xs"
					text={code}
					aria-label={`Copy ${button.name} button code`}
				>
					Copy
				</CopyButton>
			</div>

			<div className="relative flex h-[260px] w-full items-center justify-center overflow-hidden rounded-xl bg-background p-8 shadow-surface-inset">
				{component}
			</div>
		</div>
	);
}

export function TailwindcssButtons() {
	return (
		<div className="mx-auto grid w-full grid-cols-1 gap-6 px-4 pb-40 lg:grid-cols-2">
			{buttons.map((button) => (
				<ButtonsCard key={button.name} button={button} />
			))}
		</div>
	);
}

export function PrimaryButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-full bg-blue-600 px-6 font-semibold text-sm text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),0_1px_2px_0_rgba(0,0,0,0.18)] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 active:translate-y-px dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_6px_0_rgba(0,0,0,0.45)] dark:focus-visible:outline-blue-400"
		>
			Primary
		</button>
	);
}

export function SecondaryButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-black/[0.06] px-6 font-semibold text-sm text-zinc-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),inset_0_-1px_2px_0_rgba(0,0,0,0.12),0_1px_2px_0_rgba(0,0,0,0.08)] outline-none backdrop-blur-2xl transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out hover:bg-black/[0.10] focus-visible:outline-2 focus-visible:outline-zinc-700 focus-visible:outline-offset-2 active:translate-y-px dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-white dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),inset_0_-1px_2px_0_rgba(0,0,0,0.45),0_1px_3px_0_rgba(0,0,0,0.35)] dark:focus-visible:outline-zinc-300 dark:hover:bg-white/[0.14]"
		>
			Secondary
		</button>
	);
}

export function ThreeDButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-950 bg-zinc-800 px-6 font-semibold text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_5px_0_#09090b,0_9px_14px_rgba(0,0,0,0.22)] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-zinc-900 focus-visible:outline-offset-4 active:translate-y-[3px] active:bg-zinc-900 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),0_2px_0_#09090b,0_4px_6px_rgba(0,0,0,0.18)] motion-reduce:transform-none motion-reduce:transition-none dark:focus-visible:outline-zinc-300"
		>
			3D Button
		</button>
	);
}

export function ThreeDDestructiveButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-xl border border-red-800 bg-red-600 px-6 font-semibold text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_0_#991b1b,0_9px_14px_rgba(127,29,29,0.24)] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-4 active:translate-y-[3px] active:bg-red-700 active:shadow-[inset_0_1px_2px_rgba(69,10,10,0.42),0_2px_0_#991b1b,0_4px_6px_rgba(127,29,29,0.2)] motion-reduce:transform-none motion-reduce:transition-none dark:focus-visible:outline-red-400"
		>
			3D Destructive
		</button>
	);
}

export const buttons: TailwindButton[] = [
	{
		name: "Primary",
		description: "A blue pill button with a subtle inset highlight.",
		component: PrimaryButton,
	},
	{
		name: "Secondary",
		description: "A translucent glass pill button with inset depth.",
		component: SecondaryButton,
	},
	{
		name: "3D Button",
		description: "A dark button with a tactile raised edge.",
		component: ThreeDButton,
	},
	{
		name: "3D Destructive",
		description: "A destructive red button with decisive press feedback.",
		component: ThreeDDestructiveButton,
	},
];

export default TailwindcssButtons;
