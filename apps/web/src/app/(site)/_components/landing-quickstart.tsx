import {
	ArrowUpRight,
	BookOpen,
	FileCode2,
	LayoutTemplate,
	type LucideIcon,
	Scale,
	Sparkles,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { registryConfig } from "@/config/registry";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/registry/components/copy-button/copy-button";

const REGISTRY_SNIPPET = `{
  "registries": {
    "${registryConfig.namespace}": "${registryConfig.namespaceUrl}"
  }
}`;

const ADD_COMMAND = `npx shadcn@latest add ${registryConfig.namespace}/animated-arrow`;

type Feature = {
	icon: LucideIcon;
	title: string;
	body: string;
	href?: Route;
	linkLabel?: string;
};

function FeatureCard({ feature }: { feature: Feature }) {
	const { icon: Icon, title, body, href, linkLabel } = feature;

	const content = (
		<div className="flex h-full flex-col gap-8 rounded-[19px] border bg-background p-5">
			<div className="flex items-start justify-between gap-3">
				<span className="flex size-10 items-center justify-center rounded-xl border bg-muted text-primary">
					<Icon aria-hidden="true" className="size-5" />
				</span>
				{href ? (
					<ArrowUpRight
						aria-hidden="true"
						className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
					/>
				) : null}
			</div>
			<div>
				<h3 className="font-semibold text-lg tracking-tight">{title}</h3>
				<p className="mt-1.5 text-pretty text-muted-foreground text-sm leading-relaxed">
					{body}
				</p>
			</div>
		</div>
	);

	const shellClassName = "rounded-[21px] border bg-muted p-0.5";

	if (!href) return <li className={shellClassName}>{content}</li>;

	return (
		<li className="flex">
			<Link
				aria-label={linkLabel ? `${title}: ${linkLabel}` : title}
				className={cn(
					shellClassName,
					"group w-full transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
				)}
				href={href}
			>
				{content}
			</Link>
		</li>
	);
}

function CodeSnippet({ code, label }: { code: string; label: string }) {
	return (
		<div className="group/code relative mt-3 overflow-hidden rounded-xl border bg-muted">
			<div className="flex h-9 items-center justify-between border-b pr-1 pl-3.5">
				<span className="font-mono text-muted-foreground text-xs">{label}</span>
				<CopyButton
					aria-label={`Copy ${label}`}
					className="size-7 rounded-md text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5"
					size="icon-xs"
					text={code}
					variant="ghost"
				/>
			</div>
			<pre className="overflow-x-auto overscroll-x-contain px-4 py-3.5 font-mono text-[13px] text-foreground leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}

function Step({
	number,
	title,
	children,
}: {
	number: number;
	title: ReactNode;
	children: ReactNode;
}) {
	return (
		<li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0">
			{/* Connector between step badges; hidden after the final step. */}
			<span
				aria-hidden="true"
				className="absolute top-10 bottom-2 left-4 w-px -translate-x-1/2 bg-border [li:last-child>&]:hidden"
			/>
			<span className="relative flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-sm tabular-nums">
				{number}
			</span>
			<div className="min-w-0 pt-1">
				<h4 className="font-semibold tracking-tight">{title}</h4>
				{children}
			</div>
		</li>
	);
}

export function LandingQuickstart({
	componentCount,
	blockCount,
}: {
	componentCount: number;
	blockCount: number;
}) {
	const features: Feature[] = [
		{
			icon: Sparkles,
			title: `${componentCount} animated components`,
			body: "Buttons and toggles, inputs and pickers, menus and overlays, feedback and status, and text effects.",
			href: "/components",
			linkLabel: "Browse components",
		},
		{
			icon: LayoutTemplate,
			title: `${blockCount} landing-page blocks`,
			body: "Hero, pricing, FAQ, CTA, testimonial, footer, legal, and 404 sections.",
			href: "/blocks" as Route,
			linkLabel: "Browse blocks",
		},
		{
			icon: FileCode2,
			title: "Source you own",
			body: "The CLI copies TypeScript and Tailwind CSS source into your project. There is no TentUI runtime package.",
		},
		{
			icon: Scale,
			title: "Free and source-available",
			body: "Use it in unlimited personal and client projects under the TentUI License.",
			href: "/license" as Route,
			linkLabel: "Read the license",
		},
	];

	return (
		<section
			aria-labelledby="landing-quickstart-heading"
			className="mx-auto w-full max-w-6xl px-1 py-24 md:py-32"
		>
			<header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
				<h2
					className="text-balance font-bold text-2xl tracking-tight sm:text-3xl md:text-4xl"
					id="landing-quickstart-heading"
				>
					What you get and how to install it
				</h2>
				<p className="max-w-lg text-balance font-medium text-muted-foreground text-sm sm:text-base">
					TentUI is a shadcn registry. Point the shadcn CLI at it once, then add
					components and blocks by name.
				</p>
			</header>

			<ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{features.map((feature) => (
					<FeatureCard feature={feature} key={feature.title} />
				))}
			</ul>

			<div className="mt-4 rounded-[21px] border bg-muted p-0.5">
				<div className="grid rounded-[19px] border bg-background lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
					<div className="flex flex-col p-6 sm:p-8">
						<h3 className="text-balance font-bold text-xl tracking-tight sm:text-2xl">
							Install with the shadcn CLI
						</h3>
						<p className="mt-3 text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
							Works in any React or Next.js project with Tailwind CSS and{" "}
							<code className="whitespace-nowrap rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
								npx shadcn@latest init
							</code>{" "}
							already run.
						</p>

						<div className="mt-8 flex flex-wrap gap-2 lg:mt-auto lg:pt-8">
							<Link
								className={cn(
									buttonVariants({ variant: "outline", size: "lg" }),
									"gap-2 rounded-xl px-4",
								)}
								href="/docs/installation"
							>
								<BookOpen aria-hidden="true" />
								Installation guide
							</Link>
							<Link
								className={cn(
									buttonVariants({ variant: "ghost", size: "lg" }),
									"gap-1.5 rounded-xl px-4",
								)}
								href="/docs/mcp"
							>
								Use the MCP server
								<ArrowUpRight aria-hidden="true" />
							</Link>
						</div>
					</div>

					<ol className="border-t p-6 sm:p-8 lg:border-t-0 lg:border-l">
						<Step
							number={1}
							title={
								<>
									Add the {registryConfig.namespace} registry to{" "}
									<code className="font-mono text-[0.9em]">
										components.json
									</code>
								</>
							}
						>
							<CodeSnippet code={REGISTRY_SNIPPET} label="components.json" />
						</Step>
						<Step number={2} title="Add a component or block">
							<CodeSnippet code={ADD_COMMAND} label="Terminal" />
						</Step>
					</ol>
				</div>
			</div>
		</section>
	);
}
