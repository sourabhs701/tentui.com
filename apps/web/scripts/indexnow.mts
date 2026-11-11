// Submits tentui.com URLs to IndexNow (Bing, Yandex, Seznam, Naver, ...).
//
//   pnpm --dir apps/web run indexnow                        # dry run: every sitemap URL
//   pnpm --dir apps/web run indexnow --since 2026-11-11     # dry run: changed since a date
//   pnpm --dir apps/web run indexnow /components/otp-field  # dry run: explicit URLs
//   pnpm --dir apps/web run indexnow --since 2026-11-11 --submit
//
// Dry run is the default and only prints the payload. Pass --submit to POST
// it to https://api.indexnow.org/indexnow, after the deploy that changed the
// pages is live. --sitemap takes another sitemap URL or a local file, such as
// the build output at .next/server/app/sitemap.xml.body.
//
// The key comes from --key, then INDEXNOW_KEY, then the single key file in
// public/. Whichever is used, public/<key>.txt must exist and contain the key,
// because search engines fetch https://tentui.com/<key>.txt to verify it.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SITE_URL = "https://tentui.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH_SIZE = 10_000;
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		submit: { type: "boolean", default: false },
		"dry-run": { type: "boolean", default: false },
		sitemap: { type: "string", default: SITEMAP_URL },
		since: { type: "string" },
		key: { type: "string" },
		help: { type: "boolean", short: "h", default: false },
	},
});

if (values.help) {
	console.log(
		"Usage: indexnow [urls...] [--sitemap <url|file>] [--since <date>] [--key <key>] [--submit]",
	);
	process.exit(0);
}

if (values.submit && values["dry-run"]) {
	fail("Pass either --submit or --dry-run, not both.");
}

const key = getKey();
const host = new URL(SITE_URL).host;
const urls = positionals.length
	? positionals.map((url) => new URL(url, SITE_URL).toString())
	: await getSitemapUrls(values.sitemap, values.since);
const urlList = [...new Set(urls)].filter((url) => {
	if (new URL(url).host === host) return true;
	console.warn(`Skipping ${url}: not on ${host}`);
	return false;
});

if (urlList.length === 0) {
	console.log("No URLs to submit.");
	process.exit(0);
}

for (let start = 0; start < urlList.length; start += BATCH_SIZE) {
	const payload = {
		host,
		key,
		keyLocation: `${SITE_URL}/${key}.txt`,
		urlList: urlList.slice(start, start + BATCH_SIZE),
	};

	if (!values.submit) {
		console.log(JSON.stringify(payload, null, 2));
		continue;
	}

	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(payload),
	});
	// 200: accepted. 202: accepted, key verification pending.
	// 403: key file missing or different. 422: URLs outside the host.
	console.log(
		`IndexNow ${response.status} ${response.statusText} for ${payload.urlList.length} URLs`,
	);
	if (!response.ok) {
		console.error(await response.text());
		process.exit(1);
	}
}

if (!values.submit) {
	console.log(
		`\nDry run: ${urlList.length} URLs, nothing sent. Pass --submit to send.`,
	);
}

function getKey() {
	const key =
		values.key ??
		process.env.INDEXNOW_KEY ??
		(() => {
			const files = readdirSync(publicDir).filter((file) =>
				/^[a-f0-9]{32}\.txt$/.test(file),
			);
			if (files.length !== 1) {
				fail(
					`Expected one IndexNow key file in public/, found ${files.length}. Set INDEXNOW_KEY.`,
				);
			}
			return files[0].slice(0, -".txt".length);
		})();

	if (!KEY_PATTERN.test(key)) {
		fail("The IndexNow key must be 8-128 letters, digits, or dashes.");
	}

	let contents: string;
	try {
		contents = readFileSync(resolve(publicDir, `${key}.txt`), "utf8");
	} catch {
		fail(`public/${key}.txt is missing. Add it and deploy before submitting.`);
	}
	if (contents.trim() !== key) {
		fail(`public/${key}.txt must contain exactly the key.`);
	}

	return key;
}

async function getSitemapUrls(source: string, since: string | undefined) {
	const xml = /^https?:\/\//.test(source)
		? await fetchText(source)
		: readFileSync(resolve(source), "utf8");
	const sinceDate = since ? new Date(since) : undefined;
	if (sinceDate && Number.isNaN(sinceDate.getTime())) {
		fail(`Invalid --since date: ${since}`);
	}

	const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
		([, entry]) => ({
			loc: decodeXml(entry.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? ""),
			lastmod: entry.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1],
		}),
	);

	return entries
		.filter(({ loc, lastmod }) => {
			if (!loc) return false;
			// Entries without a lastmod can't prove they changed, so --since skips them.
			if (!sinceDate) return true;
			return lastmod !== undefined && new Date(lastmod) >= sinceDate;
		})
		.map(({ loc }) => loc);
}

async function fetchText(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		fail(`GET ${url} returned ${response.status} ${response.statusText}`);
	}
	return response.text();
}

function decodeXml(value: string) {
	return value
		.trim()
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&apos;", "'")
		.replaceAll("&amp;", "&");
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}
