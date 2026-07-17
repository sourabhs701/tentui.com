import {
	createFileSystemGeneratorCache,
	createGenerator,
} from "fumadocs-typescript";

export const autoTypeTableGenerator = createGenerator({
	cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});
