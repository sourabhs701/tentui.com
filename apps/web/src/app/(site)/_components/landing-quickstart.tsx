import type { Route } from "next";
import Link from "next/link";
import { registryConfig } from "@/config/registry";

const REGISTRY_SNIPPET = `{
  "registries": {
    "${registryConfig.namespace}": "${registryConfig.namespaceUrl}"
  }
}`;

const ADD_COMMAND = `npx shadcn@latest add ${registryConfig.namespace}/animated-arrow`;

function CodeSnippet({ children }: { children: string }) {
	return (
		<pre className="mt-3 overflow-x-auto rounded-xl border bg-muted px-4 py-3 font-mono text-[13px] text-foreground leading-relaxed">
			<code>{children}</code>
		</pre>
	);
}

export function LandingQuickstart({
	componentCount,
	blockCount,
}: {
	componentCount: number;
	blockCount: number;
}) {
	const features = [
		{
			title: `${componentCount} animated components`,
			body: "Buttons and toggles, inputs and pickers, menus and overlays, feedback and status, and text effects.",
		},
		{
			title: `${blockCount} landing-page blocks`,
			body: "Hero, pricing, FAQ, CTA, testimonial, footer, legal, and 404 sections.",
		},
		{
			title: "Source you own",
			body: "The CLI copies TypeScript and Tailwind CSS source into your project. There is no TentUI runtime package.",
		},
		{
			title: "Free and source-available",
			body: "Use it in unlimited personal and client projects under the TentUI License.",
			href: "/license",
		},
	];

	return (
		<section
			aria-labelledby="landing-quickstart-heading"
			className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 md:py-32"
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

			<div className="mt-12 rounded-[21px] border bg-muted p-0.5">
				<div className="grid gap-10 rounded-[19px] border bg-background px-5 py-8 sm:px-8 lg:grid-cols-2 lg:gap-12">
					<div>
						<h3 className="font-semibold text-lg tracking-tight">
							What you get
						</h3>
						<ul className="mt-4 space-y-4">
							{features.map((feature) => (
								<li key={feature.title}>
									<p className="font-medium">{feature.title}</p>
									<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
										{feature.body}
										{feature.href ? (
											<>
												{" "}
												<Link
													className="underline decoration-border underline-offset-4 hover:decoration-foreground"
													href={feature.href as Route}
												>
													Read the license
												</Link>
												.
											</>
										) : null}
									</p>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="font-semibold text-lg tracking-tight">
							Install with the shadcn CLI
						</h3>
						<ol className="mt-4 space-y-5 text-sm">
							<li>
								<p className="font-medium">
									1. Add the {registryConfig.namespace} registry to{" "}
									<code className="font-mono text-[13px]">components.json</code>
								</p>
								<CodeSnippet>{REGISTRY_SNIPPET}</CodeSnippet>
							</li>
							<li>
								<p className="font-medium">2. Add a component or block</p>
								<CodeSnippet>{ADD_COMMAND}</CodeSnippet>
							</li>
						</ol>
						<p className="mt-5 text-muted-foreground text-sm leading-relaxed">
							Works in any React or Next.js project with Tailwind CSS and{" "}
							<code className="whitespace-nowrap font-mono text-[13px]">
								npx shadcn@latest init
							</code>{" "}
							already run. See the{" "}
							<Link
								className="underline decoration-border underline-offset-4 hover:decoration-foreground"
								href="/docs/installation"
							>
								installation guide
							</Link>
							, or install from your AI editor with the{" "}
							<Link
								className="underline decoration-border underline-offset-4 hover:decoration-foreground"
								href="/docs/mcp"
							>
								MCP server
							</Link>
							.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
