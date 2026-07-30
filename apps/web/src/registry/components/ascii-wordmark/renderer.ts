import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import { buildAtlas, RAMP } from "./atlas";
import {
	ASCII_FRAG,
	ASCII_VERT,
	GPGPU_COMPUTE,
	PARTICLE_FRAG,
	PARTICLE_VERT,
	TRAIL_LEN,
} from "./shaders";
import { buildWordPoints } from "./word-points";

const FLOW_INFLUENCE = 0.43;
const FLOW_STRENGTH = 1.09;
const FLOW_FREQUENCY = 0.53;
const MOUSE_STRENGTH = 0.08;
const MOUSE_SPEED_GAIN = 1.5;
const RENDER_SCALE = 0.5;
const ASCII_CELL_DIVISOR = 100;

export interface AsciiWordmarkOptions {
	word: string;
	inkColor: string;
}

export class AsciiWordmarkRenderer {
	private readonly host: HTMLElement;
	private readonly options: AsciiWordmarkOptions;
	private readonly isTouch: boolean;
	private readonly reducedMotion: boolean;
	private readonly fboSize: number;
	private readonly maxDpr: number;

	private renderer!: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private camera!: THREE.PerspectiveCamera;
	private composer!: EffectComposer;
	private asciiPass!: ShaderPass;
	private gpgpu!: GPUComputationRenderer;
	private posVar!: ReturnType<GPUComputationRenderer["addVariable"]>;
	private points!: THREE.Points;
	private pointsMat!: THREE.ShaderMaterial;

	private readonly clock = new THREE.Clock();
	private raf = 0;
	private running = false;
	private onScreen = true;
	private disposed = false;

	private readonly mouse = new THREE.Vector3(9999, 9999, 0);
	private readonly prevMouse = new THREE.Vector3(9999, 9999, 0);
	private mouseSpeed = 0;
	private readonly mouseUv = new THREE.Vector2(9999, 9999);
	private onCard = false;

	private trailPos: THREE.Vector2[] = [];
	private trailAge = new Float32Array(TRAIL_LEN).fill(1);
	private trailOn = 0;
	private visibility = 0;
	private wordAspect = 3;
	private readonly wordMargin = 0.92;
	private readonly cleanupFns: (() => void)[] = [];
	private intersectionObserver?: IntersectionObserver;
	private resizeObserver?: ResizeObserver;

	constructor(host: HTMLElement, options: AsciiWordmarkOptions) {
		this.host = host;
		this.options = options;
		this.isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
		this.reducedMotion =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		this.fboSize = this.isTouch ? 128 : 200;
		this.maxDpr = this.isTouch ? 1.5 : 2;
	}

	mount(): boolean {
		const { clientWidth: width, clientHeight: height } = this.host;
		if (width === 0 || height === 0) return false;

		const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
		this.renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: false,
			powerPreference: "high-performance",
			failIfMajorPerformanceCaveat: false,
		});
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height);
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.domElement.setAttribute("aria-hidden", "true");
		Object.assign(this.renderer.domElement.style, {
			position: "absolute",
			inset: "0",
			width: "100%",
			height: "100%",
			display: "block",
			touchAction: "pan-y",
			userSelect: "none",
			WebkitUserSelect: "none",
		});
		this.host.appendChild(this.renderer.domElement);

		const { positions, count, aspect } = buildWordPoints(
			this.options.word,
			this.fboSize,
		);
		this.wordAspect = aspect;
		this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
		this.frameWord(width / height);
		this.camera.lookAt(0, 0, 0);

		if (!this.initGpgpu(positions)) return false;
		this.initPoints(count);
		this.initComposer(width, height, dpr);
		this.bindEvents();
		return true;
	}

	private initGpgpu(positions: Float32Array): boolean {
		this.gpgpu = new GPUComputationRenderer(
			this.fboSize,
			this.fboSize,
			this.renderer,
		);
		this.gpgpu.setDataType(THREE.HalfFloatType);

		const baseTexture = this.gpgpu.createTexture();
		(baseTexture.image.data as Float32Array).set(positions);
		const initialTexture = this.gpgpu.createTexture();
		(initialTexture.image.data as Float32Array).set(positions);

		this.posVar = this.gpgpu.addVariable(
			"uParticles",
			GPGPU_COMPUTE,
			initialTexture,
		);
		this.gpgpu.setVariableDependencies(this.posVar, [this.posVar]);

		const uniforms = this.posVar.material.uniforms;
		uniforms.uTime = { value: 0 };
		uniforms.uDeltaTime = { value: 0 };
		uniforms.uBase = { value: baseTexture };
		uniforms.uFlowFieldInfluence = { value: FLOW_INFLUENCE };
		uniforms.uFlowFieldStrength = { value: FLOW_STRENGTH };
		uniforms.uFlowFieldFrequency = { value: FLOW_FREQUENCY };
		uniforms.uMouse = { value: new THREE.Vector3(9999, 9999, 0) };
		uniforms.uMouseStrength = { value: MOUSE_STRENGTH };
		uniforms.uMouseSpeed = { value: 0 };

		const error = this.gpgpu.init();
		if (error) {
			console.warn("[ascii-wordmark] GPGPU unsupported, skipping:", error);
			return false;
		}
		return true;
	}

	private initPoints(count: number) {
		const geometry = new THREE.BufferGeometry();
		const uvs = new Float32Array(count * 2);
		const sizes = new Float32Array(count);
		let index = 0;

		for (let y = 0; y < this.fboSize; y++) {
			for (let x = 0; x < this.fboSize; x++) {
				uvs[index * 2] = (x + 0.5) / this.fboSize;
				uvs[index * 2 + 1] = (y + 0.5) / this.fboSize;
				sizes[index] = 0.6 + Math.random() * 0.8;
				index++;
			}
		}

		geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array(count * 3), 3),
		);
		geometry.setAttribute("aParticlesUv", new THREE.BufferAttribute(uvs, 2));
		geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
		geometry.setDrawRange(0, count);

		this.pointsMat = new THREE.ShaderMaterial({
			vertexShader: PARTICLE_VERT,
			fragmentShader: PARTICLE_FRAG,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {
				uResolution: { value: new THREE.Vector2() },
				uSize: { value: 4 },
				uVisibility: { value: 0 },
				uParticlesTexture: { value: null },
			},
		});

		this.points = new THREE.Points(geometry, this.pointsMat);
		this.points.frustumCulled = false;
		this.scene.add(this.points);
	}

	private initComposer(width: number, height: number, dpr: number) {
		const bufferWidth = Math.max(2, Math.round(width * RENDER_SCALE));
		const bufferHeight = Math.max(2, Math.round(height * RENDER_SCALE));

		this.composer = new EffectComposer(this.renderer);
		this.composer.setPixelRatio(dpr);
		this.composer.setSize(width, height);
		this.composer.addPass(new RenderPass(this.scene, this.camera));

		const atlasTexture = new THREE.CanvasTexture(buildAtlas(RAMP));
		atlasTexture.minFilter = THREE.LinearFilter;
		atlasTexture.magFilter = THREE.LinearFilter;
		const ink = new THREE.Color(this.options.inkColor);

		this.trailPos = Array.from(
			{ length: TRAIL_LEN },
			() => new THREE.Vector2(9999, 9999),
		);
		this.trailAge = new Float32Array(TRAIL_LEN).fill(1);
		this.asciiPass = new ShaderPass({
			uniforms: {
				tDiffuse: { value: null },
				uResolution: {
					value: new THREE.Vector2(bufferWidth * dpr, bufferHeight * dpr),
				},
				uAsciiPixelSize: {
					value: (bufferWidth * dpr) / ASCII_CELL_DIVISOR,
				},
				uAsciiTexture: { value: atlasTexture },
				uCharCount: { value: new THREE.Vector2(RAMP.length, 1) },
				uAsciiContrast: { value: 1.4 },
				uAsciiBrightness: { value: 0.12 },
				uAsciiMin: { value: 0 },
				uAsciiMax: { value: 1 },
				uAspect: { value: width / height },
				uInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
				uTrail: { value: this.trailPos },
				uTrailAge: { value: this.trailAge },
				uTrailOn: { value: 0 },
			},
			vertexShader: ASCII_VERT,
			fragmentShader: ASCII_FRAG,
		});
		this.asciiPass.renderToScreen = true;
		this.composer.addPass(this.asciiPass);
		this.pointsMat.uniforms.uResolution.value.set(width * dpr, height * dpr);
	}

	private bindEvents() {
		if (!this.reducedMotion) {
			const onPointerMove = (event: PointerEvent) => {
				if (event.pointerType === "touch") return;
				const bounds = this.host.getBoundingClientRect();
				const normalizedX =
					((event.clientX - bounds.left) / bounds.width) * 2 - 1;
				const normalizedY = -(
					((event.clientY - bounds.top) / bounds.height) * 2 -
					1
				);
				const projected = new THREE.Vector3(
					normalizedX,
					normalizedY,
					0.5,
				).unproject(this.camera);
				const direction = projected.sub(this.camera.position).normalize();
				const distance = -this.camera.position.z / direction.z;
				this.mouse
					.copy(this.camera.position)
					.add(direction.multiplyScalar(distance));
				this.mouseUv.set(
					(event.clientX - bounds.left) / bounds.width,
					1 - (event.clientY - bounds.top) / bounds.height,
				);
				this.onCard = true;
			};
			const onPointerLeave = () => {
				this.mouse.set(9999, 9999, 0);
				this.mouseUv.set(9999, 9999);
				this.onCard = false;
			};

			this.host.addEventListener("pointermove", onPointerMove);
			this.host.addEventListener("pointerleave", onPointerLeave);
			this.cleanupFns.push(() => {
				this.host.removeEventListener("pointermove", onPointerMove);
				this.host.removeEventListener("pointerleave", onPointerLeave);
			});
		}

		const onVisibilityChange = () =>
			document.hidden ? this.stop() : this.maybeStart();
		document.addEventListener("visibilitychange", onVisibilityChange);
		this.cleanupFns.push(() =>
			document.removeEventListener("visibilitychange", onVisibilityChange),
		);

		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				this.onScreen = entries[0]?.isIntersecting ?? true;
				this.onScreen ? this.maybeStart() : this.stop();
			},
			{ threshold: 0.01 },
		);
		this.intersectionObserver.observe(this.host);

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.host);
	}

	private frameWord(viewportAspect: number) {
		const halfVerticalFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
		const verticalTangent = Math.tan(halfVerticalFov);
		const distanceForHeight = 1 / verticalTangent;
		const distanceForWidth =
			this.wordAspect / (verticalTangent * viewportAspect);
		const distance =
			Math.max(distanceForHeight, distanceForWidth) * this.wordMargin;
		this.camera.position.set(0, 0, distance);
	}

	private resize() {
		if (this.disposed) return;
		const { clientWidth: width, clientHeight: height } = this.host;
		if (width === 0 || height === 0) return;

		const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height);
		this.composer.setPixelRatio(dpr);
		this.composer.setSize(width, height);
		this.camera.aspect = width / height;
		this.frameWord(width / height);
		this.camera.updateProjectionMatrix();

		const bufferWidth = Math.max(2, Math.round(width * RENDER_SCALE));
		const bufferHeight = Math.max(2, Math.round(height * RENDER_SCALE));
		this.asciiPass.uniforms.uResolution.value.set(
			bufferWidth * dpr,
			bufferHeight * dpr,
		);
		this.asciiPass.uniforms.uAsciiPixelSize.value =
			(bufferWidth * dpr) / ASCII_CELL_DIVISOR;
		this.asciiPass.uniforms.uAspect.value = width / height;
		this.pointsMat.uniforms.uResolution.value.set(width * dpr, height * dpr);

		if (this.reducedMotion) this.renderStatic();
	}

	start() {
		this.onScreen = true;
		this.maybeStart();
	}

	private maybeStart() {
		if (this.disposed || !this.onScreen || document.hidden) return;
		if (this.reducedMotion) {
			this.renderStatic();
			return;
		}
		if (this.running) return;

		this.running = true;
		this.clock.getDelta();
		this.raf = requestAnimationFrame(this.loop);
	}

	stop() {
		this.running = false;
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private renderStatic() {
		if (this.disposed || !this.composer) return;
		const uniforms = this.posVar.material.uniforms;
		uniforms.uDeltaTime.value = 0;
		this.gpgpu.compute();
		this.pointsMat.uniforms.uParticlesTexture.value =
			this.gpgpu.getCurrentRenderTarget(this.posVar).texture;
		this.pointsMat.uniforms.uVisibility.value = 1;
		this.asciiPass.uniforms.uTrailOn.value = 0;
		this.composer.render();
	}

	private advanceTrail(deltaTime: number) {
		const trailLife = 0.75;
		for (let index = 0; index < TRAIL_LEN; index++) {
			this.trailAge[index] = Math.min(
				1,
				(this.trailAge[index] ?? 1) + deltaTime / trailLife,
			);
		}

		if (this.onCard) {
			for (let index = TRAIL_LEN - 1; index > 0; index--) {
				this.trailPos[index]?.copy(this.trailPos[index - 1] ?? this.mouseUv);
				this.trailAge[index] = this.trailAge[index - 1] ?? 1;
			}
			this.trailPos[0]?.copy(this.mouseUv);
			this.trailAge[0] = 0;
		}
		this.asciiPass.uniforms.uTrailAge.value = this.trailAge;
	}

	private readonly loop = () => {
		if (!this.running) return;

		const deltaTime = Math.min(this.clock.getDelta(), 1 / 30);
		const elapsedTime = this.clock.elapsedTime;
		this.mouseSpeed = this.mouse.distanceTo(this.prevMouse);
		if (this.mouse.x > 9000) this.mouseSpeed = 0;
		this.prevMouse.copy(this.mouse);

		const computeUniforms = this.posVar.material.uniforms;
		computeUniforms.uTime.value = elapsedTime;
		computeUniforms.uDeltaTime.value = deltaTime;
		computeUniforms.uMouse.value.copy(this.mouse);
		computeUniforms.uMouseSpeed.value = this.mouseSpeed * MOUSE_SPEED_GAIN;
		this.gpgpu.compute();

		this.pointsMat.uniforms.uParticlesTexture.value =
			this.gpgpu.getCurrentRenderTarget(this.posVar).texture;
		this.visibility = Math.min(1, this.visibility + deltaTime * 0.9);
		this.pointsMat.uniforms.uVisibility.value = this.visibility;

		this.advanceTrail(deltaTime);
		this.trailOn +=
			((this.onCard ? 1 : 0) - this.trailOn) * Math.min(1, deltaTime * 6);
		this.asciiPass.uniforms.uTrailOn.value = this.trailOn;
		this.composer.render();
		this.raf = requestAnimationFrame(this.loop);
	};

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.stop();
		for (const cleanup of this.cleanupFns) cleanup();
		this.intersectionObserver?.disconnect();
		this.resizeObserver?.disconnect();
		this.points?.geometry.dispose();
		this.pointsMat?.dispose();
		this.asciiPass?.uniforms.uAsciiTexture.value?.dispose?.();
		this.gpgpu?.dispose();
		this.composer?.dispose();
		this.renderer?.dispose();
		this.renderer?.forceContextLoss();
		this.renderer?.domElement.remove();
	}
}
