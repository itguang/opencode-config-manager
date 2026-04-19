import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

import {
  collectConfigReferences,
  createEmptyDraftConfig,
  getModelOptions,
  parseConfigText,
  stringifyConfig,
  validateDraftConfig,
} from '../src/lib/opencode-config.js';
import { normalizeEnvironmentName } from '../src/lib/environment-name.js';
import { normalizePreferencesForStorage } from '../src/lib/config-manager-preferences.js';
import { useConfigManagerStore } from '../src/stores/config-manager.js';

test('parses jsonc config text with comments and trailing commas', () => {
  const parsed = parseConfigText(`{
    // comment
    "model": "openai/gpt-5",
    "provider": {
      "openai": {
        "options": {
          "apiKey": "{env:OPENAI_API_KEY}",
        },
      },
    },
  }`);

  assert.equal(parsed.data.model, 'openai/gpt-5');
  assert.equal(parsed.data.provider.openai.options.apiKey, '{env:OPENAI_API_KEY}');
  assert.deepEqual(parsed.errors, []);
});

test('reports missing providers and invalid permission actions', () => {
  const draft = createEmptyDraftConfig();
  draft.model = 'missing/gpt-5';
  draft.small_model = 'openai/gpt-5-mini';
  draft.provider = {
    openai: {
      models: {
        'gpt-5-mini': {},
      },
    },
  };
  draft.permission = {
    bash: {
      'rm *': 'deny',
      'git *': 'maybe',
    },
  };
  draft.disabled_providers = ['ghost'];

  const result = validateDraftConfig(draft);

  assert.equal(result.errors.some((item) => item.path === 'model'), true);
  assert.equal(result.errors.some((item) => item.path === 'permission.bash.git *'), true);
  assert.equal(result.warnings.some((item) => item.path === 'disabled_providers'), true);
});

test('collects env and file references from nested config values', () => {
  const draft = createEmptyDraftConfig();
  draft.provider = {
    anthropic: {
      options: {
        apiKey: '{env:ANTHROPIC_API_KEY}',
      },
    },
  };
  draft.instructions = ['{file:~/.config/opencode/AGENTS.md}'];
  draft.mcp = {
    logger: {
      type: 'remote',
      url: '{env:MCP_URL}',
      headers: {
        authorization: 'Bearer {file:/secret/token.txt}',
      },
    },
  };

  const references = collectConfigReferences(draft);

  assert.deepEqual(references.sort((left, right) => left.token.localeCompare(right.token)), [
    { kind: 'env', token: '{env:ANTHROPIC_API_KEY}', value: 'ANTHROPIC_API_KEY' },
    { kind: 'env', token: '{env:MCP_URL}', value: 'MCP_URL' },
    { kind: 'file', token: '{file:~/.config/opencode/AGENTS.md}', value: '~/.config/opencode/AGENTS.md' },
    { kind: 'file', token: '{file:/secret/token.txt}', value: '/secret/token.txt' },
  ].sort((left, right) => left.token.localeCompare(right.token)));
});

test('stringifies config with stable indentation', () => {
  const draft = createEmptyDraftConfig();
  draft.model = 'openai/gpt-5';

  assert.match(stringifyConfig(draft), /\n  "model": "openai\/gpt-5",\n/);
});

test('normalizes preferences into a cloneable plain object', () => {
  const source = new Proxy({
    autoBackup: true,
    defaultPath: '~/.config/opencode/opencode.json',
    testTimeout: 5000,
    lastAppliedEnvironmentName: 'Daily',
  }, {});

  assert.throws(() => structuredClone(source));

  const normalized = normalizePreferencesForStorage(source);

  assert.deepEqual(normalized, {
    autoBackup: true,
    defaultPath: '~/.config/opencode/opencode.json',
    testTimeout: 5000,
    lastAppliedEnvironmentName: 'Daily',
  });
  assert.doesNotThrow(() => structuredClone(normalized));
});

test('records the active environment as the current effective source after apply', async () => {
  const persisted = [];
  global.window = {
    utools: {
      dbStorage: {
        getItem: () => null,
        setItem: (key, value) => {
          persisted.push({ key, value });
        },
      },
    },
    services: {
      getDefaultOpencodeConfigPath: () => '/tmp/opencode.json',
      writeOpencodeConfig: async ({ path, content, backup }) => ({
        path,
        backupPath: backup ? '/tmp/opencode.json.bak' : '',
        content,
      }),
    },
  };

  setActivePinia(createPinia());
  const store = useConfigManagerStore();
  store.initialize();
  store.createEnvironment('Daily');

  const appliedEnvironmentId = store.activeEnvironmentId;
  const result = await store.applyActive();

  assert.equal(result.ok, true);
  assert.equal(store.lastAppliedEnvironmentName, 'Daily');
  assert.deepEqual(persisted.at(-1), {
    key: 'opencode-config-manager.preferences',
    value: {
      autoBackup: true,
      defaultPath: '/tmp/opencode.json',
      testTimeout: 5000,
      lastAppliedEnvironmentName: 'Daily',
    },
  });

  delete global.window;
});

test('normalizes environment names for inline rename commit', () => {
  assert.equal(normalizeEnvironmentName('  Daily Profile  ', 'Fallback'), 'Daily Profile');
  assert.equal(normalizeEnvironmentName('   ', 'Fallback'), 'Fallback');
  assert.equal(normalizeEnvironmentName('', 'Global Draft'), 'Global Draft');
});

test('returns model options across all providers for global model selection', () => {
  const options = getModelOptions({
    openai: {
      models: {
        'gpt-5': {},
        'gpt-5-mini': {},
      },
    },
    anthropic: {
      models: {
        'claude-sonnet-4': {},
      },
    },
  });

  assert.deepEqual(options, [
    { label: 'openai/gpt-5', value: 'openai/gpt-5' },
    { label: 'openai/gpt-5-mini', value: 'openai/gpt-5-mini' },
    { label: 'anthropic/claude-sonnet-4', value: 'anthropic/claude-sonnet-4' },
  ]);
});
