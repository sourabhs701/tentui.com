import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { SponsorPlacement } from "@/config/sponsor";

// Dodo Payments over its REST API (no SDK, so it runs as-is in the Worker).
// DOCS: https://docs.dodopayments.com/api-reference/introduction

type DodoConfig = {
	apiKey: string;
	webhookKey: string;
	baseUrl: string;
	productIds: Record<SponsorPlacement, string>;
};

/** Secrets come from the Worker env in production and `.env` in dev. */
function readVar(name: string) {
	const env = getCloudflareContext().env as unknown as Record<string, unknown>;
	const value = env[name] ?? process.env[name];
	return typeof value === "string" && value ? value : undefined;
}

export function getDodoConfig(): DodoConfig | null {
	const apiKey = readVar("DODO_PAYMENTS_API_KEY");
	const webhookKey = readVar("DODO_PAYMENTS_WEBHOOK_KEY");
	const header = readVar("DODO_PRODUCT_HEADER_ID");
	const feed = readVar("DODO_PRODUCT_FEED_ID");
	if (!apiKey || !webhookKey || !header || !feed) return null;

	const live = readVar("DODO_PAYMENTS_ENVIRONMENT") === "live_mode";
	return {
		apiKey,
		webhookKey,
		baseUrl: live
			? "https://live.dodopayments.com"
			: "https://test.dodopayments.com",
		productIds: { header, feed },
	};
}

async function dodoFetch<T>(
	config: DodoConfig,
	path: string,
	init: { method: "POST" | "PATCH"; body: unknown },
) {
	const response = await fetch(`${config.baseUrl}${path}`, {
		method: init.method,
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(init.body),
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`Dodo ${init.method} ${path} failed: ${response.status} ${detail}`,
		);
	}
	return (await response.json()) as T;
}

export function createCheckoutSession(
	config: DodoConfig,
	input: {
		placement: SponsorPlacement;
		orderId: string;
		customer: { name: string; email: string };
		returnUrl: string;
		cancelUrl: string;
	},
) {
	return dodoFetch<{ session_id: string; checkout_url: string | null }>(
		config,
		"/checkouts",
		{
			method: "POST",
			body: {
				product_cart: [
					{ product_id: config.productIds[input.placement], quantity: 1 },
				],
				customer: input.customer,
				return_url: input.returnUrl,
				cancel_url: input.cancelUrl,
				metadata: { order_id: input.orderId, placement: input.placement },
			},
		},
	);
}

export function cancelSubscription(config: DodoConfig, subscriptionId: string) {
	return dodoFetch(config, `/subscriptions/${subscriptionId}`, {
		method: "PATCH",
		body: { status: "cancelled" },
	});
}

// ─── Webhooks ──────────────────────────────────────────────────────────────
// Dodo signs webhooks per the Standard Webhooks spec: HMAC-SHA256 over
// `${id}.${timestamp}.${body}` with the base64 key after `whsec_`.

const toleranceSeconds = 5 * 60;

export async function verifyWebhook(
	webhookKey: string,
	body: string,
	headers: Headers,
) {
	const id = headers.get("webhook-id");
	const timestamp = headers.get("webhook-timestamp");
	const signatures = headers.get("webhook-signature");
	if (!id || !timestamp || !signatures) return false;

	const sentAt = Number(timestamp);
	if (
		!Number.isFinite(sentAt) ||
		Math.abs(Date.now() / 1000 - sentAt) > toleranceSeconds
	) {
		return false;
	}

	const key = await crypto.subtle.importKey(
		"raw",
		base64ToBytes(webhookKey.replace(/^whsec_/, "")),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);

	for (const entry of signatures.split(" ")) {
		const [version, signature] = entry.split(",");
		if (version !== "v1" || !signature) continue;
		// `verify` compares in constant time.
		if (
			await crypto.subtle.verify("HMAC", key, base64ToBytes(signature), signed)
		) {
			return true;
		}
	}
	return false;
}

function base64ToBytes(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export type DodoWebhookEvent = {
	type: string;
	data: {
		subscription_id?: string;
		status?: string;
		next_billing_date?: string;
		metadata?: Record<string, unknown>;
	};
};
