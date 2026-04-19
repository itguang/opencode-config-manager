<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import ConfigManager from './ConfigManager/index.vue';

const route = ref('');
const enterAction = ref<Record<string, unknown>>({});

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    route.value = action.code;
    enterAction.value = action;
  });
  window.utools.onPluginOut(() => {
    route.value = '';
  });
});
</script>

<template>
  <ConfigManager v-if="route === 'config-manager'" :enter-action="enterAction" />
</template>
