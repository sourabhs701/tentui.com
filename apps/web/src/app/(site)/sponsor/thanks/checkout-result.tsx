"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SPONSOR_EMAIL, sponsorMailto } from "@/config/sponsor";

import { SoftButton } from "../../_components/soft-button";

const paidStatuses = new Set(["active", "succeeded"]);
/** Order statuses that mean the slot is booked. */
const bookedStatuses = new Set(["active", "on_hold"]);

const confirmAttempts = 6;
const confirmDelayMs = 2_000;

type Confirmation = "checking" | "booked" | "unconfirmed";

/**
 * Books the slot from the return URL, so it doesn't wait on the webhook.
 * Retries for a few seconds while Dodo still reports the subscription pending.
 */
function useConfirmation(subscriptionId: string | null, paid: boolean) {
	const [state, setState] = useState<Confirmation>("checking");

	useEffect(() => {
		if (!subscriptionId || !paid) return;
		let cancelled = false;

		(async () => {
			for (let attempt = 0; attempt < confirmAttempts; attempt++) {
				if (attempt) {
					await new Promise((resolve) => setTimeout(resolve, confirmDelayMs));
				}
				if (cancelled) return;
				const response = await fetch("/api/sponsor/confirm", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ subscriptionId }),
				}).catch(() => null);
				const data = (await response?.json().catch(() => null)) as {
					status: string | null;
				} | null;
				if (cancelled) return;
				if (data?.status && bookedStatuses.has(data.status)) {
					setState("booked");
					return;
				}
				// Anything but a still-pending order is final.
				if (response?.ok && data?.status !== "pending") break;
			}
			if (!cancelled) setState("unconfirmed");
		})();

		return () => {
			cancelled = true;
		};
	}, [subscriptionId, paid]);

	return subscriptionId && paid ? state : null;
}

export function CheckoutResult() {
	const params = useSearchParams();
	const status = params.get("status");
	const paid = status === null || paidStatuses.has(status);
	const confirmation = useConfirmation(params.get("subscription_id"), paid);

	return (
		<div className="max-w-2xl">
			<h1 className="font-medium text-5xl text-foreground leading-[1.05] tracking-tight sm:text-7xl">
				{paid ? "You're booked" : "Payment didn't go through"}
			</h1>
			<p className="mt-6 text-lg text-muted-foreground sm:text-xl">
				{paid
					? "Thanks for sponsoring TentUI. Your receipt is on its way. We check every ad first, and yours goes live within 24 hours."
					: "Nothing was charged and the slot is free again for a few minutes. You can try again, or email us if it keeps failing."}
			</p>
			{confirmation && (
				<p
					aria-live="polite"
					className="mt-4 text-muted-foreground text-sm"
					data-confirmation={confirmation}
				>
					{confirmation === "checking" && "Confirming your booking…"}
					{confirmation === "booked" && "Booking confirmed."}
					{confirmation === "unconfirmed" &&
						"We're still waiting on the payment to confirm. If you don't get a receipt within an hour, email us."}
				</p>
			)}
			<div className="mt-10 flex flex-wrap items-center gap-6">
				<SoftButton href={(paid ? "/" : "/sponsor") as Route} size="sm">
					{paid ? "Back to TentUI" : "Try again"}
				</SoftButton>
				<a
					href={sponsorMailto()}
					className="font-medium text-muted-foreground text-sm hover:text-foreground hover:underline"
				>
					{SPONSOR_EMAIL}
				</a>
			</div>
		</div>
	);
}
