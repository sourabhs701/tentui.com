// Scripted interactions for `record-component-videos.mjs`, keyed by component.
// Coordinates are CSS pixels in the 480x360 capture frame; string targets are
// Playwright selectors resolved when the step runs. Every scenario starts and
// ends with the cursor at rest so the clip loops cleanly.

// Pointer travel, in px, for the tick-ruler flicks and the final drag.
const TICK_RULER_FLICKS = [84, 137, 200];

export const scenarios = {
	"scroll-accordion": {
		rest: { x: 458, y: 330 },
		async run(d) {
			const viewport = '[data-slot="scroll-accordion-viewport"]';
			// Scroll offset at which section `index` opens: its header reaches
			// its slot in the top stack.
			const opensAt = (index) =>
				d.page.evaluate((i) => {
					const body = document.querySelectorAll(
						'[data-slot="scroll-accordion-content"]',
					)[i];
					return body.offsetTop - 48 - i * 12;
				}, index);
			// A trackpad-like read: eased scroll, stepped with the frame clock.
			// Snapping is paused so each step lands where it is set.
			const read = async (to, ms) => {
				const from = await d.page.evaluate(
					(s) => document.querySelector(s).scrollTop,
					viewport,
				);
				const frames = Math.round(ms / (1000 / 60));
				for (let f = 1; f <= frames; f++) {
					const t = f / frames;
					const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
					await d.page.evaluate(
						([s, top]) => {
							const v = document.querySelector(s);
							v.style.scrollSnapType = "none";
							v.scrollTop = top;
						},
						[viewport, from + (to - from) * eased],
					);
					await d.wait(1000 / 60);
				}
			};
			await d.wait(700);
			// Rest on the panel and read down: each next card slides up over
			// the open one and the deck builds at the top.
			await d.move({ x: 250, y: 200 }, 700);
			await d.wait(250);
			await read(await opensAt(1), 900);
			await d.wait(650);
			await read(await opensAt(2), 800);
			await d.wait(500);
			// Partway through a section the ring fills as you read.
			await read((await opensAt(2)) + 90, 700);
			await d.wait(500);
			await read(await opensAt(3), 700);
			await d.wait(700);
			// Tap the deepest card in the top stack: the panel glides back to
			// the start, riffling through the deck.
			await d.move('h3[data-slot="scroll-accordion-header"]', 750, {
				x: 0.5,
				y: 0.12,
			});
			await d.wait(200);
			await d.click();
			await d.wait(1200);
			await d.page.evaluate(
				(s) =>
					document.querySelector(s).style.removeProperty("scroll-snap-type"),
				viewport,
			);
			await d.move(d.rest, 800);
			await d.wait(600);
		},
	},
	"agent-thinking": {
		async run(d) {
			// Nothing to click: the four looks run on their own.
			d.hideCursor();
			// The scene starts a run on the virtual clock from its quiet first
			// frame: the dot cluster, the shimmer line, the orb, and the card
			// in sync. Steps land at 1.0, 2.2, 3.3, and 4.4 s while the card
			// streams its reasoning, and all four finish together at 5.5 s.
			await d.page.evaluate(() =>
				window.dispatchEvent(new Event("agent-thinking-capture")),
			);
			await d.wait(5500);
			// The card folds into its summary and the rest settle: a calm hold.
			// Ends just before the scene resets to the first frame at 7.3 s.
			await d.wait(1750);
		},
	},
	"snap-sheet": {
		rest: { x: 420, y: 320 },
		async run(d) {
			const handle = '[data-slot="snap-sheet-handle"]';
			const easeIn = (t) => t * t;
			// Grab the handle and drag it to `y`; a short hold zeroes the velocity.
			const drag = async (y, ms, { holdMs = 150, ease } = {}) => {
				const box = await d.page.locator(handle).boundingBox();
				const x = box.x + box.width / 2;
				await d.move({ x, y: box.y + box.height / 2 }, 650);
				await d.wait(150);
				await d.down();
				await d.move({ x, y }, ms, {}, ease);
				if (holdMs) await d.wait(holdMs);
				await d.up();
			};
			await d.wait(1500);
			// Half to full: the sheet pops at the top and the page scales back.
			await drag(48, 700);
			await d.wait(1000);
			// Full down to the peek height.
			await drag(232, 800);
			await d.wait(1000);
			// A flick down from peek closes it.
			const box = await d.page.locator(handle).boundingBox();
			await drag(box.y + 90, 120, { holdMs: 0, ease: easeIn });
			await d.wait(1000);
			await d.move('[data-slot="snap-sheet-trigger"]', 700, { x: 0.6, y: 0.6 });
			await d.wait(200);
			await d.click();
			await d.wait(1600);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"morph-dialog": {
		rest: { x: 440, y: 330 },
		async run(d) {
			const card = '[data-slot="morph-dialog-trigger"]';
			const photo =
				'[data-slot="morph-dialog-content"] [data-slot="morph-dialog-media"]';
			// The dialog takes focus and hands it back to the card, and both draw
			// their ring and shadow with box-shadow, which the recorder's
			// focus-hiding style strips. Nothing here shows a focus ring (a
			// pointer close returns focus without one), so drop that style.
			await d.page.evaluate(() => {
				for (const style of document.querySelectorAll("style")) {
					if (style.textContent?.startsWith("*:focus,*:focus-visible{")) {
						style.remove();
					}
				}
			});
			await d.wait(500);
			// The card grows into its dialog: the photo uncrops, the title glides.
			await d.move(card, 700, { x: 0.55, y: 0.5 });
			await d.wait(150);
			await d.click();
			await d.wait(1300);
			// Pull the photo down: the dialog rewinds under the cursor and lands
			// back in its card.
			await d.move(photo, 500, { x: 0.45, y: 0.55 });
			await d.wait(200);
			const from = await d.point(photo, { x: 0.45, y: 0.55 });
			await d.down();
			await d.move({ x: from.x - 20, y: from.y + 130 }, 600);
			await d.up();
			await d.wait(900);
			await d.move(d.rest, 700);
			await d.wait(400);
		},
	},

	"morph-lightbox": {
		rest: { x: 440, y: 330 },
		async run(d) {
			const thumb = (index) =>
				`[data-slot="morph-lightbox-trigger"] >> nth=${index}`;
			const slide = (index) =>
				`[data-slot="morph-lightbox-slide"][data-slide="${index}"]`;
			await d.wait(400);
			// The poppies lift out of their cell and uncrop to the whole photo.
			await d.move(thumb(2), 650, { x: 0.5, y: 0.55 });
			await d.wait(120);
			await d.click();
			await d.wait(750);
			// A click on the peeking neighbour brings the next photo in.
			await d.move(slide(3), 450, { x: 0.3, y: 0.5 });
			await d.wait(100);
			await d.click();
			await d.wait(750);
			// Pull it down: it shrinks under the cursor and lands in its own cell.
			await d.move(slide(3), 350, { x: 0.5, y: 0.45 });
			await d.wait(120);
			const from = await d.point(slide(3), { x: 0.5, y: 0.45 });
			await d.down();
			await d.move({ x: from.x - 30, y: from.y + 150 }, 520);
			await d.up();
			await d.wait(750);
			await d.move(d.rest, 600);
			await d.wait(300);
		},
	},

	"swipe-actions": {
		rest: { x: 455, y: 330 },
		async run(d) {
			const row = (title) =>
				`[data-slot="swipe-actions"][aria-label="${title}"]`;
			const swipe = async (title, from, distance, ms, holdMs = 150) => {
				const box = await d.page.locator(row(title)).boundingBox();
				const y = box.y + box.height * 0.55;
				const x = box.x + box.width * from;
				await d.move({ x, y }, 650);
				await d.wait(150);
				await d.down();
				await d.move({ x: x + distance, y }, ms);
				// Hold so the release has no velocity and the position decides.
				await d.wait(holdMs);
				await d.up();
			};
			await d.wait(1500);
			// A long swipe right on row 1 arms Pin, fires it, and snaps back.
			await swipe("Swipe left or right", 0.18, 260, 750, 300);
			await d.wait(900);
			// A shorter swipe left on row 1 reveals Archive and Delete.
			await swipe("Swipe left or right", 0.8, -150, 600);
			await d.wait(1000);
			// A full swipe on row 2 arms Delete, stretches it, and collapses the row.
			await swipe("Full swipe to delete", 0.85, -300, 900, 350);
			await d.wait(1300);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"number-stepper": {
		rest: { x: 455, y: 335 },
		async run(d) {
			const plus = '[aria-label="Increase Quantity"]';
			const minus = '[aria-label="Decrease Quantity"]';
			await d.wait(1500);
			// Two taps roll the value up from 3 to 5.
			await d.move(plus, 750, { x: 0.55, y: 0.6 });
			await d.wait(250);
			await d.click();
			await d.wait(350);
			await d.click();
			await d.wait(700);
			// Hold: repeats speed up until 12, where the wall nudges and stops it.
			await d.down();
			await d.wait(1500);
			await d.up();
			await d.wait(700);
			// Hold minus back down. On the virtual clock the 10th step (2) lands at
			// 1148 ms and the 11th (1) at 1214 ms, so let go in between.
			await d.move(minus, 650, { x: 0.45, y: 0.6 });
			await d.wait(250);
			await d.down();
			await d.wait(1180);
			await d.up();
			await d.wait(500);
			// One more tap to 1, then another bumps the min wall.
			await d.click();
			await d.wait(450);
			await d.click();
			await d.wait(900);
			await d.move(d.rest, 800);
			await d.wait(1500);
		},
	},

	"chart-brush": {
		rest: { x: 440, y: 330 },
		async run(d) {
			const plot = await d.page
				.locator('[data-slot="chart-brush-plot"]')
				.boundingBox();
			const grip = (edge) =>
				`[data-slot="chart-brush-${edge}"] [data-slot="chart-brush-grip"]`;
			// The preview has 90 evenly spaced days inside a 12px inset.
			const inset = (12 / 400) * plot.width;
			const xAt = (index) =>
				plot.x + inset + (index / 89) * (plot.width - inset * 2);
			const y = plot.y + plot.height * 0.45;
			await d.wait(500);
			// Pull the end handle back through the dip: the ink retracts, the
			// change rolls from +38% into the red, and each day ticks.
			await d.move(grip("end"), 800);
			await d.wait(150);
			await d.down();
			await d.move({ x: xAt(50), y: (await d.point(grip("end"))).y }, 900);
			await d.wait(120);
			await d.up();
			await d.wait(700);
			// Grab the window and slide it along the climb.
			await d.move({ x: xAt(42), y }, 600);
			await d.wait(150);
			await d.down();
			await d.move({ x: xAt(64), y }, 1100);
			await d.wait(120);
			await d.up();
			await d.wait(700);
			// Sweep a fresh range on the empty plot before the dip.
			await d.move({ x: xAt(8), y }, 650);
			await d.wait(150);
			await d.down();
			await d.move({ x: xAt(30), y }, 800);
			await d.up();
			await d.wait(700);
			// Double-click glides back to the default range, so the clip loops.
			// The second press needs clickCount 2 for the browser to fire dblclick.
			await d.click(70);
			await d.wait(60);
			await d.page.mouse.down({ clickCount: 2 });
			await d.wait(70);
			await d.page.mouse.up({ clickCount: 2 });
			await d.wait(1000);
			await d.move(d.rest, 700);
			await d.wait(400);
		},
	},

	"tick-ruler": {
		async run(d) {
			const track = '[data-slot="tick-ruler-track"]';
			const easeIn = (t) => t * t;
			const box = await d.page.locator(track).boundingBox();
			const y = box.y + box.height * 0.55;
			const right = box.x + box.width * 0.82;
			const flick = async (distance) => {
				await d.move({ x: right, y }, 700);
				await d.wait(200);
				await d.down();
				await d.move({ x: right - distance, y }, 160, {}, easeIn);
				await d.up();
			};
			await d.wait(400);
			// Flick from 25: coasts and ticks, then lands on 45.
			await flick(TICK_RULER_FLICKS[0]);
			await d.wait(1100);
			// A harder flick coasts most of the way to the top.
			await flick(TICK_RULER_FLICKS[1]);
			await d.wait(1100);
			// Drag past 90: the strip rubber-bands, pops, then springs back.
			await d.move({ x: right, y }, 500);
			await d.wait(150);
			await d.down();
			await d.move({ x: right - TICK_RULER_FLICKS[2], y }, 800);
			await d.wait(450);
			await d.up();
			await d.wait(900);
			// A flick the other way coasts back down the ruler.
			const left = box.x + box.width * 0.18;
			await d.move({ x: left, y }, 700);
			await d.wait(200);
			await d.down();
			await d.move({ x: left + TICK_RULER_FLICKS[1], y }, 160, {}, easeIn);
			await d.up();
			await d.wait(1400);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"star-rating": {
		rest: { x: 420, y: 320 },
		async run(d) {
			const star = (index) => `[data-slot="star-rating-star"] >> nth=${index}`;
			await d.wait(1200);
			// Sweep across the row: each star ticks as the preview fills.
			await d.move(star(0), 700, { x: 0.7, y: 0.55 });
			await d.wait(200);
			await d.move(star(4), 900, { x: 0.7, y: 0.55 });
			await d.wait(250);
			// A full five pops.
			await d.click();
			await d.wait(900);
			// The left half of the second star picks 1.5.
			await d.move(star(1), 700, { x: 0.25, y: 0.55 });
			await d.wait(250);
			await d.click();
			await d.wait(900);
			// Back to 3.5, where the clip started.
			await d.move(star(3), 700, { x: 0.25, y: 0.55 });
			await d.wait(250);
			await d.click();
			await d.wait(900);
			await d.move(d.rest, 800);
			await d.wait(800);
		},
	},

	"hold-to-confirm": {
		async run(d) {
			const button = '[data-slot="hold-to-confirm"]';
			await d.wait(300);
			await d.move(button, 750, { x: 0.62, y: 0.62 });
			await d.wait(250);
			// Full hold confirms, then the component resets on its own.
			await d.down();
			await d.wait(1950);
			await d.up();
			await d.wait(2300);
			// Early release springs back.
			await d.down();
			await d.wait(750);
			await d.up();
			await d.wait(700);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"interactive-sprite": {
		rest: { x: 400, y: 320 },
		async run(d) {
			await d.wait(300);
			await d.move({ x: 70, y: 120 }, 900);
			await d.wait(450);
			await d.move({ x: 240, y: 20 }, 800);
			await d.wait(450);
			await d.move({ x: 430, y: 110 }, 800);
			await d.wait(450);
			await d.move({ x: 330, y: 300 }, 800);
			await d.wait(450);
			await d.move({ x: 110, y: 290 }, 800);
			await d.wait(450);
			await d.move(d.rest, 900);
			await d.wait(1300);
		},
	},

	"tile-field": {
		rest: { x: 420, y: 320 },
		async run(d) {
			await d.wait(300);
			await d.move({ x: 50, y: 150 }, 900);
			await d.move({ x: 440, y: 120 }, 2200);
			await d.move({ x: 250, y: 60 }, 900);
			await d.move({ x: 160, y: 200 }, 900);
			await d.move(d.rest, 1000);
			await d.wait(1600);
		},
	},

	"search-command": {
		async run(d) {
			const trigger = 'button:has-text("Search")';
			const select = async (query) => {
				await d.move(trigger, 700);
				await d.wait(150);
				await d.click();
				await d.wait(500);
				await d.move({ x: 400, y: 330 }, 500);
				await d.type(query, 110);
				await d.wait(500);
				await d.key("ArrowDown");
				await d.wait(350);
				await d.key("ArrowUp");
				await d.wait(450);
				await d.key("Enter");
				await d.wait(900);
			};
			await d.wait(300);
			await select("bill");
			await select("home");
			await d.blur();
			await d.move(d.rest, 600);
			await d.wait(400);
		},
	},

	"tailwindcss-buttons": {
		rest: { x: 250, y: 330 },
		async run(d) {
			const buttons = ["Primary", "Secondary", "3D Button", "3D Destructive"];
			await d.wait(300);
			for (const label of buttons) {
				await d.move(`button:has-text("${label}")`, 650, { x: 0.6, y: 0.6 });
				await d.wait(350);
				await d.click(260);
				await d.wait(450);
			}
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"component-sidebar": {
		rest: { x: 400, y: 320 },
		async run(d) {
			const link = (title) =>
				`[data-slot="component-sidebar"] a:has-text("${title}")`;
			await d.wait(300);
			for (const title of ["Installation", "Changelog", "Button", "Dialog"]) {
				await d.move(link(title), 600, { x: 0.35, y: 0.5 });
				await d.wait(200);
				await d.click();
				await d.wait(550);
			}
			await d.move(link("Overview"), 700, { x: 0.35, y: 0.5 });
			await d.wait(200);
			await d.click();
			await d.wait(500);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"peeping-button": {
		rest: { x: 400, y: 320 },
		async run(d) {
			await d.wait(1300);
			await d.move({ x: 60, y: 60 }, 1100);
			await d.wait(300);
			await d.move({ x: 430, y: 70 }, 1300);
			await d.wait(300);
			await d.move({ x: 240, y: 330 }, 1100);
			await d.wait(300);
			await d.move('[data-slot="peeping-button"]', 900, { x: 0.6, y: 0.6 });
			await d.wait(500);
			await d.click();
			await d.wait(700);
			await d.move(d.rest, 900);
			await d.wait(1200);
		},
	},

	"brand-context-menu": {
		rest: { x: 380, y: 300 },
		async run(d) {
			const items = '[role="menuitem"]';
			await d.wait(300);
			await d.move('button[aria-label^="Open TentUI"]', 900, {
				x: 0.3,
				y: 0.55,
			});
			await d.wait(300);
			await d.click(110, "right");
			await d.wait(700);
			const count = await d.page.locator(items).count();
			for (let index = 0; index < Math.min(count, 4); index++) {
				await d.move(`${items} >> nth=${index}`, 420, { x: 0.4, y: 0.5 });
				await d.wait(380);
			}
			await d.wait(300);
			await d.key("Escape");
			await d.blur();
			await d.wait(500);
			await d.move(d.rest, 800);
			await d.wait(600);
		},
	},

	"prompt-chip-input": {
		rest: { x: 400, y: 320 },
		async run(d) {
			// The capture scene starts focused, with "Ask " typed.
			await d.key("Control+End");
			await d.wait(500);
			// Grow: the live capsule follows each letter, the ghost and list appear.
			await d.type("@an", 140);
			await d.wait(450);
			// Solidify: the capsule morphs into the Ana Lima chip.
			await d.key("Tab");
			await d.wait(550);
			await d.type("to tidy the notes with ~op", 55);
			await d.wait(350);
			await d.key("Tab");
			await d.wait(800);
			// Melt: one Backspace turns the Opus chip back into "~Opus".
			await d.key("Backspace");
			await d.wait(650);
			// It's plain text again: the next Backspace deletes a letter.
			await d.key("Backspace");
			await d.wait(450);
			await d.type("s", 200);
			await d.key("Tab");
			await d.wait(900);
			// Back to "Ask " for the loop.
			await d.key("Control+a");
			await d.page.keyboard.type("Ask ");
			await d.wait(400);
		},
	},

	"fluid-tooltip": {
		rest: { x: 410, y: 320 },
		async run(d) {
			const tool = (label) =>
				`[data-slot="fluid-tooltip-trigger"][aria-label="${label}"]`;
			await d.wait(300);
			// Rest on Bold: after the delay the bubble fades in above it.
			await d.move(tool("Bold"), 700, { x: 0.5, y: 0.6 });
			await d.wait(800);
			// Slide along: each step the bubble glides over and the label crossfades.
			for (const label of ["Italic", "Link", "Comment"]) {
				await d.move(tool(label), 380, { x: 0.5, y: 0.6 });
				await d.wait(label === "Comment" ? 650 : 320);
			}
			// A quick sweep back heads straight to Bold.
			await d.move(tool("Bold"), 260, { x: 0.5, y: 0.6 });
			await d.wait(600);
			// Leaving the toolbar straight down fades it out without crossing Italic.
			const bold = await d.page.locator(tool("Bold")).first().boundingBox();
			await d.move(
				{ x: bold.x + bold.width / 2, y: bold.y + bold.height + 40 },
				300,
			);
			await d.move(d.rest, 600);
			await d.wait(450);
		},
	},

	"ink-filter-bar": {
		rest: { x: 330, y: 300 },
		async run(d) {
			const chip = (label) =>
				`[data-slot="ink-filter-bar-chip"]:has-text("${label}")`;
			await d.wait(250);
			// Ink buds from the pill, floods Cycling, and the count rolls to 17.
			await d.move(chip("Cycling"), 500, { x: 0.5, y: 0.6 });
			await d.wait(150);
			await d.click();
			await d.wait(700);
			// Tennis joins the same capsule: 11 results.
			await d.move(chip("Tennis"), 380, { x: 0.5, y: 0.6 });
			await d.wait(120);
			await d.click();
			await d.wait(750);
			// Cycling tears free and drains back, then Tennis, back to 24.
			await d.move(chip("Cycling"), 380, { x: 0.5, y: 0.6 });
			await d.wait(100);
			await d.click();
			await d.wait(700);
			await d.move(chip("Tennis"), 320, { x: 0.5, y: 0.6 });
			await d.wait(100);
			await d.click();
			await d.wait(650);
			await d.move(d.rest, 500);
			await d.wait(150);
		},
	},

	"liquid-glass-menu": {
		rest: { x: 300, y: 330 },
		async run(d) {
			const items = '[data-slot="liquid-glass-menu-item"]';
			await d.wait(300);
			await d.move('[data-slot="liquid-glass-menu-trigger"]', 550, {
				x: 0.55,
				y: 0.6,
			});
			await d.wait(100);
			// The button flows into the panel and the rows sharpen.
			await d.click();
			await d.wait(550);
			// Down the rows and back up: the lens slides after the pointer.
			for (const index of [0, 1, 2, 0]) {
				await d.move(`${items} >> nth=${index}`, 320, { x: 0.45, y: 0.5 });
				await d.wait(170);
			}
			// A click on the page outside drains it back into the button.
			await d.move({ x: 140, y: 120 }, 400);
			await d.wait(80);
			await d.click();
			await d.wait(600);
			await d.move(d.rest, 500);
			await d.wait(200);
		},
	},

	"animated-tabs": {
		rest: { x: 360, y: 320 },
		async run(d) {
			const tab = (label) =>
				`[data-slot="animated-tabs-trigger"]:has-text("${label}")`;
			await d.wait(300);
			for (const label of ["Analytics", "Settings", "Overview"]) {
				await d.move(tab(label), 650, { x: 0.55, y: 0.6 });
				await d.wait(200);
				await d.click();
				await d.wait(900);
			}
			await d.move(d.rest, 800);
			await d.wait(600);
		},
	},

	"liquid-glass-carousel": {
		rest: { x: 450, y: 330 },
		async run(d) {
			const current = '[data-slot="liquid-glass-carousel-item"][data-current]';
			// Autoplay steps twice (every 2.2 s) while the cursor rests off the
			// column: each card drains into the top edge as the next is born
			// from the bottom one.
			await d.wait(4700);
			// Then a slow drag up melts the next card in by hand.
			await d.move(current, 750, { x: 0.5, y: 0.6 });
			await d.wait(150);
			const from = await d.point(current, { x: 0.5, y: 0.6 });
			await d.down();
			await d.move({ x: from.x, y: from.y - 120 }, 700);
			await d.wait(120);
			await d.up();
			await d.wait(900);
			await d.move(d.rest, 800);
			await d.wait(600);
		},
	},

	"glass-toggle": {
		rest: { x: 420, y: 310 },
		async run(d) {
			const thumb = '[data-slot="glass-toggle-thumb"]';
			const track = '[data-slot="glass-toggle-track"]';
			await d.wait(400);
			// Starts on (sun, amber rim). Click: the moon reassembles, the rim runs to lilac.
			await d.move(thumb, 700);
			await d.wait(250);
			await d.click();
			await d.wait(1400);
			// Click again: back to the sun, the light runs the same way round.
			await d.move(thumb, 250);
			await d.wait(200);
			await d.click();
			await d.wait(1400);
			// Drag the glass slowly to scrub the flip both ways, then let go on the on side so the loop starts and ends the same.
			await d.move(thumb, 250);
			await d.wait(200);
			await d.down();
			await d.wait(120);
			await d.move(track, 1200, { x: 0.5, y: 0.5 });
			await d.wait(200);
			await d.move(track, 700, { x: 0.68, y: 0.5 });
			await d.wait(200);
			await d.move(track, 900, { x: 0.22, y: 0.5 });
			await d.wait(200);
			await d.move(track, 900, { x: 0.85, y: 0.5 });
			await d.wait(100);
			await d.up();
			await d.wait(1400);
			await d.move(d.rest, 650);
			await d.wait(300);
		},
	},

	"theme-toggle": {
		rest: { x: 360, y: 300 },
		async run(d) {
			const toggle = '[data-slot="button"], button';
			await d.wait(300);
			await d.move(toggle, 800, { x: 0.6, y: 0.65 });
			await d.wait(300);
			await d.click();
			await d.wait(1500);
			await d.click();
			await d.wait(1300);
			await d.move(d.rest, 800);
			await d.wait(600);
		},
	},

	"copy-button": {
		rest: { x: 380, y: 300 },
		async run(d) {
			await d.wait(300);
			await d.move("button", 800, { x: 0.6, y: 0.65 });
			await d.wait(300);
			await d.click();
			await d.wait(2600);
			await d.click();
			await d.wait(1200);
			await d.move(d.rest, 800);
			await d.wait(1600);
		},
	},

	"email-dock": {
		rest: { x: 400, y: 330 },
		async run(d) {
			const action = (index) =>
				`[data-slot="email-dock-action"] >> nth=${index}`;
			await d.wait(300);
			for (const index of [0, 1, 2]) {
				await d.move(action(index), 700);
				await d.wait(1300);
			}
			await d.move(action(0), 900);
			await d.wait(900);
			await d.move(d.rest, 800);
			await d.wait(900);
		},
	},

	"stateful-button": {
		rest: { x: 400, y: 330 },
		async run(d) {
			const button = (index) => `[data-slot="stateful-button"] >> nth=${index}`;
			await d.wait(300);
			await d.move(button(0), 750, { x: 0.6, y: 0.6 });
			await d.wait(250);
			await d.click();
			await d.wait(2900);
			await d.move({ x: 330, y: 270 }, 600);
			await d.wait(400);
			await d.move(button(0), 700, { x: 0.4, y: 0.5 });
			await d.wait(250);
			await d.click();
			await d.wait(2900);
			await d.move(d.rest, 800);
			await d.wait(500);
		},
	},

	"animated-arrow": {
		rest: { x: 380, y: 300 },
		async run(d) {
			await d.wait(300);
			await d.move("button", 800, { x: 0.45, y: 0.6 });
			await d.wait(1200);
			await d.move({ x: 300, y: 250 }, 600);
			await d.wait(700);
			await d.move("button", 700, { x: 0.8, y: 0.6 });
			await d.wait(500);
			await d.click(140);
			await d.wait(900);
			await d.move(d.rest, 800);
			await d.wait(800);
		},
	},

	"scribbled-text": {
		async run(d) {
			// The capture scene cycles four marks every 2s; one full cycle loops.
			d.hideCursor();
			await d.wait(8000);
		},
	},

	"ascii-decode-text": {
		rest: { x: 420, y: 320 },
		async run(d) {
			const headline = '[data-slot="ascii-decode-text"]';
			// The capture scene decodes 400 ms after the first pointer move and
			// re-encodes at 5 s, so the take starts and ends as ASCII art.
			await d.wait(1700);
			await d.move(headline, 600, { x: 0.04, y: 0.55 });
			// Glide across: the lens re-encodes the letters and heals behind.
			await d.move(headline, 1700, { x: 0.96, y: 0.45 }, (t) => t);
			await d.move(d.rest, 700);
			await d.wait(2300);
		},
	},

	"rotary-knob": {
		async run(d) {
			const dial = '[data-slot="rotary-knob-dial"]';
			await d.wait(600);
			await d.move(dial, 650, { x: 0.5, y: 0.6 });
			await d.wait(150);
			const start = await d.point(dial, { x: 0.5, y: 0.6 });
			// Drag up: the pointer springs onto each detent with a tick.
			await d.down();
			await d.wait(100);
			await d.move({ x: start.x, y: start.y - 120 }, 1100);
			await d.wait(250);
			await d.up();
			await d.wait(200);
			// Second stroke runs into the max: it rubber-bands and thunks.
			await d.move(start, 450);
			await d.down();
			await d.move({ x: start.x, y: start.y - 150 }, 900);
			await d.wait(450);
			await d.up();
			await d.wait(400);
			// A quick spin down: the ticks blur into a rattle.
			await d.move(start, 450);
			await d.down();
			await d.move({ x: start.x, y: start.y + 150 }, 450);
			await d.wait(150);
			await d.up();
			await d.wait(900);
			await d.move(d.rest, 650);
			await d.wait(300);
		},
	},

	"before-after-compare": {
		rest: { x: 420, y: 330 },
		async run(d) {
			const handle = '[data-slot="before-after-compare"] [data-slot="handle"]';
			await d.wait(600);
			await d.move(handle, 700);
			await d.wait(150);
			const start = await d.point(handle);
			// Grab the handle and reveal more of the dark side, then the light.
			await d.down();
			await d.wait(100);
			await d.move({ x: start.x - 140, y: start.y + 6 }, 900);
			await d.wait(350);
			await d.move({ x: start.x + 150, y: start.y - 4 }, 1300);
			await d.wait(350);
			// Settle back on the middle so the clip loops on the first frame.
			await d.move(start, 800);
			await d.wait(100);
			await d.up();
			await d.wait(300);
			await d.move(d.rest, 750);
			await d.wait(500);
		},
	},

	"pagination-rail": {
		rest: { x: 420, y: 315 },
		async run(d) {
			const pageBtn = (n) => `[data-pagination-page="${n}"]`;
			const endPeek = '[data-peek-side="end"]';
			const trayPage = (n) =>
				`[data-slot="pagination-rail-peek-page"]:has-text("${n}")`;

			await d.wait(450);
			// Hover page 4 so the floating preview card appears, then slide the pill over.
			await d.move(pageBtn(4), 620, { x: 0.5, y: 0.55 });
			await d.wait(320);
			await d.click();
			await d.wait(650);

			// Rest on the edge-masked peek slot to open the Peek Tray into upcoming pages.
			await d.move(endPeek, 520, { x: 0.5, y: 0.55 });
			await d.wait(500);
			// Glide up into the tray, preview page 8, and jump straight to it.
			await d.move(trayPage(8), 420, { x: 0.5, y: 0.55 });
			await d.wait(480);
			await d.click();
			await d.wait(780);

			// Slide back to page 1, then settle onto page 2 so the clip loops on frame 1.
			await d.move(pageBtn(1), 580, { x: 0.5, y: 0.55 });
			await d.wait(180);
			await d.click();
			await d.wait(520);
			await d.move(pageBtn(2), 360, { x: 0.5, y: 0.55 });
			await d.wait(160);
			await d.click();
			await d.wait(280);
			await d.move(d.rest, 620);
			await d.wait(500);
		},
	},

	"variable-font-hover": {
		rest: { x: 400, y: 320 },
		async run(d) {
			const text = '[data-slot="variable-font-hover"]';
			await d.wait(600);
			// Sweep across the headline: the weight swells under the pointer.
			await d.move(text, 750, { x: 0.04, y: 0.55 });
			await d.wait(200);
			await d.move(text, 1600, { x: 0.96, y: 0.55 });
			await d.wait(250);
			await d.move(text, 1300, { x: 0.3, y: 0.5 });
			await d.wait(400);
			// Leave: the type relaxes back to its resting weight.
			await d.move(d.rest, 750);
			await d.wait(1100);
		},
	},

	"text-scramble": {
		rest: { x: 410, y: 315 },
		async run(d) {
			const trigger = '[data-slot="text-scramble-capture-trigger"]';
			await d.wait(500);
			// Hover onto Precision to scramble it in place.
			await d.move(trigger, 600, { x: 0.52, y: 0.55 });
			await d.wait(1100);
			// Click to morph Precision -> Clarity.
			await d.click();
			await d.wait(1250);
			// Click to morph Clarity -> Velocity.
			await d.click();
			await d.wait(1250);
			// Click to morph Velocity -> Precision so the clip loops on frame 1.
			await d.click();
			await d.wait(1100);
			await d.move(d.rest, 650);
			await d.wait(500);
		},
	},

	"hover-peek-card": {
		rest: { x: 432, y: 318 },
		async run(d) {
			const first = '[data-peek-trigger="edge-cache"]';
			const second = '[data-peek-trigger="surface-tokens"]';
			const card = '[data-slot="hover-peek-card-content"]';

			await d.wait(400);
			// Hover the first inline pill so the preview card lifts out of it.
			await d.move(first, 620, { x: 0.5, y: 0.5 });
			await d.wait(650);
			// Drift smoothly onto the open card to show the safe bridge and subtle sheen.
			await d.move(card, 520, { x: 0.72, y: 0.36 });
			await d.wait(220);
			await d.move(card, 560, { x: 0.28, y: 0.52 });
			await d.wait(280);
			// Glide to the sibling pill for an instant zero-delay group handoff.
			await d.move(second, 560, { x: 0.5, y: 0.5 });
			await d.wait(900);
			// Return to rest so the card settles closed and the loop starts clean.
			await d.move(d.rest, 640);
			await d.wait(620);
		},
	},

	"contribution-heat": {
		rest: { x: 432, y: 318 },
		async run(d) {
			const cell = (iso) =>
				`[data-slot="contribution-heat-cell"][data-date="${iso}"]`;
			const legendLevel = (lvl) =>
				`[data-slot="contribution-heat-legend-swatch"][data-level="${lvl}"]`;

			await d.wait(450);
			// Glide into the calendar from the left and sweep across a sprint cluster.
			await d.move(cell("2026-08-14"), 640, { x: 0.5, y: 0.5 });
			await d.wait(420);
			await d.move(cell("2026-09-18"), 720, { x: 0.5, y: 0.5 });
			await d.wait(420);
			await d.move(cell("2026-10-29"), 740, { x: 0.5, y: 0.5 });
			await d.wait(450);
			// Pin the release milestone day, then glide over to the latest sprint ship.
			await d.click();
			await d.wait(480);
			await d.move(cell("2026-11-12"), 520, { x: 0.5, y: 0.5 });
			await d.wait(420);
			// Unpin via the header pill so the resting frame matches frame 1 cleanly.
			await d.move('[data-slot="contribution-heat-pin-clear"]', 480, {
				x: 0.5,
				y: 0.5,
			});
			await d.wait(160);
			await d.click();
			await d.wait(280);
			// Briefly preview level 4 peak days on the interactive legend.
			await d.move(legendLevel(4), 520, { x: 0.5, y: 0.5 });
			await d.wait(650);
			await d.move(d.rest, 600);
			await d.wait(500);
		},
	},

	"wizard-rail": {
		rest: { x: 432, y: 318 },
		async run(d) {
			const nextBtn = '[data-slot="wizard-rail-next"]';
			const backBtn = '[data-slot="wizard-rail-back"]';
			const skipBtn = '[data-slot="wizard-rail-skip"]';
			const resetBtn = '[data-slot="wizard-rail-reset"]';
			const stepBtn = (i) =>
				`[data-slot="wizard-rail-step"][data-step-index="${i}"]`;

			await d.wait(450);
			// Advance to Step 2 (Region) via Continue.
			await d.move(nextBtn, 520, { x: 0.5, y: 0.5 });
			await d.wait(160);
			await d.click();
			await d.wait(560);
			// Advance to Step 3 (Domain, optional).
			await d.click();
			await d.wait(520);
			// Step back briefly via the Back button to show reversible motion.
			await d.move(backBtn, 560, { x: 0.5, y: 0.5 });
			await d.wait(150);
			await d.click();
			await d.wait(500);
			// Jump forward directly to visited step 3 by clicking its node.
			await d.move(stepBtn(2), 520, { x: 0.5, y: 0.35 });
			await d.wait(220);
			await d.click();
			await d.wait(480);
			// Skip optional step 3 to reach Launch.
			await d.move(skipBtn, 480, { x: 0.5, y: 0.5 });
			await d.wait(150);
			await d.click();
			await d.wait(560);
			// Complete the wizard via Deploy.
			await d.move(nextBtn, 420, { x: 0.5, y: 0.5 });
			await d.wait(160);
			await d.click();
			await d.wait(720);
			// Restart cleanly so the loop returns to exact frame 1.
			await d.move(resetBtn, 420, { x: 0.5, y: 0.5 });
			await d.wait(150);
			await d.click();
			await d.wait(520);
			await d.page.evaluate(() => {
				if (document.activeElement instanceof HTMLElement) {
					document.activeElement.blur();
				}
			});
			await d.move(d.rest, 560);
			await d.wait(500);
		},
	},
};
