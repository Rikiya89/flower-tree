import { useEffect, useRef } from "react";
import type { TreeFlower } from "../types";
import { mulberry32 } from "../utils";
import { drawPetal, drawStamens } from "../drawing";

interface FlowerSpriteProps {
  f: TreeFlower;
}

export function FlowerSprite({ f }: FlowerSpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const size = 160 * f.scale;
    const start = performance.now();

    function draw(now: number) {
      if (!canvas || !ctx) return;

      const dt = (now - start) / 1000;
      const p = f.params;

      canvas.width = canvas.height = size * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const sway =
        Math.sin(dt * Math.PI * 2 * p.swayFreq) *
        ((p.swayAmp * Math.PI) / 180);

      for (let i = 0; i < p.petalCount; i++) {
        const rng = mulberry32(f.seed + i);
        const angle = (i / p.petalCount) * Math.PI * 2 + sway;
        // Add seed-based variation to petal size and shape
        const sizeVar = 0.95 + rng() * 0.1; // 95-105% size variation
        const roundnessVar = Math.max(0, Math.min(1, p.roundness + (rng() - 0.5) * 0.15));

        drawPetal(
          ctx,
          angle,
          p.radius * 0.6 * f.scale * sizeVar,
          roundnessVar,
          p.curl,
          p.hue,
          p.saturation,
          p.lightness,
          mulberry32(f.seed + i * 100),
          1.15
        );
      }

      const centerRng = mulberry32(f.seed ^ 0x5a5a_5a5a);
      drawStamens(
        ctx,
        p.radius * 0.11 * f.scale,
        p.lightness,
        centerRng
      );

      ctx.restore();
      raf = requestAnimationFrame(draw);
    }

    // Draw immediately first, then start animation loop
    draw(performance.now());

    return () => cancelAnimationFrame(raf);
  }, [f]);

  return (
    <div
      className="flower-sprite-wrap"
      style={{
        position: "absolute",
        left: f.x - 80 * f.scale,
        top: f.y - 80 * f.scale,
        width: 160 * f.scale,
        height: 160 * f.scale,
        transform: `perspective(900px) rotateX(${f.tiltX}deg) rotateY(${f.tiltY}deg) rotateZ(${f.tiltZ}deg)`,
        filter: `drop-shadow(0 0 ${8 * f.scale}px rgba(255,255,255,0.14)) drop-shadow(0 0 ${16 * f.scale}px rgba(255,255,255,0.06))`,
      }}
    >
      <canvas ref={ref} className="flower-sprite" />
    </div>
  );
}
