import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@tentui.com/ui/components/tabs";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeExternalLinks from "rehype-external-links";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { AutoTypeTable } from "./auto-type-table";
import { autoTypeTableGenerator } from "./auto-type-table-generator";
import { Callout } from "./callout";
import { mdxCodeBlockComponents } from "./code-block";
import { CodeTabs, TabsListInstallType } from "./code-tabs";
import { ComponentPreview } from "./component-preview";
import { ComponentSource } from "./component-source";
import { FramedImage, IframeEmbed, YouTubeEmbed } from "./embed";
import { Heading } from "./heading";
import {
	rehypeCodeRawString,
	rehypeComponent,
	rehypeHighlightCode,
	rehypeHighlightCodeRawString,
	rehypeNpmCommand,
	remarkCodeImport,
} from "./plugins";

const components: MDXRemoteProps["components"] = {
	h1: (props) => (
		<Heading
			as="h1"
			className="mt-10 mb-4 font-semibold text-3xl tracking-tight"
			{...props}
		/>
	),
	h2: (props) => (
		<Heading
			as="h2"
			className="mt-10 mb-4 font-semibold text-2xl tracking-tight"
			{...props}
		/>
	),
	h3: (props) => (
		<Heading
			as="h3"
			className="mt-8 mb-3 font-semibold text-xl tracking-tight"
			{...props}
		/>
	),
	h4: (props) => (
		<Heading as="h4" className="mt-6 mb-2 font-semibold text-lg" {...props} />
	),
	p: (props) => (
		<p className="my-4 text-muted-foreground leading-7" {...props} />
	),
	a: (props) => (
		<a
			className="underline decoration-border underline-offset-4 hover:decoration-foreground"
			{...props}
		/>
	),
	ul: (props) => (
		<ul
			className="my-4 list-disc space-y-2 pl-6 text-muted-foreground"
			{...props}
		/>
	),
	ol: (props) => (
		<ol
			className="my-4 list-decimal space-y-2 pl-6 text-muted-foreground"
			{...props}
		/>
	),
	blockquote: (props) => (
		<blockquote
			className="my-5 border-foreground/30 border-l-2 pl-4 text-muted-foreground"
			{...props}
		/>
	),
	table: (props) => (
		<div className="my-5 overflow-x-auto rounded-xl border">
			<table className="w-full text-left text-sm" {...props} />
		</div>
	),
	thead: (props) => (
		<thead className="border-border border-b bg-muted/50" {...props} />
	),
	tbody: (props) => <tbody className="divide-y divide-border" {...props} />,
	tr: (props) => <tr {...props} />,
	th: (props) => <th className="px-3 py-2 font-medium" {...props} />,
	td: (props) => <td className="px-3 py-2 text-muted-foreground" {...props} />,
	code: (props) => (
		<code
			className="rounded bg-transparent px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
			{...props}
		/>
	),
	...mdxCodeBlockComponents,
	ComponentPreview,
	ComponentSource,
	CodeTabs,
	Callout,
	Steps: ({ className, ...props }) => (
		<div
			className={cn("my-5 border-border border-l pl-5", className)}
			{...props}
		/>
	),
	Step: ({ className, ...props }) => (
		<h3
			className={cn("mt-6 mb-3 font-medium text-base", className)}
			{...props}
		/>
	),
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
	TabsListInstallType,
	YouTubeEmbed,
	IframeEmbed,
	FramedImage,
	AutoTypeTable: (props) => (
		<AutoTypeTable {...props} generator={autoTypeTableGenerator} />
	),
};

const options: MDXRemoteProps["options"] = {
	mdxOptions: {
		remarkPlugins: [remarkGfm, remarkCodeImport, remarkHeading],
		rehypePlugins: [
			[rehypeExternalLinks, { target: "_blank", rel: "nofollow noopener" }],
			rehypeSlug,
			rehypeComponent,
			rehypeCodeRawString,
			rehypeHighlightCode,
			rehypeHighlightCodeRawString,
			rehypeNpmCommand,
		],
	},
};

export function MDX({ code }: { code: string }) {
	return <MDXRemote source={code} components={components} options={options} />;
}
