import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
	SPONSOR_EMAIL,
	SPONSOR_PLACEMENTS,
	type SponsorPlacement,
} from "@/config/sponsor";

// Receipts go out through Cloudflare Email Service (`send_email` binding
// EMAIL in wrangler.jsonc). The sender's domain must be onboarded under
// Email Service → Domains. Dodo Payments, as merchant of record, still sends
// the tax invoice; this is our confirmation of what was booked.
// DOCS: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/

const FROM = { name: "TentUI", email: "sourabh@tentui.com" };
const SITE = "https://tentui.com";

export type ReceiptOrder = {
	id: string;
	placement: SponsorPlacement;
	name: string;
	href: string;
	logoKey: string;
	contactName: string;
	contactEmail: string;
	notes: string | null;
};

export type Receipt = {
	kind: "first" | "renewal";
	order: ReceiptOrder;
	subscriptionId: string;
	paidAt: number;
	liveAt: number | null;
	paidThrough: number | null;
};

function getMailer() {
	const env = getCloudflareContext().env as unknown as { EMAIL?: SendEmail };
	return env.EMAIL ?? null;
}

/** Emails the buyer their receipt and, for a new booking, tells us to review it. */
export async function sendReceipt(receipt: Receipt) {
	const mailer = getMailer();
	if (!mailer) {
		console.warn("send_email binding EMAIL is missing; receipt not sent");
		return;
	}

	const { order } = receipt;
	const placement = SPONSOR_PLACEMENTS[order.placement];
	const amount = `$${placement.price.toFixed(2)} USD`;
	const rows: [string, string][] = [
		["Placement", placement.label],
		["Ad", `${order.name} · ${order.href}`],
		["Amount", `${amount} / month`],
		["Paid on", formatDate(receipt.paidAt)],
		...(receipt.paidThrough
			? ([["Renews on", formatDate(receipt.paidThrough)]] as [string, string][])
			: []),
		...(receipt.kind === "first" && receipt.liveAt
			? ([["Goes live", `By ${formatDate(receipt.liveAt)}`]] as [
					string,
					string,
				][])
			: []),
		["Order", order.id],
		["Subscription", receipt.subscriptionId],
	];

	const intro =
		receipt.kind === "first"
			? `Thanks for sponsoring TentUI, ${order.contactName}. We check every ad first; yours goes live within 24 hours.`
			: `Your TentUI sponsorship renewed, ${order.contactName}. Your ad stays up for another month.`;
	const outro =
		"Dodo Payments sends the tax invoice separately. To cancel, use the link in their email. Questions? Reply to this email.";

	await mailer.send({
		from: FROM,
		to: { name: order.contactName, email: order.contactEmail },
		replyTo: SPONSOR_EMAIL,
		subject:
			receipt.kind === "first"
				? `Your TentUI receipt · ${placement.label}`
				: `Your TentUI renewal receipt · ${placement.label}`,
		text: [intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", outro].join(
			"\n",
		),
		html: receiptHtml({ title: "Receipt", intro, rows, outro }),
	});

	if (receipt.kind === "first") {
		await mailer.send({
			from: FROM,
			to: SPONSOR_EMAIL,
			replyTo: order.contactEmail,
			subject: `New sponsor: ${order.name} (${placement.label})`,
			text: [
				`${order.contactName} <${order.contactEmail}> booked the ${placement.label}.`,
				`Logo: ${SITE}/api/sponsor/media/${order.logoKey}`,
				`It goes live ${receipt.liveAt ? formatDate(receipt.liveAt) : "soon"}. To pull it, set status = 'rejected' on sponsor_orders ${order.id}, then cancel and refund in Dodo.`,
				order.notes ? `\nNotes:\n${order.notes}` : "",
			].join("\n"),
		});
	}
}

function formatDate(ms: number) {
	return new Date(ms).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

// Table layout and inline styles, since mail clients ignore most CSS.
function receiptHtml({
	title,
	intro,
	rows,
	outro,
}: {
	title: string;
	intro: string;
	rows: [string, string][];
	outro: string;
}) {
	const font =
		"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
	const cells = rows
		.map(
			([label, value]) => `<tr>
				<td style="padding:10px 0;border-top:1px solid #e4e4e7;color:#71717a;font-size:14px;width:140px;vertical-align:top">${escapeHtml(label)}</td>
				<td style="padding:10px 0;border-top:1px solid #e4e4e7;color:#18181b;font-size:14px;word-break:break-all">${escapeHtml(value)}</td>
			</tr>`,
		)
		.join("");

	return `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f4f4f5;${font}">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">
		<tr><td style="padding:28px 28px 8px">
			<p style="margin:0;font-size:13px;font-weight:600;color:#71717a">TentUI</p>
			<h1 style="margin:8px 0 0;font-size:22px;color:#18181b">${escapeHtml(title)}</h1>
			<p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#3f3f46">${escapeHtml(intro)}</p>
		</td></tr>
		<tr><td style="padding:16px 28px 0">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table>
		</td></tr>
		<tr><td style="padding:16px 28px 28px">
			<p style="margin:0;font-size:13px;line-height:1.55;color:#71717a">${escapeHtml(outro)}</p>
			<p style="margin:16px 0 0;font-size:13px"><a href="${SITE}" style="color:#18181b">tentui.com</a></p>
		</td></tr>
	</table>
</body></html>`;
}
