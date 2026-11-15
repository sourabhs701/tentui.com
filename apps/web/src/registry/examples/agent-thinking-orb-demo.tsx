"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AgentThinking } from "@/registry/components/agent-thinking/agent-thinking";

/** Ms the agent thinks, and how long the check holds before the answer. */
const THINK_MS = 3200;
const ANSWER_MS = 900;

/**
 * A scripted reply that starts the first time it's on screen: the orb waits
 * in the assistant's bubble, settles into a check, and the answer follows.
 */
function useReply() {
	const ref = useRef<HTMLDivElement>(null);
	const [phase, setPhase] = useState<"idle" | "thinking" | "done" | "answer">(
		"idle",
	);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let timeouts: number[] = [];
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry?.isIntersecting) return;
			observer.disconnect();
			setPhase("thinking");
			timeouts = [
				window.setTimeout(() => setPhase("done"), THINK_MS),
				window.setTimeout(() => setPhase("answer"), THINK_MS + ANSWER_MS),
			];
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			for (const timeout of timeouts) window.clearTimeout(timeout);
		};
	}, []);

	return { ref, phase };
}

export function AgentThinkingOrbDemo() {
	const { ref, phase } = useReply();
	return (
		<div ref={ref} className="flex w-72 max-w-full flex-col gap-2 text-sm">
			<p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-background">
				Can I show tool calls while it streams?
			</p>
			<motion.div
				layout
				transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
				className="flex min-h-9 max-w-[80%] items-center self-start bg-muted px-3.5 py-2"
				style={{ borderRadius: 16, borderBottomLeftRadius: 6 }}
			>
				{phase === "answer" ? (
					<motion.p
						initial={{ opacity: 0, filter: "blur(2px)" }}
						animate={{ opacity: 1, filter: "blur(0px)" }}
						transition={{ duration: 0.3, delay: 0.1 }}
					>
						Yes. Map each tool call to a step as it arrives.
					</motion.p>
				) : (
					<AgentThinking
						variant="orb"
						status={phase === "done" ? "done" : "thinking"}
					/>
				)}
			</motion.div>
		</div>
	);
}

export default AgentThinkingOrbDemo;
