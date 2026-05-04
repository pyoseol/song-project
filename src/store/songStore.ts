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
  BASS_NOTES,
  DRUM_TRACK_LABELS,
  GUITAR_ROWS,
  GUITAR_TRACK_LABELS,
  SAXOPHONE_NOTE_TO_ROW,
  SAXOPHONE_NOTES,
  SAXOPHONE_ROWS,
  VIOLIN_NOTE_TO_ROW,
  VIOLIN_NOTES,
  VIOLIN_ROWS
} from '../constants/composer.ts';

const BAR_LENGTH = 16;
export const FIXED_BAR_COUNT = 40;
export const FIXED_COMPOSER_STEPS = BAR_LENGTH * FIXED_BAR_COUNT;
const DEFAULT_STEPS = FIXED_COMPOSER_STEPS;
const MAX_HISTORY_LENGTH = 40;
const MELODY_LENGTH_PRESETS = [1, 2, 4, 8, 16] as const;

export { BASS_ROWS, DRUM_ROWS, GUITAR_ROWS, MELODY_ROWS };

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

export type InstrumentKey = 'melody' | 'violin' | 'saxophone' | 'drums' | 'bass' | 'guitar';
export type InstrumentVolumes = Record<InstrumentKey, number>;

export type ExtraInstrumentTrack = {
  id: string;
  instrument: InstrumentKey;
  label: string;
  volume: number;
  grid: boolean[][];
  melodyLengths?: number[][];
};

export type SerializedExtraInstrumentTrack = {
  id?: string;
  instrument: InstrumentKey;
  label?: string;
  volume?: number;
  events: MusicEvent[];
};

type BarClipboard = {
  length: number;
  melody: boolean[][];
  melodyLengths: number[][];
  violin: boolean[][];
  violinLengths: number[][];
  saxophone: boolean[][];
  saxophoneLengths: number[][];
  guitar: boolean[][];
  guitarLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
  bassLengths: number[][];
  extraTracks: {
    id: string;
    grid: boolean[][];
    melodyLengths?: number[][];
  }[];
} | null;

type SongHistorySnapshot = {
  bpm: number;
  steps: number;
  currentStep: number;
  melody: boolean[][];
  melodyLengths: number[][];
  violin: boolean[][];
  violinLengths: number[][];
  saxophone: boolean[][];
  saxophoneLengths: number[][];
  guitar: boolean[][];
  guitarLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
  bassLengths: number[][];
  extraTracks: ExtraInstrumentTrack[];
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
  violin: boolean[][];
  violinLengths: number[][];
  saxophone: boolean[][];
  saxophoneLengths: number[][];
  guitar: boolean[][];
  guitarLengths: number[][];
  drums: boolean[][];
  bass: boolean[][];
  bassLengths: number[][];
  extraTracks: ExtraInstrumentTrack[];
  loopRange: LoopRange | null;
  barClipboard: BarClipboard;
  historyPast: SongHistorySnapshot[];
  historyFuture: SongHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  toggleMelody: (row: number, col: number, length?: number) => void;
  toggleViolin: (row: number, col: number, length?: number) => void;
  toggleSaxophone: (row: number, col: number, length?: number) => void;
  toggleGuitar: (row: number, col: number, length?: number) => void;
  toggleDrum: (row: number, col: number) => void;
  toggleBass: (row: number, col: number, length?: number) => void;
  addInstrumentTrack: (instrument: InstrumentKey) => string;
  removeInstrumentTrack: (trackId: string) => void;
  toggleExtraTrackCell: (trackId: string, row: number, col: number, length?: number) => void;
  applyExtraTrackChord: (trackId: string, chord: string, col: number, length?: number) => void;
  setExtraTrackVolume: (trackId: string, volume: number) => void;
  applyChord: (chord: string, col: number, isBass: boolean, length?: number) => void;
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
    violin: MusicEvent[];
    saxophone: MusicEvent[];
    guitar: MusicEvent[];
    drums: MusicEvent[];
    bass: MusicEvent[];
  };
  extraTracks?: SerializedExtraInstrumentTrack[];
};

type SongProjectSnapshotInput = Pick<
  SongState,
  | 'bpm'
  | 'steps'
  | 'volumes'
  | 'melody'
  | 'melodyLengths'
  | 'violin'
  | 'violinLengths'
  | 'saxophone'
  | 'saxophoneLengths'
  | 'guitar'
  | 'guitarLengths'
  | 'drums'
  | 'bass'
  | 'bassLengths'
  | 'extraTracks'
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

function cloneExtraTrack(track: ExtraInstrumentTrack): ExtraInstrumentTrack {
  return {
    ...track,
    grid: cloneMatrix(track.grid),
    melodyLengths: track.melodyLengths ? cloneLengthMatrix(track.melodyLengths) : undefined,
  };
}

function cloneExtraTracks(tracks: ExtraInstrumentTrack[]): ExtraInstrumentTrack[] {
  return tracks.map(cloneExtraTrack);
}

function getInstrumentRows(instrument: InstrumentKey) {
  switch (instrument) {
    case 'melody':
      return MELODY_ROWS;
    case 'violin':
      return VIOLIN_ROWS;
    case 'saxophone':
      return SAXOPHONE_ROWS;
    case 'guitar':
      return GUITAR_ROWS;
    case 'drums':
      return DRUM_ROWS;
    case 'bass':
      return BASS_ROWS;
    default:
      return MELODY_ROWS;
  }
}

function supportsNoteLengths(instrument: InstrumentKey) {
  return instrument !== 'drums';
}

function getInstrumentNotes(instrument: InstrumentKey): readonly string[] {
  switch (instrument) {
    case 'melody':
      return MELODY_NOTES;
    case 'violin':
      return VIOLIN_NOTES;
    case 'saxophone':
      return SAXOPHONE_NOTES;
    case 'guitar':
      return GUITAR_TRACK_LABELS;
    case 'drums':
      return DRUM_TRACK_LABELS;
    case 'bass':
      return BASS_NOTES;
    default:
      return MELODY_NOTES;
  }
}

function getInstrumentNoteToRowMap(instrument: InstrumentKey): Record<string, number> {
  switch (instrument) {
    case 'melody':
      return MELODY_NOTE_TO_ROW;
    case 'violin':
      return VIOLIN_NOTE_TO_ROW;
    case 'saxophone':
      return SAXOPHONE_NOTE_TO_ROW;
    case 'guitar':
      return Object.fromEntries(GUITAR_TRACK_LABELS.map((label, index) => [label, index]));
    case 'drums':
      return Object.fromEntries(DRUM_TRACK_LABELS.map((label, index) => [label, index]));
    case 'bass':
      return BASS_NOTE_TO_ROW;
    default:
      return MELODY_NOTE_TO_ROW;
  }
}

function getChordRowsForInstrument(instrument: InstrumentKey, chord: string) {
  if (instrument === 'bass') {
    return BASS_CHORD_MAP[chord] ?? [];
  }

  if (instrument === 'melody') {
    return MELODY_CHORD_MAP[chord] ?? [];
  }

  const chordNotes: Record<string, readonly string[]> = {
    C: ['C4', 'E4', 'G4'],
    D: ['D4', 'F#4', 'A4'],
    E: ['E4', 'G#4', 'B4'],
    F: ['F4', 'A4', 'C4'],
    G: ['G4', 'B4', 'D4'],
    A: ['A4', 'C#4', 'E4'],
    B: ['B4', 'D#4', 'F#4'],
  };
  const noteToRow = getInstrumentNoteToRowMap(instrument);

  return (chordNotes[chord] ?? [])
    .map((note) => noteToRow[note])
    .filter((row): row is number => typeof row === 'number');
}

function createExtraTrackId(instrument: InstrumentKey) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `${instrument}-${randomId}`
    : `${instrument}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createExtraTrackLabel(instrument: InstrumentKey, existingTracks: ExtraInstrumentTrack[]) {
  const baseLabels: Record<InstrumentKey, string> = {
    melody: 'MELODY',
    violin: 'VIOLIN',
    saxophone: 'SAXOPHONE',
    guitar: 'GUITAR',
    drums: 'DRUMS',
    bass: 'BASS',
  };
  const count = existingTracks.filter((track) => track.instrument === instrument).length + 2;
  return `${baseLabels[instrument]} ${count}`;
}

function createEmptyExtraTrack(
  instrument: InstrumentKey,
  steps: number,
  existingTracks: ExtraInstrumentTrack[],
  id = createExtraTrackId(instrument),
  label = createExtraTrackLabel(instrument, existingTracks),
  volume = 80
): ExtraInstrumentTrack {
  const rows = getInstrumentRows(instrument);

  return {
    id,
    instrument,
    label,
    volume: clampVolume(volume),
    grid: createEmptyMatrix(rows, steps),
    melodyLengths: supportsNoteLengths(instrument) ? createEmptyLengthMatrix(rows, steps) : undefined,
  };
}

function resizeExtraTrack(track: ExtraInstrumentTrack, steps: number): ExtraInstrumentTrack {
  const rows = getInstrumentRows(track.instrument);
  const grid = resizeMatrix(track.grid, rows, steps);

  return {
    ...track,
    volume: clampVolume(track.volume),
    grid,
    melodyLengths:
      supportsNoteLengths(track.instrument)
        ? resizeLengthMatrix(track.melodyLengths ?? [], grid, rows, steps)
        : undefined,
  };
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

function clearOverlappingNotes(
  gridRow: boolean[],
  lengthRow: number[],
  col: number,
  length: number,
  steps: number
) {
  for (let start = 0; start < steps; start += 1) {
    if (!gridRow[start]) {
      continue;
    }

    const noteLength = lengthRow[start] ?? 1;
    if (rangesOverlap(start, noteLength, col, length)) {
      clearMelodyNote(gridRow, lengthRow, start);
    }
  }
}

function toggleTimedNote(
  grid: boolean[][],
  lengths: number[][],
  row: number,
  col: number,
  steps: number,
  length = 1
) {
  if (!grid[row] || !lengths[row] || col < 0 || col >= steps) {
    return false;
  }

  const existingNote = findMelodyNoteAt(grid[row] ?? [], lengths[row] ?? [], col);
  const requestedLength = Math.floor(length);

  if (requestedLength <= 0 || existingNote) {
    if (!existingNote) {
      return false;
    }

    clearMelodyNote(grid[row], lengths[row], existingNote.start);
    return true;
  }

  const nextLength = snapMelodyLength(requestedLength, steps - col);
  clearOverlappingNotes(grid[row], lengths[row], col, nextLength, steps);
  grid[row][col] = true;
  lengths[row][col] = nextLength;
  return true;
}

function setTimedNote(
  grid: boolean[][],
  lengths: number[][],
  row: number,
  col: number,
  steps: number,
  length = 1
) {
  if (!grid[row] || !lengths[row] || col < 0 || col >= steps) {
    return false;
  }

  const nextLength = snapMelodyLength(Math.max(1, Math.floor(length)), steps - col);
  clearOverlappingNotes(grid[row], lengths[row], col, nextLength, steps);
  grid[row][col] = true;
  lengths[row][col] = nextLength;
  return true;
}

function createHistorySnapshot(state: Pick<
  SongState,
  | 'bpm'
  | 'steps'
  | 'currentStep'
  | 'melody'
  | 'melodyLengths'
  | 'violin'
  | 'violinLengths'
  | 'saxophone'
  | 'saxophoneLengths'
  | 'guitar'
  | 'guitarLengths'
  | 'drums'
  | 'bass'
  | 'bassLengths'
  | 'extraTracks'
  | 'loopRange'
>): SongHistorySnapshot {
  return {
    bpm: state.bpm,
    steps: state.steps,
    currentStep: state.currentStep,
    melody: cloneMatrix(state.melody),
    melodyLengths: cloneLengthMatrix(state.melodyLengths),
    violin: cloneMatrix(state.violin),
    violinLengths: cloneLengthMatrix(state.violinLengths),
    saxophone: cloneMatrix(state.saxophone),
    saxophoneLengths: cloneLengthMatrix(state.saxophoneLengths),
    guitar: cloneMatrix(state.guitar),
    guitarLengths: cloneLengthMatrix(state.guitarLengths),
    drums: cloneMatrix(state.drums),
    bass: cloneMatrix(state.bass),
    bassLengths: cloneLengthMatrix(state.bassLengths),
    extraTracks: cloneExtraTracks(state.extraTracks),
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
  const violinEvents: MusicEvent[] = [];
  const saxophoneEvents: MusicEvent[] = [];
  const guitarEvents: MusicEvent[] = [];
  const drumEvents: MusicEvent[] = [];
  const bassEvents: MusicEvent[] = [];
  const extraTracks: SerializedExtraInstrumentTrack[] = [];

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

  for (let r = 0; r < VIOLIN_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.violin[r]?.[s]) {
        const duration = Math.max(1, state.violinLengths[r]?.[s] ?? 1);
        violinEvents.push({ note: VIOLIN_NOTES[r] as string, start: s, duration });
        s += duration - 1;
      }
    }
  }

  for (let r = 0; r < SAXOPHONE_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.saxophone[r]?.[s]) {
        const duration = Math.max(1, state.saxophoneLengths[r]?.[s] ?? 1);
        saxophoneEvents.push({ note: SAXOPHONE_NOTES[r] as string, start: s, duration });
        s += duration - 1;
      }
    }
  }

  for (let r = 0; r < GUITAR_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.guitar[r]?.[s]) {
        const duration = Math.max(1, state.guitarLengths[r]?.[s] ?? 1);
        guitarEvents.push({ note: GUITAR_TRACK_LABELS[r], start: s, duration });
        s += duration - 1;
      }
    }
  }

  // 2. 드럼 압축
  
  for (let r = 0; r < DRUM_TRACK_LABELS.length; r++) {
  for (let s = 0; s < state.steps; s++) {
    if (state.drums[r]?.[s]) {
      drumEvents.push({
        note: DRUM_TRACK_LABELS[r],
        start: s,
        duration: 1,
      });
    }
  }
}

  // 3. 베이스 압축
  for (let r = 0; r < BASS_ROWS; r++) {
    for (let s = 0; s < state.steps; s++) {
      if (state.bass[r][s]) {
        const duration = Math.max(1, state.bassLengths[r]?.[s] ?? 1);
        bassEvents.push({ note: BASS_NOTES[r] as string, start: s, duration });
        s += duration - 1;
      }
    }
  }

  state.extraTracks.forEach((track) => {
    const notes = getInstrumentNotes(track.instrument);
    const events: MusicEvent[] = [];

    for (let r = 0; r < track.grid.length; r += 1) {
      for (let s = 0; s < state.steps; s += 1) {
        if (!track.grid[r]?.[s]) {
          continue;
        }

        const duration = supportsNoteLengths(track.instrument)
          ? Math.max(1, track.melodyLengths?.[r]?.[s] ?? 1)
          : 1;
        events.push({
          note: notes[r] as string,
          start: s,
          duration,
        });

        if (supportsNoteLengths(track.instrument)) {
          s += duration - 1;
        }
      }
    }

    extraTracks.push({
      id: track.id,
      instrument: track.instrument,
      label: track.label,
      volume: clampVolume(track.volume),
      events,
    });
  });

  return {
    version: 2,
    bpm: state.bpm,
    steps: state.steps,
    volumes: {
      melody: clampVolume(state.volumes.melody ?? 82),
      violin: clampVolume(state.volumes.violin ?? 78),
      saxophone: clampVolume(state.volumes.saxophone ?? 80),
      drums: clampVolume(state.volumes.drums ?? 78),
      bass: clampVolume(state.volumes.bass ?? 84),
      guitar: clampVolume(state.volumes.guitar ?? 80),
    },
    tracks: {
      melody: melodyEvents,
      violin: violinEvents,
      saxophone: saxophoneEvents,
      guitar: guitarEvents,
      drums: drumEvents,
      bass: bassEvents,
    },
    extraTracks,
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
    violin: cloneMatrix(snapshot.violin),
    violinLengths: cloneLengthMatrix(snapshot.violinLengths),
    saxophone: cloneMatrix(snapshot.saxophone),
    saxophoneLengths: cloneLengthMatrix(snapshot.saxophoneLengths),
    guitar: cloneMatrix(snapshot.guitar),
    guitarLengths: cloneLengthMatrix(snapshot.guitarLengths),
    drums: cloneMatrix(snapshot.drums),
    bass: cloneMatrix(snapshot.bass),
    bassLengths: cloneLengthMatrix(snapshot.bassLengths),
    extraTracks: cloneExtraTracks(snapshot.extraTracks),
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
  const violin = createEmptyMatrix(VIOLIN_ROWS, steps);
  const violinLengths = createEmptyLengthMatrix(VIOLIN_ROWS, steps);
  const saxophone = createEmptyMatrix(SAXOPHONE_ROWS, steps);
  const saxophoneLengths = createEmptyLengthMatrix(SAXOPHONE_ROWS, steps);
  const guitar = createEmptyMatrix(GUITAR_ROWS, steps);
  const guitarLengths = createEmptyLengthMatrix(GUITAR_ROWS, steps);
  const drums = createEmptyMatrix(DRUM_TRACK_LABELS.length, steps);
  const bass = createEmptyMatrix(BASS_ROWS, steps);
  const bassLengths = createEmptyLengthMatrix(BASS_ROWS, steps);
  const extraTracks: ExtraInstrumentTrack[] = [];

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

    project.tracks.violin?.forEach(e => {
      const row = VIOLIN_NOTE_TO_ROW[e.note as keyof typeof VIOLIN_NOTE_TO_ROW] ?? -1;
      if (row !== -1 && e.start < steps) {
        violin[row][e.start] = true;
        violinLengths[row][e.start] = snapMelodyLength(e.duration ?? 1, steps - e.start);
      }
    });

    project.tracks.saxophone?.forEach(e => {
      const row = SAXOPHONE_NOTE_TO_ROW[e.note as keyof typeof SAXOPHONE_NOTE_TO_ROW] ?? -1;
      if (row !== -1 && e.start < steps) {
        saxophone[row][e.start] = true;
        saxophoneLengths[row][e.start] = snapMelodyLength(e.duration ?? 1, steps - e.start);
      }
    });

    const guitarMap = Object.fromEntries(
      GUITAR_TRACK_LABELS.map((label, index) => [label, index])
    ) as Record<string, number>;
    const legacyGuitarMap: Record<string, string> = {
      'High E': 'E5',
      B: 'B4',
      G: 'G4',
      D: 'D4',
      A: 'A3',
      'Low E': 'E4',
    };
    project.tracks.guitar?.forEach(e => {
      const savedNote = e.note || '';
      const row = guitarMap[savedNote] ?? guitarMap[legacyGuitarMap[savedNote]] ?? -1;
      if (row !== -1 && e.start < steps) {
        guitar[row][e.start] = true;
        guitarLengths[row][e.start] = snapMelodyLength(e.duration ?? 1, steps - e.start);
      }
    });

    // 2. 드럼 파싱
    // 1) 라벨 기반 row 맵 생성
    const drumRowMap: Record<string, number> = {};
    DRUM_TRACK_LABELS.forEach((label, idx) => {
      drumRowMap[label] = idx;
    });

    // 2) 복원
    project.tracks.drums?.forEach(e => {
      const row = drumRowMap[e.note || ''];
      if (row !== undefined && e.start < steps) {
        drums[row][e.start] = true;
      }
    });

    // 3. 베이스 파싱
    project.tracks.bass?.forEach(e => {
      const row = BASS_NOTE_TO_ROW[e.note as keyof typeof BASS_NOTE_TO_ROW] ?? -1;
      if (row !== -1 && e.start < steps) {
        // 💡 베이스 역시 반복문 제거: 시작점만 true로 찍습니다.
        bass[row][e.start] = true;
        bassLengths[row][e.start] = snapMelodyLength(e.duration ?? 1, steps - e.start);
      }
    });
  }
  project.extraTracks?.forEach((savedTrack, index) => {
    const instrument = savedTrack.instrument;
    if (!instrument) {
      return;
    }

    const track = createEmptyExtraTrack(
      instrument,
      steps,
      extraTracks,
      savedTrack.id || `${instrument}-loaded-${index}`,
      savedTrack.label || createExtraTrackLabel(instrument, extraTracks),
      savedTrack.volume ?? 80
    );
    const noteToRow = getInstrumentNoteToRowMap(instrument);

    savedTrack.events?.forEach((event) => {
      const row = noteToRow[event.note || ''] ?? -1;
      if (row === -1 || event.start < 0 || event.start >= steps) {
        return;
      }

      track.grid[row][event.start] = true;
      if (supportsNoteLengths(instrument) && track.melodyLengths) {
        track.melodyLengths[row][event.start] = snapMelodyLength(event.duration ?? 1, steps - event.start);
      }
    });

    extraTracks.push(track);
  });

  return {
    melody,
    melodyLengths,
    violin,
    violinLengths,
    saxophone,
    saxophoneLengths,
    guitar,
    guitarLengths,
    drums,
    bass,
    bassLengths,
    extraTracks,
  };
}

export const useSongStore = create<SongState>((set, get) => ({
  bpm: 100,
  steps: DEFAULT_STEPS,
  currentStep: 0,
  isPlaying: false,
  volumes: {
    melody: 82,
    violin: 78,
    saxophone: 80,
    drums: 78,
    bass: 84,
    guitar: 80,
  },
  melody: createEmptyMatrix(MELODY_ROWS, DEFAULT_STEPS),
  melodyLengths: createEmptyLengthMatrix(MELODY_ROWS, DEFAULT_STEPS),
  violin: createEmptyMatrix(VIOLIN_ROWS, DEFAULT_STEPS),
  violinLengths: createEmptyLengthMatrix(VIOLIN_ROWS, DEFAULT_STEPS),
  saxophone: createEmptyMatrix(SAXOPHONE_ROWS, DEFAULT_STEPS),
  saxophoneLengths: createEmptyLengthMatrix(SAXOPHONE_ROWS, DEFAULT_STEPS),
  guitar: createEmptyMatrix(GUITAR_ROWS, DEFAULT_STEPS),
  guitarLengths: createEmptyLengthMatrix(GUITAR_ROWS, DEFAULT_STEPS),
  drums: createEmptyMatrix(DRUM_ROWS, DEFAULT_STEPS),
  bass: createEmptyMatrix(BASS_ROWS, DEFAULT_STEPS),
  bassLengths: createEmptyLengthMatrix(BASS_ROWS, DEFAULT_STEPS),
  extraTracks: [],
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

  toggleViolin: (row, col, length = 1) =>
    set((state) => {
      const violin = cloneMatrix(state.violin);
      const violinLengths = cloneLengthMatrix(state.violinLengths);

      if (!toggleTimedNote(violin, violinLengths, row, col, state.steps, length)) {
        return {};
      }

      return buildHistoryUpdate(state, { violin, violinLengths });
    }),

  toggleSaxophone: (row, col, length = 1) =>
    set((state) => {
      const saxophone = cloneMatrix(state.saxophone);
      const saxophoneLengths = cloneLengthMatrix(state.saxophoneLengths);

      if (!toggleTimedNote(saxophone, saxophoneLengths, row, col, state.steps, length)) {
        return {};
      }

      return buildHistoryUpdate(state, { saxophone, saxophoneLengths });
    }),

  toggleGuitar: (row, col, length = 1) =>
    set((state) => {
      const guitar = cloneMatrix(state.guitar);
      const guitarLengths = cloneLengthMatrix(state.guitarLengths);

      if (!toggleTimedNote(guitar, guitarLengths, row, col, state.steps, length)) {
        return {};
      }

      return buildHistoryUpdate(state, { guitar, guitarLengths });
    }),

  toggleDrum: (row, col) =>
    set((state) => {
      const drums = cloneMatrix(state.drums);
      drums[row][col] = !drums[row][col];

      return buildHistoryUpdate(state, { drums });
    }),

  toggleBass: (row, col, length = 1) =>
    set((state) => {
      const bass = cloneMatrix(state.bass);
      const bassLengths = cloneLengthMatrix(state.bassLengths);

      if (!toggleTimedNote(bass, bassLengths, row, col, state.steps, length)) {
        return {};
      }

      return buildHistoryUpdate(state, { bass, bassLengths });
    }),

  addInstrumentTrack: (instrument) => {
    const state = get();
    const track = createEmptyExtraTrack(instrument, state.steps, state.extraTracks);

    set((current) =>
      buildHistoryUpdate(current, {
        extraTracks: [...current.extraTracks, track],
      })
    );

    return track.id;
  },

  removeInstrumentTrack: (trackId) =>
    set((state) => {
      if (!state.extraTracks.some((track) => track.id === trackId)) {
        return {};
      }

      return buildHistoryUpdate(state, {
        extraTracks: state.extraTracks.filter((track) => track.id !== trackId),
      });
    }),

  toggleExtraTrackCell: (trackId, row, col, length = 1) =>
    set((state) => {
      const trackIndex = state.extraTracks.findIndex((track) => track.id === trackId);
      if (trackIndex === -1) {
        return {};
      }

      const extraTracks = cloneExtraTracks(state.extraTracks);
      const track = extraTracks[trackIndex];
      if (!track.grid[row] || col < 0 || col >= state.steps) {
        return {};
      }

      if (supportsNoteLengths(track.instrument)) {
        const melodyLengths =
          track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps);
        const changed = toggleTimedNote(track.grid, melodyLengths, row, col, state.steps, length);

        track.melodyLengths = melodyLengths;
        return changed ? buildHistoryUpdate(state, { extraTracks }) : {};
      }

      track.grid[row][col] = !track.grid[row][col];
      return buildHistoryUpdate(state, { extraTracks });
    }),

  applyExtraTrackChord: (trackId, chord, col, length = 1) =>
    set((state) => {
      const trackIndex = state.extraTracks.findIndex((track) => track.id === trackId);
      if (trackIndex === -1 || col < 0 || col >= state.steps) {
        return {};
      }

      const extraTracks = cloneExtraTracks(state.extraTracks);
      const track = extraTracks[trackIndex];
      const chordRows = getChordRowsForInstrument(track.instrument, chord);

      if (!chordRows.length) {
        return {};
      }

      chordRows.forEach((row) => {
        if (!track.grid[row]) {
          return;
        }

        if (supportsNoteLengths(track.instrument)) {
          const melodyLengths =
            track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps);
          setTimedNote(track.grid, melodyLengths, row, col, state.steps, length);
          track.melodyLengths = melodyLengths;
          return;
        }

        track.grid[row][col] = true;
      });

      return buildHistoryUpdate(state, { extraTracks });
    }),

  setExtraTrackVolume: (trackId, volume) =>
    set((state) => {
      const extraTracks = state.extraTracks.map((track) =>
        track.id === trackId ? { ...track, volume: clampVolume(volume) } : track
      );

      return { extraTracks };
    }),

  applyChord: (chord, col, isBass, length = 1) =>
    set((state) => {
      const gridKey = isBass ? 'bass' : 'melody';
      const nextGrid = cloneMatrix(state[gridKey]);
      const nextMelodyLengths = cloneLengthMatrix(state.melodyLengths);
      const nextBassLengths = cloneLengthMatrix(state.bassLengths);
      const rowsToActivate = (isBass ? BASS_CHORD_MAP : MELODY_CHORD_MAP)[chord] ?? [];

      rowsToActivate.forEach((row) => {
        if (row >= 0 && row < nextGrid.length && col >= 0 && col < state.steps) {
          if (!isBass) {
            setTimedNote(nextGrid, nextMelodyLengths, row, col, state.steps, length);
          } else {
            setTimedNote(nextGrid, nextBassLengths, row, col, state.steps, length);
          }
        }
      });

      return buildHistoryUpdate(state, {
        [gridKey]: nextGrid,
        ...(!isBass ? { melodyLengths: nextMelodyLengths } : { bassLengths: nextBassLengths }),
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
        violin: extractBar(state.violin, range.start, range.length),
        violinLengths: extractLengthBar(state.violinLengths, range.start, range.length),
        saxophone: extractBar(state.saxophone, range.start, range.length),
        saxophoneLengths: extractLengthBar(state.saxophoneLengths, range.start, range.length),
        guitar: extractBar(state.guitar, range.start, range.length),
        guitarLengths: extractLengthBar(state.guitarLengths, range.start, range.length),
        drums: extractBar(state.drums, range.start, range.length),
        bass: extractBar(state.bass, range.start, range.length),
        bassLengths: extractLengthBar(state.bassLengths, range.start, range.length),
        extraTracks: state.extraTracks.map((track) => ({
          id: track.id,
          grid: extractBar(track.grid, range.start, range.length),
          melodyLengths: track.melodyLengths
            ? extractLengthBar(track.melodyLengths, range.start, range.length)
            : undefined,
        })),
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
        violin: pasteBar(
          state.violin,
          state.barClipboard.violin,
          range.start,
          state.steps,
          'replace'
        ),
        violinLengths: pasteLengthBar(
          state.violinLengths,
          state.barClipboard.violinLengths,
          range.start,
          state.steps
        ),
        saxophone: pasteBar(
          state.saxophone,
          state.barClipboard.saxophone,
          range.start,
          state.steps,
          'replace'
        ),
        saxophoneLengths: pasteLengthBar(
          state.saxophoneLengths,
          state.barClipboard.saxophoneLengths,
          range.start,
          state.steps
        ),
        guitar: pasteBar(
          state.guitar,
          state.barClipboard.guitar,
          range.start,
          state.steps,
          'replace'
        ),
        guitarLengths: pasteLengthBar(
          state.guitarLengths,
          state.barClipboard.guitarLengths,
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
        bassLengths: pasteLengthBar(
          state.bassLengths,
          state.barClipboard.bassLengths,
          range.start,
          state.steps
        ),
        extraTracks: state.extraTracks.map((track) => {
          const copiedTrack = state.barClipboard?.extraTracks.find((entry) => entry.id === track.id);
          if (!copiedTrack) {
            return cloneExtraTrack(track);
          }

          return {
            ...track,
            grid: pasteBar(track.grid, copiedTrack.grid, range.start, state.steps, 'replace'),
            melodyLengths:
              supportsNoteLengths(track.instrument)
                ? pasteLengthBar(
                    track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps),
                    copiedTrack.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), BAR_LENGTH),
                    range.start,
                    state.steps
                  )
                : undefined,
          };
        }),
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
        violin: pasteBar(
          state.violin,
          extractBar(state.violin, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        violinLengths: pasteLengthBar(
          state.violinLengths,
          extractLengthBar(state.violinLengths, range.start, range.length),
          nextStart,
          state.steps
        ),
        saxophone: pasteBar(
          state.saxophone,
          extractBar(state.saxophone, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        saxophoneLengths: pasteLengthBar(
          state.saxophoneLengths,
          extractLengthBar(state.saxophoneLengths, range.start, range.length),
          nextStart,
          state.steps
        ),
        guitar: pasteBar(
          state.guitar,
          extractBar(state.guitar, range.start, range.length),
          nextStart,
          state.steps,
          'replace'
        ),
        guitarLengths: pasteLengthBar(
          state.guitarLengths,
          extractLengthBar(state.guitarLengths, range.start, range.length),
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
        bassLengths: pasteLengthBar(
          state.bassLengths,
          extractLengthBar(state.bassLengths, range.start, range.length),
          nextStart,
          state.steps
        ),
        extraTracks: state.extraTracks.map((track) => ({
          ...track,
          grid: pasteBar(
            track.grid,
            extractBar(track.grid, range.start, range.length),
            nextStart,
            state.steps,
            'replace'
          ),
          melodyLengths:
            supportsNoteLengths(track.instrument)
              ? pasteLengthBar(
                  track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps),
                  extractLengthBar(
                    track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps),
                    range.start,
                    range.length
                  ),
                  nextStart,
                  state.steps
                )
              : undefined,
        })),
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
        guitar: pasteBar(state.guitar, [], range.start, state.steps, 'clear'),
        guitarLengths: pasteLengthBar(
          state.guitarLengths,
          createEmptyLengthMatrix(GUITAR_ROWS, BAR_LENGTH),
          range.start,
          state.steps
        ),
        violin: pasteBar(state.violin, [], range.start, state.steps, 'clear'),
        violinLengths: pasteLengthBar(
          state.violinLengths,
          createEmptyLengthMatrix(VIOLIN_ROWS, BAR_LENGTH),
          range.start,
          state.steps
        ),
        saxophone: pasteBar(state.saxophone, [], range.start, state.steps, 'clear'),
        saxophoneLengths: pasteLengthBar(
          state.saxophoneLengths,
          createEmptyLengthMatrix(SAXOPHONE_ROWS, BAR_LENGTH),
          range.start,
          state.steps
        ),
        drums: pasteBar(state.drums, [], range.start, state.steps, 'clear'),
        bass: pasteBar(state.bass, [], range.start, state.steps, 'clear'),
        bassLengths: pasteLengthBar(
          state.bassLengths,
          createEmptyLengthMatrix(BASS_ROWS, BAR_LENGTH),
          range.start,
          state.steps
        ),
        extraTracks: state.extraTracks.map((track) => ({
          ...track,
          grid: pasteBar(track.grid, [], range.start, state.steps, 'clear'),
          melodyLengths:
            supportsNoteLengths(track.instrument)
              ? pasteLengthBar(
                  track.melodyLengths ?? createEmptyLengthMatrix(getInstrumentRows(track.instrument), state.steps),
                  createEmptyLengthMatrix(getInstrumentRows(track.instrument), BAR_LENGTH),
                  range.start,
                  state.steps
                )
              : undefined,
        })),
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
      const hasExpectedShape =
        state.melody.length === MELODY_ROWS &&
        state.melodyLengths.length === MELODY_ROWS &&
        state.violin.length === VIOLIN_ROWS &&
        state.violinLengths.length === VIOLIN_ROWS &&
        state.saxophone.length === SAXOPHONE_ROWS &&
        state.saxophoneLengths.length === SAXOPHONE_ROWS &&
        state.guitar.length === GUITAR_ROWS &&
        state.guitarLengths.length === GUITAR_ROWS &&
        state.drums.length === DRUM_ROWS &&
        state.bass.length === BASS_ROWS &&
        state.bassLengths.length === BASS_ROWS &&
        state.extraTracks.every((track) => track.grid.length === getInstrumentRows(track.instrument));

      if (state.steps === steps && hasExpectedShape) {
        return {};
      }

      const melody = resizeMatrix(state.melody, MELODY_ROWS, steps);
      const drums = resizeMatrix(state.drums, DRUM_ROWS, steps);
      const bass = resizeMatrix(state.bass, BASS_ROWS, steps);
      const violin = resizeMatrix(state.violin, VIOLIN_ROWS, steps);
      const saxophone = resizeMatrix(state.saxophone, SAXOPHONE_ROWS, steps);
      const guitar = resizeMatrix(state.guitar, GUITAR_ROWS, steps);
      const extraTracks = state.extraTracks.map((track) => resizeExtraTrack(track, steps));
      const melodyLengths = resizeLengthMatrix(
        state.melodyLengths,
        melody,
        MELODY_ROWS,
        steps
      );
      const violinLengths = resizeLengthMatrix(
        state.violinLengths,
        violin,
        VIOLIN_ROWS,
        steps
      );
      const saxophoneLengths = resizeLengthMatrix(
        state.saxophoneLengths,
        saxophone,
        SAXOPHONE_ROWS,
        steps
      );
      const guitarLengths = resizeLengthMatrix(
        state.guitarLengths,
        guitar,
        GUITAR_ROWS,
        steps
      );
      const bassLengths = resizeLengthMatrix(
        state.bassLengths,
        bass,
        BASS_ROWS,
        steps
      );

      return buildHistoryUpdate(state, {
        steps,
        currentStep: clampStep(state.currentStep, steps),
        melody,
        melodyLengths,
        violin,
        violinLengths,
        saxophone,
        saxophoneLengths,
        guitar,
        guitarLengths,
        drums,
        bass,
        bassLengths,
        extraTracks,
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
        violin: createEmptyMatrix(VIOLIN_ROWS, state.steps),
        violinLengths: createEmptyLengthMatrix(VIOLIN_ROWS, state.steps),
        saxophone: createEmptyMatrix(SAXOPHONE_ROWS, state.steps),
        saxophoneLengths: createEmptyLengthMatrix(SAXOPHONE_ROWS, state.steps),
        guitar: createEmptyMatrix(GUITAR_ROWS, state.steps),
        guitarLengths: createEmptyLengthMatrix(GUITAR_ROWS, state.steps),
        drums: createEmptyMatrix(DRUM_ROWS, state.steps),
        bass: createEmptyMatrix(BASS_ROWS, state.steps),
        bassLengths: createEmptyLengthMatrix(BASS_ROWS, state.steps),
        extraTracks: state.extraTracks.map((track) => createEmptyExtraTrack(
          track.instrument,
          state.steps,
          [],
          track.id,
          track.label,
          track.volume
        )),
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
          violin: clampVolume(project.volumes?.violin ?? 78),
          saxophone: clampVolume(project.volumes?.saxophone ?? 80),
          drums: clampVolume(project.volumes?.drums ?? 78),
          bass: clampVolume(project.volumes?.bass ?? 84),
          guitar: clampVolume(project.volumes?.guitar ?? 80),
        },
        melody: grids.melody,
        melodyLengths: grids.melodyLengths,
        violin: grids.violin,
        violinLengths: grids.violinLengths,
        saxophone: grids.saxophone,
        saxophoneLengths: grids.saxophoneLengths,
        guitar: grids.guitar,
        guitarLengths: grids.guitarLengths,
        drums: grids.drums,
        bass: grids.bass,
        bassLengths: grids.bassLengths,
        extraTracks: grids.extraTracks,
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
        violin: clampVolume(project.volumes?.violin ?? 78),
        saxophone: clampVolume(project.volumes?.saxophone ?? 80),
        drums: clampVolume(project.volumes?.drums ?? 78),
        bass: clampVolume(project.volumes?.bass ?? 84),
        guitar: clampVolume(project.volumes?.guitar ?? 80),
      },
      melody: grids.melody,
      melodyLengths: grids.melodyLengths,
      violin: grids.violin,
      violinLengths: grids.violinLengths,
      saxophone: grids.saxophone,
      saxophoneLengths: grids.saxophoneLengths,
      guitar: grids.guitar,
      guitarLengths: grids.guitarLengths,
      drums: grids.drums,
      bass: grids.bass,
      bassLengths: grids.bassLengths,
      extraTracks: grids.extraTracks,
      loopRange: normalizeLoopRange(state.loopRange, steps),
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    }));
  },
}));
