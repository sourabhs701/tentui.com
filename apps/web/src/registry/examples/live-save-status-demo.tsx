"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	LiveSaveStatus,
	type LiveSaveStatusHistoryItem,
	type LiveSaveStatusState,
} from "@/registry/components/live-save-status/live-save-status";

const ALL_STATES: LiveSaveStatusState[] = [
	"saved",
	"unsaved",
	"saving",
	"offline",
	"error",
];

const INITIAL_TEXT =
	"Autosave should feel calm and trustworthy. Type here to watch the capsule morph from unsaved edits through the saving arc to a drawn checkmark seal.";

export default function LiveSaveStatusDemo() {
	// Section 1: Interactive autosave note editor
	const [draft, setDraft] = useState(INITIAL_TEXT);
	const [editorStatus, setEditorStatus] =
		useState<LiveSaveStatusState>("saved");
	const [pendingEdits, setPendingEdits] = useState(0);
	const [offlineMode, setOfflineMode] = useState(false);
	const [failNext, setFailNext] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<number>(
		() => Date.now() - 95_000,
	);
	const [history, setHistory] = useState<LiveSaveStatusHistoryItem[]>(() => [
		{
			id: "v3",
			label: "Refined microcopy and status states",
			savedAt: Date.now() - 95_000,
			author: "You",
		},
		{
			id: "v2",
			label: "Added offline local-first queue",
			savedAt: Date.now() - 8 * 60_000,
			author: "You",
		},
		{
			id: "v1",
			label: "Initial draft",
			savedAt: Date.now() - 34 * 60_000,
			author: "You",
		},
	]);

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const failNextRef = useRef(failNext);
	failNextRef.current = failNext;
	const offlineRef = useRef(offlineMode);
	offlineRef.current = offlineMode;

	const runSave = useCallback((snapshotText?: string) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (saveRef.current) clearTimeout(saveRef.current);

		if (offlineRef.current) {
			setEditorStatus("offline");
			return;
		}

		setEditorStatus("saving");
		saveRef.current = setTimeout(() => {
			if (failNextRef.current) {
				setFailNext(false);
				setEditorStatus("error");
				return;
			}
			const now = Date.now();
			setLastSavedAt(now);
			setPendingEdits(0);
			setEditorStatus("saved");
			setHistory((prev) => [
				{
					id: `v-${now}`,
					label: snapshotText
						? snapshotText.trim().slice(0, 42) || "Saved draft"
						: "Saved latest edits",
					savedAt: now,
					author: "You",
				},
				...prev.slice(0, 4),
			]);
		}, 650);
	}, []);

	const lastEditBurstRef = useRef(0);

	const handleDraftChange = (nextValue: string) => {
		setDraft(nextValue);
		const now = Date.now();
		if (now - lastEditBurstRef.current > 1200 || pendingEdits === 0) {
			setPendingEdits((count) => count + 1);
		}
		lastEditBurstRef.current = now;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (saveRef.current) clearTimeout(saveRef.current);

		if (offlineRef.current) {
			setEditorStatus("offline");
			return;
		}

		setEditorStatus("unsaved");
		debounceRef.current = setTimeout(() => {
			runSave(nextValue);
		}, 950);
	};

	const toggleOffline = () => {
		setOfflineMode((prev) => {
			const next = !prev;
			offlineRef.current = next;
			if (next) {
				if (debounceRef.current) clearTimeout(debounceRef.current);
				if (saveRef.current) clearTimeout(saveRef.current);
				setEditorStatus("offline");
			} else if (pendingEdits > 0 || editorStatus === "offline") {
				runSave(draft);
			}
			return next;
		});
	};

	useEffect(
		() => () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			if (saveRef.current) clearTimeout(saveRef.current);
		},
		[],
	);

	// Section 2: Manual state inspector
	const [manualState, setManualState] = useState<LiveSaveStatusState>("saved");
	const [manualSavedAt, setManualSavedAt] = useState<number>(() => Date.now());
	const [soundOn, setSoundOn] = useState(false);

	const triggerManualSave = () => {
		setManualState("saving");
		setTimeout(() => {
			setManualSavedAt(Date.now());
			setManualState("saved");
		}, 750);
	};

	return (
		<div className="flex w-full max-w-2xl flex-col gap-10 py-6">
			{/* 1. Real autosave document card */}
			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-medium text-muted-foreground text-sm">
						Live autosave editor
					</h3>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={toggleOffline}
							className="h-7 cursor-pointer rounded-full bg-muted px-3 font-medium text-foreground text-xs outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							{offlineMode ? "Go online" : "Simulate offline"}
						</button>
						<button
							type="button"
							onClick={() => setFailNext((v) => !v)}
							className="h-7 cursor-pointer rounded-full bg-muted px-3 font-medium text-foreground text-xs outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							{failNext ? "Fail armed" : "Fail next save"}
						</button>
					</div>
				</div>

				<div className="rounded-2xl bg-card shadow-black/[0.03] shadow-sm ring-1 ring-foreground/10">
					<div className="flex flex-wrap items-center justify-between gap-2 border-border/70 border-b px-4 py-2.5">
						<span className="truncate font-medium text-foreground text-sm">
							release-notes.md
						</span>
						<LiveSaveStatus
							status={editorStatus}
							lastSavedAt={lastSavedAt}
							pendingCount={pendingEdits > 0 ? pendingEdits : undefined}
							errorMessage="Request timed out (504). Click Retry to sync."
							onSave={() => runSave(draft)}
							onRetry={() => runSave(draft)}
							history={history}
							onRestore={(item) => {
								setDraft(`Restored checkpoint: ${item.label}`);
								setEditorStatus("saved");
								setPendingEdits(0);
							}}
							popoverAlign="end"
							shortcut="⌘S"
						/>
					</div>
					<label htmlFor="live-save-status-editor" className="sr-only">
						Document draft
					</label>
					<textarea
						id="live-save-status-editor"
						value={draft}
						rows={4}
						spellCheck={false}
						onChange={(event) => handleDraftChange(event.target.value)}
						onKeyDown={(event) => {
							if ((event.metaKey || event.ctrlKey) && event.key === "s") {
								event.preventDefault();
								runSave(draft);
							}
						}}
						placeholder="Start typing to trigger autosave..."
						className="block w-full resize-none rounded-b-2xl bg-transparent px-4 py-3 text-foreground text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
					/>
				</div>
			</section>

			{/* 2. Interactive state switcher */}
			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-medium text-muted-foreground text-sm">
						All states
					</h3>
					<button
						type="button"
						onClick={() => setSoundOn((prev) => !prev)}
						className="h-7 cursor-pointer rounded-full bg-muted px-3 font-medium text-foreground text-xs outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						Sound: {soundOn ? "On" : "Off"}
					</button>
				</div>

				<div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed p-6">
					<LiveSaveStatus
						status={manualState}
						lastSavedAt={manualSavedAt}
						pendingCount={
							manualState === "unsaved" || manualState === "offline"
								? 3
								: undefined
						}
						errorMessage="Server returned 503 Service Unavailable."
						onSave={triggerManualSave}
						onRetry={triggerManualSave}
						sound={soundOn}
						showPopover
						popoverAlign="center"
					/>

					<div className="flex flex-wrap justify-center gap-1.5">
						{ALL_STATES.map((state) => (
							<button
								key={state}
								type="button"
								onClick={() => {
									if (state === "saved") setManualSavedAt(Date.now());
									setManualState(state);
								}}
								className={
									manualState === state
										? "h-7 cursor-pointer rounded-full bg-foreground px-3 font-medium text-background text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
										: "h-7 cursor-pointer rounded-full bg-muted px-3 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
								}
							>
								{state}
							</button>
						))}
					</div>
				</div>
			</section>

			{/* 3. Variants & sizes */}
			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					Variants &amp; sizes
				</h3>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div className="flex flex-col items-start gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-foreground/6">
						<span className="font-medium text-muted-foreground text-xs">
							Pill
						</span>
						<LiveSaveStatus status="saved" lastSavedAt={lastSavedAt} />
						<LiveSaveStatus
							status="unsaved"
							size="sm"
							onSave={() => undefined}
						/>
					</div>
					<div className="flex flex-col items-start gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-foreground/6">
						<span className="font-medium text-muted-foreground text-xs">
							Ghost
						</span>
						<LiveSaveStatus
							variant="ghost"
							status="saving"
							lastSavedAt={lastSavedAt}
						/>
						<LiveSaveStatus
							variant="ghost"
							size="sm"
							status="offline"
							pendingCount={2}
						/>
					</div>
					<div className="flex flex-col items-start gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-foreground/6">
						<span className="font-medium text-muted-foreground text-xs">
							Minimal
						</span>
						<div className="flex items-center gap-2">
							<LiveSaveStatus variant="minimal" status="saved" showPopover />
							<LiveSaveStatus
								variant="minimal"
								status="unsaved"
								pendingCount={3}
								showPopover
							/>
							<LiveSaveStatus variant="minimal" status="saving" />
							<LiveSaveStatus variant="minimal" status="error" showPopover />
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
