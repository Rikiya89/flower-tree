import type { StyleWithVars } from "../types";
import { mulberry32 } from "../utils";

export function TreeBackdrop() {
  const particleStyles: StyleWithVars[] = Array.from({ length: 24 }, (_, i) => {
    const rng = mulberry32(0x51f0_12ab + i * 9973);
    return {
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      "--particle-delay": rng() * 6,
      "--particle-duration": 6 + rng() * 6,
    };
  });

  return (
    <div className="tree-backdrop">
      <div className="ikebana-grain" />

      {/* Light dust */}
      {particleStyles.map((style, i) => (
        <div key={`particle-${i}`} className="magic-particle" style={style} />
      ))}
    </div>
  );
}
