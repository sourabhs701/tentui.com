import type { Metadata, Route } from "next";
import Link from "next/link";

import { SITE_INFO } from "@/config/site";

import {
	type Clause,
	ClauseList,
	ContactBlock,
	DocumentMeta,
} from "../_components/legal-shell";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "Copyright & Attribution";
const DESCRIPTION =
	"Our policy on inspiration, credit, and ownership claims for designs featured on Tent UI.";
const UPDATED = "22 May 2026";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent(TITLE)}&description=${encodeURIComponent(DESCRIPTION)}`;

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/copyright" },
	openGraph: {
		title: `${TITLE} — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		url: "/copyright",
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
		title: "Our policy",
		body: (
			<p>
				We do not intentionally take proprietary source code from other
				creators. We may reference visuals as inspiration and implement
				components from scratch. Where the source of an inspiration is known, we
				add explicit credit under{" "}
				<span className="text-foreground">&ldquo;Inspired By&rdquo;</span> on
				the relevant component page.
			</p>
		),
	},
	{
		title: "If you own a design featured here",
		body: (
			<p>
				If you believe a design shown on this site is yours and is used without
				proper permission or attribution, please contact us with proof. Include
				direct source links, publication dates, repository or file history, and
				any other evidence that helps verify ownership.
			</p>
		),
	},
	{
		title: "Review timeline",
		body: (
			<p>
				We aim to resolve valid reports within 7&ndash;15 days. Actions may
				include adding credit, modifying the implementation, or removing the
				content entirely.
			</p>
		),
	},
	{
		title: "When you reuse our components",
		body: (
			<p>
				If you fork a component from the registry and the design carries an
				&ldquo;Inspired By&rdquo; credit, please preserve that credit in your
				downstream use. Full usage terms are described on the{" "}
				<Link
					href={"/terms" as Route}
					className="text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
				>
					terms page
				</Link>
				.
			</p>
		),
	},
];

export default function CopyrightPage() {
	return (
		<div className="max-w-2xl">
			<h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
				Copyright &amp; Attribution
			</h1>
			<DocumentMeta updated={UPDATED} />

			<p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
				{DESCRIPTION}
			</p>

			<ClauseList clauses={CLAUSES} />

			<ContactBlock
				subject="Attribution — Tent UI"
				description="For attribution or ownership claims, contact us at"
			/>
		</div>
	);
}
