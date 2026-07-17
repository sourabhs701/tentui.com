"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@tentui.com/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ParameterNode = {
	name: string;
	description?: ReactNode;
};

export type TypeNode = {
	description?: ReactNode;
	type: ReactNode;
	typeDescription?: ReactNode;
	typeDescriptionLink?: string;
	default?: ReactNode;
	required?: boolean;
	deprecated?: boolean;
	parameters?: ParameterNode[];
	example?: ReactNode;
	returns?: ReactNode;
};

export function TypeTable({
	id,
	type,
	className,
}: {
	id: string;
	type: Record<string, TypeNode>;
	className?: string;
}) {
	return (
		<div
			id={id}
			className={cn(
				"my-5 overflow-hidden rounded-xl border border-border bg-surface text-sm",
				className,
			)}
		>
			<div className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 border-border border-b px-4 py-3 font-medium text-muted-foreground">
				<span>Prop</span>
				<span>Type</span>
			</div>
			{Object.entries(type).map(([name, item]) => (
				<TypeTableItem key={name} name={name} item={item} />
			))}
		</div>
	);
}

function TypeTableItem({ name, item }: { name: string; item: TypeNode }) {
	return (
		<Collapsible className="border-border border-b last:border-b-0">
			<CollapsibleTrigger className="grid w-full grid-cols-[minmax(8rem,1fr)_2fr] items-center gap-4 px-4 py-3 text-left hover:bg-muted/50">
				<code
					className={cn(
						"font-mono text-foreground",
						item.deprecated && "line-through opacity-50",
					)}
				>
					{name}
					{!item.required ? "?" : ""}
				</code>
				<span className="flex items-center justify-between gap-3 text-muted-foreground">
					{item.type}
					<ChevronDownIcon className="size-4 transition-transform group-data-open:rotate-180" />
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="grid gap-3 border-border border-t px-4 py-4 text-sm">
					{item.description ? (
						<div className="text-muted-foreground">{item.description}</div>
					) : null}
					{item.typeDescription ? (
						<Definition label="Type">{item.typeDescription}</Definition>
					) : null}
					{item.default ? (
						<Definition label="Default">{item.default}</Definition>
					) : null}
					{item.parameters?.length ? (
						<Definition label="Parameters">
							<div className="space-y-2">
								{item.parameters.map((parameter) => (
									<div key={parameter.name}>
										<code>{parameter.name}</code>
										{parameter.description ? (
											<div className="mt-1 text-muted-foreground">
												{parameter.description}
											</div>
										) : null}
									</div>
								))}
							</div>
						</Definition>
					) : null}
					{item.example ? (
						<Definition label="Example">{item.example}</Definition>
					) : null}
					{item.returns ? (
						<Definition label="Returns">{item.returns}</Definition>
					) : null}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function Definition({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="grid grid-cols-[7rem_1fr] gap-3">
			<span className="text-muted-foreground">{label}</span>
			<div>{children}</div>
		</div>
	);
}
