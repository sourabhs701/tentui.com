import { unstable_cache } from "next/cache";

import { GitHubStars } from "@/components/github-stars";
import { GITHUB_REPOSITORY } from "@/config/site";
import { fetchStarCount } from "@/lib/github";

const getStargazerCount = unstable_cache(
	fetchStarCount,
	["github-stargazer-count"],
	{ revalidate: 86400 },
);

export async function NavItemGitHub() {
	const stargazersCount = await getStargazerCount();

	return (
		<GitHubStars repo={GITHUB_REPOSITORY} stargazersCount={stargazersCount} />
	);
}
