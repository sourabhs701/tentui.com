import { registryConfig } from "@/config/registry";

const BADGE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type RegistryItemMetadata = {
	meta?: { createdAt?: string; updatedAt?: string };
};

function isRecent(date?: string) {
	return date
		? Date.now() - new Date(date).getTime() < BADGE_DURATION_MS
		: false;
}

export function isNewRegistryItem(item: RegistryItemMetadata): boolean {
	return isRecent(item.meta?.createdAt);
}

export function isUpdatedRegistryItem(item: RegistryItemMetadata): boolean {
	const { createdAt, updatedAt } = item.meta ?? {};
	return updatedAt !== createdAt && isRecent(updatedAt);
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
