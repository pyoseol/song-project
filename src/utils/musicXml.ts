export type MusicXmlTrack = {
  id: string;
  name: string;
  grid: readonly (readonly boolean[])[];
  lengths?: readonly (readonly number[])[];
  pitches: readonly string[];
  lyrics?: Readonly<Record<string, string>>;
};

type RawNote = {
  pitch: string;
  start: number;
  duration: number;
  lyric?: string;
};

type NoteSegment = {
  pitch: string;
  start: number;
  duration: number;
  tieStart: boolean;
  tieStop: boolean;
  lyric?: string;
};

type NoteGroup = {
  start: number;
  duration: number;
  notes: NoteSegment[];
};

const STEPS_PER_BAR = 16;
const DIVISIONS = 4;
const NOTATION_DURATIONS = [16, 12, 8, 6, 4, 3, 2, 1] as const;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parsePitch(value: string) {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(value.replace('_sharp', '#'));
  if (!match) return null;

  return {
    step: match[1],
    alter: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0,
    octave: Number(match[3]),
  };
}

function pitchToMidi(value: string) {
  const parsed = parsePitch(value);
  if (!parsed) return 60;
  const pitchClasses: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  return (parsed.octave + 1) * 12 + pitchClasses[parsed.step] + parsed.alter;
}

function durationNotation(duration: number) {
  const notation: Record<number, { type: string; dotted?: boolean }> = {
    1: { type: '16th' },
    2: { type: 'eighth' },
    3: { type: 'eighth', dotted: true },
    4: { type: 'quarter' },
    6: { type: 'quarter', dotted: true },
    8: { type: 'half' },
    12: { type: 'half', dotted: true },
    16: { type: 'whole' },
  };
  return notation[duration] ?? notation[1];
}

function splitDuration(duration: number) {
  const chunks: number[] = [];
  let remaining = Math.max(0, Math.floor(duration));
  while (remaining > 0) {
    const chunk = NOTATION_DURATIONS.find((value) => value <= remaining) ?? 1;
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

function collectRawNotes(track: MusicXmlTrack) {
  const notes: RawNote[] = [];
  track.grid.forEach((row, rowIndex) => {
    const pitch = track.pitches[rowIndex];
    if (!pitch || !parsePitch(pitch)) return;

    row.forEach((active, col) => {
      if (!active) return;
      notes.push({
        pitch,
        start: col,
        duration: Math.max(1, Math.floor(track.lengths?.[rowIndex]?.[col] ?? 1)),
        lyric: track.lyrics?.[`${rowIndex}-${col}`]?.trim() || undefined,
      });
    });
  });
  return notes;
}

function splitNoteIntoMeasures(note: RawNote) {
  const segments: Array<NoteSegment & { measure: number }> = [];
  let cursor = note.start;
  let remaining = note.duration;
  let consumed = 0;

  while (remaining > 0) {
    const measure = Math.floor(cursor / STEPS_PER_BAR);
    const start = cursor % STEPS_PER_BAR;
    const availableInMeasure = STEPS_PER_BAR - start;
    const available = Math.min(remaining, availableInMeasure);
    const chunks = splitDuration(available);

    chunks.forEach((duration) => {
      const hasPrevious = consumed > 0;
      const hasNext = remaining - duration > 0;
      segments.push({
        measure,
        pitch: note.pitch,
        start: cursor % STEPS_PER_BAR,
        duration,
        tieStop: hasPrevious,
        tieStart: hasNext,
        lyric: consumed === 0 ? note.lyric : undefined,
      });
      cursor += duration;
      consumed += duration;
      remaining -= duration;
    });
  }

  return segments;
}

function groupSegments(segments: NoteSegment[]) {
  const groups = new Map<string, NoteGroup>();
  segments.forEach((segment) => {
    const key = [
      segment.start,
      segment.duration,
      Number(segment.tieStart),
      Number(segment.tieStop),
    ].join(':');
    const group = groups.get(key) ?? {
      start: segment.start,
      duration: segment.duration,
      notes: [],
    };
    group.notes.push(segment);
    groups.set(key, group);
  });

  return [...groups.values()].sort((left, right) =>
    left.start - right.start || pitchToMidi(left.notes[0].pitch) - pitchToMidi(right.notes[0].pitch)
  );
}

function assignVoices(groups: NoteGroup[]) {
  const voices: Array<{ end: number; groups: NoteGroup[] }> = [];
  groups.forEach((group) => {
    const voice = voices.find((candidate) => candidate.end <= group.start);
    if (voice) {
      voice.groups.push(group);
      voice.end = group.start + group.duration;
    } else {
      voices.push({ end: group.start + group.duration, groups: [group] });
    }
  });
  return voices;
}

function renderRest(duration: number, voice: number) {
  return splitDuration(duration)
    .map((chunk) => {
      const notation = durationNotation(chunk);
      return `<note><rest/><duration>${chunk}</duration><voice>${voice}</voice><type>${notation.type}</type>${notation.dotted ? '<dot/>' : ''}</note>`;
    })
    .join('');
}

function renderNote(segment: NoteSegment, voice: number, chord: boolean) {
  const pitch = parsePitch(segment.pitch);
  if (!pitch) return '';
  const notation = durationNotation(segment.duration);
  const ties = `${segment.tieStop ? '<tie type="stop"/>' : ''}${segment.tieStart ? '<tie type="start"/>' : ''}`;
  const tiedNotations = `${segment.tieStop ? '<tied type="stop"/>' : ''}${segment.tieStart ? '<tied type="start"/>' : ''}`;
  const notationBlock = tiedNotations ? `<notations>${tiedNotations}</notations>` : '';
  const lyric = segment.lyric
    ? `<lyric><syllabic>single</syllabic><text>${escapeXml(segment.lyric)}</text></lyric>`
    : '';

  return `<note>${chord ? '<chord/>' : ''}<pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ''}<octave>${pitch.octave}</octave></pitch><duration>${segment.duration}</duration>${ties}<voice>${voice}</voice><type>${notation.type}</type>${notation.dotted ? '<dot/>' : ''}${notationBlock}${lyric}</note>`;
}

function renderMeasure(
  measureNumber: number,
  segments: NoteSegment[],
  includeAttributes: boolean,
  bpm: number,
  clef: 'G' | 'F'
) {
  const groups = groupSegments(segments);
  const voices = assignVoices(groups);
  const attributes = includeAttributes
    ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${clef}</sign><line>${clef === 'F' ? 4 : 2}</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
    : '';

  if (!voices.length) {
    return `<measure number="${measureNumber}">${attributes}<note><rest measure="yes"/><duration>${STEPS_PER_BAR}</duration><voice>1</voice><type>whole</type></note></measure>`;
  }

  const voiceXml = voices.map((voice, voiceIndex) => {
    let cursor = 0;
    const notes = voice.groups.map((group) => {
      const gap = Math.max(0, group.start - cursor);
      const rest = gap ? renderRest(gap, voiceIndex + 1) : '';
      const chord = group.notes
        .sort((left, right) => pitchToMidi(left.pitch) - pitchToMidi(right.pitch))
        .map((note, noteIndex) => renderNote(note, voiceIndex + 1, noteIndex > 0))
        .join('');
      cursor = group.start + group.duration;
      return `${rest}${chord}`;
    }).join('');
    const endingRest = cursor < STEPS_PER_BAR
      ? renderRest(STEPS_PER_BAR - cursor, voiceIndex + 1)
      : '';
    const backup = voiceIndex < voices.length - 1
      ? `<backup><duration>${STEPS_PER_BAR}</duration></backup>`
      : '';
    return `${notes}${endingRest}${backup}`;
  }).join('');

  return `<measure number="${measureNumber}">${attributes}${voiceXml}</measure>`;
}

function renderPart(track: MusicXmlTrack, partIndex: number, measureCount: number, bpm: number) {
  const notes = collectRawNotes(track);
  const measureSegments = new Map<number, NoteSegment[]>();
  notes.flatMap(splitNoteIntoMeasures).forEach(({ measure, ...segment }) => {
    measureSegments.set(measure, [...(measureSegments.get(measure) ?? []), segment]);
  });
  const averageMidi = notes.length
    ? notes.reduce((sum, note) => sum + pitchToMidi(note.pitch), 0) / notes.length
    : 60;
  const clef = averageMidi < 58 ? 'F' : 'G';
  const measures = Array.from({ length: measureCount }, (_, index) =>
    renderMeasure(index + 1, measureSegments.get(index) ?? [], index === 0, bpm, clef)
  ).join('');
  return `<part id="P${partIndex + 1}">${measures}</part>`;
}

export function hasTrackNotes(track: MusicXmlTrack) {
  return track.grid.some((row) => row.some(Boolean));
}

export function buildMusicXml({
  title,
  bpm,
  tracks,
}: {
  title: string;
  bpm: number;
  tracks: MusicXmlTrack[];
}) {
  const populatedTracks = tracks.filter(hasTrackNotes);
  const allNotes = populatedTracks.flatMap(collectRawNotes);
  const lastStep = allNotes.reduce(
    (latest, note) => Math.max(latest, note.start + note.duration),
    1
  );
  const measureCount = Math.max(1, Math.ceil(lastStep / STEPS_PER_BAR));
  const partList = populatedTracks
    .map((track, index) => `<score-part id="P${index + 1}"><part-name>${escapeXml(track.name)}</part-name></score-part>`)
    .join('');
  const parts = populatedTracks
    .map((track, index) => renderPart(track, index, measureCount, bpm))
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${escapeXml(title || '제목 없는 곡')}</work-title></work><identification><encoding><software>작곡밥</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification><part-list>${partList}</part-list>${parts}</score-partwise>`;
}
