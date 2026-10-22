// Scripted interactions for `record-component-videos.mjs`, keyed by component.
// Coordinates are CSS pixels in the 480x360 capture frame; string targets are
// Playwright selectors resolved when the step runs. Every scenario starts and
// ends with the cursor at rest so the clip loops cleanly.

export const scenarios = {
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
