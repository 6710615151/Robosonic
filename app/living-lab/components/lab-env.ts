// Browser-only facts the Living Lab shows to people. Each check reads something real on this device;
// nothing here is guessed or simulated.

// The key the creation flow and the passport card use for the owner's edit key
// (LivingLabClient.tsx and passport/[token]/PassportCardClient.tsx).
export const EDIT_KEY_PREFIX = "hri-passport-edit:";

// Access token of a passport whose edit key this browser holds, or null.
export function findOwnPassport(): string | null {
  try {
    let found: string | null = null;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(EDIT_KEY_PREFIX) && key.length > EDIT_KEY_PREFIX.length) found = key.slice(EDIT_KEY_PREFIX.length);
    }
    return found;
  } catch {
    return null; // storage blocked (private mode): no shortcut, nothing breaks
  }
}

// Whether this browser can render the three.js robots.
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type SimState = "pending" | "ok" | "off";
