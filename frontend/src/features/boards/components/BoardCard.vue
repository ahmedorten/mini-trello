<script setup lang="ts">
import type { Board } from '../types/models/Board';
import dayjs from 'dayjs';

interface Props {
  board: Board;
}

defineProps<Props>();
</script>

<template>
  <router-link
    :to="`/boards/${board.id}`"
    class="block bg-white p-5 rounded-2xl border border-gray-150 shadow-sm hover:shadow-md hover:border-brand-300 hover:scale-[1.01] active:scale-[0.99] transition-all group"
    aria-label="View Board details"
  >
    <div class="flex flex-col h-28 justify-between">
      <div>
        <h3 class="font-bold text-gray-900 group-hover:text-brand-700 transition-colors text-base line-clamp-1">
          {{ board.name }}
        </h3>
        <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {{ board.description || 'No description provided.' }}
        </p>
      </div>
      <div class="flex items-center justify-between text-[11px] text-gray-400 font-medium">
        <span>Owner: Workspace User</span>
        <span>Created: {{ dayjs(board.createdAt).format('MMM D, YYYY') }}</span>
      </div>
    </div>
  </router-link>
</template>
