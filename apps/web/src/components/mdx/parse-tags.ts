type RawTag = { name: string; text: string };

export type TypedTags = {
	default?: string;
	params?: Array<{ name: string; description?: string }>;
	example?: string;
	returns?: string;
};

export function parseTags(tags: RawTag[]): TypedTags {
	const parsed: TypedTags = {};

	for (const { name, text } of tags) {
		if (name === "default" || name === "defaultValue") {
			parsed.default = text;
			continue;
		}
		if (name === "param") {
			const [parameter, description] = text.split("-", 2);
			parsed.params ??= [];
			parsed.params.push({
				name: parameter.trim(),
				description: description?.trim(),
			});
			continue;
		}
		if (name === "example") parsed.example = text;
		if (name === "returns") parsed.returns = text;
	}

	return parsed;
}
