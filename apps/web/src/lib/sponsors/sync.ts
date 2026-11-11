import {
	cancelSubscription,
	type DodoConfig,
	type DodoWebhookEvent,
} from "./dodo";
import { sendReceipt } from "./email";
import { applySubscriptionEvent } from "./store";

/**
 * Applies a subscription event to its order, then cancels a payment that lost
 * the race for the last slot and emails the receipt. Shared by the webhook and
 * /api/sponsor/confirm, which runs when the buyer comes back from checkout.
 * Both are safe to repeat: an event already applied changes nothing.
 */
export async function syncSubscriptionEvent(
	config: DodoConfig,
	event: DodoWebhookEvent,
) {
	const { cancelSubscriptionId, receipt } = await applySubscriptionEvent(event);
	if (cancelSubscriptionId) {
		console.error(
			`Sponsor slot already booked; cancelling ${cancelSubscriptionId}. Refund it in Dodo.`,
		);
		await cancelSubscription(config, cancelSubscriptionId);
	}

	// The order is already saved, so a failed email must not fail the event;
	// a retry would find nothing new and send nothing.
	if (receipt) {
		await sendReceipt(receipt).catch((error) =>
			console.error(`Sponsor receipt for ${receipt.order.id} failed`, error),
		);
	}
}
