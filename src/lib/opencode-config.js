import { parse, printParseErrorCode } from 'jsonc-parser';

const ALLOWED_PERMISSION_ACTIONS = new Set(['allow', 'ask', 'deny']);
const REFERENCE_PATTERN = /\{(env|file):([^}]+)\}/g;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyProvider() {
  return {
    options: {},
    models: {},
  };
}

export function createEmptyDraftConfig() {
  return {
    model: '',
    small_model: '',
    provider: {},
    disabled_providers: [],
    permission: 'ask',
    mcp: {},
    plugin: [],
    instructions: [],
    server: {},
    watcher: {
      ignore: [],
    },
    compaction: {
      auto: false,
      prune: false,
    },
  };
}

export function parseConfigText(text) {
  const errors = [];
  const data = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  return {
    data: {
      ...createEmptyDraftConfig(),
      ...(isPlainObject(data) ? data : {}),
      provider: normalizeProviderMap(data?.provider),
      disabled_providers: Array.isArray(data?.disabled_providers) ? data.disabled_providers : [],
      plugin: Array.isArray(data?.plugin) ? data.plugin : [],
      instructions: Array.isArray(data?.instructions) ? data.instructions : [],
      watcher: isPlainObject(data?.watcher) ? data.watcher : { ignore: [] },
      compaction: isPlainObject(data?.compaction) ? data.compaction : { auto: false, prune: false },
      mcp: isPlainObject(data?.mcp) ? data.mcp : {},
    },
    errors: errors.map((error) => ({
      error: printParseErrorCode(error.error),
      offset: error.offset,
      length: error.length,
    })),
  };
}

function normalizeProviderMap(providerMap) {
  if (!isPlainObject(providerMap)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(providerMap).map(([providerId, providerValue]) => [
      providerId,
      {
        ...createEmptyProvider(),
        ...(isPlainObject(providerValue) ? providerValue : {}),
        options: isPlainObject(providerValue?.options) ? providerValue.options : {},
        models: isPlainObject(providerValue?.models) ? providerValue.models : {},
      },
    ]),
  );
}

export function getModelOptions(providerMap) {
  return Object.entries(normalizeProviderMap(providerMap)).flatMap(([providerId, providerValue]) =>
    Object.keys(providerValue.models || {}).map((modelId) => ({
      label: `${providerId}/${modelId}`,
      value: `${providerId}/${modelId}`,
    })),
  );
}

function validateModelReference(reference, providerMap, path, errors) {
  if (!reference) {
    return;
  }

  const [providerId, modelId] = reference.split('/');
  if (!providerId || !modelId) {
    errors.push({
      path,
      message: 'Model reference must use the format provider/model.',
    });
    return;
  }

  const provider = providerMap[providerId];
  if (!provider) {
    errors.push({
      path,
      message: `Provider "${providerId}" is not defined.`,
    });
    return;
  }

  if (!provider.models || !provider.models[modelId]) {
    errors.push({
      path,
      message: `Model "${modelId}" is not defined under provider "${providerId}".`,
    });
  }
}

function validatePermissionValue(value, path, errors, warnings) {
  if (typeof value === 'string') {
    if (!ALLOWED_PERMISSION_ACTIONS.has(value)) {
      errors.push({
        path,
        message: `Permission action "${value}" is invalid.`,
      });
    }
    return;
  }

  if (!isPlainObject(value)) {
    errors.push({
      path,
      message: 'Permission must be a string or rule object.',
    });
    return;
  }

  for (const [ruleKey, ruleValue] of Object.entries(value)) {
    if (ruleKey === '*' || ruleKey === 'bash' || ruleKey === 'edit') {
      validatePermissionGroup(ruleValue, `${path}.${ruleKey}`, errors, warnings);
      continue;
    }

    if (!ALLOWED_PERMISSION_ACTIONS.has(ruleValue)) {
      errors.push({
        path: `${path}.${ruleKey}`,
        message: `Permission action "${ruleValue}" is invalid.`,
      });
    }
  }
}

function validatePermissionGroup(groupValue, path, errors, warnings) {
  if (typeof groupValue === 'string') {
    validatePermissionValue(groupValue, path, errors, warnings);
    return;
  }

  if (!isPlainObject(groupValue)) {
    errors.push({
      path,
      message: 'Permission group must be a string or rule object.',
    });
    return;
  }

  const seenPatterns = new Set();

  for (const [pattern, action] of Object.entries(groupValue)) {
    const rulePath = `${path}.${pattern}`;
    if (!pattern.trim()) {
      errors.push({
        path: rulePath,
        message: 'Permission pattern cannot be empty.',
      });
    }

    if (seenPatterns.has(pattern)) {
      warnings.push({
        path,
        message: `Permission pattern "${pattern}" appears more than once.`,
      });
    }
    seenPatterns.add(pattern);

    if (!ALLOWED_PERMISSION_ACTIONS.has(action)) {
      errors.push({
        path: rulePath,
        message: `Permission action "${action}" is invalid.`,
      });
    }
  }
}

export function validateDraftConfig(draft) {
  const errors = [];
  const warnings = [];
  const providerMap = normalizeProviderMap(draft.provider);

  validateModelReference(draft.model, providerMap, 'model', errors);
  validateModelReference(draft.small_model, providerMap, 'small_model', errors);

  for (const providerId of draft.disabled_providers ?? []) {
    if (!providerMap[providerId]) {
      warnings.push({
        path: 'disabled_providers',
        message: `Disabled provider "${providerId}" is not defined.`,
      });
    }
  }

  validatePermissionValue(draft.permission, 'permission', errors, warnings);

  return {
    errors,
    warnings,
    infos: [],
  };
}

export function collectConfigReferences(value) {
  const references = [];
  walkConfigValue(value, references);
  return references;
}

function walkConfigValue(value, references) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(REFERENCE_PATTERN)) {
      references.push({
        kind: match[1],
        token: match[0],
        value: match[2],
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkConfigValue(item, references));
    return;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => walkConfigValue(item, references));
  }
}

export function stringifyConfig(draft) {
  return `${JSON.stringify(draft, null, 2)}\n`;
}
