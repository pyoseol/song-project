import * as Tone from "tone";

const pianoReverb = new Tone.Reverb({
  decay: 2.0,
  preDelay: 0.01,
  wet: 0.2,
}).toDestination();

const guitarReverb = new Tone.Reverb({
  decay: 1.8,
  preDelay: 0.01,
  wet: 0.18,
}).toDestination();

const violinReverb = new Tone.Reverb({
  decay: 1.65,
  preDelay: 0.012,
  wet: 0.16,
}).toDestination();

const saxophoneReverb = new Tone.Reverb({
  decay: 1.15,
  preDelay: 0.008,
  wet: 0.11,
}).toDestination();

export const pianoSynth = new Tone.Sampler({
  urls: {
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
  },
  release: 1,
  baseUrl: "/samples/piano/",
}).connect(pianoReverb);

export const GUITAR_SAMPLE_URLS = {
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A5: "A5.mp3",
  "A#5": "A_sharp5.mp3",
  B5: "B5.mp3",
  C5: "C5.mp3",
  "C#5": "C_sharp5.mp3",
  D5: "D5.mp3",
  "D#5": "D_sharp5.mp3",
  E5: "E5.mp3",
  F5: "F5.mp3",
  "F#5": "F_sharp5.mp3",
  G5: "G5.mp3",
  "G#5": "G_sharp5.mp3",
  C6: "C6.mp3",
} as const;

export const acousticGuitarSynth = new Tone.Sampler({
  urls: GUITAR_SAMPLE_URLS,
  release: 1.2,
  baseUrl: "/samples/guitar/",
}).connect(guitarReverb);

export const VIOLIN_SAMPLE_URLS = {
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
} as const;

export const SAXOPHONE_SAMPLE_URLS = {
  C2: "C2.mp3",
  "C#2": "C_sharp2.mp3",
  D2: "D2.mp3",
  "D#2": "D_sharp2.mp3",
  E2: "E2.mp3",
  F2: "F2.mp3",
  "F#2": "F_sharp2.mp3",
  G2: "G2.mp3",
  "G#2": "G_sharp2.mp3",
  A2: "A2.mp3",
  "A#2": "A_sharp2.mp3",
  B2: "B2.mp3",
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
} as const;

export const violinSynth = new Tone.Sampler({
  urls: VIOLIN_SAMPLE_URLS,
  attack: 0.018,
  release: 0.58,
  baseUrl: "/samples/violin/",
}).connect(violinReverb);

export const saxophoneSynth = new Tone.Sampler({
  urls: SAXOPHONE_SAMPLE_URLS,
  attack: 0.008,
  release: 0.28,
  baseUrl: "/samples/sax/",
}).connect(saxophoneReverb);

export const BASS_SAMPLE_URLS = {
  C2: "01_C2.mp3",
  "C#2": "02_C_sharp2.mp3",
  D2: "03_D2.mp3",
  "D#2": "04_D_sharp2.mp3",
  E2: "05_E2.mp3",
  F2: "06_F2.mp3",
  "F#2": "07_F_sharp2.mp3",
  G2: "08_G2.mp3",
  "G#2": "09_G_sharp2.mp3",
  A2: "10_A2.mp3",
  "A#2": "11_A_sharp2.mp3",
  B2: "12_B2.mp3",
  C3: "13_C3.mp3",
  "C#3": "14_C_sharp3.mp3",
  D3: "15_D3.mp3",
  "D#3": "16_D_sharp3.mp3",
  E3: "17_E3.mp3",
  F3: "18_F3.mp3",
  "F#3": "19_F_sharp3.mp3",
  G3: "20_G3.mp3",
  "G#3": "21_G_sharp3.mp3",
  A3: "22_A3.mp3",
  "A#3": "23_A_sharp3.mp3",
  B3: "24_B3.mp3",
} as const;

export const DRUM_SAMPLE_URLS = {
  C2: "kick_punch.mp3",
  D2: "snare.mp3",
  E2: "kick_low.mp3",
  "F#2": "hats_tight.mp3",
  "A#2": "hats_loose.mp3",
  C3: "crash.mp3",
} as const;

export const DRUM_SAMPLE_NOTE_BY_ROW = ["C2", "D2", "F#2", "A#2", "E2"] as const;

export function createBassSampler() {
  return new Tone.Sampler({
    urls: BASS_SAMPLE_URLS,
    release: 1,
    baseUrl: "/samples/drum_bass/bass/",
  }).toDestination();
}

export function createDrumSampler() {
  return new Tone.Sampler({
    urls: DRUM_SAMPLE_URLS,
    release: 0.8,
    baseUrl: "/samples/drum_bass/drum/",
  }).toDestination();
}

export const bassSampler = createBassSampler();
export const drumSampler = createDrumSampler();
