<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board.store';
import { BoardService } from '../services/board.service';
import { useColumns } from '@/features/columns/composables/useColumns';
import { useModal } from '@/shared/composables/useModal';
import { QueryState } from '@/core/api/contracts/QueryState';
import { useI18n } from '@/shared/composables/useI18n';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import PageContainer from '@/shared/components/layout/PageContainer.vue';
import PageHeader from '@/shared/components/layout/PageHeader.vue';
import BaseIcon from '@/shared/components/base/BaseIcon.vue';
import { VueDraggable } from 'vue-draggable-plus';

import {
  EditBoardModal,
  DeleteBoardDialog,
} from '../components';
import {
  ColumnCard,
  ColumnSkeleton,
  CreateColumnModal,
  DeleteColumnDialog,
} from '@/features/columns/components';

import { useCards } from '@/features/cards/composables/useCards';
import { useCardDragDrop } from '@/features/cards/composables/useCardDragDrop';
import { useCardStore } from '@/features/cards/stores/card.store';
import { DragDropService } from '@/features/cards/services/DragDropService';
import {
  CardItem,
  CardDetailsDrawer,
  CreateCardModal,
} from '@/features/cards/components';

const route = useRoute();
const router = useRouter();
const boardId = route.params.id as string;

const boardStore = useBoardStore();
const cardStore = useCardStore();
const { t, locale } = useI18n();

const board = computed(() => boardStore.currentBoard);
const boardQueryState = computed(() => boardStore.queryState);
const boardError = computed(() => boardStore.error);

const { columns, queryState: columnQueryState, loadColumns, reorderColumnsLocally } = useColumns();
const { loadCardsForColumn, loadCardDetails } = useCards();
const { onDragStart, onDragMove, onDragEnd, isDragging } = useCardDragDrop();

// Writable computed list for vue-draggable-plus binding
const draggableColumns = computed({
  get: () => columns.value,
  set: (newVal) => reorderColumnsLocally(newVal),
});

// Watch columns to pre-initialize empty card lists dynamically (handles newly created columns)
watch(
  columns,
  (newCols) => {
    newCols.forEach((col) => {
      if (!cardStore.cardsByColumn[col.id]) {
        cardStore.cardsByColumn[col.id] = [];
      }
    });
  },
  { immediate: true, deep: true }
);

const dragAnnouncement = ref('');

const handleDragStart = (evt: any) => {
  onDragStart(evt);
  const cardTitle = DragDropService.draggedCard.value?.title || 'card';
  dragAnnouncement.value = `Picked up card "${cardTitle}".`;
};

const handleDragEnd = async (evt: any) => {
  const cardTitle = DragDropService.draggedCard.value?.title || 'card';
  const targetCol = columns.value.find(c => c.id === evt.to?.dataset?.columnId);
  await onDragEnd(evt);
  if (targetCol) {
    dragAnnouncement.value = `Moved card "${cardTitle}" to column "${targetCol.name}".`;
  }
};



// Modal Managers
const editBoardModal = useModal();
const deleteBoardModal = useModal();
const createColumnModal = useModal();
const deleteColumnModal = useModal();
const createCardModal = useModal();

const activeColumnIdForNewCard = ref('');

const openCreateCardModal = (columnId: string) => {
  activeColumnIdForNewCard.value = columnId;
  createCardModal.openModal();
};

// Route watcher to open Card details drawer automatically
watch(
  () => route.params.cardId,
  (cardId) => {
    if (cardId) {
      loadCardDetails(cardId as string).catch(() => {
        // Redirect back on invalid card details fetch
        router.push(`/boards/${boardId}`);
      });
    }
  },
  { immediate: true }
);

onMounted(async () => {
  try {
    await BoardService.fetchBoardDetails(boardId);
    await loadColumns(boardId);
    await Promise.all(columns.value.map((col) => loadCardsForColumn(col.id)));
  } catch (e) {
    console.error('Failed to load board details/columns/cards', e);
  }
});

</script>

<template>
  <PageContainer>
    <div class="flex flex-col h-full space-y-6">
      <!-- Page Subheader/Toolbar -->
      <PageHeader
        v-if="board"
        :title="board.name"
        :subtitle="board.description || undefined"
      >
        <template #breadcrumbs>
          <button
            @click="router.push('/boards')"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-650 transition-colors"
          >
            <BaseIcon name="arrow-left" size="xs" flip-rtl />
            <span>{{ t('sidebar.boards') }}</span>
          </button>
        </template>

        <template #actions>
          <div class="flex items-center gap-2">
            <BaseButton
              variant="secondary"
              size="sm"
              class="flex items-center gap-1.5"
              @click="editBoardModal.openModal"
              aria-label="Edit board name and description"
            >
              <BaseIcon name="pencil" size="xs" />
              <span>{{ t('boards.editBoard') }}</span>
            </BaseButton>
            <BaseButton
              variant="danger"
              size="sm"
              class="flex items-center gap-1.5"
              @click="deleteBoardModal.openModal"
              aria-label="Delete Board"
            >
              <BaseIcon name="trash" size="xs" />
              <span>{{ t('boards.deleteBoard') }}</span>
            </BaseButton>
            <BaseButton
              variant="primary"
              size="sm"
              class="flex items-center gap-1.5 shadow-sm"
              @click="createColumnModal.openModal"
              aria-label="Add new column"
            >
              <BaseIcon name="plus" size="xs" />
              <span>{{ t('columns.addColumn') }}</span>
            </BaseButton>
          </div>
        </template>
      </PageHeader>

      <!-- Active Kanban Board Content Viewport -->
      <div class="flex-1 min-h-0 relative">
        <!-- 1. Board Details Loading Spinner -->
        <div
          v-if="boardQueryState === QueryState.Loading"
          class="absolute inset-0 flex items-center justify-center"
        >
          <BaseSpinner size="lg" :message="t('common.loading')" />
        </div>

        <!-- 2. Board Loading Errors -->
        <div
          v-else-if="boardQueryState === QueryState.Error"
          class="p-6 text-center max-w-md mx-auto bg-red-50 border border-red-200 rounded-3xl mt-10"
          role="alert"
        >
          <p class="font-bold text-red-900">Failed to load board details</p>
          <p class="text-xs text-red-700 mt-2">{{ boardError }}</p>
          <BaseButton variant="secondary" size="sm" class="mt-4" @click="router.push('/boards')">
            {{ locale === 'en' ? 'Return to boards list' : 'الرجوع إلى قائمة اللوحات' }}
          </BaseButton>
        </div>

        <!-- 3. Render Columns Lane -->
        <div v-else-if="board" class="h-full flex flex-col">
          <!-- Columns Loading Skeletons -->
          <ColumnSkeleton v-if="columnQueryState === QueryState.Loading" />

          <!-- Main Horizontal Scroll Viewport -->
          <div
            v-else
            class="flex-1 overflow-x-auto overflow-y-hidden pb-4 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-2xl"
            tabindex="0"
            aria-label="Kanban board columns list"
          >
            <!-- Draggable columns list container -->
            <VueDraggable
              v-model="draggableColumns"
              class="flex gap-6 h-full items-start"
              handle=".column-drag-handle"
              :animation="150"
            >

              <div
                v-for="column in draggableColumns"
                :key="column.id"
                class="h-full"
              >
                <!-- Renders Column Card Wrapper -->
                <ColumnCard
                  :column="column"
                  @delete="deleteColumnModal.openModal(column)"
                  :class="{ 'is-drag-over': column.id === DragDropService.dragOverColumnId.value }"
                >
                  <!-- Tasks/Cards Slots -->
                  <VueDraggable
                    v-model="cardStore.cardsByColumn[column.id]"
                    :group="{ name: 'cards', pull: true, put: true }"
                    class="flex-1 space-y-2 pb-8 h-full min-h-[150px]"
                    :animation="150"
                    ghostClass="ghost-card"
                    dragClass="drag-card"
                    handle=".card-drag-handle"
                    :scroll="true"
                    :scrollSensitivity="80"
                    :scrollSpeed="20"
                    :delay="150"
                    :delayOnTouchOnly="true"
                    :touchStartThreshold="5"
                    :data-column-id="column.id"
                    @start="handleDragStart"
                    @move="onDragMove"
                    @end="handleDragEnd"
                  >
                    <CardItem
                      v-for="card in (cardStore.cardsByColumn[column.id] || [])"
                      :key="card.id"
                      :card="card"
                      @click="router.push(`/boards/${boardId}/cards/${card.id}`)"
                    />
                  </VueDraggable>

                  <!-- Empty state fallback inside the draggable bounds -->
                  <div
                    v-if="!(cardStore.cardsByColumn[column.id] && cardStore.cardsByColumn[column.id].length)"
                    class="text-center py-6 text-xs select-none pointer-events-none transition-all duration-200 rounded-xl border border-dashed flex flex-col items-center justify-center min-h-[100px]"
                    :class="isDragging 
                      ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 scale-[0.98]' 
                      : 'border-transparent text-gray-400/50'"
                  >
                    <BaseIcon name="arrow-down-tray" size="sm" class="mb-1.5 transition-transform" :class="isDragging ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'" />
                    <span>{{ t('columns.dragPlaceholder') }}</span>
                  </div>

                  <template #footer>
                    <button
                      type="button"
                      class="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-gray-350 dark:border-gray-800 hover:border-indigo-500 text-gray-400 hover:text-indigo-650 text-xs font-semibold rounded-xl bg-white/30 hover:bg-white dark:bg-gray-900/35 dark:hover:bg-gray-900 transition-all focus:outline-none"
                      @click="openCreateCardModal(column.id)"
                    >
                      <BaseIcon name="plus" size="xs" />
                      <span>{{ t('cards.addCard') }}</span>
                    </button>
                  </template>
                </ColumnCard>
              </div>

              <!-- Empty Columns Lane Trigger -->
              <div
                v-if="columns.length === 0"
                class="flex flex-col items-center justify-center p-6 border border-dashed border-gray-250 dark:border-gray-800 rounded-2xl w-72 text-center h-[180px] bg-white dark:bg-gray-900 shrink-0"
              >
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ locale === 'en' ? 'No columns yet' : 'لا توجد أعمدة بعد' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px]">
                  {{ locale === 'en' ? 'Create columns to distribute your project workflow steps.' : 'قم بإنشاء أعمدة لتوزيع خطوات سير عمل مشروعك.' }}
                </p>
                <BaseButton
                  size="sm"
                  class="mt-4 flex items-center gap-1.5"
                  @click="createColumnModal.openModal"
                >
                  <BaseIcon name="plus" size="xs" />
                  <span>{{ t('columns.addColumn') }}</span>
                </BaseButton>
              </div>
            </VueDraggable>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals declarations -->
    <EditBoardModal
      v-if="board"
      :show="editBoardModal.isOpen.value"
      :board="board"
      @close="editBoardModal.closeModal"
    />

    <DeleteBoardDialog
      v-if="board"
      :show="deleteBoardModal.isOpen.value"
      :board="board"
      @close="deleteBoardModal.closeModal"
    />

    <CreateColumnModal
      :show="createColumnModal.isOpen.value"
      :board-id="boardId"
      @close="createColumnModal.closeModal"
    />

    <DeleteColumnDialog
      v-if="deleteColumnModal.modalData.value"
      :show="deleteColumnModal.isOpen.value"
      :column="deleteColumnModal.modalData.value"
      @close="deleteColumnModal.closeModal"
    />

    <!-- Cards components -->
    <CreateCardModal
      v-if="activeColumnIdForNewCard"
      :show="createCardModal.isOpen.value"
      :column-id="activeColumnIdForNewCard"
      @close="createCardModal.closeModal"
    />

    <CardDetailsDrawer
      :board-id="boardId"
    />

    <!-- Target for nested child route (CardDetailsPage) -->
    <router-view />

    <!-- Live region for accessibility announcements -->
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ dragAnnouncement }}
    </div>
  </PageContainer>
</template>

