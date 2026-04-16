import { create } from 'zustand';
import {
  BASS_CHORD_MAP,
  //BASS_MIGRATION_MAP,
  BASS_NOTE_TO_ROW,
  BASS_ROWS,
  DRUM_ROWS,
  //LEGACY_BASS_NOTES,
  //LEGACY_EXTENDED_BASS_NOTES,
  //LEGACY_MELODY_NOTES,
  MELODY_CHORD_MAP,
  MELODY_NOTE_TO_ROW,
  MELODY_ROWS,
  MELODY_NOTES,
  BASS_NOTES
} from '../constants/composer.ts';

const BAR_LENGTH = 16;
export const FIXED_BAR_COUNT = 40;
export const FIXED_COMPOSER_STEPS = BAR_LENGTH * FIXED_BAR_COUNT;
const DEFAULT_STEPS = FIXED_COMPOSER_STEPS;
const MAX_HISTORY_LENGTH = 40;
const MELODY_LENGTH_PRESETS = [1, 2, 4, 8, 16] as const;

export { BASS_ROWS, DRUM_ROWS, MELODY_ROWS };

type LoopRange = {
  start: number;
  end: number;
};

export type MusicEvent = {
  note?: string;
  type?: string;
  start: number;
  duration?: number;
};

export type InstrumentKey = 'melody' | 'drums' | 'bass';

export type InstrumentVolumes = Record<InstrumentKey, number>;

type BarClipboard = {
  length: number;
  melody: boolean[][];
  melodyLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
} | null;

type SongHistorySnapshot = {
  bpm: number;
  steps: number;
  currentStep: number;
  melody: boolean[][];
  melodyLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
  loopRange: LoopRange | null;
};

export type SongState = {
  bpm: number;
  steps: number;
  currentStep: number;
  isPlaying: boolean;
  volumes: InstrumentVolumes;
  melody: boolean[][];
  melodyLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
  loopRange: LoopRange | null;
  barClipboard: BarClipboard;
  historyPast: SongHistorySnapshot[];
  historyFuture: SongHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  toggleMelody: (row: number, col: number, length?: number) => void;
  toggleDrum: (row: number, col: number) => void;
  toggleBass: (row: number, col: number) => void;
  applyChord: (chord: string, col: number, isBass: boolean) => void;
  copyCurrentBar: () => void;
  pasteCurrentBar: () => void;
  duplicateCurrentBar: () => void;
  clearCurrentBar: () => void;
  toggleLoopCurrentBar: () => void;
  setLoopRange: (range: LoopRange | null) => void;
  undo: () => void;
  redo: () => void;
  setInstrumentVolume: (instrument: InstrumentKey, volume: number) => void;
  setBpm: (bpm: number) => void;
  setSteps: (steps: number) => void;
  setCurrentStep: (step: number) => void;
  setPlaying: (playing: boolean) => void;
  clear: () => void;
  loadProject: (project: SongProject) => void;
  applyRemoteProject: (project: SongProject) => void;
};

export type SongProject = {
  version: 2;
  bpm: number;
  steps: number;
  volumes?: Partial<InstrumentVolumes>;
  tracks: {
    melody: MusicEvent[];
    drums: MusicEvent[];
    bass: MusicEvent[];
  };
};

type SongProjectSnapshotInput = Pick<
  SongState,
  'bpm' | 'steps' | 'volumes' | 'melody' | 'melodyLengths' | 'drums' | 'bass'
>;

function createEmptyMatrix(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
}

function createEmptyLengthMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
}

function resizeMatrix(source: boolean[][], rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => Boolean(source[row]?.[col]))
  );
}

function resizeLengthMatrix(
  source: number[][],
  melody: boolean[][],
  rows: number,
  cols: number
): number[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      if (!melody[row]?.[col]) {
        return 0;
      }

      const rawLength = Math.max(1, Math.floor(source[row]?.[col] ?? 1));
      return snapMelodyLength(rawLength, cols - col);
    })
  );
}

function cloneMatrix(matrix: boolean[][]): boolean[][] {
  return matrix.map((row) => [...row]);
}

function cloneLengthMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => [...row]);
}

function clampStep(step: number, steps: number) {
  if (steps <= 0) {
    return 0;
  }

  return Math.min(Math.max(step, 0), steps - 1);
}

function clampVolume(volume: number) {
  return Math.min(Math.max(Math.round(volume), 0), 100);
}

function snapMelodyLength(length: number, maxLength: number) {
  const safeMaxLength = Math.max(1, Math.floor(maxLength));
  const safeLength = Math.max(1, Math.floor(length));
  const allowedPresets = MELODY_LENGTH_PRESETS.filter((preset) => preset <= safeMaxLength);
  const fallbackPreset = allowedPresets[allowedPresets.length - 1] ?? 1;

  return allowedPresets.reduce((closest, preset) => {
    const presetDistance = Math.abs(preset - safeLength);
    const closestDistance = Math.abs(closest - safeLength);

    if (presetDistance < closestDistance) {
      return preset;
    }

    if (presetDistance === closestDistance && preset > closest) {
      return preset;
    }

    return closest;
  }, fallbackPreset);
}

function normalizeLoopRange(loopRange: LoopRange | null, steps: number): LoopRange | null {
  if (!loopRange) {
    return null;
  }

  const start = clampStep(loopRange.start, steps);
  const end = clampStep(loopRange.end, steps);

  if (end < start) {
    return null;
  }

  return { start, end };
}

function findMelodyNoteAt(
  melodyRow: boolean[],
  melodyLengthRow: number[],
  col: number
): { start: number; length: number } | null {
  for (let start = 0; start <= col; start += 1) {
    if (!melodyRow[start]) {
      continue;
    }

    const length = Math.max(1, melodyLengthRow[start] ?? 1);
    if (col < start + length) {
      return { start, length };
    }
  }

  return null;
}

function clearMelodyNote(
  melodyRow: boolean[],
  melodyLengthRow: number[],
  start: number
) {
  if (start < 0 || start >= melodyRow.length) {
    return;
  }

  melodyRow[start] = false;
  melodyLengthRow[start] = 0;
}

function rangesOverlap(startA: number, lengthA: number, startB: number, lengthB: number) {
  const endA = startA + Math.max(1, lengthA);
  const endB = startB + Math.max(1, lengthB);
  return startA < endB && startB < endA;
}

function createHistorySnapshot(state: Pick<
  SongState,
  'bpm' | 'steps' | 'currentStep' | 'melody' | 'melodyLengths' | 'drums' | 'bass' | 'loopRange'
>): SongHistorySnapshot {
  return {
    bpm: state.bpm,
    steps: state.steps,
    currentStep: state.currentStep,
    melody: cloneMatrix(state.melody),
    melodyLengths: cloneLengthMatrix(state.melodyLengths),
    drums: cloneMatrix(state.drums),
    bass: cloneMatrix(state.bass),
    loopRange: state.loopRange ? { ...state.loopRange } : null,
  };
}

function getCurrentBarRange(currentStep: number, steps: number) {
  const safeStep = clampStep(currentStep, steps);
  const start = Math.floor(safeStep / BAR_LENGTH) * BAR_LENGTH;
  const end = Math.min(start + BAR_LENGTH - 1, steps - 1);

  return {
    start,
    end,
    length: end - start + 1,
    index: Math.floor(safeStep / BAR_LENGTH),
  };
}

function extractBar(matrix: boolean[][], start: number, length: number): boolean[][] {
  return matrix.map((row) => row.slice(start, start + length));
}

function extractLengthBar(matrix: number[][], start: number, length: number): number[][] {
  return matrix.map((row) => row.slice(start, start + length));
}

function pasteBar(
  target: boolean[][],
  source: boolean[][],
  start: number,
  steps: number,
  mode: 'replace' | 'clear'
) {
  const next = cloneMatrix(target);

  next.forEach((row, rowIndex) => {
    for (let offset = 0; offset < BAR_LENGTH && start + offset < steps; offset += 1) {
      if (mode === 'clear') {
        row[start + offset] = false;
        continue;
      }

      row[start + offset] = Boolean(source[rowIndex]?.[offset]);
    }
  });

  return next;
}

function pasteLengthBar(target: number[][], source: number[][], start: number, steps: number) {
  const next = cloneLengthMatrix(target);

  next.forEach((row, rowIndex) => {
    for (let offset = 0; offset < BAR_LENGTH && start + offset < steps; offset += 1) {
      row[start + offset] = Number(source[rowIndex]?.[offset] ?? 0);
    }
  });

  return next;
}
/*
function normalizeMatrix(
  input: boolean[][] | undefined,
  rows: number,
  cols: number
): boolean[][] {
  const matrix = createEmptyMatrix(rows, cols);
  if (!input) {
    return matrix;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      matrix[row][col] = Boolean(input[row]?.[col]);
    }
  }

  return matrix;
}

function normalizeMelodyMatrix(input: boolean[][] | undefined, cols: number): boolean[][] {
  if (!input) {
    return createEmptyMatrix(MELODY_ROWS, cols);
  }

  if (input.length === LEGACY_MELODY_NOTES.length) {
    const matrix = createEmptyMatrix(MELODY_ROWS, cols);

    LEGACY_MELODY_NOTES.forEach((note, legacyRow) => {
      const nextRow = MELODY_NOTE_TO_ROW[note];
      if (typeof nextRow !== 'number') {
        return;
      }

      for (let col = 0; col < cols; col += 1) {
        matrix[nextRow][col] = Boolean(input[legacyRow]?.[col]);
      }
    });

    return matrix;
  }

  return normalizeMatrix(input, MELODY_ROWS, cols);
}


function normalizeMelodyLengthMatrix(
  input: number[][] | undefined,
  melodyInput: boolean[][] | undefined,
  cols: number
): number[][] {
  const matrix = createEmptyLengthMatrix(MELODY_ROWS, cols);

  if (input) {
    for (let row = 0; row < MELODY_ROWS; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const rawLength = Math.max(0, Math.floor(input[row]?.[col] ?? 0));
        matrix[row][col] =
          rawLength > 0 ? snapMelodyLength(rawLength, cols - col) : 0;
      }
    }

    return matrix;
  }

  const normalizedMelody = normalizeMelodyMatrix(melodyInput, cols);
  for (let row = 0; row < MELODY_ROWS; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (normalizedMelody[row][col]) {
        matrix[row][col] = 1;
      }
    }
  }

  return matrix;
}

function normalizeBassMatrix(input: boolean[][] | undefined, cols: number): boolean[][] {
  if (!input) {
    return createEmptyMatrix(BASS_ROWS, cols);
  }

  if (
    input.length === LEGACY_BASS_NOTES.length ||
    input.length === LEGACY_EXTENDED_BASS_NOTES.length
  ) {
    const matrix = createEmptyMatrix(BASS_ROWS, cols);
    const sourceNotes =
      input.length === LEGACY_EXTENDED_BASS_NOTES.length
        ? LEGACY_EXTENDED_BASS_NOTES
        : LEGACY_BASS_NOTES;

    sourceNotes.forEach((note, legacyRow) => {
      const targetNote = BASS_MIGRATION_MAP[note] ?? note;
      const nextRow = BASS_NOTE_TO_ROW[targetNote];
      if (typeof nextRow !== 'number') {
        return;
      }

      for (let col = 0; col < cols; col += 1) {
        matrix[nextRow][col] =
          matrix[nextRow][col] || Boolean(input[legacyRow]?.[col]);
      }
    });

    return matrix;
  }

  return normalizeMatrix(input, BASS_ROWS, cols);
}
*/
export function buildSongProjectSnapshot(state: SongProjectSnapshotInput): SongProject {
  const melodyEvents: MusicEvent[] = [];
  const drumEvents: MusicEvent[] = [];
  const bassEvents: MusicEvent[] = [];

  // 1. 멜로디 압축
  for (let r = 0; r < MELODY_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.melody[r][s]) {
        const duration = state.melodyLengths[r][s] || 1;
        melodyEvents.push({
          note: MELODY_NOTES[r] as string, 
          start: s,
          duration: duration
        });
        s += (duration - 1); // duration만큼 건너뛰기
      }
    }
  }

  // 2. 드럼 압축
  const drumNames = ['Kick', 'Snare', 'HiHatClosed', 'HiHatOpen'];
  for (let r = 0; r < DRUM_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.drums[r][s]) {
        drumEvents.push({ type: drumNames[r], start: s });
      }
    }
  }

  // 3. 베이스 압축
  for (let r = 0; r < BASS_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.bass[r][s]) {
        bassEvents.push({ note: BASS_NOTES[r] as string, start: s, duration: 1 });
      }
    }
  }

  return {
    version: 2,
    bpm: state.bpm,
    steps: state.steps,
    volumes: {
      melody: clampVolume(state.volumes.melody ?? 82),
      drums: clampVolume(state.volumes.drums ?? 78),
      bass: clampVolume(state.volumes.bass ?? 84),
    },
    tracks: {
      melody: melodyEvents,
      drums: drumEvents,
      bass: bassEvents,
    },
  };
}
function buildHistoryUpdate(state: SongState, nextState: Partial<SongState>) {
  const historyPast = [...state.historyPast, createHistorySnapshot(state)].slice(
    -MAX_HISTORY_LENGTH
  );

  return {
    ...nextState,
    historyPast,
    historyFuture: [],
    canUndo: historyPast.length > 0,
    canRedo: false,
  } as Partial<SongState>;
}

function restoreHistorySnapshot(
  snapshot: SongHistorySnapshot,
  historyPast: SongHistorySnapshot[],
  historyFuture: SongHistorySnapshot[]
): Partial<SongState> {
  return {
    bpm: snapshot.bpm,
    steps: snapshot.steps,
    currentStep: clampStep(snapshot.currentStep, snapshot.steps),
    isPlaying: false,
    melody: cloneMatrix(snapshot.melody),
    melodyLengths: cloneLengthMatrix(snapshot.melodyLengths),
    drums: cloneMatrix(snapshot.drums),
    bass: cloneMatrix(snapshot.bass),
    loopRange: snapshot.loopRange ? { ...snapshot.loopRange } : null,
    historyPast,
    historyFuture,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
  };
}

function parseV2TracksToGrids(project: SongProject, steps: number) {
  const melody = createEmptyMatrix(MELODY_ROWS, steps);
  const melodyLengths = createEmptyLengthMatrix(MELODY_ROWS, steps);
  const drums = createEmptyMatrix(DRUM_ROWS, steps);
  const bass = createEmptyMatrix(BASS_ROWS, steps);

  if (project.tracks) {
    // 1. 멜로디 파싱
    project.tracks.melody?.forEach(e => {
      const row = MELODY_NOTE_TO_ROW[e.note as keyof typeof MELODY_NOTE_TO_ROW] ?? -1;
      if (row !== -1 && e.start < steps) {
        const dur = e.duration || 1;
        // 💡 반복문 제거: 시작 위치 딱 한 칸만 true로 찍고 길이만 저장합니다.
        melody[row][e.start] = true;
        melodyLengths[row][e.start] = dur;
      }
    });

    // 2. 드럼 파싱
    const drumMap: Record<string, number> = { Kick: 0, Snare: 1, HiHatClosed: 2, HiHatOpen: 3 };
    project.tracks.drums?.forEach(e => {
      const row = drumMap[e.type || ''] ?? -1;
      if (row !== -1 && e.start < steps) {
        drums[row][e.start] = true;
      }
    });

    // 3. 베이스 파싱
    project.tracks.bass?.forEach(e => {
      const row = BASS_NOTE_TO_ROW[e.note as keyof typeof BASS_NOTE_TO_ROW] ?? -1;
      if (row !== -1 && e.start < steps) {
        // 💡 베이스 역시 반복문 제거: 시작점만 true로 찍습니다.
        bass[row][e.start] = true;
      }
    });
  }
  return { melody, melodyLengths, drums, bass };
}

export const useSongStore = create<SongState>((set, get) => ({
  bpm: 100,
  steps: DEFAULT_STEPS,
  currentStep: 0,
  isPlaying: false,
  volumes: {
    melody: 82,
    drums: 78,
    bass: 84,
  },
  melody: createEmptyMatrix(MELODY_ROWS, DEFAULT_STEPS),
  melodyLengths: createEmptyLengthMatrix(MELODY_ROWS, DEFAULT_STEPS),
  drums: createEmptyMatrix(DRUM_ROWS, DEFAULT_STEPS),
  bass: createEmptyMatrix(BASS_ROWS, DEFAULT_STEPS),
  loopRange: null,
  barClipboard: null,
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,

  toggleMelody: (row, col, length = 1) =>
    set((state) => {
      const melody = cloneMatrix(state.melody);
      const melodyLengths = cloneLengthMatrix(state.melodyLengths);
      const existingNote = findMelodyNoteAt(melody[row] ?? [], melodyLengths[row] ?? [], col);
      const requestedLength = Math.floor(length);

      if (requestedLength <= 0) {
        if (!existingNote) {
          return {};
        }

        clearMelodyNote(melody[row], melodyLengths[row], existingNote.start);
        return buildHistoryUpdate(state, { melody, melodyLengths });
      }

      const nextLength = snapMelodyLength(requestedLength, state.steps - col);

      if (existingNote) {
        if (existingNote.start === col && existingNote.length === nextLength) {
          return {};
        }

        clearMelodyNote(melody[row], melodyLengths[row], existingNote.start);
      }

      for (let start = 0; start < state.steps; start += 1) {
        if (!melody[row]?.[start]) {
          continue;
        }

        const noteLength = melodyLengths[row]?.[start] ?? 1;
        if (rangesOverlap(start, noteLength, col, nextLength)) {
          clearMelodyNote(melody[row], melodyLengths[row], start);
        }
      }

      melody[row][col] = true;
      melodyLengths[row][col] = nextLength;

      return buildHistoryUpdate(state, { melody, melodyLengths });
    }),

  toggleDrum: (row, col) =>
    set((state) => {
      const drums = cloneMatrix(state.drums);
      drums[row][col] = !drums[row][col];

      return buildHistoryUpdate(state, { drums });
    }),

  toggleBass: (row, col) =>
    set((state) => {
      const bass = cloneMatrix(state.bass);
      bass[row][col] = !bass[row][col];

      return buildHistoryUpdate(state, { bass });
    }),

  applyChord: (chord, col, isBass) =>
    set((state) => {
      const gridKey = isBass ? 'bass' : 'melody';
      const nextGrid = cloneMatrix(state[gridKey]);
      const nextMelodyLengths = cloneLengthMatrix(state.melodyLengths);
      const rowsToActivate = (isBass ? BASS_CHORD_MAP : MELODY_CHORD_MAP)[chord] ?? [];

      rowsToActivate.forEach((row) => {
        if (row >= 0 && row < nextGrid.length && col >= 0 && col < state.steps) {
          if (!isBass) {
            const existingNote = findMelodyNoteAt(
              nextGrid[row] ?? [],
              nextMelodyLengths[row] ?? [],
              col
            );
            if (existingNote) {
              clearMelodyNote(nextGrid[row], nextMelodyLengths[row], existingNote.start);
            }
          }

          nextGrid[row][col] = true;
          if (!isBass) {
            nextMelodyLengths[row][col] = 1;
          }
        }
      });

      return buildHistoryUpdate(state, {
        [gridKey]: nextGrid,
        ...(!isBass ? { melodyLengths: nextMelodyLengths } : {}),
      } as Partial<SongState>);
    }),

  copyCurrentBar: () => {
    const state = get();
    const range = getCurrentBarRange(state.currentStep, state.steps);

    set({
      barClipboard: {
        length: range.length,
        melody: extractBar(state.melody, range.start, range.length),
        melodyLengths: extractLengthBar(state.melodyLengths, range.start, range.length),
        drums: extractBar(state.drums, range.start, range.length),
        bass: extractBar(state.bass, range.start, range.length),
      },
    });
  },

  pasteCurrentBar: () =>
    set((state) => {
      if (!state.barClipboard) {
        return {};
      }

      const range = getCurrentBarRange(state.currentStep, state.steps);

      return buildHistoryUpdate(state, {
        melody: pasteBar(
          state.melody,
          state.barClipboard.melody,
          range.start,
          state.steps,
          'replace'
        ),
        melodyLengths: pasteLengthBar(
          state.melodyLengths,
          state.barClipboard.melodyLengths,
          range.start,
          state.steps
        ),
        drums: pasteBar(
          state.drums,
          state.barClipboard.drums,
          range.start,
          state.steps,
          'replace'
        ),
        bass: pasteBar(
          state.bass,
          state.barClipboard.bass,
          range.start,
          state.steps,
          'replace'
        ),
      });
    }),

  duplicateCurrentBar: () =>
    set((state) => {
      const range = getCurrentBarRange(state.currentStep, state.steps);
      const nextStart = range.start + BAR_LENGTH;

      if (nextStart >= state.steps) {
        return {};
      }

      return buildHistoryUpdate(state, {
        melody: pasteBar(
          state.melody,
          extractBar(state.melody, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        melodyLengths: pasteLengthBar(
          state.melodyLengths,
          extractLengthBar(state.melodyLengths, range.start, range.length),
          nextStart,
          state.steps
        ),
        drums: pasteBar(
          state.drums,
          extractBar(state.drums, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        bass: pasteBar(
          state.bass,
          extractBar(state.bass, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        currentStep: nextStart,
      });
    }),

  clearCurrentBar: () =>
    set((state) => {
      const range = getCurrentBarRange(state.currentStep, state.steps);

      return buildHistoryUpdate(state, {
        melody: pasteBar(state.melody, [], range.start, state.steps, 'clear'),
        melodyLengths: pasteLengthBar(
          state.melodyLengths,
          createEmptyLengthMatrix(MELODY_ROWS, BAR_LENGTH),
          range.start,
          state.steps
        ),
        drums: pasteBar(state.drums, [], range.start, state.steps, 'clear'),
        bass: pasteBar(state.bass, [], range.start, state.steps, 'clear'),
      });
    }),

  toggleLoopCurrentBar: () =>
    set((state) => {
      const range = getCurrentBarRange(state.currentStep, state.steps);
      const sameLoop =
        state.loopRange?.start === range.start && state.loopRange?.end === range.end;

      return {
        loopRange: sameLoop ? null : { start: range.start, end: range.end },
        currentStep: sameLoop ? state.currentStep : range.start,
      };
    }),

  setLoopRange: (range) =>
    set((state) => {
      const nextLoopRange = normalizeLoopRange(range, state.steps);

      return {
        loopRange: nextLoopRange,
        currentStep: nextLoopRange ? nextLoopRange.start : clampStep(state.currentStep, state.steps),
      };
    }),

  undo: () =>
    set((state) => {
      if (!state.historyPast.length) {
        return {};
      }

      const previous = state.historyPast[state.historyPast.length - 1];
      const nextFuture = [createHistorySnapshot(state), ...state.historyFuture].slice(
        0,
        MAX_HISTORY_LENGTH
      );

      return restoreHistorySnapshot(
        previous,
        state.historyPast.slice(0, -1),
        nextFuture
      );
    }),

  redo: () =>
    set((state) => {
      if (!state.historyFuture.length) {
        return {};
      }

      const next = state.historyFuture[0];
      const nextPast = [...state.historyPast, createHistorySnapshot(state)].slice(
        -MAX_HISTORY_LENGTH
      );

      return restoreHistorySnapshot(next, nextPast, state.historyFuture.slice(1));
    }),

  setInstrumentVolume: (instrument, volume) =>
    set((state) => ({
      volumes: {
        ...state.volumes,
        [instrument]: clampVolume(volume),
      },
    })),

  setBpm: (bpm) =>
    set((state) => {
      if (state.bpm === bpm) {
        return {};
      }

      return buildHistoryUpdate(state, { bpm });
    }),

  setSteps: (steps) =>
    set((state) => {
      if (state.steps === steps) {
        return {};
      }

      const melody = resizeMatrix(state.melody, MELODY_ROWS, steps);
      const drums = resizeMatrix(state.drums, DRUM_ROWS, steps);
      const bass = resizeMatrix(state.bass, BASS_ROWS, steps);
      const melodyLengths = resizeLengthMatrix(
        state.melodyLengths,
        melody,
        MELODY_ROWS,
        steps
      );

      return buildHistoryUpdate(state, {
        steps,
        currentStep: clampStep(state.currentStep, steps),
        melody,
        melodyLengths,
        drums,
        bass,
        loopRange: normalizeLoopRange(state.loopRange, steps),
        barClipboard: null,
      });
    }),

  setCurrentStep: (step) =>
    set((state) => ({
      currentStep: clampStep(step, state.steps),
    })),

  setPlaying: (playing) => set({ isPlaying: playing }),

  clear: () =>
    set((state) =>
      buildHistoryUpdate(state, {
        currentStep: 0,
        melody: createEmptyMatrix(MELODY_ROWS, state.steps),
        melodyLengths: createEmptyLengthMatrix(MELODY_ROWS, state.steps),
        drums: createEmptyMatrix(DRUM_ROWS, state.steps),
        bass: createEmptyMatrix(BASS_ROWS, state.steps),
      })
    ),

  loadProject: (project) => {
    const steps = FIXED_COMPOSER_STEPS;
    const bpm = typeof project.bpm === 'number' && project.bpm > 0 ? project.bpm : 100;
    const grids = parseV2TracksToGrids(project, steps); // V2 파싱

    set((state) =>
      buildHistoryUpdate(state, {
        bpm,
        steps,
        currentStep: 0,
        isPlaying: false,
        volumes: {
          melody: clampVolume(project.volumes?.melody ?? 82),
          drums: clampVolume(project.volumes?.drums ?? 78),
          bass: clampVolume(project.volumes?.bass ?? 84),
        },
        melody: grids.melody,
        melodyLengths: grids.melodyLengths,
        drums: grids.drums,
        bass: grids.bass,
        loopRange: normalizeLoopRange(null, steps),
      })
    );
  },

  applyRemoteProject: (project) => {
    const steps = FIXED_COMPOSER_STEPS;
    const bpm = typeof project.bpm === 'number' && project.bpm > 0 ? project.bpm : 100;
    const grids = parseV2TracksToGrids(project, steps); // V2 파싱

    set((state) => ({
      bpm,
      steps,
      currentStep: clampStep(state.currentStep, steps),
      volumes: {
        melody: clampVolume(project.volumes?.melody ?? 82),
        drums: clampVolume(project.volumes?.drums ?? 78),
        bass: clampVolume(project.volumes?.bass ?? 84),
      },
      melody: grids.melody,
      melodyLengths: grids.melodyLengths,
      drums: grids.drums,
      bass: grids.bass,
      loopRange: normalizeLoopRange(state.loopRange, steps),
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    }));
  },
}));