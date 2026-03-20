// src/pages/Composer.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PianoRoll } from "../components/PianoRoll.tsx";
import { TransportBar } from "../components/TransportBar.tsx";
import { initTransport, playDrumPreview } from "../audio/engine.ts";
import { useSongStore, DRUM_ROWS, BASS_ROWS } from "../store/songStore.ts";
import { useUIStore } from "../store/uiStore.ts";

export default function Composer() {
  const { steps, drums, toggleDrum, bass, toggleBass } = useSongStore();
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

      <nav style={{ height: '60px', display: 'flex', background: '#000', padding: '10px 20px 0', gap: '5px', borderBottom: '1px solid #333' }}>
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

        {/* 💡 BASS 탭 버튼 추가 */}
        <button onClick={() => setActiveTab("bass")} style={{
          padding: '0 40px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
          background: activeTab === "bass" ? "#333" : "transparent",
          color: activeTab === "bass" ? "#c084fc" : "#666", // 베이스는 보라색으로 포인트
          fontWeight: 'bold', fontSize: '16px'
        }}> BASS</button>

        <div style={{ marginLeft: 'auto', marginBottom: '10px' }}>
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
        {(activeTab === "melody" || activeTab === "bass") && <PianoRoll />}
        
        {activeTab === "drums" && (
          <div style={{ height: '100%', overflow: 'auto', padding: '40px' }}>
            <div style={{ 
              display: 'grid', gridTemplateColumns: `repeat(${steps}, 60px)`, 
              gridAutoRows: '80px', gap: '8px', width: 'max-content', margin: '0 auto' 
            }}>
              {Array.from({ length: DRUM_ROWS }).map((_, row) =>
                Array.from({ length: steps }).map((_, col) => {
                  const active = drums[row]?.[col];
                  // 💡 줄별로 색상 다르게 표시 (Kick, Snare, Hihat C, Hihat O)
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

        {/* 💡 BASS 화면 추가 */}
        {activeTab === "bass" && (
          <div style={{ height: '100%', overflow: 'auto', padding: '40px' }}>
            <div style={{ 
              display: 'grid', gridTemplateColumns: `repeat(${steps}, 60px)`, 
              gridAutoRows: '40px', gap: '4px', width: 'max-content', margin: '0 auto' 
            }}>
              {Array.from({ length: BASS_ROWS }).map((_, row) =>
                Array.from({ length: steps }).map((_, col) => {
                  const active = bass[row]?.[col];
                  return (
                    <button key={`bass-${row}-${col}`} onClick={() => { toggleBass(row, col); }}
                      style={{ background: active ? '#c084fc' : '#222', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
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