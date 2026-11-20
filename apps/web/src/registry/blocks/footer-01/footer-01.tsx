"use client";

import { ArrowRightIcon, CheckIcon, MoonIcon, SunIcon } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface Footer01Link {
	label: string;
	href: string;
}

export interface Footer01LinkGroup {
	title: string;
	links: Footer01Link[];
}

export interface Footer01Props {
	logo?: ReactNode;
	brandName?: string;
	brandHref?: string;
	headline?: string;
	description?: string;
	inputPlaceholder?: string;
	buttonText?: string;
	successMessage?: string;
	copyright?: string;
	linkGroups?: Footer01LinkGroup[];
	legalLinks?: Footer01Link[];
	newsletterAction?: string;
	className?: string;
}

const DEFAULT_LINK_GROUPS: Footer01LinkGroup[] = [
	{
		title: "Product",
		links: [
			{ label: "Overview", href: "#" },
			{ label: "Pricing", href: "#" },
			{ label: "Dashboard", href: "#" },
		],
	},
	{
		title: "Resources",
		links: [
			{ label: "Docs", href: "#" },
			{ label: "Blog", href: "#" },
			{ label: "Changelog", href: "#" },
		],
	},
	{
		title: "Company",
		links: [
			{ label: "About", href: "#" },
			{ label: "Careers", href: "#" },
			{ label: "Contact", href: "#" },
		],
	},
];

const DEFAULT_LEGAL_LINKS: Footer01Link[] = [
	{ label: "Privacy", href: "#" },
	{ label: "Terms", href: "#" },
	{ label: "Fair use", href: "#" },
];

const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

const focusRing =
	"rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const pressable = cn(
	"touch-manipulation transition-[transform,background-color,color,box-shadow] duration-150 active:scale-[0.97]",
	EASE_OUT,
	"motion-reduce:transition-none motion-reduce:active:scale-100",
);

function GridTick({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-10 size-4 text-border",
				"before:absolute before:top-1/2 before:left-0 before:h-px before:w-full before:-translate-y-1/2 before:bg-current",
				"after:absolute after:top-0 after:left-1/2 after:h-full after:w-px after:-translate-x-1/2 after:bg-current",
				className,
			)}
		/>
	);
}

function FooterLink({
	link,
	className,
}: {
	link: Footer01Link;
	className?: string;
}) {
	const external = /^https?:\/\//.test(link.href);

	return (
		<Link
			className={cn(
				"font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground motion-reduce:transition-none",
				EASE_OUT,
				focusRing,
				className,
			)}
			href={link.href as Route}
			rel={external ? "noopener noreferrer" : undefined}
			target={external ? "_blank" : undefined}
		>
			{link.label}
		</Link>
	);
}

function FooterLinkColumn({ group }: { group: Footer01LinkGroup }) {
	const headingId = useId();

	return (
		<nav aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
			<h3
				className="font-medium text-muted-foreground text-xs uppercase tracking-wider"
				id={headingId}
			>
				{group.title}
			</h3>
			<ul className="flex flex-col gap-3">
				{group.links.map((link) => (
					<li key={`${link.label}-${link.href}`}>
						<FooterLink className="inline-block py-0.5 text-sm" link={link} />
					</li>
				))}
			</ul>
		</nav>
	);
}

type NewsletterStatus = "idle" | "invalid" | "success";

function NewsletterForm({
	placeholder,
	buttonText,
	successMessage,
	action,
}: {
	placeholder: string;
	buttonText: string;
	successMessage: string;
	action?: string;
}) {
	const inputId = useId();
	const messageId = useId();
	const [status, setStatus] = useState<NewsletterStatus>("idle");

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		const form = event.currentTarget;
		const input = form.elements.namedItem("email") as HTMLInputElement | null;

		if (!input?.checkValidity()) {
			event.preventDefault();
			setStatus("invalid");
			input?.focus();
			return;
		}

		// With an action, let the browser post the form natively.
		if (action) return;

		event.preventDefault();
		form.reset();
		setStatus("success");
	}

	const invalid = status === "invalid";

	return (
		<form
			action={action}
			className="flex w-full max-w-md flex-col gap-2"
			method={action ? "post" : undefined}
			noValidate
			onSubmit={handleSubmit}
		>
			<label className="sr-only" htmlFor={inputId}>
				Email address
			</label>
			<InputGroup className="h-11 bg-background">
				<InputGroupInput
					aria-describedby={messageId}
					aria-invalid={invalid || undefined}
					autoComplete="email"
					className="h-full pl-3.5"
					id={inputId}
					inputMode="email"
					name="email"
					onChange={() => {
						if (status !== "idle") setStatus("idle");
					}}
					placeholder={placeholder}
					required
					spellCheck={false}
					type="email"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						className={cn("h-8 px-3", pressable)}
						type="submit"
						variant="default"
					>
						{buttonText}
						<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
			<p
				aria-live="polite"
				className={cn(
					"flex min-h-5 items-center gap-1.5 text-xs",
					invalid ? "text-destructive" : "text-muted-foreground",
				)}
				id={messageId}
			>
				{status === "success" ? (
					<>
						<CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
						{successMessage}
					</>
				) : invalid ? (
					"Please enter a valid email address."
				) : (
					"No spam. Unsubscribe anytime."
				)}
			</p>
		</form>
	);
}

function ThemeToggle({ className }: { className?: string }) {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<Button
			aria-label="Toggle theme"
			className={cn(
				"text-muted-foreground hover:text-foreground",
				pressable,
				className,
			)}
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			size="icon-sm"
			type="button"
			variant="ghost"
		>
			<SunIcon aria-hidden="true" className="dark:hidden" />
			<MoonIcon aria-hidden="true" className="hidden dark:block" />
		</Button>
	);
}

function Wordmark({
	logo,
	brandName,
	brandHref,
}: {
	logo?: ReactNode;
	brandName: string;
	brandHref: string;
}) {
	return (
		<Link
			aria-label={`${brandName} home`}
			className={cn("inline-flex w-fit items-center", focusRing)}
			href={brandHref as Route}
		>
			{logo ?? (
				<Image
					alt=""
					aria-hidden="true"
					className="h-8 w-auto"
					height={166}
					src="https://cdn.tentui.com/tkit-logo.svg"
					unoptimized
					width={455}
				/>
			)}
		</Link>
	);
}

export default function Footer01({
	logo,
	brandName = "Tkit.ai",
	brandHref = "#",
	headline = "The toolkit for turning your website visitors into clients.",
	description = "Support tickets, infrastructure, and workflows to ship features fast.",
	inputPlaceholder = "you@company.com",
	buttonText = "Subscribe",
	successMessage = "Thanks! Check your inbox to confirm.",
	copyright = `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`,
	linkGroups = DEFAULT_LINK_GROUPS,
	legalLinks = DEFAULT_LEGAL_LINKS,
	newsletterAction,
	className,
}: Footer01Props) {
	const [primaryGroup, ...secondaryGroups] = linkGroups;

	return (
		<footer
			className={cn(
				"relative w-full overflow-hidden bg-background p-2 font-sans text-foreground",
				className,
			)}
		>
			<div className="relative mx-auto w-full max-w-6xl border bg-background">
				<GridTick className="-top-2 -left-2" />
				<GridTick className="-top-2 -right-2" />
				<GridTick className="-bottom-2 -left-2" />
				<GridTick className="-right-2 -bottom-2" />

				<div className="grid grid-cols-1 lg:grid-cols-14">
					<div className="relative min-w-0 border-b lg:col-span-8 lg:border-r lg:border-b-0">
						<div className="grid h-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_11rem]">
							<div className="flex min-w-0 flex-col justify-center gap-7 px-5 py-10 sm:px-8 sm:py-12 lg:p-12">
								<div className="flex flex-col gap-3">
									<h2 className="max-w-lg text-balance font-light text-2xl leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
										{headline}
									</h2>
									<p className="max-w-md text-pretty text-muted-foreground text-sm leading-relaxed">
										{description}
									</p>
								</div>

								<NewsletterForm
									action={newsletterAction}
									buttonText={buttonText}
									placeholder={inputPlaceholder}
									successMessage={successMessage}
								/>
							</div>

							{primaryGroup ? (
								<div className="border-t px-5 py-8 sm:px-8 md:border-t-0 md:border-l md:px-6 md:py-12">
									<FooterLinkColumn group={primaryGroup} />
								</div>
							) : null}
						</div>

						<GridTick className="-top-2 -right-2 hidden lg:block" />
						<GridTick className="-right-2 -bottom-2 hidden lg:block" />
					</div>

					{secondaryGroups.length > 0 ? (
						<div className="min-w-0 px-5 py-8 sm:px-8 sm:py-12 lg:col-span-6">
							<div className="grid grid-cols-2 gap-x-6 gap-y-8">
								{secondaryGroups.map((group) => (
									<FooterLinkColumn group={group} key={group.title} />
								))}
							</div>
						</div>
					) : null}
				</div>

				<div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-t px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
					<Wordmark brandHref={brandHref} brandName={brandName} logo={logo} />

					<div className="order-last flex basis-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:order-none md:ml-auto md:basis-auto">
						<p className="text-muted-foreground text-xs">{copyright}</p>

						{legalLinks.length > 0 ? (
							<>
								<Separator
									className="hidden data-vertical:h-4 data-vertical:self-center sm:block"
									orientation="vertical"
								/>
								<nav aria-label="Legal">
									<ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
										{legalLinks.map((link) => (
											<li key={`${link.label}-${link.href}`}>
												<FooterLink className="block text-xs" link={link} />
											</li>
										))}
									</ul>
								</nav>
							</>
						) : null}
					</div>

					<ThemeToggle className="-mr-1.5" />
				</div>
			</div>
		</footer>
	);
}
