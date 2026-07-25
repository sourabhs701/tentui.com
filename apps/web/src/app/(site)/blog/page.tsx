import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/documents";
import { BlogArchive } from "./_components/blog-archive";

export const dynamic = "force-static";
export const revalidate = false;

const DESCRIPTION =
	"Notes on interaction design, component craft, and building interfaces that feel considered.";

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

export const metadata: Metadata = {
	title: "Blog",
	description: DESCRIPTION,
	alternates: { canonical: "/blog" },
	openGraph: {
		title: "TentUI Blog",
		description: DESCRIPTION,
		url: "/blog",
		type: "website",
	},
};

export default function BlogPage() {
	const posts = getBlogPosts();

	return (
		<div className="bg-background px-2">
			<header className="mx-auto w-full max-w-6xl">
				<div className="py-16 md:py-20">
					<h1
						className="max-w-2xl font-normal text-4xl text-foreground leading-[1.08] tracking-[-0.02em] md:text-5xl"
						style={{ fontFamily: SERIF }}
					>
						From the blog
					</h1>
					<p className="mt-5 max-w-xl text-[15px] text-muted-foreground leading-relaxed">
						{DESCRIPTION}
					</p>
				</div>
			</header>

			<div className="mx-auto w-full max-w-6xl pb-24">
				{posts.length > 0 ? (
					<BlogArchive posts={posts} />
				) : (
					<p className="py-24 text-center text-[14px] text-muted-foreground">
						No posts yet. Check back soon.
					</p>
				)}
			</div>
		</div>
	);
}
