"use client";

import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	UploadChip,
	type UploadChipFile,
} from "@/registry/components/upload-chip/upload-chip";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

interface Simulated extends UploadChipFile {
	/** Fails once at this progress, then succeeds on retry. */
	failAt?: number;
}

let nextId = 0;

/**
 * Fake uploads with no network: progress arrives in uneven steps, like an
 * XHR `upload.onprogress`. A real app swaps this for its own uploader.
 */
function useSimulatedUploads(initial: Simulated[] = []) {
	const [files, setFiles] = useState<Simulated[]>(initial);
	const timers = useRef(new Map<string, number>());

	const run = useCallback((id: string) => {
		const tick = () => {
			setFiles((current) =>
				current.map((file) => {
					if (file.id !== id || file.status !== "uploading") return file;
					const progress = Math.min(
						1,
						(file.progress ?? 0) + 0.04 + Math.random() * 0.14,
					);
					if (file.failAt !== undefined && progress >= file.failAt) {
						return {
							...file,
							progress: file.failAt,
							status: "error",
							error: "Connection lost",
							failAt: undefined,
						};
					}
					return {
						...file,
						progress,
						status: progress >= 1 ? "done" : "uploading",
					};
				}),
			);
			timers.current.set(
				id,
				window.setTimeout(tick, 140 + Math.random() * 260),
			);
		};
		window.clearTimeout(timers.current.get(id));
		timers.current.set(id, window.setTimeout(tick, 200));
	}, []);

	useEffect(() => {
		const map = timers.current;
		return () => {
			for (const timer of map.values()) window.clearTimeout(timer);
		};
	}, []);

	const add = useCallback(
		(picked: File[]) => {
			const added = picked.map(
				(file): Simulated => ({
					id: `upload-${nextId++}`,
					name: file.name,
					size: file.size,
					type: file.type,
					progress: 0,
					status: "uploading",
					previewUrl: file.type.startsWith("image/")
						? URL.createObjectURL(file)
						: undefined,
				}),
			);
			setFiles((current) => [...current, ...added]);
			for (const file of added) run(file.id);
		},
		[run],
	);

	const remove = useCallback((id: string) => {
		window.clearTimeout(timers.current.get(id));
		setFiles((current) => current.filter((file) => file.id !== id));
	}, []);

	const retry = useCallback(
		(id: string) => {
			setFiles((current) =>
				current.map((file) =>
					file.id === id
						? { ...file, status: "uploading", progress: 0, error: undefined }
						: file,
				),
			);
			run(id);
		},
		[run],
	);

	return { files, add, remove, retry, run, setFiles };
}

function TryIt() {
	const box = useRef<HTMLDivElement>(null);
	const { files, add, remove } = useSimulatedUploads();
	return (
		<div
			ref={box}
			className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border bg-background p-3"
		>
			<p className="px-1 text-muted-foreground text-sm">
				Pick a file, or drop one anywhere in this box.
			</p>
			<UploadChip
				files={files}
				onFilesAdded={add}
				onRemove={remove}
				onCancel={remove}
				dropTargetRef={box}
				sound
			/>
		</div>
	);
}

function Deck() {
	const { files, add, remove, retry, run } = useSimulatedUploads([
		{
			id: "deck-1",
			name: "quarterly-report-final-v3.pdf",
			size: 4_200_000,
			type: "application/pdf",
			status: "done",
		},
		{
			id: "deck-2",
			name: "site-photos.zip",
			size: 38_000_000,
			type: "application/zip",
			progress: 0,
			status: "uploading",
			failAt: 0.46,
		},
		{
			id: "deck-3",
			name: "team-photo.jpg",
			size: 1_900_000,
			type: "image/jpeg",
			progress: 0,
			status: "uploading",
		},
		{
			id: "deck-4",
			name: "notes.md",
			size: 3_400,
			type: "text/markdown",
			status: "done",
		},
	]);
	useEffect(() => {
		run("deck-2");
		run("deck-3");
	}, [run]);
	return (
		<UploadChip
			files={files}
			onFilesAdded={add}
			onRemove={remove}
			onCancel={remove}
			onRetry={retry}
			maxFiles={6}
		/>
	);
}

function Indeterminate() {
	const [run, setRun] = useState(0);
	const [done, setDone] = useState(false);
	// Runs a while without a known size, then finishes and starts again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: each run restarts the timers
	useEffect(() => {
		setDone(false);
		const finish = window.setTimeout(() => setDone(true), 5200);
		const again = window.setTimeout(() => setRun((count) => count + 1), 8200);
		return () => {
			window.clearTimeout(finish);
			window.clearTimeout(again);
		};
	}, [run]);
	return (
		<UploadChip
			files={[
				done
					? {
							id: `busy-${run}`,
							name: "interview-raw.wav",
							size: 84_000_000,
							status: "done",
						}
					: {
							id: `busy-${run}`,
							name: "interview-raw.wav",
							status: "uploading",
						},
			]}
		/>
	);
}

function Stalled() {
	return (
		<UploadChip
			files={[
				{
					id: "stalled",
					name: "launch-video.mov",
					size: 210_000_000,
					type: "video/quicktime",
					progress: 0.42,
					status: "uploading",
				},
			]}
		/>
	);
}

const SIZE_FILES: UploadChipFile[] = [
	{
		id: "size-1",
		name: "invoice-0412.pdf",
		size: 182_000,
		type: "application/pdf",
		status: "done",
	},
	{
		id: "size-2",
		name: "cover.png",
		size: 640_000,
		type: "image/png",
		status: "done",
	},
	{
		id: "size-3",
		name: "theme-song.mp3",
		size: 6_800_000,
		type: "audio/mpeg",
		status: "idle",
	},
];

function Sizes() {
	return (
		<div className="flex w-full flex-col items-center gap-4">
			<div className="flex flex-wrap items-center justify-center gap-4">
				<UploadChip size="sm" files={SIZE_FILES.slice(0, 1)} />
				<UploadChip size="md" files={SIZE_FILES.slice(0, 1)} />
			</div>
			<UploadChip stack={false} files={SIZE_FILES} />
		</div>
	);
}

function UploadChipDemo() {
	return (
		<div className="flex w-full flex-col items-center gap-12 py-6">
			<Section title="Try it">
				<TryIt />
			</Section>
			<Section title="Deck of files">
				<Deck />
			</Section>
			<Section title="Indeterminate and stalled">
				<div className="flex flex-wrap items-center justify-center gap-4">
					<Indeterminate />
					<Stalled />
				</div>
			</Section>
			<Section title="Sizes">
				<Sizes />
			</Section>
		</div>
	);
}

export default UploadChipDemo;
