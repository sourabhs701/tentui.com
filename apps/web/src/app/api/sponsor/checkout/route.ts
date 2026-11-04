import { createCheckoutSession, getDodoConfig } from "@/lib/sponsors/dodo";
import {
	checkMediaFile,
	IMAGE_MAX_BYTES,
	LOGO_MAX_BYTES,
	MEDIA_TYPES,
	sponsorFormSchema,
} from "@/lib/sponsors/form";
import {
	attachCheckoutSession,
	holdPlacement,
	mediaKey,
	putMedia,
	releaseHold,
} from "@/lib/sponsors/store";

type FieldErrors = Record<string, string>;

function fail(status: number, error: string, fieldErrors?: FieldErrors) {
	return Response.json({ error, fieldErrors }, { status });
}

function fileField(form: FormData, name: string) {
	const value = form.get(name);
	return value instanceof File && value.size > 0 ? value : null;
}

function textField(form: FormData, name: string) {
	const value = form.get(name);
	return typeof value === "string" && value.trim() ? value : undefined;
}

// Takes the booking dialog's multipart form, holds the placement, stores the
// media and returns a Dodo checkout URL for the browser to open.
export async function POST(request: Request) {
	const config = getDodoConfig();
	if (!config) {
		return fail(503, "Checkout isn't set up yet. Email us to book a slot.");
	}

	const form = await request.formData().catch(() => null);
	if (!form) return fail(400, "Couldn't read the form.");

	const parsed = sponsorFormSchema.safeParse({
		placement: textField(form, "placement"),
		name: textField(form, "name") ?? "",
		href: textField(form, "href") ?? "",
		description: textField(form, "description"),
		contactName: textField(form, "contactName") ?? "",
		contactEmail: textField(form, "contactEmail") ?? "",
		notes: textField(form, "notes"),
	});

	const fieldErrors: FieldErrors = {};
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			const field = String(issue.path[0]);
			fieldErrors[field] ??= issue.message;
		}
	}

	const logo = fileField(form, "logo");
	const image = fileField(form, "image");
	const logoError = checkMediaFile(logo, LOGO_MAX_BYTES, "a logo");
	if (logoError) fieldErrors.logo = logoError;
	if (parsed.data?.placement === "feed") {
		const imageError = checkMediaFile(image, IMAGE_MAX_BYTES, "an image");
		if (imageError) fieldErrors.image = imageError;
	}

	if (!parsed.success || Object.keys(fieldErrors).length) {
		return fail(400, "Check the highlighted fields.", fieldErrors);
	}

	const values = parsed.data;
	const id = crypto.randomUUID();
	const extension = (file: File) =>
		MEDIA_TYPES[file.type as keyof typeof MEDIA_TYPES];
	const logoKey = mediaKey(id, "logo", extension(logo as File));
	const imageKey =
		values.placement === "feed" && image
			? mediaKey(id, "image", extension(image))
			: null;

	const held = await holdPlacement({
		id,
		placement: values.placement,
		name: values.name,
		href: values.href,
		description:
			values.placement === "feed" ? (values.description ?? null) : null,
		logoKey,
		imageKey,
		contactName: values.contactName,
		contactEmail: values.contactEmail,
		notes: values.notes ?? null,
	});
	if (!held) {
		return fail(409, "Someone just booked this slot. Pick another one.");
	}

	try {
		await putMedia(logoKey, logo as File);
		if (imageKey && image) await putMedia(imageKey, image);

		const origin = new URL(request.url).origin;
		const session = await createCheckoutSession(config, {
			placement: values.placement,
			orderId: id,
			customer: { name: values.contactName, email: values.contactEmail },
			returnUrl: `${origin}/sponsor/thanks`,
			cancelUrl: `${origin}/sponsor`,
		});
		if (!session.checkout_url) throw new Error("No checkout URL from Dodo");

		await attachCheckoutSession(id, session.session_id);
		return Response.json({ checkoutUrl: session.checkout_url });
	} catch (error) {
		console.error("Sponsor checkout failed", error);
		await releaseHold(id).catch(console.error);
		return fail(502, "Couldn't start the payment. Try again in a minute.");
	}
}
