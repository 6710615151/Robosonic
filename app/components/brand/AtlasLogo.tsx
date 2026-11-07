// The official HumanoidTH logo (public/logo.png): a white lockup on a transparent 1448×1086 canvas.
// The artwork occupies x 80–1383, y 257–792, so the wrapper crops the empty padding with CSS
// (see .atlas-logo in brand.css) instead of shipping a second, trimmed copy of the file.
// `tone="ink"` renders it dark for light backgrounds.
type AtlasLogoProps = { width?: number; tone?: "light" | "ink"; className?: string; decorative?: boolean };

export default function AtlasLogo({ width = 180, tone = "light", className, decorative = false }: AtlasLogoProps) {
  return (
    <span
      className={`atlas-logo atlas-logo--${tone}${className ? ` ${className}` : ""}`}
      style={{ width }}
    >
      <img src="/logo.png" alt={decorative ? "" : "Thailand Humanoid Atlas"} width={1448} height={1086} decoding="async" />
    </span>
  );
}
