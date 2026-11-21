"use client";

import { type ReactNode, useState } from "react";

import { PaginationRail } from "@/registry/components/pagination-rail/pagination-rail";

interface ReleaseEntry {
	version: string;
	title: string;
	date: string;
	tag: string;
}

const RELEASES: ReleaseEntry[] = [
	{
		version: "v2.12",
		title: "Edge middleware streaming",
		date: "Nov 18",
		tag: "Runtime",
	},
	{
		version: "v2.11",
		title: "Incremental static revalidation",
		date: "Nov 14",
		tag: "Cache",
	},
	{
		version: "v2.10",
		title: "Zero-config image pipelines",
		date: "Nov 09",
		tag: "Media",
	},
	{
		version: "v2.9",
		title: "Scoped API tokens & audit trail",
		date: "Nov 04",
		tag: "Security",
	},
	{
		version: "v2.8",
		title: "Composable form primitives",
		date: "Oct 29",
		tag: "UI",
	},
	{
		version: "v2.7",
		title: "Sub-millisecond route matcher",
		date: "Oct 23",
		tag: "Router",
	},
	{
		version: "v2.6",
		title: "Dark surface contrast tokens",
		date: "Oct 18",
		tag: "Design",
	},
	{
		version: "v2.5",
		title: "Regional read replicas",
		date: "Oct 11",
		tag: "Data",
	},
	{
		version: "v2.4",
		title: "CLI workspace diagnostics",
		date: "Oct 05",
		tag: "CLI",
	},
	{
		version: "v2.3",
		title: "Webhook replay & backoff",
		date: "Sep 28",
		tag: "Events",
	},
	{
		version: "v2.2",
		title: "Adaptive rate-limit buckets",
		date: "Sep 20",
		tag: "Edge",
	},
	{
		version: "v2.1",
		title: "Workspace branch previews",
		date: "Sep 12",
		tag: "Deploy",
	},
];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-3.5">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ReleaseBrowser() {
	const [page, setPage] = useState(1);
	const current = RELEASES[page - 1] ?? RELEASES[0];

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-4">
			<div className="w-full rounded-xl border border-border/80 bg-card/60 px-4 py-3.5">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<span className="font-medium font-mono text-foreground text-xs tabular-nums">
							{current.version}
						</span>
						<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
							{current.tag}
						</span>
					</div>
					<span className="text-muted-foreground text-xs tabular-nums">
						{current.date}
					</span>
				</div>
				<p className="mt-1.5 font-medium text-foreground text-sm tracking-tight">
					{current.title}
				</p>
			</div>

			<PaginationRail
				aria-label="Release changelog pagination"
				onPageChange={setPage}
				page={page}
				renderPagePeek={({ page: p }) => {
					const entry = RELEASES[p - 1];
					if (!entry) return `Page ${p}`;
					return (
						<span className="inline-flex items-center gap-1.5">
							<span className="font-medium font-mono text-[11px] text-foreground">
								{entry.version}
							</span>
							<span className="truncate text-muted-foreground">
								{entry.title}
							</span>
						</span>
					);
				}}
				totalPages={RELEASES.length}
			/>
		</div>
	);
}

export default function PaginationRailDemo() {
	const [surfacePage, setSurfacePage] = useState(6);
	const [ghostPage, setGhostPage] = useState(3);
	const [archivePage, setArchivePage] = useState(48);

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-10 py-6">
			<Section title="Hover pages or peek slots to preview releases">
				<ReleaseBrowser />
			</Section>

			<Section title="Surface variant">
				<PaginationRail
					aria-label="Surface pagination"
					onPageChange={setSurfacePage}
					page={surfacePage}
					totalPages={24}
					variant="surface"
				/>
			</Section>

			<Section title="Ghost variant · small">
				<PaginationRail
					aria-label="Ghost pagination"
					onPageChange={setGhostPage}
					page={ghostPage}
					size="sm"
					totalPages={16}
					variant="ghost"
				/>
			</Section>

			<Section title="Large dataset · deep peek stepping">
				<PaginationRail
					aria-label="Archive pagination"
					onPageChange={setArchivePage}
					page={archivePage}
					totalPages={120}
				/>
			</Section>
		</div>
	);
}
