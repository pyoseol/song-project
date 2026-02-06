// src/pages/Composer.tsx
import { useEffect, useState } from "react";
import { PianoRoll } from "../components/PianoRoll.tsx";
import { TransportBar } from "../components/TransportBar.tsx";
import { initTransport, playDrumPreview } from "../audio/engine.ts";
import { useSongStore, DRUM_ROWS } from "../store/songStore.ts";

export default function Composer() {
  const { steps, drums, toggleDrum, currentStep } = useSongStore();

  // 드럼 드래그용 상태
  const [isDrawingDrum, setIsDrawingDrum] = useState(false);
  const [drumDrawValue, setDrumDrawValue] = useState<boolean | null>(null);

  useEffect(() => {
    initTransport();
  }, [initTransport]);

  const handleDrumMouseDown = (row: number, col: number) => {
    const active = drums[row]?.[col];
    const target = !active;
    toggleDrum(row, col);
    void playDrumPreview(row);
    setIsDrawingDrum(true);
    setDrumDrawValue(target);
  };

  const handleDrumMouseEnter = (row: number, col: number) => {
    if (!isDrawingDrum || drumDrawValue === null) return;
    const active = drums[row]?.[col];
    if (active !== drumDrawValue) {
      toggleDrum(row, col);
    }
  };

  const handleDrumMouseUp = () => {
    setIsDrawingDrum(false);
    setDrumDrawValue(null);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo-dot" />
        <span>SONG</span>
      </header>

      <main className="app-main">
        <div className="app-grid-area">
          <div className="app-grid-inner">
            {/* 왼쪽 트랙 라벨 */}
            <div className="track-list">
              <div className="track-list-item">Melody</div>
              <div style={{ marginTop: 20 }} className="track-list-item">
                Drums
              </div>
            </div>

            {/* 오른쪽 패널 */}
            <div className="grid-panel">
              {/* 피아노 롤 */}
              <PianoRoll />

              {/* 드럼 2줄 – 피아노와 완전히 같은 grid */}
              <div
                className="drum-row"
                onMouseUp={handleDrumMouseUp}
              >
                <div
                  className="drum-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${steps}, 1fr)`,
                    gridTemplateRows: `repeat(DRUM_ROWS, 1fr)`,
                  }}
                >
                  {Array.from({ length: DRUM_ROWS }).map((_, row) =>
                    Array.from({ length: steps }).map((_, col) => {
                      const active = drums[row]?.[col];
                      const isCurrent = col === currentStep;
                      const isBar = col % 4 === 0;

                      return (
                        <button
                          key={`${row}-${col}`}
                          className={[
                            "drum-cell",
                            isBar ? "bar" : "",
                            isCurrent ? "current" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={() =>
                            handleDrumMouseDown(row, col)
                          }
                          onMouseEnter={() =>
                            handleDrumMouseEnter(row, col)
                          }
                        >
                          <div
                            className={
                              "drum-dot" + (active ? " active" : "")
                            }
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <TransportBar />
      </main>
    </div>
  );
}
