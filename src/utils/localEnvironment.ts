const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function isLocalDevelopmentHost() {
  return typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);
}
