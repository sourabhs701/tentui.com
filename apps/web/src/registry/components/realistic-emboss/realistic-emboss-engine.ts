export interface EmbossOptions {
	text: string;
	svg: string | null;
	color: string;
	depth: number;
	size: number;
	soften: number;
	lightAngle: number;
	lightAltitude: number;
	highlight: number;
	shadow: number;
	grain: number;
	brightness: number;
	contentScale: number;
	contentPosition: readonly [number, number];
	fontFamily: string;
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
varying vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform float uLightZ;
uniform float uDepth;
uniform float uHighlight;
uniform float uShadow;
uniform float uGrain;
uniform float uBrightness;
uniform float uAspect;
uniform vec3 uColor;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
    local.y
  );
}

float plaster(vec2 point) {
  float value = 0.0;
  value += noise(point) * 0.55;
  value += noise(point * 2.07 + 17.4) * 0.28;
  value += noise(point * 5.13 + 41.8) * 0.12;
  value += noise(point * 12.7 + 9.2) * 0.05;
  return value;
}

void main() {
  float leftHeight = texture2D(uField, vUv - vec2(uTexel.x, 0.0)).g;
  float rightHeight = texture2D(uField, vUv + vec2(uTexel.x, 0.0)).g;
  float downHeight = texture2D(uField, vUv - vec2(0.0, uTexel.y)).g;
  float upHeight = texture2D(uField, vUv + vec2(0.0, uTexel.y)).g;
  float face = texture2D(uField, vUv).r;

  vec2 slope = vec2(rightHeight - leftHeight, upHeight - downHeight) * uDepth * 18.0;
  vec3 normal = normalize(vec3(slope.x, slope.y, 1.0));
  vec3 light = normalize(vec3(uLight, uLightZ));
  float bevel = clamp(length(slope), 0.0, 1.0);
  float lightAmount = dot(normal, light);
  float highlight = pow(max(lightAmount, 0.0), 1.25) * bevel;
  float shadow = pow(max(-lightAmount, 0.0), 1.05) * bevel;

  vec2 surfaceUv = vUv * vec2(max(1.0, uAspect), 1.0);
  float broadGrain = plaster(surfaceUv * 6.0 + vec2(3.7, 8.1));
  float fineGrain = noise(surfaceUv * 110.0 + vec2(19.0, 7.0));
  float surface = (broadGrain - 0.5) * 0.72 + (fineGrain - 0.5) * 0.28;
  vec3 color = uColor * (uBrightness + surface * uGrain * 0.22);

  float pressedFace = smoothstep(0.35, 0.72, face);
  color *= mix(1.0, 0.945, pressedFace);
  color += highlight * uHighlight;
  color -= shadow * uShadow;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

const FIELD_KEYS: Array<keyof EmbossOptions> = [
	"text",
	"svg",
	"size",
	"soften",
	"contentScale",
	"contentPosition",
	"fontFamily",
];

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Could not create emboss shader");

	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? "Emboss shader failed";
		gl.deleteShader(shader);
		throw new Error(message);
	}

	return shader;
}

function createProgram(gl: WebGLRenderingContext) {
	const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
	const program = gl.createProgram();
	if (!program) throw new Error("Could not create emboss program");

	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? "Emboss program failed";
		gl.deleteProgram(program);
		throw new Error(message);
	}

	return program;
}

function colorToRgb(color: string): [number, number, number] {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d");
	if (!context) return [0.78, 0.72, 0.63];

	context.fillStyle = "#c7b8a1";
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	const pixel = context.getImageData(0, 0, 1, 1).data;
	return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];
}

function loadImage(source: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = source;
	});
}

function prepareSvg(svg: string) {
	const safe = svg
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
		.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");

	return safe.replace(
		/<svg([^>]*)>/i,
		"<svg$1><style>*{fill:#fff!important;stroke:#fff!important}</style>",
	);
}

async function drawContent(
	context: CanvasRenderingContext2D,
	options: EmbossOptions,
	width: number,
	height: number,
) {
	const [positionX, positionY] = options.contentPosition;
	const centerX = width * positionX;
	const centerY = height * positionY;
	const maxWidth = width * 0.86;
	const maxHeight = height * options.contentScale;

	if (options.svg?.trim()) {
		const blob = new Blob([prepareSvg(options.svg)], {
			type: "image/svg+xml",
		});
		const url = URL.createObjectURL(blob);
		try {
			const image = await loadImage(url);
			const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
			let drawHeight = maxHeight;
			let drawWidth = drawHeight * aspect;
			if (drawWidth > maxWidth) {
				drawWidth = maxWidth;
				drawHeight = drawWidth / aspect;
			}
			context.drawImage(
				image,
				centerX - drawWidth / 2,
				centerY - drawHeight / 2,
				drawWidth,
				drawHeight,
			);
		} finally {
			URL.revokeObjectURL(url);
		}
		return;
	}

	if (!options.text.trim()) return;

	let fontSize = maxHeight;
	context.font = `800 ${fontSize}px ${options.fontFamily}`;
	const measuredWidth = context.measureText(options.text).width;
	if (measuredWidth > maxWidth) {
		fontSize *= maxWidth / measuredWidth;
		context.font = `800 ${fontSize}px ${options.fontFamily}`;
	}
	context.fillStyle = "#fff";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(options.text, centerX, centerY);
}

async function makeField(
	options: EmbossOptions,
	width: number,
	height: number,
	cssWidth: number,
) {
	const crisp = document.createElement("canvas");
	crisp.width = width;
	crisp.height = height;
	const crispContext = crisp.getContext("2d", { willReadFrequently: true });
	if (!crispContext) throw new Error("Could not create emboss field");
	await drawContent(crispContext, options, width, height);

	const soft = document.createElement("canvas");
	soft.width = width;
	soft.height = height;
	const softContext = soft.getContext("2d", { willReadFrequently: true });
	if (!softContext) throw new Error("Could not soften emboss field");
	const fieldScale = width / Math.max(1, cssWidth);
	const blur = Math.max(0.5, (options.size + options.soften) * fieldScale);
	softContext.filter = `blur(${blur.toFixed(2)}px)`;
	softContext.drawImage(crisp, 0, 0);
	softContext.filter = "none";

	const packed = document.createElement("canvas");
	packed.width = width;
	packed.height = height;
	const packedContext = packed.getContext("2d");
	if (!packedContext) throw new Error("Could not pack emboss field");

	const crispPixels = crispContext.getImageData(0, 0, width, height).data;
	const softPixels = softContext.getImageData(0, 0, width, height).data;
	const output = packedContext.createImageData(width, height);
	for (let index = 0; index < output.data.length; index += 4) {
		output.data[index] = crispPixels[index + 3];
		output.data[index + 1] = softPixels[index + 3];
		output.data[index + 3] = 255;
	}
	packedContext.putImageData(output, 0, 0);
	return packed;
}

export class EmbossEngine {
	private readonly host: HTMLElement;
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly program: WebGLProgram;
	private readonly field: WebGLTexture;
	private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
	private options: EmbossOptions;
	private width = 0;
	private height = 0;
	private fieldWidth = 1;
	private fieldHeight = 1;
	private fieldSequence = 0;
	private frame = 0;
	private ready = false;
	private destroyed = false;

	constructor(host: HTMLElement, options: EmbossOptions) {
		this.host = host;
		this.options = options;
		this.canvas = document.createElement("canvas");
		Object.assign(this.canvas.style, {
			position: "absolute",
			inset: "0",
			width: "100%",
			height: "100%",
			display: "block",
			opacity: "0",
		});
		const gl = this.canvas.getContext("webgl", {
			alpha: false,
			antialias: false,
			premultipliedAlpha: false,
		});
		if (!gl) throw new Error("WebGL is unavailable");
		this.gl = gl;
		this.program = createProgram(gl);
		const field = gl.createTexture();
		if (!field) throw new Error("Could not create emboss texture");
		this.field = field;

		for (const name of [
			"uField",
			"uTexel",
			"uLight",
			"uLightZ",
			"uDepth",
			"uHighlight",
			"uShadow",
			"uGrain",
			"uBrightness",
			"uAspect",
			"uColor",
		]) {
			this.uniforms[name] = gl.getUniformLocation(this.program, name);
		}

		const position = gl.getAttribLocation(this.program, "aPosition");
		const uv = gl.getAttribLocation(this.program, "aUv");
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
			gl.STATIC_DRAW,
		);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
		gl.useProgram(this.program);
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
		gl.enableVertexAttribArray(uv);
		gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
		gl.clearColor(1, 1, 1, 1);

		this.host.appendChild(this.canvas);
		this.resize();
	}

	setOptions(options: EmbossOptions) {
		const rebuild = FIELD_KEYS.some((key) => {
			if (key !== "contentPosition") return options[key] !== this.options[key];
			return (
				options.contentPosition[0] !== this.options.contentPosition[0] ||
				options.contentPosition[1] !== this.options.contentPosition[1]
			);
		});
		this.options = options;
		if (rebuild) void this.rebuildField();
		else this.renderOnce();
	}

	resize() {
		const bounds = this.host.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const width = Math.max(1, Math.round(bounds.width * dpr));
		const height = Math.max(1, Math.round(bounds.height * dpr));
		const changed =
			width !== this.canvas.width || height !== this.canvas.height;
		this.width = bounds.width;
		this.height = bounds.height;
		if (!changed) return;

		this.canvas.width = width;
		this.canvas.height = height;
		this.gl.viewport(0, 0, width, height);
		void this.rebuildField();
	}

	private async rebuildField() {
		if (this.destroyed || this.width <= 0 || this.height <= 0) return;
		const sequence = ++this.fieldSequence;
		const fieldWidth = Math.max(
			2,
			Math.min(1400, Math.round(this.width * 1.5)),
		);
		const fieldHeight = Math.max(
			2,
			Math.round(fieldWidth * (this.height / this.width)),
		);

		try {
			const field = await makeField(
				this.options,
				fieldWidth,
				fieldHeight,
				this.width,
			);
			if (this.destroyed || sequence !== this.fieldSequence) return;

			const gl = this.gl;
			gl.bindTexture(gl.TEXTURE_2D, this.field);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				field,
			);
			this.fieldWidth = field.width;
			this.fieldHeight = field.height;
			this.ready = true;
			this.renderOnce();
		} catch {
			// Invalid SVG input leaves the surface intact and the component usable.
		}
	}

	private renderOnce() {
		if (this.frame || this.destroyed) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.render();
		});
	}

	private render() {
		if (!this.ready || this.destroyed) return;
		const gl = this.gl;
		const options = this.options;
		const angle = (options.lightAngle * Math.PI) / 180;
		const altitude = (options.lightAltitude * Math.PI) / 180;
		const color = colorToRgb(options.color);

		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
		gl.useProgram(this.program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.field);
		gl.uniform1i(this.uniforms.uField, 0);
		gl.uniform2f(
			this.uniforms.uTexel,
			1 / this.fieldWidth,
			1 / this.fieldHeight,
		);
		gl.uniform2f(this.uniforms.uLight, Math.cos(angle), Math.sin(angle));
		gl.uniform1f(this.uniforms.uLightZ, Math.max(0.25, Math.sin(altitude)));
		gl.uniform1f(this.uniforms.uDepth, options.depth);
		gl.uniform1f(this.uniforms.uHighlight, options.highlight);
		gl.uniform1f(this.uniforms.uShadow, options.shadow);
		gl.uniform1f(this.uniforms.uGrain, options.grain);
		gl.uniform1f(this.uniforms.uBrightness, options.brightness);
		gl.uniform1f(this.uniforms.uAspect, this.width / Math.max(1, this.height));
		gl.uniform3f(this.uniforms.uColor, color[0], color[1], color[2]);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		this.canvas.style.opacity = "1";
	}

	destroy() {
		this.destroyed = true;
		this.fieldSequence += 1;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.gl.deleteTexture(this.field);
		this.gl.deleteProgram(this.program);
		this.gl.getExtension("WEBGL_lose_context")?.loseContext();
		this.canvas.remove();
	}
}
