import { Badge } from "@tentui.com/ui/components/badge";
import {
	ArrowUpRightIcon,
	BlocksIcon,
	BoxIcon,
	GitCommitHorizontalIcon,
	WrenchIcon,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import {
	ARCHIVE_SIDEBAR_ROW,
	ArchiveSidebar,
	ArchiveSidebarActiveRail,
} from "@/components/archive-sidebar";
import Section from "@/components/section";
import { SOURCE_CODE_GITHUB_URL } from "@/config/site";
import { cn } from "@/lib/utils";

const DESCRIPTION =
	"New components, thoughtful improvements, and fixes from the TentUI workshop.";

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

type Change = {
	type: "component" | "block" | "improvement" | "fix";
	title: string;
	description: string;
	href?: string;
};

type Release = {
	id: string;
	date: string;
	displayDate: string;
	title: string;
	summary: string;
	commit: string;
	changes: Change[];
};

const releases: Release[] = [
	{
		id: "2026.07.26",
		date: "2026-07-26",
		displayDate: "Jul 26, 2026",
		title: "A clearer way through the library",
		summary:
			"This release makes large component collections easier to explore and gives product footers a more complete starting point.",
		commit: "721c6d1",
		changes: [
			{
				type: "component",
				title: "Component Sidebar",
				description:
					"A proximity-reactive navigation rail for dense documentation and component libraries.",
				href: "/components/component-sidebar",
			},
			{
				type: "block",
				title: "Footer 03",
				description:
					"A polished, responsive footer with structured navigation and a stronger brand moment.",
			},
			{
				type: "improvement",
				title: "A simpler block catalog",
				description:
					"Reworked block organization so categories and previews are easier to scan.",
				href: "/blocks",
			},
		],
	},
	{
		id: "2026.07.24",
		date: "2026-07-24",
		displayDate: "Jul 24, 2026",
		title: "More complete landing pages",
		summary:
			"Three new sections cover the moments where a landing page has to explain, reassure, and convert.",
		commit: "4bd2b78",
		changes: [
			{
				type: "block",
				title: "Agency Pricing",
				description:
					"A confident pricing section for service businesses with clear package comparison.",
			},
			{
				type: "block",
				title: "Conversational FAQ",
				description:
					"An approachable FAQ treatment designed to make dense answers feel lighter.",
			},
			{
				type: "block",
				title: "SaaS Hero",
				description:
					"A product-led opening section with a clear hierarchy and focused call to action.",
				href: "/blocks",
			},
		],
	},
	{
		id: "2026.07.21",
		date: "2026-07-21",
		displayDate: "Jul 21, 2026",
		title: "Interaction essentials",
		summary:
			"A set of expressive components for navigation, brand sharing, social proof, and polished interaction.",
		commit: "49654ee",
		changes: [
			{
				type: "component",
				title: "Animated Tabs",
				description:
					"Segmented navigation with a fluid shared-layout indicator and considered defaults.",
				href: "/components/animated-tabs",
			},
			{
				type: "component",
				title: "Brand Context Menu",
				description:
					"A copy-ready menu for sharing logos, colors, and downloadable brand assets.",
				href: "/components/brand-context-menu",
			},
			{
				type: "fix",
				title: "FAQ accordion icon visibility",
				description:
					"Improved icon contrast so expanded and collapsed states remain legible in every theme.",
			},
		],
	},
	{
		id: "2026.07.20",
		date: "2026-07-20",
		displayDate: "Jul 20, 2026",
		title: "Buttons with something to say",
		summary:
			"The first collection focused on physical feedback, clear state changes, and personality in small interactions.",
		commit: "a3b3fe7",
		changes: [
			{
				type: "component",
				title: "3D Buttons",
				description:
					"A tactile action with real depth and immediate press feedback.",
				href: "/components/tailwindcss-buttons",
			},
			{
				type: "component",
				title: "Stateful Button",
				description:
					"Loading, success, and error feedback contained within a single stable action.",
				href: "/components/stateful-button",
			},
			{
				type: "component",
				title: "Scribbled Text",
				description:
					"Colorful, hand-drawn annotations for adding emphasis without losing warmth.",
				href: "/components/scribbled-text",
			},
			{
				type: "component",
				title: "Copy Button",
				description:
					"Clipboard actions with a compact, visible confirmation state.",
				href: "/components/copy-button",
			},
		],
	},
	{
		id: "2026.07.19",
		date: "2026-07-19",
		displayDate: "Jul 19, 2026",
		title: "The collection begins",
		summary:
			"TentUI opened with components that set the standard: useful first, expressive where it earns its place.",
		commit: "787fc97",
		changes: [
			{
				type: "component",
				title: "Animated Arrow",
				description:
					"A small directional cue that moves when its parent interaction becomes active.",
				href: "/components/animated-arrow",
			},
			{
				type: "improvement",
				title: "Registry previews",
				description:
					"Faster, clearer previews for evaluating a component before bringing it into a project.",
				href: "/components",
			},
		],
	},
];

const changeLabels: Record<Change["type"], string> = {
	component: "Component",
	block: "Block",
	improvement: "Improved",
	fix: "Fixed",
};

const changeIcons = {
	component: BoxIcon,
	block: BlocksIcon,
	improvement: WrenchIcon,
	fix: WrenchIcon,
};

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
	title: "Changelog",
	description: DESCRIPTION,
	alternates: { canonical: "/changelog" },
	openGraph: {
		title: "TentUI Changelog",
		description: DESCRIPTION,
		url: "/changelog",
		type: "website",
	},
};

export default function ChangelogPage() {
	return (
		<div className="overflow-x-clip bg-background text-foreground">
			<Section>
				<header className="px-4 py-16 md:py-20">
					<div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
						<div>
							<h1
								className="max-w-2xl font-normal text-4xl leading-[1.08] tracking-[-0.02em] md:text-5xl"
								style={{ fontFamily: SERIF }}
							>
								Changelog
							</h1>
							<p className="mt-5 max-w-xl text-[15px] text-muted-foreground leading-relaxed">
								{DESCRIPTION}
							</p>
						</div>

						<Link
							href={`${SOURCE_CODE_GITHUB_URL}/commits/main`}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 font-medium text-sm shadow-xs transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted active:scale-[0.97]"
						>
							<GitCommitHorizontalIcon aria-hidden="true" className="size-4" />
							All commits
							<ArrowUpRightIcon aria-hidden="true" className="size-4" />
						</Link>
					</div>
				</header>

				<div className="screen-line-top grid grid-cols-1 md:grid-cols-[232px_minmax(0,1fr)]">
					<ArchiveSidebar title="Releases" aria-label="Changelog releases">
						{releases.map((release, index) => (
							<li key={release.id}>
								<a
									href={`#release-${release.id}`}
									className={cn(
										ARCHIVE_SIDEBAR_ROW,
										index === 0
											? "bg-primary/10 text-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									{index === 0 ? <ArchiveSidebarActiveRail /> : null}
									<span className="tabular-nums">{release.id}</span>
									{index === 0 ? (
										<span className="ml-auto text-[10px] text-primary uppercase tracking-wide">
											Latest
										</span>
									) : null}
								</a>
							</li>
						))}
					</ArchiveSidebar>

					<section aria-label="Release notes" className="min-w-0">
						{releases.map((release, index) => (
							<ReleaseEntry
								key={release.id}
								release={release}
								latest={index === 0}
							/>
						))}
					</section>
				</div>
			</Section>
		</div>
	);
}

function ReleaseEntry({
	release,
	latest,
}: {
	release: Release;
	latest: boolean;
}) {
	return (
		<article
			id={`release-${release.id}`}
			className="scroll-mt-20 border-border border-b border-dashed px-5 py-12 sm:px-8 md:px-12 md:py-16"
		>
			<div className="flex flex-wrap items-center gap-3">
				<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
					{release.id}
				</span>
				{latest ? <Badge variant="default">Latest</Badge> : null}
			</div>

			<h2
				className="mt-5 max-w-2xl font-normal text-2xl leading-tight tracking-[-0.015em] sm:text-3xl"
				style={{ fontFamily: SERIF }}
			>
				{release.title}
			</h2>
			<p className="mt-4 max-w-2xl text-[15px] text-muted-foreground leading-relaxed">
				{release.summary}
			</p>

			<ul className="mt-9 flex flex-col border-border border-t">
				{release.changes.map((change) => (
					<li
						key={change.title}
						className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-border border-b py-5 sm:grid-cols-[108px_minmax(0,1fr)_auto] sm:items-start"
					>
						<ChangeType type={change.type} />
						<div className="min-w-0">
							<h3 className="font-medium text-[14px] leading-5">
								{change.href ? (
									<Link
										href={change.href as Route}
										className="underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
									>
										{change.title}
									</Link>
								) : (
									change.title
								)}
							</h3>
							<p className="mt-1 max-w-xl text-[13px] text-muted-foreground leading-relaxed">
								{change.description}
							</p>
						</div>
						{change.href ? (
							<ArrowUpRightIcon
								aria-hidden="true"
								className="mt-0.5 hidden size-3.5 text-muted-foreground transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary sm:block"
							/>
						) : null}
					</li>
				))}
			</ul>

			<Link
				href={`${SOURCE_CODE_GITHUB_URL}/commit/${release.commit}`}
				target="_blank"
				rel="noreferrer"
				className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
			>
				<GitCommitHorizontalIcon aria-hidden="true" className="size-3.5" />
				View commit {release.commit}
				<ArrowUpRightIcon aria-hidden="true" className="size-3" />
			</Link>
		</article>
	);
}

function ChangeType({ type }: { type: Change["type"] }) {
	const Icon = changeIcons[type];

	return (
		<div className="flex h-5 items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
			<Icon aria-hidden="true" className="size-3" />
			<span className="max-sm:sr-only">{changeLabels[type]}</span>
		</div>
	);
}
