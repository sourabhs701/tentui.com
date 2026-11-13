// Scripted interactions for `record-component-videos.mjs`, keyed by component.
// Coordinates are CSS pixels in the 480x360 capture frame; string targets are
// Playwright selectors resolved when the step runs. Every scenario starts and
// ends with the cursor at rest so the clip loops cleanly.

// Pointer travel, in px, for the tick-ruler flicks and the final drag.
const TICK_RULER_FLICKS = [84, 137, 200];

export const scenarios = {
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
};
