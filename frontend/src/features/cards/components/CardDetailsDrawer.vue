<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { CardService } from '../services/card.service';
import { useCardContext } from '../composables/useCardContext';
import { useCards } from '../composables/useCards';
import { ToastService } from '@/shared/services/ToastService';
import { DialogService } from '@/shared/services/DialogService';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import dayjs from 'dayjs';
import {
  XMarkIcon,
  TrashIcon,
  ArchiveBoxIcon,
  PencilIcon,
} from '@heroicons/vue/24/outline';
import { DragDropService } from '../services/DragDropService';
import { useColumnStore } from '@/features/columns/stores/column.store';
import { useCardStore } from '../stores/card.store';


const props = defineProps<{
  boardId: string;
}>();

const router = useRouter();
const { resetDrawer } = useCards();
const { currentCard, drawerState } = useCardContext();

// Asynchronous dynamic component registration
const LabelSelector = defineAsyncComponent(() => import('@/features/labels/components/LabelSelector.vue'));
const ChecklistGroup = defineAsyncComponent(() => import('@/features/checklists/components/ChecklistGroup.vue'));
const CommentList = defineAsyncComponent(() => import('@/features/comments/components/CommentList.vue'));
const AttachmentList = defineAsyncComponent(() => import('@/features/attachments/components/AttachmentList.vue'));
const ActivityTimeline = defineAsyncComponent(() => import('@/features/activity/components/ActivityTimeline.vue'));
const LabelBadge = defineAsyncComponent(() => import('@/features/labels/components/LabelBadge.vue'));

const columnStore = useColumnStore();
const cardStore = useCardStore();
const columns = computed(() => columnStore.columns);

const isEditingDescription = ref(false);
const editedDescription = ref('');
const editedTitle = ref('');
const isEditingTitle = ref(false);

const card = computed(() => currentCard.value);

watch(card, (newCard) => {
  if (newCard) {
    editedDescription.value = newCard.description || '';
    editedTitle.value = newCard.title;
  }
}, { immediate: true });

const formattedDueDate = computed(() => {
  if (!card.value?.dueDate) return '';
  return dayjs(card.value.dueDate).format('YYYY-MM-DD');
});

const closeDrawer = () => {
  resetDrawer();
  router.push(`/boards/${props.boardId}`);
};

const handleUpdateTitle = async () => {
  if (!card.value || !editedTitle.value.trim() || editedTitle.value === card.value.title) {
    isEditingTitle.value = false;
    return;
  }

  try {
    await CardService.updateCard(card.value.id, { title: editedTitle.value.trim() });
    isEditingTitle.value = false;
    ToastService.success('Title updated.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update title.');
  }
};

const handleSaveDescription = async () => {
  if (!card.value) return;
  try {
    await CardService.updateCard(card.value.id, { description: editedDescription.value });
    isEditingDescription.value = false;
    ToastService.success('Description updated.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update description.');
  }
};

const handleUpdatePriority = async (event: Event) => {
  if (!card.value) return;
  const newPriority = (event.target as HTMLSelectElement).value as any;
  try {
    await CardService.updateCard(card.value.id, { priority: newPriority });
    ToastService.success('Priority updated.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update priority.');
  }
};

const handleUpdateColumn = async (event: Event) => {
  if (!card.value) return;
  const newColumnId = (event.target as HTMLSelectElement).value;
  const oldColumnId = card.value.columnId;
  if (newColumnId === oldColumnId) return;

  const sourceList = cardStore.cardsByColumn[oldColumnId] || [];
  const fromIndex = sourceList.findIndex(c => c.id === card.value!.id);
  const destList = cardStore.cardsByColumn[newColumnId] || [];
  const toIndex = destList.length;

  try {
    await DragDropService.moveCard(card.value.id, oldColumnId, newColumnId, fromIndex, toIndex);
    if (cardStore.currentCard) {
      cardStore.currentCard.columnId = newColumnId;
    }
    ToastService.success('Card moved to column.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to move card.');
  }
};

const handleUpdateDueDate = async (event: Event) => {
  if (!card.value) return;
  const newDate = (event.target as HTMLInputElement).value;
  try {
    await CardService.updateCard(card.value.id, {
      dueDate: newDate ? new Date(newDate).toISOString() : null,
    });
    ToastService.success('Due date updated.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update due date.');
  }
};

const handleArchive = async () => {
  if (!card.value) return;
  try {
    await CardService.updateCard(card.value.id, { isArchived: true });
    ToastService.success('Card archived.');
    closeDrawer();
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to archive card.');
  }
};

const handleDelete = async () => {
  if (!card.value) return;
  const confirmed = await DialogService.confirm({
    title: 'Delete Card',
    message: 'Are you sure you want to permanently delete this card?',
    confirmText: 'Delete Card',
    cancelText: 'Cancel',
    severity: 'danger',
  });
  if (!confirmed) return;
  try {
    await CardService.deleteCard(card.value.id, card.value.columnId);
    ToastService.success('Card deleted.');
    closeDrawer();
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to delete card.');
  }
};
</script>

<template>
  <div
    v-if="drawerState.isOpen"
    class="fixed inset-0 z-50 flex justify-end select-none"
    role="dialog"
    aria-modal="true"
  >
    <!-- Backdrop Overlay -->
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
      @click="closeDrawer"
    ></div>

    <!-- Panel Slider Drawer Container -->
    <div class="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300">
      <!-- Loading State Overlay -->
      <div
        v-if="!card"
        class="absolute inset-0 bg-white/80 flex items-center justify-center z-20"
      >
        <BaseSpinner size="md" message="Loading details..." />
      </div>

      <!-- Header Controls -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-150">
        <span class="text-xs font-semibold text-brand-600 tracking-wide uppercase">
          Card details
        </span>
        <button
          type="button"
          @click="closeDrawer"
          class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Close details"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <!-- Main Scrollable Body Viewport -->
      <div v-if="card" class="flex-1 overflow-y-auto p-6">
        <!-- Title Editor -->
        <div class="mb-6">
          <form v-if="isEditingTitle" @submit.prevent="handleUpdateTitle" class="flex items-center space-x-2">
            <input
              v-model="editedTitle"
              type="text"
              @blur="handleUpdateTitle"
              @keydown.esc="isEditingTitle = false"
              class="w-full text-lg font-bold text-gray-900 border border-brand-500 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              aria-label="Edit card title"
            />
          </form>
          <div v-else class="flex items-start justify-between group/title">
            <h3
              @click="isEditingTitle = true"
              class="text-lg font-bold text-gray-900 cursor-pointer hover:bg-gray-150 px-2 py-1 rounded-lg transition-colors flex-1 break-words"
              title="Click to edit title"
            >
              {{ card.title }}
            </h3>
            <button
              type="button"
              @click="isEditingTitle = true"
              class="opacity-0 group-hover/title:opacity-100 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all focus:outline-none"
              aria-label="Edit title"
            >
              <PencilIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Left Column: Primary Feeds & Content -->
          <div class="md:col-span-2 space-y-6">
            <!-- Description Editor Area -->
            <div class="space-y-2">
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </h4>
              <div v-if="isEditingDescription" class="space-y-2">
                <textarea
                  v-model="editedDescription"
                  rows="4"
                  placeholder="Add details about this task..."
                  class="w-full text-sm text-gray-700 border border-brand-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                ></textarea>
                <div class="flex items-center space-x-2">
                  <BaseButton variant="primary" size="sm" @click="handleSaveDescription">
                    Save
                  </BaseButton>
                  <BaseButton variant="secondary" size="sm" @click="isEditingDescription = false">
                    Cancel
                  </BaseButton>
                </div>
              </div>
              <div v-else class="group/desc">
                <div
                  v-if="card.description"
                  @click="isEditingDescription = true"
                  class="text-sm text-gray-700 bg-gray-50/40 hover:bg-gray-50 border border-gray-200/30 p-3 rounded-xl cursor-pointer transition-colors break-words"
                >
                  {{ card.description }}
                </div>
                <div
                  v-else
                  @click="isEditingDescription = true"
                  class="text-sm text-gray-400 bg-gray-50/20 hover:bg-gray-50 border border-dashed border-gray-300 p-4 rounded-xl cursor-pointer text-center font-medium transition-colors"
                >
                  + Add a description
                </div>
              </div>
            </div>

            <!-- Checklists section -->
            <ChecklistGroup :card-id="card.id" />

            <!-- Attachments section -->
            <AttachmentList :card-id="card.id" />

            <!-- Comments section -->
            <CommentList :card-id="card.id" />

            <!-- Activity History section -->
            <ActivityTimeline :card-id="card.id" />
          </div>

          <!-- Right Column: Metadata & Sidebar Controls -->
          <div class="md:col-span-1 space-y-5">
            <!-- Attached Labels badges -->
            <div v-if="card.labels && card.labels.length" class="space-y-1.5">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Labels</span>
              <div class="flex flex-wrap gap-1">
                <LabelBadge
                  v-for="lbl in card.labels"
                  :key="lbl.id"
                  :name="lbl.name"
                  :color="lbl.color"
                  size="sm"
                />
              </div>
            </div>

            <!-- Priority and Due Date Selectors -->
            <div class="space-y-3 bg-gray-50/70 border border-gray-200/50 p-4 rounded-2xl">
              <!-- Column Selector -->
              <div class="flex flex-col space-y-1.5">
                <label for="column-select" class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Column
                </label>
                <select
                  id="column-select"
                  :value="card.columnId"
                  @change="handleUpdateColumn"
                  class="w-full text-xs font-bold text-gray-700 bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-shadow cursor-pointer"
                >
                  <option
                    v-for="col in columns"
                    :key="col.id"
                    :value="col.id"
                  >
                    {{ col.name }}
                  </option>
                </select>
              </div>

              <!-- Priority Selector -->
              <div class="flex flex-col space-y-1.5">
                <label for="priority-select" class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Priority
                </label>
                <select
                  id="priority-select"
                  :value="card.priority"
                  @change="handleUpdatePriority"
                  class="w-full text-xs font-bold text-gray-700 bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-shadow cursor-pointer"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <!-- Due Date Picker -->
              <div class="flex flex-col space-y-1.5">
                <label for="due-date-picker" class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Due Date
                </label>
                <div class="relative flex items-center">
                  <input
                    id="due-date-picker"
                    type="date"
                    :value="formattedDueDate"
                    @change="handleUpdateDueDate"
                    class="w-full text-xs font-bold text-gray-700 bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-shadow cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <!-- Labels management overlay -->
            <div class="border border-gray-200/60 p-4 rounded-2xl bg-white shadow-xs">
              <LabelSelector />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Control Panel -->
      <div v-if="card" class="bg-gray-50 border-t border-gray-150 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <BaseButton
            variant="secondary"
            size="sm"
            class="flex items-center space-x-1.5"
            @click="handleArchive"
          >
            <ArchiveBoxIcon class="h-4 w-4" />
            <span>Archive</span>
          </BaseButton>
          <BaseButton
            variant="danger"
            size="sm"
            class="flex items-center space-x-1.5"
            @click="handleDelete"
          >
            <TrashIcon class="h-4 w-4" />
            <span>Delete</span>
          </BaseButton>
        </div>
        <BaseButton variant="primary" size="sm" @click="closeDrawer">
          Done
        </BaseButton>
      </div>
    </div>
  </div>
</template>
