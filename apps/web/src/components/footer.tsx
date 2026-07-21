import { RssIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { TentUiMark } from "@/components/tentui-mark";
import { blockCategories } from "@/config/registry";
import { cn } from "@/lib/utils";
import { components } from "@/registry/components/_registry";
import FooterBigLogo from "./footer-big-logo";
import Marker from "./marker";
import Section from "./section";

type FooterLink = {
	label: string;
	href: string;
	external?: boolean;
	icon?: React.ReactElement;
};

const componentLinks: FooterLink[] = components
	.slice(0, 10)
	.map((component) => ({
		label: component.title ?? component.name,
		href: `/components/${component.name}`,
	}));

const blockCategoryLinks: FooterLink[] = blockCategories.map((category) => ({
	label: category.title,
	href: `/blocks/${category.name}`,
}));

const legalLinks: FooterLink[] = [
	{ label: "License", href: "/license" },
	{ label: "Terms of Service", href: "/terms" },
	{ label: "Privacy", href: "/privacy" },
	{ label: "Copyright", href: "/copyright" },
];

const socialLinks: FooterLink[] = [
	{
		label: "X (formerly Twitter)",
		href: "https://x.com/srbcode",
		external: true,
	},
	{
		label: "RSS",
		href: "/rss",
		icon: <RssIcon className="size-3" aria-hidden="true" />,
	},
];

function ArrowUpRight() {
	return (
		<svg
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="inline-block size-2.5"
			aria-hidden="true"
		>
			<path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" />
		</svg>
	);
}

function LinkList({ links }: { links: FooterLink[] }) {
	return (
		<ul className="mt-5 space-y-1.5 font-mono text-[12px] text-primary-foreground/65 tracking-tight">
			{links.map((l) => (
				<li key={l.label}>
					<Link
						href={l.href as Route}
						{...(l.external
							? { target: "_blank", rel: "noreferrer" }
							: undefined)}
						className="inline-flex items-center gap-1 transition-colors hover:text-primary-foreground"
					>
						{l.icon}
						{l.label}
						{l.external && <ArrowUpRight />}
					</Link>
				</li>
			))}
		</ul>
	);
}

function Footer() {
	return (
		<footer className="relative isolate w-full overflow-hidden text-primary-foreground">
			<div aria-hidden="true" className="absolute inset-0 -z-20 bg-primary" />
			<Section line={false} borderClassName="border-primary-foreground/15">
				<Grain opacity={0.1} />
				<div className="flex flex-col divide-y divide-dashed divide-primary-foreground/15 md:flex-row md:divide-x md:divide-y-0">
					<div className="px-4 py-7 md:basis-1/4">
						<div className="flex items-center gap-2">
							<TentUiMark className="h-5 w-auto text-white" />
							<span className="font-mono text-[12px] text-white tracking-tight">
								TentUI
							</span>
							<span className="text-primary-foreground/35">&middot;</span>
							<span className="font-mono text-[12px] text-primary-foreground/65 tracking-tight">
								&copy; 2026
							</span>
						</div>
						<LinkList links={socialLinks} />
					</div>

					<div className="relative px-4 py-7 md:basis-1/4">
						<Marker position="top-left" />
						<h3 className="font-mono text-[12px] tracking-tight">Components</h3>
						<LinkList links={componentLinks} />
					</div>

					<div className="relative px-4 py-7 md:basis-1/4">
						<Marker position="top-left" />
						<h3 className="font-mono text-[12px] tracking-tight">
							Shadcn Compatible Blocks
						</h3>
						<LinkList links={blockCategoryLinks} />
					</div>

					<div className="relative px-4 py-7 md:basis-1/4">
						<Marker position="top-left" />
						<h3 className="font-mono text-[12px] tracking-tight">Legal</h3>
						<LinkList links={legalLinks} />
					</div>
				</div>
				<FooterBigLogo />
			</Section>
		</footer>
	);
}

export default Footer;

type GrainProps = {
	opacity?: number;
	className?: string;
};

const Grain = ({ opacity, className }: GrainProps) => {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"film-grain pointer-events-none absolute inset-0 -z-10",
				opacity === undefined && "opacity-[0.07] dark:opacity-[0.02]",
				className,
			)}
			style={opacity === undefined ? undefined : { opacity }}
		/>
	);
};
