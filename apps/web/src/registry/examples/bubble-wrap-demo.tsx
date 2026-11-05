"use client";

import { type ReactNode, useRef, useState } from "react";

import {
	BubbleWrap,
	type BubbleWrapHandle,
} from "@/registry/components/bubble-wrap/bubble-wrap";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

const buttonClassName =
	"h-7 rounded-md border bg-background px-2.5 font-medium text-foreground text-xs shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

function BubbleWrapDemo() {
	const sheet = useRef<BubbleWrapHandle>(null);
	const [log, setLog] = useState<{ id: number; text: string }[]>([]);
	const [clears, setClears] = useState(0);
	const nextId = useRef(0);

	const write = (text: string) => {
		const id = nextId.current++;
		setLog((lines) => [{ id, text }, ...lines].slice(0, 4));
	};

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Default">
				<BubbleWrap />
			</Section>

			<Section title="Blue, with count">
				<BubbleWrap tint="blue" rows={4} showCount />
			</Section>

			<Section title="Controlled, logging pops">
				<BubbleWrap
					ref={sheet}
					tint="pink"
					rows={3}
					columns={5}
					autoReset={false}
					onPop={(index) => write(`Popped bubble ${index + 1}`)}
					onClear={() => {
						setClears((count) => count + 1);
						write("Cleared");
					}}
				/>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => sheet.current?.popAll()}
						className={buttonClassName}
					>
						Pop all
					</button>
					<button
						type="button"
						onClick={() => sheet.current?.reset()}
						className={buttonClassName}
					>
						Reset
					</button>
				</div>
				<div className="flex h-20 w-full max-w-64 flex-col items-center gap-0.5 text-muted-foreground text-xs tabular-nums">
					<p className="text-foreground">
						{clears} {clears === 1 ? "clear" : "clears"}
					</p>
					{log.map((line, index) => (
						<p key={line.id} style={{ opacity: 1 - index * 0.22 }}>
							{line.text}
						</p>
					))}
				</div>
			</Section>
		</div>
	);
}

export default BubbleWrapDemo;
