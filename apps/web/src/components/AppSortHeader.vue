<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  /** The API sort value this column maps to — e.g. 'name', 'createdAt'. */
  field: string;
  /** Column label, already translated by the caller. */
  label: string;
  /** The field the list is currently sorted by; '' when unsorted. */
  activeField: string;
  activeOrder: 'asc' | 'desc';
}>();

const emit = defineEmits<{ sort: [string] }>();

const isActive = computed(() => props.activeField === props.field);

/** The one attribute a screen reader announces for a sortable column, and it
 *  belongs on the <th>, not on the button (Product rule 4). */
const ariaSort = computed(() => {
  if (!isActive.value) {
    return 'none';
  }

  return props.activeOrder === 'asc' ? 'ascending' : 'descending';
});
</script>

<template>
  <th scope="col" :aria-sort="ariaSort" class="sort-header">
    <button type="button" class="sort-header__button" @click="emit('sort', field)">
      <span>{{ label }}</span>
      <AppIcon
        v-if="isActive"
        :name="activeOrder === 'asc' ? 'sort-asc' : 'sort-desc'"
        :size="14"
        class="sort-header__icon"
      />
    </button>
  </th>
</template>

<style scoped>
.sort-header__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.sort-header__button:hover {
  color: var(--color-text);
}

.sort-header[aria-sort='ascending'] .sort-header__button,
.sort-header[aria-sort='descending'] .sort-header__button {
  color: var(--color-accent);
}
</style>
