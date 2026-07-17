type UnistPoint = {
	line: number;
	column: number;
	offset?: number;
};

type UnistPosition = {
	start: UnistPoint;
	end: UnistPoint;
	indent?: number[];
};

export interface UnistNode {
	type: string;
	data?: Record<string, unknown>;
	position?: UnistPosition;
	name?: string;
	tagName?: string;
	value?: string;
	properties?: {
		__rawString__?: string;
		[key: string]: unknown;
	} & NpmCommands;
	attributes?: {
		name: string;
		value: unknown;
		type?: string;
	}[];
	children?: UnistNode[];
	__rawString__?: string;
}

export interface UnistTree extends UnistNode {
	children: UnistNode[];
}

export interface NpmCommands {
	__pnpm__?: string;
	__yarn__?: string;
	__npm__?: string;
	__bun__?: string;
}
