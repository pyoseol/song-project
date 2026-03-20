// src/components/TransportBar.tsx
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import * as Tone from "tone";
import { exportSongAsMp3 } from "../audio/engine.ts";
import { useSongStore } from "../store/songStore.ts";
import type { SongProject } from "../store/songStore.ts";
import { fetchAiMusic } from "../utils/ai"; 

export const TransportBar = () => {
  const {
    bpm,
    setBpm,
    steps,
    setSteps,
    clear,
    isPlaying,
    setPlaying,
    setCurrentStep,
    melody,
    drums,
  } = useSongStore();
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTogglePlay = async () => {
    await Tone.start();
    Tone.Transport.bpm.value = bpm;

    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      setCurrentStep(0);
      setPlaying(false);
    } else {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      setCurrentStep(0);
      Tone.Transport.start("+0.05");
      setPlaying(true);
    }
  };

  const handleExportMp3 = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await exportSongAsMp3();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `song-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("MP3 export failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`MP3 save failed.\n\n${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = () => {
    const project: SongProject = { version: 1, bpm, steps, melody, drums };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `song-project-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleLoadProjectClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SongProject;
      useSongStore.getState().loadProject(parsed);
    } catch (error) {
      console.error(error);
      alert("Failed to load project file.");
    }
  };

  const handleAiGenerate = async () => {
    const userPrompt = prompt("어떤 분위기의 곡을 만들고 싶으신가요?\n(예: 신나는 120bpm 댄스 비트 만들어줘)");
    if (!userPrompt) return;

    setIsGenerating(true);
    try {
      const aiGeneratedProject = (await fetchAiMusic(userPrompt)) as SongProject;
      useSongStore.getState().loadProject(aiGeneratedProject);
      alert("✨ AI 작곡이 완료되었습니다!");
    } catch (error) {
      console.error("AI 작곡 실패:", error);
      alert("AI 악보 생성에 실패했습니다. 프롬프트를 다시 작성해보거나 잠시 후 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 💡 공통 버튼 스타일 정의
  const baseBtnStyle = {
    background: '#222',
    color: '#ddd',
    border: '1px solid #444',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      padding: '0 20px',
      background: '#111', // 상단 네비게이션과 동일한 블랙 배경
      color: '#fff',
      gap: '24px',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. 재생 버튼 (스크린샷 참고한 파란색 포인트) */}
      <button 
        onClick={handleTogglePlay}
        style={{
          width: '50px', height: '50px', borderRadius: '50%',
          background: '#4285F4', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(66, 133, 244, 0.4)'
        }}
      >
        {isPlaying ? (
          <div style={{ display: "flex", gap: '6px' }}>
            <div style={{ width: '4px', height: '18px', background: "#fff", borderRadius: '2px' }} />
            <div style={{ width: '4px', height: '18px', background: "#fff", borderRadius: '2px' }} />
          </div>
        ) : (
          <div style={{
            width: 0, height: 0,
            borderTop: "10px solid transparent",
            borderBottom: "10px solid transparent",
            borderLeft: "16px solid #fff",
            marginLeft: '4px'
          }} />
        )}
      </button>

      {/* 2. 템포(Tempo) 조절 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: '#888', fontWeight: 'bold' }}>Tempo</span>
        <input
          type="range"
          min={60} max={200} value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{ accentColor: '#4285F4', cursor: 'pointer', width: '100px' }}
        />
        <span style={{ fontSize: '15px', color: '#4285F4', fontWeight: 'bold', width: '30px' }}>{bpm}</span>
      </div>

      <div style={{ width: '1px', height: '30px', background: '#333' }} /> {/* 세로 구분선 */}

      {/* 3. 길이(Length) 설정 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: '#888', fontWeight: 'bold' }}>Length</span>
        <select
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          style={{
            background: '#222', color: '#fff', border: '1px solid #444',
            padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', outline: 'none'
          }}
        >
          <option value={8}>8 steps</option>
          <option value={16}>16 steps</option>
          <option value={32}>32 steps</option>
        </select>
      </div>

      <div style={{ width: '1px', height: '30px', background: '#333' }} /> {/* 세로 구분선 */}

      {/* 4. 유틸리티 버튼 그룹 (좌측 정렬) */}
      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
        <button 
          style={baseBtnStyle} 
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = '#222'}
          onClick={clear}
        >
          🔄 초기화
        </button>
        <button 
          style={baseBtnStyle} 
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = '#222'}
          onClick={handleExportMp3} disabled={isExporting}
        >
          {isExporting ? "⏳ 변환 중..." : "💾 MP3 저장"}
        </button>
        <button 
          style={baseBtnStyle} 
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = '#222'}
          onClick={handleSaveProject}
        >
          📁 프로젝트 저장
        </button>
        <button 
          style={baseBtnStyle} 
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = '#222'}
          onClick={handleLoadProjectClick}
        >
          📂 불러오기
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleLoadProject} style={{ display: "none" }} />
      </div>

      {/* 5. AI 도움 버튼 (우측 끝으로 밀착) */}
      <button
        onClick={handleAiGenerate}
        disabled={isGenerating}
        style={{
          ...baseBtnStyle,
          background: isGenerating ? "#64748b" : "#8b5cf6", // 보라색 포인트
          color: "white",
          border: "none",
          fontWeight: "bold",
          padding: '10px 20px',
        }}
        onMouseOver={(e) => { if(!isGenerating) e.currentTarget.style.background = '#7c3aed' }}
        onMouseOut={(e) => { if(!isGenerating) e.currentTarget.style.background = '#8b5cf6' }}
      >
        {isGenerating ? "🎵 작곡 중..." : "✨ AI 도움"}
      </button>

    </div>
  );
};