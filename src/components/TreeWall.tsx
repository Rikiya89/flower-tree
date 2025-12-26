import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import type { PostedFlower, TreeFlower, StemLeaf } from "../types";
import { mulberry32, clamp, cubicPoint, cubicTangent, triggerDownload } from "../utils";
import { onFlower } from "../eventBus";
import { TreeBackdrop } from "./TreeBackdrop";
import { TreeVessel } from "./TreeVessel";
import { FlowerSprite } from "./FlowerSprite";

interface TreeWallProps {
  onRectChange: (rect: DOMRect | null) => void;
  dragReady: boolean;
}

export function TreeWall({
  onRectChange,
  dragReady,
}: TreeWallProps) {
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
