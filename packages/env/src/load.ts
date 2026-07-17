import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

export const envDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnvFiles() {
	if (typeof process === "undefined") return;

	const load = (file: string, override = false) => {
		const path = resolve(envDir, file);
		if (!existsSync(path)) return;
		config({ path, override });
	};

	load(".env");
	if (process.env.NODE_ENV === "production") {
		load(".env.prod", true);
	}
}
