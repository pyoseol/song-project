// src/store/uiStore.ts
import { create } from "zustand";

type UIState = {
  activeTab: "melody" | "drums" | "bass"; // 💡 bass 추가
  setActiveTab: (tab: "melody" | "drums" | "bass") => void; // 💡 bass 추가
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  selectedInstrument: "marimba" | "piano" | "synth";
  setInstrument: (v: UIState["selectedInstrument"]) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeTab: "melody",
  setActiveTab: (tab) => set({ activeTab: tab }),
  isPlaying: false,
  setIsPlaying: (v) => set({ isPlaying: v }),
  selectedInstrument: "marimba",
  setInstrument: (v) => set({ selectedInstrument: v }),
}));