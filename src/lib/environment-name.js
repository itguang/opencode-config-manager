export function normalizeEnvironmentName(input, fallback = 'Global Draft') {
  const value = String(input || '').trim();
  return value || String(fallback || 'Global Draft');
}
