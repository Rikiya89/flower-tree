import { useState } from "react";
import { FlowerMaker, TreeWall } from "./components";

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
