import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

export interface LegalClause {
	id: string;
	title: string;
	body: ReactNode;
}

export const PRIVACY_CLAUSES = [
	{
		id: "information-we-collect",
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
		id: "analytics-tools",
		title: "Analytics tools",
		body: (
			<p>
				We use privacy-conscious analytics to understand traffic and product
				usage patterns. If your browser blocks analytics scripts, the
				corresponding data is not collected.
			</p>
		),
	},
	{
		id: "how-we-use-data",
		title: "How we use data",
		body: (
			<ul>
				<li>Operate, secure, and improve the product.</li>
				<li>Understand which features are useful to visitors.</li>
				<li>Diagnose errors and monitor performance.</li>
			</ul>
		),
	},
	{
		id: "cookies-and-local-storage",
		title: "Cookies and local storage",
		body: (
			<p>
				We use local storage to remember preferences such as your theme and
				interface settings. Analytics providers may set their own cookies, which
				you can clear through your browser settings.
			</p>
		),
	},
	{
		id: "your-choices",
		title: "Your choices",
		body: (
			<p>
				You can opt out by blocking analytics in your browser or by using a
				browser with privacy protections enabled. Contact us if you need help
				with information you have submitted.
			</p>
		),
	},
	{
		id: "changes",
		title: "Changes",
		body: (
			<p>
				We may update this policy as our services change. The last updated date
				above reflects the most recent revision.
			</p>
		),
	},
] satisfies readonly LegalClause[];

export default function PrivacyPolicyPage() {
	return (
		<article className="max-w-2xl">
			<h1 className="text-balance font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
				Privacy Policy
			</h1>
			<p className="mt-3 text-[12px] text-muted-foreground">
				Last updated July 21, 2026
			</p>
			<p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
				How we handle analytics and basic usage data on this website.
			</p>

			<ol className="mt-10 flex flex-col gap-10">
				{PRIVACY_CLAUSES.map((clause, index) => (
					<li className="scroll-mt-20" id={clause.id} key={clause.id}>
						<h2 className="font-semibold text-[15px] text-foreground tracking-tight">
							<span className="mr-3 text-muted-foreground tabular-nums">
								{String(index + 1).padStart(2, "0")}
							</span>
							{clause.title}
						</h2>
						<div className="mt-3 ml-9 flex flex-col gap-3 text-[14px] text-muted-foreground leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
							{clause.body}
						</div>
					</li>
				))}
			</ol>

			<Separator className="mt-16" />
			<section className="pt-8">
				<h2 className="font-semibold text-[15px] text-foreground tracking-tight">
					Contact
				</h2>
				<p className="mt-3 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
					For privacy-related questions, exports, or deletion requests, contact
					us at{" "}
					<a
						className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
						href="mailto:privacy@example.com"
					>
						privacy@example.com
					</a>
					.
				</p>
			</section>
		</article>
	);
}
