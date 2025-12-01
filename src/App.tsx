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
        <h1>Interactive Flower Tree — Prototype</h1>
        <p>Drag / Swipe the flower to the tree → Download from the tree.</p>
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
}

interface TreeFlower extends PostedFlower {
  x: number;
  y: number;
  scale: number;
  born: number;
}

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
          mulberry32(seed + i * 100)
        );
      }

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
          filter: `drop-shadow(0 0 12px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.6)) drop-shadow(0 0 25px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.3))`,
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
    petalCount: 12,
    radius: 110,
    roundness: 0.6,
    curl: 0.3,
    hue: 220,
    saturation: 80,
    lightness: 55,
    swayAmp: 8,
    swayFreq: 0.25,
  });

  const [seed, setSeed] = useState<number>(1);
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
    });
  };

  const randomizeAll = () => {
    setParams({
      petalCount: Math.floor(6 + Math.random() * 19), // 6-24
      radius: Math.floor(70 + Math.random() * 80), // 70-150
      roundness: Math.random(), // 0-1
      curl: Math.random(), // 0-1
      hue: Math.floor(Math.random() * 360), // 0-360
      saturation: Math.floor(50 + Math.random() * 50), // 50-100
      lightness: Math.floor(40 + Math.random() * 40), // 40-80
      swayAmp: Math.floor(Math.random() * 25), // 0-25
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
        mulberry32(seed + i * 100)
      );
    }

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
          filter: `drop-shadow(0 0 8px hsla(${params.hue}, ${params.saturation}%, ${params.lightness}%, 0.8))`,
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

  const addIncoming = useCallback(
    (f: PostedFlower) => {
      const baseRect = wallRef.current?.getBoundingClientRect();
      const width = baseRect?.width ?? 800;
      const height = baseRect?.height ?? 800;
      const cx = width / 2;

      // Better flower positioning along the new tree shape
      const branchIndex = Math.floor(Math.random() * 16);
      const heightRatio = branchIndex / 15;
      const branchY = height - (40 + branchIndex * 45);

      // Match the new tree branch width calculation
      const baseWidth = 180;
      const widthCurve = 1 - Math.pow(heightRatio, 1.5);
      const branchWidth = baseWidth * widthCurve + 60;

      const isLeft = branchIndex % 2 === 0;

      // Position along the branch with some randomness
      const branchProgress = 0.35 + Math.random() * 0.55; // 35-90% along branch
      const fallbackX = isLeft
        ? cx - (branchProgress * branchWidth) + (Math.random() - 0.5) * 35
        : cx + (branchProgress * branchWidth) + (Math.random() - 0.5) * 35;
      const fallbackY = branchY + (Math.random() - 0.5) * 35;

      const scale = 0.55 + Math.random() * 0.65;

      // Add randomness around the drop point
      let x, y;
      if (f.drop) {
        const spreadRadius = 60; // How far from drop point
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * spreadRadius;
        x = f.drop.x + Math.cos(randomAngle) * randomDist;
        y = f.drop.y + Math.sin(randomAngle) * randomDist;
      } else {
        x = fallbackX;
        y = fallbackY;
      }

      setFlowers((prev) => [
        ...prev,
        { ...f, x, y, scale, born: performance.now() },
      ]);
    },
    []
  );

  const handleDownloadTree = async () => {
    const node = wallRef.current;
    if (!node) return alert("Tree not found.");

    try {
      const canvas = await html2canvas(node, {
        backgroundColor: '#04050b',
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
      onRectChange(node.getBoundingClientRect());
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
      <h2 className="panel-title">2) Projected Tree (drop flowers here)</h2>

      <div
        ref={wallRef}
        className={`tree-stage${dragReady ? " tree-stage--ready" : ""}`}
      >
        <TreeBackdrop />

        {flowers.map((f) => (
          <FlowerSprite key={f.id} f={f} />
        ))}

        <div className="tree-meta">
          Flowers: {flowers.length}
        </div>

        <button
          className="tree-download-btn btn btn-ghost"
          onClick={handleDownloadTree}
          disabled={flowers.length === 0}
        >
          Download Tree
        </button>
      </div>
    </section>
  );
}

function TreeBackdrop() {
  return (
    <div className="tree-backdrop">
      {/* Magical particles */}
      {[...Array(50)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="magic-particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            ['--particle-delay' as any]: Math.random() * 6,
            ['--particle-duration' as any]: 4 + Math.random() * 4,
          }}
        />
      ))}

      <div className="tree-trunk" />

      {/* Create a more beautiful, organic tree shape */}
      {[...Array(16)].map((_, i) => {
        // Create a more natural, tapered branch distribution
        const heightRatio = i / 15;
        const y = 40 + i * 45; // More densely packed

        // Create a beautiful curved width that tapers toward top
        const baseWidth = 180;
        const widthCurve = 1 - Math.pow(heightRatio, 1.5);
        const w = baseWidth * widthCurve + 60;

        const isLeft = i % 2 === 0;

        // More dramatic angles that decrease toward the top
        const baseAngle = 25;
        const angleVariation = baseAngle * (1 - heightRatio * 0.6);
        const angle = angleVariation + Math.sin(i * 0.5) * 8; // Add slight wave

        return (
          <div key={i}>
            <div
              className="tree-branch"
              style={{
                bottom: `${y}px`,
                [isLeft ? 'right' : 'left']: '50%',
                transformOrigin: isLeft ? 'right center' : 'left center',
                transform: `rotate(${isLeft ? -angle : angle}deg)`,
                width: `${w}px`,
                opacity: 0.85 + widthCurve * 0.15,
              }}
            />
            {/* More leaves with better distribution */}
            {[0, 1, 2, 3].map((leafIdx) => {
              const leafAngle = (leafIdx - 1.5) * 35;
              const leafProgress = 0.6 + leafIdx * 0.13;
              const leafOffset = w * leafProgress;
              const delay = i * 0.7 + leafIdx * 0.3;
              const leafScale = 0.8 + widthCurve * 0.4;

              return (
                <div
                  key={`leaf-${i}-${leafIdx}`}
                  className="tree-leaf"
                  style={{
                    bottom: `${y}px`,
                    [isLeft ? 'right' : 'left']: '50%',
                    transform: `
                      ${isLeft ? `translateX(-${leafOffset}px)` : `translateX(${leafOffset}px)`}
                      translateY(${Math.sin(leafAngle * Math.PI / 180) * 12}px)
                      rotate(${(isLeft ? -angle : angle) + leafAngle}deg)
                      scale(${leafScale})
                    `,
                    ['--leaf-delay' as any]: delay,
                  }}
                />
              );
            })}
          </div>
        );
      })}
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
          mulberry32(f.seed + i * 100)
        );
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    }

    // Draw immediately first, then start animation loop
    draw(performance.now());

    return () => cancelAnimationFrame(raf);
  }, [f]);

  return (
    <canvas
      ref={ref}
      className="flower-sprite"
      style={{
        position: "absolute",
        left: f.x - 80 * f.scale,
        top: f.y - 80 * f.scale,
        width: 160 * f.scale,
        height: 160 * f.scale,
        filter: `drop-shadow(0 0 ${8 * f.scale}px hsla(${f.params.hue}, ${f.params.saturation}%, ${f.params.lightness}%, 0.6)) drop-shadow(0 0 ${15 * f.scale}px hsla(${f.params.hue}, ${f.params.saturation}%, ${f.params.lightness}%, 0.3))`,
      }}
    />
  );
}

// -------------------------------------------------------------
// 2D Petal Drawing
// -------------------------------------------------------------
function drawPetal(
  ctx: CanvasRenderingContext2D,
  angle: number,
  radius: number,
  roundness: number,
  curl: number,
  hue: number,
  saturation: number,
  lightness: number,
  rng: () => number
) {
  const r1 = radius * (0.4 + roundness * 0.4);
  const r2 = radius * 0.95;
  const wobble = (rng() - 0.5) * curl * radius * 0.2;

  ctx.save();
  ctx.rotate(angle);

  // Main gradient with enhanced colors
  const grad = ctx.createRadialGradient(0, 0, 0, r2 * 0.5, 0, r2);
  grad.addColorStop(
    0,
    `hsl(${hue}, ${Math.min(100, saturation + 10)}%, ${Math.min(100, lightness + 15)}%)`
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
    )}%, ${Math.max(0, lightness - 25)}%)`
  );

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r1, -radius * 0.15 + wobble, r2 * 0.4, -radius * 0.05 + wobble, r2, 0);
  ctx.bezierCurveTo(r2 * 0.4, radius * 0.05 - wobble, r1, radius * 0.15 - wobble, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Add highlight
  const highlightGrad = ctx.createRadialGradient(r2 * 0.3, 0, 0, r2 * 0.3, 0, r2 * 0.5);
  highlightGrad.addColorStop(
    0,
    `hsla(${(hue + 60) % 360}, ${Math.min(100, saturation + 20)}%, ${Math.min(100, lightness + 30)}%, 0.5)`
  );
  highlightGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = highlightGrad;
  ctx.fill();

  // Add edge glow
  ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${Math.min(100, lightness + 20)}%, 0.4)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
