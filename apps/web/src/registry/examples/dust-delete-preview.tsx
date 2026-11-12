"use client";

import { useState } from "react";

import {
	DustDelete,
	DustDeleteTrigger,
} from "@/registry/components/dust-delete/dust-delete";

const FILES = [
	{
		id: "hero",
		title: "Summer campaign",
		meta: "Hero.jpg, 1.8 MB",
		thumbnail: "bg-[linear-gradient(135deg,#ffd9c2,#f6a57f_55%,#e9785f)]",
	},
	{
		id: "moodboard",
		title: "Moodboard",
		meta: "Moodboard.png, 2.4 MB",
		thumbnail: "bg-[linear-gradient(135deg,#dfe8d2,#a9bf95_55%,#7f9a6e)]",
	},
	{
		id: "dusk",
		title: "Night shoot",
		meta: "Dusk.raw, 24 MB",
		thumbnail: "bg-[linear-gradient(135deg,#c9d3f2,#7f8fcf_55%,#4f5a9e)]",
	},
];

function DustDeletePreview() {
	const [files, setFiles] = useState(FILES);

	return (
		<div className="flex w-full max-w-[320px] flex-col items-center gap-3">
			<div className="w-full rounded-2xl border bg-card p-1.5 text-card-foreground shadow-xs">
				{files.map((file) => (
					<DustDelete
						key={file.id}
						label={file.title}
						onDelete={() =>
							setFiles((current) =>
								current.filter((item) => item.id !== file.id),
							)
						}
					>
						<div className="flex h-14 items-center gap-3 rounded-xl ps-2.5 pe-1.5">
							<span
								aria-hidden
								className={`size-8 shrink-0 rounded-lg ${file.thumbnail}`}
							/>
							<div className="grid min-w-0 flex-1 gap-0.5">
								<p className="truncate font-medium text-sm leading-5">
									{file.title}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{file.meta}
								</p>
							</div>
							<DustDeleteTrigger className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
						</div>
					</DustDelete>
				))}
			</div>
			{files.length < FILES.length ? (
				<button
					type="button"
					onClick={() => setFiles(FILES)}
					className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					Reset demo
				</button>
			) : null}
		</div>
	);
}

export default DustDeletePreview;
