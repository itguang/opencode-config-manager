<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import KeyValueEditor from '../components/KeyValueEditor.vue';
import StringListEditor from '../components/StringListEditor.vue';
import { useConfigManagerStore } from '../stores/config-manager.js';

const store = useConfigManagerStore();
const permissionMode = ref<'simple' | 'advanced'>('simple');
const runtimePanels = ref(['plugins', 'instructions']);

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
const draft = computed(() => activeEnvironment.value.draft);
const providerEntries = computed(() => store.providerEntries);
const selectedProvider = computed(() => store.selectedProvider);
const selectedModel = computed(() => store.selectedModel);
const mcpEntries = computed(() => store.mcpEntries);
const selectedMcp = computed(() => store.selectedMcp);

const modelOptions = computed(() => providerEntries.value.flatMap(([providerId, providerValue]) =>
  Object.keys(providerValue.models || {}).map((modelId) => ({
    label: `${providerId}/${modelId}`,
    value: `${providerId}/${modelId}`,
  })),
));

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
          <button v-for="item in store.environments" :key="item.id" class="sidebar-pill" :class="{ active: item.id === store.activeEnvironmentId }" @click="store.setActiveEnvironment(item.id)">
            <span>{{ item.name }}</span>
            <small>{{ item.isDirty ? '未应用' : '同步' }}</small>
          </button>
          <div class="sidebar-actions">
            <el-button plain size="small" @click="store.cloneActiveEnvironment">复制</el-button>
            <el-button plain size="small" type="danger" @click="removeEnvironment">删除</el-button>
          </div>
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
        <div>
          <h2>{{ activeEnvironment.name }}</h2>
          <p>Global config only. 最终生效结果仍可能被 project config、`OPENCODE_CONFIG` 或 remote config 覆盖。</p>
        </div>
        <div class="header-actions">
          <el-input v-model="activeEnvironment.sourcePath" class="path-input" placeholder="配置文件路径" />
          <div class="header-action-cluster">
            <div class="secondary-actions">
              <el-button plain class="header-tool-button" @click="reloadConfig">重新加载</el-button>
              <el-button plain class="header-tool-button" @click="validateConfig">验证</el-button>
              <el-button plain class="header-tool-button" @click="store.selectedSection = 'json'">查看 JSON</el-button>
            </div>
            <el-button type="primary" class="header-primary-button" @click="applyConfig">应用到文件</el-button>
          </div>
        </div>
      </header>

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
        </el-card>
      </section>

      <section v-else-if="store.selectedSection === 'providers'" class="section-grid columns-2">
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
              <label class="field compact-switch">
                <span>禁用 Provider</span>
                <el-switch :model-value="(draft.disabled_providers || []).includes(store.selectedProviderId)" @update:model-value="(value) => toggleProviderDisabled(store.selectedProviderId, value)" />
              </label>
            </div>

            <h4 class="block-title">Provider Options</h4>
            <KeyValueEditor v-model="selectedProviderOptions" />

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
                <h4 class="block-title">Model Options</h4>
                <KeyValueEditor v-model="selectedModelOptions" />
                <h4 class="block-title">Variants</h4>
                <KeyValueEditor v-model="selectedModelVariants" />
              </div>
            </div>
          </template>

          <el-empty v-else description="先新增一个 Provider" />
        </el-card>
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
            <label class="field">
              <span>默认动作 `*`</span>
              <el-radio-group :model-value="permissionRows.defaultAction" @update:model-value="(value) => { const normalized = normalizePermission(draft.permission); normalized['*'] = value; draft.permission = normalized; }">
                <el-radio-button value="allow">allow</el-radio-button>
                <el-radio-button value="ask">ask</el-radio-button>
                <el-radio-button value="deny">deny</el-radio-button>
              </el-radio-group>
            </label>

            <div v-for="scope in ['global', 'bash', 'edit']" :key="scope" class="rule-group">
              <div class="card-toolbar">
                <strong>{{ scope === 'global' ? 'Global Rules' : `${scope} Rules` }}</strong>
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
            </div>
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
            <div class="form-grid">
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
              <label class="field">
                <span>超时</span>
                <el-input-number v-model="selectedMcp.timeout" :min="1000" :step="1000" />
              </label>
            </div>

            <template v-if="selectedMcp.type === 'remote'">
              <label class="field">
                <span>URL</span>
                <el-input v-model="selectedMcp.url" placeholder="https://mcp.example.com/sse" />
              </label>
              <h4 class="block-title">Headers</h4>
              <KeyValueEditor v-model="selectedMcpHeaders" />
            </template>

            <template v-else>
              <h4 class="block-title">Command</h4>
              <StringListEditor v-model="selectedMcp.command" add-label="新增命令片段" placeholder="例如：npx" />
              <h4 class="block-title">Environment</h4>
              <KeyValueEditor v-model="selectedMcpEnvironment" />
            </template>
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
