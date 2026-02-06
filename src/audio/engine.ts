// src/audio/engine.ts
import * as Tone from "tone";
import { melodySynth, kickSynth, snareSynth } from "./instruments.ts";
import { useSongStore } from "../store/songStore.ts";

// 12칸 멜로디를 특정 음계로 고정 매핑
// 0번 줄이 가장 위(11번 줄이 가장 아래). C 메이저/펜타토닉 느낌으로 정렬
const MELODY_SCALE_MIDI: number[] = [
  84, // row 0: C6
  81, // row 1: A5
  79, // row 2: G5
  76, // row 3: E5
  74, // row 4: D5
  72, // row 5: C5
  69, // row 6: A4
  67, // row 7: G4
  64, // row 8: E4
  62, // row 9: D4
  60, // row10: C4
  57, // row11: A3
];
// 원하는 음계면 배열 숫자만 바꾸면 됩니다 (예: C 메이저 계열 등)

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
        const message =
          err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to decode ${url}: ${message}`);
      }
    })
  );
  cachedPianoBuffers = Object.fromEntries(entries);
  return cachedPianoBuffers;
}

export function initTransport() {
  if (loopId !== null) return;

  // 임시로 예약됐던 이벤트 제거
  Tone.Transport.cancel();

  loopId = Tone.Transport.scheduleRepeat((time) => {
    const {
      melody,
      drums,
      currentStep,
      steps,
      bpm,
      setCurrentStep,
    } = useSongStore.getState();

    // BPM 반영
    Tone.Transport.bpm.value = bpm;


    // 멜로디 재생 (스텝 기준)
    melody.forEach((rowArr, rowIndex) => {
      if (!rowArr[currentStep]) return;

      // rowIndex를 우리가 정의한 음계에 매핑
      const midi =
        MELODY_SCALE_MIDI[rowIndex] ??
        MELODY_SCALE_MIDI[MELODY_SCALE_MIDI.length - 1];

      const note = Tone.Frequency(midi, "midi").toNote();
      // 노트 길이는 16분음표로 설정 (원하면 "8n"으로 변경)
      melodySynth.triggerAttackRelease(note, "8n", time);
    });

    // 드럼 0: 킥
    if (drums[0]?.[currentStep]) {
      kickSynth.triggerAttackRelease("C2", "8n", time);
    }

    // 드럼 1: 스네어
    if (drums[1]?.[currentStep]) {
      snareSynth.triggerAttackRelease("16n", time);
    }

    // 다음 스텝
    const nextStep = (currentStep + 1) % steps;
    setCurrentStep(nextStep);
  }, "16n");

  Tone.Transport.position = 0;
}

export async function playMelodyPreview(row: number): Promise<void> {
  await Tone.start();
  const midi =
    MELODY_SCALE_MIDI[row] ??
    MELODY_SCALE_MIDI[MELODY_SCALE_MIDI.length - 1];
  const note = Tone.Frequency(midi, "midi").toNote();
  melodySynth.triggerAttackRelease(note, "8n");
}

export async function playDrumPreview(row: number): Promise<void> {
  await Tone.start();
  if (row === 0) {
    kickSynth.triggerAttackRelease("C2", "8n");
    return;
  }
  if (row === 1) {
    snareSynth.triggerAttackRelease("16n");
  }
}

export async function exportSongAsMp3(): Promise<Blob> {
  await Tone.start();
  await loadLame();
  const { melody, drums, steps, bpm } = useSongStore.getState();
  const pianoBuffers = await loadPianoBuffers();

  const sixteenthSeconds = (60 / bpm) / 4;
  const durationSeconds = steps * sixteenthSeconds + 1.0;

  const rendered = await Tone.Offline(async ({ transport }) => {
    const reverb = new Tone.Reverb({
      decay: 2.0,
      preDelay: 0.01,
      wet: 0.2,
    }).toDestination();

    const sampler = new Tone.Sampler({
      urls: pianoBuffers,
      release: 1,
    }).connect(reverb);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0,
        release: 0.3,
      },
    }).toDestination();

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.05,
      },
    }).toDestination();

    transport.bpm.value = bpm;

    for (let col = 0; col < steps; col += 1) {
      const time = col * sixteenthSeconds;

      for (let row = 0; row < melody.length; row += 1) {
        if (!melody[row]?.[col]) continue;
        const midi =
          MELODY_SCALE_MIDI[row] ??
          MELODY_SCALE_MIDI[MELODY_SCALE_MIDI.length - 1];
        const note = Tone.Frequency(midi, "midi").toNote();
        sampler.triggerAttackRelease(note, "8n", time);
      }

      if (drums[0]?.[col]) {
        kick.triggerAttackRelease("C2", "8n", time);
      }
      if (drums[1]?.[col]) {
        snare.triggerAttackRelease("16n", time);
      }
    }

    transport.start(0);
  }, durationSeconds);

  const buffer = rendered.get();
  if (!buffer) {
    throw new Error("Failed to render audio buffer");
  }

  return audioBufferToMp3(buffer);
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
      const right = floatToInt16(
        channelData[1].subarray(i, i + blockSize)
      );
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

function getOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const host = port ? `${hostname}:${port}` : hostname;
  return `${protocol}//${host}`;
}

function toArrayBuffer(
  data: Int8Array | Uint8Array | number[]
): ArrayBuffer {
  const u8 =
    data instanceof Uint8Array
      ? data
      : data instanceof Int8Array
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
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
    script.onerror = () =>
      reject(new Error(`Failed to load ${scriptUrl}`));
    document.head.appendChild(script);
  });
  return lameLoadPromise;
}

