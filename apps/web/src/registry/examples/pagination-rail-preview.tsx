"use client";

import { useState } from "react";

import { PaginationRail } from "@/registry/components/pagination-rail/pagination-rail";

const PAGE_SIZE = 12;

export default function PaginationRailPreview() {
	const [page, setPage] = useState(2);

	return (
		<div className="flex flex-col items-center gap-4 pt-10 pb-2">
			<PaginationRail
				aria-label="Preview pagination"
				onPageChange={setPage}
				page={page}
				renderPagePeek={({ page: p }) => {
					const start = (p - 1) * PAGE_SIZE + 1;
					const end = p * PAGE_SIZE;
					return (
						<span className="inline-flex items-center gap-1.5 tabular-nums">
							<span className="font-medium text-foreground">Page {p}</span>
							<span className="text-muted-foreground">&middot;</span>
							<span className="text-muted-foreground">
								Items {start}&ndash;{end}
							</span>
						</span>
					);
				}}
				totalPages={24}
			/>
		</div>
	);
}
