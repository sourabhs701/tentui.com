import registry from "../../registry.json";

// Installable items only (no demos or previews); small enough for middleware.
const registrySlugs = new Set(registry.items.map((item) => item.name));

export function isRegistrySlug(slug: string) {
	return registrySlugs.has(slug);
}
