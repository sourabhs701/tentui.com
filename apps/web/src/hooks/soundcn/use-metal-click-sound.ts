import { metalClickSound } from "@/lib/soundcn/metal-click";

import { useSound } from "./use-sound";

export function useMetalClickSound() {
	return useSound(metalClickSound, { volume: 0.1 });
}
