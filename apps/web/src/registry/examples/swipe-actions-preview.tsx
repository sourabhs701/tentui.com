"use client";

import { Archive, Pin, Trash2 } from "lucide-react";
import { useState } from "react";

import {
	type SwipeAction,
	SwipeActions,
	SwipeList,
} from "@/registry/components/swipe-actions/swipe-actions";

const SWIPE_ROWS = [
	{ id: "one", title: "Swipe left or right", bar: "w-32" },
	{ id: "two", title: "Full swipe to delete", bar: "w-40" },
	{ id: "three", title: "Tap to close", bar: "w-24" },
];

function SwipeActionsPreview() {
	const [rows, setRows] = useState(SWIPE_ROWS);
	const remove = (id: string) =>
		setRows((current) => current.filter((row) => row.id !== id));

	return (
		<SwipeList label="Messages" variant="inset" className="w-[280px]">
			{rows.map((row) => {
				const pin: SwipeAction = {
					id: "pin",
					label: "Pin",
					icon: <Pin />,
					tone: "amber",
					onAction: () => {},
				};
				const archive: SwipeAction = {
					id: "archive",
					label: "Archive",
					icon: <Archive />,
					tone: "blue",
					destructive: true,
					onAction: () => remove(row.id),
				};
				const del: SwipeAction = {
					id: "delete",
					label: "Delete",
					icon: <Trash2 />,
					tone: "destructive",
					destructive: true,
					onAction: () => remove(row.id),
				};

				return (
					<SwipeActions
						key={row.id}
						label={row.title}
						leading={[pin]}
						trailing={[archive, del]}
						showHandle={false}
					>
						<div className="flex items-center gap-3 px-4 py-3.5">
							<span
								aria-hidden
								className="size-9 shrink-0 rounded-full bg-muted"
							/>
							<div className="grid min-w-0 flex-1 gap-1.5">
								<p className="truncate font-medium text-sm">{row.title}</p>
								<span className={`h-1.5 rounded-full bg-muted ${row.bar}`} />
							</div>
						</div>
					</SwipeActions>
				);
			})}
		</SwipeList>
	);
}

export default SwipeActionsPreview;
