import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
	SPONSOR_PLACEMENT_IDS,
	SPONSOR_PLACEMENTS,
	type SponsorPlacement,
} from "@/config/sponsor";

import type { DodoWebhookEvent } from "./dodo";
import type { Receipt } from "./email";

// Sponsor orders live in D1 (`sponsor_orders`, see packages/db) and their
// uploaded logos and images in R2 under `sponsors/<order id>/`.

/** How long a placement stays held while the buyer is on the checkout. */
export const HOLD_MS = 30 * 60 * 1000;
/** Time between payment and the ad showing, so it can be checked first. */
export const REVIEW_MS = 24 * 60 * 60 * 1000;

const mediaPrefix = "sponsors/";

type Bindings = { DB?: D1Database; SPONSOR_MEDIA?: R2Bucket };

function bindings() {
	return getCloudflareContext().env as unknown as Bindings;
}

function getDb() {
	const db = bindings().DB;
	if (!db) throw new Error("D1 binding DB is missing");
	return db;
}

function getBucket() {
	const bucket = bindings().SPONSOR_MEDIA;
	if (!bucket) throw new Error("R2 binding SPONSOR_MEDIA is missing");
	return bucket;
}

// A row takes up one of its placement's slots while it is paid, recovering from a failed
// payment, inside a cancelled-but-paid period, or held by an open checkout.
const BLOCKING = `(
	status IN ('active', 'on_hold')
	OR (status = 'cancelled' AND paid_through > ?1)
	OR (status = 'pending' AND hold_expires_at > ?1)
)`;

const VISIBLE = `(
	live_at <= ?1
	AND (status = 'active' OR (status = 'cancelled' AND paid_through > ?1))
)`;

// ─── Reading slots ─────────────────────────────────────────────────────────

export type PaidSponsor = {
	name: string;
	href: string;
	description: string | null;
	logoSrc: string;
	imageSrc: string | null;
};

export type SponsorSlot = {
	/** Slots still free to book, out of the placement's `slots`. */
	remaining: number;
	available: boolean;
	/** Paid sponsors on show, oldest booking first. */
	sponsors: PaidSponsor[];
};

export type SponsorSlots = Record<SponsorPlacement, SponsorSlot>;

type OrderRow = {
	id: string;
	placement: SponsorPlacement;
	status: string;
	name: string;
	href: string;
	description: string | null;
	logo_key: string;
	image_key: string | null;
	contact_name: string;
	contact_email: string;
	notes: string | null;
	subscription_id: string | null;
	live_at: number | null;
	paid_through: number | null;
	visible: number;
};

export function mediaUrl(key: string) {
	return `/api/sponsor/media/${key}`;
}

export async function getSponsorSlots(now = Date.now()): Promise<SponsorSlots> {
	const { results } = await getDb()
		.prepare(
			`SELECT *, ${VISIBLE} AS visible FROM sponsor_orders
			WHERE ${BLOCKING}
			ORDER BY live_at ASC`,
		)
		.bind(now)
		.all<OrderRow>();

	const slots = {} as SponsorSlots;
	for (const placement of SPONSOR_PLACEMENT_IDS) {
		const rows = results.filter((row) => row.placement === placement);
		const remaining = Math.max(
			0,
			SPONSOR_PLACEMENTS[placement].slots - rows.length,
		);
		slots[placement] = {
			remaining,
			available: remaining > 0,
			sponsors: rows
				.filter((row) => row.visible)
				.map((row) => ({
					name: row.name,
					href: row.href,
					description: row.description,
					logoSrc: mediaUrl(row.logo_key),
					imageSrc: row.image_key ? mediaUrl(row.image_key) : null,
				})),
		};
	}
	return slots;
}

// ─── Checkout ──────────────────────────────────────────────────────────────

export type NewOrder = {
	id: string;
	placement: SponsorPlacement;
	name: string;
	href: string;
	description: string | null;
	logoKey: string;
	imageKey: string | null;
	contactName: string;
	contactEmail: string;
	notes: string | null;
};

/**
 * Inserts a `pending` order only if its placement has a free slot. D1 runs
 * writes one at a time, so two buyers cannot both get the last one.
 */
export async function holdPlacement(order: NewOrder, now = Date.now()) {
	const result = await getDb()
		.prepare(
			`INSERT INTO sponsor_orders (
				id, placement, status, name, href, description, logo_key, image_key,
				contact_name, contact_email, notes, hold_expires_at, created_at, updated_at
			)
			SELECT ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?1, ?1
			WHERE (
				SELECT COUNT(*) FROM sponsor_orders WHERE placement = ?3 AND ${BLOCKING}
			) < ?13`,
		)
		.bind(
			now,
			order.id,
			order.placement,
			order.name,
			order.href,
			order.description,
			order.logoKey,
			order.imageKey,
			order.contactName,
			order.contactEmail,
			order.notes,
			now + HOLD_MS,
			SPONSOR_PLACEMENTS[order.placement].slots,
		)
		.run();
	return result.meta.changes === 1;
}

export async function attachCheckoutSession(id: string, sessionId: string) {
	await getDb()
		.prepare(
			"UPDATE sponsor_orders SET checkout_session_id = ?2, updated_at = ?3 WHERE id = ?1",
		)
		.bind(id, sessionId, Date.now())
		.run();
}

/** Frees the placement when the checkout could not be created. */
export async function releaseHold(id: string) {
	await getDb()
		.prepare("DELETE FROM sponsor_orders WHERE id = ?1 AND status = 'pending'")
		.bind(id)
		.run();
	const { objects } = await getBucket().list({
		prefix: `${mediaPrefix}${id}/`,
	});
	if (objects.length) await getBucket().delete(objects.map((o) => o.key));
}

// ─── Media ─────────────────────────────────────────────────────────────────

export function mediaKey(orderId: string, name: string, ext: string) {
	return `${mediaPrefix}${orderId}/${name}.${ext}`;
}

export async function putMedia(key: string, file: File) {
	await getBucket().put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type },
	});
}

export async function getMedia(key: string) {
	if (!key.startsWith(mediaPrefix) || key.includes("..")) return null;
	return getBucket().get(key);
}

export async function getOrderStatus(id: string) {
	const row = await getDb()
		.prepare("SELECT status FROM sponsor_orders WHERE id = ?1")
		.bind(id)
		.first<{ status: string }>();
	return row?.status ?? null;
}

// ─── Webhooks ──────────────────────────────────────────────────────────────

const statusByEvent: Record<string, OrderRow["status"]> = {
	"subscription.active": "active",
	"subscription.renewed": "active",
	"subscription.unpaused": "active",
	"subscription.on_hold": "on_hold",
	"subscription.past_due": "on_hold",
	"subscription.paused": "on_hold",
	"subscription.cancelled": "cancelled",
	"subscription.expired": "ended",
	"subscription.failed": "ended",
};

/** Statuses we set ourselves; webhooks leave them alone. */
const lockedStatuses = new Set(["rejected", "conflict", "ended"]);

/**
 * Applies a Dodo subscription event to its order. Returns the subscription to
 * cancel when the payment landed on a placement others filled first (the
 * buyer paid after their hold ran out), and the receipt to email when the
 * event is a new payment. A redelivered event changes nothing, so it never
 * sends a second receipt.
 */
export async function applySubscriptionEvent(
	event: DodoWebhookEvent,
	now = Date.now(),
): Promise<{ cancelSubscriptionId?: string; receipt?: Receipt }> {
	const next = statusByEvent[event.type];
	const { subscription_id: subscriptionId, metadata } = event.data;
	if (!next || !subscriptionId) return {};

	const db = getDb();
	const orderId =
		typeof metadata?.order_id === "string" ? metadata.order_id : null;
	const row = await db
		.prepare(
			"SELECT * FROM sponsor_orders WHERE id = ?1 OR subscription_id = ?2 LIMIT 1",
		)
		.bind(orderId, subscriptionId)
		.first<OrderRow>();
	if (!row) return {};
	// A redelivered event retries a cancel that failed the first time.
	if (row.status === "conflict" && next === "active") {
		return { cancelSubscriptionId: subscriptionId };
	}
	if (lockedStatuses.has(row.status)) return {};

	const nextBilling = event.data.next_billing_date
		? Date.parse(event.data.next_billing_date)
		: Number.NaN;
	const paidThrough = Number.isFinite(nextBilling)
		? Math.max(nextBilling, row.paid_through ?? 0)
		: row.paid_through;

	const update = (status: string, liveAt = row.live_at) =>
		db
			.prepare(
				`UPDATE sponsor_orders
				SET status = ?2, subscription_id = ?3, live_at = ?4, paid_through = ?5,
					hold_expires_at = NULL, updated_at = ?6
				WHERE id = ?1`,
			)
			.bind(row.id, status, subscriptionId, liveAt, paidThrough, now)
			.run();

	const receipt = (kind: Receipt["kind"], liveAt: number | null): Receipt => ({
		kind,
		order: {
			id: row.id,
			placement: row.placement,
			name: row.name,
			href: row.href,
			logoKey: row.logo_key,
			contactName: row.contact_name,
			contactEmail: row.contact_email,
			notes: row.notes,
		},
		subscriptionId,
		paidAt: now,
		liveAt,
		paidThrough,
	});

	if (row.status !== "pending") {
		await update(next);
		// A renewal moves the paid period forward; a redelivery does not.
		const renewed =
			event.type === "subscription.renewed" &&
			paidThrough !== null &&
			paidThrough > (row.paid_through ?? 0);
		return renewed ? { receipt: receipt("renewal", row.live_at) } : {};
	}

	// First event for a new order. The webhook and the buyer's return to
	// /sponsor/thanks can both land here at once; only the one that moves the
	// row off `pending` acts, so the receipt goes out once.
	const claim = (status: string, liveAt: number | null) =>
		db
			.prepare(
				`UPDATE sponsor_orders
				SET status = ?2, subscription_id = ?3, live_at = ?4, paid_through = ?5,
					hold_expires_at = NULL, updated_at = ?6
				WHERE id = ?1 AND status = 'pending'`,
			)
			.bind(row.id, status, subscriptionId, liveAt, paidThrough, now)
			.run()
			.then((result) => result.meta.changes === 1);

	if (next !== "active") {
		await claim("ended", row.live_at);
		return {};
	}

	// Paid orders beat open holds, so only other paid orders can fill it.
	const paid = await db
		.prepare(
			`SELECT COUNT(*) AS count FROM sponsor_orders
			WHERE placement = ?2 AND id != ?3 AND status != 'pending' AND ${BLOCKING}`,
		)
		.bind(now, row.placement, row.id)
		.first<{ count: number }>();
	if ((paid?.count ?? 0) >= SPONSOR_PLACEMENTS[row.placement].slots) {
		return (await claim("conflict", row.live_at))
			? { cancelSubscriptionId: subscriptionId }
			: {};
	}

	if (!(await claim("active", now + REVIEW_MS))) return {};
	return { receipt: receipt("first", now + REVIEW_MS) };
}
