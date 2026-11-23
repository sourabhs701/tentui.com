"use client";

import { useState } from "react";

import {
	TypingIndicator,
	type TypingIndicatorVariant,
} from "@/registry/components/typing-indicator/typing-indicator";

const VARIANTS: readonly { id: TypingIndicatorVariant; label: string }[] = [
	{ id: "ink", label: "Ink" },
	{ id: "dots", label: "Dots" },
	{ id: "wave", label: "Wave" },
];

const USERS = [
	{ name: "Maya", color: "#0284c7" },
	{ name: "Sam", color: "#059669" },
];

function TypingIndicatorPreview() {
	const [variant, setVariant] = useState<TypingIndicatorVariant>("ink");

	return (
		<div className="flex w-full max-w-xs flex-col items-center gap-6 px-2">
			<div className="flex w-full flex-col gap-3">
				<div className="flex justify-end">
					<div className="rounded-2xl rounded-ee-[6px] bg-foreground px-3.5 py-2 text-[13px] text-background leading-snug">
						Ready to ship the release?
					</div>
				</div>

				<div className="flex items-end gap-2">
					<span
						aria-hidden="true"
						className="inline-flex size-6 shrink-0 select-none items-center justify-center rounded-full bg-sky-600 font-medium text-[11px] text-white"
					>
						M
					</span>
					<TypingIndicator
						variant={variant}
						surface="bubble"
						size="lg"
						ariaLabel="Maya is typing"
					/>
				</div>

				<div className="pt-0.5 pl-8">
					<TypingIndicator
						variant={variant}
						surface="plain"
						size="sm"
						users={USERS}
					/>
				</div>
			</div>

			<div
				role="tablist"
				aria-label="Typing indicator style"
				className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 p-1"
			>
				{VARIANTS.map((item) => {
					const selected = variant === item.id;
					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={selected}
							onClick={() => setVariant(item.id)}
							className={`cursor-pointer rounded-full px-3 py-1 font-medium text-xs outline-none transition-[background-color,color,transform] duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] ${
								selected
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
							}`}
						>
							{item.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export default TypingIndicatorPreview;
