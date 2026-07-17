import { registryConfig } from "@/config/registry";

const NEW_BADGE_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type ComponentMetadata = {
	meta?: { createdAt?: string };
};

export function isNewComponent(component: ComponentMetadata): boolean {
	const addedAt = component.meta?.createdAt;
	if (!addedAt) return false;

	const addedTime = new Date(addedAt).getTime();
	return Date.now() - addedTime < NEW_BADGE_DURATION_MS;
}

export function getRegistryItemUrl(item: string) {
	return registryConfig.namespaceUrl.replace("{name}", item);
}

export function getRegistryItemUrls(...items: string[]) {
	return items.map(getRegistryItemUrl);
}

export function getRegistryItemNamespace(item: string) {
	return `${registryConfig.namespace}/${item}`;
}
