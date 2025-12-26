import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import type { PostedFlower, TreeFlower, StemLeaf, Season } from "../types";
import { mulberry32, clamp, cubicPoint, cubicTangent, triggerDownload } from "../utils";
import { onFlower } from "../eventBus";
import { TreeBackdrop } from "./TreeBackdrop";
import { TreeVessel } from "./TreeVessel";
import { FlowerSprite } from "./FlowerSprite";

interface TreeWallProps {
  onRectChange: (rect: DOMRect | null) => void;
  dragReady: boolean;
  season: Season;
}

export function TreeWall({
  onRectChange,
  dragReady,
  season,
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
        const vesselWidth = Math.min(360, width * 0.7);
        // Traditional Ikebana length: Shin is ~1.5x (width + height of vessel)
        // Here we use vesselWidth as a base.
        const shinLen = vesselWidth * 1.5;
        const roleLenRatio = [1.0, 0.75, 0.5][role];
        
        // Traditional angles from vertical (0 deg is up)
        // Shin: ~15 deg (one side)
        // Soe: ~45 deg (same side as Shin)
        // Hikae: ~75 deg (opposite side to balance)
        const baseDirDeg = [15, 45, -75][role] * -openSide;
        
        const height01 = clamp(f.placementHeight ?? 0.62, 0, 1);
        const heightScale = 0.8 + height01 * 0.4;

        // Base should match the kenzan position in CSS (bottom: 170px)
        const baseX = cx + (rng() - 0.5) * 20;
        const baseY = height - 192 + (rng() - 0.5) * 10;

        const nominalLength = shinLen * roleLenRatio * (0.9 + rng() * 0.2) * heightScale;
        const fallbackDirDeg = baseDirDeg + (rng() - 0.5) * 10;
        const fallbackTheta = ((-90 + fallbackDirDeg) * Math.PI) / 180;
        const fallbackUx = Math.cos(fallbackTheta);
        const fallbackUy = Math.sin(fallbackTheta);

        let x = f.drop?.x ?? baseX + fallbackUx * nominalLength;
        let y = f.drop?.y ?? baseY + fallbackUy * nominalLength;

        // Respect user drop position, but keep within stage
        x = clamp(x, 60, width - 60);
        y = clamp(y, 70, height - 210);

        const vx = x - baseX;
        const vy = y - baseY;
        const vLen = Math.hypot(vx, vy) || 1;
        const minLen = shinLen * roleLenRatio * 0.5 * heightScale;
        const stemLen = f.drop ? Math.max(vLen, minLen) : vLen;

        const ux = f.drop ? vx / vLen : fallbackUx;
        const uy = f.drop ? vy / vLen : fallbackUy;

        if (!f.drop) {
          const along = (height01 - 0.62) * 100;
          x += ux * along;
          y += uy * along;
        } else if (stemLen !== vLen) {
          x = baseX + ux * stemLen;
          y = baseY + uy * stemLen;
        }

        const px = -uy;
        const py = ux;
        const curveSign = (rng() > 0.5 ? 1 : -1) * (role === 1 ? -1 : 1);
        const curveAmp = stemLen * (0.12 + rng() * 0.08) * curveSign;

        const c1x = baseX + ux * (stemLen * 0.33) + px * curveAmp;
        const c1y = baseY + uy * (stemLen * 0.33) + py * curveAmp;
        const c2x = baseX + ux * (stemLen * 0.66) - px * curveAmp * 0.6;
        const c2y = baseY + uy * (stemLen * 0.66) - py * curveAmp * 0.6;

        // Stem color: Standard brownish green for Ikebana stems
        const stemHue = 24 + rng() * 12;
        const stemSaturation = 15 + rng() * 10;
        const stemLightness =
          (role === 0 ? 55 : role === 1 ? 48 : 42) + rng() * 8;
        
        const stemWidth = (role === 0 ? 3.5 : role === 1 ? 2.8 : 2.2) + rng() * 0.5;

        const roleScale = [0.85, 0.75, 0.65][role];
        const scale = roleScale * (0.9 + rng() * 0.2);

        const leaves: StemLeaf[] = [];
        // Waterline cleanliness: no leaves in the bottom 22%
        const minT = 0.22;
        
        // Shin (0) is the most minimal.
        const leafCount = role === 0 ? 1 + Math.floor(rng() * 2) : role === 1 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2);
        
        let lastSide = rng() > 0.5 ? 1 : -1;
        
        // Seasonal Leaf Colors (Influence rendering via f.season)

        for (let j = 0; j < leafCount; j++) {
          const side = (lastSide * -1) as 1 | -1;
          lastSide = side;
          
          const maxT = role === 0 ? 0.65 : 0.85;
          const t = clamp(minT + (j / leafCount) * (maxT - minT) + (rng() - 0.5) * 0.1, minT, 0.92);
          
          const isBlade = role !== 2 || rng() < 0.7;
          const baseOpacity = 0.22 + rng() * 0.18;

          if (!isBlade) {
            const length = 50 + rng() * 70;
            const leafletCount = 4 + Math.floor(rng() * 3);
            const leaflets = Array.from({ length: leafletCount }, (_, k) => {
              const at = clamp(0.2 + (k / leafletCount) * 0.75, 0.1, 0.95) * length;
              const angDeg = side * (30 + rng() * 30) * (rng() > 0.3 ? 1 : -0.5);
              const len = 8 + rng() * 12;
              return { at, angDeg, len };
            });
            leaves.push({
              kind: "sprig",
              t,
              side,
              length,
              width: 2.2 + rng() * 2,
              rotateDeg: (rng() - 0.5) * 15,
              offset: 3 + rng() * 5,
              opacity: baseOpacity * 0.9,
              leaflets,
            });
          } else {
            // Blade leaves: longer for Shin/Soe, broader for Hikae
            const isLong = role < 2 && rng() > 0.4;
            leaves.push({
              kind: "blade",
              t,
              side,
              length: isLong ? 120 + rng() * 100 : 40 + rng() * 60,
              width: role === 2 ? 12 + rng() * 10 : 6 + rng() * 6,
              rotateDeg: (rng() - 0.5) * 25,
              offset: 3 + rng() * 6,
              opacity: baseOpacity,
            });
          }
        }

        const tiltX = (rng() - 0.5) * 12 - 10; // Slightly tilted towards viewer
        const tiltY = (rng() - 0.5) * 12;
        const tiltZ = (rng() - 0.5) * 8;

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
        Follow <span className="panel-hint__em">Sansai</span>: Shin (Heaven),{" "}
        Soe (Human), Hikae (Earth). The arrangement flows from the{" "}
        <span className="panel-hint__em">Kenzan</span>. Respect the{" "}
        <span className="panel-hint__em">Ma</span>.
      </p>

      <div
        ref={wallRef}
        className={`tree-stage${dragReady ? " tree-stage--ready" : ""} stage--${season}`}
      >
        <TreeBackdrop />

        <svg
          className="stem-layer"
          viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="stemShadow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
              <feOffset dx="1" dy="1" result="offsetblur" />
              <feFlood floodColor="rgba(0,0,0,0.4)" />
              <feComposite in2="offsetblur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {flowers.map((f) => {
            const d = `M ${f.baseX} ${f.baseY} C ${f.c1x} ${f.c1y}, ${f.c2x} ${f.c2y}, ${f.x} ${f.y}`;
            const baseColor = `hsla(${f.stemHue}, ${f.stemSaturation}%, ${f.stemLightness}%, 0.95)`;
            const lightColor = `hsla(${f.stemHue}, ${f.stemSaturation}%, ${f.stemLightness + 15}%, 0.4)`;
            
            return (
              <g key={`stem-group-${f.id}`} filter="url(#stemShadow)">
                {/* Main Stem */}
                <path
                  d={d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={f.stemWidth}
                  strokeLinecap="round"
                />
                {/* Highlight */}
                <path
                  d={d}
                  fill="none"
                  stroke={lightColor}
                  strokeWidth={f.stemWidth * 0.4}
                  strokeLinecap="round"
                  style={{ mixBlendMode: 'overlay' }}
                />
              </g>
            );
          })}

          {flowers.flatMap((f) => {
            const p0 = { x: f.baseX, y: f.baseY };
            const p1 = { x: f.c1x, y: f.c1y };
            const p2 = { x: f.c2x, y: f.c2y };
            const p3 = { x: f.x, y: f.y };

            // Seasonal Leaf Logic for rendering
            const s = f.season || "spring";
            let lHue = 100;
            let lSat = 40;
            if (s === "spring") { lHue = 85; lSat = 45; }
            else if (s === "autumn") { lHue = 30; lSat = 55; }
            else if (s === "winter") { lHue = 140; lSat = 5; }

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

              const strokeColor = `hsla(${lHue}, ${lSat}%, 30%, 0.4)`;
              const fillColor = `hsla(${lHue}, ${lSat}%, 45%, 1)`;

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
                    stroke={strokeColor}
                  >
                    <path d={mainD} fill="none" />
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
              
              const blade = `M 0 0
                C ${L * 0.1} ${-W * 0.2}, ${L * 0.3} ${-W * 1.1}, ${L * 0.6} ${-W * 0.8}
                C ${L * 0.85} ${-W * 0.4}, ${L * 0.95} ${-W * 0.1}, ${L} 0
                C ${L * 0.95} ${W * 0.1}, ${L * 0.85} ${W * 0.4}, ${L * 0.6} ${W * 0.8}
                C ${L * 0.3} ${W * 1.1}, ${L * 0.1} ${W * 0.2}, 0 0 Z`;

              const vein = `M 0 0
                C ${L * 0.3} ${bend * W * 0.1}, ${L * 0.7} ${-bend * W * 0.1}, ${L} 0`;

              return (
                <g
                  key={`leaf-${f.id}-${i}`}
                  className="ikebana-leaf"
                  transform={transform}
                  opacity={leaf.opacity}
                >
                  <path d={blade} fill={fillColor} stroke={strokeColor} />
                  <path className="ikebana-leaf-vein" d={vein} stroke={strokeColor} fill="none" />
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
