// -------------------------------------------------------------
// 2D Petal Drawing Functions
// -------------------------------------------------------------

export function drawStamens(
  ctx: CanvasRenderingContext2D,
  radius: number,
  lightness: number,
  rng: () => number
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const count = 10 + Math.floor(rng() * 8);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.4;
    const r = radius * (0.2 + rng() * 0.85);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const dotR = 1.1 + rng() * 1.8;

    const l = Math.min(96, lightness + 10 + rng() * 12);
    ctx.fillStyle = `hsla(0, 0%, ${l}%, ${0.32 + rng() * 0.22})`;

    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPetal(
  ctx: CanvasRenderingContext2D,
  angle: number,
  radius: number,
  roundness: number,
  curl: number,
  hue: number,
  saturation: number,
  lightness: number,
  rng: () => number,
  depth: number = 1
) {
  const r1 = radius * (0.38 + roundness * 0.42);
  const r2 = radius * (0.92 + rng() * 0.05);
  const wobble = (rng() - 0.5) * curl * radius * 0.16;
  const edge = (rng() - 0.5) * curl * radius * 0.05;

  ctx.save();
  ctx.rotate(angle);

  const path = new Path2D();
  path.moveTo(0, 0);
  path.bezierCurveTo(
    r1,
    -radius * (0.14 + rng() * 0.04) + wobble,
    r2 * (0.42 + rng() * 0.06),
    -radius * 0.06 + wobble + edge,
    r2,
    0
  );
  path.bezierCurveTo(
    r2 * (0.42 + rng() * 0.06),
    radius * 0.06 - wobble + edge,
    r1,
    radius * (0.14 + rng() * 0.04) - wobble,
    0,
    0
  );
  path.closePath();

  // Shadow pass (gives depth)
  ctx.save();
  ctx.translate(-2.2 * depth, 2.6 * depth);
  ctx.fillStyle = `rgba(0,0,0,${0.16 * depth})`;
  ctx.fill(path);
  ctx.restore();

  // Main gradient (soft, washi-like)
  const grad = ctx.createRadialGradient(0, 0, 0, r2 * 0.5, 0, r2);
  grad.addColorStop(
    0,
    `hsl(${hue}, ${Math.min(100, saturation + 6)}%, ${Math.min(
      96,
      lightness + 18
    )}%)`
  );
  grad.addColorStop(
    0.5,
    `hsl(${hue}, ${saturation}%, ${lightness}%)`
  );
  grad.addColorStop(
    1,
    `hsl(${(hue + 20) % 360}, ${Math.max(
      0,
      saturation - 10
    )}%, ${Math.max(0, lightness - 22)}%)`
  );

  ctx.fillStyle = grad;
  ctx.fill(path);

  // Highlight wash
  const highlightGrad = ctx.createRadialGradient(
    r2 * 0.28,
    0,
    0,
    r2 * 0.28,
    0,
    r2 * 0.55
  );
  highlightGrad.addColorStop(
    0,
    `hsla(${(hue + 60) % 360}, ${Math.min(100, saturation + 20)}%, ${Math.min(100, lightness + 30)}%, 0.5)`
  );
  highlightGrad.addColorStop(1, "transparent");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = highlightGrad;
  ctx.fill(path);
  ctx.restore();

  // Shading along the petal length to suggest curvature
  const shade = ctx.createLinearGradient(0, 0, r2, 0);
  shade.addColorStop(0, `rgba(0,0,0,${0.18 * depth})`);
  shade.addColorStop(0.35, `rgba(255,255,255,${0.1 * depth})`);
  shade.addColorStop(0.75, `rgba(255,255,255,${0.04 * depth})`);
  shade.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = shade;
  ctx.fill(path);
  ctx.restore();

  // Edge line (brush)
  ctx.strokeStyle = `hsla(${hue}, ${Math.min(
    100,
    saturation + 8
  )}%, ${Math.min(98, lightness + 12)}%, 0.22)`;
  ctx.lineWidth = 1.1 + depth * 0.35;
  ctx.stroke(path);

  ctx.restore();
}
