"use client";

import { useTiks } from "@rexa-developer/tiks/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";

export type CopyState = "idle" | "done" | "error";

export type UseCopyToClipboardOptions = {
	onCopySuccess?: (text: string) => void;
	onCopyError?: (error: Error) => void;
	resetDelay?: number;
};

export function useCopyToClipboard({
	onCopySuccess,
	onCopyError,
	resetDelay = 1500,
}: UseCopyToClipboardOptions = {}) {
	const [state, setState] = useState<CopyState>("idle");
	const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { trigger: haptic } = useWebHaptics();
	const { success: playSuccess, error: playError } = useTiks();

	useEffect(() => {
		return () => {
			if (resetTimeoutRef.current) {
				clearTimeout(resetTimeoutRef.current);
			}
		};
	}, []);

	const copy = useCallback(
		async (text: string | (() => string)) => {
			// Clear any pending reset
			if (resetTimeoutRef.current) {
				clearTimeout(resetTimeoutRef.current);
			}

			try {
				const finalText = typeof text === "function" ? text() : text;
				await navigator.clipboard.writeText(finalText);

				setState("done");
				void haptic("success");
				playSuccess();
				onCopySuccess?.(finalText);
			} catch (error) {
				setState("error");
				void haptic("error");
				playError();
				onCopyError?.(
					error instanceof Error ? error : new Error("Copy failed"),
				);
			} finally {
				// Schedule reset to idle
				resetTimeoutRef.current = setTimeout(() => {
					setState("idle");
				}, resetDelay);
			}
		},
		[onCopySuccess, onCopyError, haptic, playSuccess, playError, resetDelay],
	);

	return { state, copy } as const;
}
