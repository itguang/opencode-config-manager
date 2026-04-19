<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: string[];
  addLabel?: string;
  placeholder?: string;
}>(), {
  addLabel: '新增项',
  placeholder: '输入内容',
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const items = computed(() => props.modelValue || []);

function updateAt(index: number, value: string) {
  const next = [...items.value];
  next[index] = value;
  emit('update:modelValue', next);
}

function addItem() {
  emit('update:modelValue', [...items.value, '']);
}

function removeItem(index: number) {
  emit('update:modelValue', items.value.filter((_, itemIndex) => itemIndex !== index));
}
</script>

<template>
  <div class="string-list-editor">
    <div v-for="(item, index) in items" :key="`${index}-${item}`" class="string-list-row">
      <el-input
        :model-value="item"
        :placeholder="placeholder"
        @update:model-value="(value) => updateAt(index, value)"
      />
      <el-button text type="danger" @click="removeItem(index)">
        删除
      </el-button>
    </div>
    <el-button class="editor-add-button" plain @click="addItem">
      {{ addLabel }}
    </el-button>
  </div>
</template>
