import { createGenerator, type Generator } from "fumadocs-typescript";

type GenerateTypeTableOptions = NonNullable<
	Parameters<Generator["generateTypeTable"]>[1]
>;

export const componentPropTag = "component-prop";

export const componentPropsOnly = {
	transform(entry, _propertyType, propertySymbol) {
		const componentSource = this.declaration.getSourceFile().getFilePath();
		const isComponentProp = propertySymbol
			.getDeclarations()
			.some(
				(declaration) =>
					declaration.getSourceFile().getFilePath() === componentSource,
			);

		if (isComponentProp) {
			entry.tags.push({ name: componentPropTag, text: "" });
		}
	},
} satisfies GenerateTypeTableOptions;

// Fumadocs does not include generation options in its cache key. Keeping the
// filesystem cache would allow unfiltered prop data to bypass the transform.
export const autoTypeTableGenerator = createGenerator();
