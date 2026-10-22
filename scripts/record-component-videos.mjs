#!/usr/bin/env node

// Render component preview videos frame by frame from the capture harness.
//
// Every frame advances a virtual clock: Playwright's fake timers drive JS
// (setTimeout, rAF, Date, performance.now) and every CSS/WAAPI animation is
// paused and stepped to the same virtual time, so 60fps output is smooth no
// matter how long a 4x screenshot takes. The pointer is a drawn cursor that
// follows each component's scripted scenario.
//
// With --audio, AudioContext is swapped for an OfflineAudioContext whose
// currentTime follows the same virtual clock, so every UI sound is scheduled
// at the exact frame it belongs to and rendered afterwards in one pass.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

import { scenarios } from "./component-video-scenarios.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const DEFAULTS = {
	audioSampleRate: 48_000,
	baseUrl: "http://localhost:3001",
	deviceScaleFactor: 4,
	fps: 60,
	outputDir: path.join(ROOT_DIR, ".media", "videos"),
	padSeconds: 2,
};

function printHelp() {
	console.log(`Record component preview videos from the capture harness.

Usage:
  pnpm components:record [options]

Options:
  --component <slug>   Record one component; may be repeated
  --theme <theme>      Record one theme (light or dark)
  --base-url <url>     Running web app (default: ${DEFAULTS.baseUrl})
  --output-dir <path>  Video directory (default: .media/videos)
  --dpr <number>       Device pixel ratio (default: ${DEFAULTS.deviceScaleFactor})
  --fps <number>       Frames per second (default: ${DEFAULTS.fps})
  --pad <seconds>      Held frames on each end of the .mov for media:publish's
                       trim (default: ${DEFAULTS.padSeconds})
  --keep-frames        Keep the rendered PNG frames
  --audio              Capture UI sounds and add a social cut with audio
  -h, --help           Show this help

Output per component and theme:
  <slug>-<theme>.mp4   Web-ready loop
  <slug>-<theme>.mov   Padded source for 'pnpm media:publish'

With --audio, also:
  <slug>-<theme>.wav       Captured UI sound, in sync with the .mp4
  <slug>-<theme>-social.mp4  1440x1080 H.264 + AAC cut for X and other feeds
`);
}

function getOptions(args) {
	const { values } = parseArgs({
		args,
		options: {
			audio: { type: "boolean", default: false },
			"base-url": { type: "string", default: DEFAULTS.baseUrl },
			component: { type: "string", multiple: true, default: [] },
			dpr: { type: "string", default: String(DEFAULTS.deviceScaleFactor) },
			fps: { type: "string", default: String(DEFAULTS.fps) },
			help: { type: "boolean", short: "h", default: false },
			"keep-frames": { type: "boolean", default: false },
			"output-dir": { type: "string", default: DEFAULTS.outputDir },
			pad: { type: "string", default: String(DEFAULTS.padSeconds) },
			theme: { type: "string", multiple: true, default: [] },
		},
	});

	if (values.help) {
		printHelp();
		process.exit(0);
	}

	return {
		audio: values.audio,
		baseUrl: values["base-url"],
		components: values.component,
		deviceScaleFactor: Number(values.dpr),
		fps: Number(values.fps),
		keepFrames: values["keep-frames"],
		outputDir: path.resolve(ROOT_DIR, values["output-dir"]),
		padSeconds: Number(values.pad),
		themes: values.theme,
	};
}

const ARROW_CURSOR = `<svg width="20" height="26" viewBox="0 0 20 26" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L2 20.5 L6.6 16.3 L9.6 23.4 L12.9 22 L9.9 15 L16 15 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const HAND_CURSOR = `<svg width="22" height="24" viewBox="0 0 22 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 1.5c-1 0-1.7.8-1.7 1.7v9.3L4.4 11c-.7-.7-1.8-.7-2.4 0-.6.6-.6 1.6-.1 2.3l4.3 5.6c1.3 1.7 3.2 2.6 5.3 2.6h2c3.3 0 6-2.7 6-6v-5c0-.9-.8-1.7-1.7-1.7s-1.7.8-1.7 1.7v-.9c0-.9-.8-1.7-1.7-1.7s-1.7.8-1.7 1.7v-.7c0-.9-.8-1.7-1.7-1.7s-1.7.8-1.7 1.7V3.2c0-.9-.7-1.7-1.6-1.7Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

async function installCursor(page, isDark) {
	await page.evaluate(
		({ arrow, hand, isDark }) => {
			const cursor = document.createElement("div");
			cursor.id = "capture-cursor";
			cursor.innerHTML = `<span data-kind="arrow">${arrow}</span><span data-kind="hand">${hand}</span>`;
			Object.assign(cursor.style, {
				filter: `drop-shadow(0 1px 1.5px rgba(0,0,0,${isDark ? 0.6 : 0.3}))`,
				left: "0px",
				pointerEvents: "none",
				position: "fixed",
				top: "0px",
				willChange: "transform",
				zIndex: "2147483647",
			});
			for (const span of cursor.querySelectorAll("span")) {
				span.style.position = "absolute";
				span.style.left = "0";
				span.style.top = "0";
			}
			document.body.appendChild(cursor);
		},
		{ arrow: ARROW_CURSOR, hand: HAND_CURSOR, isDark },
	);
}

// Runs in the page once per frame: steps every animation to virtual time and
// draws the cursor.
function syncFrame({ now, previous, cursor }) {
	window.__captureAnimationStarts ??= new WeakMap();
	const starts = window.__captureAnimationStarts;
	for (const animation of document.getAnimations()) {
		if (animation.playState === "finished") continue;
		// Scroll-driven animations follow scroll position, not time.
		if (!(animation.timeline instanceof DocumentTimeline)) continue;
		if (!starts.has(animation)) starts.set(animation, previous);
		const timing = animation.effect?.getComputedTiming();
		if (!timing) continue;
		const elapsed = (now - starts.get(animation)) * animation.playbackRate;
		if (Number.isFinite(timing.endTime) && elapsed >= timing.endTime) {
			animation.finish();
			continue;
		}
		animation.pause();
		animation.currentTime = Math.max(0, elapsed);
	}

	const element = document.getElementById("capture-cursor");
	if (!element) return;
	element.style.display = cursor.visible ? "block" : "none";
	const target = document.elementFromPoint(cursor.x, cursor.y);
	const isHand =
		target !== null && getComputedStyle(target).cursor === "pointer";
	const arrow = element.querySelector('[data-kind="arrow"]');
	const hand = element.querySelector('[data-kind="hand"]');
	arrow.style.display = isHand ? "none" : "block";
	hand.style.display = isHand ? "block" : "none";
	// Hotspots: arrow tip at (2, 2), fingertip at (7.5, 1.5).
	const [hotX, hotY] = isHand ? [7.5, 1.5] : [2, 2];
	element.style.transformOrigin = `${hotX}px ${hotY}px`;
	element.style.transform = `translate(${cursor.x - hotX}px, ${cursor.y - hotY}px) scale(${cursor.scale})`;
}

// Runs before any page script. tiks and friends read window.AudioContext at
// import time, so they pick up the offline context transparently.
function installAudioCapture({ frameMs, sampleRate, seconds }) {
	const Offline = window.OfflineAudioContext;
	class CaptureAudioContext extends Offline {
		constructor() {
			super({
				length: Math.ceil(seconds * sampleRate),
				numberOfChannels: 2,
				sampleRate,
			});
			window.__captureAudioContexts ??= [];
			window.__captureAudioContexts.push(this);
		}
		// Frame N is captured at virtual time (N + 1) * frameMs but shown at
		// N * frameMs, so sounds shift back by one frame to line up.
		get currentTime() {
			const start = window.__captureAudioStart;
			if (start === undefined) return 0;
			return Math.max(0, (performance.now() - start - frameMs) / 1000);
		}
		get state() {
			return "running";
		}
		resume() {
			return Promise.resolve();
		}
		suspend() {
			return Promise.resolve();
		}
		close() {
			return Promise.resolve();
		}
	}
	window.AudioContext = CaptureAudioContext;
	window.webkitAudioContext = CaptureAudioContext;
}

// Renders every captured context, mixes them, and returns 16-bit stereo PCM.
async function renderCapturedAudio({ seconds }) {
	const contexts = window.__captureAudioContexts ?? [];
	const buffers = await Promise.all(
		contexts.map((context) =>
			OfflineAudioContext.prototype.startRendering.call(context),
		),
	);
	const sampleRate = buffers[0]?.sampleRate ?? 48_000;
	const length = Math.round(seconds * sampleRate);
	const pcm = new Int16Array(length * 2);
	for (let channel = 0; channel < 2; channel++) {
		const mixed = new Float32Array(length);
		for (const buffer of buffers) {
			const data = buffer.getChannelData(
				Math.min(channel, buffer.numberOfChannels - 1),
			);
			for (let i = 0; i < Math.min(length, data.length); i++) {
				mixed[i] += data[i];
			}
		}
		for (let i = 0; i < length; i++) {
			const sample = Math.max(-1, Math.min(1, mixed[i]));
			pcm[i * 2 + channel] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
		}
	}
	const bytes = new Uint8Array(pcm.buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return { base64: btoa(binary), sampleRate, sounds: contexts.length };
}

function toWav(pcm, sampleRate) {
	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(2, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * 4, 28);
	header.writeUInt16LE(4, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

function createDirector(page, stage, framesDir, options) {
	const frameMs = 1000 / options.fps;
	let frame = 0;
	let now = 0;
	let cursor = { ...options.frame.rest };
	let cursorVisible = true;
	let pressedAt = null;
	let releasedAt = null;

	function pressScale() {
		if (pressedAt !== null) {
			return lerp(1, 0.86, Math.min((now - pressedAt) / 90, 1));
		}
		if (releasedAt !== null && now - releasedAt < 140) {
			return lerp(0.86, 1, (now - releasedAt) / 140);
		}
		return 1;
	}

	async function renderFrame() {
		const previous = now;
		const next = Math.round((frame + 1) * frameMs);
		await page.clock.runFor(next - Math.round(frame * frameMs));
		now = next;
		await page.evaluate(syncFrame, {
			now,
			previous,
			cursor: { ...cursor, scale: pressScale(), visible: cursorVisible },
		});
		await stage.screenshot({
			animations: "allow",
			caret: "hide",
			path: path.join(framesDir, `${String(frame).padStart(4, "0")}.png`),
			scale: "device",
		});
		frame += 1;
	}

	async function resolvePoint(target, { x = 0.5, y = 0.5 } = {}) {
		if (typeof target !== "string") return target;
		const box = await page.locator(target).first().boundingBox();
		if (!box) throw new Error(`No bounding box for ${target}`);
		return { x: box.x + box.width * x, y: box.y + box.height * y };
	}

	const director = {
		rest: options.frame.rest,
		async wait(ms) {
			const end = now + ms;
			while (now < end - frameMs / 2) await renderFrame();
		},
		async move(target, ms = 650, anchor = {}, ease = easeInOut) {
			const from = { ...cursor };
			const to = await resolvePoint(target, anchor);
			const start = now;
			while (now < start + ms - frameMs / 2) {
				const t = ease(Math.min((now - start) / ms, 1));
				cursor = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
				await page.mouse.move(cursor.x, cursor.y);
				await renderFrame();
			}
			cursor = to;
			await page.mouse.move(cursor.x, cursor.y);
		},
		async down(button = "left") {
			await page.mouse.down({ button });
			pressedAt = now;
			releasedAt = null;
		},
		async up(button = "left") {
			await page.mouse.up({ button });
			pressedAt = null;
			releasedAt = now;
		},
		async click(holdMs = 110, button = "left") {
			await director.down(button);
			await director.wait(holdMs);
			await director.up(button);
		},
		async key(name, holdMs = 0) {
			if (holdMs === 0) {
				await page.keyboard.press(name);
				return;
			}
			await page.keyboard.down(name);
			await director.wait(holdMs);
			await page.keyboard.up(name);
		},
		async type(text, perCharMs = 95) {
			for (const char of text) {
				await page.keyboard.type(char);
				await director.wait(perCharMs);
			}
		},
		async blur() {
			await page.evaluate(() => document.activeElement?.blur());
		},
		hideCursor() {
			cursorVisible = false;
		},
		page,
		point: resolvePoint,
		get frameCount() {
			return frame;
		},
	};

	return director;
}

async function launchBrowser() {
	try {
		return await chromium.launch();
	} catch {
		return chromium.launch({ channel: "chrome" });
	}
}

async function recordFrames(browser, name, theme, manifest, options) {
	const scenario = scenarios[name];
	const framesDir = path.join(options.outputDir, "frames", `${name}-${theme}`);
	await rm(framesDir, { force: true, recursive: true });
	await mkdir(framesDir, { recursive: true });

	const { width, height } = manifest.frame;
	const context = await browser.newContext({
		colorScheme: theme,
		deviceScaleFactor: options.deviceScaleFactor,
		reducedMotion: "no-preference",
		viewport: { height, width },
	});

	try {
		await context.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: new URL(options.baseUrl).origin,
		});
		if (options.audio) {
			await context.addInitScript(installAudioCapture, {
				frameMs: 1000 / options.fps,
				sampleRate: DEFAULTS.audioSampleRate,
				// Room for the longest scenario; trimmed to the video on render.
				seconds: 120,
			});
		}
		await context.addInitScript((selectedTheme) => {
			localStorage.setItem("theme", selectedTheme);
			// Seeded random so light and dark takes behave identically.
			let seed = 0x2f6b3a1d;
			Math.random = () => {
				seed = (seed + 0x6d2b79f5) | 0;
				let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}, theme);

		const page = await context.newPage();
		await page.clock.install();
		const url = new URL(
			`/capture/${encodeURIComponent(name)}/${theme}`,
			options.baseUrl,
		);
		const response = await page.goto(url.toString());
		if (!response?.ok()) {
			throw new Error(
				`Capture page returned HTTP ${response?.status()}: ${url}`,
			);
		}

		const stage = page.locator(
			`[data-component-capture="${name}"][data-capture-ready="true"]`,
		);
		await stage.waitFor({ state: "visible", timeout: 30_000 });
		await stage.evaluate((element) => {
			element.setAttribute("data-capture-motion", "");
		});
		await page.evaluate(() => document.fonts.ready);
		await installCursor(page, theme === "dark");

		const startTime = await page.evaluate(() => Date.now());
		await page.clock.pauseAt(startTime + 500);

		const rest = scenario.rest ?? { x: width * 0.71, y: height * 0.8 };
		await page.mouse.move(rest.x, rest.y);
		const director = createDirector(page, stage, framesDir, {
			fps: options.fps,
			frame: { rest },
		});
		await page.evaluate(() => {
			window.__captureAudioStart = performance.now();
		});
		await scenario.run(director);

		let audioPath = null;
		if (options.audio) {
			const seconds = director.frameCount / options.fps;
			const audio = await page.evaluate(renderCapturedAudio, { seconds });
			audioPath = path.join(options.outputDir, `${name}-${theme}.wav`);
			await writeFile(
				audioPath,
				toWav(Buffer.from(audio.base64, "base64"), audio.sampleRate),
			);
		}
		return { audioPath, frameCount: director.frameCount, framesDir };
	} finally {
		await context.close();
	}
}

function peakVolume(file) {
	const { stderr } = spawnSync(
		"ffmpeg",
		["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
		{ encoding: "utf8" },
	);
	const match = /max_volume: (-?[\d.]+) dB/.exec(stderr);
	return match ? Number(match[1]) : 0;
}

function encode(name, theme, framesDir, audioPath, options) {
	const input = path.join(framesDir, "%04d.png");
	const base = path.join(options.outputDir, `${name}-${theme}`);
	const pad = String(options.padSeconds);
	execFileSync(
		"ffmpeg",
		[
			...["-v", "error", "-y", "-framerate", String(options.fps), "-i", input],
			...["-c:v", "libx264", "-preset", "slow", "-crf", "18"],
			...["-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"],
			`${base}.mp4`,
		],
		{ stdio: "inherit" },
	);
	execFileSync(
		"ffmpeg",
		[
			...["-v", "error", "-y", "-framerate", String(options.fps), "-i", input],
			"-vf",
			`tpad=start_duration=${pad}:start_mode=clone:stop_duration=${pad}:stop_mode=clone`,
			...["-c:v", "libx264", "-preset", "slow", "-crf", "10"],
			...["-pix_fmt", "yuv420p", "-an"],
			`${base}.mov`,
		],
		{ stdio: "inherit" },
	);
	if (!audioPath) return;

	// Feeds cap video at 1920x1200, so scale 4:3 down to 1440x1080. UI sounds
	// are mixed quiet, so peak-normalize them to -3 dB for phone speakers.
	const gain = Math.max(0, -3 - peakVolume(audioPath));
	execFileSync(
		"ffmpeg",
		[
			...["-v", "error", "-y", "-framerate", String(options.fps), "-i", input],
			...["-i", audioPath],
			...["-vf", "scale=1440:1080:flags=lanczos"],
			...["-af", `volume=${gain.toFixed(1)}dB`],
			...["-c:v", "libx264", "-preset", "slow", "-crf", "16"],
			...["-profile:v", "high", "-pix_fmt", "yuv420p"],
			...["-c:a", "aac", "-b:a", "192k", "-ar", "48000"],
			...["-shortest", "-movflags", "+faststart"],
			`${base}-social.mp4`,
		],
		{ stdio: "inherit" },
	);
}

async function main() {
	const options = getOptions(process.argv.slice(2));
	const response = await fetch(new URL("/capture/manifest", options.baseUrl));
	if (!response.ok)
		throw new Error(`Capture manifest returned ${response.status}`);
	const manifest = await response.json();

	const components =
		options.components.length > 0
			? [...new Set(options.components)]
			: manifest.components.filter((name) => name in scenarios);
	const themes = options.themes.length > 0 ? options.themes : manifest.themes;

	for (const name of components) {
		if (!manifest.components.includes(name)) {
			throw new Error(`Unknown component: ${name}`);
		}
		if (!(name in scenarios)) throw new Error(`No video scenario: ${name}`);
	}

	await mkdir(options.outputDir, { recursive: true });
	const browser = await launchBrowser();

	try {
		for (const name of components) {
			for (const theme of themes) {
				const started = Date.now();
				const { audioPath, frameCount, framesDir } = await recordFrames(
					browser,
					name,
					theme,
					manifest,
					options,
				);
				encode(name, theme, framesDir, audioPath, options);
				if (!options.keepFrames) {
					await rm(framesDir, { force: true, recursive: true });
				}
				const seconds = ((Date.now() - started) / 1000).toFixed(0);
				console.log(
					`Recorded ${name}-${theme} (${frameCount} frames, ${seconds}s)`,
				);
			}
		}
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
