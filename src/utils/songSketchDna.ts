import type { MusicShareTrackCard } from '../dummy/musicShareLibrary';
import type { MusicEvent, SongProject } from '../store/songStore';

type TrackName = keyof SongProject['tracks'];

export type SongSketchDna = {
  title: string;
  mood: string;
  melodyType: string;
  rhythmDensity: string;
  hookType: string;
  useCase: string;
  activeParts: string[];
  noteCount: number;
  summary: string;
};

const EMPTY_TRACKS: SongProject['tracks'] = {
  melody: [],
  violin: [],
  saxophone: [],
  guitar: [],
  drums: [],
  bass: [],
};

const TRACK_LABELS: Record<TrackName, string> = {
  melody: '멜로디',
  violin: '바이올린',
  saxophone: '알토 색소폰',
  guitar: '기타',
  drums: '드럼',
  bass: '베이스',
};

const NOTE_TO_PITCH: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

function cloneProject(project: SongProject): SongProject {
  return JSON.parse(JSON.stringify(project)) as SongProject;
}

function getAllEvents(project: SongProject) {
  return Object.values(project.tracks).flat();
}

function getPitch(note?: string) {
  if (!note) return null;
  const match = note.match(/^([A-G]#?)(-?\d)?/);
  if (!match) return null;
  const base = NOTE_TO_PITCH[match[1]];
  const octave = Number(match[2] ?? 4);
  if (typeof base !== 'number' || Number.isNaN(octave)) return null;
  return octave * 12 + base;
}

function getDensityLabel(noteCount: number, steps: number) {
  const density = steps > 0 ? noteCount / steps : 0;
  if (density >= 0.28) return '높음';
  if (density >= 0.12) return '보통';
  return '낮음';
}

function getMelodyType(melody: MusicEvent[]) {
  const pitches = melody.map((event) => getPitch(event.note)).filter((pitch): pitch is number => pitch !== null);
  if (pitches.length < 3) return '스케치형';

  const first = pitches[0];
  const last = pitches[pitches.length - 1];
  const uniqueCount = new Set(pitches).size;
  const movement = pitches.slice(1).reduce((sum, pitch, index) => sum + Math.abs(pitch - pitches[index]), 0);

  if (uniqueCount <= Math.max(2, Math.ceil(pitches.length * 0.35))) return '반복형';
  if (last - first >= 5) return '상승형';
  if (first - last >= 5) return '하강형';
  if (movement / Math.max(1, pitches.length - 1) >= 5) return '점프형';
  return '균형형';
}

function getMood(project: SongProject, activeParts: string[]) {
  const noteCount = getAllEvents(project).length;
  const hasDrums = project.tracks.drums.length > 0;
  const hasBass = project.tracks.bass.length > 0;
  const hasGuitar = project.tracks.guitar.length > 0;
  const hasSoftLead = project.tracks.violin.length > 0 || project.tracks.saxophone.length > 0;

  if (hasDrums && hasBass && noteCount > 70) return '에너지 / 밴드 / 움직임';
  if (hasGuitar && hasBass) return '그루브 / 도시 / 따뜻함';
  if (hasSoftLead) return '감성 / 밤 / 선율 중심';
  if (activeParts.length <= 1) return '미니멀 / 아이디어 스케치';
  return '몽환 / 루프 / 배경음';
}

function getUseCase(project: SongProject, density: string) {
  if (project.tracks.drums.length > 24 && density === '높음') return '숏폼 하이라이트 / 게임 BGM';
  if (project.tracks.guitar.length > 0 || project.tracks.bass.length > 0) return '브이로그 / 도시 감성 BGM';
  if (project.tracks.violin.length > 0 || project.tracks.saxophone.length > 0) return '감성 영상 / 엔딩 BGM';
  return '아이디어 메모 / 루프 스케치';
}

export function analyzeSongSketchDna(project: SongProject, title = '현재 스케치'): SongSketchDna {
  const activeParts = (Object.entries(project.tracks) as Array<[TrackName, MusicEvent[]]>)
    .filter(([, events]) => events.length > 0)
    .map(([track]) => TRACK_LABELS[track]);
  const noteCount = getAllEvents(project).length;
  const rhythmDensity = getDensityLabel(noteCount, project.steps);
  const melodyType = getMelodyType(project.tracks.melody);
  const mood = getMood(project, activeParts);
  const hookType =
    melodyType === '반복형'
      ? '짧은 반복 후크'
      : melodyType === '상승형'
        ? '마지막 상승 후크'
        : '루프형 후크';
  const useCase = getUseCase(project, rhythmDensity);

  return {
    title,
    mood,
    melodyType,
    rhythmDensity,
    hookType,
    useCase,
    activeParts,
    noteCount,
    summary: `${melodyType} 멜로디와 ${rhythmDensity} 리듬 밀도를 가진 ${mood} 성향의 스케치입니다.`,
  };
}

export function createFallbackProjectFromTrack(_track: MusicShareTrackCard): SongProject {
  const steps = 640;
  const chordStarts = [0, 16, 32, 48, 64, 80, 96, 112];
  const melodyNotes = ['C5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5'];
  const bassNotes = ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'];

  return {
    version: 2,
    bpm: 100,
    steps,
    noteLyrics: {},
    volumes: {
      melody: 82,
      drums: 72,
      bass: 78,
      guitar: 76,
    },
    tracks: {
      ...EMPTY_TRACKS,
      melody: chordStarts.map((start, index) => ({
        note: melodyNotes[index % melodyNotes.length],
        start,
        duration: index % 2 === 0 ? 4 : 2,
      })),
      bass: chordStarts.map((start, index) => ({
        note: bassNotes[index % bassNotes.length],
        start,
        duration: 8,
      })),
      drums: Array.from({ length: 32 }, (_, index) => ({
        type: index % 4 === 0 ? 'kick' : index % 4 === 2 ? 'snare' : 'hihat',
        start: index * 4,
        duration: 1,
      })),
    },
  };
}

export function getProjectFromSharedTrack(track: MusicShareTrackCard, project?: SongProject): SongProject {
  if (track.project) return cloneProject(track.project);
  if (project) return cloneProject(project);
  return createFallbackProjectFromTrack(track);
}

export function createAirInstrumentProject(mode: 'guitar' | 'drum' | 'piano'): SongProject {
  const steps = 640;
  const project: SongProject = {
    version: 2,
    bpm: mode === 'drum' ? 118 : 96,
    steps,
    noteLyrics: {},
    volumes: {
      melody: 82,
      drums: 78,
      bass: 74,
      guitar: 80,
    },
    tracks: { ...EMPTY_TRACKS },
  };

  if (mode === 'drum') {
    project.tracks.drums = Array.from({ length: 48 }, (_, index) => ({
      type: index % 4 === 0 ? 'kick' : index % 4 === 2 ? 'snare' : 'hihat',
      start: index * 4,
      duration: 1,
    }));
    project.tracks.bass = [0, 32, 64, 96].map((start) => ({ note: 'C3', start, duration: 8 }));
    return project;
  }

  if (mode === 'guitar') {
    project.tracks.guitar = [0, 8, 16, 24, 32, 40, 48, 56].map((start, index) => ({
      note: ['C4', 'E4', 'G4', 'A4'][index % 4],
      start,
      duration: 4,
    }));
    project.tracks.bass = [0, 32, 64, 96].map((start, index) => ({
      note: ['C3', 'A2', 'F2', 'G2'][index % 4],
      start,
      duration: 8,
    }));
    return project;
  }

  project.tracks.melody = [0, 8, 16, 24, 32, 40, 48, 56].map((start, index) => ({
    note: ['C5', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5'][index],
    start,
    duration: 4,
  }));
  return project;
}

export function getRecruitUrlFromSketch(title: string, genre = 'pop', roles = 'vocal,guitar,drums') {
  const params = new URLSearchParams({
    write: '1',
    title: `${title} 파트 모집`,
    genre,
    summary: '작업 중인 곡 스케치를 같이 완성할 파트를 찾습니다.',
    roles,
  });
  return `/community/sessions?${params.toString()}`;
}
