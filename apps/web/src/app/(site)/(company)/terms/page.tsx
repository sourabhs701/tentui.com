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

const TITLE = "Terms of Use";
const DESCRIPTION =
	"The terms that apply when you use Tent UI or copy components from the registry.";
const UPDATED = "22 May 2026";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent(TITLE)}&description=${encodeURIComponent(DESCRIPTION)}`;

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/terms" },
	openGraph: {
		title: `${TITLE} — ${SITE_INFO.name}`,
		description: DESCRIPTION,
		url: "/terms",
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
		title: "Acceptance",
		body: (
			<p>
				By accessing tentui.com or copying components from the registry, you
				agree to these terms. If you do not agree, please do not use the site or
				its materials.
			</p>
		),
	},
	{
		title: "Use of content",
		body: (
			<>
				<p>
					Components in the registry are provided for you to copy, fork, edit,
					and ship in your own projects. They are not gated by a runtime,
					license key, or theme provider.
				</p>
				<p>
					You are responsible for ensuring your use complies with the licenses
					of the third-party libraries we build on (shadcn/ui, Radix, Tailwind,
					Motion) and with any legal or regulatory requirements that apply to
					your project.
				</p>
			</>
		),
	},
	{
		title: "Inspiration and originality",
		body: (
			<p>
				We do not intentionally copy proprietary source code from other
				creators. Where a public design influenced an implementation, we provide
				credit on the component page under{" "}
				<span className="text-foreground">&ldquo;Inspired By&rdquo;</span>. See
				the{" "}
				<Link
					href={"/copyright" as Route}
					className="text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
				>
					copyright policy
				</Link>{" "}
				for full details.
			</p>
		),
	},
	{
		title: "Claims and disputes",
		body: (
			<p>
				If you believe a design or implementation on this site is yours and is
				being used improperly, contact us with proof — original source links,
				timestamps, repository history, or equivalent evidence. We review valid
				claims within 7&ndash;15 days. Resolution may include attribution
				updates, modification, or removal.
			</p>
		),
	},
	{
		title: "Disclaimer",
		body: (
			<p>
				The site and its materials are provided &ldquo;as is&rdquo; without
				warranties of any kind, express or implied. We are not liable for any
				losses or damages resulting from your use of the site or the code it
				distributes.
			</p>
		),
	},
	{
		title: "Changes",
		body: (
			<p>
				We may update these terms from time to time. The &ldquo;last
				updated&rdquo; date above reflects the most recent change. Continued use
				of the site after a change constitutes acceptance of the revised terms.
			</p>
		),
	},
];

export default function TermsPage() {
	return (
		<div className="max-w-2xl">
			<h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
				{TITLE}
			</h1>
			<DocumentMeta updated={UPDATED} />

			<p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
				{DESCRIPTION}
			</p>

			<ClauseList clauses={CLAUSES} />

			<ContactBlock
				subject="Terms — Tent UI"
				description="For questions about these terms, contact us at"
			/>
		</div>
	);
}
