import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import type { FlowerParams, Season } from "../types";
import { clamp, pointInsideRect, triggerDownload } from "../utils";
import { broadcastFlower } from "../eventBus";
import { Slider } from "./Slider";
import { FlowerCanvas } from "./FlowerCanvas";
import { DragGhost } from "./DragGhost";

interface FlowerMakerProps {
  treeRect: DOMRect | null;
  onDragStateChange?: (dragging: boolean) => void;
  season: Season;
}

export function FlowerMaker({
  treeRect,
  onDragStateChange,
  season,
}: FlowerMakerProps) {
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

  // Apply seasonal color influence on first load or when season changes
  useEffect(() => {
    let hue = params.hue;
    if (season === "spring") hue = 330; // Pink
    if (season === "summer") hue = 200; // Sky blue / Fresh
    if (season === "autumn") hue = 30;  // Orange/Red
    if (season === "winter") hue = 180; // Icy cyan/White
    
    setParams(prev => ({ ...prev, hue }));
  }, [season]);

  const postToTree = (drop?: { x: number; y: number }) => {
    broadcastFlower({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      seed,
      params,
      drop,
      placementHeight,
      season,
    });
  };

  const randomizeAll = () => {
    setParams({
      petalCount: Math.floor(5 + Math.random() * 14),
      radius: Math.floor(80 + Math.random() * 70),
      roundness: Math.random() * 0.9,
      curl: Math.random() * 0.75,
      hue: params.hue + (Math.random() - 0.5) * 40,
      saturation: Math.random() * 80,
      lightness: Math.floor(55 + Math.random() * 38),
      swayAmp: Math.floor(Math.random() * 18),
      swayFreq: Math.random(),
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
