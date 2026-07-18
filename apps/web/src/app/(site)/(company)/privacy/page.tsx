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

const TITLE = "Privacy";
const DESCRIPTION =
	"How Tent UI handles analytics and basic usage data on the site.";
const UPDATED = "22 May 2026";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent(TITLE)}&description=${encodeURIComponent(DESCRIPTION)}`;

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/privacy" },
	openGraph: {
		title: `${TITLE} — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		url: "/privacy",
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
		title: "Information we collect",
		body: (
			<p>
				We collect limited technical and usage information such as page views,
				interaction events, browser and device metadata, and referral
				information. This data helps us understand how the site is used and
				where it can be improved.
			</p>
		),
	},
	{
		title: "Analytics tools",
		body: (
			<p>
				We use umami to understand traffic and product usage patterns. If your
				browser blocks analytics scripts, the corresponding data is not
				collected.
			</p>
		),
	},
	{
		title: "How we use data",
		body: (
			<p>
				Collected data is used for product improvements, troubleshooting,
				feature planning, and performance monitoring. We do not sell data, and
				we do not collect sensitive personal information through normal site
				usage.
			</p>
		),
	},
	{
		title: "Cookies and local storage",
		body: (
			<p>
				We use local storage to remember preferences such as your theme, sidebar
				state, and preferred package manager. Analytics providers may set their
				own cookies, which you can clear through your browser settings.
			</p>
		),
	},
	{
		title: "Your choices",
		body: (
			<p>
				You can opt out by blocking analytics in your browser or by using a
				browser with privacy protections enabled. For data exports or deletion
				requests related to records you have submitted (for example, the
				waitlist), please contact us.
			</p>
		),
	},
	{
		title: "Changes",
		body: (
			<p>
				We may update this policy as the stack changes. The &ldquo;last
				updated&rdquo; date above reflects the most recent change.
			</p>
		),
	},
];

export default function PrivacyPage() {
	return (
		<div className="max-w-2xl">
			<h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
				Privacy Policy
			</h1>
			<DocumentMeta updated={UPDATED} />

			<p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
				{DESCRIPTION}
			</p>

			<ClauseList clauses={CLAUSES} />

			<ContactBlock
				subject="Privacy — Tent UI"
				description="For privacy-related questions, exports, or deletion requests, contact us at"
			/>
		</div>
	);
}
