<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: Record<string, unknown>;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}>(), {
  keyPlaceholder: '键',
  valuePlaceholder: '值',
});

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
}>();

const rows = computed(() => Object.entries(props.modelValue || {}).map(([key, value]) => ({
  key,
  value: typeof value === 'string' ? value : JSON.stringify(value),
})));

function parseInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(trimmed) || /^[\[{"]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function emitNext(nextRows: Array<{ key: string; value: string }>) {
  const nextObject = {};
  for (const row of nextRows) {
    if (!row.key.trim()) {
      continue;
    }
    nextObject[row.key] = parseInput(row.value);
  }
  emit('update:modelValue', nextObject);
}

function updateRow(index: number, field: 'key' | 'value', value: string) {
  const nextRows = rows.value.map((row) => ({ ...row }));
  nextRows[index][field] = value;
  emitNext(nextRows);
}

function addRow() {
  emitNext([...rows.value, { key: '', value: '' }]);
}

function removeRow(index: number) {
  emitNext(rows.value.filter((_, itemIndex) => itemIndex !== index));
}
</script>

<template>
  <div class="key-value-editor">
    <div v-for="(row, index) in rows" :key="`${row.key}-${index}`" class="key-value-row">
      <el-input
        class="key-input"
        :model-value="row.key"
        :placeholder="keyPlaceholder"
        @update:model-value="(value) => updateRow(index, 'key', value)"
      />
      <el-input
        class="value-input"
        :model-value="row.value"
        :placeholder="valuePlaceholder"
        @update:model-value="(value) => updateRow(index, 'value', value)"
      />
      <el-button text type="danger" @click="removeRow(index)">
        删除
      </el-button>
    </div>
    <el-button class="editor-add-button" plain @click="addRow">
      新增字段
    </el-button>
  </div>
</template>
