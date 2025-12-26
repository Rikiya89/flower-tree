import { useEffect, useRef } from "react";
import type { FlowerParams } from "../types";
import { mulberry32 } from "../utils";
import { drawPetal, drawStamens } from "../drawing";

interface DragGhostProps {
  x: number;
  y: number;
  valid: boolean;
  params: FlowerParams;
  seed: number;
}

export function DragGhost({
  x,
  y,
  valid,
  params,
  seed
}: DragGhostProps) {
  const size = 120;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const p = params;

    canvas.width = canvas.height = size * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(size / 2, size / 2);

    for (let i = 0; i < p.petalCount; i++) {
      const rng = mulberry32(seed + i);
      const angle = (i / p.petalCount) * Math.PI * 2;
      // Add seed-based variation to petal size and shape
      const sizeVar = 0.95 + rng() * 0.1; // 95-105% size variation
      const roundnessVar = Math.max(0, Math.min(1, p.roundness + (rng() - 0.5) * 0.15));

      drawPetal(
        ctx,
        angle,
        p.radius * 0.45 * sizeVar,
        roundnessVar,
        p.curl,
        p.hue,
        p.saturation,
        p.lightness,
        mulberry32(seed + i * 100),
        0.85
      );
    }

    const centerRng = mulberry32(seed ^ 0x5a5a_5a5a);
    drawStamens(
      ctx,
      p.radius * 0.11,
      p.lightness,
      centerRng
    );

    ctx.restore();
  }, [params, seed]);

  return (
    <div
      className={`drag-ghost${valid ? " drag-ghost--valid" : ""}`}
      style={{ transform: `translate(${x - size / 2}px, ${y - size / 2}px)` }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 8px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.35))`,
        }}
      />
    </div>
  );
}
