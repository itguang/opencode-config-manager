import { defineStore } from 'pinia';

import {
  collectConfigReferences,
  createEmptyDraftConfig,
  parseConfigText,
  stringifyConfig,
  validateDraftConfig,
} from '../lib/opencode-config.js';
import { normalizePreferencesForStorage } from '../lib/config-manager-preferences.js';

const STORAGE_KEY = 'opencode-config-manager.preferences';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEnvironment(name = 'Global Draft') {
  const draft = createEmptyDraftConfig();
  const rawText = stringifyConfig(draft);

  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    sourcePath: '',
    draft,
    rawText,
    jsonText: rawText,
    isDirty: false,
    parseErrors: [],
    validation: {
      errors: [],
      warnings: [],
      infos: [],
    },
    lastLoadedAt: '',
    lastAppliedAt: '',
  };
}

export const useConfigManagerStore = defineStore('config-manager', {
  state: () => ({
    selectedSection: 'overview',
    environments: [createEnvironment()],
    activeEnvironmentId: '',
    selectedProviderId: '',
    selectedModelId: '',
    selectedMcpId: '',
    providerCheckResult: null,
    mcpCheckResult: null,
    referenceStatuses: [],
    settings: {
      autoBackup: true,
      defaultPath: '',
      testTimeout: 5000,
    },
    suspendDraftWatch: false,
  }),

  getters: {
    activeEnvironment(state) {
      return state.environments.find((item) => item.id === state.activeEnvironmentId) || state.environments[0];
    },

    activeDraft() {
      return this.activeEnvironment?.draft || createEmptyDraftConfig();
    },

    providerEntries() {
      return Object.entries(this.activeDraft.provider || {});
    },

    selectedProvider() {
      return this.selectedProviderId ? this.activeDraft.provider?.[this.selectedProviderId] : null;
    },

    selectedModel() {
      if (!this.selectedProvider || !this.selectedModelId) {
        return null;
      }
      return this.selectedProvider.models?.[this.selectedModelId] || null;
    },

    mcpEntries() {
      return Object.entries(this.activeDraft.mcp || {});
    },

    selectedMcp() {
      return this.selectedMcpId ? this.activeDraft.mcp?.[this.selectedMcpId] || null : null;
    },

    referenceItems() {
      return collectConfigReferences(this.activeDraft);
    },

    currentJsonPreview() {
      return stringifyConfig(this.activeDraft);
    },
  },

  actions: {
    initialize() {
      this.activeEnvironmentId = this.environments[0].id;
      this.loadPreferences();
    },

    loadPreferences() {
      const stored = window.utools?.dbStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }

      this.settings = {
        ...this.settings,
        ...stored,
      };
    },

    persistPreferences() {
      const payload = normalizePreferencesForStorage(this.settings);
      window.utools?.dbStorage.setItem(STORAGE_KEY, payload);
    },

    createEnvironment(name) {
      const next = createEnvironment(name);
      next.sourcePath = this.settings.defaultPath || '';
      this.environments.push(next);
      this.activeEnvironmentId = next.id;
    },

    cloneActiveEnvironment() {
      const source = this.activeEnvironment;
      const next = cloneValue(source);
      next.id = Math.random().toString(36).slice(2, 10);
      next.name = `${source.name} Copy`;
      next.isDirty = true;
      this.environments.push(next);
      this.activeEnvironmentId = next.id;
    },

    removeEnvironment(id) {
      if (this.environments.length === 1) {
        return;
      }
      this.environments = this.environments.filter((item) => item.id !== id);
      if (this.activeEnvironmentId === id) {
        this.activeEnvironmentId = this.environments[0].id;
      }
    },

    renameEnvironment(id, name) {
      const environment = this.environments.find((item) => item.id === id);
      if (environment && name) {
        environment.name = name;
      }
    },

    setActiveEnvironment(id) {
      this.activeEnvironmentId = id;
      this.selectedProviderId = '';
      this.selectedModelId = '';
      this.selectedMcpId = '';
      this.providerCheckResult = null;
      this.mcpCheckResult = null;
    },

    setSelectedProvider(providerId) {
      this.selectedProviderId = providerId;
      this.selectedModelId = '';
      this.providerCheckResult = null;
    },

    setSelectedModel(modelId) {
      this.selectedModelId = modelId;
    },

    setSelectedMcp(mcpId) {
      this.selectedMcpId = mcpId;
      this.mcpCheckResult = null;
    },

    touchActiveDraft() {
      if (this.suspendDraftWatch || !this.activeEnvironment) {
        return;
      }
      this.activeEnvironment.isDirty = true;
      this.activeEnvironment.jsonText = this.currentJsonPreview;
      this.activeEnvironment.validation = validateDraftConfig(this.activeDraft);
    },

    async loadConfig(pathOverride) {
      const targetPath = pathOverride || this.activeEnvironment.sourcePath || this.settings.defaultPath || window.services.getDefaultOpencodeConfigPath();
      const response = await window.services.readOpencodeConfig({ path: targetPath });
      const parsed = response.exists ? parseConfigText(response.text) : { data: createEmptyDraftConfig(), errors: [] };
      const rawText = response.exists ? response.text : stringifyConfig(parsed.data);

      this.suspendDraftWatch = true;
      this.activeEnvironment.sourcePath = response.path;
      this.activeEnvironment.draft = parsed.data;
      this.activeEnvironment.rawText = rawText;
      this.activeEnvironment.jsonText = rawText;
      this.activeEnvironment.isDirty = false;
      this.activeEnvironment.parseErrors = parsed.errors;
      this.activeEnvironment.validation = validateDraftConfig(parsed.data);
      this.activeEnvironment.lastLoadedAt = new Date().toISOString();
      this.suspendDraftWatch = false;

      this.settings.defaultPath = response.path;
      this.persistPreferences();

      const providerIds = Object.keys(this.activeDraft.provider || {});
      this.selectedProviderId = providerIds[0] || '';
      this.selectedModelId = '';
      this.selectedMcpId = Object.keys(this.activeDraft.mcp || {})[0] || '';

      return {
        exists: response.exists,
        path: response.path,
        parseErrors: parsed.errors,
      };
    },

    validateActive() {
      const result = validateDraftConfig(this.activeDraft);
      this.activeEnvironment.validation = result;
      this.activeEnvironment.parseErrors = [];
      return result;
    },

    async applyJsonToDraft() {
      const parsed = parseConfigText(this.activeEnvironment.jsonText);
      this.activeEnvironment.parseErrors = parsed.errors;
      if (parsed.errors.length) {
        return {
          ok: false,
          errors: parsed.errors,
        };
      }

      this.suspendDraftWatch = true;
      this.activeEnvironment.draft = parsed.data;
      this.activeEnvironment.rawText = this.activeEnvironment.jsonText;
      this.activeEnvironment.validation = validateDraftConfig(parsed.data);
      this.activeEnvironment.isDirty = true;
      this.suspendDraftWatch = false;
      return {
        ok: true,
      };
    },

    resetJsonFromDraft() {
      this.activeEnvironment.jsonText = this.currentJsonPreview;
      this.activeEnvironment.parseErrors = [];
    },

    async applyActive() {
      const validation = this.validateActive();
      if (validation.errors.length) {
        return {
          ok: false,
          reason: 'validation',
          validation,
        };
      }

      const content = stringifyConfig(this.activeDraft);
      const response = await window.services.writeOpencodeConfig({
        path: this.activeEnvironment.sourcePath || this.settings.defaultPath || window.services.getDefaultOpencodeConfigPath(),
        content,
        backup: this.settings.autoBackup,
      });

      this.suspendDraftWatch = true;
      this.activeEnvironment.sourcePath = response.path;
      this.activeEnvironment.rawText = content;
      this.activeEnvironment.jsonText = content;
      this.activeEnvironment.isDirty = false;
      this.activeEnvironment.lastAppliedAt = new Date().toISOString();
      this.suspendDraftWatch = false;

      this.settings.defaultPath = response.path;
      this.persistPreferences();

      return {
        ok: true,
        backupPath: response.backupPath,
        path: response.path,
      };
    },

    async refreshReferenceStatuses() {
      const rows = [];

      for (const reference of this.referenceItems) {
        if (reference.kind === 'env') {
          const status = await window.services.checkEnvironmentVariable({ name: reference.value });
          rows.push({
            ...reference,
            exists: status.exists,
          });
          continue;
        }

        const status = await window.services.checkPathExists({ path: reference.value });
        rows.push({
          ...reference,
          exists: status.exists,
        });
      }

      this.referenceStatuses = rows;
      return rows;
    },

    async checkSelectedProviderEndpoint() {
      const baseURL = this.selectedProvider?.options?.baseURL;
      this.providerCheckResult = await window.services.checkProviderEndpoint({
        baseURL,
        timeout: this.settings.testTimeout,
      });
      return this.providerCheckResult;
    },

    async checkSelectedMcpEndpoint() {
      const selectedMcp = this.selectedMcp;
      if (!selectedMcp) {
        return null;
      }

      if (selectedMcp.type === 'remote') {
        this.mcpCheckResult = await window.services.checkRemoteMcp({
          url: selectedMcp.url,
          headers: selectedMcp.headers,
          timeout: this.settings.testTimeout,
        });
      } else {
        this.mcpCheckResult = window.services.checkLocalCommandAvailable({
          command: selectedMcp.command,
        });
      }

      return this.mcpCheckResult;
    },
  },
});
