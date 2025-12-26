import { useState } from "react";
import { FlowerMaker, TreeWall } from "./components";
import type { Season } from "./types";

// -------------------------------------------------------------
// Interactive Flower Tree — App Component
// -------------------------------------------------------------
export default function App() {
  const [treeRect, setTreeRect] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [season, setSeason] = useState<Season>("spring");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-title">
          <h1>Interactive Ikebana (生け花)</h1>
          <p>Build with Shin / Soe / Hikae and leave Ma (negative space).</p>
        </div>

        <div className="season-selector">
          {(["spring", "summer", "autumn", "winter"] as Season[]).map((s) => (
            <button
              key={s}
              className={`season-btn ${season === s ? "is-active" : ""}`}
              onClick={() => setSeason(s)}
              title={s.charAt(0).toUpperCase() + s.slice(1)}
            >
              {s === "spring" ? "🌸" : s === "summer" ? "🌿" : s === "autumn" ? "🍁" : "❄️"}
            </button>
          ))}
        </div>
      </header>
      <FlowerMaker
        treeRect={treeRect}
        onDragStateChange={(state) => setIsDragging(state)}
        season={season}
      />
      <TreeWall onRectChange={setTreeRect} dragReady={isDragging} season={season} />
    </div>
  );
}
