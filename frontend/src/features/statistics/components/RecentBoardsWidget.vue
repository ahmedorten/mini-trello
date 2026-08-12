<script setup lang="ts">
import { computed } from 'vue';
import { useBoardStore } from '@/features/boards/stores/board.store';
import { useModal } from '@/shared/composables/useModal';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import CreateBoardModal from '@/features/boards/components/CreateBoardModal.vue';
import { ArrowRightIcon, PlusIcon, FolderIcon } from '@heroicons/vue/24/outline';

defineProps<{
  loading?: boolean;
}>();

const boardStore = useBoardStore();
const createModal = useModal();

const recentBoards = computed(() => boardStore.boards.slice(0, 3));
</script>

<template>
  <div v-if="loading" class="space-y-4">
    <div class="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-150 rounded-2xl animate-pulse" />
    </div>
  </div>

  <div v-else class="space-y-4 w-full select-none">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Recent Boards
      </h3>
      <router-link
        to="/boards"
        class="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1.5 focus:outline-none transition-colors uppercase tracking-wider"
      >
        <span>All Boards</span>
        <ArrowRightIcon class="h-3.5 w-3.5" />
      </router-link>
    </div>

    <!-- Empty state -->
    <div v-if="recentBoards.length === 0" class="p-8 bg-white border border-dashed border-gray-200 rounded-2xl text-center shadow-2xs">
      <p class="text-xs font-bold text-gray-900">No boards created yet</p>
      <p class="text-[11px] text-gray-500 mt-1">Get started by creating a Trello-like Kanban board.</p>
      <BaseButton size="sm" class="mt-4" @click="createModal.openModal">
        <PlusIcon class="h-3.5 w-3.5 mr-1" />
        Create Board
      </BaseButton>
    </div>

    <!-- Cards grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <router-link
        v-for="board in recentBoards"
        :key="board.id"
        :to="`/boards/${board.id}`"
        class="block bg-white p-5 rounded-2xl border border-gray-150 shadow-xs hover:shadow-md hover:border-brand-300 hover:scale-[1.005] transition-all group"
        aria-label="View recent board details"
      >
        <div class="flex items-start space-x-3.5">
          <div class="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
            <FolderIcon class="h-4.5 w-4.5" />
          </div>
          <div class="min-w-0">
            <h4 class="font-bold text-gray-900 group-hover:text-brand-700 transition-colors text-sm truncate">
              {{ board.name }}
            </h4>
            <p class="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
              {{ board.description || 'No description provided.' }}
            </p>
          </div>
        </div>
      </router-link>
    </div>

    <!-- Create Board Modal -->
    <CreateBoardModal
      :show="createModal.isOpen.value"
      @close="createModal.closeModal"
    />
  </div>
</template>
