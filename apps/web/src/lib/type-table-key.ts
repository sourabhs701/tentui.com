// Shared by scripts/build-registry.mts (which generates the type tables) and
// the app (which reads them), so keep this free of Node-only imports.

export const componentPropTag = "component-prop";

export type TypeTableQuery = {
	path?: string;
	name?: string;
	type?: string;
};

export function getTypeTableKey({ path, name, type }: TypeTableQuery) {
	return [path ?? "", name ?? "", type ?? ""].join("#");
}
