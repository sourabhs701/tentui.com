import {
	cancelSubscription,
	type DodoWebhookEvent,
	getDodoConfig,
	verifyWebhook,
} from "@/lib/sponsors/dodo";
import { applySubscriptionEvent } from "@/lib/sponsors/store";

// Dodo Payments → Developer → Webhooks: point an endpoint at
// https://tentui.com/api/sponsor/webhook with the subscription.* events.
export async function POST(request: Request) {
	const config = getDodoConfig();
	if (!config) return new Response("Not configured", { status: 503 });

	const body = await request.text();
	if (!(await verifyWebhook(config.webhookKey, body, request.headers))) {
		return new Response("Invalid signature", { status: 401 });
	}

	const event = JSON.parse(body) as DodoWebhookEvent;
	if (!event.type.startsWith("subscription.")) {
		return new Response(null, { status: 204 });
	}

	const { cancelSubscriptionId } = await applySubscriptionEvent(event);
	if (cancelSubscriptionId) {
		console.error(
			`Sponsor slot already booked; cancelling ${cancelSubscriptionId}. Refund it in Dodo.`,
		);
		await cancelSubscription(config, cancelSubscriptionId);
	}

	return new Response(null, { status: 204 });
}
