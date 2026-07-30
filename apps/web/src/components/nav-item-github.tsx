import { unstable_cache } from "next/cache";

import { GitHubStars } from "@/components/github-stars";
import { GITHUB_REPOSITORY } from "@/config/site";
import { fetchGitHubStargazerCount } from "@/lib/github";

const getStargazerCount = unstable_cache(fetchGitHubStargazerCount, [
	"github-stargazer-count",
]);

export async function NavItemGitHub() {
	const stargazersCount = await getStargazerCount();

	return (
		<GitHubStars repo={GITHUB_REPOSITORY} stargazersCount={stargazersCount} />
	);
}
