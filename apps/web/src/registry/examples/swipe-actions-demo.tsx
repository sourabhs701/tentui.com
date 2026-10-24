"use client";

import { Archive, Pin, PinOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import {
	type SwipeAction,
	SwipeActions,
	SwipeList,
} from "@/registry/components/swipe-actions/swipe-actions";

const inbox = [
	{
		id: "ava",
		sender: "Ava Chen",
		initials: "AC",
		avatar: "bg-violet-500",
		subject: "Q4 roadmap draft, thoughts?",
		time: "9:41",
		unread: true,
	},
	{
		id: "marcus",
		sender: "Marcus Webb",
		initials: "MW",
		avatar: "bg-emerald-500",
		subject: "Your flight to Lisbon is confirmed",
		time: "8:12",
		unread: true,
	},
	{
		id: "priya",
		sender: "Priya Raman",
		initials: "PR",
		avatar: "bg-sky-500",
		subject: "Design review moved to Thursday",
		time: "Yesterday",
		unread: false,
	},
	{
		id: "leo",
		sender: "Leo Park",
		initials: "LP",
		avatar: "bg-rose-500",
		subject: "Invoice #2041 from Studio North",
		time: "Mon",
		unread: false,
	},
];

function SwipeActionsDemo() {
	const [emails, setEmails] = useState(inbox);
	const [pinned, setPinned] = useState<string[]>([]);

	const remove = (id: string) =>
		setEmails((current) => current.filter((email) => email.id !== id));

	return (
		<div className="w-full max-w-sm overflow-hidden rounded-3xl border bg-background text-foreground shadow-xs">
			<div className="flex items-end justify-between px-4 pt-5 pb-3">
				<div>
					<p className="font-semibold text-xl tracking-tight">Inbox</p>
					<p className="text-muted-foreground text-xs">
						{emails.filter((email) => email.unread).length} unread
					</p>
				</div>
				{emails.length < inbox.length ? (
					<button
						type="button"
						onClick={() => setEmails(inbox)}
						className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-medium text-muted-foreground text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<RotateCcw className="size-3" />
						Reset
					</button>
				) : null}
			</div>

			<SwipeList label="Inbox" className="border-t">
				{emails.map((email) => {
					const isPinned = pinned.includes(email.id);
					const pin: SwipeAction = {
						id: "pin",
						label: isPinned ? "Unpin" : "Pin",
						icon: isPinned ? <PinOff /> : <Pin />,
						tone: "amber",
						announce: `${isPinned ? "Unpinned" : "Pinned"} ${email.sender}'s email`,
						onAction: () =>
							setPinned((current) =>
								isPinned
									? current.filter((id) => id !== email.id)
									: [...current, email.id],
							),
					};
					const archive: SwipeAction = {
						id: "archive",
						label: "Archive",
						icon: <Archive />,
						tone: "blue",
						destructive: true,
						announce: `Archived ${email.sender}'s email`,
						onAction: () => remove(email.id),
					};
					const del: SwipeAction = {
						id: "delete",
						label: "Delete",
						icon: <Trash2 />,
						tone: "destructive",
						destructive: true,
						announce: `Deleted ${email.sender}'s email`,
						onAction: () => remove(email.id),
					};

					return (
						<SwipeActions
							key={email.id}
							label={`Email from ${email.sender}`}
							leading={[pin]}
							trailing={[archive, del]}
						>
							<div className="flex items-center gap-3 px-4 py-3">
								<div className="relative shrink-0">
									<span
										aria-hidden
										className={`flex size-10 items-center justify-center rounded-full font-semibold text-sm text-white ${email.avatar}`}
									>
										{email.initials}
									</span>
									{email.unread ? (
										<span className="absolute -top-0.5 -left-0.5 size-3 rounded-full border-2 border-background bg-blue-500">
											<span className="sr-only">Unread</span>
										</span>
									) : null}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-2">
										<p className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-sm">
											{isPinned ? (
												<Pin
													aria-label="Pinned"
													className="size-3 shrink-0 fill-amber-500 text-amber-500"
												/>
											) : null}
											<span className="truncate">{email.sender}</span>
										</p>
										<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
											{email.time}
										</span>
									</div>
									<p className="truncate text-muted-foreground text-sm">
										{email.subject}
									</p>
								</div>
							</div>
						</SwipeActions>
					);
				})}
			</SwipeList>

			{emails.length === 0 ? (
				<p className="px-4 py-10 text-center text-muted-foreground text-sm">
					All caught up.
				</p>
			) : null}
		</div>
	);
}

export default SwipeActionsDemo;
