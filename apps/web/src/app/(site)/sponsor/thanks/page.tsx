import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutResult } from "./checkout-result";

export const dynamic = "force-static";

export const metadata: Metadata = {
	title: "Thanks for sponsoring",
	robots: { index: false },
};

// Dodo Payments sends buyers here after checkout, adding `status` and
// `subscription_id`. The webhook, not this page, books the slot.
export default function SponsorThanksPage() {
	return (
		<section className="w-full px-4 pt-12 pb-24 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-6xl">
				<Suspense>
					<CheckoutResult />
				</Suspense>
			</div>
		</section>
	);
}
