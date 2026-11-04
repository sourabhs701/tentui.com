import { z } from "zod";

import { SPONSOR_PLACEMENT_IDS } from "@/config/sponsor";

// Shared by the booking dialog and /api/sponsor/checkout.

export const MEDIA_TYPES = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/svg+xml": "svg",
} as const;

export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(",");

export const LOGO_MAX_BYTES = 1024 * 1024;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Accepts `acme.com` as well as full URLs. */
function normalizeUrl(value: string) {
	const trimmed = value.trim();
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const sponsorFormSchema = z
	.object({
		placement: z.enum(SPONSOR_PLACEMENT_IDS),
		name: z.string().trim().min(1, "Add the name to show").max(40),
		href: z
			.string()
			.trim()
			.min(1, "Add a link")
			.transform(normalizeUrl)
			.pipe(
				z.url({
					protocol: /^https?$/,
					hostname: z.regexes.domain,
					error: "Use a link like acme.com",
				}),
			),
		description: z.string().trim().max(60).optional(),
		contactName: z.string().trim().min(1, "Add your name").max(80),
		contactEmail: z.email("Use a valid email"),
		notes: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.placement !== "feed" || Boolean(value.description), {
		path: ["description"],
		message: "Add a short line",
	});

export type SponsorFormValues = z.infer<typeof sponsorFormSchema>;

export function checkMediaFile(
	file: File | null,
	maxBytes: number,
	label: string,
) {
	if (!file || file.size === 0) return `Add ${label}`;
	if (!(file.type in MEDIA_TYPES)) return "Use PNG, JPG, WebP or SVG";
	if (file.size > maxBytes) {
		return `Keep it under ${Math.round(maxBytes / 1024 / 1024)} MB`;
	}
	return null;
}
