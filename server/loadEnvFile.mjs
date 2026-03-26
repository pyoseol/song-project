import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex < 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (!key) {
    return null;
  }

  return [key, value];
}

export function loadServerEnv() {
  const candidates = ['.env.local', '.env.mysql.local', '.env'];

  for (const fileName of candidates) {
    const fullPath = join(rootDir, fileName);
    if (!existsSync(fullPath)) {
      continue;
    }

    const raw = readFileSync(fullPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const entry = parseEnvLine(line);
      if (!entry) {
        return;
      }

      const [key, value] = entry;
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  }
}
