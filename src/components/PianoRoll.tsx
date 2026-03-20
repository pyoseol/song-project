// src/components/PianoRoll.tsx
import { useState } from "react";
import { playMelodyPreview, playBassPreview } from "../audio/engine.ts";
import { useSongStore, MELODY_ROWS } from "../store/songStore.ts";
import { useUIStore } from "../store/uiStore.ts";

const COLORS = ["#E74C3C", "#E67E22", "#F1C40F", "#2ECC71", "#1ABC9C", "#3498DB", "#9B59B6", "#34495E", "#16A085", "#27AE60", "#2980B9", "#8E44AD"];

// 💡 왼쪽 사이드바에 표시할 음표 이름 목록
const MELODY_LABELS = ["C6", "A5", "G5", "E5", "D5", "C5", "A4", "G4", "E4", "D4", "C4", "A3"];
const BASS_LABELS = ["C5", "A4", "G4", "E4", "D4", "C4", "A3", "G3", "E3", "D3", "C3", "A2"];

export const PianoRoll = () => {
  const { activeTab } = useUIStore();
  const isBass = activeTab === "bass";

  // 💡 드래그 앤 드롭을 위한 applyChord 함수도 가져옵니다.
  const { melody, bass, steps, toggleMelody, toggleBass, applyChord, currentStep } = useSongStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawValue, setDrawValue] = useState<boolean | null>(null);

  const currentGrid = isBass ? bass : melody;
  const currentToggle = isBass ? toggleBass : toggleMelody;
  const currentPreview = isBass ? playBassPreview : playMelodyPreview;
  const currentLabels = isBass ? BASS_LABELS : MELODY_LABELS;

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'auto', // 💡 핵심: 상하좌우 스크롤 모두 켜기!
        background: '#1a1a1a',
        display: 'flex',
        position: 'relative'
      }}
      onMouseUp={() => { setIsDrawing(false); setDrawValue(null); }}
      onMouseLeave={() => { setIsDrawing(false); setDrawValue(null); }}
    >
      
      {/* 💡 1. 왼쪽 고정 사이드바 (음표 이름 표시) */}
      <div style={{
        position: 'sticky', // 💡 가로 스크롤 시에도 화면 왼쪽에 착! 달라붙게 만듭니다.
        left: 0,
        zIndex: 10,
        display: "grid",
        gridTemplateRows: `repeat(${MELODY_ROWS}, 40px)`, // 💡 절대 어긋나지 않게 높이 40px로 고정
        gap: '4px', // 오른쪽 그리드와 동일한 간격
        width: '60px',
        padding: '10px 0', // 위아래 여백을 오른쪽 그리드와 일치
        background: '#111',
        borderRight: '1px solid #333',
      }}>
        {Array.from({ length: MELODY_ROWS }).map((_, row) => (
          <div key={row} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888', fontSize: '12px', fontWeight: 'bold'
          }}>
            {currentLabels[row]}
          </div>
        ))}
      </div>

      {/* 💡 2. 오른쪽 실제 악보(그리드) 영역 */}
      <div style={{ padding: '10px' }}> {/* 사이드바의 위아래 패딩(10px)과 완벽하게 맞춤 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps}, 80px)`,
          gridTemplateRows: `repeat(${MELODY_ROWS}, 40px)`, // 💡 사이드바와 동일하게 40px로 고정!
          gap: '4px',
          width: 'max-content',
        }}>
          {Array.from({ length: MELODY_ROWS }).map((_, row) =>
            Array.from({ length: steps }).map((_, col) => {
              const active = currentGrid[row]?.[col];
              const isBar = col % 4 === 0;
              const isCurrent = col === currentStep;

              return (
                <button
                  key={`${isBass ? 'bass' : 'melody'}-${row}-${col}`}
                  onMouseDown={() => {
                    const target = !active;
                    currentToggle(row, col); 
                    currentPreview(row);     
                    setIsDrawing(true);
                    setDrawValue(target);
                  }}
                  onMouseEnter={() => {
                    if (isDrawing && drawValue !== null && currentGrid[row][col] !== drawValue) {
                      currentToggle(row, col);
                    }
                  }}
                  
                  // 💡 화음 드래그 앤 드롭 기능 추가!
                  onDragOver={(e) => e.preventDefault()} // 드롭 허용
                  onDrop={(e) => {
                    e.preventDefault();
                    const chord = e.dataTransfer.getData("text/plain"); 
                    if (chord && applyChord) {
                      applyChord(chord, col, isBass); // 마우스를 놓은 세로줄(col)에 화음 찍기!
                    }
                  }}

                  style={{
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    background: active 
                      ? (isBass ? "#c084fc" : COLORS[row % COLORS.length]) 
                      : isCurrent 
                        ? "#444" 
                        : isBar ? "#2d2d2d" : "#222",
                    borderRight: isBar && !active ? '1px solid #444' : 'none',
                    outline: isCurrent ? '2px solid #fff' : 'none',
                    transition: 'background 0.1s'
                  }}
                />
              );
            })
          )}
        </div>
      </div>
      
    </div>
  );
};