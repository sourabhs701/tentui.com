"use client";

import { Link2, Mail, User } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Which part of the email string to emphasize on dock hover / tap. */
type EmailHighlightSegment = "local" | "domain" | "full";

interface EmailHighlight {
	/** Email part to emphasize on hover. */
	segment: EmailHighlightSegment;
	/** Optional link (e.g. `mailto:` or website). */
	href?: string;
	/** Open `href` in a new tab. */
	external?: boolean;
	/** Accessible name for the dock control; derived from segment when omitted. */
	label?: string;
}

const SEGMENT_META: Record<
	EmailHighlightSegment,
	{
		icon: React.ComponentType<{ className?: string }>;
		label: string;
		badge: string;
	}
> = {
	local: { icon: User, label: "Highlight username", badge: "name" },
	domain: { icon: Link2, label: "Highlight domain", badge: "website" },
	full: { icon: Mail, label: "Highlight full email", badge: "email" },
};

const DEFAULT_HIGHLIGHTS: EmailHighlight[] = [
	{ segment: "local" },
	{ segment: "domain" },
	{ segment: "full" },
];

const HIGHLIGHT_CLASS =
	"bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent";

function parseEmail(email: string) {
	const atIndex = email.indexOf("@");
	if (atIndex === -1) {
		return { local: email, at: "", domain: "" };
	}
	return {
		local: email.slice(0, atIndex),
		at: "@",
		domain: email.slice(atIndex + 1),
	};
}

function HighlightableText({
	text,
	active,
	activeLabel,
	showBadge = true,
}: {
	text: string;
	active: boolean;
	activeLabel: string;
	showBadge?: boolean;
}) {
	const showDecoration = active && showBadge;

	return (
		<span className="relative inline-block">
			<span
				aria-hidden
				className={cn(active ? HIGHLIGHT_CLASS : "text-inherit")}
			>
				{text}
			</span>

			{showDecoration ? (
				<>
					<span
						aria-hidden
						className="pointer-events-none absolute -inset-x-0.5 top-[99%] -bottom-2 -z-10 border-border border-r border-b border-l border-dotted"
					/>
					<span
						aria-hidden
						className="pointer-events-none absolute top-[calc(100%+0.6rem)] left-1/2 -translate-x-1/2 whitespace-nowrap font-thin text-[0.42em] text-foreground/35 tracking-[0.18em]"
					>
						{activeLabel}
					</span>
				</>
			) : null}
		</span>
	);
}

interface EmailDockProps extends React.ComponentProps<"div"> {
	/** Full email address shown in the card. */
	email: string;
	/** Dock icons and highlight rules. Defaults to username / domain / full. */
	highlights?: EmailHighlight[];
}

function EmailDock({
	email,
	highlights = DEFAULT_HIGHLIGHTS,
	className,
	...props
}: EmailDockProps) {
	const parsed = React.useMemo(() => parseEmail(email), [email]);
	const [activeSegment, setActiveSegment] =
		React.useState<EmailHighlightSegment | null>(null);

	const deactivate = () => setActiveSegment(null);

	return (
		<div
			data-slot="email-dock"
			className={cn(
				"relative flex w-full max-w-xl flex-col items-center justify-center",
				className,
			)}
			{...props}
		>
			<p
				data-slot="email-dock-address"
				className="w-full text-center font-medium text-[clamp(1.35rem,4.5vw,2.25rem)] text-foreground/35 leading-tight tracking-tight"
			>
				<span className="sr-only">{email}</span>
				<span className="relative inline-block">
					<HighlightableText
						text={parsed.local}
						active={activeSegment === "local" || activeSegment === "full"}
						activeLabel={SEGMENT_META.local.badge}
						showBadge={activeSegment === "local"}
					/>

					{parsed.at ? (
						<span
							aria-hidden
							className={cn(
								activeSegment === "full" ? HIGHLIGHT_CLASS : "text-inherit",
							)}
						>
							{parsed.at}
						</span>
					) : null}

					{parsed.domain ? (
						<HighlightableText
							text={parsed.domain}
							active={activeSegment === "domain" || activeSegment === "full"}
							activeLabel={SEGMENT_META.domain.badge}
							showBadge={activeSegment === "domain"}
						/>
					) : null}

					{activeSegment === "full" ? (
						<>
							<span
								aria-hidden
								className="pointer-events-none absolute -inset-x-0.5 top-[99%] -bottom-2 -z-10 border-border border-r border-b border-l border-dotted"
							/>
							<span
								aria-hidden
								className="pointer-events-none absolute top-[calc(100%+0.6rem)] left-1/2 -translate-x-1/2 whitespace-nowrap font-thin text-[0.42em] text-foreground/35 tracking-[0.18em]"
							>
								{SEGMENT_META.full.badge}
							</span>
						</>
					) : null}
				</span>
			</p>

			{highlights.length > 0 ? (
				<div
					data-slot="email-dock-toolbar"
					role="group"
					aria-label="Email actions"
					className="mt-8 flex items-center justify-center gap-5 sm:mt-10 sm:gap-6"
					onPointerLeave={deactivate}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget as Node)) {
							deactivate();
						}
					}}
				>
					{highlights.map((highlight, index) => (
						<DockAction
							key={`${highlight.segment}-${index}`}
							highlight={highlight}
							isActive={activeSegment === highlight.segment}
							onActivate={() => setActiveSegment(highlight.segment)}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

interface DockActionProps {
	highlight: EmailHighlight;
	isActive: boolean;
	onActivate: () => void;
}

function DockAction({ highlight, isActive, onActivate }: DockActionProps) {
	const meta = SEGMENT_META[highlight.segment];
	const Icon = meta.icon;
	const label = highlight.label ?? meta.label;
	const sharedClass = cn(
		"flex size-10 items-center justify-center rounded-full text-foreground/40",
		"hover:translate-y-[-2px] hover:text-foreground/80",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
		"sm:size-11",
		isActive && "text-foreground",
	);

	const handlers = {
		onPointerEnter: onActivate,
		onFocus: onActivate,
		onClick: (event: React.MouseEvent) => {
			if (highlight.href) return;
			event.preventDefault();
			onActivate();
		},
	};

	if (highlight.href) {
		return (
			<a
				data-slot="email-dock-action"
				href={highlight.href}
				aria-label={label}
				target={highlight.external ? "_blank" : undefined}
				rel={highlight.external ? "noopener noreferrer" : undefined}
				className={sharedClass}
				{...handlers}
			>
				<Icon className="size-[1.15rem] stroke-[1.5] sm:size-5" aria-hidden />
			</a>
		);
	}

	return (
		<button
			type="button"
			data-slot="email-dock-action"
			aria-label={label}
			className={sharedClass}
			{...handlers}
		>
			<Icon className="size-[1.15rem] stroke-[1.5] sm:size-5" aria-hidden />
		</button>
	);
}

export type { EmailDockProps, EmailHighlight, EmailHighlightSegment };
export { DEFAULT_HIGHLIGHTS, EmailDock };

export default EmailDock;
