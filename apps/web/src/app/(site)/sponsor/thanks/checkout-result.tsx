"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";

import { SPONSOR_EMAIL, sponsorMailto } from "@/config/sponsor";

import { SoftButton } from "../../_components/soft-button";

const paidStatuses = new Set(["active", "succeeded"]);

export function CheckoutResult() {
	const status = useSearchParams().get("status");
	const paid = status === null || paidStatuses.has(status);

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
