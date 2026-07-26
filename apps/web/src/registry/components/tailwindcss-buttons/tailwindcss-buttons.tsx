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

export function ThreeDPrimaryButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-950 bg-zinc-800 px-6 font-semibold text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_5px_0_#09090b,0_9px_14px_rgba(0,0,0,0.22)] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-zinc-900 focus-visible:outline-offset-4 active:translate-y-[3px] active:bg-zinc-900 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),0_2px_0_#09090b,0_4px_6px_rgba(0,0,0,0.18)] motion-reduce:transform-none motion-reduce:transition-none dark:focus-visible:outline-zinc-300"
		>
			3D Primary
		</button>
	);
}

export function ThreeDSecondaryButton() {
	return (
		<button
			type="button"
			className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 font-semibold text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_5px_0_#a1a1aa,0_9px_14px_rgba(0,0,0,0.14)] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-zinc-700 focus-visible:outline-offset-4 active:translate-y-[3px] active:bg-zinc-100 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.12),0_2px_0_#a1a1aa,0_4px_6px_rgba(0,0,0,0.1)] motion-reduce:transform-none motion-reduce:transition-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_5px_0_#3f3f46,0_9px_14px_rgba(0,0,0,0.35)] dark:active:bg-zinc-900 dark:active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45),0_2px_0_#3f3f46,0_4px_6px_rgba(0,0,0,0.28)] dark:focus-visible:outline-zinc-300 dark:hover:bg-zinc-700"
		>
			3D Secondary
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

export function SketchButton() {
	return (
		<button
			type="button"
			className="inline-flex items-center justify-center rounded-md border border-black bg-white px-4 py-2 text-black text-sm shadow-[2px_2px_0_0_rgba(0,0,0,1)] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 active:translate-x-0 active:translate-y-0 active:shadow-none dark:border-white dark:bg-zinc-950 dark:text-white dark:shadow-[2px_2px_0_0_rgba(255,255,255,1)] dark:active:shadow-none dark:focus-visible:outline-white dark:hover:shadow-[4px_4px_0_0_rgba(255,255,255,1)]"
		>
			Sketch
		</button>
	);
}

export function SoftButtonPrimary() {
	return (
		<button
			type="button"
			className="group relative inline-flex items-center justify-center rounded-xl border-2 border-blue-700 bg-blue-500 px-6 py-4 font-semibold text-white uppercase shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_0_0_#dbeafe] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0,0,0.58,1)] hover:translate-y-1 hover:bg-blue-600 hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_0_0_#dbeafe] focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-4 active:translate-y-3 active:bg-blue-600 active:shadow-[0_0_0_-2px_#60a5fa,0_0_0_0_#1d4ed8,0_0_0_0_#dbeafe] motion-reduce:transform-none motion-reduce:transition-none dark:shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_15px_-5px_rgba(0,0,0,0.3)] dark:active:shadow-[0_0_0_-2px_#60a5fa,0_0_0_0_#1d4ed8,0_0_0_0_rgba(0,0,0,0)] dark:focus-visible:outline-blue-400 dark:hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_10px_-5px_rgba(0,0,0,0.3)]"
		>
			Soft primary
		</button>
	);
}

export function SoftButtonSecondary() {
	return (
		<button
			type="button"
			className="group relative inline-flex items-center justify-center rounded-xl border-2 border-blue-600 bg-transparent px-6 py-4 font-semibold text-blue-600 uppercase shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_0_0_#dbeafe] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0,0,0.58,1)] hover:translate-y-1 hover:bg-blue-50 hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_0_0_#dbeafe] focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-4 active:translate-y-3 active:bg-blue-100 active:shadow-[0_0_0_-2px_#60a5fa,0_0_0_0_#1d4ed8,0_0_0_0_#dbeafe] motion-reduce:transform-none motion-reduce:transition-none dark:text-blue-400 dark:shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_15px_-5px_rgba(0,0,0,0.3)] dark:active:bg-blue-950/60 dark:active:shadow-[0_0_0_-2px_#60a5fa,0_0_0_0_#1d4ed8,0_0_0_0_rgba(0,0,0,0)] dark:focus-visible:outline-blue-400 dark:hover:bg-blue-950/40 dark:hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_10px_-5px_rgba(0,0,0,0.3)]"
		>
			Soft secondary
		</button>
	);
}

export function GoBackButton() {
	return (
		<button
			type="button"
			className="group relative h-14 w-48 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-center font-semibold text-black text-xl outline-none focus-visible:outline-2 focus-visible:outline-green-600 focus-visible:outline-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus-visible:outline-green-400"
		>
			<span
				aria-hidden="true"
				className="absolute inset-y-1 left-1 w-[184px] origin-left scale-x-[0.26087] rounded-xl bg-green-400 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-green-600 [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:scale-x-100"
			/>
			<span
				aria-hidden="true"
				className="absolute top-1 left-1 z-10 flex size-12 items-center justify-center text-white"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 1024 1024"
					width="25"
					height="25"
					className="shrink-0"
				>
					<path
						d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z"
						fill="currentColor"
					/>
					<path
						d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
						fill="currentColor"
					/>
				</svg>
			</span>
			<span className="relative z-10 block translate-x-2">Go Back</span>
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
		name: "3D Primary",
		description: "A dark primary button with a tactile raised edge.",
		component: ThreeDPrimaryButton,
	},
	{
		name: "3D Secondary",
		description: "A neutral secondary button with adaptive raised depth.",
		component: ThreeDSecondaryButton,
	},
	{
		name: "3D Destructive",
		description: "A destructive red button with decisive press feedback.",
		component: ThreeDDestructiveButton,
	},
	{
		name: "Sketch",
		description: "A crisp offset-shadow button.",
		component: SketchButton,
	},
	{
		name: "Soft Button Primary",
		description: "A soft blue button with layered, pressable depth.",
		component: SoftButtonPrimary,
	},
	{
		name: "Soft Button Secondary",
		description: "An outlined soft button with layered blue depth.",
		component: SoftButtonSecondary,
	},
	{
		name: "Go Back",
		description: "A directional button with an expanding green accent.",
		component: GoBackButton,
	},
];

export default TailwindcssButtons;
