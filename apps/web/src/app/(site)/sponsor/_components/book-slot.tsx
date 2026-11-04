"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@tentui.com/ui/components/dialog";
import { Input } from "@tentui.com/ui/components/input";
import { Label } from "@tentui.com/ui/components/label";
import { Textarea } from "@tentui.com/ui/components/textarea";
import { LoaderIcon, MegaphoneIcon, UploadIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import {
	SPONSOR_EMAIL,
	SPONSOR_PLACEMENT_IDS,
	SPONSOR_PLACEMENTS,
	type SponsorPlacement,
	sponsorMailto,
} from "@/config/sponsor";
import { useSponsorSlots } from "@/hooks/use-sponsor-slots";
import { trackEvent } from "@/lib/events";
import {
	checkMediaFile,
	IMAGE_MAX_BYTES,
	LOGO_MAX_BYTES,
	MEDIA_ACCEPT,
	sponsorFormSchema,
} from "@/lib/sponsors/form";
import { cn } from "@/lib/utils";

import { SoftButton } from "../../_components/soft-button";

type FieldErrors = Record<string, string>;

// ─── Book Slot ─────────────────────────────────────────────────────────────
// The placements with their price and whether they are free, each opening
// the booking dialog. Payment happens on Dodo Payments' hosted checkout.
export function BookSlot() {
	const { data: slots } = useSponsorSlots();
	const [open, setOpen] = useState(false);
	const [placement, setPlacement] = useState<SponsorPlacement>("header");

	const book = (id: SponsorPlacement) => {
		setPlacement(id);
		setOpen(true);
	};

	return (
		<>
			<ul className="divide-y">
				{SPONSOR_PLACEMENT_IDS.map((id) => {
					const info = SPONSOR_PLACEMENTS[id];
					const available = slots?.[id].available;
					return (
						<li
							key={id}
							className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5"
						>
							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-2 font-semibold tracking-tight">
									{info.label}
									<SlotStatus available={available} />
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{info.summary}
								</p>
							</div>
							<p className="font-semibold tabular-nums tracking-tight">
								${info.price}
								<span className="font-medium text-muted-foreground text-sm">
									{" "}
									/ month
								</span>
							</p>
							<SoftButton
								type="button"
								size="sm"
								disabled={available === false}
								onClick={() => book(id)}
								className="disabled:pointer-events-none disabled:opacity-50"
							>
								{available === false ? "Booked" : "Book"}
							</SoftButton>
						</li>
					);
				})}
			</ul>
			<Dialog open={open} onOpenChange={setOpen}>
				<BookingDialog placement={placement} onPlacementChange={setPlacement} />
			</Dialog>
		</>
	);
}

function SlotStatus({ available }: { available: boolean | undefined }) {
	if (available === undefined) {
		return <span className="h-4 w-10 animate-pulse rounded-full bg-muted" />;
	}
	return (
		<span
			className={cn(
				"rounded-full border px-1.5 py-px font-medium text-[11px]",
				available
					? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					: "text-muted-foreground",
			)}
		>
			{available ? "Open" : "Booked"}
		</span>
	);
}

// ─── Booking Dialog ────────────────────────────────────────────────────────

function BookingDialog({
	placement,
	onPlacementChange,
}: {
	placement: SponsorPlacement;
	onPlacementChange: (placement: SponsorPlacement) => void;
}) {
	const { data: slots } = useSponsorSlots();
	const [errors, setErrors] = useState<FieldErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const isFeed = placement === "feed";
	const price = SPONSOR_PLACEMENTS[placement].price;
	const available = slots?.[placement].available ?? false;
	const allBooked =
		slots && SPONSOR_PLACEMENT_IDS.every((id) => !slots[id].available);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		form.set("placement", placement);

		const nextErrors = validate(form, isFeed);
		setErrors(nextErrors);
		setFormError(null);
		if (Object.keys(nextErrors).length) return;

		setPending(true);
		try {
			const response = await fetch("/api/sponsor/checkout", {
				method: "POST",
				body: form,
			});
			const result = (await response.json()) as {
				checkoutUrl?: string;
				error?: string;
				fieldErrors?: FieldErrors;
			};
			if (!response.ok || !result.checkoutUrl) {
				setErrors(result.fieldErrors ?? {});
				setFormError(result.error ?? "Something went wrong. Try again.");
				setPending(false);
				return;
			}
			trackEvent({
				name: "sponsor_checkout_start",
				properties: { placement },
			});
			window.location.assign(result.checkoutUrl);
		} catch {
			setFormError("Couldn't reach the server. Try again.");
			setPending(false);
		}
	};

	return (
		<DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[21px] p-5 sm:max-w-xl sm:p-8">
			<span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
				<MegaphoneIcon className="size-5" />
			</span>
			<DialogTitle className="mt-5 font-bold text-2xl tracking-tight">
				Sponsor a slot
			</DialogTitle>
			<DialogDescription className="mt-2 text-base text-foreground/80 leading-relaxed">
				Two placements, one sponsor each. Your logo, your name and a link,
				styled like the rest of the site. No tracking pixels, no pop-ups.
			</DialogDescription>
			<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
				Billed monthly through Dodo Payments · cancel any time. Your ad goes
				live 24 hours after you pay, once we have checked it.
			</p>

			<form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
				<fieldset>
					<legend className="mb-2 font-medium text-sm">Placement</legend>
					<div
						role="radiogroup"
						aria-label="Placement"
						className="grid grid-cols-2 gap-2"
					>
						{SPONSOR_PLACEMENT_IDS.map((id) => {
							const slot = slots?.[id];
							const selected = id === placement;
							return (
								<button
									key={id}
									type="button"
									role="radio"
									aria-checked={selected}
									disabled={slot?.available === false}
									onClick={() => {
										onPlacementChange(id);
										setErrors({});
										setFormError(null);
									}}
									className={cn(
										"flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-center transition-colors",
										"outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
										"disabled:cursor-not-allowed disabled:opacity-50",
										selected
											? "border-foreground bg-foreground text-background"
											: "hover:bg-muted",
									)}
								>
									<span className="font-semibold text-sm">
										{SPONSOR_PLACEMENTS[id].label}
									</span>
									<span
										className={cn(
											"text-xs tabular-nums",
											selected ? "text-background/70" : "text-muted-foreground",
										)}
									>
										${SPONSOR_PLACEMENTS[id].price}/mo ·{" "}
										{slot === undefined
											? "…"
											: slot.available
												? "Open"
												: "Booked"}
									</span>
								</button>
							);
						})}
					</div>
				</fieldset>

				<div className="grid gap-5 sm:grid-cols-[1fr_9.5rem]">
					<div className="flex flex-col gap-5">
						<Field id="name" label="Name under your logo" error={errors.name}>
							<Input
								id="name"
								name="name"
								placeholder="Acme"
								maxLength={40}
								autoComplete="organization"
								aria-invalid={!!errors.name}
								className="h-10"
							/>
						</Field>
						<Field id="href" label="Link" error={errors.href}>
							<Input
								id="href"
								name="href"
								placeholder="acme.com"
								inputMode="url"
								autoComplete="url"
								aria-invalid={!!errors.href}
								className="h-10"
							/>
						</Field>
					</div>
					<Field id="logo" label="Logo" error={errors.logo}>
						<MediaUpload
							id="logo"
							name="logo"
							hint="PNG, JPG, WebP or SVG"
							invalid={!!errors.logo}
							className="aspect-square w-36 sm:h-full sm:min-h-[9.5rem] sm:w-full"
							previewClassName="object-contain p-5"
						/>
					</Field>
				</div>
				<p className="-mt-2 text-muted-foreground text-xs">
					Shown in its original colours. A square logo looks best.
				</p>

				{isFeed ? (
					<>
						<Field
							id="description"
							label="One line, shown on hover"
							error={errors.description}
						>
							<Input
								id="description"
								name="description"
								placeholder="Analytics your team will actually open"
								maxLength={60}
								aria-invalid={!!errors.description}
								className="h-10"
							/>
						</Field>
						<Field id="image" label="Card image" error={errors.image}>
							<MediaUpload
								id="image"
								name="image"
								hint="1200 × 800 works best · up to 4 MB"
								invalid={!!errors.image}
								className="aspect-[3/2]"
								previewClassName="object-cover"
							/>
						</Field>
					</>
				) : null}

				<div className="grid gap-5 sm:grid-cols-2">
					<Field id="contactName" label="Your name" error={errors.contactName}>
						<Input
							id="contactName"
							name="contactName"
							placeholder="Alex Morgan"
							autoComplete="name"
							aria-invalid={!!errors.contactName}
							className="h-10"
						/>
					</Field>
					<Field
						id="contactEmail"
						label="Email (for the receipt)"
						error={errors.contactEmail}
					>
						<Input
							id="contactEmail"
							name="contactEmail"
							type="email"
							placeholder="alex@acme.com"
							autoComplete="email"
							aria-invalid={!!errors.contactEmail}
							className="h-10"
						/>
					</Field>
				</div>

				<Field id="notes" label="Anything else (optional)">
					<Textarea
						id="notes"
						name="notes"
						placeholder="Questions, preferred start date"
						maxLength={1000}
						className="min-h-24"
					/>
				</Field>

				{formError ? (
					<p role="alert" className="text-destructive text-sm">
						{formError}
					</p>
				) : null}

				<Button
					type="submit"
					size="lg"
					disabled={pending || !available}
					className="h-12 rounded-xl text-base"
				>
					{pending ? (
						<>
							<LoaderIcon className="animate-spin" />
							Opening checkout…
						</>
					) : allBooked ? (
						"Both slots are booked"
					) : (
						`Continue to payment — $${price}/month`
					)}
				</Button>
				<p className="text-center text-muted-foreground text-xs">
					Payment is handled by Dodo Payments. Questions?{" "}
					<a href={sponsorMailto()} className="underline underline-offset-2">
						{SPONSOR_EMAIL}
					</a>
				</p>
			</form>
		</DialogContent>
	);
}

function validate(form: FormData, isFeed: boolean) {
	const errors: FieldErrors = {};
	const text = (name: string) => {
		const value = form.get(name);
		return typeof value === "string" && value.trim() ? value : undefined;
	};
	const file = (name: string) => {
		const value = form.get(name);
		return value instanceof File && value.size > 0 ? value : null;
	};

	const parsed = sponsorFormSchema.safeParse({
		placement: text("placement"),
		name: text("name") ?? "",
		href: text("href") ?? "",
		description: text("description"),
		contactName: text("contactName") ?? "",
		contactEmail: text("contactEmail") ?? "",
		notes: text("notes"),
	});
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors[String(issue.path[0])] ??= issue.message;
		}
	}

	const logoError = checkMediaFile(file("logo"), LOGO_MAX_BYTES, "a logo");
	if (logoError) errors.logo = logoError;
	if (isFeed) {
		const imageError = checkMediaFile(
			file("image"),
			IMAGE_MAX_BYTES,
			"an image",
		);
		if (imageError) errors.image = imageError;
	}
	return errors;
}

function Field({
	id,
	label,
	error,
	children,
}: {
	id: string;
	label: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
			{error ? (
				<p id={`${id}-error`} className="text-destructive text-xs">
					{error}
				</p>
			) : null}
		</div>
	);
}

function MediaUpload({
	id,
	name,
	hint,
	invalid,
	className,
	previewClassName,
}: {
	id: string;
	name: string;
	hint: string;
	invalid: boolean;
	className?: string;
	previewClassName?: string;
}) {
	const [preview, setPreview] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (preview) URL.revokeObjectURL(preview);
		};
	}, [preview]);

	return (
		<label
			htmlFor={id}
			className={cn(
				"group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed px-4 text-center transition-colors",
				"hover:border-foreground/30 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
				invalid && "border-destructive",
				className,
			)}
		>
			<input
				id={id}
				name={name}
				type="file"
				accept={MEDIA_ACCEPT}
				className="sr-only"
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					setPreview(file ? URL.createObjectURL(file) : null);
				}}
			/>
			{preview ? (
				// biome-ignore lint/performance/noImgElement: local blob preview
				<img
					src={preview}
					alt=""
					className={cn("absolute inset-0 size-full", previewClassName)}
				/>
			) : (
				<>
					<UploadIcon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
					<span className="text-muted-foreground text-xs leading-relaxed">
						{hint}
					</span>
				</>
			)}
		</label>
	);
}
