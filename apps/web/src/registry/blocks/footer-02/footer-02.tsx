import { RssIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Footer02Link {
	label: string;
	href: string;
	external?: boolean;
	icon?: ReactNode;
}

export interface Footer02LinkGroup {
	title: string;
	links: Footer02Link[];
}

export interface Footer02Props {
	brandName?: string;
	brandHref?: string;
	brandMark?: ReactNode;
	copyright?: string;
	linkGroups?: Footer02LinkGroup[];
	socialLinks?: Footer02Link[];
	wordmark?: ReactNode;
	className?: string;
}

const DEFAULT_LINK_GROUPS: Footer02LinkGroup[] = [
	{
		title: "Components",
		links: [
			{ label: "3D Button", href: "#" },
			{ label: "Animated Tabs", href: "#" },
			{ label: "Copy Button", href: "#" },
			{ label: "Email Dock", href: "#" },
			{ label: "World Map", href: "#" },
		],
	},
	{
		title: "Shadcn Compatible Blocks",
		links: [
			{ label: "Hero", href: "#" },
			{ label: "Pricing", href: "#" },
			{ label: "FAQ", href: "#" },
			{ label: "Footer", href: "#" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "License", href: "#" },
			{ label: "Terms of Service", href: "#" },
			{ label: "Privacy", href: "#" },
			{ label: "Copyright", href: "#" },
		],
	},
];

const DEFAULT_SOCIAL_LINKS: Footer02Link[] = [
	{
		label: "X (formerly Twitter)",
		href: "https://x.com",
		external: true,
	},
	{
		label: "RSS",
		href: "#",
		icon: <RssIcon aria-hidden="true" className="size-3" />,
	},
];

const GRAIN_BACKGROUND =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const EXTERNAL_URL_PATTERN = /^https?:\/\//;

const MARKER_POSITION_CLASSES = {
	"top-left": "-top-[3px] -left-1",
	"top-right": "-top-[3px] -right-1",
	"bottom-left": "-bottom-[3px] -left-1",
	"bottom-right": "-right-1 -bottom-[3px]",
} as const;

function Grain({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 -z-10 opacity-10",
				className,
			)}
			style={{
				backgroundImage: GRAIN_BACKGROUND,
				backgroundRepeat: "repeat",
			}}
		/>
	);
}

function GridMarker({
	position,
	className,
}: {
	position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"absolute z-10 size-1.5 rotate-45 border border-primary-foreground/25 bg-background",
				MARKER_POSITION_CLASSES[position],
				className,
			)}
		/>
	);
}

function ArrowUpRight() {
	return (
		<svg
			aria-hidden="true"
			className="size-2.5"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.5"
			viewBox="0 0 12 12"
		>
			<path d="M3.5 8.5 8.5 3.5m0 0h-4m4 0v4" />
		</svg>
	);
}

function FooterLinkList({ links }: { links: Footer02Link[] }) {
	return (
		<ul className="mt-5 flex flex-col gap-1.5 font-mono text-[12px] text-primary-foreground/65 tracking-tight">
			{links.map((link) => {
				const external = link.external ?? EXTERNAL_URL_PATTERN.test(link.href);

				return (
					<li key={`${link.label}-${link.href}`}>
						<Link
							className="inline-flex items-center gap-1 transition-colors hover:text-primary-foreground"
							href={link.href as Route}
							rel={external ? "noreferrer" : undefined}
							target={external ? "_blank" : undefined}
						>
							{link.icon}
							{link.label}
							{external ? <ArrowUpRight /> : null}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function TentMark() {
	return (
		<svg
			aria-hidden="true"
			className="h-5 w-auto text-white"
			fill="none"
			viewBox="0 0 150 128"
		>
			<path
				d="M10 128H0v-20.851h10V128Zm100-116.996h10V21.43h10v10.425h10V42.57h9.722v52.706H140v11.873h-10V74.715h-10v31.855h-10V128h-10V74.715H90v31.855H80V128H70v-21.43H60V74.715H50V128H40v-21.43H30V74.715H20v32.434H10V95.276H.278V42.57H10V31.855h10V21.43h10V11.004h10V0h70v11.004ZM30 42.86h10V31.855H30V42.86Zm80 0h10V31.855h-10V42.86ZM150 128h-10v-20.851h10V128Z"
				fill="currentColor"
			/>
		</svg>
	);
}

function TentWordmark() {
	return (
		<svg
			aria-hidden="true"
			className="h-auto w-full text-primary-foreground/30"
			fill="none"
			viewBox="0 0 929 258"
		>
			<path
				className="fill-current/10"
				d="M1 129h64v64H1zM161 193h64v64h-64zM161 1h64v64h-64zM705 1h64v64h-64zM705 193h64v64h-64zM864 129h64v64h-64z"
			/>
			<path
				className="stroke-current/40"
				d="M1 65h947M1 1h947M1 257h947M1 193h947M65 1v256M864 1v256"
				strokeDasharray="8 4"
				strokeLinecap="square"
			/>
			<g fill="currentColor" fillOpacity=".3" transform="translate(65 65)">
				<path d="M149.5 107.649V127.5h-9v-19.851h9Zm-40-107.149v11.005h10V21.93h10v10.425h10V43.07h9.723v51.706H139.5v11.873h-9V74.215h-11v31.855h-10v21.43h-9V74.215h-11v31.855h-10v21.43h-9v-21.43h-10V74.215h-11v53.285h-9v-21.43h-10V74.215h-11v32.434h-9V94.776H.777V43.07H10.5V32.355h10V21.93h10V11.505h10V.5h69ZM9.5 107.649V127.5h-9v-19.851h9Zm20-64.29h11V31.356h-11v12.004Zm80 0h11V31.356h-11v12.004Z" />
				<path d="M330.175 41.279v16.983h17.201v19.476h-20.071V60.941h-47.989v13.931h34.031v19.849h-34.031v14.117h47.989V91.668h20.071v19.85h-17.201V128.5h-53.728v-16.796h-17.015V58.262h17.015V41.279h53.728Zm109.556 0v16.983h17.202V128.5h-20.072V60.941h-47.988V128.5h-19.885V41.279h70.743ZM507.771 7.5v33.779h51.232v19.662h-51.232v47.897h48.363V91.855h19.885v19.849h-17.016V128.5h-54.101v-16.796h-16.828V60.941h-17.015V41.279h17.015V7.5h19.697Zm147.142 0v101.338h47.988V7.5h20.072v104.204h-17.202V128.5h-53.727v-16.796h-17.015V7.5h19.884ZM798.5 7.5v19.85h-17.202v81.488H798.5V128.5h-53.914v-19.662h17.015V27.35h-17.015V7.5H798.5ZM256.444 44.146h-20.071V27.35h-13.959V128.5h-20.071V27.35h-13.958v16.796H168.5V24.98l.034-16.982V7.5h87.683l.007.493.22 16.984v19.169Z" />
			</g>
		</svg>
	);
}

function FooterFrame({ children }: { children: ReactNode }) {
	return (
		<div className="relative isolate mx-auto w-full px-2 lg:w-[calc(100%-4rem)] lg:border-primary-foreground/15 lg:border-x lg:border-dashed">
			<Grain className="hidden lg:block" />
			<GridMarker className="hidden lg:block" position="top-left" />
			<GridMarker className="hidden lg:block" position="top-right" />
			<GridMarker className="hidden lg:block" position="bottom-left" />
			<GridMarker className="hidden lg:block" position="bottom-right" />

			<div className="relative mx-auto w-full max-w-6xl border-primary-foreground/15 border-x border-dashed">
				{children}
				<GridMarker position="top-left" />
				<GridMarker position="top-right" />
				<GridMarker position="bottom-left" />
				<GridMarker position="bottom-right" />
			</div>
		</div>
	);
}

export default function Footer02({
	brandName = "TentUI",
	brandHref = "#",
	brandMark,
	copyright = "© 2026",
	linkGroups = DEFAULT_LINK_GROUPS,
	socialLinks = DEFAULT_SOCIAL_LINKS,
	wordmark,
	className,
}: Footer02Props) {
	return (
		<footer
			className={cn(
				"relative isolate w-full overflow-hidden bg-primary text-primary-foreground",
				className,
			)}
		>
			<Grain />
			<FooterFrame>
				<div className="flex flex-col divide-y divide-dashed divide-primary-foreground/15 md:flex-row md:divide-x md:divide-y-0">
					<div className="px-4 py-7 md:flex-1">
						<div className="flex items-center gap-2">
							<Link
								aria-label={`${brandName} home`}
								className="flex w-fit items-center gap-2"
								href={brandHref as Route}
							>
								{brandMark ?? <TentMark />}
								<span className="font-mono text-[12px] text-white tracking-tight">
									{brandName}
								</span>
							</Link>
							<span aria-hidden="true" className="text-primary-foreground/35">
								·
							</span>
							<span className="font-mono text-[12px] text-primary-foreground/65 tracking-tight">
								{copyright}
							</span>
						</div>
						<FooterLinkList links={socialLinks} />
					</div>

					{linkGroups.map((group) => (
						<nav
							aria-label={group.title}
							className="relative px-4 py-7 md:flex-1"
							key={group.title}
						>
							<GridMarker position="top-left" />
							<h2 className="font-mono text-[12px] tracking-tight">
								{group.title}
							</h2>
							<FooterLinkList links={group.links} />
						</nav>
					))}
				</div>

				{wordmark ?? <TentWordmark />}
			</FooterFrame>
		</footer>
	);
}
