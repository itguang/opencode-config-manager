export function normalizePreferencesForStorage(preferences) {
  const value = JSON.parse(JSON.stringify({
    autoBackup: Boolean(preferences?.autoBackup),
    defaultPath: typeof preferences?.defaultPath === 'string' ? preferences.defaultPath : '',
    testTimeout: Number.isFinite(preferences?.testTimeout) ? preferences.testTimeout : 5000,
    lastAppliedEnvironmentId: typeof preferences?.lastAppliedEnvironmentId === 'string' ? preferences.lastAppliedEnvironmentId : '',
  }));

  return value;
}
