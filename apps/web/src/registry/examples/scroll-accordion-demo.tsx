"use client";

import { useState } from "react";

import { ScrollAccordion } from "@/registry/components/scroll-accordion/scroll-accordion";

const SECTIONS = [
	{
		id: "overview",
		title: "Overview",
		content: (
			<>
				<p>
					These notes cover how the workspace stores, shares, and deletes what
					you put in it. Each section stands on its own, so jump to the one you
					need from the stack below.
				</p>
				<p className="mt-3">
					Every header stays in reach while you read: sections you have passed
					collect above, and the ones ahead wait below.
				</p>
			</>
		),
	},
	{
		id: "storage",
		title: "Where your files live",
		content: (
			<>
				<p>
					Files are stored in the region you picked when the workspace was
					created and are encrypted at rest. Backups stay in the same region.
				</p>
				<p className="mt-3">
					Read the{" "}
					<a
						href="#storage"
						className="font-medium text-foreground underline underline-offset-4"
					>
						storage regions table
					</a>{" "}
					to see which regions are available on each plan.
				</p>
			</>
		),
	},
	{
		id: "sharing",
		title: "Sharing and guests",
		content: (
			<>
				<p>
					Links inherit the permissions of the page they point to. Guests see
					only the pages they were invited to, never the sidebar.
				</p>
				<p className="mt-3">
					A forwarded link still asks the new reader to sign in, unless the page
					is published to the web.
				</p>
			</>
		),
	},
	{
		id: "retention",
		title: "Retention",
		content: (
			<>
				<p>
					Deleted pages stay in the trash for 30 days, then they are gone for
					good, including from backups after another 14 days.
				</p>
				<p className="mt-3">
					Admins can shorten the trash window, but never lengthen it.
				</p>
			</>
		),
	},
	{
		id: "export",
		title: "Export",
		content: (
			<p>
				Export any page, or the whole workspace, as Markdown and CSV at any
				time. Exports include attachments and keep the page tree.
			</p>
		),
	},
];

function ScrollAccordionDemo() {
	const [value, setValue] = useState("overview");
	const current = SECTIONS.find((section) => section.id === value);

	return (
		<div className="flex w-full max-w-md flex-col gap-3">
			<ScrollAccordion
				aria-label="Workspace data policy"
				variant="list"
				items={SECTIONS}
				value={value}
				onValueChange={setValue}
				height={360}
			/>
			<p className="truncate text-muted-foreground text-xs" aria-live="off">
				Reading <span className="text-foreground">{current?.title}</span>
			</p>
		</div>
	);
}

export default ScrollAccordionDemo;
