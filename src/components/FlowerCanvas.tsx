import { useEffect, useRef } from "react";
import type { FlowerParams } from "../types";
import { mulberry32 } from "../utils";
import { drawPetal, drawStamens } from "../drawing";

interface FlowerCanvasProps {
  params: FlowerParams;
  seed: number;
  size?: number;
}

export function FlowerCanvas({
  params,
  seed = 1,
  size = 320,
}: FlowerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    function draw(now: number) {
      if (!ctx || !canvas) return;

      const dt = (now - start) / 1000;
      const p = params;

      canvas.width = canvas.height = size * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(size / 2, size / 2);

      const sway =
        Math.sin(dt * Math.PI * 2 * p.swayFreq) *
        ((p.swayAmp * Math.PI) / 180);

      for (let i = 0; i < p.petalCount; i++) {
        const rng = mulberry32(seed + i);
        const angle = (i / p.petalCount) * Math.PI * 2 + sway;
        // Add seed-based variation to petal size and shape
        const sizeVar = 0.95 + rng() * 0.1; // 95-105% size variation
        const roundnessVar = Math.max(0, Math.min(1, p.roundness + (rng() - 0.5) * 0.15));

        drawPetal(
          ctx,
          angle,
          p.radius * 1.2 * sizeVar,
          roundnessVar,
          p.curl,
          p.hue,
          p.saturation,
          p.lightness,
          mulberry32(seed + i * 100),
          0.7
        );
      }

      const centerRng = mulberry32(seed ^ 0x5a5a_5a5a);
      drawStamens(
        ctx,
        p.radius * 0.18,
        p.lightness,
        centerRng
      );

      ctx.restore();
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [params, seed, size]);

  return (
    <div style={{ width: size, height: size }} className="preview-card">
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 10px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.35)) drop-shadow(0 0 18px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.18))`,
        }}
      />
    </div>
  );
}
