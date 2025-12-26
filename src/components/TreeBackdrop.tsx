import type { StyleWithVars } from "../types";
import { mulberry32 } from "../utils";

export function TreeBackdrop() {
  const particleStyles: StyleWithVars[] = Array.from({ length: 18 }, (_, i) => {
    const rng = mulberry32(0x51f0_12ab + i * 9973);
    return {
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      "--particle-delay": rng() * 8,
      "--particle-duration": 8 + rng() * 12,
    };
  });

  return (
    <div className="tree-backdrop">
      <div className="ikebana-grain" />

      {/* Subtle ambient dust/petals */}
      {particleStyles.map((style, i) => (
        <div key={`petal-${i}`} className="ambient-petal" style={style} />
      ))}
    </div>
  );
}
