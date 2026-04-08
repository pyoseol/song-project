import { create } from 'zustand';

type UIState = {
  activeTab: 'melody' | 'drums' | 'bass';
  setActiveTab: (tab: UIState['activeTab']) => void;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
  selectedInstrument: 'marimba' | 'piano' | 'synth';
  setInstrument: (value: UIState['selectedInstrument']) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'melody',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isPlaying: false,
  setIsPlaying: (value) => set({ isPlaying: value }),
  selectedInstrument: 'marimba',
  setInstrument: (value) => set({ selectedInstrument: value }),
}));
