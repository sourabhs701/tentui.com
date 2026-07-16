let audioContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

export function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

export async function decodeAudioData(dataUri: string): Promise<AudioBuffer> {
	const cached = bufferCache.get(dataUri);
	if (cached) return cached;

	const context = getAudioContext();
	const base64 = dataUri.split(",")[1];
	if (!base64) throw new Error("Invalid sound data URI");

	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let index = 0; index < binaryString.length; index++) {
		bytes[index] = binaryString.charCodeAt(index);
	}

	const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0));
	bufferCache.set(dataUri, audioBuffer);
	return audioBuffer;
}
