import type { Metadata } from "next";

import { SITE_INFO } from "@/config/site";

import {
	type Clause,
	ClauseList,
	ContactBlock,
	DocumentMeta,
} from "../_components/legal-shell";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "Licensing";
const DESCRIPTION =
	"Understand what you can and cannot do with the digital items available from Tent UI.";
const UPDATED = "18 July 2026";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent(TITLE)}&description=${encodeURIComponent(DESCRIPTION)}`;

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/license" },
	openGraph: {
		title: `${TITLE} — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		url: "/license",
		type: "article",
		images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
	},
	twitter: {
		card: "summary_large_image",
		title: `${TITLE} — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		images: [OG_IMAGE],
	},
};

const CLAUSES: Clause[] = [
	{
		title: "Overview",
		body: (
			<p>
				This agreement outlines the permissions granted by the Tent UI License
				for each item available for purchase or download on tentui.com. If you
				are purchasing for multiple team members, please support the creators by
				selecting the appropriate team-size license during checkout.
			</p>
		),
	},
	{
		title: "License grant",
		body: (
			<p>
				The Tent UI License provides you with an ongoing, non-exclusive,
				worldwide license to use the digital work (&ldquo;Item&rdquo;).
			</p>
		),
	},
	{
		title: "Permitted uses",
		body: (
			<ul className="space-y-3">
				<li>
					<span className="font-medium text-foreground">
						Create end products:
					</span>{" "}
					You can create unlimited end products for yourself or your clients.
				</li>
				<li>
					<span className="font-medium text-foreground">Distribution:</span> End
					products may be sold, licensed, sub-licensed, or freely distributed.
				</li>
				<li>
					<span className="font-medium text-foreground">Modification:</span> You
					may modify, manipulate, and combine the Item with other works to
					create derivative works. These resulting works are subject to this
					license.
				</li>
				<li>
					<span className="font-medium text-foreground">Multi-use:</span> This
					license allows you to use an Item multiple times in various projects.
				</li>
			</ul>
		),
	},
	{
		title: "Prohibited uses",
		body: (
			<ul className="space-y-3">
				<li>
					<span className="font-medium text-foreground">Re-distribution:</span>{" "}
					You cannot re-distribute the Item as a stock image or its source
					files, regardless of modifications.
				</li>
				<li>
					<span className="font-medium text-foreground">
						Marketplace restrictions:
					</span>{" "}
					You cannot sell, resell, or distribute the Item or derivative works on
					any marketplace, including tentui.com and other platforms.
				</li>
				<li>
					<span className="font-medium text-foreground">
						Template creation:
					</span>{" "}
					You cannot create themes, templates, or derivative products to sell on
					any marketplace.
				</li>
			</ul>
		),
	},
	{
		title: "Enforcement",
		body: (
			<p>
				Violation of these terms will be pursued to the fullest extent of the
				law.
			</p>
		),
	},
	{
		title: "Sample end products",
		body: (
			<>
				<p>End products include, but are not limited to:</p>
				<ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
					<li>Commercial or personal websites</li>
					<li>Mobile apps</li>
					<li>Web apps</li>
					<li>Games</li>
					<li>Illustrations</li>
					<li>Wireframes</li>
					<li>Presentations</li>
					<li>Videos</li>
				</ul>
			</>
		),
	},
	{
		title: "Additional terms",
		body: (
			<>
				<p>
					<span className="font-medium text-foreground">
						Third-party components:
					</span>{" "}
					Some Items may contain components sourced from elsewhere with
					different license terms, such as open-source or Creative Commons
					licenses. These components will be identified in the Item&apos;s
					description or downloaded files and will be governed by their
					respective licenses.
				</p>
				<p>
					<span className="font-medium text-foreground">Ownership:</span> The
					author retains ownership of the Item but grants you a license under
					these terms. This agreement is between you and the Item&apos;s author.
					Tent UI is not a party to this agreement.
				</p>
			</>
		),
	},
];

export default function LicensePage() {
	return (
		<div className="max-w-2xl">
			<h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
				{TITLE}
			</h1>
			<DocumentMeta updated={UPDATED} />

			<p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
				Please go through the licensing agreement below to understand what you
				can and cannot do with Tent UI Items.
			</p>

			<ClauseList clauses={CLAUSES} />

			<p className="mt-10 text-[14px] text-muted-foreground leading-relaxed">
				Thank you for supporting the authors by adhering to these licensing
				terms.
			</p>

			<ContactBlock
				subject="Licensing — Tent UI"
				description="For questions about licensing, contact us at"
			/>
		</div>
	);
}
