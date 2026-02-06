// src/audio/instruments.ts
import * as Tone from "tone";

// Light reverb for a natural piano tail
const reverb = new Tone.Reverb({
  decay: 2.0,
  preDelay: 0.01,
  wet: 0.2,
}).toDestination();

// Melody sampler (MP3 piano samples from /public/samples/piano)
export const melodySynth = new Tone.Sampler({
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
}).connect(reverb);

export const kickSynth = new Tone.MembraneSynth({
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

export const snareSynth = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: {
    attack: 0.001,
    decay: 0.2,
    sustain: 0,
    release: 0.05,
  },
}).toDestination();
