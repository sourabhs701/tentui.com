"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@tentui.com/ui/components/alert";
import { Button } from "@tentui.com/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@tentui.com/ui/components/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from "@tentui.com/ui/components/field";
import { Input } from "@tentui.com/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@tentui.com/ui/components/input-group";
import {
	RadioGroup,
	RadioGroupItem,
} from "@tentui.com/ui/components/radio-group";
import { Spinner } from "@tentui.com/ui/components/spinner";
import { Textarea } from "@tentui.com/ui/components/textarea";
import {
	ArrowRightIcon,
	CircleAlertIcon,
	LinkIcon,
	LockIcon,
	MegaphoneIcon,
	UploadIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

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
									<SlotStatus slot={slots?.[id]} total={info.slots} />
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

function SlotStatus({
	slot,
	total,
}: {
	slot: { remaining: number } | undefined;
	total: number;
}) {
	if (slot === undefined) {
		return <span className="h-4 w-14 animate-pulse rounded-full bg-muted" />;
	}
	const available = slot.remaining > 0;
	return (
		<span
			className={cn(
				"rounded-full border px-1.5 py-px font-medium text-[11px]",
				available
					? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					: "text-muted-foreground",
			)}
		>
			{available ? `${slot.remaining} of ${total} open` : "Booked"}
		</span>
	);
}

// ─── Booking Dialog ────────────────────────────────────────────────────────
// Fixed header and footer around a scrolling form, so the price and the
// checkout button stay in view on small screens.

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
		<DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
			<DialogHeader className="flex-row items-start gap-4 border-b px-6 pt-6 pr-14 pb-5">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
					<MegaphoneIcon className="size-4.5" />
				</span>
				<div className="flex flex-col gap-1.5">
					<DialogTitle className="font-semibold text-lg tracking-tight">
						Sponsor a slot
					</DialogTitle>
					<DialogDescription className="leading-relaxed">
						Your logo, your name and a link, styled like the rest of the site.
						No tracking pixels, no pop-ups.
					</DialogDescription>
				</div>
			</DialogHeader>

			<form
				noValidate
				onSubmit={onSubmit}
				className="flex min-h-0 flex-1 flex-col"
			>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
					<FieldGroup>
						<FieldSet>
							<FieldLegend variant="label">Placement</FieldLegend>
							<RadioGroup
								value={placement}
								onValueChange={(value) => {
									onPlacementChange(value as SponsorPlacement);
									setErrors({});
									setFormError(null);
								}}
								className="grid-cols-2"
							>
								{SPONSOR_PLACEMENT_IDS.map((id) => {
									const info = SPONSOR_PLACEMENTS[id];
									const booked = slots?.[id].available === false;
									return (
										<FieldLabel key={id} htmlFor={`placement-${id}`}>
											<Field
												orientation="horizontal"
												data-disabled={booked || undefined}
											>
												<FieldContent>
													<FieldTitle>
														{info.label}
														<SlotStatus slot={slots?.[id]} total={info.slots} />
													</FieldTitle>
													<FieldDescription className="tabular-nums">
														${info.price} / month
													</FieldDescription>
												</FieldContent>
												<RadioGroupItem
													id={`placement-${id}`}
													value={id}
													disabled={booked}
												/>
											</Field>
										</FieldLabel>
									);
								})}
							</RadioGroup>
							<FieldDescription>
								{SPONSOR_PLACEMENTS[placement].summary}
							</FieldDescription>
						</FieldSet>

						<FieldSeparator />

						<FieldSet>
							<FieldLegend>Your ad</FieldLegend>
							<FieldDescription>
								Goes live within 24 hours of payment, once we have checked it.
							</FieldDescription>
							<FieldGroup className="gap-5">
								<div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
									<div className="flex flex-col gap-5">
										<Field data-invalid={!!errors.name || undefined}>
											<FieldLabel htmlFor="name">
												Name under your logo
											</FieldLabel>
											<Input
												id="name"
												name="name"
												placeholder="Acme"
												maxLength={40}
												autoComplete="organization"
												aria-invalid={!!errors.name}
											/>
											<FieldError>{errors.name}</FieldError>
										</Field>
										<Field data-invalid={!!errors.href || undefined}>
											<FieldLabel htmlFor="href">Link</FieldLabel>
											<InputGroup>
												<InputGroupAddon>
													<LinkIcon />
												</InputGroupAddon>
												<InputGroupInput
													id="href"
													name="href"
													placeholder="acme.com"
													inputMode="url"
													autoComplete="url"
													aria-invalid={!!errors.href}
												/>
											</InputGroup>
											<FieldError>{errors.href}</FieldError>
										</Field>
									</div>
									<Field data-invalid={!!errors.logo || undefined}>
										<FieldLabel htmlFor="logo">Logo</FieldLabel>
										<MediaUpload
											id="logo"
											name="logo"
											hint="Square"
											invalid={!!errors.logo}
											className="aspect-square w-36 sm:w-full"
											previewClassName="object-contain p-4"
										/>
										<FieldError>{errors.logo}</FieldError>
									</Field>
								</div>
								<FieldDescription className="-mt-2">
									PNG, JPG, WebP or SVG, shown in its original colours.
								</FieldDescription>

								{isFeed ? (
									<>
										<Field data-invalid={!!errors.description || undefined}>
											<FieldLabel htmlFor="description">Tagline</FieldLabel>
											<Input
												id="description"
												name="description"
												placeholder="Analytics your team will actually open"
												maxLength={60}
												aria-invalid={!!errors.description}
											/>
											<FieldDescription>
												One line, shown when someone hovers the card.
											</FieldDescription>
											<FieldError>{errors.description}</FieldError>
										</Field>
										<Field data-invalid={!!errors.image || undefined}>
											<FieldLabel htmlFor="image">Card image</FieldLabel>
											<MediaUpload
												id="image"
												name="image"
												hint="1200 × 800 · up to 4 MB"
												invalid={!!errors.image}
												className="aspect-[3/2]"
												previewClassName="object-cover"
											/>
											<FieldError>{errors.image}</FieldError>
										</Field>
									</>
								) : null}
							</FieldGroup>
						</FieldSet>

						<FieldSeparator />

						<FieldSet>
							<FieldLegend>Contact</FieldLegend>
							<FieldDescription>
								Where we send the receipt and anything about your ad.
							</FieldDescription>
							<FieldGroup className="gap-5">
								<div className="grid gap-5 sm:grid-cols-2">
									<Field data-invalid={!!errors.contactName || undefined}>
										<FieldLabel htmlFor="contactName">Your name</FieldLabel>
										<Input
											id="contactName"
											name="contactName"
											placeholder="Alex Morgan"
											autoComplete="name"
											aria-invalid={!!errors.contactName}
										/>
										<FieldError>{errors.contactName}</FieldError>
									</Field>
									<Field data-invalid={!!errors.contactEmail || undefined}>
										<FieldLabel htmlFor="contactEmail">Email</FieldLabel>
										<Input
											id="contactEmail"
											name="contactEmail"
											type="email"
											placeholder="alex@acme.com"
											autoComplete="email"
											aria-invalid={!!errors.contactEmail}
										/>
										<FieldError>{errors.contactEmail}</FieldError>
									</Field>
								</div>
								<Field>
									<FieldLabel htmlFor="notes">
										Notes{" "}
										<span className="font-normal text-muted-foreground">
											(optional)
										</span>
									</FieldLabel>
									<Textarea
										id="notes"
										name="notes"
										placeholder="Questions, preferred start date"
										maxLength={1000}
										className="min-h-20"
									/>
								</Field>
							</FieldGroup>
						</FieldSet>

						{formError ? (
							<Alert variant="destructive">
								<CircleAlertIcon />
								<AlertTitle>Couldn't start checkout</AlertTitle>
								<AlertDescription>{formError}</AlertDescription>
							</Alert>
						) : null}

						<FieldDescription className="text-center text-xs">
							Questions? <a href={sponsorMailto()}>{SPONSOR_EMAIL}</a>
						</FieldDescription>
					</FieldGroup>
				</div>

				<DialogFooter className="flex-row items-center justify-between gap-4 border-t bg-muted/40 px-6 py-4 sm:justify-between">
					<div className="flex flex-col">
						<p className="font-semibold text-base tabular-nums tracking-tight">
							${price}
							<span className="font-normal text-muted-foreground text-sm">
								{" "}
								/ month
							</span>
						</p>
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							<LockIcon className="size-3" />
							<span className="max-sm:hidden">Secure checkout ·</span> Cancel
							any time
						</p>
					</div>
					<Button
						type="submit"
						size="lg"
						disabled={pending || !available}
						className="px-4"
					>
						{pending ? (
							<>
								<Spinner />
								Opening checkout…
							</>
						) : allBooked ? (
							"Both slots are booked"
						) : (
							<>
								Continue to payment
								<ArrowRightIcon data-icon="inline-end" />
							</>
						)}
					</Button>
				</DialogFooter>
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
				"group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-input border-dashed bg-muted/30 px-3 text-center transition-colors",
				"hover:border-foreground/30 hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
				invalid &&
					"border-destructive ring-3 ring-destructive/20 dark:ring-destructive/40",
				preview && "border-solid bg-background",
				className,
			)}
		>
			<input
				id={id}
				name={name}
				type="file"
				accept={MEDIA_ACCEPT}
				aria-invalid={invalid}
				className="sr-only"
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					setPreview(file ? URL.createObjectURL(file) : null);
				}}
			/>
			{preview ? (
				<>
					{/* biome-ignore lint/performance/noImgElement: local blob preview */}
					<img
						src={preview}
						alt=""
						className={cn("absolute inset-0 size-full", previewClassName)}
					/>
					<span className="absolute inset-x-0 bottom-0 bg-background/85 py-1.5 font-medium text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100">
						Replace
					</span>
				</>
			) : (
				<>
					<span className="flex size-8 items-center justify-center rounded-full border bg-background shadow-xs">
						<UploadIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
					</span>
					<span className="flex flex-col gap-0.5">
						<span className="font-medium text-xs">Upload</span>
						<span className="text-muted-foreground text-xs">{hint}</span>
					</span>
				</>
			)}
		</label>
	);
}
