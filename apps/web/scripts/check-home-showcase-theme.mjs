import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });

try {
	const page = await browser.newPage({ colorScheme: "light" });
	await page.addInitScript(() => localStorage.setItem("theme", "dark"));
	await page.goto(process.env.BASE_URL ?? "http://localhost:3001");

	const showcase = page
		.getByRole("heading", { name: /unique components/i })
		.locator("..")
		.locator("..");
	const lightImages = showcase.locator('img[alt$=" light preview"]');
	const darkImages = showcase.locator('img[alt$=" dark preview"]');

	await darkImages.first().waitFor({ timeout: 2000 });
	const imageCount = await darkImages.count();
	assert(imageCount > 0);
	assert.equal(await lightImages.count(), imageCount);

	for (const image of await darkImages.all()) assert(await image.isVisible());
	for (const image of await lightImages.all())
		assert(!(await image.isVisible()));
} finally {
	await browser.close();
}
