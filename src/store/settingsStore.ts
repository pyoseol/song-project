import { create } from 'zustand';
import { fetchSettingsFromServer, updateSettingsOnServer } from '../utils/settingsApi';

export type UserSettings = {
  communityNotifications: boolean;
  musicNotifications: boolean;
  shortsNotifications: boolean;
  collabNotifications: boolean;
  profilePublic: boolean;
  showActivity: boolean;
};

type SettingsStoreState = {
  settingsByEmail: Record<string, UserSettings>;
  loadingByEmail: Record<string, boolean>;
  errorByEmail: Record<string, string | null>;
  ensureSettings: (email: string) => Promise<UserSettings | null>;
  updateSettings: (email: string, patch: Partial<UserSettings>) => Promise<UserSettings>;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  communityNotifications: true,
  musicNotifications: true,
  shortsNotifications: true,
  collabNotifications: true,
  profilePublic: true,
  showActivity: true,
};

export function getUserSettings(
  settingsByEmail: Record<string, UserSettings>,
  email?: string | null
) {
  if (!email) {
    return DEFAULT_USER_SETTINGS;
  }

  return settingsByEmail[email] ?? DEFAULT_USER_SETTINGS;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settingsByEmail: {},
  loadingByEmail: {},
  errorByEmail: {},
  ensureSettings: async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const existing = get().settingsByEmail[normalizedEmail];
    if (existing) {
      return existing;
    }

    set((state) => ({
      ...state,
      loadingByEmail: {
        ...state.loadingByEmail,
        [normalizedEmail]: true,
      },
      errorByEmail: {
        ...state.errorByEmail,
        [normalizedEmail]: null,
      },
    }));

    try {
      const response = await fetchSettingsFromServer(normalizedEmail);

      set((state) => ({
        ...state,
        settingsByEmail: {
          ...state.settingsByEmail,
          [normalizedEmail]: response.settings,
        },
        loadingByEmail: {
          ...state.loadingByEmail,
          [normalizedEmail]: false,
        },
        errorByEmail: {
          ...state.errorByEmail,
          [normalizedEmail]: null,
        },
      }));

      return response.settings;
    } catch (error) {
      const message = error instanceof Error ? error.message : '설정을 불러오지 못했습니다.';

      set((state) => ({
        ...state,
        loadingByEmail: {
          ...state.loadingByEmail,
          [normalizedEmail]: false,
        },
        errorByEmail: {
          ...state.errorByEmail,
          [normalizedEmail]: message,
        },
      }));
      throw error;
    }
  },
  updateSettings: async (email, patch) => {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await updateSettingsOnServer({
      email: normalizedEmail,
      patch,
    });

    set((state) => ({
      ...state,
      settingsByEmail: {
        ...state.settingsByEmail,
        [normalizedEmail]: response.settings,
      },
      errorByEmail: {
        ...state.errorByEmail,
        [normalizedEmail]: null,
      },
    }));

    return response.settings;
  },
}));
