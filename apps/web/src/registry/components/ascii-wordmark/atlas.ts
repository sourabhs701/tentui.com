export const RAMP = " .:-=+*#%VAULT";

export function buildAtlas(ramp = RAMP, cell = 64): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = cell * ramp.length;
	canvas.height = cell;

	const context = canvas.getContext("2d");
	if (!context) throw new Error("Unable to create the ASCII atlas canvas.");

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "#fff";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.font = `${Math.floor(cell * 0.74)}px ui-monospace, "SF Mono", Menlo, monospace`;

	for (let index = 0; index < ramp.length; index++) {
		const character = ramp[index];
		if (character && character !== " ") {
			context.fillText(
				character,
				index * cell + cell / 2,
				cell / 2 + cell * 0.04,
			);
		}
	}

	return canvas;
}
