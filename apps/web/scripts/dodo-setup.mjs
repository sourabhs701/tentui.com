#!/usr/bin/env node
// Sets up Dodo Payments for sponsor slots, so checkout works end to end.
//
//   pnpm --dir apps/web run dodo:setup --mode test   # local dev
//   pnpm --dir apps/web run dodo:setup --mode live   # production
//
// Both modes find or create the two subscription products (tagged
// `metadata.site = tentui.com`), so running it again changes nothing.
//
// test: writes the key and product ids to packages/env/.env, which `next dev`
//       loads. No webhook: /sponsor/thanks books the slot via
//       /api/sponsor/confirm. Pass --webhook-url <public url> to add one.
// live: finds or creates the webhook at https://tentui.com/api/sponsor/webhook
//       and pipes every value into `wrangler secret bulk` for the tent-web
//       Worker. Uses the Cloudflare credentials in packages/env/.env.prod.
//
// The API key comes from DODO_PAYMENTS_API_KEY or a hidden prompt. Create it
// in Dodo → Developer → API Keys (in the matching mode) with write access to
// Products, Subscriptions, Customers, Checkout Sessions and Webhooks.
// Secrets are never printed.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envDir = resolve(webDir, "../../packages/env");

const SITE = "tentui.com";
const LIVE_WEBHOOK_URL = "https://tentui.com/api/sponsor/webhook";
const WEBHOOK_EVENTS = [
	"subscription.active",
	"subscription.renewed",
	"subscription.on_hold",
	"subscription.cancelled",
	"subscription.expired",
	"subscription.failed",
];

// Keep in step with SPONSOR_PLACEMENTS in src/config/sponsor.ts.
const PRODUCTS = {
	header: {
		env: "DODO_PRODUCT_HEADER_ID",
		name: "TentUI Sponsor: Top bar",
		description:
			"Your logo in the bar at the top of every page on tentui.com. Billed monthly.",
		cents: 1900,
	},
	feed: {
		env: "DODO_PRODUCT_FEED_ID",
		name: "TentUI Sponsor: Feed card",
		description:
			"Your image in the first rows of tentui.com/components. Billed monthly.",
		cents: 2900,
	},
};

const { values: args } = parseArgs({
	options: {
		mode: { type: "string" },
		"webhook-url": { type: "string" },
	},
});
const mode = args.mode;
if (mode !== "test" && mode !== "live") {
	fail("Pass --mode test or --mode live.");
}
const baseUrl =
	mode === "live"
		? "https://live.dodopayments.com"
		: "https://test.dodopayments.com";
const webhookUrl =
	args["webhook-url"] ?? (mode === "live" ? LIVE_WEBHOOK_URL : null);

const apiKey =
	process.env.DODO_PAYMENTS_API_KEY?.trim() ||
	(await promptHidden(`Dodo ${mode} API key: `));
if (!apiKey) fail("No API key given.");

async function dodo(method, path, body) {
	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		fail(`Dodo ${method} ${path} failed: ${response.status} ${detail}`);
	}
	return response.json();
}

// ─── Products ─────────────────────────────────────────────────────────────

const secrets = {
	DODO_PAYMENTS_ENVIRONMENT: mode === "live" ? "live_mode" : "test_mode",
	DODO_PAYMENTS_API_KEY: apiKey,
};

const { items: existing } = await dodo("GET", "/products?page_size=100");
for (const [placement, product] of Object.entries(PRODUCTS)) {
	let found = existing.find(
		(item) =>
			item.metadata?.site === SITE && item.metadata?.placement === placement,
	);
	if (found) {
		const cents = found.price?.price ?? found.price;
		if (cents !== product.cents) {
			console.warn(
				`! ${found.product_id} costs ${cents} cents, expected ${product.cents}. Fix it in Dodo.`,
			);
		}
		console.log(`✓ ${product.name}: ${found.product_id} (existing)`);
	} else {
		found = await dodo("POST", "/products", {
			name: product.name,
			description: product.description,
			tax_category: "digital_products",
			price: {
				type: "recurring_price",
				currency: "USD",
				price: product.cents,
				discount: 0,
				purchasing_power_parity: false,
				payment_frequency_count: 1,
				payment_frequency_interval: "Month",
				subscription_period_count: 20,
				subscription_period_interval: "Year",
				tax_inclusive: false,
			},
			metadata: { site: SITE, placement },
		});
		console.log(`✓ ${product.name}: ${found.product_id} (created)`);
	}
	secrets[product.env] = found.product_id;
}

// ─── Webhook ──────────────────────────────────────────────────────────────

if (webhookUrl) {
	const { data: hooks } = await dodo("GET", "/webhooks");
	let hook = hooks.find((item) => item.url === webhookUrl);
	if (hook) {
		console.log(`✓ Webhook ${hook.id} → ${webhookUrl} (existing)`);
	} else {
		hook = await dodo("POST", "/webhooks", {
			url: webhookUrl,
			description: "tentui.com sponsor slots",
			filter_types: WEBHOOK_EVENTS,
		});
		console.log(`✓ Webhook ${hook.id} → ${webhookUrl} (created)`);
	}
	const { secret } = await dodo("GET", `/webhooks/${hook.id}/secret`);
	secrets.DODO_PAYMENTS_WEBHOOK_KEY = secret;
}

// ─── Save ─────────────────────────────────────────────────────────────────

if (mode === "test") {
	const file = resolve(envDir, ".env");
	writeEnvFile(file, secrets);
	console.log(`✓ Wrote ${Object.keys(secrets).join(", ")} to ${file}`);
	console.log("Restart `pnpm dev` to pick them up.");
} else {
	await putWorkerSecrets(secrets);
	console.log(
		`✓ Set ${Object.keys(secrets).join(", ")} on the tent-web Worker.`,
	);
	console.log("Check: curl -X POST https://tentui.com/api/sponsor/webhook");
	console.log("       should answer 401 (signature), not 503.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function writeEnvFile(file, entries) {
	let text = existsSync(file) ? readFileSync(file, "utf8") : "";
	for (const [key, value] of Object.entries(entries)) {
		const line = `${key}=${value}`;
		const pattern = new RegExp(`^${key}=.*$`, "m");
		text = pattern.test(text)
			? text.replace(pattern, line)
			: `${text.replace(/\n*$/, "\n")}${line}\n`;
	}
	writeFileSync(file, text, { mode: 0o600 });
}

function putWorkerSecrets(entries) {
	const prodEnv = resolve(envDir, ".env.prod");
	const env = { ...process.env };
	if (existsSync(prodEnv)) {
		for (const line of readFileSync(prodEnv, "utf8").split("\n")) {
			const match = line.match(/^(CLOUDFLARE_[A-Z_]+)=(.*)$/);
			if (match) env[match[1]] ??= match[2];
		}
	}
	return new Promise((resolvePromise, reject) => {
		const child = spawn("pnpm", ["exec", "wrangler", "secret", "bulk"], {
			cwd: webDir,
			env,
			stdio: ["pipe", "inherit", "inherit"],
		});
		child.stdin.end(JSON.stringify(entries));
		child.on("error", reject);
		child.on("exit", (code) =>
			code === 0
				? resolvePromise()
				: reject(new Error(`wrangler secret bulk exited with ${code}`)),
		);
	});
}

function promptHidden(question) {
	if (!stdin.isTTY) {
		return new Promise((resolvePromise) => {
			let data = "";
			stdin.setEncoding("utf8");
			stdin.on("data", (chunk) => {
				data += chunk;
			});
			stdin.on("end", () => resolvePromise(data.trim()));
		});
	}
	stdout.write(question);
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding("utf8");
	return new Promise((resolvePromise) => {
		let value = "";
		// A paste arrives as one chunk, so walk it a character at a time.
		const onData = (chunk) => {
			for (const char of chunk) {
				if (char === "\r" || char === "\n" || char === "\u0004") {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.off("data", onData);
					stdout.write("\n");
					resolvePromise(value.trim());
					return;
				}
				if (char === "\u0003") {
					stdout.write("\n");
					process.exit(130);
				}
				if (char === "\u007f") value = value.slice(0, -1);
				else if (char >= " ") value += char;
			}
		};
		stdin.on("data", onData);
	});
}

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}
