import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectConfigReferences,
  createEmptyDraftConfig,
  parseConfigText,
  stringifyConfig,
  validateDraftConfig,
} from '../src/lib/opencode-config.js';
import { normalizePreferencesForStorage } from '../src/lib/config-manager-preferences.js';

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
  }, {});

  assert.throws(() => structuredClone(source));

  const normalized = normalizePreferencesForStorage(source);

  assert.deepEqual(normalized, {
    autoBackup: true,
    defaultPath: '~/.config/opencode/opencode.json',
    testTimeout: 5000,
  });
  assert.doesNotThrow(() => structuredClone(normalized));
});
