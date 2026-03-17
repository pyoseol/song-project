// src/components/PianoRoll.tsx
import { useState } from "react";
import { playMelodyPreview, playBassPreview } from "../audio/engine.ts"; // 💡 베이스 미리듣기 추가
import { useSongStore, MELODY_ROWS } from "../store/songStore.ts";
import { useUIStore } from "../store/uiStore.ts"; // 💡 현재 탭 확인용 추가

const COLORS = ["#E74C3C", "#E67E22", "#F1C40F", "#2ECC71", "#1ABC9C", "#3498DB", "#9B59B6", "#34495E", "#16A085", "#27AE60", "#2980B9", "#8E44AD"];

export const PianoRoll = () => {
  // 💡 현재 탭이 BASS인지 확인
  const { activeTab } = useUIStore();
  const isBass = activeTab === "bass";

  // 💡 베이스 관련 상태(bass, toggleBass)도 함께 가져옴
  const { melody, bass, steps, toggleMelody, toggleBass, currentStep } = useSongStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawValue, setDrawValue] = useState<boolean | null>(null);

  // 💡 현재 탭에 따라 사용할 데이터와 함수를 결정!
  const currentGrid = isBass ? bass : melody;
  const currentToggle = isBass ? toggleBass : toggleMelody;
  const currentPreview = isBass ? playBassPreview : playMelodyPreview;

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflowX: 'auto',
        overflowY: 'hidden',
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column'
      }}
      // 마우스를 떼거나 영역 밖으로 나가면 그리기 모드 종료
      onMouseUp={() => { setIsDrawing(false); setDrawValue(null); }}
      onMouseLeave={() => { setIsDrawing(false); setDrawValue(null); }}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${steps}, 80px)`,
        gridTemplateRows: `repeat(${MELODY_ROWS}, 1fr)`, 
        gap: '2px',
        width: 'max-content',
        height: '100%',
        padding: '10px'
      }}>
        {Array.from({ length: MELODY_ROWS }).map((_, row) =>
          Array.from({ length: steps }).map((_, col) => {
            // 💡 melody 대신 currentGrid 사용
            const active = currentGrid[row]?.[col];
            const isBar = col % 4 === 0;
            const isCurrent = col === currentStep;

            return (
              <button
                key={`${isBass ? 'bass' : 'melody'}-${row}-${col}`}
                onMouseDown={() => {
                  const target = !active;
                  currentToggle(row, col); // 💡 스위칭된 토글 함수 사용
                  currentPreview(row);     // 💡 스위칭된 소리 재생 함수 사용
                  setIsDrawing(true);
                  setDrawValue(target);
                }}
                onMouseEnter={() => {
                  // 💡 드래그 중일 때도 currentGrid 기준으로 체크
                  if (isDrawing && drawValue !== null && currentGrid[row][col] !== drawValue) {
                    currentToggle(row, col);
                  }
                }}
                style={{
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  // 💡 멜로디는 기존 무지개색, 베이스는 보라색(#c084fc)으로 구분
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
  );
};