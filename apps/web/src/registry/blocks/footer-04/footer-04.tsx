import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { RealisticEmboss } from "@/registry/components/realistic-emboss";

export interface Footer04Link {
	label: string;
	href: string;
	external?: boolean;
}

export interface Footer04LinkGroup {
	title: string;
	links: Footer04Link[];
}

export interface Footer04Props {
	brandName?: string;
	headline?: ReactNode;
	description?: ReactNode;
	cta?: Footer04Link;
	linkGroups?: Footer04LinkGroup[];
	/** Raw SVG markup passed to the embossed background. */
	logoSvg?: string;
	surfaceColor?: string;
	inkColor?: string;
	className?: string;
}

const DEFAULT_LOGO = `
<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
  <text x="300" y="164" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="176" font-weight="700" letter-spacing="-10" text-anchor="middle">Tent UI</text>
</svg>
`;

const DEFAULT_LINK_GROUPS: Footer04LinkGroup[] = [
	{
		title: "Explore",
		links: [
			{ label: "Components", href: "#" },
			{ label: "Blocks", href: "#" },
			{ label: "Changelog", href: "#" },
		],
	},
	{
		title: "Connect",
		links: [
			{ label: "GitHub", href: "#", external: true },
			{ label: "X / Twitter", href: "#", external: true },
			{ label: "Email", href: "mailto:hello@example.com", external: true },
		],
	},
];

function ArrowUpRight() {
	return (
		<svg
			aria-hidden="true"
			className="size-3"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.75"
			viewBox="0 0 16 16"
		>
			<path d="M4 12 12 4M6 4h6v6" />
		</svg>
	);
}

function FooterLink({ link }: { link: Footer04Link }) {
	return (
		<a
			className="inline-flex w-fit items-center gap-1.5 py-0.5 text-current/62 text-sm transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-current motion-reduce:transition-none"
			href={link.href}
			rel={link.external ? "noreferrer" : undefined}
			target={link.external ? "_blank" : undefined}
		>
			{link.label}
			{link.external ? <ArrowUpRight /> : null}
		</a>
	);
}

export default function Footer04({
	brandName = "Tent UI",
	headline = "Make something people remember.",
	description = "Open-source components and blocks for interfaces with a point of view.",
	cta = { label: "Browse the library", href: "#" },
	linkGroups = DEFAULT_LINK_GROUPS,
	logoSvg = DEFAULT_LOGO,
	surfaceColor = "#c9b99f",
	inkColor = "#29241d",
	className,
}: Footer04Props) {
	const colors = {
		"--footer-surface": surfaceColor,
		"--footer-ink": inkColor,
	} as CSSProperties;

	return (
		<footer className={cn("w-full p-2 sm:p-3", className)}>
			<div
				className="relative isolate min-h-[760px] overflow-hidden rounded-[2rem] bg-[var(--footer-surface)] text-[var(--footer-ink)] sm:rounded-[2.75rem]"
				style={colors}
			>
				<RealisticEmboss
					aria-label={`${brandName} wordmark`}
					className="absolute inset-5"
					color={surfaceColor}
					contentPosition={[0.5, 0.84]}
					contentScale={0.3}
					depth={1.28}
					grain={0.68}
					highlight={0.27}
					lightAltitude={24}
					shadow={0.36}
					size={2.2}
					soften={0.45}
					svg={logoSvg}
				/>

				<div className="relative flex min-h-[760px] flex-col px-5 pt-6 pb-60 sm:px-9 sm:pt-8 lg:px-12 lg:pt-10">
					<div className="grid grid-cols-1 gap-12 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.7fr)] lg:gap-20 lg:pt-20">
						<div className="flex max-w-2xl flex-col items-start gap-6">
							<h2 className="text-balance font-medium text-4xl leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
								{headline}
							</h2>
							<p className="max-w-md text-pretty text-base leading-relaxed opacity-62">
								{description}
							</p>
							<a
								className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-[var(--footer-ink)] px-5 font-medium text-[var(--footer-surface)] text-sm transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none"
								href={cta.href}
								rel={cta.external ? "noreferrer" : undefined}
								target={cta.external ? "_blank" : undefined}
							>
								{cta.label}
								<ArrowUpRight />
							</a>
						</div>

						<div className="grid grid-cols-2 gap-7 lg:justify-self-end lg:pr-8">
							{linkGroups.map((group) => (
								<nav aria-label={group.title} key={group.title}>
									<h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] opacity-48">
										{group.title}
									</h3>
									<ul className="flex flex-col gap-1.5">
										{group.links.map((link) => (
											<li key={`${link.label}-${link.href}`}>
												<FooterLink link={link} />
											</li>
										))}
									</ul>
								</nav>
							))}
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
