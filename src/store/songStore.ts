// src/store/songStore.ts
import { create } from "zustand";

export const MELODY_ROWS = 12;
// 💡 드럼을 4개로 늘립니다 (0:Kick, 1:Snare, 2:HiHat Closed, 3:HiHat Open)
export const DRUM_ROWS = 4; 
// 💡 베이스 줄 개수 추가 (멜로디처럼 12음계 사용)
export const BASS_ROWS = 12; 

const DEFAULT_STEPS = 32;

export type SongState = {
  bpm: number;
  steps: number;
  currentStep: number;
  isPlaying: boolean;

  melody: boolean[][];
  drums: boolean[][];
  bass: boolean[][]; // 💡 베이스 상태 추가

  toggleMelody: (row: number, col: number) => void;
  toggleDrum: (row: number, col: number) => void;
  toggleBass: (row: number, col: number) => void; // 💡 베이스 토글 함수 추가

  setBpm: (bpm: number) => void;
  setSteps: (steps: number) => void;
  setCurrentStep: (step: number) => void;
  setPlaying: (playing: boolean) => void;
  clear: () => void;
  loadProject: (project: SongProject) => void;
};

export type SongProject = {
  version: 1;
  bpm: number;
  steps: number;
  melody: boolean[][];
  drums: boolean[][];
  bass?: boolean[][]; // 💡 과거 버전 호환성을 위해 선택적(?) 속성으로 추가
};

function createEmptyMatrix(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
}

function normalizeMatrix(
  input: boolean[][],
  rows: number,
  cols: number
): boolean[][] {
  const matrix = createEmptyMatrix(rows, cols);
  if (!input) return matrix; // 방어 로직 추가
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      matrix[r][c] = Boolean(input?.[r]?.[c]);
    }
  }
  return matrix;
}

export const useSongStore = create<SongState>((set, get) => ({
  bpm: 100,
  steps: DEFAULT_STEPS,
  currentStep: 0,
  isPlaying: false,

  melody: createEmptyMatrix(MELODY_ROWS, DEFAULT_STEPS),
  drums: createEmptyMatrix(DRUM_ROWS, DEFAULT_STEPS),
  bass: createEmptyMatrix(BASS_ROWS, DEFAULT_STEPS), // 💡 베이스 초기화

  toggleMelody: (row, col) =>
    set((state) => {
      const next = state.melody.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return { melody: next };
    }),

  toggleDrum: (row, col) =>
    set((state) => {
      const next = state.drums.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return { drums: next };
    }),

  // 💡 베이스 토글 로직 구현
  toggleBass: (row, col) =>
    set((state) => {
      const next = state.bass.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return { bass: next };
    }),

  setBpm: (bpm) => set({ bpm }),

  setSteps: (steps) => {
    const bpm = get().bpm;
    set({
      steps,
      currentStep: 0,
      bpm,
      melody: createEmptyMatrix(MELODY_ROWS, steps),
      drums: createEmptyMatrix(DRUM_ROWS, steps),
      bass: createEmptyMatrix(BASS_ROWS, steps), // 💡 추가
    });
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  clear: () => {
    const steps = get().steps;
    set({
      currentStep: 0,
      melody: createEmptyMatrix(MELODY_ROWS, steps),
      drums: createEmptyMatrix(DRUM_ROWS, steps),
      bass: createEmptyMatrix(BASS_ROWS, steps), // 💡 추가
    });
  },

  loadProject: (project) => {
    const steps =
      typeof project.steps === "number" && project.steps > 0
        ? project.steps
        : DEFAULT_STEPS;
    const bpm = typeof project.bpm === "number" && project.bpm > 0 ? project.bpm : 100;
    set({
      bpm,
      steps,
      currentStep: 0,
      isPlaying: false,
      melody: normalizeMatrix(project.melody, MELODY_ROWS, steps),
      drums: normalizeMatrix(project.drums, DRUM_ROWS, steps),
      // 💡 이전 프로젝트 파일에 베이스가 없으면 빈 배열로 초기화
      bass: normalizeMatrix(project.bass || [], BASS_ROWS, steps), 
    });
  },
}));