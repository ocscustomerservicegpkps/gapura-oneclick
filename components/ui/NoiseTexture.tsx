interface NoiseTextureProps {
  opacity?: number;
}

// Tiled 128px noise tile instead of a live full-viewport feTurbulence filter:
// the SVG filter re-rasterizes fractal noise (3 octaves) at viewport size on
// paint, which is a measurable main-thread/GPU cost on every surface using it.
// The data-URI below embeds the same turbulence but rasterized once per tile.
const NOISE_TILE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(#n)'/></svg>",
  );

export const NoiseTexture = ({ opacity = 0.1 }: NoiseTextureProps) => (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none mix-blend-overlay"
    style={{
      opacity,
      backgroundImage: `url("${NOISE_TILE}")`,
      backgroundRepeat: 'repeat',
    }}
  />
);
