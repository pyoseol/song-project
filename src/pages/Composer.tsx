// src/pages/Composer.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PianoRoll } from "../components/PianoRoll.tsx";
import { TransportBar } from "../components/TransportBar.tsx";
import { initTransport, playDrumPreview } from "../audio/engine.ts";
import { useSongStore, DRUM_ROWS } from "../store/songStore.ts";
import { useUIStore } from "../store/uiStore.ts";

// 💡 App.tsx 에러가 나지 않도록 default 없이 내보냅니다!
export function Composer() {
  const { steps, drums, toggleDrum } = useSongStore();
  const { activeTab, setActiveTab } = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    initTransport();
  }, []);

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100vh', 
      width: '100vw', overflow: 'hidden', background: '#121212' 
    }}>

      {/* 💡 상단 네비게이션 바 (로고 - 탭 - 커뮤니티) */}
      <nav style={{ 
        height: '60px', display: 'flex', alignItems: 'flex-end', 
        background: '#000', padding: '0 20px', borderBottom: '1px solid #333' 
      }}>
        {/* 1. 왼쪽 로고 영역 */}
        <div style={{ flex: 1, paddingBottom: '15px', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
          Composer
        </div>

        {/* 2. 중앙 탭 영역 */}
        <div style={{ display: 'flex', gap: '5px', height: '100%' }}>
          <button onClick={() => setActiveTab("melody")} style={{
            padding: '0 40px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: activeTab === "melody" ? "#333" : "transparent",
            color: activeTab === "melody" ? "#4ade80" : "#666",
            fontWeight: 'bold', fontSize: '16px'
          }}> MELODY</button>
          
          <button onClick={() => setActiveTab("drums")} style={{
            padding: '0 40px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: activeTab === "drums" ? "#333" : "transparent",
            color: activeTab === "drums" ? "#f97316" : "#666",
            fontWeight: 'bold', fontSize: '16px'
          }}> DRUMS</button>

          <button onClick={() => setActiveTab("bass")} style={{
            padding: '0 40px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: activeTab === "bass" ? "#333" : "transparent",
            color: activeTab === "bass" ? "#c084fc" : "#666",
            fontWeight: 'bold', fontSize: '16px'
          }}> BASS</button>
        </div>

        {/* 3. 오른쪽 버튼 영역 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingBottom: '10px' }}>
          <button 
            onClick={() => navigate('/community')}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: '1px solid #444',
              background: '#222', color: '#fff', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = '#222'}
          >
            💬 커뮤니티
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {(activeTab === "melody" || activeTab === "bass") && (
          <div style={{ 
            display: 'flex', gap: '10px', padding: '10px 20px', 
            background: '#1a1a1a', borderBottom: '1px solid #333' 
          }}>
            <span style={{ color: '#888', alignSelf: 'center', marginRight: '10px' }}>Chords (Drag & Drop):</span>
            {["C", "D", "E", "F", "G", "A"].map(chord => (
              <div
                key={chord}
                draggable // 👈 이걸 쓰면 마우스로 끌 수 있습니다!
                onDragStart={(e) => {
                  // 💡 드래그 시작할 때 "나 C코드야!" 하고 데이터를 쥐여줍니다.
                  e.dataTransfer.setData("text/plain", chord);
                }}
                style={{
                  padding: '8px 16px', background: '#333', color: '#fff', 
                  borderRadius: '4px', cursor: 'grab', fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
              >
                {chord}
              </div>
            ))}
          </div>
        )}
        
        {(activeTab === "melody" || activeTab === "bass") && <PianoRoll />}
        
        {activeTab === "drums" && (
          <div style={{ height: '100%', overflow: 'auto', padding: '40px' }}>
            <div style={{ 
              display: 'grid', gridTemplateColumns: `repeat(${steps}, 80px)`, 
              gridAutoRows: '80px', gap: '8px', width: 'max-content', margin: '0 auto' 
            }}>
              {Array.from({ length: DRUM_ROWS }).map((_, row) =>
                Array.from({ length: steps }).map((_, col) => {
                  const active = drums[row]?.[col];
                  const colors = ['#f97316', '#38bdf8', '#fbbf24', '#fcd34d'];
                  const bgColor = active ? colors[row] : '#222';
                  
                  return (
                    <button key={`${row}-${col}`} onClick={() => { toggleDrum(row, col); playDrumPreview(row); }}
                      style={{ background: bgColor, border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ height: '80px', borderTop: '1px solid #333', background: '#111' }}>
        <TransportBar />
      </footer>
    </div>
  );
}