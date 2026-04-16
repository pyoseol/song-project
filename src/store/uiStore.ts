import { create } from 'zustand';

export type ComposerTabKey = 'melody' | 'guitar' | 'drums' | 'bass';
export type MelodyInstrument = 'piano' | 'acousticGuitar';

type UIState = {
  activeTab: ComposerTabKey;
  setActiveTab: (tab: UIState['activeTab']) => void;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
  selectedInstrument: MelodyInstrument;
  setInstrument: (value: UIState['selectedInstrument']) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'melody',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isPlaying: false,
  setIsPlaying: (value) => set({ isPlaying: value }),
  selectedInstrument: 'piano',
  setInstrument: (value) => set({ selectedInstrument: value }),
}));
