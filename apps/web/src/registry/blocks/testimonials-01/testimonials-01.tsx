import type { ReactNode } from "react";
import { getTweet, type Tweet } from "react-tweet/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TestimonialAuthor {
	name: string;
	handle: string;
	avatarUrl?: string;
	verified?: boolean;
}

export interface TestimonialData {
	id: string;
	text: string;
	author: TestimonialAuthor;
}

export interface TestimonialSource {
	id: string;
	/** Placement in the bento grid (2 columns at `md`, 4 at `lg`), e.g. `md:col-span-2`. */
	className?: string;
	fallback?: Omit<TestimonialData, "id">;
}

export interface Testimonials01Props {
	title?: ReactNode;
	description?: ReactNode;
	testimonials?: readonly TestimonialSource[];
	className?: string;
	gridClassName?: string;
}

const DEFAULT_TESTIMONIALS = [
	{
		id: "2048474453227540522",
		className: "md:col-span-2",
		fallback: {
			text: "Very consistently looking design, well done :)",
			author: {
				name: "Jarek Avi",
				handle: "JarekAvi",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2009380291572326400/K1X7xiJd_normal.jpg",
				verified: true,
			},
		},
	},
	{
		id: "2049878647591551410",
		className: "md:col-span-1",
		fallback: {
			text: "cool",
			author: {
				name: "Gurbinder",
				handle: "legionsdev",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/1924504051728670720/mqyGd02m_normal.jpg",
				verified: true,
			},
		},
	},
	{
		id: "2037743266087756052",
		className: "md:col-span-1",
		fallback: {
			text: "Looks nice!",
			author: {
				name: "Archit",
				handle: "iarcI3",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2036806514640650240/YwsX6fu4_normal.jpg",
			},
		},
	},
	{
		id: "2036810028838252769",
		className: "md:col-span-2",
		fallback: {
			text: "Clean and fast exactly what we love",
			author: {
				name: "Rohit Girhe",
				handle: "rohit_girhe",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2010004686737420294/OgjQdz4G_normal.jpg",
			},
		},
	},
	{
		id: "2049014991836086285",
		className: "md:col-span-2",
		fallback: {
			text: "Looks smooth mate 🔥",
			author: {
				name: "Nikolass | Video Editor",
				handle: "NikolasDesignn",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/1615137125573300224/pgKmbZh2_normal.jpg",
				verified: true,
			},
		},
	},
	{
		id: "2078686529443316059",
		className: "md:col-span-2",
		fallback: {
			text: "Crazyyy components",
			author: {
				name: "vansh",
				handle: "vanshdevx",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2043464015289151488/GFtfUf9M_normal.jpg",
				verified: true,
			},
		},
	},
	{
		id: "2081023285505007821",
		className: "md:col-span-2",
		fallback: {
			text: "This is a badass library.",
			author: {
				name: "Coin Moebius",
				handle: "coinmoebius",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2063997511509975040/LE-0tfyw_200x200.jpg",
			},
		},
	},
] as const satisfies readonly TestimonialSource[];

const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

/** Strips leading @-replies, trailing t.co links and HTML entities from tweet text. */
function cleanText(text: string) {
	return text
		.replace(/^(@\w+\s+)+/, "")
		.replace(/(\s*https:\/\/t\.co\/\w+)+\s*$/, "")
		.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity])
		.trim();
}

function normalizeTweet(tweet: Tweet): TestimonialData {
	const { user } = tweet;

	return {
		id: tweet.id_str,
		text: cleanText(tweet.text),
		author: {
			name: user.name,
			handle: user.screen_name,
			avatarUrl: user.profile_image_url_https,
			verified: Boolean(
				user.verified || user.is_blue_verified || user.verified_type,
			),
		},
	};
}

async function resolveTestimonial(source: TestimonialSource) {
	const fallback = source.fallback
		? { ...source.fallback, id: source.id }
		: null;

	try {
		const tweet = await getTweet(source.id);
		return tweet ? normalizeTweet(tweet) : fallback;
	} catch {
		return fallback;
	}
}

function XLogo({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
		</svg>
	);
}

function VerifiedMark() {
	return (
		<svg
			aria-label="Verified account"
			className="size-3.5 shrink-0 text-[#1d9bf0]"
			fill="currentColor"
			role="img"
			viewBox="0 0 22 22"
		>
			<path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44C12.275 1.819 11.647 1.62 11 1.604c-.646.017-1.275.213-1.815.568s-.972.854-1.246 1.44c-.608-.223-1.264-.27-1.898-.14-.633.13-1.217.437-1.687.882-.445.47-.751 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.086.705-1.44 1.246-.354.54-.55 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.853.972 1.439 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.751 1.687.882.633.131 1.29.083 1.897-.14.274.587.705 1.086 1.246 1.44.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.439.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.751-1.053.882-1.687.13-.633.083-1.29-.14-1.897.587-.274 1.086-.705 1.44-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
		</svg>
	);
}

function initials(name: string) {
	return name
		.split(/\s+/)
		.map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

/** X serves `_normal` (48px) avatars by default; request a sharper 200px variant. */
function avatarSrc(url?: string) {
	return url?.replace(/_(normal|bigger|mini)(\.\w+)$/, "_200x200$2");
}

function AuthorAvatar({ author }: { author: TestimonialAuthor }) {
	const src = avatarSrc(author.avatarUrl);

	return (
		<Avatar size="lg">
			{src ? (
				<AvatarImage alt="" referrerPolicy="no-referrer" src={src} />
			) : null}
			<AvatarFallback className="font-medium text-xs">
				{initials(author.name)}
			</AvatarFallback>
		</Avatar>
	);
}

function Quote({ text }: { text: string }) {
	const length = [...text].length;

	return (
		<blockquote
			className={cn(
				"mt-auto text-pretty break-words -indent-[0.4em] font-serif text-foreground tracking-tight",
				length <= 14 && "text-[clamp(1.75rem,12cqi,2.25rem)] leading-[1.1]",
				length > 14 &&
					length <= 120 &&
					"text-[clamp(1.375rem,6.5cqi,2.25rem)] leading-[1.15]",
				length > 120 && "text-[clamp(1.125rem,4.5cqi,1.75rem)] leading-snug",
			)}
			data-slot="testimonial-quote"
		>
			<p>&ldquo;{text}&rdquo;</p>
		</blockquote>
	);
}

function TestimonialCard({
	testimonial,
	className,
}: {
	testimonial: TestimonialData;
	className?: string;
}) {
	const { author } = testimonial;
	const url = `https://x.com/${author.handle}/status/${testimonial.id}`;

	return (
		<Card
			className={cn(
				"group/testimonial @container/testimonial relative h-full min-h-44 transition-[box-shadow] duration-200 ease-out hover:ring-foreground/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring motion-reduce:transition-none md:min-h-56",
				className,
			)}
		>
			<CardContent className="flex flex-1 flex-col">
				<figure className="flex flex-1 flex-col gap-6">
					<figcaption className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-center gap-3">
							<AuthorAvatar author={author} />
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="flex min-w-0 items-center gap-1 font-medium text-foreground text-sm leading-tight">
									<span className="truncate">{author.name}</span>
									{author.verified ? <VerifiedMark /> : null}
								</span>
								<span className="truncate text-muted-foreground text-xs leading-tight">
									@{author.handle}
								</span>
							</div>
						</div>
						<a
							aria-label={`View @${author.handle}'s post on X (opens in a new tab)`}
							className="-m-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground outline-none transition-colors duration-200 ease-out after:absolute after:inset-0 after:rounded-xl hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/testimonial:text-foreground"
							href={url}
							rel="noopener noreferrer"
							target="_blank"
						>
							<XLogo className="size-4" />
						</a>
					</figcaption>
					<Quote text={testimonial.text} />
				</figure>
			</CardContent>
		</Card>
	);
}

export default async function Testimonials01({
	title = "Loved by thousands of people.",
	description = "Here’s what some of our users have to say.",
	testimonials = DEFAULT_TESTIMONIALS,
	className,
	gridClassName,
}: Testimonials01Props = {}) {
	const resolved = await Promise.all(
		testimonials.map(async (source) => ({
			source,
			testimonial: await resolveTestimonial(source),
		})),
	);
	const available = resolved.filter(
		(
			item,
		): item is {
			source: TestimonialSource;
			testimonial: TestimonialData;
		} => item.testimonial !== null,
	);

	if (available.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="testimonials-01-title"
			className={cn(
				"w-full bg-background px-4 py-16 font-sans text-foreground sm:px-6 sm:py-24 md:py-28",
				className,
			)}
		>
			<div className="mx-auto w-full max-w-6xl">
				<header className="mb-10 md:mb-14">
					<h2
						className="max-w-2xl text-balance font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
						id="testimonials-01-title"
					>
						{title}
					</h2>
					<p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
						{description}
					</p>
				</header>

				<ul
					className={cn(
						"grid grid-cols-1 gap-3 md:auto-rows-fr md:grid-cols-2 md:gap-4 lg:grid-cols-4",
						gridClassName,
					)}
				>
					{available.map(({ source, testimonial }) => (
						<li className={source.className} key={source.id}>
							<TestimonialCard testimonial={testimonial} />
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
