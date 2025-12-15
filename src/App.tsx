import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";

// -------------------------------------------------------------
// Interactive Flower Tree — App Component
// -------------------------------------------------------------
export default function App() {
  const [treeRect, setTreeRect] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Interactive Ikebana (生け花)</h1>
        <p>Build with Shin / Soe / Hikae and leave Ma (negative space).</p>
      </header>
      <FlowerMaker
        treeRect={treeRect}
        onDragStateChange={(state) => setIsDragging(state)}
      />
      <TreeWall onRectChange={setTreeRect} dragReady={isDragging} />
    </div>
  );
}

// -------------------------------------------------------------
// Shared Event Bus
// -------------------------------------------------------------
const listeners = new Set<(f: PostedFlower) => void>();
function broadcastFlower(f: PostedFlower) {
  listeners.forEach((l) => l(f));
}
function onFlower(cb: (f: PostedFlower) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
interface FlowerParams {
  petalCount: number;
  radius: number;
  roundness: number;
  curl: number;
  hue: number;
  saturation: number;
  lightness: number;
  swayAmp: number;
  swayFreq: number;
}

interface PostedFlower {
  id: string;
  seed: number;
  params: FlowerParams;
  drop?: { x: number; y: number };
  placementHeight?: number;
}

interface TreeFlower extends PostedFlower {
  x: number;
  y: number;
  scale: number;
  born: number;
  baseX: number;
  baseY: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  stemWidth: number;
  stemHue: number;
  stemSaturation: number;
  stemLightness: number;
  leaves: StemLeaf[];
  tiltX: number;
  tiltY: number;
  tiltZ: number;
}

type StyleWithVars = React.CSSProperties &
  Partial<
    Record<"--particle-delay" | "--particle-duration" | "--leaf-delay", number>
  >;

type StemLeaf =
  | {
      kind: "blade";
      t: number;
      side: 1 | -1;
      length: number;
      width: number;
      rotateDeg: number;
      offset: number;
      opacity: number;
    }
  | {
      kind: "sprig";
      t: number;
      side: 1 | -1;
      length: number;
      width: number;
      rotateDeg: number;
      offset: number;
      opacity: number;
      leaflets: { at: number; angDeg: number; len: number }[];
    };

// -------------------------------------------------------------
// Utility
// -------------------------------------------------------------
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pointInsideRect(x: number, y: number, rect: DOMRect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function cubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function cubicTangent(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
  };
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// -------------------------------------------------------------
// 2D Flower Preview
// -------------------------------------------------------------
function FlowerCanvas({
  params,
  seed = 1,
  size = 320,
}: {
  params: FlowerParams;
  seed: number;
  size?: number;
}) {
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

// -------------------------------------------------------------
// Flower Maker (Left Panel)
// -------------------------------------------------------------
function FlowerMaker({
  treeRect,
  onDragStateChange,
}: {
  treeRect: DOMRect | null;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const [params, setParams] = useState<FlowerParams>({
    petalCount: 7,
    radius: 115,
    roundness: 0.72,
    curl: 0.22,
    hue: 0,
    saturation: 0,
    lightness: 86,
    swayAmp: 8,
    swayFreq: 0.25,
  });

  const [seed, setSeed] = useState<number>(1);
  const [placementHeight, setPlacementHeight] = useState<number>(0.62);
  const [dragGhost, setDragGhost] = useState<{
    x: number;
    y: number;
    active: boolean;
    valid: boolean;
  } | null>(null);

  const postToTree = (drop?: { x: number; y: number }) => {
    broadcastFlower({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      seed,
      params,
      drop,
      placementHeight,
    });
  };

  const randomizeAll = () => {
    setParams({
      petalCount: Math.floor(5 + Math.random() * 14), // 5-18
      radius: Math.floor(80 + Math.random() * 70), // 80-150
      roundness: Math.random() * 0.9, // 0-0.9
      curl: Math.random() * 0.75, // 0-0.75
      hue: 0,
      saturation: 0,
      lightness: Math.floor(55 + Math.random() * 38), // 55-93
      swayAmp: Math.floor(Math.random() * 18), // 0-18
      swayFreq: Math.random(), // 0-1
    });
    setSeed(Math.floor(Math.random() * 1e9));
  };

  const handleDownloadPNG = async () => {
    const node = document.querySelector("#maker-card") as HTMLElement | null;
    if (!node) return alert("Preview not found.");

    try {
      const canvas = await html2canvas(node);
      const url = canvas.toDataURL("image/png");
      triggerDownload(url, `flower_${Date.now()}.png`);
    } catch {
      alert("Screenshot not supported.");
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onDragStateChange?.(true);
    setDragGhost({
      x: e.clientX,
      y: e.clientY,
      active: true,
      valid: treeRect ? pointInsideRect(e.clientX, e.clientY, treeRect) : false,
    });

    const handleMove = (evt: PointerEvent) => {
      setDragGhost((prev) =>
        prev
          ? {
              ...prev,
              x: evt.clientX,
              y: evt.clientY,
              valid: treeRect ? pointInsideRect(evt.clientX, evt.clientY, treeRect) : false,
            }
          : prev
      );
    };

    const handleUp = (evt: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      onDragStateChange?.(false);
      setDragGhost(null);

      if (treeRect && pointInsideRect(evt.clientX, evt.clientY, treeRect)) {
        const localX = clamp(evt.clientX - treeRect.left, 0, treeRect.width);
        const localY = clamp(evt.clientY - treeRect.top, 0, treeRect.height);
        postToTree({ x: localX, y: localY });
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return (
    <section className="panel panel--maker">
      <h2 className="panel-title">1) Design Your Flower</h2>
      <p className="panel-hint">
        Tip: ikebana reads best when the flower supports a clear line (not a
        dense bouquet).
      </p>

      <div className="maker-content">
        {/* Controls */}
        <div className="maker-controls">
          <Slider
            label="Petals"
            min={3}
            max={24}
            step={1}
            value={params.petalCount}
            onChange={(v) => setParams((prev) => ({ ...prev, petalCount: v }))}
          />
          <Slider
            label="Radius"
            min={60}
            max={150}
            step={1}
            value={params.radius}
            onChange={(v) => setParams((prev) => ({ ...prev, radius: v }))}
          />
          <Slider
            label="Roundness"
            min={0}
            max={1}
            step={0.01}
            value={params.roundness}
            onChange={(v) => setParams((prev) => ({ ...prev, roundness: v }))}
          />
          <Slider
            label="Curl"
            min={0}
            max={1}
            step={0.01}
            value={params.curl}
            onChange={(v) => setParams((prev) => ({ ...prev, curl: v }))}
          />
          <Slider
            label="Hue"
            min={0}
            max={360}
            step={1}
            value={params.hue}
            onChange={(v) => setParams((prev) => ({ ...prev, hue: v }))}
          />
          <Slider
            label="Saturation"
            min={0}
            max={100}
            step={1}
            value={params.saturation}
            onChange={(v) => setParams((prev) => ({ ...prev, saturation: v }))}
          />
          <Slider
            label="Lightness"
            min={0}
            max={100}
            step={1}
            value={params.lightness}
            onChange={(v) => setParams((prev) => ({ ...prev, lightness: v }))}
          />
          <Slider
            label="Sway Amplitude"
            min={0}
            max={30}
            step={1}
            value={params.swayAmp}
            onChange={(v) => setParams((prev) => ({ ...prev, swayAmp: v }))}
          />
          <Slider
            label="Sway Frequency"
            min={0}
            max={1}
            step={0.01}
            value={params.swayFreq}
            onChange={(v) => setParams((prev) => ({ ...prev, swayFreq: v }))}
          />
          <Slider
            label="Placement Height"
            min={0}
            max={1}
            step={0.01}
            value={placementHeight}
            onChange={setPlacementHeight}
          />

          <div className="seed-display">
            <span className="slider-label">Seed:</span>
            <span className="slider-value">{seed}</span>
          </div>

          <div className="button-group">
            <button className="btn btn-ghost" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
              Randomize Seed
            </button>
            <button className="btn btn-accent" onClick={randomizeAll}>
              Randomize All
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => postToTree()}>
            Send to Tree
          </button>
        </div>

        {/* Preview */}
        <div className="maker-preview">
          <div
            id="maker-card"
            className={`preview-frame${dragGhost?.active ? " is-dragging" : ""}`}
            onPointerDown={startDrag}
          >
            <FlowerCanvas params={params} seed={seed} size={320} />
          </div>

          <button className="btn btn-ghost" onClick={handleDownloadPNG}>
            Download PNG
          </button>
        </div>
      </div>

      {dragGhost?.active && (
        <DragGhost x={dragGhost.x} y={dragGhost.y} valid={dragGhost.valid} params={params} seed={seed} />
      )}
    </section>
  );
}

function DragGhost({
  x,
  y,
  valid,
  params,
  seed
}: {
  x: number;
  y: number;
  valid: boolean;
  params: FlowerParams;
  seed: number;
}) {
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

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        onInput={handleChange}
        className="slider-control"
      />
      <span className="slider-value">{value.toFixed(step < 1 ? 2 : 0)}</span>
    </label>
  );
}

// -------------------------------------------------------------
// Tree Wall (Right Panel)
// -------------------------------------------------------------
function TreeWall({
  onRectChange,
  dragReady,
}: {
  onRectChange: (rect: DOMRect | null) => void;
  dragReady: boolean;
}) {
  const [flowers, setFlowers] = useState<TreeFlower[]>([]);
  const wallRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 700 });
  const openSideRef = useRef<1 | -1>(1);
  const hasSideRef = useRef(false);

  const addIncoming = useCallback(
    (f: PostedFlower) => {
      const baseRect = wallRef.current?.getBoundingClientRect();
      const width = baseRect?.width ?? 800;
      const height = baseRect?.height ?? 800;
      const cx = width / 2;
      const now = performance.now();

      setFlowers((prev) => {
        const existing =
          prev.length >= 3 ? prev.slice(Math.max(0, prev.length - 2)) : prev;
        const idx = existing.length;
        const rng = mulberry32((f.seed ^ (idx * 0x9e3779b9)) >>> 0);

        // Ikebana-style composition: three main lines (shin / soe / hikae)
        // Keep a consistent "front" (open side) across drops.
        if (!hasSideRef.current) {
          openSideRef.current = rng() > 0.5 ? 1 : -1;
          hasSideRef.current = true;
        }
        const openSide = openSideRef.current;

        const role = idx % 3;
        const roleLen = [0.66, 0.5, 0.38][role];
        const baseDirDeg = [-12, 40, -68][role] * -openSide;
        const height01 = clamp(f.placementHeight ?? 0.62, 0, 1);
        const heightScale = 0.78 + height01 * 0.62;

        const baseOffsetX = [-2, 10 * -openSide, 8 * -openSide][role];
        const baseX = cx + baseOffsetX + (rng() - 0.5) * 38 - openSide * 18;
        const baseY = height - 86 + (rng() - 0.5) * 10;

        const nominalLength =
          height * roleLen * (0.9 + rng() * 0.18) * heightScale;
        const fallbackDirDeg = baseDirDeg + (rng() - 0.5) * 16;
        const fallbackTheta = ((-90 + fallbackDirDeg) * Math.PI) / 180;
        const fallbackUx = Math.cos(fallbackTheta);
        const fallbackUy = Math.sin(fallbackTheta);

        let x = f.drop?.x ?? baseX + fallbackUx * nominalLength;
        let y = f.drop?.y ?? baseY + fallbackUy * nominalLength;

        // Respect user drop position, but keep within stage and avoid overly-short stems.
        x = clamp(x, 60, width - 60);
        y = clamp(y, 70, height - 210);

        const vx = x - baseX;
        const vy = y - baseY;
        const vLen = Math.hypot(vx, vy) || 1;
        const minLen = height * roleLen * 0.42 * heightScale;
        const stemLen = f.drop ? Math.max(vLen, minLen) : vLen;

        const ux = f.drop ? vx / vLen : fallbackUx;
        const uy = f.drop ? vy / vLen : fallbackUy;

        if (!f.drop) {
          const along = (height01 - 0.62) * 110;
          x += ux * along;
          y += uy * along;
          x = clamp(x, 60, width - 60);
          y = clamp(y, 70, height - 210);
        } else if (stemLen !== vLen) {
          x = baseX + ux * stemLen;
          y = baseY + uy * stemLen;
          x = clamp(x, 60, width - 60);
          y = clamp(y, 70, height - 210);
        }

        const px = -uy;
        const py = ux;
        const curveSign = (rng() > 0.5 ? 1 : -1) * (role === 1 ? -1 : 1);
        const curveAmp = stemLen * (0.09 + rng() * 0.06) * curveSign;

        const c1x = baseX + ux * (stemLen * 0.33) + px * curveAmp;
        const c1y = baseY + uy * (stemLen * 0.33) + py * curveAmp;
        const c2x = baseX + ux * (stemLen * 0.66) - px * curveAmp * 0.7;
        const c2y = baseY + uy * (stemLen * 0.66) - py * curveAmp * 0.7;

        const stemHue = 0;
        const stemSaturation = 0;
        const stemLightness =
          (role === 0 ? 62 : role === 1 ? 54 : 48) + rng() * 10;
        const stemWidth =
          (role === 0 ? 2.4 : role === 1 ? 2.0 : 1.8) + rng() * 0.9;

        const roleScale = [0.58, 0.72, 0.86][role];
        const scale = roleScale * (0.9 + rng() * 0.2);

        const leaves: StemLeaf[] = [];
        const longLeafChance = role === 1 ? 0.55 : role === 2 ? 0.5 : 0.35;
        if (rng() < longLeafChance) {
          leaves.push({
            kind: "blade",
            t: clamp(0.24 + rng() * 0.2, 0.2, 0.55),
            side: rng() > 0.5 ? 1 : -1,
            length: 90 + rng() * 140,
            width: 8 + rng() * 9,
            rotateDeg: (rng() - 0.5) * 18,
            offset: 5 + rng() * 8,
            opacity: 0.22 + rng() * 0.12,
          });
        }

        const extra = (role === 0 ? 1 : 2) + Math.floor(rng() * 2);
        for (let j = 0; j < extra; j++) {
          const side: 1 | -1 = rng() > 0.5 ? 1 : -1;
          const t = clamp(0.32 + rng() * 0.54, 0.2, 0.92);
          const isSprig = rng() < 0.4;
          const baseOpacity = 0.16 + rng() * 0.15;

          if (isSprig) {
            const length = 44 + rng() * 80;
            const leafletCount = 5 + Math.floor(rng() * 4);
            const leaflets = Array.from({ length: leafletCount }, () => {
              const at = clamp(0.22 + rng() * 0.7, 0.12, 0.95) * length;
              const angDeg = side * (35 + rng() * 40) * (rng() > 0.22 ? 1 : -1);
              const len = 7 + rng() * 10;
              return { at, angDeg, len };
            });
            leaves.push({
              kind: "sprig",
              t,
              side,
              length,
              width: 2.5 + rng() * 2.5,
              rotateDeg: (rng() - 0.5) * 14,
              offset: 4 + rng() * 7,
              opacity: baseOpacity * 0.85,
              leaflets,
            });
          } else {
            leaves.push({
              kind: "blade",
              t,
              side,
              length: 36 + rng() * 88,
              width: 5 + rng() * 7,
              rotateDeg: (rng() - 0.5) * 22,
              offset: 4 + rng() * 7,
              opacity: baseOpacity,
            });
          }
        }

        const tiltX = (rng() - 0.5) * 16;
        const tiltY = (rng() - 0.5) * 22;
        const tiltZ = (rng() - 0.5) * 14;

        return [
          ...existing,
          {
            ...f,
            x,
            y,
            scale,
            born: now,
            baseX,
            baseY,
            c1x,
            c1y,
            c2x,
            c2y,
            stemWidth,
            stemHue,
            stemSaturation,
            stemLightness,
            leaves,
            tiltX,
            tiltY,
            tiltZ,
          },
        ];
      });
    },
    []
  );

  const handleResetTree = () => {
    if (flowers.length === 0) return;
    const ok = confirm("Reset the arrangement?");
    if (!ok) return;
    setFlowers([]);
    hasSideRef.current = false;
    openSideRef.current = 1;
  };

  const handleDownloadTree = async () => {
    const node = wallRef.current;
    if (!node) return alert("Tree not found.");

    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#000000",
        scale: 2,
      });
      const url = canvas.toDataURL("image/png");
      triggerDownload(url, `flower_tree_${Date.now()}.png`);
    } catch {
      alert("Screenshot not supported.");
    }
  };

  useEffect(() => onFlower(addIncoming), [addIncoming]);

  useLayoutEffect(() => {
    const node = wallRef.current;
    if (!node) {
      onRectChange(null);
      return;
    }

    const updateRect = () => {
      const rect = node.getBoundingClientRect();
      onRectChange(rect);
      setStageSize((prev) =>
        prev.w === rect.width && prev.h === rect.height
          ? prev
          : { w: rect.width, h: rect.height }
      );
    };

    updateRect();

    const observer = new ResizeObserver(updateRect);
    observer.observe(node);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
      onRectChange(null);
    };
  }, [onRectChange]);

  return (
    <section className="panel panel--tree">
      <h2 className="panel-title">2) Ikebana Wall (drop flowers here)</h2>
      <p className="panel-hint">
        Three lines only: <span className="panel-hint__em">Shin</span> (Heaven),{" "}
        <span className="panel-hint__em">Soe</span> (Human),{" "}
        <span className="panel-hint__em">Hikae</span> (Earth). Avoid equal
        heights; let the gaps stay alive.
      </p>

      <div
        ref={wallRef}
        className={`tree-stage${dragReady ? " tree-stage--ready" : ""}`}
      >
        <TreeBackdrop />

        <svg
          className="stem-layer"
          viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
	        >
	          <defs>
	            <linearGradient id="leafFill" x1="0" y1="0" x2="1" y2="0">
	              <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
	              <stop offset="42%" stopColor="rgba(255,255,255,0.12)" />
	              <stop offset="78%" stopColor="rgba(0,0,0,0.12)" />
	              <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
	            </linearGradient>
	          </defs>

          {flowers.map((f) => (
            <path
              key={`stem-${f.id}`}
              d={`M ${f.baseX} ${f.baseY} C ${f.c1x} ${f.c1y}, ${f.c2x} ${f.c2y}, ${f.x} ${f.y}`}
              fill="none"
              stroke={`hsla(${f.stemHue}, ${f.stemSaturation}%, ${f.stemLightness}%, 0.85)`}
              strokeWidth={f.stemWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {flowers.flatMap((f) => {
            const p0 = { x: f.baseX, y: f.baseY };
            const p1 = { x: f.c1x, y: f.c1y };
            const p2 = { x: f.c2x, y: f.c2y };
            const p3 = { x: f.x, y: f.y };

            return f.leaves.map((leaf, i) => {
              const t = clamp(leaf.t, 0.02, 0.98);
              const pos = cubicPoint(p0, p1, p2, p3, t);
              const tan = cubicTangent(p0, p1, p2, p3, t);
              const ang = Math.atan2(tan.y, tan.x);
              const nLen = Math.hypot(tan.x, tan.y) || 1;
              const nx = (-tan.y / nLen) * leaf.side;
              const ny = (tan.x / nLen) * leaf.side;
              const tx = pos.x + nx * leaf.offset;
              const ty = pos.y + ny * leaf.offset;

              const leafAng =
                ang +
                (leaf.side * Math.PI) / 2 * 0.62 +
                (leaf.rotateDeg * Math.PI) / 180;

              const transform = `translate(${tx} ${ty}) rotate(${
                (leafAng * 180) / Math.PI
              })`;

              if (leaf.kind === "sprig") {
                const mainD = `M 0 0 C ${leaf.length * 0.42} ${
                  -leaf.width * 0.8
                }, ${leaf.length * 0.76} ${
                  leaf.width * 0.8
                }, ${leaf.length} 0`;

                return (
                  <g
                    key={`leaf-${f.id}-${i}`}
                    className="ikebana-sprig"
                    transform={transform}
                    opacity={leaf.opacity}
                  >
                    <path d={mainD} />
                    {leaf.leaflets.map((lf, j) => {
                      const a = (lf.angDeg * Math.PI) / 180;
                      const x2 = lf.at + Math.cos(a) * lf.len;
                      const y2 = Math.sin(a) * lf.len;
                      return (
                        <path
                          key={`leaflet-${f.id}-${i}-${j}`}
                          d={`M ${lf.at} 0 L ${x2} ${y2}`}
                        />
                      );
                    })}
                  </g>
                );
              }

              const L = leaf.length;
              const W = leaf.width;
              const bend = Math.sin(t * Math.PI) * leaf.side;
              const c0 = bend * W * 0.05;
              const c1 = bend * W * 0.22;
              const c2 = bend * W * 0.18;
              const cTip = bend * W * 0.12;
              const tip = Math.max(1.6, W * 0.28);

              const blade = `M 0 0
                C ${L * 0.16} ${c0 - W * 0.85}, ${L * 0.44} ${
                  c1 - W * 1.25
                }, ${L * 0.72} ${c2 - W * 0.62}
                C ${L * 0.88} ${c2 - W * 0.28}, ${L * 0.96} ${
                  cTip - tip * 0.25
                }, ${L} ${cTip}
                C ${L * 0.96} ${cTip + tip * 0.25}, ${L * 0.88} ${
                  c2 + W * 0.28
                }, ${L * 0.72} ${c2 + W * 0.62}
                C ${L * 0.44} ${c1 + W * 1.05}, ${L * 0.16} ${
                  c0 + W * 0.75
                }, 0 0 Z`;

              const vein = `M 0 0
                C ${L * 0.28} ${c0 - W * 0.08}, ${L * 0.62} ${
                  c2 + W * 0.04
                }, ${L} ${cTip}`;

              return (
                <g
                  key={`leaf-${f.id}-${i}`}
                  className="ikebana-leaf"
                  transform={transform}
                  opacity={leaf.opacity}
                >
                  <path d={blade} fill="url(#leafFill)" />
                  <path className="ikebana-leaf-vein" d={vein} />
                </g>
              );
            });
          })}
        </svg>

        <TreeVessel />

        {flowers.map((f) => (
          <FlowerSprite key={f.id} f={f} />
        ))}

        <div className="tree-meta">
          Flowers: {flowers.length}
        </div>

        <div className="tree-actions">
          <button
            className="tree-reset-btn btn btn-ghost"
            onClick={handleResetTree}
            disabled={flowers.length === 0}
          >
            Reset
          </button>
          <button
            className="tree-download-btn btn btn-ghost"
            onClick={handleDownloadTree}
            disabled={flowers.length === 0}
          >
            Download Tree
          </button>
        </div>
      </div>
    </section>
  );
}

function TreeBackdrop() {
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

function TreeVessel() {
  return (
    <div className="ikebana-vessel" aria-hidden="true">
      <div className="ikebana-vase" />
      <div className="ikebana-kenzan" />
      <div className="ikebana-rim" />
    </div>
  );
}

// -------------------------------------------------------------
// Flower Sprite Renderer (2D Canvas)
// -------------------------------------------------------------
function FlowerSprite({ f }: { f: TreeFlower }) {
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

// -------------------------------------------------------------
// 2D Petal Drawing
// -------------------------------------------------------------
function drawStamens(
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

function drawPetal(
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
