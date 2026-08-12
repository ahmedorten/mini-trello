<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Comment } from '../types';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useCommentForm } from '../composables/useCommentForm';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const props = defineProps<{
  comment: Comment;
}>();

const emit = defineEmits<{
  (e: 'update', content: string): void;
  (e: 'delete'): void;
}>();

const authStore = useAuthStore();
const isEditing = ref(false);

const isOwner = computed(() => {
  return props.comment.createdBy === authStore.user?.id;
});

const relativeTimestamp = computed(() => {
  return dayjs(props.comment.createdAt).fromNow();
});

const creatorInitials = computed(() => {
  if (isOwner.value && authStore.user?.fullName) {
    return authStore.user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }
  return 'U'; // Fallback for other users
});

const creatorName = computed(() => {
  if (isOwner.value && authStore.user?.fullName) {
    return authStore.user.fullName;
  }
  return 'Other User';
});

const {
  handleSubmit,
  errors,
  content,
  contentProps,
  resetForm,
} = useCommentForm({ content: props.comment.content });

const startEdit = () => {
  isEditing.value = true;
  resetForm({ values: { content: props.comment.content } });
};

const handleSave = handleSubmit(async (values) => {
  if (values.content === props.comment.content) {
    isEditing.value = false;
    return;
  }
  emit('update', values.content);
  isEditing.value = false;
});
</script>

<template>
  <div class="flex space-x-3 group/comment select-none py-1.5">
    <!-- User Initials Avatar -->
    <div
      class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 bg-brand-50 border border-brand-100 flex-shrink-0"
      :title="creatorName"
    >
      {{ creatorInitials }}
    </div>

    <!-- Main Comment Bubble -->
    <div class="flex-1 flex flex-col space-y-1 min-w-0">
      <div class="flex items-center space-x-2">
        <span class="text-xs font-bold text-gray-900 truncate">
          {{ creatorName }}
        </span>
        <span class="text-[10px] text-gray-400 font-medium">
          {{ relativeTimestamp }}
        </span>
      </div>

      <!-- Editing View -->
      <div v-if="isEditing" class="space-y-2 mt-1">
        <textarea
          v-model="content"
          v-bind="contentProps"
          rows="2"
          class="w-full text-xs text-gray-700 border border-brand-500 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
          :aria-invalid="!!errors.content"
        ></textarea>
        <span v-if="errors.content" class="text-[10px] font-semibold text-red-600 leading-none">
          {{ errors.content }}
        </span>
        <div class="flex items-center space-x-1.5">
          <BaseButton variant="primary" size="sm" @click="handleSave">
            Save
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="isEditing = false">
            Cancel
          </BaseButton>
        </div>
      </div>

      <!-- Static Bubble View -->
      <div
        v-else
        class="text-xs text-gray-700 bg-gray-50 border border-gray-150 p-2.5 rounded-2xl rounded-tl-none break-words inline-block max-w-full font-medium"
      >
        {{ comment.content }}
      </div>

      <!-- Actions Row for owners -->
      <div v-if="isOwner && !isEditing" class="flex items-center space-x-2 text-[10px] text-gray-400 font-medium pl-1">
        <button
          type="button"
          @click="startEdit"
          class="hover:text-brand-600 transition-colors focus:outline-none"
        >
          Edit
        </button>
        <span>•</span>
        <button
          type="button"
          @click="emit('delete')"
          class="hover:text-red-600 transition-colors focus:outline-none"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
