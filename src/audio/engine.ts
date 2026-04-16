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
} from "./instruments.ts";
import { useSongStore, type InstrumentVolumes } from "../store/songStore.ts";
import { BASS_MIDI, MELODY_MIDI } from "../constants/composer.ts";

let loopId: number | null = null;

const PIANO_SAMPLE_URLS: Record<string, string> = {
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
};

let cachedPianoBuffers: Record<string, AudioBuffer> | null = null;
let lameLoadPromise: Promise<void> | null = null;

const GUITAR_TRACK_SAMPLE_NOTES = ["E4", "B4", "G4", "D4", "A3", "E4"] as const;

function getMelodyPlaybackNote(row: number) {
  const midi = MELODY_MIDI[row] ?? MELODY_MIDI[MELODY_MIDI.length - 1];
  return Tone.Frequency(midi, "midi").toNote();
}

function getGuitarPlaybackNote(row: number) {
  return GUITAR_TRACK_SAMPLE_NOTES[row] ?? GUITAR_TRACK_SAMPLE_NOTES[GUITAR_TRACK_SAMPLE_NOTES.length - 1];
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

function triggerLiveDrumSample(row: number, time?: number) {
  drumSampler.triggerAttackRelease(
    getDrumSampleNote(row),
    getDrumSampleDuration(row),
    time
  );
}

function applyLiveVolumes(volumes: InstrumentVolumes) {
  const melodyDb = volumeToDb(volumes.melody);
  const drumsDb = volumeToDb(volumes.drums);
  const bassDb = volumeToDb(volumes.bass);

  pianoSynth.volume.value = melodyDb;
  acousticGuitarSynth.volume.value = melodyDb - 1;
  drumSampler.volume.value = drumsDb;
  bassSampler.volume.value = bassDb;
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

export async function preparePlaybackEngine() {
  await Tone.start();
  await Tone.loaded();
  initTransport();
  applyLiveVolumes(useSongStore.getState().volumes);
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
      guitar,
      drums,
      bass,
      currentStep,
      steps,
      bpm,
      loopRange,
      volumes,
      setCurrentStep,
    } = useSongStore.getState();

    Tone.Transport.bpm.value = bpm;
    applyLiveVolumes(volumes);

    try {
      // 1. 멜로디 재생
      melody.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const note = getMelodyPlaybackNote(rowIndex);
        const durationSteps = Math.max(1, melodyLengths[rowIndex]?.[currentStep] ?? 1);
        triggerLiveMelodyNote(
          note,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          getMelodyVelocity(durationSteps)
        );
      });

      // 2. 기타 재생
      guitar.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        triggerLiveGuitarNote(rowIndex, getMelodyGateSeconds(1, bpm), time, 1);
      });

      // 3. 베이스 재생
      bass.forEach((rowArr, rowIndex) => {
        if (!rowArr[currentStep]) return;
        const midi = BASS_MIDI[rowIndex] ?? BASS_MIDI[BASS_MIDI.length - 1];
        const note = Tone.Frequency(midi, "midi").toNote();
        bassSampler.triggerAttackRelease(note, "8n", time);
      });

      // 4. 드럼 재생
      if (drums[0]?.[currentStep]) {
        triggerLiveDrumSample(0, time);
      }
      if (drums[1]?.[currentStep]) {
        triggerLiveDrumSample(1, time);
      }
      if (drums[2]?.[currentStep]) {
        triggerLiveDrumSample(2, time);
      }
      if (drums[3]?.[currentStep]) {
        triggerLiveDrumSample(3, time);
      }
      if (drums[4]?.[currentStep]) {
        triggerLiveDrumSample(4, time);
      }
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
  applyLiveVolumes(useSongStore.getState().volumes);
  const bpm = useSongStore.getState().bpm;
  const note = getMelodyPlaybackNote(row);
  triggerLiveMelodyNote(
    note,
    getMelodyGateSeconds(durationSteps, bpm),
    Tone.now(),
    getMelodyVelocity(durationSteps)
  );
}

export async function playGuitarPreview(row: number): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  applyLiveVolumes(useSongStore.getState().volumes);
  triggerLiveGuitarNote(row, getMelodyGateSeconds(1, useSongStore.getState().bpm), Tone.now(), 1);
}

export async function playDrumPreview(row: number): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  applyLiveVolumes(useSongStore.getState().volumes);
  triggerLiveDrumSample(row, Tone.now());
}

async function renderSongBuffer(): Promise<AudioBuffer> {
  await Tone.start();
  await loadLame();
  const { melody, melodyLengths, guitar, drums, bass, steps, bpm, volumes } = useSongStore.getState();
  const pianoBuffers = await loadPianoBuffers();

  const sixteenthSeconds = getSixteenthDurationSeconds(bpm);
  const durationSeconds = steps * sixteenthSeconds + 1.0;

  const rendered = await Tone.Offline(async ({ transport }) => {
    const melodyBus = new Tone.Reverb({ decay: 2.0, preDelay: 0.01, wet: 0.2 }).toDestination();
    const guitarBus = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.18 }).toDestination();
    const melodySynth = new Tone.Sampler({ urls: pianoBuffers ?? {}, release: 1 }).connect(melodyBus);
    const guitarSynth = new Tone.Sampler({
      urls: GUITAR_SAMPLE_URLS,
      release: 1.2,
      baseUrl: "/samples/guitar/",
    }).connect(guitarBus);

    const drumSamplerOffline = createDrumSampler();
    const bassSamplerOffline = createBassSampler();

    await Tone.loaded();

    const melodyDb = volumeToDb(volumes.melody);
    const drumsDb = volumeToDb(volumes.drums);
    const bassDb = volumeToDb(volumes.bass);

    melodySynth.volume.value = melodyDb;
    guitarSynth.volume.value = melodyDb - 1;
    drumSamplerOffline.volume.value = drumsDb;
    bassSamplerOffline.volume.value = bassDb;

    transport.bpm.value = bpm;

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
          getMelodyVelocity(durationSteps)
        );
      }

      for (let row = 0; row < guitar.length; row += 1) {
        if (!guitar[row]?.[col]) continue;
        guitarSynth.triggerAttackRelease(getGuitarPlaybackNote(row), getMelodyGateSeconds(1, bpm), time, 1);
      }

      for (let row = 0; row < bass.length; row += 1) {
        if (!bass[row]?.[col]) continue;
        const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
        const note = Tone.Frequency(midi, "midi").toNote();
        bassSamplerOffline.triggerAttackRelease(note, "8n", time);
      }

      for (let row = 0; row < drums.length; row += 1) {
        if (!drums[row]?.[col]) continue;
        drumSamplerOffline.triggerAttackRelease(
          getDrumSampleNote(row),
          getDrumSampleDuration(row),
          time
        );
      }
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

export async function playBassPreview(row: number): Promise<void> {
  await Tone.start();
  await Tone.loaded();
  applyLiveVolumes(useSongStore.getState().volumes);
  const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
  const note = Tone.Frequency(midi, "midi").toNote();
  bassSampler.triggerAttackRelease(note, "8n");
}
