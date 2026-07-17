export function fixImport(content: string) {
	let fixed = content
		.replaceAll("@tentui.com/ui/components/", "@/components/ui/")
		.replaceAll("@tentui.com/ui/hooks/", "@/hooks/")
		.replaceAll("@tentui.com/ui/lib/", "@/lib/");

	const registryAlias =
		/@\/(.+?)\/((?:.*?\/)?(?:components|ui|hooks|lib))\/([\w/-]+)/g;

	fixed = fixed.replace(
		registryAlias,
		(match, _registryPath: string, type: string, itemPath: string) => {
			if (type.endsWith("components")) {
				return `@/components/${itemPath}`;
			}
			if (type.endsWith("ui")) {
				return `@/components/ui/${itemPath}`;
			}
			if (type.endsWith("hooks")) {
				return `@/hooks/${itemPath}`;
			}
			if (type.endsWith("lib")) {
				return `@/lib/${itemPath}`;
			}

			return match;
		},
	);

	return fixed;
}

export function processFileContent(type: string, content: string | undefined) {
	let code = content ?? "";

	if (type !== "registry:page") {
		code = code.replaceAll("export default", "export");
	}

	return fixImport(code);
}
