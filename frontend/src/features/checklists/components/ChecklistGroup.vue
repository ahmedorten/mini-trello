<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useChecklists } from '../composables/useChecklists';
import ChecklistItemRow from './ChecklistItemRow.vue';
import ChecklistProgress from './ChecklistProgress.vue';
import { ToastService } from '@/shared/services/ToastService';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import { QueryState } from '@/core/api/contracts/QueryState';
import { ListBulletIcon, TrashIcon, PlusIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  cardId: string;
}>();

const {
  checklists,
  queryState,
  error,
  loadChecklists,
  createChecklist,
  editChecklist,
  deleteChecklist,
  addChecklistItem,
  editChecklistItem,
  removeChecklistItem,
} = useChecklists();

// Track add item forms
const activeAddItemChecklistId = ref<string | null>(null);
const newItemTitle = ref('');

// Track checklist renaming forms
const activeRenameChecklistId = ref<string | null>(null);
const renameTitle = ref('');

// Track add checklist form
const showAddChecklistForm = ref(false);
const newChecklistTitle = ref('');

const load = async () => {
  try {
    await loadChecklists(props.cardId);
  } catch (e: any) {
    console.error('Failed to load checklists:', e);
  }
};

onMounted(load);
watch(() => props.cardId, load);

const handleAddChecklist = async () => {
  const title = newChecklistTitle.value.trim();
  if (!title) return;
  try {
    await createChecklist(props.cardId, { title });
    newChecklistTitle.value = '';
    showAddChecklistForm.value = false;
    ToastService.success('Checklist created.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to create checklist.');
  }
};

const handleDeleteChecklist = async (checklistId: string) => {
  if (!confirm('Are you sure you want to delete this checklist?')) return;
  try {
    await deleteChecklist(props.cardId, checklistId);
    ToastService.success('Checklist deleted.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to delete checklist.');
  }
};

const handleRenameChecklist = async (checklistId: string) => {
  const title = renameTitle.value.trim();
  if (!title) return;
  try {
    await editChecklist(props.cardId, checklistId, { title });
    activeRenameChecklistId.value = null;
    ToastService.success('Checklist renamed.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to rename checklist.');
  }
};

const startRename = (id: string, currentTitle: string) => {
  renameTitle.value = currentTitle;
  activeRenameChecklistId.value = id;
};

const handleAddItem = async (checklistId: string) => {
  const title = newItemTitle.value.trim();
  if (!title) return;
  try {
    await addChecklistItem(props.cardId, checklistId, { title });
    newItemTitle.value = '';
    activeAddItemChecklistId.value = null;
    ToastService.success('Item added.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to add item.');
  }
};

const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
  try {
    await editChecklistItem(props.cardId, itemId, { isCompleted });
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update item.');
  }
};

const handleRenameItem = async (itemId: string, newTitle: string) => {
  try {
    await editChecklistItem(props.cardId, itemId, { title: newTitle });
    ToastService.success('Item renamed.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to rename item.');
  }
};

const handleDeleteItem = async (itemId: string) => {
  try {
    await removeChecklistItem(props.cardId, itemId);
    ToastService.success('Item deleted.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to delete item.');
  }
};

// Math helpers for progress bars
const getCompletedCount = (items: any[]) => items.filter(i => i.isCompleted).length;
const getTotalCount = (items: any[]) => items.length;
</script>

<template>
  <div class="space-y-6 select-none">
    <!-- Section Header & Add Checklist Button -->
    <div class="flex items-center justify-between border-b border-gray-100 pb-2">
      <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
        <ListBulletIcon class="h-4 w-4 text-gray-400" />
        <span>Checklists ({{ checklists.length }})</span>
      </h4>

      <button
        type="button"
        @click="showAddChecklistForm = !showAddChecklistForm"
        class="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-0.5 focus:outline-none"
      >
        <PlusIcon class="h-3.5 w-3.5" />
        <span>Add Checklist</span>
      </button>
    </div>

    <!-- Add Checklist Form Inline -->
    <div v-if="showAddChecklistForm" class="bg-gray-50 border border-gray-200/60 p-3.5 rounded-xl space-y-3">
      <div class="flex flex-col space-y-1">
        <label for="checklist-title" class="text-[10px] font-bold text-gray-400 uppercase">Checklist Title</label>
        <input
          id="checklist-title"
          v-model="newChecklistTitle"
          type="text"
          placeholder="Enter checklist title..."
          class="text-xs border border-gray-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
          @keydown.enter="handleAddChecklist"
        />
      </div>
      <div class="flex items-center space-x-1.5">
        <BaseButton variant="primary" size="sm" @click="handleAddChecklist">
          Add
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="showAddChecklistForm = false">
          Cancel
        </BaseButton>
      </div>
    </div>

    <div class="relative min-h-[50px]">
      <div v-if="queryState === QueryState.Loading && checklists.length === 0" class="flex items-center justify-center py-4">
        <BaseSpinner size="sm" message="Loading checklists..." />
      </div>

      <div v-else-if="queryState === QueryState.Error && checklists.length === 0" class="text-center py-4 text-xs text-red-600">
        {{ error }}
      </div>

      <div v-else class="space-y-6">
        <!-- Loop over checklists -->
        <div
          v-for="checklist in checklists"
          :key="checklist.id"
          class="bg-white border border-gray-150 rounded-2xl p-4 space-y-3.5 shadow-xs"
        >
          <!-- Checklist Header -->
          <div class="flex items-center justify-between group/header">
            <div class="flex-1 min-w-0 mr-4">
              <div v-if="activeRenameChecklistId === checklist.id" class="flex items-center space-x-2">
                <input
                  v-model="renameTitle"
                  type="text"
                  class="text-xs text-gray-800 font-bold border border-brand-500 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white w-full"
                  @keydown.enter="handleRenameChecklist(checklist.id)"
                  @keydown.escape="activeRenameChecklistId = null"
                />
                <button
                  type="button"
                  @click="handleRenameChecklist(checklist.id)"
                  class="p-1 hover:text-brand-600 transition-colors focus:outline-none"
                >
                  <CheckIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  @click="activeRenameChecklistId = null"
                  class="p-1 hover:text-gray-500 transition-colors focus:outline-none"
                >
                  <XMarkIcon class="h-3.5 w-3.5" />
                </button>
              </div>

              <div v-else class="flex items-center space-x-2">
                <h5 class="text-sm font-bold text-gray-800 truncate">
                  {{ checklist.title }}
                </h5>
                <button
                  type="button"
                  @click="startRename(checklist.id, checklist.title)"
                  class="text-gray-400 hover:text-brand-600 transition-colors p-0.5 opacity-0 group-hover/header:opacity-100 focus:outline-none"
                  title="Rename checklist"
                >
                  <PencilIcon class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              @click="handleDeleteChecklist(checklist.id)"
              class="text-gray-400 hover:text-red-600 transition-colors p-1 focus:outline-none flex-shrink-0"
              title="Delete checklist"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>

          <!-- Progress Bar -->
          <ChecklistProgress
            :completed="getCompletedCount(checklist.checklistItems)"
            :total="getTotalCount(checklist.checklistItems)"
          />

          <!-- Items list -->
          <div class="space-y-1.5 pl-1">
            <ChecklistItemRow
              v-for="item in checklist.checklistItems"
              :key="item.id"
              :item="item"
              @toggle="(status) => handleToggleItem(item.id, status)"
              @rename="(name) => handleRenameItem(item.id, name)"
              @delete="handleDeleteItem(item.id)"
            />
          </div>

          <!-- Add Item Form Inline -->
          <div class="pt-1 border-t border-gray-50">
            <div v-if="activeAddItemChecklistId === checklist.id" class="space-y-2">
              <input
                v-model="newItemTitle"
                type="text"
                placeholder="Add checklist task..."
                class="text-xs border border-gray-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white w-full"
                @keydown.enter="handleAddItem(checklist.id)"
              />
              <div class="flex items-center space-x-1.5">
                <BaseButton variant="primary" size="sm" @click="handleAddItem(checklist.id)">
                  Add Task
                </BaseButton>
                <BaseButton variant="secondary" size="sm" @click="activeAddItemChecklistId = null">
                  Cancel
                </BaseButton>
              </div>
            </div>

            <button
              v-else
              type="button"
              @click="activeAddItemChecklistId = checklist.id; newItemTitle = ''"
              class="text-xs text-gray-400 hover:text-brand-600 font-semibold flex items-center space-x-1 py-1 focus:outline-none"
            >
              <PlusIcon class="h-3.5 w-3.5" />
              <span>Add an item</span>
            </button>
          </div>
        </div>

        <div v-if="checklists.length === 0" class="text-center py-6 border border-dashed border-gray-150 rounded-xl bg-gray-50/50">
          <p class="text-[11px] text-gray-400">No checklists created yet.</p>
        </div>
      </div>
    </div>
  </div>
</template>
