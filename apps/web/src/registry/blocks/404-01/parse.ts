import type { Anchor, Vec, VectorPath } from "./types";
import { subRange, v } from "./types";

type Token = { cmd: string; args: number[] };

function tokenize(d: string): Token[] {
	const tokens: Token[] = [];
	const pattern = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
	let match = pattern.exec(d);
	let current: Token | null = null;

	while (match) {
		if (match[1]) {
			current = { cmd: match[1], args: [] };
			tokens.push(current);
		} else if (current) {
			current.args.push(Number.parseFloat(match[2]));
		}
		match = pattern.exec(d);
	}

	return tokens;
}

export function parsePath(d: string): VectorPath {
	const tokens = tokenize(d);
	const anchors: Anchor[] = [];
	const starts: number[] = [];
	const closed: boolean[] = [];
	let current = v(0, 0);
	let start = v(0, 0);
	let previousControl: Vec | null = null;
	let previousCommand = "";

	const push = (p: Vec) => anchors.push({ p, out: null, in: null });
	const last = () => anchors[anchors.length - 1];
	const dedupeClose = () => {
		if (!starts.length) return;
		const startIndex = starts.at(-1) ?? 0;
		if (anchors.length - startIndex < 2) return;

		const first = anchors[startIndex].p;
		const final = anchors.at(-1);
		if (
			final &&
			Math.abs(first.x - final.p.x) < 0.01 &&
			Math.abs(first.y - final.p.y) < 0.01
		) {
			anchors[startIndex].in = final.in;
			anchors.pop();
		}
	};

	for (const { cmd, args } of tokens) {
		const relative = cmd === cmd.toLowerCase();
		const command = cmd.toUpperCase();
		let index = 0;
		const number = () => args[index++];
		const point = (): Vec => {
			const x = number();
			const y = number();
			return relative ? { x: current.x + x, y: current.y + y } : { x, y };
		};

		switch (command) {
			case "M": {
				if (starts.length && closed.at(-1)) dedupeClose();
				current = point();
				start = current;
				starts.push(anchors.length);
				closed.push(false);
				push(current);
				while (index < args.length) {
					current = point();
					push(current);
				}
				previousControl = null;
				break;
			}
			case "L": {
				while (index < args.length) {
					current = point();
					push(current);
				}
				previousControl = null;
				break;
			}
			case "H": {
				while (index < args.length) {
					const x = number();
					current = { x: relative ? current.x + x : x, y: current.y };
					push(current);
				}
				previousControl = null;
				break;
			}
			case "V": {
				while (index < args.length) {
					const y = number();
					current = { x: current.x, y: relative ? current.y + y : y };
					push(current);
				}
				previousControl = null;
				break;
			}
			case "C": {
				while (index < args.length) {
					const firstControl = point();
					const secondControl = point();
					const end = point();
					last().out = firstControl;
					push(end);
					last().in = secondControl;
					current = end;
					previousControl = secondControl;
				}
				break;
			}
			case "S": {
				while (index < args.length) {
					const canReflect =
						previousCommand === "C" || previousCommand === "S" || index > 0;
					const firstControl = canReflect
						? {
								x: 2 * current.x - (previousControl?.x ?? current.x),
								y: 2 * current.y - (previousControl?.y ?? current.y),
							}
						: current;
					const secondControl = point();
					const end = point();
					last().out = firstControl;
					push(end);
					last().in = secondControl;
					current = end;
					previousControl = secondControl;
				}
				break;
			}
			case "Q": {
				while (index < args.length) {
					const quadraticControl: Vec = point();
					const end = point();
					last().out = {
						x: current.x + (2 / 3) * (quadraticControl.x - current.x),
						y: current.y + (2 / 3) * (quadraticControl.y - current.y),
					};
					push(end);
					last().in = {
						x: end.x + (2 / 3) * (quadraticControl.x - end.x),
						y: end.y + (2 / 3) * (quadraticControl.y - end.y),
					};
					current = end;
					previousControl = quadraticControl;
				}
				break;
			}
			case "T": {
				while (index < args.length) {
					const canReflect =
						previousCommand === "Q" || previousCommand === "T" || index > 0;
					const quadraticControl: Vec = canReflect
						? {
								x: 2 * current.x - (previousControl?.x ?? current.x),
								y: 2 * current.y - (previousControl?.y ?? current.y),
							}
						: current;
					const end = point();
					last().out = {
						x: current.x + (2 / 3) * (quadraticControl.x - current.x),
						y: current.y + (2 / 3) * (quadraticControl.y - current.y),
					};
					push(end);
					last().in = {
						x: end.x + (2 / 3) * (quadraticControl.x - end.x),
						y: end.y + (2 / 3) * (quadraticControl.y - end.y),
					};
					current = end;
					previousControl = quadraticControl;
				}
				break;
			}
			case "Z": {
				if (closed.length) closed[closed.length - 1] = true;
				current = start;
				previousControl = null;
				break;
			}
			case "A":
				throw new Error(
					"Arc commands (A) are not supported by the point editor.",
				);
			default:
				throw new Error(`Unsupported path command: ${cmd}`);
		}

		previousCommand = command;
	}

	if (starts.length && closed.at(-1)) dedupeClose();
	return { anchors, starts, closed };
}

const formatNumber = (value: number) => String(Math.round(value * 100) / 100);

export function serializePath(path: VectorPath): string {
	const { anchors, starts, closed } = path;
	if (!anchors.length || !starts.length) return "";
	const parts: string[] = [];

	for (let index = 0; index < starts.length; index++) {
		const [begin, end] = subRange(path, index);
		const count = end - begin;
		if (!count) continue;

		parts.push(
			`M ${formatNumber(anchors[begin].p.x)} ${formatNumber(anchors[begin].p.y)}`,
		);
		const segmentCount = closed[index] ? count : count - 1;

		for (let segment = 0; segment < segmentCount; segment++) {
			const anchor = anchors[begin + segment];
			const next = anchors[begin + ((segment + 1) % count)];
			if (anchor.out || next.in) {
				const firstControl = anchor.out ?? anchor.p;
				const secondControl = next.in ?? next.p;
				parts.push(
					`C ${formatNumber(firstControl.x)} ${formatNumber(firstControl.y)} ${formatNumber(secondControl.x)} ${formatNumber(secondControl.y)} ${formatNumber(next.p.x)} ${formatNumber(next.p.y)}`,
				);
			} else {
				parts.push(`L ${formatNumber(next.p.x)} ${formatNumber(next.p.y)}`);
			}
		}

		if (closed[index]) parts.push("Z");
	}

	return parts.join(" ");
}
