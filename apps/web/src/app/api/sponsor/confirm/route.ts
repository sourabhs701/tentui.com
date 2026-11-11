import { z } from "zod";

import { getDodoConfig, getSubscription } from "@/lib/sponsors/dodo";
import { getOrderStatus } from "@/lib/sponsors/store";
import { syncSubscriptionEvent } from "@/lib/sponsors/sync";

const bodySchema = z.object({
	subscriptionId: z
		.string()
		.min(1)
		.max(128)
		.regex(/^[\w-]+$/),
});

// /sponsor/thanks posts the `subscription_id` Dodo adds to the return URL.
// The subscription is read back from Dodo, never trusted from the browser,
// and applied like a webhook. This books the slot even when the webhook is
// late or can't reach us (local dev on test mode has no public URL).
export async function POST(request: Request) {
	const config = getDodoConfig();
	if (!config) return Response.json({ status: null }, { status: 503 });

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ status: null }, { status: 400 });

	const subscription = await getSubscription(
		config,
		parsed.data.subscriptionId,
	).catch((error) => {
		console.error("Sponsor confirm: subscription lookup failed", error);
		return null;
	});
	const orderId = subscription?.metadata?.order_id;
	if (!subscription || typeof orderId !== "string") {
		return Response.json({ status: null }, { status: 404 });
	}

	await syncSubscriptionEvent(config, {
		type: `subscription.${subscription.status}`,
		data: {
			subscription_id: subscription.subscription_id,
			status: subscription.status,
			next_billing_date: subscription.next_billing_date,
			metadata: subscription.metadata,
		},
	});

	return Response.json(
		{ status: await getOrderStatus(orderId) },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
