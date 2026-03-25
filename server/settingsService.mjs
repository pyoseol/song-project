import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthServiceError } from './authService.mjs';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadSettingsMysqlState, saveSettingsMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_LEGACY_DATA_PATH = join(__dirname, 'settings-data.json');

const DEFAULT_USER_SETTINGS = {
  communityNotifications: true,
  musicNotifications: true,
  shortsNotifications: true,
  collabNotifications: true,
  profilePublic: true,
  showActivity: true,
};

async function loadLegacyState() {
  return await loadSqlState(
    'settings',
    () => ({ settingsByEmail: {} }),
    {
      legacyFilePath: SETTINGS_LEGACY_DATA_PATH,
      normalize: (parsed) => ({
      settingsByEmail:
        parsed && typeof parsed.settingsByEmail === 'object' && parsed.settingsByEmail
          ? parsed.settingsByEmail
          : {},
      }),
    }
  );
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadSettingsMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveSettingsMysqlState(state);
    return;
  }

  saveSqlState('settings', state);
}

function assertEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized) {
    throw new AuthServiceError(400, '설정을 저장할 이메일이 필요합니다.');
  }

  return normalized;
}

function normalizeSettings(settings) {
  return {
    communityNotifications: Boolean(settings?.communityNotifications ?? DEFAULT_USER_SETTINGS.communityNotifications),
    musicNotifications: Boolean(settings?.musicNotifications ?? DEFAULT_USER_SETTINGS.musicNotifications),
    shortsNotifications: Boolean(settings?.shortsNotifications ?? DEFAULT_USER_SETTINGS.shortsNotifications),
    collabNotifications: Boolean(settings?.collabNotifications ?? DEFAULT_USER_SETTINGS.collabNotifications),
    profilePublic: Boolean(settings?.profilePublic ?? DEFAULT_USER_SETTINGS.profilePublic),
    showActivity: Boolean(settings?.showActivity ?? DEFAULT_USER_SETTINGS.showActivity),
  };
}

export function getSettings(email) {
  const normalizedEmail = assertEmail(email);
  return normalizeSettings(state.settingsByEmail[normalizedEmail]);
}

export function updateSettings(payload) {
  const email = assertEmail(payload.email);
  const currentSettings = getSettings(email);
  const nextSettings = normalizeSettings({
    ...currentSettings,
    ...payload.patch,
  });

  state = {
    ...state,
    settingsByEmail: {
      ...state.settingsByEmail,
      [email]: nextSettings,
    },
  };
  saveState();

  return nextSettings;
}
