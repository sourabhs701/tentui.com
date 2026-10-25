import { transformIcons } from "shadcn/utils";
import { Project, ScriptKind } from "ts-morph";

import { fixImport } from "@/lib/registry-transform";

function buildDisplayConfig(styleName: string) {
	return {
		$schema: "https://ui.shadcn.com/schema.json",
		style: styleName,
		rsc: true,
		tsx: true,
		tailwind: {
			config: "",
			css: "",
			baseColor: "neutral",
			cssVariables: true,
			prefix: "",
		},
		iconLibrary: "lucide",
		aliases: {
			components: "@/components",
			utils: "@/lib/utils",
			ui: "@/components/ui",
			lib: "@/lib",
			hooks: "@/hooks",
		},
		resolvedPaths: {
			cwd: "/",
			tailwindConfig: "",
			tailwindCss: "",
			utils: "@/lib/utils",
			components: "@/components",
			lib: "@/lib",
			hooks: "@/hooks",
			ui: "@/components/ui",
		},
	};
}

export async function formatCode(code: string, styleName: string) {
	const fixedCode = fixImport(code);

	try {
		const project = new Project({ compilerOptions: {} });
		const sourceFile = project.createSourceFile("component.tsx", fixedCode, {
			scriptKind: ScriptKind.TSX,
		});

		await transformIcons({
			filename: "component.tsx",
			raw: fixedCode,
			sourceFile,
			config: buildDisplayConfig(styleName),
		});

		return sourceFile.getFullText();
	} catch (error) {
		console.error("Transform failed:", error);
		return fixedCode;
	}
}
