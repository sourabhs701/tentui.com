import assert from "node:assert/strict";

import { isNewRegistryItem, isUpdatedRegistryItem } from "./registry";

const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

assert.equal(isNewRegistryItem({ meta: { createdAt: recent } }), true);
assert.equal(isNewRegistryItem({ meta: { createdAt: old } }), false);
assert.equal(
	isUpdatedRegistryItem({ meta: { createdAt: old, updatedAt: recent } }),
	true,
);
assert.equal(
	isUpdatedRegistryItem({ meta: { createdAt: recent, updatedAt: recent } }),
	false,
);
assert.equal(
	isUpdatedRegistryItem({ meta: { createdAt: old, updatedAt: old } }),
	false,
);
