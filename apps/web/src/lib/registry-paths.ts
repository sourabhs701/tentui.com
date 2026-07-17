export function basename(filePath: string): string {
	const normalized = filePath.replaceAll("\\", "/");
	const parts = normalized.split("/");
	return parts[parts.length - 1] || normalized;
}

export function dirname(filePath: string): string {
	const normalized = filePath.replaceAll("\\", "/");
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return ".";
	return normalized.slice(0, idx);
}

export function relativePath(fromDir: string, toPath: string): string {
	const from = fromDir.replaceAll("\\", "/").split("/").filter(Boolean);
	const to = toPath.replaceAll("\\", "/").split("/").filter(Boolean);

	let i = 0;
	while (i < from.length && i < to.length && from[i] === to[i]) {
		i++;
	}

	const ups = from.slice(i).map(() => "..");
	const downs = to.slice(i);
	const result = [...ups, ...downs].join("/");
	return result || ".";
}

export function normalizeProjectPath(filePath: string): string {
	const normalized = filePath.replaceAll("\\", "/");
	if (!normalized.startsWith("/") && !/^[A-Za-z]:\//.test(normalized)) {
		return normalized;
	}

	const marker = "/src/registry/";
	const idx = normalized.lastIndexOf(marker);
	if (idx !== -1) {
		return normalized.slice(idx + 1);
	}

	return basename(normalized);
}
