"use client";

import { Download, Heart } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
	DustDelete,
	DustDeleteTrigger,
} from "@/registry/components/dust-delete/dust-delete";

/** A small landscape as a same-origin SVG, so its pixels can colour the dust. */
function landscape(
	sky: [string, string],
	sun: string,
	hills: [string, string, string],
) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="300" height="400" fill="url(#s)"/><circle cx="196" cy="150" r="38" fill="${sun}"/><path d="M0 250 Q70 200 140 236 T300 214 V400 H0Z" fill="${hills[0]}"/><path d="M0 300 Q90 256 170 290 T300 276 V400 H0Z" fill="${hills[1]}"/><path d="M0 346 Q110 318 200 342 T300 334 V400 H0Z" fill="${hills[2]}"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PHOTOS = [
	{
		id: "dunes",
		title: "Dunes at noon",
		src: landscape(["#fde8cf", "#f7c9a0"], "#fff4e2", [
			"#e9a974",
			"#d28655",
			"#a9603d",
		]),
	},
	{
		id: "lake",
		title: "Lake in the morning",
		src: landscape(["#d8ecf2", "#a9d3df"], "#f4fbfd", [
			"#7fb4b0",
			"#4f8f8c",
			"#2f6b6e",
		]),
	},
	{
		id: "bloom",
		title: "Pink hour",
		src: landscape(["#fbe1ea", "#f1b6c9"], "#fff3f6", [
			"#d98aa6",
			"#b8648a",
			"#8a4467",
		]),
	},
	{
		id: "forest",
		title: "Forest at dusk",
		src: landscape(["#3b4a7a", "#8a7fb0"], "#f6d8b2", [
			"#3f5a5a",
			"#2b4343",
			"#1b2d2f",
		]),
	},
];

const NOTES = [
	{ id: "draft", title: "Launch notes", meta: "Draft, edited 2h ago" },
	{ id: "invoice", title: "Invoice #1042", meta: "Sent to Acme, Oct 28" },
	{ id: "meeting", title: "Design review", meta: "Notes from Tuesday" },
];

const chip =
	"flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/25 text-white outline-none ring-1 ring-white/35 backdrop-blur-md transition-colors hover:bg-white/40 focus-visible:ring-3 focus-visible:ring-white/70 [&_svg]:size-3.5";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-3">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function PhotoCard({
	photo,
	onDelete,
}: {
	photo: (typeof PHOTOS)[number];
	onDelete: () => void;
}) {
	return (
		<DustDelete label={photo.title} collapse={false} onDelete={onDelete}>
			<div className="group/photo relative aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_20px_-10px_rgb(0_0_0/0.35)]">
				{/* biome-ignore lint/performance/noImgElement: a same-origin data URL, read for grain colours */}
				<img
					src={photo.src}
					alt={photo.title}
					className="size-full object-cover"
					draggable={false}
				/>
				<div className="absolute end-2 top-2 flex flex-col gap-1.5 opacity-0 pointer-coarse:opacity-100 transition-opacity duration-150 group-focus-within/photo:opacity-100 group-hover/photo:opacity-100">
					<button
						type="button"
						aria-label={`Like ${photo.title}`}
						className={chip}
					>
						<Heart aria-hidden />
					</button>
					<button
						type="button"
						aria-label={`Download ${photo.title}`}
						className={chip}
					>
						<Download aria-hidden />
					</button>
					<DustDeleteTrigger className={chip} />
				</div>
			</div>
		</DustDelete>
	);
}

function DustDeleteDemo() {
	const [photos, setPhotos] = useState(PHOTOS);
	const [notes, setNotes] = useState(NOTES);
	const [deleted, setDeleted] = useState(false);
	const [committed, setCommitted] = useState(false);

	const changed =
		photos.length < PHOTOS.length ||
		notes.length < NOTES.length ||
		deleted ||
		committed;
	const reset = () => {
		setPhotos(PHOTOS);
		setNotes(NOTES);
		setDeleted(false);
		setCommitted(false);
	};

	return (
		<div className="flex w-full max-w-[320px] flex-col items-center gap-10 py-4">
			<Section title="Images">
				<div className="grid w-full grid-cols-2 gap-3">
					{photos.map((photo) => (
						<PhotoCard
							key={photo.id}
							photo={photo}
							onDelete={() =>
								setPhotos((current) =>
									current.filter((item) => item.id !== photo.id),
								)
							}
						/>
					))}
				</div>
			</Section>

			<Section title="Any element">
				<div className="w-full rounded-xl border bg-card text-card-foreground shadow-xs">
					{notes.map((note) => (
						<DustDelete
							key={note.id}
							label={note.title}
							from="right"
							onDelete={() =>
								setNotes((current) =>
									current.filter((item) => item.id !== note.id),
								)
							}
						>
							<div className="flex h-14 items-center gap-3 ps-4 pe-2">
								<div className="grid min-w-0 flex-1 gap-0.5">
									<p className="truncate font-medium text-sm leading-5">
										{note.title}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{note.meta}
									</p>
								</div>
								<DustDeleteTrigger className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
							</div>
						</DustDelete>
					))}
				</div>
			</Section>

			<Section title="Controlled, sound off">
				<div className="w-full rounded-xl border bg-card text-card-foreground shadow-xs">
					<DustDelete
						label="Weekly digest"
						deleted={deleted}
						onDeletedChange={setDeleted}
						onDelete={() => setCommitted(true)}
						sound={false}
					>
						<div className="flex h-14 items-center gap-3 ps-4 pe-2">
							<div className="grid min-w-0 flex-1 gap-0.5">
								<p className="truncate font-medium text-sm leading-5">
									Weekly digest
								</p>
								<p className="truncate text-muted-foreground text-xs">
									Every Monday at 9:00
								</p>
							</div>
							<DustDeleteTrigger className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
						</div>
					</DustDelete>
				</div>
				<div className="flex w-full items-center justify-between gap-3 text-xs">
					<p className="text-muted-foreground" aria-live="off">
						{committed
							? "Deleted for good"
							: deleted
								? "Deleted, undo window open"
								: "In the list"}
					</p>
					<button
						type="button"
						onClick={() => {
							setDeleted(false);
							setCommitted(false);
						}}
						disabled={!deleted && !committed}
						className="cursor-pointer rounded-md border px-2.5 py-1 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
					>
						Reset
					</button>
				</div>
			</Section>

			{changed ? (
				<button
					type="button"
					onClick={reset}
					className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					Reset demo
				</button>
			) : null}
		</div>
	);
}

export default DustDeleteDemo;
