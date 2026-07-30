import type { Metadata } from "next";
import Section from "@/components/section";
import type { BlogPost } from "@/lib/documents";
import { getBlogPosts } from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";
import { BlogArchive } from "./_components/blog-archive";

export const dynamic = "force-static";
export const revalidate = false;

const TITLE = "React & shadcn/ui Guides";
const DESCRIPTION =
	"Practical guides to React and shadcn/ui components, accessible animation, async interaction states, and copy-paste interface blocks.";
const OG_IMAGE = `/og/simple?title=${encodeURIComponent(TITLE)}&description=${encodeURIComponent(DESCRIPTION)}`;

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/blog" },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: "/blog",
		type: "website",
		images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: [OG_IMAGE],
	},
};

function blogCollectionJsonLd(posts: BlogPost[]) {
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": absoluteUrl("/blog"),
		name: TITLE,
		description: DESCRIPTION,
		url: absoluteUrl("/blog"),
		mainEntity: {
			"@type": "ItemList",
			numberOfItems: posts.length,
			itemListElement: posts.map((post, index) => ({
				"@type": "ListItem",
				position: index + 1,
				name: post.metadata.title,
				url: absoluteUrl(`/blog/${post.slug}`),
			})),
		},
		isPartOf: { "@id": JSON_LD_ID.website },
	};
}

export default function BlogPage() {
	const posts = getBlogPosts();

	return (
		<div className="overflow-x-clip bg-background">
			<JsonLdScript data={blogCollectionJsonLd(posts)} />
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: "Blog", href: "/blog" },
				])}
			/>
			<Section line={false}>
				<header className="px-4 py-16 md:py-20">
					<h1
						className="max-w-2xl font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.02em] md:text-5xl"
						style={{ fontFamily: SERIF }}
					>
						React and shadcn/ui guides
					</h1>
					<p className="mt-5 max-w-xl text-[15px] text-muted-foreground leading-relaxed">
						{DESCRIPTION}
					</p>
				</header>

				<div className="pb-24">
					{posts.length > 0 ? (
						<BlogArchive posts={posts} />
					) : (
						<p className="py-24 text-center text-[14px] text-muted-foreground">
							No posts yet. Check back soon.
						</p>
					)}
				</div>
			</Section>
		</div>
	);
}
