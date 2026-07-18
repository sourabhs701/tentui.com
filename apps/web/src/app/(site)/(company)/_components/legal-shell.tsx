export type Clause = {
	title: string;
	body: React.ReactNode;
};

export function ClauseList({ clauses }: { clauses: Clause[] }) {
	return (
		<ol className="mt-10 space-y-10">
			{clauses.map((clause, index) => (
				<li key={clause.title} className="scroll-mt-20">
					<h2 className="font-semibold text-[15px] text-foreground tracking-tight">
						<span className="mr-3 text-muted-foreground tabular-nums">
							{String(index + 1).padStart(2, "0")}
						</span>
						{clause.title}
					</h2>
					<div className="mt-3 ml-9 space-y-3 text-[14px] text-muted-foreground leading-relaxed">
						{clause.body}
					</div>
				</li>
			))}
		</ol>
	);
}

export function ContactBlock({
	subject,
	description,
}: {
	subject: string;
	description: string;
}) {
	const href = `mailto:srb@tentui.com?subject=${encodeURIComponent(subject)}`;
	return (
		<section className="mt-16 border-border border-t pt-8">
			<h2 className="font-semibold text-[15px] text-foreground tracking-tight">
				Contact
			</h2>
			<p className="mt-3 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
				{description}{" "}
				<a
					href={href}
					className="text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
				>
					srb@tentui.com
				</a>
				.
			</p>
		</section>
	);
}

export function DocumentMeta({ updated }: { updated: string }) {
	return (
		<p className="mt-3 text-[12px] text-muted-foreground">
			Last updated {updated}
		</p>
	);
}
