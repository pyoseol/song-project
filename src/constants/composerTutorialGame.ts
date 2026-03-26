import { BASS_NOTE_TO_ROW, MELODY_CHORD_MAP, MELODY_NOTE_TO_ROW } from './composer.ts';

export type ComposerTutorialChordTarget = {
  chord: string;
  col: number;
  rows: number[];
  label: string;
};

export type ComposerTutorialNoteTarget = {
  row: number;
  col: number;
  length: number;
  label: string;
};

export type ComposerTutorialCellTarget = {
  row: number;
  col: number;
  label: string;
};

function requireRow(noteMap: Record<string, number>, note: string) {
  const row = noteMap[note];
  if (typeof row !== 'number') {
    throw new Error(`Missing tutorial note row for ${note}`);
  }
  return row;
}

export const COMPOSER_TUTORIAL_BAR_LENGTH = 16;

export const COMPOSER_TUTORIAL_CHORD_TARGETS: ComposerTutorialChordTarget[] = [
  {
    chord: 'C',
    col: 0,
    rows: [...(MELODY_CHORD_MAP.C ?? [])],
    label: '1칸에 C 코드 놓기',
  },
  {
    chord: 'F',
    col: 4,
    rows: [...(MELODY_CHORD_MAP.F ?? [])],
    label: '5칸에 F 코드 놓기',
  },
  {
    chord: 'G',
    col: 8,
    rows: [...(MELODY_CHORD_MAP.G ?? [])],
    label: '9칸에 G 코드 놓기',
  },
  {
    chord: 'C',
    col: 12,
    rows: [...(MELODY_CHORD_MAP.C ?? [])],
    label: '13칸에 C 코드 놓기',
  },
];

export const COMPOSER_TUTORIAL_MELODY_TARGETS: ComposerTutorialNoteTarget[] = [
  {
    row: requireRow(MELODY_NOTE_TO_ROW, 'C4'),
    col: 0,
    length: 4,
    label: 'C4를 1/4 길이로 찍기',
  },
  {
    row: requireRow(MELODY_NOTE_TO_ROW, 'E4'),
    col: 4,
    length: 4,
    label: 'E4를 1/4 길이로 찍기',
  },
  {
    row: requireRow(MELODY_NOTE_TO_ROW, 'G4'),
    col: 8,
    length: 4,
    label: 'G4를 1/4 길이로 찍기',
  },
  {
    row: requireRow(MELODY_NOTE_TO_ROW, 'C5'),
    col: 12,
    length: 4,
    label: 'C5를 1/4 길이로 찍기',
  },
];

export const COMPOSER_TUTORIAL_DRUM_TARGETS: ComposerTutorialCellTarget[] = [
  { row: 0, col: 0, label: 'Kick 1칸' },
  { row: 0, col: 8, label: 'Kick 9칸' },
  { row: 1, col: 4, label: 'Snare 5칸' },
  { row: 1, col: 12, label: 'Snare 13칸' },
  { row: 2, col: 0, label: 'Hi-Hat 1칸' },
  { row: 2, col: 2, label: 'Hi-Hat 3칸' },
  { row: 2, col: 4, label: 'Hi-Hat 5칸' },
  { row: 2, col: 6, label: 'Hi-Hat 7칸' },
  { row: 2, col: 8, label: 'Hi-Hat 9칸' },
  { row: 2, col: 10, label: 'Hi-Hat 11칸' },
  { row: 2, col: 12, label: 'Hi-Hat 13칸' },
  { row: 2, col: 14, label: 'Hi-Hat 15칸' },
];

export const COMPOSER_TUTORIAL_BASS_TARGETS: ComposerTutorialCellTarget[] = [
  {
    row: requireRow(BASS_NOTE_TO_ROW, 'C2'),
    col: 0,
    label: 'C2로 시작',
  },
  {
    row: requireRow(BASS_NOTE_TO_ROW, 'F2'),
    col: 4,
    label: 'F2로 이동',
  },
  {
    row: requireRow(BASS_NOTE_TO_ROW, 'G2'),
    col: 8,
    label: 'G2로 이동',
  },
  {
    row: requireRow(BASS_NOTE_TO_ROW, 'C2'),
    col: 12,
    label: 'C2로 마무리',
  },
];
