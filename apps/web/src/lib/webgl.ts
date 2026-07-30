type CompiledProgram = {
	program: WebGLProgram;
	dispose: () => void;
};

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
) {
	const shader = gl.createShader(type);
	if (!shader) return null;

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

export function createProgram(
	gl: WebGLRenderingContext,
	vertexSource: string,
	fragmentSource: string,
): CompiledProgram | null {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();

	if (!vertexShader || !fragmentShader || !program) {
		if (vertexShader) gl.deleteShader(vertexShader);
		if (fragmentShader) gl.deleteShader(fragmentShader);
		if (program) gl.deleteProgram(program);
		return null;
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		return null;
	}

	return {
		program,
		dispose: () => {
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
		},
	};
}

export function bindFullscreenQuad(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	attributeName: string,
) {
	const buffer = gl.createBuffer();
	const attribute = gl.getAttribLocation(program, attributeName);
	if (!buffer || attribute < 0) {
		if (buffer) gl.deleteBuffer(buffer);
		return null;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		gl.STATIC_DRAW,
	);
	gl.enableVertexAttribArray(attribute);
	gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

	return buffer;
}

export function hexToRgb(hex: string): [number, number, number] {
	let value = hex.replace("#", "").trim();

	if (value.length === 3) {
		value = `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`;
	}

	const parsed = Number.parseInt(value, 16);
	if (value.length !== 6 || Number.isNaN(parsed)) return [1, 0.3, 0];

	return [
		((parsed >> 16) & 255) / 255,
		((parsed >> 8) & 255) / 255,
		(parsed & 255) / 255,
	];
}
