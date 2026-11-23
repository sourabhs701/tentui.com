"use client";

import { useEffect, useRef, useState } from "react";

import {
	TypingIndicator,
	type TypingIndicatorSize,
	type TypingIndicatorSpeed,
	type TypingIndicatorSurface,
	type TypingIndicatorUser,
	type TypingIndicatorVariant,
} from "@/registry/components/typing-indicator/typing-indicator";

const COLLABORATORS: readonly {
	id: string;
	name: string;
	color: string;
}[] = [
	{ id: "maya", name: "Maya", color: "#0284c7" },
	{ id: "sam", name: "Sam", color: "#059669" },
	{ id: "kai", name: "Kai", color: "#d97706" },
	{ id: "elena", name: "Elena", color: "#7c3aed" },
];

const VARIANTS: readonly TypingIndicatorVariant[] = ["ink", "dots", "wave"];
const SURFACES: readonly TypingIndicatorSurface[] = ["plain", "bubble", "pill"];
const SIZES: readonly TypingIndicatorSize[] = ["sm", "md", "lg"];
const SPEEDS: readonly TypingIndicatorSpeed[] = ["calm", "normal", "brisk"];

type ChatMessage = {
	id: string;
	author: "me" | "peer";
	name: string;
	text: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
	{
		id: "m1",
		author: "me",
		name: "You",
		text: "Did the registry build pass after the update?",
	},
	{
		id: "m2",
		author: "peer",
		name: "Maya",
		text: "Checking the diff now — looks clean so far.",
	},
];

function SegmentedRow<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly T[];
	value: T;
	onChange: (next: T) => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<span className="font-medium text-muted-foreground text-xs">{label}</span>
			<div className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/50 p-0.5">
				{options.map((option) => {
					const active = option === value;
					return (
						<button
							key={option}
							type="button"
							aria-pressed={active}
							onClick={() => onChange(option)}
							className={`min-h-7 cursor-pointer rounded-md px-2.5 font-medium text-xs capitalize outline-none transition-[background-color,color,transform] duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] ${
								active
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
							}`}
						>
							{option}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function TypingIndicatorDemo() {
	const [variant, setVariant] = useState<TypingIndicatorVariant>("ink");
	const [surface, setSurface] = useState<TypingIndicatorSurface>("bubble");
	const [size, setSize] = useState<TypingIndicatorSize>("md");
	const [speed, setSpeed] = useState<TypingIndicatorSpeed>("normal");
	const [selectedIds, setSelectedIds] = useState<string[]>(["maya"]);
	const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
	const [draft, setDraft] = useState("");
	const [liveTyping, setLiveTyping] = useState(true);
	const idleTimerRef = useRef<number | null>(null);

	const activeUsers: TypingIndicatorUser[] = COLLABORATORS.filter((person) =>
		selectedIds.includes(person.id),
	).map(({ name, color }) => ({ name, color }));

	useEffect(() => {
		return () => {
			if (idleTimerRef.current !== null) {
				window.clearTimeout(idleTimerRef.current);
			}
		};
	}, []);

	const handleDraftChange = (value: string) => {
		setDraft(value);
		if (idleTimerRef.current !== null) {
			window.clearTimeout(idleTimerRef.current);
		}
		if (value.trim().length > 0) {
			setLiveTyping(true);
			idleTimerRef.current = window.setTimeout(() => {
				setLiveTyping(false);
			}, 1800);
		} else {
			setLiveTyping(false);
		}
	};

	const handleSend = (event: React.FormEvent) => {
		event.preventDefault();
		const text = draft.trim();
		if (!text) return;
		if (idleTimerRef.current !== null) {
			window.clearTimeout(idleTimerRef.current);
		}
		const speaker =
			COLLABORATORS.find((person) => selectedIds.includes(person.id))?.name ??
			"Maya";
		setMessages((prev) => [
			...prev.slice(-2),
			{
				id: `msg-${Date.now()}`,
				author: "peer",
				name: speaker,
				text,
			},
		]);
		setDraft("");
		setLiveTyping(false);
	};

	const toggleCollaborator = (id: string) => {
		setSelectedIds((prev) => {
			const next = prev.includes(id)
				? prev.filter((item) => item !== id)
				: [...prev, id];
			setLiveTyping(next.length > 0);
			return next;
		});
	};

	const isTypingVisible = liveTyping && activeUsers.length > 0;

	return (
		<div className="flex w-full max-w-md flex-col gap-6 py-2">
			<div className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background">
				<div className="flex items-center justify-between border-border/60 border-b px-4 py-2.5">
					<div className="flex items-center gap-2">
						<span className="size-2 rounded-full bg-emerald-500" />
						<span className="font-medium text-foreground text-xs">
							#design-systems
						</span>
					</div>
					<button
						type="button"
						onClick={() => {
							if (selectedIds.length === 0) {
								setSelectedIds(["maya"]);
								setLiveTyping(true);
							} else {
								setLiveTyping((prev) => !prev);
							}
						}}
						className="min-h-7 cursor-pointer rounded-md px-2 font-medium text-muted-foreground text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						{isTypingVisible ? "Pause typing" : "Resume typing"}
					</button>
				</div>

				<div className="flex flex-col gap-2.5 px-4 py-4">
					{messages.map((message) => (
						<div
							key={message.id}
							className={`flex ${message.author === "me" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
									message.author === "me"
										? "rounded-ee-[6px] bg-foreground text-background"
										: "rounded-es-[6px] border border-border/60 bg-muted/65 text-foreground"
								}`}
							>
								{message.text}
							</div>
						</div>
					))}

					<div className="flex min-h-11 items-center pt-1">
						<TypingIndicator
							variant={variant}
							surface={surface}
							size={size}
							speed={speed}
							active={isTypingVisible}
							users={activeUsers}
						/>
					</div>
				</div>

				<form
					onSubmit={handleSend}
					className="flex items-center gap-2 border-border/60 border-t bg-muted/25 px-3 py-2"
				>
					<input
						type="text"
						value={draft}
						onChange={(event) => handleDraftChange(event.target.value)}
						placeholder="Type here to simulate a peer..."
						aria-label="Simulate peer typing"
						className="min-h-9 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/75"
					/>
					<button
						type="submit"
						disabled={!draft.trim()}
						className="min-h-8 shrink-0 cursor-pointer rounded-lg bg-foreground px-3 font-medium text-background text-xs outline-none transition-[opacity,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				</form>
			</div>

			<div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/25 p-3.5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="font-medium text-muted-foreground text-xs">
						Typists
					</span>
					<div className="flex flex-wrap items-center gap-1.5">
						{COLLABORATORS.map((person) => {
							const active = selectedIds.includes(person.id);
							return (
								<button
									key={person.id}
									type="button"
									aria-pressed={active}
									onClick={() => toggleCollaborator(person.id)}
									className={`inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-medium text-xs outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] ${
										active
											? "border-foreground/20 bg-background text-foreground shadow-xs"
											: "border-transparent bg-muted/70 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
									}`}
								>
									<span
										aria-hidden="true"
										className="size-2 rounded-full"
										style={{ backgroundColor: person.color }}
									/>
									{person.name}
								</button>
							);
						})}
					</div>
				</div>

				<SegmentedRow
					label="Variant"
					options={VARIANTS}
					value={variant}
					onChange={setVariant}
				/>
				<SegmentedRow
					label="Surface"
					options={SURFACES}
					value={surface}
					onChange={setSurface}
				/>
				<SegmentedRow
					label="Size"
					options={SIZES}
					value={size}
					onChange={setSize}
				/>
				<SegmentedRow
					label="Speed"
					options={SPEEDS}
					value={speed}
					onChange={setSpeed}
				/>
			</div>
		</div>
	);
}

export default TypingIndicatorDemo;
