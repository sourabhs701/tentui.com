import type { Route } from "next";
import Link from "next/link";

import type { ComponentGroup } from "./component-groups";

// Plain server-rendered links to every component docs page, grouped by
// interaction, so each page is reachable without running client code.
export function ComponentsDirectory({ groups }: { groups: ComponentGroup[] }) {
	return (
		<section
			aria-labelledby="browse-by-interaction"
			className="mb-12 border-line border-t px-2 pt-10"
		>
			<h2
				id="browse-by-interaction"
				className="text-balance font-medium text-2xl tracking-tight"
			>
				Browse components by interaction
			</h2>

			<div className="mt-8 grid gap-10 md:grid-cols-2">
				{groups.map((group) => (
					<section key={group.id} aria-labelledby={group.id}>
						<h3 id={group.id} className="font-medium text-lg">
							{group.title}
						</h3>
						<p className="mt-1 text-pretty text-muted-foreground text-sm">
							{group.description}
						</p>
						<ul className="mt-4 space-y-1">
							{group.components.map((component) => (
								<li key={component.name}>
									<Link
										href={`/components/${component.name}` as Route}
										className="-mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
									>
										<span className="block font-medium text-foreground text-sm">
											{component.title ?? component.name}
										</span>
										{component.description ? (
											<span className="mt-0.5 line-clamp-2 block text-pretty text-muted-foreground text-sm">
												{component.description}
											</span>
										) : null}
									</Link>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</section>
	);
}
