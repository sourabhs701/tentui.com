export interface Vec {
	x: number;
	y: number;
}

export interface Anchor {
	p: Vec;
	out: Vec | null;
	in: Vec | null;
}

export interface VectorPath {
	anchors: Anchor[];
	starts: number[];
	closed: boolean[];
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({
	x: a.x + b.x,
	y: a.y + b.y,
});
export const sub = (a: Vec, b: Vec): Vec => ({
	x: a.x - b.x,
	y: a.y - b.y,
});

export function subRange(path: VectorPath, index: number): [number, number] {
	return [
		path.starts[index],
		index + 1 < path.starts.length
			? path.starts[index + 1]
			: path.anchors.length,
	];
}
