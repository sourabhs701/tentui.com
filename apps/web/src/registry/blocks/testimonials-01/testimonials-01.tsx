import type { ReactNode } from "react";
import { getTweet, type Tweet } from "react-tweet/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { GlowCard } from "@/registry/components/glow-card";

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
	/** Controls this testimonial's placement in the bento grid. */
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
		id: "2036823885039988767",
		className: "md:col-span-2 md:row-span-2",
		fallback: {
			text: "learned sth from you here, thanks!! following your journey ... lets keep in touch and share more thoughts!!",
			author: {
				name: "Ehsan",
				handle: "acadictive",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/1996662487731560448/r6wo78NW_normal.jpg",
				verified: true,
			},
		},
	},
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
		id: "2021270463331102732",
		className: "md:col-span-2",
		fallback: {
			text: "Love this",
			author: {
				name: "Xtro UI/UX Designer",
				handle: "XtroUI",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2015194979761545216/rMAQ1dt1_normal.jpg",
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
] as const satisfies readonly TestimonialSource[];

const LEADING_MENTIONS = /^(@\w+\s+)+/;

function cleanText(text: string) {
	return text.replace(LEADING_MENTIONS, "").trim();
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
			aria-label="Verified"
			className="size-3.5 shrink-0 text-[#1d9bf0]"
			fill="currentColor"
			viewBox="0 0 22 22"
		>
			<path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44C12.275 1.819 11.647 1.62 11 1.604c-.646.017-1.275.213-1.815.568s-.972.854-1.246 1.44c-.608-.223-1.264-.27-1.898-.14-.633.13-1.217.437-1.687.882-.445.47-.751 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.086.705-1.44 1.246-.354.54-.55 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.853.972 1.439 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.751 1.687.882.633.131 1.29.083 1.897-.14.274.587.705 1.086 1.246 1.44.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.439.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.751-1.053.882-1.687.13-.633.083-1.29-.14-1.897.587-.274 1.086-.705 1.44-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
		</svg>
	);
}

function initials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function AuthorAvatar({ author }: { author: TestimonialAuthor }) {
	const avatarUrl = author.avatarUrl?.replace("_normal.", "_bigger.");

	return (
		<Avatar className="size-9">
			{avatarUrl ? <AvatarImage alt={author.name} src={avatarUrl} /> : null}
			<AvatarFallback className="bg-foreground font-mono text-[11px] text-background">
				{initials(author.name)}
			</AvatarFallback>
		</Avatar>
	);
}

function Quote({ text }: { text: string }) {
	const wordCount = text.split(/\s+/).length;
	const isShort = wordCount <= 2;
	const isLong = wordCount > 18;
	const punctuated = /[.!?]$/.test(text) ? text : `${text}.`;

	return (
		<div
			className="flex flex-1 items-center py-2"
			data-slot="testimonial-quote-wrapper"
		>
			<blockquote
				className={cn(
					"text-pretty font-serif text-foreground tracking-tight",
					isShort &&
						"mx-auto text-center text-[clamp(3rem,12cqi,4.5rem)] italic leading-none",
					!isShort &&
						!isLong &&
						"text-[clamp(1.0625rem,5cqi,3rem)] leading-[1.12]",
					isLong && "text-[clamp(1.0625rem,3.5cqi,2rem)] leading-[1.2]",
				)}
				data-slot="testimonial-quote"
			>
				{isShort ? punctuated : <>&ldquo;{text}&rdquo;</>}
			</blockquote>
		</div>
	);
}

function TestimonialCard({ testimonial }: { testimonial: TestimonialData }) {
	const { author } = testimonial;
	const url = `https://x.com/${author.handle}/status/${testimonial.id}`;

	return (
		<a
			aria-label={`Read @${author.handle}'s post on X`}
			className="group/card block h-full rounded-xl transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995] motion-reduce:transition-none"
			href={url}
			rel="noreferrer"
			target="_blank"
		>
			<GlowCard className="h-full">
				<Card className="@container/testimonial h-full gap-5 rounded-[inherit] bg-card py-0 shadow-none ring-0">
					<CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
						<div className="flex min-w-0 items-center gap-3">
							<AuthorAvatar author={author} />
							<div className="flex min-w-0 flex-col leading-tight">
								<CardTitle className="flex items-center gap-1 font-medium font-sans text-sm leading-tight">
									<span className="truncate">{author.name}</span>
									{author.verified ? <VerifiedMark /> : null}
								</CardTitle>
								<CardDescription className="truncate font-mono text-[11px] leading-tight">
									@{author.handle}
								</CardDescription>
							</div>
						</div>
						<XLogo className="size-4 shrink-0 text-muted-foreground/70 transition-colors duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:text-foreground" />
					</CardHeader>

					<CardContent className="flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
						<Quote text={testimonial.text} />
					</CardContent>
				</Card>
			</GlowCard>
		</a>
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
			className={cn(
				"w-full bg-background px-2 py-20 font-sans sm:py-24 md:px-6 md:py-28",
				className,
			)}
		>
			<div className="mx-auto w-full max-w-6xl">
				<header className="px-4 pb-12 md:px-2">
					<h2 className="max-w-2xl text-balance font-serif text-4xl text-foreground leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
						{title}
					</h2>
					<p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
						{description}
					</p>
				</header>

				<div
					className={cn(
						"grid grid-cols-1 gap-2 px-2 md:auto-rows-[minmax(220px,1fr)] md:grid-cols-4 md:gap-1",
						gridClassName,
					)}
				>
					{available.map(({ source, testimonial }) => (
						<div className={source.className} key={source.id}>
							<TestimonialCard testimonial={testimonial} />
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
