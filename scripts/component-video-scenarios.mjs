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
			// Half to full: the sheet pops at the top and the map scales back.
			await drag(40, 700);
			await d.wait(1000);
			// Full down to the peek height.
			await drag(285, 800);
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

	"swipe-actions": {
		rest: { x: 455, y: 330 },
		async run(d) {
			const row = (sender) =>
				`[data-slot="swipe-actions"][aria-label="Email from ${sender}"]`;
			const swipe = async (sender, from, distance, ms, holdMs = 150) => {
				const box = await d.page.locator(row(sender)).boundingBox();
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
			await d.wait(2000);
			// A long swipe right on row 1 arms Pin, fires it, and snaps back.
			await swipe("Ava Chen", 0.18, 250, 750, 300);
			await d.wait(900);
			// A shorter swipe left on row 2 reveals Archive and Delete.
			await swipe("Marcus Webb", 0.8, -150, 600);
			await d.wait(1000);
			// A full swipe on row 3 arms Delete, stretches it, and collapses the row.
			await swipe("Priya Raman", 0.85, -280, 900, 350);
			await d.wait(1100);
			await d.move(row("Leo Park"), 700, { x: 0.6, y: 0.5 });
			await d.wait(400);
			await d.move(
				`${row("Leo Park")} [data-slot="swipe-actions-handle"]`,
				450,
			);
			await d.wait(200);
			await d.click();
			await d.wait(2000);
			await d.move(d.rest, 800);
			await d.wait(500);
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
			await d.move(
				'[data-slot="tick-ruler-presets"] button:has-text("15")',
				750,
			);
			await d.wait(200);
			await d.click();
			await d.wait(1100);
			await d.move(d.rest, 800);
			await d.wait(500);
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
			for (const title of ["Installation", "Changelog", "Button", "Tooltip"]) {
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
			await d.move(button(1), 700, { x: 0.6, y: 0.6 });
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
};
