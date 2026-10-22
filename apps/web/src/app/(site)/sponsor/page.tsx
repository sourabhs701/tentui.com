import { MailIcon } from "lucide-react";
import type { Metadata } from "next";

import { SITE_INFO } from "@/config/site";
import { SPONSOR_EMAIL, sponsorMailto } from "@/config/sponsor";
import { breadcrumbJsonLd, JsonLdScript } from "@/lib/json-ld";

import { SoftButton } from "../_components/soft-button";

import { CopyAddressButton } from "./_components/copy-address-button";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "Sponsor";
const DESCRIPTION =
	"Put your logo in the bar at the top of every TentUI page. It links to your site.";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent("Sponsor TentUI")}&description=${encodeURIComponent(DESCRIPTION)}`;

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/sponsor" },
	openGraph: {
		title: `Sponsor — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		url: "/sponsor",
		type: "website",
		images: [
			{ url: OG_IMAGE, width: 1200, height: 630, alt: "Sponsor TentUI" },
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `Sponsor — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		images: [OG_IMAGE],
	},
};

const mailto = sponsorMailto();

export default function SponsorPage() {
	return (
		<div className="relative isolate overflow-hidden bg-background text-foreground">
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: "Sponsor", href: "/sponsor" },
				])}
			/>
			<section className="w-full px-4 pt-12 pb-24 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-6xl">
					<h1 className="max-w-4xl font-medium text-5xl text-foreground leading-[1.05] tracking-tight sm:text-7xl">
						Sponsor TentUI
					</h1>
					<p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
						TentUI is a library of production-ready React components and blocks
						for shadcn/ui. Designers and developers come here when they are
						choosing what to build next. A sponsorship puts your product in
						front of them, in the bar at the top of every page.
					</p>

					<div className="mt-12 max-w-2xl rounded-[21px] border bg-muted p-0.5">
						<div className="rounded-[19px] border bg-background p-4 sm:p-6">
							<h2 className="font-bold text-xl tracking-tight sm:text-2xl">
								Where your brand shows
							</h2>
							<div className="mt-5 flex gap-4 rounded-2xl border bg-muted/40 p-3 sm:p-4">
								<TopBarDiagram />
								<div className="min-w-0">
									<h3 className="font-semibold tracking-tight">Top bar</h3>
									<p className="mt-1 text-muted-foreground text-sm leading-relaxed sm:text-base">
										Your logo in the bar at the top of every page. It links to
										your site.
									</p>
								</div>
							</div>
							<p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
								Every link carries{" "}
								<span className="font-semibold text-foreground">
									ref=tentui.com
								</span>
								, so you see the visits we send in your own analytics.
							</p>
						</div>
					</div>

					<div className="mt-6 max-w-2xl rounded-[21px] border bg-muted p-0.5">
						<div className="rounded-[19px] border bg-background px-4 py-5 sm:px-6 sm:py-6">
							<h2 className="font-bold text-xl tracking-tight sm:text-2xl">
								Get in touch
							</h2>
							<p className="mt-2 max-w-lg font-medium text-muted-foreground text-sm sm:text-base">
								Want to sponsor? Write to us and we will send dates and pricing.
							</p>
						</div>
						<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
							<div className="min-w-0">
								<p className="font-semibold tracking-tight">Email us</p>
								<a
									href={mailto}
									className="mt-1 inline-block font-medium text-foreground tracking-tight hover:underline"
								>
									{SPONSOR_EMAIL}
								</a>
								<p className="mt-1 text-muted-foreground text-sm">
									Tell us about your product and when you want to start.
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-3">
								<CopyAddressButton email={SPONSOR_EMAIL} />
								<SoftButton href={mailto} size="sm">
									<MailIcon className="size-3.5" />
									Send an email
								</SoftButton>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

function TopBarDiagram() {
	return (
		<div
			aria-hidden
			className="w-[108px] shrink-0 rounded-2xl border bg-background p-1.5"
		>
			<div className="flex items-center gap-1 rounded-lg bg-muted px-1 py-1">
				<span className="size-2 rounded-[2px] bg-foreground/80" />
				<span className="h-1 flex-1 rounded-full bg-background" />
				<span className="size-3.5 rounded-[4px] bg-foreground ring-2 ring-foreground/15" />
			</div>
			<div className="mt-1.5 grid grid-cols-3 gap-1 px-0.5">
				{["a", "b", "c", "d", "e", "f"].map((id) => (
					<span key={id} className="h-3.5 rounded-[4px] bg-muted" />
				))}
			</div>
		</div>
	);
}
