#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const DEFAULTS = {
	baseUrl: "http://localhost:3001",
	cacheControl: "public, max-age=3600, must-revalidate",
	deviceScaleFactor: 4,
	outputDir: path.join(ROOT_DIR, ".media", "captures"),
	remote: "tentui:tentui/images",
	timeout: 30_000,
};

function printHelp() {
	console.log(`Export component images from the deterministic capture harness.

Usage:
  pnpm components:export [options]

Options:
  --component <slug>       Export one component; may be repeated
  --base-url <url>         Running web app (default: ${DEFAULTS.baseUrl})
  --output-dir <path>      Local image directory (default: .media/captures)
  --dpr <number>           Device pixel ratio (default: ${DEFAULTS.deviceScaleFactor})
  --timeout <ms>           Readiness timeout (default: ${DEFAULTS.timeout})
  --upload                 Upload exported images with rclone
  --remote <rclone-path>   Upload destination (default: ${DEFAULTS.remote})
  --cache-control <value>  Uploaded object Cache-Control metadata
  -h, --help               Show this help
`);
}

function parsePositiveNumber(value, flag) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) {
		throw new Error(`${flag} must be a positive number.`);
	}
	return number;
}

function getOptions(args) {
	const { values } = parseArgs({
		args,
		options: {
			"base-url": { type: "string", default: DEFAULTS.baseUrl },
			"cache-control": { type: "string", default: DEFAULTS.cacheControl },
			component: { type: "string", multiple: true, default: [] },
			dpr: { type: "string", default: String(DEFAULTS.deviceScaleFactor) },
			help: { type: "boolean", short: "h", default: false },
			"output-dir": { type: "string", default: DEFAULTS.outputDir },
			remote: { type: "string", default: DEFAULTS.remote },
			timeout: { type: "string", default: String(DEFAULTS.timeout) },
			upload: { type: "boolean", default: false },
		},
	});

	if (values.help) {
		printHelp();
		process.exit(0);
	}

	return {
		baseUrl: values["base-url"],
		cacheControl: values["cache-control"],
		components: values.component,
		deviceScaleFactor: parsePositiveNumber(values.dpr, "--dpr"),
		outputDir: path.resolve(ROOT_DIR, values["output-dir"]),
		remote: values.remote.replace(/\/$/, ""),
		timeout: parsePositiveNumber(values.timeout, "--timeout"),
		upload: values.upload,
	};
}

async function getCaptureManifest(baseUrl, timeout) {
	const signal = AbortSignal.timeout(timeout);
	const url = new URL("/capture/manifest", baseUrl);
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Capture manifest returned HTTP ${response.status}: ${url}`,
		);
	}

	const manifest = await response.json();
	if (
		!Array.isArray(manifest.components) ||
		!Array.isArray(manifest.themes) ||
		typeof manifest.frame?.width !== "number" ||
		typeof manifest.frame?.minHeight !== "number"
	) {
		throw new Error(`Invalid capture manifest: ${url}`);
	}

	return manifest;
}

async function launchBrowser() {
	try {
		return await chromium.launch();
	} catch {
		return chromium.launch({ channel: "chrome" });
	}
}

async function exportImage(browser, component, theme, manifest, options) {
	const context = await browser.newContext({
		colorScheme: theme,
		deviceScaleFactor: options.deviceScaleFactor,
		reducedMotion: "reduce",
		viewport: {
			height: manifest.frame.minHeight,
			width: manifest.frame.width,
		},
	});

	try {
		await context.addInitScript((selectedTheme) => {
			localStorage.setItem("theme", selectedTheme);
		}, theme);

		const page = await context.newPage();
		page.setDefaultTimeout(options.timeout);
		const url = new URL(
			`/capture/${encodeURIComponent(component)}/${theme}`,
			options.baseUrl,
		);
		const response = await page.goto(url.toString(), {
			waitUntil: "domcontentloaded",
		});
		if (!response?.ok()) {
			throw new Error(
				`Capture page returned HTTP ${response?.status()}: ${url}`,
			);
		}

		const stage = page.locator(
			`[data-component-capture="${component}"][data-capture-theme="${theme}"][data-capture-ready="true"]`,
		);
		await stage.waitFor({ state: "visible" });

		const filename = `${component}-${theme}.png`;
		const outputPath = path.join(options.outputDir, filename);
		const box = await stage.boundingBox();
		if (!box) throw new Error(`Capture stage has no bounding box: ${url}`);

		await stage.screenshot({
			caret: "hide",
			path: outputPath,
			scale: "device",
			type: "png",
		});

		return {
			filename,
			height: Math.round(box.height * options.deviceScaleFactor),
			outputPath,
			width: Math.round(box.width * options.deviceScaleFactor),
		};
	} finally {
		await context.close();
	}
}

function uploadImage(image, options) {
	execFileSync(
		"rclone",
		[
			"copyto",
			image.outputPath,
			`${options.remote}/${image.filename}`,
			"--metadata",
			"--metadata-set",
			`cache-control=${options.cacheControl}`,
			"--no-check-dest",
			"--s3-no-check-bucket",
		],
		{ stdio: "inherit" },
	);
}

async function main() {
	const options = getOptions(process.argv.slice(2));
	const captureManifest = await getCaptureManifest(
		options.baseUrl,
		options.timeout,
	);
	const components =
		options.components.length > 0
			? [...new Set(options.components)]
			: captureManifest.components;

	for (const component of components) {
		if (!captureManifest.components.includes(component)) {
			throw new Error(`Unknown component: ${component}`);
		}
	}

	await mkdir(options.outputDir, { recursive: true });
	const browser = await launchBrowser();
	const images = [];

	try {
		for (const component of components) {
			for (const theme of captureManifest.themes) {
				const image = await exportImage(
					browser,
					component,
					theme,
					captureManifest,
					options,
				);
				images.push(image);
				console.log(
					`Exported ${image.filename} (${image.width}x${image.height})`,
				);
			}
		}
	} finally {
		await browser.close();
	}

	if (options.upload) {
		for (const image of images) {
			uploadImage(image, options);
			console.log(`Uploaded ${image.filename}`);
		}
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
