"use client";

import { useEffect, useState } from "react";

import { AsciiDecodeText } from "@/registry/components/ascii-decode-text/ascii-decode-text";

/** Ms from the take's first frame: decode, then re-encode for the loop. */
const DECODE_AT = 400;
const ENCODE_AT = 5000;

const headline = "Decode the signal";
const headlineClassName = "mx-auto w-fit text-center";

/**
 * The still shows the headline mid-decode, crisp type on the left and ASCII
 * art on the right, by stacking a decoded and an encoded copy under a soft
 * split. Motion takes load the page with `?motion` and start as art; the
 * recorder's first pointer move starts the timeline, so the scripted glide
 * crosses the decoded text and the take ends as art again.
 */
export function AsciiDecodeTextCapture() {
	const [motion, setMotion] = useState<boolean | null>(null);
	const [decoded, setDecoded] = useState(false);

	useEffect(() => {
		setMotion(new URLSearchParams(window.location.search).has("motion"));
	}, []);

	useEffect(() => {
		if (!motion) return;
		const timers: number[] = [];
		const start = () => {
			window.removeEventListener("pointermove", start);
			timers.push(
				window.setTimeout(() => setDecoded(true), DECODE_AT),
				window.setTimeout(() => setDecoded(false), ENCODE_AT),
			);
		};
		window.addEventListener("pointermove", start);
		return () => {
			window.removeEventListener("pointermove", start);
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [motion]);

	if (motion === null) return null;
	if (motion) {
		return (
			<AsciiDecodeText
				size="xl"
				trigger="manual"
				decoded={decoded}
				className={headlineClassName}
			>
				{headline}
			</AsciiDecodeText>
		);
	}
	return (
		<div className="grid w-full" aria-hidden="true">
			<div className="col-start-1 row-start-1 [mask-image:linear-gradient(to_right,#000_46%,transparent_54%)]">
				<AsciiDecodeText
					size="xl"
					trigger="manual"
					decoded
					className={headlineClassName}
				>
					{headline}
				</AsciiDecodeText>
			</div>
			<div className="col-start-1 row-start-1 [mask-image:linear-gradient(to_right,transparent_46%,#000_54%)]">
				<AsciiDecodeText
					size="xl"
					trigger="manual"
					className={headlineClassName}
				>
					{headline}
				</AsciiDecodeText>
			</div>
		</div>
	);
}
