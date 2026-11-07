import { Color, type MeshStandardMaterial } from "three";

// Brand livery for the atlas robot (public/teal_v.2.glb). The shell textures are flat teal fills with
// darker green trims, so instead of shipping repainted textures we remap colour in the fragment shader:
// teal-dominant texels are mixed toward the target shell colour (by brightness) while greys, metal and
// decals pass through untouched. Normal, roughness and metal maps keep all surface detail.
export type Livery = "original" | "atlas";

const ATLAS: Record<string, { light: string; dark: string }> = {
  // Main body panels: ivory shell, deep emerald trims.
  Teal_Plastic_A: { light: "#f1eee6", dark: "#0a4a3a" },
  // Secondary panels: jade-emerald accent, forest trims.
  Teal_Plastic_B: { light: "#13976d", dark: "#0b2c23" }
};

export function applyLivery(materials: Record<string, MeshStandardMaterial>, livery: Livery) {
  if (livery === "original") return;
  for (const [name, colours] of Object.entries(ATLAS)) {
    const material = materials[name];
    if (!material) continue;
    const light = new Color(colours.light);
    const dark = new Color(colours.dark);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.liveryLight = { value: light };
      shader.uniforms.liveryDark = { value: dark };
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform vec3 liveryLight;\nuniform vec3 liveryDark;\nvoid main() {")
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv );
            vec3 texel = sampledDiffuseColor.rgb;
            float chroma = texel.g - max( texel.r, texel.b * 0.55 );
            float tealMask = smoothstep( 0.015, 0.06, chroma );
            float lum = dot( texel, vec3( 0.2126, 0.7152, 0.0722 ) );
            vec3 recoloured = mix( liveryDark, liveryLight, smoothstep( 0.035, 0.11, lum ) );
            sampledDiffuseColor.rgb = mix( texel, recoloured, tealMask );
            diffuseColor *= sampledDiffuseColor;
          #endif`
        );
    };
    material.customProgramCacheKey = () => `atlas-livery-${name}`;
    material.needsUpdate = true;
  }
}
