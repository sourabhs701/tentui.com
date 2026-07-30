export interface WordPoints {
	positions: Float32Array;
	count: number;
	aspect: number;
}

export function buildWordPoints(word: string, size: number): WordPoints {
	const count = size * size;
	const width = 1024;
	const height = 320;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) throw new Error("Unable to create the word sampling canvas.");

	context.clearRect(0, 0, width, height);
	context.fillStyle = "#fff";
	context.textAlign = "center";
	context.textBaseline = "middle";

	let fontSize = 240;
	context.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
	const margin = 80;
	const measured = context.measureText(word).width;
	if (measured > width - margin) {
		fontSize = Math.floor(fontSize * ((width - margin) / measured));
		context.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
	}
	context.fillText(word, width / 2, height / 2);

	const data = context.getImageData(0, 0, width, height).data;
	const lit: [number, number][] = [];
	const stride = 2;

	for (let y = 0; y < height; y += stride) {
		for (let x = 0; x < width; x += stride) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha && alpha > 128) lit.push([x, y]);
		}
	}

	if (lit.length === 0) {
		for (let index = 0; index < 256; index++) {
			lit.push([width / 2, height / 2]);
		}
	}

	const aspect = width / height;
	const positions = new Float32Array(count * 4);
	for (let index = 0; index < count; index++) {
		const point = lit[(Math.random() * lit.length) | 0] ?? [
			width / 2,
			height / 2,
		];
		const jitterX = (Math.random() - 0.5) * stride;
		const jitterY = (Math.random() - 0.5) * stride;
		const normalizedX = ((point[0] + jitterX) / width - 0.5) * 2 * aspect;
		const normalizedY = -((point[1] + jitterY) / height - 0.5) * 2;

		positions[index * 4] = normalizedX;
		positions[index * 4 + 1] = normalizedY;
		positions[index * 4 + 2] = (Math.random() - 0.5) * 0.08;
		positions[index * 4 + 3] = Math.random();
	}

	return { positions, count, aspect };
}
