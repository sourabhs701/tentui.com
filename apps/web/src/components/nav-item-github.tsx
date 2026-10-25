import { unstable_cache } from "next/cache";

import { GitHubStars } from "@/components/github-stars";
import { GITHUB_REPOSITORY } from "@/config/site";
import { fetchStarCount } from "@/lib/github";

// Fetched once at build time. A time-based revalidate here would turn every
// page that renders the header into ISR, so the Worker would re-render MDX,
// Shiki and type tables on demand. GitHubStars refreshes the count on the
// client from /api/github-stars instead.
const getStargazerCount = unstable_cache(
	fetchStarCount,
	["github-stargazer-count"],
	{ revalidate: false },
);

export async function NavItemGitHub() {
	const stargazersCount = await getStargazerCount();

	return (
		<GitHubStars repo={GITHUB_REPOSITORY} stargazersCount={stargazersCount} />
	);
}
