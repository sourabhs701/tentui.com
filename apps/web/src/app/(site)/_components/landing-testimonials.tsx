import { getTweet, type Tweet } from "react-tweet/api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type Testimonial, TestimonialWall, XLogo } from "./testimonial-wall";

interface TestimonialSource {
	/** The post id from x.com/<handle>/status/<id>. */
	id: string;
	/** Shown when the post can't be fetched (deleted, rate limited, offline). */
	fallback?: Omit<Testimonial, "id">;
}

// Add new posts here. The live post wins; the fallback covers deleted or unreachable posts.
const TESTIMONIALS: TestimonialSource[] = [
	{
		id: "2048474453227540522",
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
	{
		id: "2105187319460647126",
		fallback: {
			text: "This design looks really cool dude, good work.",
			author: {
				name: "Vedanth ♦︎ App Builder & Designer",
				handle: "vedanthk_",
				verified: true,
			},
		},
	},
	{
		id: "2105265890375995873",
		fallback: {
			text: "Great product storytelling",
			author: {
				name: "Kumuj | Organic Distribution",
				handle: "KumujJain",
				verified: true,
			},
		},
	},
	{
		id: "2113240878680809872",
		fallback: {
			text: "Nice little interaction!",
			author: {
				name: "Uriel Bitton",
				handle: "uriel_builds",
				verified: true,
			},
		},
	},
	{
		id: "2085338885895147762",
		fallback: {
			text: "Niiceeeeee🔥🔥🔥",
			author: {
				name: "lakshyaveer",
				handle: "Lakshyaveer_s",
				avatarUrl:
					"https://pbs.twimg.com/profile_images/2038003635091906560/YFuNPcRW_normal.jpg",
			},
		},
	},
];

const SHARE_URL = `https://x.com/intent/post?text=${encodeURIComponent(
	"Building with @srbcode's TentUI → https://tentui.com",
)}`;

// Drop leading @mentions and the trailing t.co link X appends to replies.
function cleanText(text: string) {
	return text
		.replace(/^(@\w+\s+)+/, "")
		.replace(/\s*https:\/\/t\.co\/\w+$/, "")
		.trim();
}

function normalizeTweet(tweet: Tweet): Testimonial {
	const { user } = tweet;

	return {
		id: tweet.id_str,
		text: cleanText(tweet.text),
		author: {
			name: user.name,
			handle: user.screen_name,
			avatarUrl: user.profile_image_url_https,
			verified: Boolean(user.is_blue_verified || user.verified),
		},
	};
}

async function resolveTestimonial(source: TestimonialSource) {
	const fallback = source.fallback
		? { ...source.fallback, id: source.id }
		: null;

	try {
		const tweet = await getTweet(source.id, { next: { revalidate: 86_400 } });
		const testimonial = tweet ? normalizeTweet(tweet) : null;
		return testimonial?.text ? testimonial : fallback;
	} catch {
		return fallback;
	}
}

export async function LandingTestimonials() {
	const resolved = await Promise.all(TESTIMONIALS.map(resolveTestimonial));
	const available = resolved.flatMap((testimonial) =>
		testimonial ? [testimonial] : [],
	);

	if (available.length === 0) return null;

	return (
		<section
			aria-labelledby="landing-testimonials-heading"
			className="mx-auto w-full max-w-6xl px-1 py-24 md:py-32"
		>
			<header className="flex flex-col items-center gap-3 text-center">
				<h2
					className="max-w-2xl text-balance font-bold text-2xl tracking-tight sm:text-3xl md:text-4xl"
					id="landing-testimonials-heading"
				>
					Loved by people who ship
				</h2>
				<p className="max-w-lg text-balance font-medium text-muted-foreground text-sm sm:text-base">
					Unfiltered words from builders using TentUI, straight from X.
				</p>
			</header>

			<div className="mt-12">
				<TestimonialWall testimonials={available} />
			</div>

			<div className="mt-4 flex flex-col items-center justify-between gap-4 rounded-[21px] border bg-muted px-4 py-3 sm:flex-row sm:pl-5">
				<p className="text-center font-semibold tracking-tight sm:text-left">
					Built something with TentUI?
				</p>
				<a
					className={cn(
						buttonVariants({ size: "lg" }),
						"gap-2 rounded-xl border-primary-foreground/20 px-4",
					)}
					href={SHARE_URL}
					rel="noreferrer"
					target="_blank"
				>
					<XLogo className="size-3.5" />
					Share it on X
				</a>
			</div>
		</section>
	);
}
