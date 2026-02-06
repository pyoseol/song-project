// src/components/PianoRoll.tsx
import { useState } from "react";
import { playMelodyPreview } from "../audio/engine.ts";
import { useSongStore, MELODY_ROWS } from "../store/songStore.ts";

const COLORS = [
  "#f97373",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
  "#38bdf8",
  "#818cf8",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
];

export const PianoRoll = () => {
  const { melody, steps, toggleMelody, currentStep } = useSongStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawValue, setDrawValue] = useState<boolean | null>(null);

  const handleMouseDown = (row: number, col: number) => {
    const active = melody[row]?.[col];
    const target = !active;
    toggleMelody(row, col);
    void playMelodyPreview(row);
    setIsDrawing(true);
    setDrawValue(target);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!isDrawing || drawValue === null) return;
    const active = melody[row]?.[col];
    if (active !== drawValue) {
      toggleMelody(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setDrawValue(null);
  };

  return (
    <div className="piano-container" onMouseUp={handleMouseUp}>
      <div
        className="piano-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps}, 1fr)`,
          gridTemplateRows: `repeat(${MELODY_ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: MELODY_ROWS }).map((_, row) =>
          Array.from({ length: steps }).map((_, col) => {
            const active = melody[row]?.[col];
            const isBar = col % 4 === 0;
            const isCurrent = col === currentStep;

            const baseColor = active
              ? COLORS[row % COLORS.length]
              : "transparent";

            return (
              <button
                key={`${row}-${col}`}
                onMouseDown={() => handleMouseDown(row, col)}
                onMouseEnter={() => handleMouseEnter(row, col)}
                className={[
                  "piano-cell",
                  isBar ? "bar" : "",
                  active ? "active" : "",
                  isCurrent ? "current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ backgroundColor: baseColor }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

