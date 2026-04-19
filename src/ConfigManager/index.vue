<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import KeyValueEditor from '../components/KeyValueEditor.vue';
import StringListEditor from '../components/StringListEditor.vue';
import { normalizeEnvironmentName } from '../lib/environment-name.js';
import { getModelOptions } from '../lib/opencode-config.js';
import { useConfigManagerStore } from '../stores/config-manager.js';

const store = useConfigManagerStore();
const permissionMode = ref<'simple' | 'advanced'>('simple');
const permissionPanels = ref<string[]>([]);
const runtimePanels = ref(['plugins', 'instructions']);
const providerPanels = ref(['provider-core', 'model-core']);
const mcpPanels = ref(['mcp-core']);
const editingEnvironmentId = ref('');
const editingEnvironmentName = ref('');

const sections = [
  { id: 'overview', label: '概览' },
  { id: 'providers', label: '模型与 Provider' },
  { id: 'permissions', label: '权限' },
  { id: 'mcp', label: 'MCP' },
  { id: 'runtime', label: '运行与扩展' },
  { id: 'references', label: '引用检查' },
  { id: 'json', label: '高级 JSON' },
  { id: 'settings', label: '设置' },
];

const activeEnvironment = computed(() => store.activeEnvironment);
const isEditingActiveEnvironment = computed(() => editingEnvironmentId.value === activeEnvironment.value.id);
const draft = computed(() => activeEnvironment.value.draft);
const providerEntries = computed(() => store.providerEntries);
const selectedProvider = computed(() => store.selectedProvider);
const selectedModel = computed(() => store.selectedModel);
const mcpEntries = computed(() => store.mcpEntries);
const selectedMcp = computed(() => store.selectedMcp);

const modelOptions = computed(() => getModelOptions(draft.value.provider));

const selectedProviderOptions = computed({
  get: () => selectedProvider.value?.options || {},
  set: (value) => {
    if (selectedProvider.value) {
      selectedProvider.value.options = value;
    }
  },
});

const selectedModelOptions = computed({
  get: () => selectedModel.value?.options || {},
  set: (value) => {
    if (selectedModel.value) {
      selectedModel.value.options = value;
    }
  },
});

const selectedModelVariants = computed({
  get: () => selectedModel.value?.variants || {},
  set: (value) => {
    if (selectedModel.value) {
      selectedModel.value.variants = value;
    }
  },
});

const selectedMcpHeaders = computed({
  get: () => selectedMcp.value?.headers || {},
  set: (value) => {
    if (selectedMcp.value) {
      selectedMcp.value.headers = value;
    }
  },
});

const selectedMcpEnvironment = computed({
  get: () => selectedMcp.value?.environment || {},
  set: (value) => {
    if (selectedMcp.value) {
      selectedMcp.value.environment = value;
    }
  },
});

const serverSettings = computed({
  get: () => draft.value.server || {},
  set: (value) => {
    draft.value.server = value;
  },
});

const providerApiKey = computed({
  get: () => String(selectedProvider.value?.options?.apiKey || ''),
  set: (value) => {
    if (!selectedProvider.value) return;
    selectedProvider.value.options = {
      ...selectedProvider.value.options,
      apiKey: value,
    };
  },
});

const providerBaseURL = computed({
  get: () => String(selectedProvider.value?.options?.baseURL || ''),
  set: (value) => {
    if (!selectedProvider.value) return;
    selectedProvider.value.options = {
      ...selectedProvider.value.options,
      baseURL: value,
    };
  },
});

const providerTimeout = computed({
  get: () => Number(selectedProvider.value?.options?.timeout || 5000),
  set: (value) => {
    if (!selectedProvider.value) return;
    selectedProvider.value.options = {
      ...selectedProvider.value.options,
      timeout: value,
    };
  },
});

const providerChunkTimeout = computed({
  get: () => Number(selectedProvider.value?.options?.chunkTimeout || 5000),
  set: (value) => {
    if (!selectedProvider.value) return;
    selectedProvider.value.options = {
      ...selectedProvider.value.options,
      chunkTimeout: value,
    };
  },
});

const providerSetCacheKey = computed({
  get: () => Boolean(selectedProvider.value?.options?.setCacheKey),
  set: (value) => {
    if (!selectedProvider.value) return;
    selectedProvider.value.options = {
      ...selectedProvider.value.options,
      setCacheKey: value,
    };
  },
});

const modelReasoningEffort = computed({
  get: () => String(selectedModel.value?.options?.reasoningEffort || ''),
  set: (value) => {
    if (!selectedModel.value) return;
    selectedModel.value.options = {
      ...selectedModel.value.options,
      reasoningEffort: value,
    };
  },
});

const modelTextVerbosity = computed({
  get: () => String(selectedModel.value?.options?.textVerbosity || ''),
  set: (value) => {
    if (!selectedModel.value) return;
    selectedModel.value.options = {
      ...selectedModel.value.options,
      textVerbosity: value,
    };
  },
});

const modelReasoningSummary = computed({
  get: () => String(selectedModel.value?.options?.reasoningSummary || ''),
  set: (value) => {
    if (!selectedModel.value) return;
    selectedModel.value.options = {
      ...selectedModel.value.options,
      reasoningSummary: value,
    };
  },
});

const remoteMcpUrl = computed({
  get: () => String(selectedMcp.value?.url || ''),
  set: (value) => {
    if (!selectedMcp.value) return;
    selectedMcp.value.url = value;
  },
});

const localMcpTimeout = computed({
  get: () => Number(selectedMcp.value?.timeout || store.settings.testTimeout),
  set: (value) => {
    if (!selectedMcp.value) return;
    selectedMcp.value.timeout = value;
  },
});

const overviewStatus = computed(() => {
  if (activeEnvironment.value.validation.errors.length) {
    return {
      tone: 'danger',
      title: '当前配置存在阻止应用的问题',
      description: `发现 ${activeEnvironment.value.validation.errors.length} 个错误，建议先修复再写回文件。`,
    };
  }

  if (activeEnvironment.value.validation.warnings.length) {
    return {
      tone: 'warning',
      title: '当前配置可用，但仍有风险提示',
      description: `发现 ${activeEnvironment.value.validation.warnings.length} 个警告，应用前建议复核。`,
    };
  }

  return {
    tone: 'success',
    title: '当前配置状态正常',
    description: '没有发现阻止应用的问题，可以继续测试或直接写回文件。',
  };
});

function resolveSectionFromPath(path: string) {
  if (!path) {
    return 'overview';
  }
  if (path.startsWith('permission')) {
    return 'permissions';
  }
  if (path.startsWith('mcp')) {
    return 'mcp';
  }
  if (['model', 'small_model', 'provider', 'disabled_providers'].some((token) => path.startsWith(token))) {
    return 'providers';
  }
  if (['plugin', 'instructions', 'server', 'watcher', 'compaction'].some((token) => path.startsWith(token))) {
    return 'runtime';
  }
  return 'overview';
}

const issueItems = computed(() => {
  const parseItems = activeEnvironment.value.parseErrors.map((item) => ({
    id: `parse-${item.offset}-${item.error}`,
    level: 'error',
    title: item.error,
    detail: `JSON 解析位置 offset ${item.offset}`,
    section: 'json',
  }));

  const errorItems = activeEnvironment.value.validation.errors.map((item, index) => ({
    id: `error-${index}-${item.path}`,
    level: 'error',
    title: item.path || '配置错误',
    detail: item.message,
    section: resolveSectionFromPath(item.path),
  }));

  const warningItems = activeEnvironment.value.validation.warnings.map((item, index) => ({
    id: `warning-${index}-${item.path}`,
    level: 'warning',
    title: item.path || '配置警告',
    detail: item.message,
    section: resolveSectionFromPath(item.path),
  }));

  return [...parseItems, ...errorItems, ...warningItems];
});

const nextStep = computed(() => {
  if (activeEnvironment.value.parseErrors.length) {
    return {
      section: 'json',
      tone: 'danger',
      title: '先修复 JSON 解析错误',
      description: `当前有 ${activeEnvironment.value.parseErrors.length} 处解析错误，修复后再继续编辑。`,
      actionLabel: '前往 JSON',
    };
  }

  if (activeEnvironment.value.validation.errors.length) {
    const firstErrorPath = activeEnvironment.value.validation.errors[0]?.path || '';
    return {
      section: resolveSectionFromPath(firstErrorPath),
      tone: 'danger',
      title: '优先处理阻止应用的错误',
      description: `首个错误位于 ${firstErrorPath || '当前配置'}，建议先修复这一项。`,
      actionLabel: '前往处理',
    };
  }

  if (activeEnvironment.value.isDirty) {
    return {
      section: activeEnvironment.value.validation.warnings.length ? 'overview' : 'overview',
      tone: activeEnvironment.value.validation.warnings.length ? 'warning' : 'success',
      title: activeEnvironment.value.validation.warnings.length ? '草稿可用，但建议先复核警告' : '草稿已准备好，可以直接写回文件',
      description: activeEnvironment.value.validation.warnings.length
        ? `当前草稿有 ${activeEnvironment.value.validation.warnings.length} 个警告。`
        : '当前草稿没有错误，可以直接应用到配置文件。',
      actionLabel: '查看概览',
    };
  }

  return {
    section: 'providers',
    tone: 'neutral',
    title: '从核心配置开始维护',
    description: '建议优先检查 Provider、默认模型和权限规则，保持主链路可用。',
    actionLabel: '前往核心配置',
  };
});

function notify(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') {
  ElMessage({ message, type, plain: true });
  window.utools?.showNotification(message);
}

function normalizePermission(permission: unknown) {
  if (typeof permission === 'string') {
    return { '*': permission, bash: {}, edit: {} } as Record<string, unknown>;
  }

  return {
    '*': typeof permission?.['*'] === 'string' ? permission['*'] : 'ask',
    bash: typeof permission?.bash === 'object' && permission?.bash ? permission.bash : {},
    edit: typeof permission?.edit === 'object' && permission?.edit ? permission.edit : {},
    ...Object.fromEntries(Object.entries((permission || {}) as Record<string, unknown>).filter(([key]) => !['*', 'bash', 'edit'].includes(key))),
  };
}

const simplePermission = computed({
  get: () => typeof draft.value.permission === 'string' ? draft.value.permission : String(normalizePermission(draft.value.permission)['*']),
  set: (value) => {
    draft.value.permission = value;
  },
});

const permissionRows = computed(() => {
  const normalized = normalizePermission(draft.value.permission);
  return {
    global: Object.entries(normalized).filter(([key]) => !['*', 'bash', 'edit'].includes(key)).map(([pattern, action]) => ({ pattern, action: String(action) })),
    bash: Object.entries(normalized.bash as Record<string, unknown>).map(([pattern, action]) => ({ pattern, action: String(action) })),
    edit: Object.entries(normalized.edit as Record<string, unknown>).map(([pattern, action]) => ({ pattern, action: String(action) })),
    defaultAction: String(normalized['*']),
  };
});

function writePermissionRows(scope: 'global' | 'bash' | 'edit', rows: Array<{ pattern: string; action: string }>) {
  const normalized = normalizePermission(draft.value.permission);
  const next = {
    '*': normalized['*'],
    bash: scope === 'bash' ? Object.fromEntries(rows.filter((row) => row.pattern.trim()).map((row) => [row.pattern, row.action])) : normalized.bash,
    edit: scope === 'edit' ? Object.fromEntries(rows.filter((row) => row.pattern.trim()).map((row) => [row.pattern, row.action])) : normalized.edit,
  } as Record<string, unknown>;

  for (const [key, value] of Object.entries(normalized)) {
    if (!['*', 'bash', 'edit'].includes(key) && scope !== 'global') {
      next[key] = value;
    }
  }
  if (scope === 'global') {
    for (const row of rows) {
      if (row.pattern.trim()) {
        next[row.pattern] = row.action;
      }
    }
  }

  draft.value.permission = next;
}

function mutatePermissionRow(scope: 'global' | 'bash' | 'edit', index: number, field: 'pattern' | 'action', value: string) {
  const rows = [...permissionRows.value[scope]];
  rows[index][field] = value;
  writePermissionRows(scope, rows);
}

function addPermissionRow(scope: 'global' | 'bash' | 'edit') {
  writePermissionRows(scope, [...permissionRows.value[scope], { pattern: '', action: 'ask' }]);
}

function removePermissionRow(scope: 'global' | 'bash' | 'edit', index: number) {
  const rows = [...permissionRows.value[scope]];
  rows.splice(index, 1);
  writePermissionRows(scope, rows);
}

function movePermissionRow(scope: 'global' | 'bash' | 'edit', index: number, direction: -1 | 1) {
  const rows = [...permissionRows.value[scope]];
  const target = index + direction;
  if (target < 0 || target >= rows.length) {
    return;
  }
  const [item] = rows.splice(index, 1);
  rows.splice(target, 0, item);
  writePermissionRows(scope, rows);
}

function switchPermissionMode(mode: 'simple' | 'advanced') {
  permissionMode.value = mode;
  draft.value.permission = mode === 'simple'
    ? simplePermission.value
    : normalizePermission(draft.value.permission);
}

watch(() => activeEnvironment.value.draft, () => store.touchActiveDraft(), { deep: true });
watch(() => activeEnvironment.value.id, () => { permissionMode.value = typeof draft.value.permission === 'string' ? 'simple' : 'advanced'; }, { immediate: true });

onMounted(async () => {
  store.initialize();
  const result = await store.loadConfig();
  notify(result.exists ? `已加载配置：${result.path}` : `未找到配置文件，已建立空白草稿：${result.path}`, result.exists ? 'success' : 'warning');
  await store.refreshReferenceStatuses();
});

async function reloadConfig() {
  const result = await store.loadConfig(activeEnvironment.value.sourcePath);
  notify(result.exists ? `已重新加载：${result.path}` : `目标文件不存在：${result.path}`, result.exists ? 'success' : 'warning');
  await store.refreshReferenceStatuses();
}

async function validateConfig() {
  const result = store.validateActive();
  await store.refreshReferenceStatuses();
  if (result.errors.length) {
    notify(`校验失败：${result.errors.length} 个错误`, 'error');
  } else if (result.warnings.length) {
    notify(`校验通过：${result.warnings.length} 个警告`, 'warning');
  } else {
    notify('配置校验通过', 'success');
  }
}

async function applyConfig() {
  const result = await store.applyActive();
  if (!result.ok) {
    notify(`应用失败：${result.validation.errors.length} 个错误`, 'error');
    return;
  }
  notify(`已应用到 ${result.path}${result.backupPath ? `，备份：${result.backupPath}` : ''}`, 'success');
}

async function addEnvironment() {
  const { value } = await ElMessageBox.prompt('输入环境名称', '新增环境', { inputPlaceholder: '例如：Daily' });
  store.createEnvironment(value);
}

function startEnvironmentRename(environmentId: string, currentName: string, targetArea: 'sidebar' | 'header' = 'sidebar') {
  editingEnvironmentId.value = environmentId;
  editingEnvironmentName.value = currentName;

  nextTick(() => {
    const selector = targetArea === 'header'
      ? `[data-environment-header-input="${environmentId}"] input`
      : `[data-environment-input="${environmentId}"] input`;
    const target = document.querySelector<HTMLInputElement>(selector)
      || document.querySelector<HTMLInputElement>(`[data-environment-header-input="${environmentId}"] input`)
      || document.querySelector<HTMLInputElement>(`[data-environment-input="${environmentId}"] input`);
    target?.focus();
    target?.select();
  });
}

function commitEnvironmentRename(environmentId: string, fallbackName: string) {
  if (editingEnvironmentId.value !== environmentId) {
    return;
  }

  const nextName = normalizeEnvironmentName(editingEnvironmentName.value, fallbackName);
  store.renameEnvironment(environmentId, nextName);
  editingEnvironmentId.value = '';
  editingEnvironmentName.value = '';
}

function cancelEnvironmentRename() {
  editingEnvironmentId.value = '';
  editingEnvironmentName.value = '';
}

async function removeEnvironment() {
  if (store.environments.length === 1) {
    notify('至少保留一个环境草稿', 'warning');
    return;
  }
  await ElMessageBox.confirm(`删除环境 "${activeEnvironment.value.name}"？`, '删除环境', { type: 'warning' });
  store.removeEnvironment(activeEnvironment.value.id);
}

async function addProvider() {
  const { value } = await ElMessageBox.prompt('输入 Provider ID', '新增 Provider', { inputPlaceholder: '例如：openai' });
  draft.value.provider[value] = { options: {}, models: {} };
  store.setSelectedProvider(value);
}

async function removeProvider() {
  if (!store.selectedProviderId) return;
  await ElMessageBox.confirm(`删除 Provider "${store.selectedProviderId}"？`, '删除 Provider', { type: 'warning' });
  delete draft.value.provider[store.selectedProviderId];
  draft.value.disabled_providers = (draft.value.disabled_providers || []).filter((item: string) => item !== store.selectedProviderId);
  store.setSelectedProvider(Object.keys(draft.value.provider || {})[0] || '');
}

function toggleProviderDisabled(providerId: string, value: boolean) {
  const next = new Set(draft.value.disabled_providers || []);
  value ? next.add(providerId) : next.delete(providerId);
  draft.value.disabled_providers = [...next];
}

async function addModel() {
  if (!selectedProvider.value) return;
  const { value } = await ElMessageBox.prompt('输入 Model ID', '新增 Model', { inputPlaceholder: '例如：gpt-5' });
  selectedProvider.value.models[value] = { options: {}, variants: {} };
  store.setSelectedModel(value);
}

async function removeModel() {
  if (!selectedProvider.value || !store.selectedModelId) return;
  await ElMessageBox.confirm(`删除 Model "${store.selectedModelId}"？`, '删除 Model', { type: 'warning' });
  delete selectedProvider.value.models[store.selectedModelId];
  store.setSelectedModel(Object.keys(selectedProvider.value.models || {})[0] || '');
}

async function addMcp() {
  const { value } = await ElMessageBox.prompt('输入 MCP 名称', '新增 MCP', { inputPlaceholder: '例如：log-mcp-server' });
  draft.value.mcp[value] = { type: 'remote', enabled: true, timeout: store.settings.testTimeout, url: '', headers: {} };
  store.setSelectedMcp(value);
}

async function removeMcp() {
  if (!store.selectedMcpId) return;
  await ElMessageBox.confirm(`删除 MCP "${store.selectedMcpId}"？`, '删除 MCP', { type: 'warning' });
  delete draft.value.mcp[store.selectedMcpId];
  store.setSelectedMcp(Object.keys(draft.value.mcp || {})[0] || '');
}

async function checkProvider() {
  const result = await store.checkSelectedProviderEndpoint();
  notify(result?.message || '未执行 Provider 检测', result?.ok ? 'success' : 'warning');
}

async function checkMcp() {
  const result = await store.checkSelectedMcpEndpoint();
  const ok = Boolean(result?.ok || result?.available);
  notify(result?.message || '未执行 MCP 检测', ok ? 'success' : 'warning');
}

async function refreshReferences() {
  await store.refreshReferenceStatuses();
  notify(`引用检查完成：${store.referenceStatuses.length} 项`, 'success');
}

async function applyJson() {
  const result = await store.applyJsonToDraft();
  notify(result.ok ? 'JSON 已同步回草稿' : `JSON 解析失败：${result.errors.length} 处错误`, result.ok ? 'success' : 'error');
}

function resetJson() {
  store.resetJsonFromDraft();
  notify('JSON 已从草稿重置');
}

function jumpToIssue(section: string) {
  store.selectedSection = section;
}

function jumpToNextStep() {
  store.selectedSection = nextStep.value.section;
}
</script>

<template>
  <div class="config-manager-shell">
    <aside class="workspace-sidebar">
      <div class="sidebar-scroll">
        <div class="sidebar-block">
          <div class="sidebar-title">
            <span>环境草稿</span>
            <el-button text @click="addEnvironment">新增</el-button>
          </div>
          <button
            v-for="item in store.environments"
            :key="item.id"
            class="sidebar-pill environment-pill"
            :class="{
              active: item.id === store.activeEnvironmentId && editingEnvironmentId !== item.id,
              editing: editingEnvironmentId === item.id,
            }"
            @click="store.setActiveEnvironment(item.id)"
          >
            <el-input
              v-if="editingEnvironmentId === item.id"
              :data-environment-input="item.id"
              v-model="editingEnvironmentName"
              class="environment-inline-input"
              size="small"
              @blur="commitEnvironmentRename(item.id, item.name)"
              @click.stop
              @keydown.enter.prevent="commitEnvironmentRename(item.id, item.name)"
              @keydown.esc.prevent="cancelEnvironmentRename"
            />
            <span v-else @dblclick.stop="startEnvironmentRename(item.id, item.name)">{{ item.name }}</span>
            <div class="environment-pill-meta">
              <small>{{ item.isDirty ? '未应用' : '同步' }}</small>
              <div class="environment-pill-actions" @click.stop>
                <el-button text size="small" class="environment-inline-button" @click="store.cloneActiveEnvironment">复制</el-button>
                <el-button
                  text
                  size="small"
                  class="environment-inline-button"
                  type="danger"
                  :disabled="store.environments.length === 1"
                  @click="removeEnvironment"
                >
                  删除
                </el-button>
              </div>
            </div>
          </button>
        </div>

        <div class="sidebar-block">
          <div class="sidebar-title"><span>配置域</span></div>
          <button v-for="item in sections" :key="item.id" class="sidebar-pill" :class="{ active: item.id === store.selectedSection }" @click="store.selectedSection = item.id">
            {{ item.label }}
          </button>
        </div>
      </div>
    </aside>

    <main class="workspace-main">
      <header class="workspace-header">
        <div class="header-title-block">
          <div class="header-title-row">
            <el-input
              v-if="isEditingActiveEnvironment"
              :data-environment-header-input="activeEnvironment.id"
              v-model="editingEnvironmentName"
              class="header-environment-input"
              size="large"
              @blur="commitEnvironmentRename(activeEnvironment.id, activeEnvironment.name)"
              @keydown.enter.prevent="commitEnvironmentRename(activeEnvironment.id, activeEnvironment.name)"
              @keydown.esc.prevent="cancelEnvironmentRename"
            />
            <h2 v-else>{{ activeEnvironment.name }}</h2>
            <button
              v-if="!isEditingActiveEnvironment"
              type="button"
              class="header-edit-button"
              aria-label="编辑环境名称"
              @click="startEnvironmentRename(activeEnvironment.id, activeEnvironment.name, 'header')"
            >
              <span class="header-edit-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M3 11.75V13h1.25l7.1-7.1-1.25-1.25L3 11.75Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"/>
                  <path d="M9.9 3.4 11.15 2.15a.9.9 0 0 1 1.27 0l1.43 1.43a.9.9 0 0 1 0 1.27L12.6 6.1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"/>
                </svg>
              </span>
            </button>
          </div>
          <p> 最终生效结果仍可能被 project config、`OPENCODE_CONFIG` 或 remote config 覆盖。</p>
        </div>
        <div class="header-actions">
          <div class="header-action-cluster">
            <el-button type="primary" class="header-primary-button" @click="applyConfig">应用到配置</el-button>
          </div>
        </div>
      </header>

      <section class="next-step-banner" :class="nextStep.tone">
        <div class="next-step-copy">
          <span class="next-step-kicker">推荐下一步</span>
          <strong>{{ nextStep.title }}</strong>
          <p>{{ nextStep.description }}</p>
        </div>
        <el-button plain class="next-step-button" @click="jumpToNextStep">
          {{ nextStep.actionLabel }}
        </el-button>
      </section>

      <section v-if="store.selectedSection === 'overview'" class="section-grid">
        <el-card class="hero-card" shadow="never">
          <template #header>概览</template>
          <div class="overview-hero">
            <div class="overview-hero-main" :class="overviewStatus.tone">
              <span class="overview-kicker">当前状态</span>
              <h3>{{ overviewStatus.title }}</h3>
              <p>{{ overviewStatus.description }}</p>
            </div>
            <div class="overview-hero-side">
              <div class="feedback-row overview-status-row">
                <strong>校验错误</strong>
                <span class="status-value danger">{{ activeEnvironment.validation.errors.length }}</span>
              </div>
              <div class="feedback-row overview-status-row">
                <strong>校验警告</strong>
                <span class="status-value warning">{{ activeEnvironment.validation.warnings.length }}</span>
              </div>
              <div class="feedback-row overview-status-row">
                <strong>最近应用</strong>
                <span class="status-value neutral">{{ activeEnvironment.lastAppliedAt ? '已执行' : '未执行' }}</span>
              </div>
            </div>
          </div>
          <div class="overview-meta">
            <div class="feedback-stack overview-detail-stack">
              <div class="feedback-row subtle-row">
                <strong>JSON 解析</strong>
                <span>{{ activeEnvironment.parseErrors.length ? `${activeEnvironment.parseErrors.length} 处错误` : '正常' }}</span>
              </div>
              <div class="feedback-row subtle-row">
                <strong>最近应用时间</strong>
                <span>{{ activeEnvironment.lastAppliedAt ? new Date(activeEnvironment.lastAppliedAt).toLocaleString() : '未执行' }}</span>
              </div>
              <div class="feedback-row subtle-row">
                <strong>当前路径</strong>
                <span>{{ activeEnvironment.sourcePath || '未设置' }}</span>
              </div>
            </div>
            <div class="hero-grid compact-hero-grid">
              <div class="hero-metric"><span>默认模型</span><strong>{{ draft.model || '未设置' }}</strong></div>
              <div class="hero-metric"><span>轻量模型</span><strong>{{ draft.small_model || '未设置' }}</strong></div>
              <div class="hero-metric"><span>Provider</span><strong>{{ providerEntries.length }}</strong></div>
              <div class="hero-metric"><span>MCP</span><strong>{{ mcpEntries.length }}</strong></div>
            </div>
          </div>
          <div class="overview-issues">
            <div class="card-toolbar compact-toolbar">
              <span>问题定位</span>
              <small v-if="issueItems.length">显示前 {{ Math.min(issueItems.length, 4) }} 项</small>
            </div>
            <div v-if="issueItems.length" class="issue-list">
              <div v-for="item in issueItems.slice(0, 4)" :key="item.id" class="issue-item" :class="item.level">
                <div class="issue-copy">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.detail }}</span>
                </div>
                <el-button plain size="small" class="issue-action" @click="jumpToIssue(item.section)">
                  前往处理
                </el-button>
              </div>
            </div>
            <div v-else class="feedback-row subtle-row">
              <strong>状态</strong>
              <span>当前没有待处理的问题。</span>
            </div>
          </div>
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'providers'" class="section-grid">
        <el-card shadow="never">
          <template #header>
            <div class="card-toolbar">
              <span>全局模型选择</span>
              <small>默认模型与轻量模型独立于 Provider 配置，统一从全部模型中选择。</small>
            </div>
          </template>
          <div class="form-grid two-columns-compact">
            <label class="field">
              <span>默认模型</span>
              <el-select v-model="draft.model" filterable allow-create default-first-option>
                <el-option v-for="item in modelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label class="field">
              <span>轻量模型</span>
              <el-select v-model="draft.small_model" filterable allow-create default-first-option>
                <el-option v-for="item in modelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
          </div>
        </el-card>

        <div class="columns-2 provider-page-grid">
          <el-card shadow="never">
            <template #header>
              <div class="card-toolbar"><span>Provider 列表</span><el-button text @click="addProvider">新增</el-button></div>
            </template>
            <button v-for="[providerId, providerValue] in providerEntries" :key="providerId" class="select-pill" :class="{ active: providerId === store.selectedProviderId }" @click="store.setSelectedProvider(providerId)">
              <strong>{{ providerId }}</strong>
              <small>{{ Object.keys(providerValue.models || {}).length }} models</small>
            </button>
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="card-toolbar">
                <span>{{ store.selectedProviderId || '未选择 Provider' }}</span>
                <div class="toolbar-actions">
                  <el-button plain :disabled="!store.selectedProviderId" @click="checkProvider">检测</el-button>
                  <el-button plain type="danger" :disabled="!store.selectedProviderId" @click="removeProvider">删除</el-button>
                </div>
              </div>
            </template>

            <template v-if="selectedProvider">
              <div class="form-grid">
                <label class="field compact-switch">
                  <span>禁用 Provider</span>
                  <el-switch :model-value="(draft.disabled_providers || []).includes(store.selectedProviderId)" @update:model-value="(value) => toggleProviderDisabled(store.selectedProviderId, value)" />
                </label>
              </div>

              <el-collapse v-model="providerPanels" class="runtime-collapse">
                <el-collapse-item name="provider-core" title="Provider 核心字段">
                  <div class="form-grid two-columns-compact">
                    <label class="field">
                      <span>API Key</span>
                      <el-input v-model="providerApiKey" type="password" show-password placeholder="{env:OPENAI_API_KEY}" />
                    </label>
                    <label class="field">
                      <span>Base URL</span>
                      <el-input v-model="providerBaseURL" placeholder="https://api.openai.com/v1" />
                    </label>
                    <label class="field">
                      <span>Timeout</span>
                      <el-input-number v-model="providerTimeout" :min="1000" :step="1000" />
                    </label>
                    <label class="field">
                      <span>Chunk Timeout</span>
                      <el-input-number v-model="providerChunkTimeout" :min="1000" :step="1000" />
                    </label>
                    <label class="field compact-switch">
                      <span>Set Cache Key</span>
                      <el-switch v-model="providerSetCacheKey" />
                    </label>
                  </div>
                </el-collapse-item>
                <el-collapse-item name="provider-advanced" title="Provider 高级选项">
                  <KeyValueEditor v-model="selectedProviderOptions" />
                </el-collapse-item>
              </el-collapse>

              <div class="card-toolbar sub-toolbar">
                <h4 class="block-title">Models</h4>
                <div class="toolbar-actions">
                  <el-button plain size="small" @click="addModel">新增 Model</el-button>
                  <el-button plain size="small" type="danger" :disabled="!store.selectedModelId" @click="removeModel">删除</el-button>
                </div>
              </div>

              <div class="columns-2 nested-grid">
                <div>
                  <button v-for="modelId in Object.keys(selectedProvider.models || {})" :key="modelId" class="select-pill" :class="{ active: modelId === store.selectedModelId }" @click="store.setSelectedModel(modelId)">
                    <strong>{{ modelId }}</strong>
                    <small>{{ `${store.selectedProviderId}/${modelId}` === draft.model || `${store.selectedProviderId}/${modelId}` === draft.small_model ? '已引用' : '未引用' }}</small>
                  </button>
                </div>
                <div v-if="selectedModel">
                  <el-collapse v-model="providerPanels" class="runtime-collapse">
                    <el-collapse-item name="model-core" title="Model 核心字段">
                      <div class="form-grid three-columns">
                        <label class="field">
                          <span>Reasoning Effort</span>
                          <el-input v-model="modelReasoningEffort" placeholder="low / medium / high" />
                        </label>
                        <label class="field">
                          <span>Text Verbosity</span>
                          <el-input v-model="modelTextVerbosity" placeholder="low / medium / high" />
                        </label>
                        <label class="field">
                          <span>Reasoning Summary</span>
                          <el-input v-model="modelReasoningSummary" placeholder="auto / detailed" />
                        </label>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item name="model-advanced" title="Model 高级选项">
                      <KeyValueEditor v-model="selectedModelOptions" />
                    </el-collapse-item>
                    <el-collapse-item name="model-variants" title="Variants">
                      <KeyValueEditor v-model="selectedModelVariants" />
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>
            </template>

            <el-empty v-else description="先新增一个 Provider" />
          </el-card>
        </div>
      </section>

      <section v-else-if="store.selectedSection === 'permissions'" class="section-grid">
        <el-card shadow="never">
          <template #header>
            <div class="card-toolbar">
              <span>Permission</span>
              <el-segmented :model-value="permissionMode" :options="[{ label: '简单模式', value: 'simple' }, { label: '高级模式', value: 'advanced' }]" @change="(value) => switchPermissionMode(value)" />
            </div>
          </template>

          <div v-if="permissionMode === 'simple'">
            <el-radio-group v-model="simplePermission">
              <el-radio-button value="allow">allow</el-radio-button>
              <el-radio-button value="ask">ask</el-radio-button>
              <el-radio-button value="deny">deny</el-radio-button>
            </el-radio-group>
          </div>

          <div v-else class="permission-stack">
            <el-collapse v-model="permissionPanels" class="runtime-collapse">
              <el-collapse-item
                v-for="scope in ['global', 'bash', 'edit']"
                :key="scope"
                :name="scope"
                :title="scope === 'global' ? 'Global Rules' : `${scope} Rules`"
              >
                <div class="card-toolbar compact-toolbar collapse-toolbar">
                  <span>{{ scope === 'global' ? '规则列表' : `${scope} 规则列表` }}</span>
                  <el-button text @click="addPermissionRow(scope)">新增规则</el-button>
                </div>
                <div v-for="(row, index) in permissionRows[scope]" :key="`${scope}-${index}-${row.pattern}`" class="rule-row">
                  <el-input :model-value="row.pattern" @update:model-value="(value) => mutatePermissionRow(scope, index, 'pattern', value)" />
                  <el-select :model-value="row.action" @update:model-value="(value) => mutatePermissionRow(scope, index, 'action', value)">
                    <el-option label="allow" value="allow" />
                    <el-option label="ask" value="ask" />
                    <el-option label="deny" value="deny" />
                  </el-select>
                  <el-button text @click="movePermissionRow(scope, index, -1)">上移</el-button>
                  <el-button text @click="movePermissionRow(scope, index, 1)">下移</el-button>
                  <el-button text type="danger" @click="removePermissionRow(scope, index)">删除</el-button>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'mcp'" class="section-grid columns-2">
        <el-card shadow="never">
          <template #header><div class="card-toolbar"><span>MCP 列表</span><el-button text @click="addMcp">新增</el-button></div></template>
          <button v-for="[mcpId, mcpValue] in mcpEntries" :key="mcpId" class="select-pill" :class="{ active: mcpId === store.selectedMcpId }" @click="store.setSelectedMcp(mcpId)">
            <strong>{{ mcpId }}</strong>
            <small>{{ mcpValue.type || 'remote' }}</small>
          </button>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="card-toolbar">
              <span>{{ store.selectedMcpId || '未选择 MCP' }}</span>
              <div class="toolbar-actions">
                <el-button plain :disabled="!store.selectedMcpId" @click="checkMcp">检测</el-button>
                <el-button plain type="danger" :disabled="!store.selectedMcpId" @click="removeMcp">删除</el-button>
              </div>
            </div>
          </template>

          <template v-if="selectedMcp">
            <div class="form-grid two-columns-compact">
              <label class="field">
                <span>类型</span>
                <el-select v-model="selectedMcp.type">
                  <el-option label="remote" value="remote" />
                  <el-option label="local" value="local" />
                </el-select>
              </label>
              <label class="field compact-switch">
                <span>启用</span>
                <el-switch v-model="selectedMcp.enabled" />
              </label>
            </div>

            <el-collapse v-model="mcpPanels" class="runtime-collapse">
              <el-collapse-item name="mcp-core" title="MCP 核心字段">
                <template v-if="selectedMcp.type === 'remote'">
                  <label class="field">
                    <span>URL</span>
                    <el-input v-model="remoteMcpUrl" placeholder="https://mcp.example.com/sse" />
                  </label>
                </template>

                <template v-else>
                  <h4 class="block-title compact-title">Command</h4>
                  <StringListEditor v-model="selectedMcp.command" add-label="新增命令片段" placeholder="例如：npx" />
                </template>
              </el-collapse-item>

              <el-collapse-item v-if="selectedMcp.type === 'remote'" name="mcp-headers" title="Remote Headers">
                <KeyValueEditor v-model="selectedMcpHeaders" />
              </el-collapse-item>

              <el-collapse-item v-else name="mcp-environment" title="Local Environment">
                <KeyValueEditor v-model="selectedMcpEnvironment" />
              </el-collapse-item>

              <el-collapse-item name="mcp-advanced" title="高级字段">
                <div class="form-grid two-columns-compact">
                  <label class="field">
                    <span>Timeout</span>
                    <el-input-number v-model="localMcpTimeout" :min="1000" :step="1000" />
                  </label>
                  <label class="field compact-switch">
                    <span>启用</span>
                    <el-switch v-model="selectedMcp.enabled" />
                  </label>
                </div>
              </el-collapse-item>
            </el-collapse>
          </template>

          <el-empty v-else description="先新增一个 MCP" />
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'runtime'" class="section-grid">
        <el-card shadow="never">
          <template #header>运行与扩展</template>
          <el-collapse v-model="runtimePanels" class="runtime-collapse">
            <el-collapse-item name="plugins" title="Plugins">
              <StringListEditor v-model="draft.plugin" add-label="新增 Plugin" placeholder="例如：opencode-plugin-foo" />
            </el-collapse-item>
            <el-collapse-item name="instructions" title="Instructions">
              <StringListEditor v-model="draft.instructions" add-label="新增路径" placeholder="例如：{file:~/.config/opencode/AGENTS.md}" />
            </el-collapse-item>
            <el-collapse-item name="compaction" title="Compaction 与 Disabled Providers">
              <div class="form-grid">
                <label class="field compact-switch"><span>Compaction Auto</span><el-switch v-model="draft.compaction.auto" /></label>
                <label class="field compact-switch"><span>Compaction Prune</span><el-switch v-model="draft.compaction.prune" /></label>
                <label class="field">
                  <span>Disabled Providers</span>
                  <el-select v-model="draft.disabled_providers" multiple collapse-tags>
                    <el-option v-for="[providerId] in providerEntries" :key="providerId" :label="providerId" :value="providerId" />
                  </el-select>
                </label>
              </div>
            </el-collapse-item>
            <el-collapse-item name="server" title="Server">
              <KeyValueEditor v-model="serverSettings" />
            </el-collapse-item>
            <el-collapse-item name="watcher" title="Watcher Ignore">
              <StringListEditor v-model="draft.watcher.ignore" add-label="新增忽略项" placeholder="例如：dist/**" />
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'references'" class="section-grid">
        <el-card shadow="never">
          <template #header><div class="card-toolbar"><span>引用检查</span><el-button plain @click="refreshReferences">刷新</el-button></div></template>
          <el-table :data="store.referenceStatuses" stripe>
            <el-table-column prop="kind" label="类型" width="90" />
            <el-table-column prop="token" label="占位符" min-width="240" />
            <el-table-column prop="value" label="目标" min-width="220" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.exists ? 'success' : 'warning'">{{ row.exists ? '存在' : '缺失' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'json'" class="section-grid">
        <el-card shadow="never">
          <template #header><div class="card-toolbar"><span>高级 JSON / JSONC</span><div class="toolbar-actions"><el-button plain @click="resetJson">重置</el-button><el-button type="primary" @click="applyJson">应用 JSON</el-button></div></div></template>
          <el-input v-model="activeEnvironment.jsonText" type="textarea" :rows="22" resize="none" />
          <div class="columns-2 nested-grid">
            <div>
              <h4 class="block-title">解析状态</h4>
              <div v-if="activeEnvironment.parseErrors.length" class="feedback-stack">
                <div v-for="item in activeEnvironment.parseErrors" :key="`${item.offset}-${item.error}`" class="feedback-row">
                  <strong>{{ item.error }}</strong>
                  <span>offset: {{ item.offset }}</span>
                </div>
              </div>
              <div v-else class="feedback-row"><strong>正常</strong><span>当前文本可解析</span></div>
            </div>
            <div>
              <h4 class="block-title">草稿预览</h4>
              <pre class="json-preview">{{ store.currentJsonPreview }}</pre>
            </div>
          </div>
        </el-card>
      </section>

      <section v-else class="section-grid">
        <el-card shadow="never">
          <template #header>设置</template>
          <div class="form-grid">
            <label class="field">
              <span>默认配置路径</span>
              <el-input v-model="store.settings.defaultPath" @blur="store.persistPreferences()" />
            </label>
            <label class="field compact-switch">
              <span>自动备份</span>
              <el-switch v-model="store.settings.autoBackup" @change="store.persistPreferences()" />
            </label>
            <label class="field">
              <span>检测超时(ms)</span>
              <el-input-number v-model="store.settings.testTimeout" :min="1000" :step="1000" @change="store.persistPreferences()" />
            </label>
          </div>
        </el-card>
      </section>
    </main>
  </div>
</template>
