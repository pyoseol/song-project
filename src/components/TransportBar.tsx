// src/components/TransportBar.tsx
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import * as Tone from "tone";
import { exportSongAsMp3 } from "../audio/engine.ts";
import { useSongStore } from "../store/songStore.ts";
import type { SongProject } from "../store/songStore.ts";
import { fetchAiMusic } from "../utils/ai"; // 1단계 함수를 따로 분리했다면 import


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
      const message =
        error instanceof Error ? error.message : String(error);
      alert(`MP3 save failed.\n\n${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = () => {
    const project: SongProject = {
      version: 1,
      bpm,
      steps,
      melody,
      drums,
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
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
    const userPrompt = prompt(
      "어떤 분위기의 곡을 만들고 싶으신가요?\n(예: 신나는 120bpm 댄스 비트 만들어줘)"
    );
    
    // 취소하거나 빈 칸이면 무시
    if (!userPrompt) return;

    setIsGenerating(true);
    try {
      // 1. AI API 호출 (SongProject 타입에 맞는 JSON 리턴 기대)
      const aiGeneratedProject = (await fetchAiMusic(userPrompt)) as SongProject;
      
      // 2. Load Project와 동일하게 Zustand 스토어 업데이트
      useSongStore.getState().loadProject(aiGeneratedProject);
      
      alert("✨ AI 작곡이 완료되었습니다!");
    } catch (error) {
      console.error("AI 작곡 실패:", error);
      alert("AI 악보 생성에 실패했습니다. 프롬프트를 다시 작성해보거나 잠시 후 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="transport-bar">
      {/* Play / Pause */}
      <div className="transport-block">
        <button className="transport-play-button" onClick={handleTogglePlay}>
          {isPlaying ? (
            <div style={{ display: "flex", gap: 4 }}>
              <div
                style={{
                  width: 6,
                  height: 18,
                  background: "#0f172a",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  width: 6,
                  height: 18,
                  background: "#0f172a",
                  borderRadius: 2,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "11px solid transparent",
                borderBottom: "11px solid transparent",
                borderLeft: "18px solid #0f172a",
                marginLeft: 3,
              }}
            />
          )}
        </button>
        <div className="transport-label">Play</div>
      </div>

      {/* Tempo */}
      <div className="transport-tempo transport-block">
        <div className="transport-tempo-title">Tempo</div>
        <div className="transport-tempo-row">
          <input
            type="range"
            min={60}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="transport-tempo-value">{bpm}</span>
        </div>
      </div>

      {/* Length */}
      <div className="transport-select-group transport-block">
        <span>Length</span>
        <select
          className="transport-select"
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
        >
          <option value={8}>8 steps</option>
          <option value={16}>16 steps</option>
          <option value={32}>32 steps</option>
        </select>
      </div>

      {/* Restart */}
      <button className="transport-button transport-block" onClick={clear}>
        Restart
      </button>

      {/* Save MP3 */}
      <button
        className="transport-button transport-block"
        onClick={handleExportMp3}
        disabled={isExporting}
      >
        {isExporting ? "Saving..." : "Save MP3"}
      </button>

      {/* Save/Load Project */}
      <button
        className="transport-button transport-block"
        onClick={handleSaveProject}
      >
        Save Project
      </button>
      <button
        className="transport-button transport-block"
        onClick={handleLoadProjectClick}
      >
        Load Project
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleLoadProject}
        style={{ display: "none" }}
      />
      
      <button
        className="transport-button transport-block"
        onClick={handleAiGenerate}
        disabled={isGenerating}
        style={{
          background: isGenerating ? "#64748b" : "#8b5cf6", // 보라색으로 강조
          color: "white",
          marginLeft: "auto", // 맨 우측으로 밀기 (선택사항)
          border: "none"
        }}
      >
        {isGenerating ? "🎵 작곡 중..." : "✨ AI 도움"}
      </button>
    </div>
  );
};



