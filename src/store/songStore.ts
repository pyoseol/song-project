// src/store/songStore.ts
import { create } from "zustand";

export const MELODY_ROWS = 12;
export const DRUM_ROWS = 4;
export const BASS_ROWS = 12;

const DEFAULT_STEPS = 32;

// 💡 1. 화음을 찍을 위치(줄 번호) 사전
const CHORD_MAP: Record<string, number[]> = {
  "C": [10, 8, 7], // C4, E4, G4
  "D": [9, 6, 5],  // D4, A4, C5
  "E": [8, 7, 5],  // E4, G4, C5
  "F": [10, 6, 5], // C4, A4, C5
  "G": [9, 7, 5],  // D4, G4, C5
  "A": [11, 10, 8] // A3, C4, E4
};

// 💡 2. 메뉴판(타입): 여기에 applyChord가 적혀있으면...
export type SongState = {
  bpm: number;
  steps: number;
  currentStep: number;
  isPlaying: boolean;

  melody: boolean[][];
  drums: boolean[][];
  bass: boolean[][];

  toggleMelody: (row: number, col: number) => void;
  toggleDrum: (row: number, col: number) => void;
  toggleBass: (row: number, col: number) => void;
  
  applyChord: (chord: string, col: number, isBass: boolean) => void; 

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
  bass?: boolean[][];
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
  if (!input) return matrix;
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
  bass: createEmptyMatrix(BASS_ROWS, DEFAULT_STEPS),

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

  toggleBass: (row, col) =>
    set((state) => {
      const next = state.bass.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return { bass: next };
    }),

  // 💡 3. 주방(구현부): 무조건 여기에 실제 작동하는 함수가 있어야 에러가 안 납니다!
  applyChord: (chord, col, isBass) =>
    set((state) => {
      const gridKey = isBass ? "bass" : "melody";
      const nextGrid = state[gridKey].map((r) => [...r]);
      const rowsToActive = CHORD_MAP[chord] || [];

      // 해당 열(col)의 기존 음표를 먼저 싹 지우기
      for (let r = 0; r < nextGrid.length; r++) {
        nextGrid[r][col] = false;
      }

      // 화음에 해당하는 줄(row)만 켜기
      rowsToActive.forEach((r) => {
        if (r >= 0 && r < nextGrid.length) {
          nextGrid[r][col] = true;
        }
      });

      return { [gridKey]: nextGrid } as Partial<SongState>;
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
      bass: createEmptyMatrix(BASS_ROWS, steps),
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
      bass: createEmptyMatrix(BASS_ROWS, steps),
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
      bass: normalizeMatrix(project.bass || [], BASS_ROWS, steps),
    });
  },
}));