// src/audio/engine.ts
import * as Tone from "tone";
import {
  acousticGuitarSynth,
  bassSampler,
  createBassSampler,
  createDrumSampler,
  DRUM_SAMPLE_NOTE_BY_ROW,
  drumSampler,
  GUITAR_SAMPLE_URLS,
  pianoSynth,
  SAXOPHONE_SAMPLE_URLS,
  saxophoneSynth,
  VIOLIN_SAMPLE_URLS,
  violinSynth,
} from "./instruments.ts";
import { useSongStore, type ExtraInstrumentTrack, type InstrumentKey, type InstrumentVolumes } from "../store/songStore.ts";
import {
  BASS_MIDI,
  GUITAR_TRACK_LABELS,
  MELODY_MIDI,
  SAXOPHONE_NOTES,
  VIOLIN_NOTES,
} from "../constants/composer.ts";

let loopId: number | null = null;

const SHARP_TO_FLAT_NOTE: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

function toSamplerNote(note: string) {
  return note.replace(/^([A-G]#)(-?\d+)$/, (_match, root: string, octave: string) => {
    return `${SHARP_TO_FLAT_NOTE[root] ?? root}${octave}`;
  });
}

function withFlatAliases<T extends Record<string, string>>(urls: T): Record<string, string> {
  const aliasedUrls: Record<string, string> = { ...urls };

  Object.entries(urls).forEach(([note, file]) => {
    aliasedUrls[toSamplerNote(note)] = file;
  });

  return aliasedUrls;
}

const PIANO_SAMPLE_URLS: Record<string, string> = withFlatAliases({
  "A#4": "A_sharp4.mp3",
  A4: "A4.mp3",
  B4: "B4.mp3",
  "C#4": "C_sharp4.mp3",
  C4: "C4.mp3",
  C5: "C5.mp3",
  "D#4": "D_sharp4.mp3",
  D4: "D4.mp3",
  E4: "E4.mp3",
  "F#4": "F_sharp4.mp3",
  F4: "F4.mp3",
  "G#4": "G_sharp4.mp3",
  G4: "G4.mp3",
});

let cachedPianoBuffers: Record<string, AudioBuffer> | null = null;
let lameLoadPromise: Promise<void> | null = null;

function getMelodyPlaybackNote(row: number) {
  const midi = MELODY_MIDI[row] ?? MELODY_MIDI[MELODY_MIDI.length - 1];
  return toSamplerNote(Tone.Frequency(midi, "midi").toNote());
}

function getGuitarPlaybackNote(row: number) {
  return toSamplerNote(GUITAR_TRACK_LABELS[row] ?? GUITAR_TRACK_LABELS[GUITAR_TRACK_LABELS.length - 1]);
}

function getViolinPlaybackNote(row: number) {
  return toSamplerNote(VIOLIN_NOTES[row] ?? VIOLIN_NOTES[VIOLIN_NOTES.length - 1]);
}

function getSaxophonePlaybackNote(row: number) {
  return toSamplerNote(SAXOPHONE_NOTES[row] ?? SAXOPHONE_NOTES[SAXOPHONE_NOTES.length - 1]);
}

function volumeToDb(volume: number) {
  if (volume <= 0) {
    return -60;
  }

  return Tone.gainToDb(volume / 100);
}

const DRUM_SAMPLE_DURATION_BY_ROW = ["8n", "16n", "32n", "8n", "8n"] as const;

function getDrumSampleNote(row: number) {
  return DRUM_SAMPLE_NOTE_BY_ROW[row] ?? DRUM_SAMPLE_NOTE_BY_ROW[0];
}

function getDrumSampleDuration(row: number) {
  return DRUM_SAMPLE_DURATION_BY_ROW[row] ?? "16n";
}

function triggerLiveDrumSample(row: number, time?: number, velocity?: number) {
  drumSampler.triggerAttackRelease(
    getDrumSampleNote(row),
    getDrumSampleDuration(row),
    time,
    velocity
  );
}

function getInstrumentBusVolumes(volumes: InstrumentVolumes, extraTracks: ExtraInstrumentTrack[] = []) {
  const busVolumes = { ...volumes };

  extraTracks.forEach((track) => {
    busVolumes[track.instrument] = Math.max(busVolumes[track.instrument] ?? 0, track.volume);
  });

  return busVolumes;
}

function getVolumeScale(volume: number, busVolume: number) {
  if (busVolume <= 0 || volume <= 0) {
    return 0;
  }

  return Math.min(1, volume / busVolume);
}

function applyLiveVolumes(volumes: InstrumentVolumes, extraTracks: ExtraInstrumentTrack[] = []) {
  const busVolumes = getInstrumentBusVolumes(volumes, extraTracks);
  const melodyDb = volumeToDb(busVolumes.melody);
  const violinDb = volumeToDb(busVolumes.violin);
  const saxophoneDb = volumeToDb(busVolumes.saxophone);
  const guitarDb = volumeToDb(busVolumes.guitar);
  const drumsDb = volumeToDb(busVolumes.drums);
  const bassDb = volumeToDb(busVolumes.bass);

  pianoSynth.volume.value = melodyDb;
  acousticGuitarSynth.volume.value = guitarDb;
  violinSynth.volume.value = violinDb;
  saxophoneSynth.volume.value = saxophoneDb;
  drumSampler.volume.value = drumsDb;
  bassSampler.volume.value = bassDb;

  return busVolumes;
}

function getSixteenthDurationSeconds(bpm: number) {
  return (60 / bpm) / 4;
}

function getMelodyGateSeconds(durationSteps: number, bpm: number) {
  return getSixteenthDurationSeconds(bpm) * Math.max(1, durationSteps);
}

function getMelodyVelocity(durationSteps: number) {
  void durationSteps;
  return 1;
}

function triggerLiveMelodyNote(
  note: string,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  pianoSynth.triggerAttackRelease(note, durationSeconds, time, velocity);
}

function triggerLiveGuitarNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  acousticGuitarSynth.triggerAttackRelease(
    getGuitarPlaybackNote(row),
    durationSeconds,
    time,
    velocity
  );
}

function triggerLiveViolinNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  violinSynth.triggerAttackRelease(getViolinPlaybackNote(row), durationSeconds, time, velocity);
}

function triggerLiveSaxophoneNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  saxophoneSynth.triggerAttackRelease(getSaxophonePlaybackNote(row), durationSeconds, time, velocity);
}

function getExtraTrackNote(
  instrument: InstrumentKey,
  row: number,
  fallbackNote = "C4"
) {
  switch (instrument) {
    case "melody":
      return getMelodyPlaybackNote(row);
    case "violin":
      return getViolinPlaybackNote(row);
    case "saxophone":
      return getSaxophonePlaybackNote(row);
    case "guitar":
      return getGuitarPlaybackNote(row);
    case "bass": {
      const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
      return toSamplerNote(Tone.Frequency(midi, "midi").toNote());
    }
    case "drums":
      return getDrumSampleNote(row);
    default:
      return fallbackNote;
  }
}

function triggerExtraTrackStep(
  track: ExtraInstrumentTrack,
  currentStep: number,
  bpm: number,
  time: number,
  busVolumes: InstrumentVolumes
) {
  const velocityScale = getVolumeScale(track.volume, busVolumes[track.instrument]);
  if (velocityScale <= 0) {
    return;
  }

  track.grid.forEach((rowArr, rowIndex) => {
    if (!rowArr[currentStep]) {
      return;
    }

    switch (track.instrument) {
      case "melody": {
        const durationSteps = Math.max(1, track.melodyLengths?.[rowIndex]?.[currentStep] ?? 1);
        triggerLiveMelodyNote(
          getExtraTrackNote(track.instrument, rowIndex),
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          getMelodyVelocity(durationSteps) * velocityScale
        );
        break;
      }
      case "violin":
        triggerLiveViolinNote(
          rowIndex,
          getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[rowIndex]?.[currentStep] ?? 1), bpm),
          time,
          0.86 * velocityScale
        );
        break;
      case "saxophone":
        triggerLiveSaxophoneNote(
          rowIndex,
          getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[rowIndex]?.[currentStep] ?? 1), bpm),
          time,
          0.78 * velocityScale
        );
        break;
      case "guitar":
        triggerLiveGuitarNote(
          rowIndex,
          getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[rowIndex]?.[currentStep] ?? 1), bpm),
          time,
          velocityScale
        );
        break;
      case "bass":
        bassSampler.triggerAttackRelease(
          getExtraTrackNote(track.instrument, rowIndex),
          getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[rowIndex]?.[currentStep] ?? 1), bpm),
          time,
          velocityScale
        );
        break;
      case "drums":
        triggerLiveDrumSample(rowIndex, time, velocityScale);
        break;
      default:
        break;
    }
  });
}

export async function preparePlaybackEngine() {
  await Tone.start();
  await Tone.loaded();
  initTransport();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
}

export function releaseInstrumentSounds(instrument: InstrumentKey) {
  switch (instrument) {
    case "melody":
      pianoSynth.releaseAll();
      break;
    case "violin":
      violinSynth.releaseAll();
      break;
    case "saxophone":
      saxophoneSynth.releaseAll();
      break;
    case "guitar":
      acousticGuitarSynth.releaseAll();
      break;
    case "bass":
      bassSampler.releaseAll();
      break;
    case "drums":
    default:
      break;
  }
}

async function loadPianoBuffers(): Promise<Record<string, AudioBuffer>> {
  if (cachedPianoBuffers) return cachedPianoBuffers;
  const entries = await Promise.all(
    Object.entries(PIANO_SAMPLE_URLS).map(async ([note, file]) => {
      const baseUrl = import.meta.env.BASE_URL ?? "/";
      const origin = getOrigin();
      const base = new URL(baseUrl, origin);
      const url = new URL(
        `samples/piano/${encodeURIComponent(file)}`,
        base
      ).toString();
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.startsWith("audio/")) {
          throw new Error(
            `Unexpected content-type "${contentType}" for ${url}`
          );
        }
        const arrayBuffer = await res.arrayBuffer();
        const audio = await Tone.getContext().rawContext.decodeAudioData(
          arrayBuffer.slice(0)
        );
        return [note, audio] as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to decode ${url}: ${message}`);
      }
    })
  );
  cachedPianoBuffers = Object.fromEntries(entries);
  return cachedPianoBuffers;
}

export function initTransport() {
  if (loopId !== null) {
    Tone.Transport.clear(loopId);
    loopId = null;
  }

  Tone.Transport.cancel();

  loopId = Tone.Transport.scheduleRepeat((time) => {
    const {
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
      currentStep,
      steps,
      bpm,
      loopRange,
      volumes,
      setCurrentStep,
    } = useSongStore.getState();

    Tone.Transport.bpm.value = bpm;
    const busVolumes = applyLiveVolumes(volumes, extraTracks);

    try {
      const melodyVelocityScale = getVolumeScale(volumes.melody, busVolumes.melody);
      const violinVelocityScale = getVolumeScale(volumes.violin, busVolumes.violin);
      const saxophoneVelocityScale = getVolumeScale(volumes.saxophone, busVolumes.saxophone);
      const guitarVelocityScale = getVolumeScale(volumes.guitar, busVolumes.guitar);
      const drumsVelocityScale = getVolumeScale(volumes.drums, busVolumes.drums);
      const bassVelocityScale = getVolumeScale(volumes.bass, busVolumes.bass);

      // 1. 멜로디 재생
      melody.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const note = getMelodyPlaybackNote(rowIndex);
        const durationSteps = Math.max(1, melodyLengths[rowIndex]?.[currentStep] ?? 1);
        triggerLiveMelodyNote(
          note,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          getMelodyVelocity(durationSteps) * melodyVelocityScale
        );
      });

      // 2. 바이올린 재생
      violin.slice(0, VIOLIN_NOTES.length).forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const durationSteps = Math.max(1, violinLengths[rowIndex]?.[currentStep] ?? 1);
        triggerLiveViolinNote(
          rowIndex,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.86 * violinVelocityScale
        );
      });

      // 3. 색소폰 재생
      saxophone.slice(0, SAXOPHONE_NOTES.length).forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const durationSteps = Math.max(1, saxophoneLengths[rowIndex]?.[currentStep] ?? 1);
        triggerLiveSaxophoneNote(
          rowIndex,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.78 * saxophoneVelocityScale
        );
      });

      // 4. 기타 재생
      guitar.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const durationSteps = Math.max(1, guitarLengths[rowIndex]?.[currentStep] ?? 1);
        triggerLiveGuitarNote(rowIndex, getMelodyGateSeconds(durationSteps, bpm), time, guitarVelocityScale);
      });

      // 5. 베이스 재생
      bass.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const midi = BASS_MIDI[rowIndex] ?? BASS_MIDI[BASS_MIDI.length - 1];
        const note = toSamplerNote(Tone.Frequency(midi, "midi").toNote());
        const durationSteps = Math.max(1, bassLengths[rowIndex]?.[currentStep] ?? 1);
        bassSampler.triggerAttackRelease(note, getMelodyGateSeconds(durationSteps, bpm), time, bassVelocityScale);
      });

      // 6. 드럼 재생
      if (drums[0]?.[currentStep]) {
        triggerLiveDrumSample(0, time, drumsVelocityScale);
      }
      if (drums[1]?.[currentStep]) {
        triggerLiveDrumSample(1, time, drumsVelocityScale);
      }
      if (drums[2]?.[currentStep]) {
        triggerLiveDrumSample(2, time, drumsVelocityScale);
      }
      if (drums[3]?.[currentStep]) {
        triggerLiveDrumSample(3, time, drumsVelocityScale);
      }
      if (drums[4]?.[currentStep]) {
        triggerLiveDrumSample(4, time, drumsVelocityScale);
      }

      extraTracks.forEach((track) => {
        triggerExtraTrackStep(track, currentStep, bpm, time, busVolumes);
      });
    } catch (error) {
      console.error("Playback tick failed:", error);
    } finally {
      const nextStep = loopRange
        ? currentStep >= loopRange.end
          ? loopRange.start
          : currentStep + 1
        : (currentStep + 1) % steps;
      setCurrentStep(nextStep);
    }
  }, "16n");

  Tone.Transport.position = 0;
}

export async function playMelodyPreview(row: number, durationSteps = 1): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  const bpm = state.bpm;
  const note = getMelodyPlaybackNote(row);
  triggerLiveMelodyNote(
    note,
    getMelodyGateSeconds(durationSteps, bpm),
    Tone.now(),
    getMelodyVelocity(durationSteps)
  );
}

export async function playViolinPreview(row: number, durationSteps = 1): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveViolinNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 0.86);
}

export async function playSaxophonePreview(row: number, durationSteps = 1): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveSaxophoneNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 0.78);
}

export async function playGuitarPreview(row: number, durationSteps = 1): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveGuitarNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 1);
}

export async function playDrumPreview(row: number): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveDrumSample(row, Tone.now());
}

async function renderSongBuffer(): Promise<AudioBuffer> {
  await Tone.start();
  await loadLame();
  const {
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
    steps,
    bpm,
    volumes,
  } = useSongStore.getState();
  const pianoBuffers = await loadPianoBuffers();

  const sixteenthSeconds = getSixteenthDurationSeconds(bpm);
  const durationSeconds = steps * sixteenthSeconds + 1.0;

  const rendered = await Tone.Offline(async ({ transport }) => {
    const melodyBus = new Tone.Reverb({ decay: 2.0, preDelay: 0.01, wet: 0.2 }).toDestination();
    const violinBus = new Tone.Reverb({ decay: 1.65, preDelay: 0.012, wet: 0.16 }).toDestination();
    const saxophoneBus = new Tone.Reverb({ decay: 1.15, preDelay: 0.008, wet: 0.11 }).toDestination();
    const guitarBus = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.18 }).toDestination();
    const melodySynth = new Tone.Sampler({ urls: pianoBuffers ?? {}, release: 1 }).connect(melodyBus);
    const violinSynthOffline = new Tone.Sampler({
      urls: VIOLIN_SAMPLE_URLS,
      attack: 0.018,
      release: 0.58,
      baseUrl: "/samples/violin/",
    }).connect(violinBus);
    const saxophoneSynthOffline = new Tone.Sampler({
      urls: SAXOPHONE_SAMPLE_URLS,
      attack: 0.008,
      release: 0.28,
      baseUrl: "/samples/sax/",
    }).connect(saxophoneBus);
    const guitarSynth = new Tone.Sampler({
      urls: GUITAR_SAMPLE_URLS,
      release: 1.2,
      baseUrl: "/samples/guitar/",
    }).connect(guitarBus);

    const drumSamplerOffline = createDrumSampler();
    const bassSamplerOffline = createBassSampler();

    await Tone.loaded();

    const busVolumes = getInstrumentBusVolumes(volumes, extraTracks);
    const melodyDb = volumeToDb(busVolumes.melody);
    const violinDb = volumeToDb(busVolumes.violin);
    const saxophoneDb = volumeToDb(busVolumes.saxophone);
    const guitarDb = volumeToDb(busVolumes.guitar);
    const drumsDb = volumeToDb(busVolumes.drums);
    const bassDb = volumeToDb(busVolumes.bass);

    melodySynth.volume.value = melodyDb;
    violinSynthOffline.volume.value = violinDb;
    saxophoneSynthOffline.volume.value = saxophoneDb;
    guitarSynth.volume.value = guitarDb;
    drumSamplerOffline.volume.value = drumsDb;
    bassSamplerOffline.volume.value = bassDb;

    transport.bpm.value = bpm;
    const melodyVelocityScale = getVolumeScale(volumes.melody, busVolumes.melody);
    const violinVelocityScale = getVolumeScale(volumes.violin, busVolumes.violin);
    const saxophoneVelocityScale = getVolumeScale(volumes.saxophone, busVolumes.saxophone);
    const guitarVelocityScale = getVolumeScale(volumes.guitar, busVolumes.guitar);
    const drumsVelocityScale = getVolumeScale(volumes.drums, busVolumes.drums);
    const bassVelocityScale = getVolumeScale(volumes.bass, busVolumes.bass);

    for (let col = 0; col < steps; col += 1) {
      const time = col * sixteenthSeconds;

      for (let row = 0; row < melody.length; row += 1) {
        if (!melody[row]?.[col]) continue;
        const note = getMelodyPlaybackNote(row);
        const durationSteps = Math.max(1, melodyLengths[row]?.[col] ?? 1);
        melodySynth.triggerAttackRelease(
          note,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          getMelodyVelocity(durationSteps) * melodyVelocityScale
        );
      }

      for (let row = 0; row < Math.min(violin.length, VIOLIN_NOTES.length); row += 1) {
        if (!violin[row]?.[col]) continue;
        const durationSteps = Math.max(1, violinLengths[row]?.[col] ?? 1);
        violinSynthOffline.triggerAttackRelease(
          getViolinPlaybackNote(row),
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.86 * violinVelocityScale
        );
      }

      for (let row = 0; row < Math.min(saxophone.length, SAXOPHONE_NOTES.length); row += 1) {
        if (!saxophone[row]?.[col]) continue;
        const durationSteps = Math.max(1, saxophoneLengths[row]?.[col] ?? 1);
        saxophoneSynthOffline.triggerAttackRelease(
          getSaxophonePlaybackNote(row),
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.78 * saxophoneVelocityScale
        );
      }

      for (let row = 0; row < guitar.length; row += 1) {
        if (!guitar[row]?.[col]) continue;
        const durationSteps = Math.max(1, guitarLengths[row]?.[col] ?? 1);
        guitarSynth.triggerAttackRelease(getGuitarPlaybackNote(row), getMelodyGateSeconds(durationSteps, bpm), time, guitarVelocityScale);
      }

      for (let row = 0; row < bass.length; row += 1) {
        if (!bass[row]?.[col]) continue;
        const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
        const note = toSamplerNote(Tone.Frequency(midi, "midi").toNote());
        const durationSteps = Math.max(1, bassLengths[row]?.[col] ?? 1);
        bassSamplerOffline.triggerAttackRelease(note, getMelodyGateSeconds(durationSteps, bpm), time, bassVelocityScale);
      }

      for (let row = 0; row < drums.length; row += 1) {
        if (!drums[row]?.[col]) continue;
        drumSamplerOffline.triggerAttackRelease(
          getDrumSampleNote(row),
          getDrumSampleDuration(row),
          time,
          drumsVelocityScale
        );
      }

      extraTracks.forEach((track) => {
        const velocityScale = getVolumeScale(track.volume, busVolumes[track.instrument]);
        if (velocityScale <= 0) {
          return;
        }

        track.grid.forEach((rowArr, row) => {
          if (!rowArr[col]) {
            return;
          }

          switch (track.instrument) {
            case "melody": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              melodySynth.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                getMelodyVelocity(durationSteps) * velocityScale
              );
              break;
            }
            case "violin": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              violinSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                0.86 * velocityScale
              );
              break;
            }
            case "saxophone": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              saxophoneSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                0.78 * velocityScale
              );
              break;
            }
            case "guitar": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              guitarSynth.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                velocityScale
              );
              break;
            }
            case "bass": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              bassSamplerOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                velocityScale
              );
              break;
            }
            case "drums":
              drumSamplerOffline.triggerAttackRelease(
                getDrumSampleNote(row),
                getDrumSampleDuration(row),
                time,
                velocityScale
              );
              break;
            default:
              break;
          }
        });
      });
    }

    transport.start(0);
  }, durationSeconds);

  const buffer = rendered.get();
  if (!buffer) {
    throw new Error("Failed to render audio buffer");
  }

  return buffer;
}

export async function exportSongAsMp3(): Promise<Blob> {
  const buffer = await renderSongBuffer();
  return audioBufferToMp3(buffer);
}

export async function exportSongAsWav(): Promise<Blob> {
  const buffer = await renderSongBuffer();
  return audioBufferToWav(buffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const blockAlign = channels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeAsciiString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, "WAVE");
  writeAsciiString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAsciiString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
      const sample = buffer.getChannelData(channelIndex)[sampleIndex] ?? 0;
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function audioBufferToMp3(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const Mp3Encoder = getLame()?.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error("Mp3Encoder is not available");
  }
  const encoder: Mp3EncoderInstance = new Mp3Encoder(
    numChannels,
    sampleRate,
    128
  );
  const blockSize = 1152;
  const mp3Chunks: BlobPart[] = [];

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channelData.push(buffer.getChannelData(ch));
  }

  const length = buffer.length;
  for (let i = 0; i < length; i += blockSize) {
    const left = floatToInt16(channelData[0].subarray(i, i + blockSize));
    let mp3buf: Int8Array | Uint8Array | number[];

    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(left);
    } else {
      const right = floatToInt16(channelData[1].subarray(i, i + blockSize));
      mp3buf = encoder.encodeBuffer(left, right);
    }

    if (mp3buf.length > 0) {
      mp3Chunks.push(toArrayBuffer(mp3buf));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(toArrayBuffer(end));
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function writeAsciiString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function getOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const host = port ? `${hostname}:${port}` : hostname;
  return `${protocol}//${host}`;
}

function toArrayBuffer(data: Int8Array | Uint8Array | number[]): ArrayBuffer {
  const u8 =
    data instanceof Uint8Array
      ? data
      : data instanceof Int8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;
}

type Mp3EncoderInstance = {
  encodeBuffer: (
    left: Int16Array,
    right?: Int16Array
  ) => Int8Array | Uint8Array | number[];
  flush: () => Int8Array | Uint8Array | number[];
};

type Mp3EncoderCtor = new (
  channels: number,
  sampleRate: number,
  kbps: number
) => Mp3EncoderInstance;

function getLame(): { Mp3Encoder: Mp3EncoderCtor } | null {
  const anyWindow = window as unknown as { lamejs?: { Mp3Encoder?: unknown } };
  if (anyWindow.lamejs && anyWindow.lamejs.Mp3Encoder) {
    return anyWindow.lamejs as {
      Mp3Encoder: Mp3EncoderCtor;
    };
  }
  return null;
}

function loadLame(): Promise<void> {
  if (getLame()) return Promise.resolve();
  if (lameLoadPromise) return lameLoadPromise;
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const base = new URL(baseUrl, getOrigin());
  const scriptUrl = new URL("vendor/lame.min.js", base).toString();
  lameLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));
    document.head.appendChild(script);
  });
  return lameLoadPromise;
}

export async function playBassPreview(row: number, durationSteps = 1): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
  const note = toSamplerNote(Tone.Frequency(midi, "midi").toNote());
  bassSampler.triggerAttackRelease(note, getMelodyGateSeconds(durationSteps, state.bpm));
}
