export const PIANO_STEP_WIDTH = 132;
export const PIANO_ROW_HEIGHT = 56;
export const MELODY_PIANO_ROW_HEIGHT = 20;
export const DRUM_STEP_WIDTH = 84;

export const MELODY_NOTES = [
  'C6',
  'B5',
  'A#5',
  'A5',
  'G#5',
  'G5',
  'F#5',
  'F5',
  'E5',
  'D#5',
  'D5',
  'C#5',
  'C5',
  'B4',
  'A#4',
  'A4',
  'G#4',
  'G4',
  'F#4',
  'F4',
  'E4',
  'D#4',
  'D4',
  'C#4',
  'C4',
  'B3',
  'A#3',
  'A3',
] as const;

export const LEGACY_MELODY_NOTES = [
  'C6',
  'A5',
  'G5',
  'E5',
  'D5',
  'C5',
  'A4',
  'G4',
  'E4',
  'D4',
  'C4',
  'A3',
] as const;

export const LEGACY_BASS_NOTES = [
  'C5',
  'A4',
  'G4',
  'E4',
  'D4',
  'C4',
  'A3',
  'G3',
  'E3',
  'D3',
  'C3',
  'A2',
] as const;

export const LEGACY_EXTENDED_BASS_NOTES = [
  'C5',
  'B4',
  'A4',
  'G4',
  'F4',
  'E4',
  'D4',
  'C4',
  'B3',
  'A3',
  'G3',
  'F3',
  'E3',
  'D3',
  'C3',
  'B2',
  'A2',
] as const;

export const BASS_NOTES = [
  'C3',
  'B2',
  'A2',
  'G2',
  'F2',
  'E2',
  'D2',
  'C2',
  'B1',
  'A1',
] as const;

export const MELODY_MIDI = [
  84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67,
  66, 65, 64, 63, 62, 61, 60, 59, 58, 57,
] as const;

export const BASS_MIDI = [48, 47, 45, 43, 41, 40, 38, 36, 35, 33] as const;

export const MELODY_ROWS = MELODY_NOTES.length;
export const BASS_ROWS = BASS_NOTES.length;
export const DRUM_ROWS = 5;

function createNoteToRowMap(notes: readonly string[]) {
  return notes.reduce<Record<string, number>>((map, note, index) => {
    map[note] = index;
    return map;
  }, {});
}

function mapChordNotesToRows(
  noteToRowMap: Record<string, number>,
  chordMap: Record<string, readonly string[]>
) {
  return Object.fromEntries(
    Object.entries(chordMap).map(([chord, notes]) => [
      chord,
      notes
        .map((note) => noteToRowMap[note])
        .filter((row): row is number => typeof row === 'number'),
    ])
  ) as Record<string, number[]>;
}

export const MELODY_NOTE_TO_ROW = createNoteToRowMap(MELODY_NOTES);
export const BASS_NOTE_TO_ROW = createNoteToRowMap(BASS_NOTES);

export const BASS_MIGRATION_MAP: Record<string, string> = {
  C5: 'C3',
  B4: 'B2',
  A4: 'A2',
  G4: 'G2',
  F4: 'F2',
  E4: 'E2',
  D4: 'D2',
  C4: 'C3',
  B3: 'B2',
  A3: 'A2',
  G3: 'G2',
  F3: 'F2',
  E3: 'E2',
  D3: 'D2',
  C3: 'C3',
  B2: 'B2',
  A2: 'A2',
};

export const MELODY_CHORD_MAP = mapChordNotesToRows(MELODY_NOTE_TO_ROW, {
  C: ['C4', 'E4', 'G4'],
  D: ['D4', 'F#4', 'A4'],
  E: ['E4', 'G#4', 'B4'],
  F: ['F4', 'A4', 'C5'],
  G: ['G4', 'B4', 'D5'],
  A: ['A4', 'C5', 'E5'],
  B: ['B4', 'D#5', 'F#5'],
});

export const BASS_CHORD_MAP = mapChordNotesToRows(BASS_NOTE_TO_ROW, {
  C: ['C2'],
  D: ['D2'],
  E: ['E2'],
  F: ['F2'],
  G: ['G2'],
  A: ['A1'],
  B: ['B2'],
});
