"use client";

import { CheckIcon, CopyIcon } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

import { SoftButton } from "../../_components/soft-button";

export function CopyAddressButton({ email }: { email: string }) {
	const { state, copy } = useCopyToClipboard();
	const copied = state === "done";

	return (
		<SoftButton
			type="button"
			variant="outline"
			size="sm"
			aria-live="polite"
			onClick={() => copy(email)}
		>
			{copied ? (
				<CheckIcon className="size-3.5" />
			) : (
				<CopyIcon className="size-3.5" />
			)}
			{copied ? "Copied" : "Copy address"}
		</SoftButton>
	);
}
