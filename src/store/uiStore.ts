import { create } from "zustand";

type UIState = {
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;

  selectedInstrument: "marimba" | "piano" | "synth";
  setInstrument: (v: UIState["selectedInstrument"]) => void;
};

export const useUIStore = create<UIState>((set) => ({
  isPlaying: false,
  setIsPlaying: (v) => set({ isPlaying: v }),

  selectedInstrument: "marimba",
  setInstrument: (v) => set({ selectedInstrument: v }),
}));
