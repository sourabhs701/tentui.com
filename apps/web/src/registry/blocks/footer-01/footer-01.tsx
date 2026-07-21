"use client";

import { ArrowRightIcon, MoonIcon, SunIcon } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { type FormEvent, type ReactNode, useId } from "react";
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
	copyright?: string;
	linkGroups?: Footer01LinkGroup[];
	legalLinks?: Footer01Link[];
	newsletterAction?: string;
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
			{ label: "Blog", href: "#" },
			{ label: "Changelog", href: "#" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Privacy", href: "#" },
			{ label: "Terms", href: "#" },
			{ label: "Fair use", href: "#" },
		],
	},
];

const DEFAULT_LEGAL_LINKS =
	DEFAULT_LINK_GROUPS.find((group) => group.title === "Legal")?.links ?? [];

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
	const external = link.href.startsWith("http");

	return (
		<Link
			className={className}
			href={link.href as Route}
			rel={external ? "noreferrer" : undefined}
			target={external ? "_blank" : undefined}
		>
			{link.label}
		</Link>
	);
}

function FooterLinkList({ links }: { links: Footer01Link[] }) {
	return (
		<ul className="flex flex-col gap-3.5">
			{links.map((link) => (
				<li key={`${link.label}-${link.href}`}>
					<FooterLink
						className="block py-0.5 font-medium text-muted-foreground text-sm transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-foreground"
						link={link}
					/>
				</li>
			))}
		</ul>
	);
}

function FooterLinkColumn({ group }: { group: Footer01LinkGroup }) {
	return (
		<nav aria-label={group.title} className="flex flex-col gap-4 pl-6">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{group.title}
			</p>
			<FooterLinkList links={group.links} />
		</nav>
	);
}

function NewsletterForm({
	placeholder,
	buttonText,
	action,
}: {
	placeholder: string;
	buttonText: string;
	action?: string;
}) {
	const inputId = useId();

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		if (!action) event.preventDefault();
	}

	return (
		<form
			action={action}
			className="w-full max-w-md"
			method={action ? "post" : undefined}
			onSubmit={handleSubmit}
		>
			<label className="sr-only" htmlFor={inputId}>
				Email address
			</label>
			<InputGroup className="h-12">
				<InputGroupInput
					autoComplete="email"
					className="h-full px-4"
					id={inputId}
					name="email"
					placeholder={placeholder}
					required
					spellCheck={false}
					type="email"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						className="min-w-28 touch-manipulation transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-0 active:scale-[0.98]"
						size="sm"
						type="submit"
						variant="default"
					>
						{buttonText}
						<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</form>
	);
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<Button
			aria-label="Toggle theme"
			className="relative touch-manipulation transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			size="icon-sm"
			type="button"
			variant="ghost"
		>
			<SunIcon
				aria-hidden="true"
				className="dark:hidden"
				data-icon="inline-start"
			/>
			<MoonIcon
				aria-hidden="true"
				className="hidden dark:block"
				data-icon="inline-start"
			/>
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
			className="inline-flex w-fit items-center"
			href={brandHref as Route}
		>
			{logo ?? (
				<Image
					alt=""
					aria-hidden="true"
					className="h-9 w-auto"
					height={166}
					src="/tkit-logo.svg"
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
	inputPlaceholder = "Enter your email…",
	buttonText = "Subscribe",
	copyright = `© ${new Date().getUTCFullYear()} All rights reserved.`,
	linkGroups = DEFAULT_LINK_GROUPS,
	legalLinks = DEFAULT_LEGAL_LINKS,
	newsletterAction,
}: Footer01Props) {
	const [primaryGroup, ...secondaryGroups] = linkGroups;

	return (
		<footer className="relative w-full overflow-hidden p-2 font-sans">
			<div className="relative mx-auto w-full max-w-6xl border bg-background text-foreground">
				<GridTick className="-top-2 -left-2" />
				<GridTick className="-top-2 -right-2" />
				<GridTick className="-bottom-2 -left-2" />
				<GridTick className="-right-2 -bottom-2" />

				<div className="grid grid-cols-1 overflow-hidden lg:grid-cols-14">
					<div className="relative border-b lg:col-span-8 lg:border-r lg:border-b-0">
						<div className="grid h-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_12rem]">
							<div className="flex min-h-[300px] min-w-0 flex-col justify-center gap-7 p-5 sm:min-h-[340px] sm:p-8 lg:p-12">
								<div className="flex flex-col gap-4">
									<h2 className="max-w-lg text-balance font-light text-2xl leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
										{headline}
									</h2>
									<p className="max-w-md text-muted-foreground text-sm leading-relaxed">
										{description}
									</p>
								</div>

								<NewsletterForm
									action={newsletterAction}
									buttonText={buttonText}
									placeholder={inputPlaceholder}
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

					<div className="relative px-5 py-8 sm:px-8 sm:py-12 lg:col-span-6">
						<div className="grid h-full grid-cols-2 gap-7 sm:gap-4">
							{secondaryGroups.map((group) => (
								<FooterLinkColumn group={group} key={group.title} />
							))}
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-7 border-t px-5 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-12 lg:py-10">
					<Wordmark brandHref={brandHref} brandName={brandName} logo={logo} />

					<div className="flex flex-1 flex-col gap-5 md:flex-row md:items-center md:gap-8 lg:justify-end">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
							<p className="max-w-[220px] shrink-0 text-muted-foreground text-xs">
								{copyright}
							</p>

							{legalLinks.length > 0 ? (
								<>
									<Separator
										className="hidden h-4 sm:block"
										orientation="vertical"
									/>
									<nav aria-label="Legal">
										<ul className="flex flex-wrap items-center gap-4">
											{legalLinks.map((link) => (
												<li key={`${link.label}-${link.href}`}>
													<FooterLink
														className="font-medium text-muted-foreground text-xs transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-foreground"
														link={link}
													/>
												</li>
											))}
										</ul>
									</nav>
								</>
							) : null}
						</div>

						<ThemeToggle />
					</div>
				</div>
			</div>
		</footer>
	);
}
