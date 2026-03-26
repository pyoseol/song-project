import type { UserSettings } from '../store/settingsStore';
import { fetchServerJson } from './serverApi';

export function fetchSettingsFromServer(email: string) {
  const query = new URLSearchParams({ email });
  return fetchServerJson<{ settings: UserSettings }>(`/api/settings?${query.toString()}`);
}

export function updateSettingsOnServer(payload: {
  email: string;
  patch: Partial<UserSettings>;
}) {
  return fetchServerJson<{ settings: UserSettings }>('/api/settings/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
