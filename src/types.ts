import type React from "react";

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export interface FlowerParams {
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

export interface PostedFlower {
  id: string;
  seed: number;
  params: FlowerParams;
  drop?: { x: number; y: number };
  placementHeight?: number;
}

export interface TreeFlower extends PostedFlower {
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

export type StyleWithVars = React.CSSProperties &
  Partial<
    Record<"--particle-delay" | "--particle-duration" | "--leaf-delay", number>
  >;

export type StemLeaf =
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
