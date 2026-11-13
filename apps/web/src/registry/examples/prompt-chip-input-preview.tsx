"use client";

import { ArrowUp } from "lucide-react";

import {
	PromptChipInput,
	type PromptChipItem,
	type PromptChipSegment,
	type PromptChipTrigger,
} from "@/registry/components/prompt-chip-input/prompt-chip-input";

const PEOPLE: PromptChipItem[] = [
	{ id: "ana", label: "Ana Lima", value: "ana", description: "Design" },
	{
		id: "andre",
		label: "Andre Costa",
		value: "andre",
		description: "Engineering",
	},
	{ id: "ben", label: "Ben Okafor", value: "ben", description: "Product" },
	{
		id: "chloe",
		label: "Chloe Martin",
		value: "chloe",
		description: "Marketing",
	},
	{ id: "diego", label: "Diego Ramos", value: "diego", description: "Support" },
	{ id: "mei", label: "Mei Tanaka", value: "mei", description: "Research" },
];

const COMMANDS: PromptChipItem[] = [
	{ id: "summarize", label: "summarize", description: "Key points" },
	{ id: "translate", label: "translate", description: "Any language" },
	{ id: "rewrite", label: "rewrite", description: "Change the tone" },
	{ id: "explain", label: "explain", description: "Step by step" },
];

const MODELS: PromptChipItem[] = [
	{
		id: "opus",
		label: "Opus",
		value: "claude-opus-5-5",
		description: "Most capable",
	},
	{
		id: "sonnet",
		label: "Sonnet",
		value: "claude-sonnet-5-5",
		description: "Balanced",
	},
	{
		id: "haiku",
		label: "Haiku",
		value: "claude-haiku-5-5",
		description: "Fast, cheap",
	},
	{
		id: "fable",
		label: "Fable",
		value: "claude-fable-5-1",
		description: "Creative",
	},
];

const TRIGGERS: PromptChipTrigger[] = [
	{ char: "@", kind: "mention", items: PEOPLE },
	{ char: "/", kind: "command", items: COMMANDS },
	{ char: "~", kind: "model", items: MODELS },
];

const DEFAULT_VALUE: PromptChipSegment[] = [
	{ type: "text", text: "Ask " },
	{ type: "chip", kind: "mention", id: "ana", label: "Ana Lima", value: "ana" },
	{ type: "text", text: " to " },
	{ type: "chip", kind: "command", id: "summarize", label: "summarize" },
	{ type: "text", text: " the launch notes with " },
	{
		type: "chip",
		kind: "model",
		id: "opus",
		label: "Opus",
		value: "claude-opus-5-5",
	},
];

/** `defaultValue` is only used by the capture scenes; the docs show the full prompt. */
function PromptChipInputPreview({
	defaultValue = DEFAULT_VALUE,
}: {
	defaultValue?: PromptChipSegment[];
}) {
	return (
		<div className="w-full max-w-[520px]">
			<PromptChipInput
				aria-label="Prompt"
				triggers={TRIGGERS}
				defaultValue={defaultValue}
				clearOnSubmit={false}
			>
				<div className="flex justify-end">
					<button
						type="button"
						aria-label="Send"
						className="grid size-7 cursor-pointer place-items-center rounded-full bg-foreground text-background outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<ArrowUp className="size-4" strokeWidth={2.25} />
					</button>
				</div>
			</PromptChipInput>
		</div>
	);
}

export default PromptChipInputPreview;
