"use client";

import { BubbleWrap } from "@/registry/components/bubble-wrap/bubble-wrap";

/** A sheet mid-sweep: one thumb-width arc of popped bubbles across the middle. */
const sweep = [12, 7, 8, 9, 16, 23];

function BubbleWrapPreview() {
	return <BubbleWrap defaultPopped={sweep} />;
}

export default BubbleWrapPreview;
