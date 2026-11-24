"use client";

import { type ReactNode, useState } from "react";

import {
	WizardRail,
	type WizardRailStep,
} from "@/registry/components/wizard-rail/wizard-rail";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-3.5">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

const PLANS = [
	{ id: "hobby", name: "Starter", detail: "Personal projects · Free" },
	{ id: "pro", name: "Pro", detail: "Team previews · $20 / seat" },
] as const;

function WorkspaceSetupWizard() {
	const [workspaceName, setWorkspaceName] = useState("Acme Studio");
	const [plan, setPlan] = useState<string>("pro");
	const [inviteEmail, setInviteEmail] = useState("");
	const [validationError, setValidationError] = useState<string | undefined>(
		undefined,
	);

	const selectedPlan = PLANS.find((p) => p.id === plan) ?? PLANS[0];

	const steps: WizardRailStep[] = [
		{
			id: "workspace",
			title: "Workspace",
			description: "Name & slug",
			content: (
				<div className="space-y-3">
					<div className="space-y-1.5">
						<label
							className="block font-medium text-foreground text-xs"
							htmlFor="wizard-workspace-name"
						>
							Workspace name
						</label>
						<input
							className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
							id="wizard-workspace-name"
							onChange={(event) => {
								setWorkspaceName(event.target.value);
								if (validationError) setValidationError(undefined);
							}}
							placeholder="Enter a workspace name..."
							type="text"
							value={workspaceName}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						Clear the field and click Continue to see the inline validation
						guard.
					</p>
				</div>
			),
		},
		{
			id: "plan",
			title: "Plan",
			description: "Usage tier",
			content: (
				<div className="grid gap-2 sm:grid-cols-2">
					{PLANS.map((item) => {
						const active = item.id === plan;
						return (
							<button
								className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
									active
										? "border-foreground bg-foreground/[0.04] text-foreground"
										: "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
								}`}
								key={item.id}
								onClick={() => setPlan(item.id)}
								type="button"
							>
								<span className="block font-medium text-foreground text-sm">
									{item.name}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs">
									{item.detail}
								</span>
							</button>
						);
					})}
				</div>
			),
		},
		{
			id: "team",
			title: "Invite",
			description: "Optional",
			optional: true,
			content: (
				<div className="space-y-2">
					<label
						className="block font-medium text-foreground text-xs"
						htmlFor="wizard-invite-email"
					>
						Teammate email (optional)
					</label>
					<input
						className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
						id="wizard-invite-email"
						onChange={(event) => setInviteEmail(event.target.value)}
						placeholder="alex@acme.dev"
						type="email"
						value={inviteEmail}
					/>
				</div>
			),
		},
		{
			id: "review",
			title: "Review",
			description: "Confirm",
			nextLabel: "Create",
			content: (
				<dl className="space-y-2 text-xs">
					<div className="flex items-center justify-between gap-2">
						<dt className="text-muted-foreground">Workspace</dt>
						<dd className="truncate font-medium text-foreground">
							{workspaceName.trim() || "Untitled"}
						</dd>
					</div>
					<div className="flex items-center justify-between gap-2">
						<dt className="text-muted-foreground">Plan</dt>
						<dd className="font-medium text-foreground">{selectedPlan.name}</dd>
					</div>
					<div className="flex items-center justify-between gap-2">
						<dt className="text-muted-foreground">Invite</dt>
						<dd className="truncate font-mono text-foreground">
							{inviteEmail.trim() || "Skipped"}
						</dd>
					</div>
				</dl>
			),
		},
	];

	return (
		<WizardRail
			aria-label="Workspace setup wizard"
			className="max-w-lg"
			completedContent={
				<div className="space-y-1 py-2 text-center">
					<p className="font-medium text-foreground text-sm tracking-tight">
						{workspaceName.trim() || "Workspace"} is ready
					</p>
					<p className="text-muted-foreground text-xs">
						Provisioned on the {selectedPlan.name} plan. Click any milestone or
						Start over to replay.
					</p>
				</div>
			}
			errorMessage={validationError}
			onBeforeNext={(stepIndex) => {
				if (stepIndex === 0 && workspaceName.trim().length === 0) {
					setValidationError("Enter a workspace name before continuing.");
					return false;
				}
				setValidationError(undefined);
				return true;
			}}
			onReset={() => setValidationError(undefined)}
			steps={steps}
		/>
	);
}

const SEGMENTED_STEPS: WizardRailStep[] = [
	{
		id: "source",
		title: "Source",
		content: (
			<p className="text-muted-foreground text-xs leading-relaxed">
				Connect a Git repository or upload a static bundle to begin a preview
				build.
			</p>
		),
	},
	{
		id: "build",
		title: "Build",
		content: (
			<p className="text-muted-foreground text-xs leading-relaxed">
				Configure install commands, output directory, and runtime environment
				variables.
			</p>
		),
	},
	{
		id: "checks",
		title: "Checks",
		content: (
			<p className="text-muted-foreground text-xs leading-relaxed">
				Require type checks and preview verification before promoting traffic.
			</p>
		),
	},
	{
		id: "ship",
		title: "Ship",
		nextLabel: "Publish",
		content: (
			<p className="text-muted-foreground text-xs leading-relaxed">
				Everything is verified and ready to publish to your preview hostname.
			</p>
		),
	},
];

const MINIMAL_STEPS: WizardRailStep[] = [
	{ id: "details", title: "Details" },
	{ id: "billing", title: "Billing" },
	{ id: "confirm", title: "Confirm" },
];

export default function WizardRailDemo() {
	const [minimalStep, setMinimalStep] = useState(1);

	return (
		<div className="flex w-full max-w-xl flex-col items-center gap-12 py-6">
			<Section title="Linear flow · validation guard & optional skip">
				<WorkspaceSetupWizard />
			</Section>

			<Section title="Segmented variant · non-linear jump navigation">
				<WizardRail
					aria-label="Release pipeline wizard"
					className="max-w-lg"
					defaultStep={1}
					linear={false}
					steps={SEGMENTED_STEPS}
					variant="segmented"
				/>
			</Section>

			<Section title="Minimal rail-only variant · controlled state">
				<div className="w-full max-w-md">
					<WizardRail
						activeStep={minimalStep}
						aria-label="Checkout progress"
						linear={false}
						onStepChange={(index) => setMinimalStep(index)}
						size="sm"
						steps={MINIMAL_STEPS}
						variant="minimal"
					/>
				</div>
			</Section>
		</div>
	);
}
