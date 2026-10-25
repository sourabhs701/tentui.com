import alchemy from "alchemy";
import { D1Database, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "../env/.env" });

// Share deploy state between CI and local prod deploys when a state token is
// set; otherwise fall back to the local .alchemy directory (e.g. `alchemy dev`).
const app = await alchemy("tentui.com", {
	stateStore: process.env.ALCHEMY_STATE_TOKEN
		? (scope) => new CloudflareStateStore(scope)
		: undefined,
});

const db = await D1Database("database", {
	adopt: true,
	migrationsDir: "../../packages/db/src/migrations",
});

export const server = await Worker("server", {
	name: "tent-server",
	cwd: "../../apps/server",
	entrypoint: "src/index.ts",
	compatibility: "node",
	url: true,
	adopt: true,
	observability: {
		enabled: true,
		headSamplingRate: 1,
		logs: {
			enabled: true,
			invocationLogs: true,
		},
		traces: {
			enabled: true,
		},
	},
	bindings: {
		DB: db,
		CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
		BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
		BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
	},
	dev: {
		port: 3000,
	},
	domains: [{ domainName: "api2.tentui.com", adopt: true }],
});

// Web (Next.js) deploys separately via wrangler — see apps/web/package.json.
console.log(`Server -> ${server.url}`);

await app.finalize();
