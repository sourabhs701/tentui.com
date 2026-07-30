import "server-only";

import { env } from "@tentui.com/env/web";
import { GITHUB_REPOSITORY } from "@/config/site";

export async function fetchGitHubStargazerCount(revalidate?: number) {
	try {
		const response = await fetch(
			`https://api.github.com/repos/${GITHUB_REPOSITORY}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${env.GITHUB_API_TOKEN}`,
					"X-GitHub-Api-Version": "2026-03-10",
				},
				...(revalidate === undefined ? {} : { next: { revalidate } }),
			},
		);

		if (!response.ok) return 0;

		const json = (await response.json()) as { stargazers_count?: number };
		return Number(json.stargazers_count) || 0;
	} catch {
		return 0;
	}
}
