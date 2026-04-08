const warnedKeys = new Set<string>();

export function readEnv(key: keyof ImportMetaEnv | string) {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === "string" ? value.trim() : "";
}

export function warnMissingEnv(keys: string[], context: string) {
  const missingKeys = keys.filter((key) => !readEnv(key));

  if (!missingKeys.length) {
    return;
  }

  const warningId = `${context}:${missingKeys.join(",")}`;
  if (warnedKeys.has(warningId)) {
    return;
  }

  warnedKeys.add(warningId);
  console.warn(
    `[env] Missing ${context} configuration: ${missingKeys.join(", ")}. ` +
      "Create a .env.local file based on .env.example."
  );
}
