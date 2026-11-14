"use client";

import { useEffect, useRef } from "react";

import {
	AsciiDecodeText,
	type AsciiDecodeTextHandle,
} from "@/registry/components/ascii-decode-text/ascii-decode-text";

/** Ms the decoded headline holds before it re-encodes and decodes again. */
const HOLD_MS = 2500;

function AsciiDecodeTextPreview() {
	const text = useRef<AsciiDecodeTextHandle>(null);
	const wrapper = useRef<HTMLDivElement>(null);
	const timer = useRef(0);
	const visible = useRef(true);
	const waiting = useRef(false);

	const schedule = () => {
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			// Paused offscreen and in hidden tabs; it picks up when seen again.
			if (!visible.current || document.hidden) {
				waiting.current = true;
				return;
			}
			text.current?.replay();
		}, HOLD_MS);
	};

	useEffect(() => {
		const element = wrapper.current;
		if (!element) return;
		const resume = () => {
			if (!waiting.current || !visible.current || document.hidden) return;
			waiting.current = false;
			text.current?.replay();
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible.current = Boolean(entry?.isIntersecting);
			resume();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", resume);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", resume);
			window.clearTimeout(timer.current);
		};
	}, []);

	return (
		<div ref={wrapper} className="w-full px-4 text-center">
			<AsciiDecodeText
				ref={text}
				size="xl"
				className="mx-auto w-fit"
				onDecoded={schedule}
			>
				Decode the signal
			</AsciiDecodeText>
		</div>
	);
}

export default AsciiDecodeTextPreview;
