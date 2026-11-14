"use client";

import { ArrowUp } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import {
	PromptChip,
	PromptChipInput,
	type PromptChipInputHandle,
	type PromptChipItem,
	type PromptChipSegment,
	type PromptChipTrigger,
	type PromptChipValue,
} from "@/registry/components/prompt-chip-input/prompt-chip-input";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col gap-3">
			<p className="text-center font-medium text-muted-foreground text-xs">
				{title}
			</p>
			{children}
		</section>
	);
}

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

function SendButton({
	disabled,
	onClick,
}: {
	disabled?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			aria-label="Send"
			disabled={disabled}
			onClick={onClick}
			className="grid size-7 cursor-pointer place-items-center rounded-full bg-foreground text-background outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-30"
		>
			<ArrowUp className="size-4" strokeWidth={2.25} />
		</button>
	);
}

function Message({ segments }: { segments: PromptChipSegment[] }) {
	return (
		<p className="ms-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-3.5 py-2 text-[15px] leading-6">
			{segments.map((segment, index) =>
				segment.type === "text" ? (
					<span key={index}>{segment.text}</span>
				) : (
					<PromptChip key={index} chip={segment} />
				),
			)}
		</p>
	);
}

function Composer() {
	const ref = useRef<PromptChipInputHandle>(null);
	const [sent, setSent] = useState<PromptChipValue[]>([]);
	const [draft, setDraft] = useState<PromptChipValue | null>(null);
	// The footer shows the model the draft picks, or the default.
	const model =
		draft?.chips.findLast((chip) => chip.kind === "model")?.label ?? "Opus";
	const canSend =
		!!draft && (draft.text.trim() !== "" || draft.chips.length > 0);

	const send = (value: PromptChipValue) => {
		setSent((messages) => [...messages, value].slice(-3));
	};

	return (
		<div className="flex w-full flex-col gap-3">
			{sent.length > 0 ? (
				<div className="flex flex-col gap-2">
					{sent.map((message, index) => (
						<Message key={index} segments={message.segments} />
					))}
				</div>
			) : null}
			<PromptChipInput
				ref={ref}
				triggers={TRIGGERS}
				placeholder="Ask anything. @ to mention, / for commands, ~ to pick a model"
				sound
				onValueChange={setDraft}
				onSubmit={send}
			>
				<div className="flex items-center justify-between gap-2">
					<PromptChip
						chip={{ kind: "model", id: "footer-model", label: model }}
						className="text-xs"
					/>
					<SendButton
						disabled={!canSend}
						onClick={() => {
							const value = ref.current?.getValue();
							if (!value) return;
							send(value);
							ref.current?.clear();
						}}
					/>
				</div>
			</PromptChipInput>
		</div>
	);
}

const DIRECTORY: PromptChipItem[] = [
	...PEOPLE,
	{ id: "farah", label: "Farah Aziz", value: "farah", description: "Legal" },
	{ id: "gus", label: "Gus Lindqvist", value: "gus", description: "Finance" },
	{ id: "hana", label: "Hana Novak", value: "hana", description: "Design" },
	{ id: "ivan", label: "Ivan Petrov", value: "ivan", description: "Data" },
	{ id: "jules", label: "Jules Moreau", value: "jules", description: "Sales" },
	{
		id: "kai",
		label: "Kai Nakamura",
		value: "kai",
		description: "Engineering",
	},
];

/** A fake directory search that answers after 300 ms. */
function searchPeople(query: string) {
	const q = query.toLowerCase();
	return new Promise<PromptChipItem[]>((resolve) => {
		setTimeout(() => {
			resolve(
				DIRECTORY.filter((person) =>
					person.label
						.toLowerCase()
						.split(" ")
						.some((word) => word.startsWith(q)),
				),
			);
		}, 300);
	});
}

function AsyncMentions() {
	return (
		<PromptChipInput
			aria-label="Note"
			triggers={[{ char: "@", kind: "mention", items: searchPeople }]}
			placeholder="Type @ to search the directory"
			clearOnSubmit={false}
		/>
	);
}

function PlainField() {
	return (
		<PromptChipInput
			aria-label="Comment"
			triggers={[{ char: "@", kind: "mention", items: PEOPLE }]}
			defaultValue={[
				{ type: "text", text: "Thanks " },
				{
					type: "chip",
					kind: "mention",
					id: "mei",
					label: "Mei Tanaka",
					value: "mei",
				},
				{ type: "text", text: " " },
			]}
			meltOnBackspace={false}
			clearOnSubmit={false}
			className="min-h-0"
			editableClassName="min-h-6"
		/>
	);
}

function PromptChipInputDemo() {
	return (
		<div className="flex w-full max-w-[520px] flex-col items-center gap-10 py-4">
			<Section title="Composer">
				<Composer />
			</Section>

			<Section title="Async mentions">
				<AsyncMentions />
			</Section>

			<Section title="Plain field">
				<PlainField />
			</Section>
		</div>
	);
}

export default PromptChipInputDemo;
