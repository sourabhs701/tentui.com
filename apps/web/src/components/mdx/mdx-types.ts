export type MdxAttribute = {
	name: string;
	value?: unknown;
};

export type MdxNode = {
	type: string;
	name?: string;
	tagName?: string;
	attributes?: MdxAttribute[];
	properties?: Record<string, unknown>;
	data?: Record<string, unknown>;
	children?: MdxNode[];
	value?: string;
	__rawString__?: string;
};

export type MdxTree = {
	type: string;
	children: MdxNode[];
};
