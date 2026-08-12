<script setup lang="ts">
import BoardCard from './BoardCard.vue';
import type { Board } from '../types/models/Board';

interface Props {
  boards: Board[];
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
    <BoardCard
      v-for="board in boards"
      :key="board.id"
      :board="board"
    />
  </div>
</template>
