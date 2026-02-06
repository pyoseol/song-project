// src/store/songStore.ts
import { create } from "zustand";

export const MELODY_ROWS = 12;
export const DRUM_ROWS = 2;
const DEFAULT_STEPS = 32;

export type SongState = {
  bpm: number;
  steps: number;
  currentStep: number;
  isPlaying: boolean;

  melody: boolean[][];
  drums: boolean[][];

  toggleMelody: (row: number, col: number) => void;
  toggleDrum: (row: number, col: number) => void;

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

  setBpm: (bpm) => set({ bpm }),

  setSteps: (steps) => {
    const bpm = get().bpm;
    set({
      steps,
      currentStep: 0,
      bpm,
      melody: createEmptyMatrix(MELODY_ROWS, steps),
      drums: createEmptyMatrix(DRUM_ROWS, steps),
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
    });
  },

  loadProject: (project) => {
    const steps =
      typeof project.steps === "number" && project.steps > 0
        ? project.steps
        : DEFAULT_STEPS;
    const bpm =
      typeof project.bpm === "number" && project.bpm > 0
        ? project.bpm
        : 100;
    set({
      bpm,
      steps,
      currentStep: 0,
      isPlaying: false,
      melody: normalizeMatrix(project.melody, MELODY_ROWS, steps),
      drums: normalizeMatrix(project.drums, DRUM_ROWS, steps),
    });
  },
}));
