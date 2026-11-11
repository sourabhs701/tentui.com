import {
	type DodoWebhookEvent,
	getDodoConfig,
	verifyWebhook,
} from "@/lib/sponsors/dodo";
import { syncSubscriptionEvent } from "@/lib/sponsors/sync";

// Dodo Payments → Developer → Webhooks: point an endpoint at
// https://tentui.com/api/sponsor/webhook with the subscription.* events, and
// put its signing secret in DODO_PAYMENTS_WEBHOOK_KEY.
export async function POST(request: Request) {
	const config = getDodoConfig();
	if (!config?.webhookKey) {
		return new Response("Not configured", { status: 503 });
	}

	const body = await request.text();
	if (!(await verifyWebhook(config.webhookKey, body, request.headers))) {
		return new Response("Invalid signature", { status: 401 });
	}

	const event = JSON.parse(body) as DodoWebhookEvent;
	if (!event.type?.startsWith("subscription.")) {
		return new Response(null, { status: 204 });
	}

	await syncSubscriptionEvent(config, event);
	return new Response(null, { status: 204 });
}
