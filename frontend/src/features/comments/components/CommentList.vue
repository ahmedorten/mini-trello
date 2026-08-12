<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useComments } from '../composables/useComments';
import { useCommentForm } from '../composables/useCommentForm';
import CommentItem from './CommentItem.vue';
import { ToastService } from '@/shared/services/ToastService';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import { QueryState } from '@/core/api/contracts/QueryState';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  cardId: string;
}>();

const {
  comments,
  queryState,
  error,
  loadComments,
  createComment,
  editComment,
  deleteComment,
} = useComments();

const {
  handleSubmit,
  errors,
  isSubmitting,
  content,
  contentProps,
  resetForm,
} = useCommentForm();

const load = async () => {
  try {
    await loadComments(props.cardId);
  } catch (e: any) {
    console.error('Failed to load comments:', e);
  }
};

onMounted(load);
watch(() => props.cardId, load);

const handleAddComment = handleSubmit(async (values) => {
  try {
    await createComment(props.cardId, { content: values.content.trim() });
    resetForm();
    ToastService.success('Comment posted.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to post comment.');
  }
});

const handleUpdateComment = async (commentId: string, text: string) => {
  try {
    await editComment(props.cardId, commentId, { content: text.trim() });
    ToastService.success('Comment updated.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update comment.');
  }
};

const handleDeleteComment = async (commentId: string) => {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  try {
    await deleteComment(props.cardId, commentId);
    ToastService.success('Comment deleted.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to delete comment.');
  }
};
</script>

<template>
  <div class="space-y-4 select-none">
    <!-- Header -->
    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5 border-b border-gray-100 pb-2">
      <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-gray-400" />
      <span>Comments ({{ comments.length }})</span>
    </h4>

    <!-- Create Comment Box -->
    <form @submit.prevent="handleAddComment" class="space-y-2.5">
      <div class="flex flex-col space-y-1">
        <textarea
          v-model="content"
          v-bind="contentProps"
          rows="2"
          placeholder="Write a comment..."
          class="w-full text-xs text-gray-700 border border-gray-250 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white transition-all shadow-xs"
          :aria-invalid="!!errors.content"
          :disabled="isSubmitting"
        ></textarea>
        <span v-if="errors.content" class="text-[10px] font-semibold text-red-600 leading-none">
          {{ errors.content }}
        </span>
      </div>

      <div class="flex justify-end">
        <BaseButton
          type="submit"
          variant="primary"
          size="sm"
          :disabled="isSubmitting || !content.trim()"
        >
          Comment
        </BaseButton>
      </div>
    </form>

    <!-- Comments List Container -->
    <div class="relative min-h-[50px] pt-1">
      <div v-if="queryState === QueryState.Loading && comments.length === 0" class="flex items-center justify-center py-4">
        <BaseSpinner size="sm" message="Loading comments..." />
      </div>

      <div v-else-if="queryState === QueryState.Error && comments.length === 0" class="text-center py-4 text-xs text-red-600">
        {{ error }}
      </div>

      <div v-else class="space-y-4 max-h-72 overflow-y-auto pr-1">
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          @update="(text) => handleUpdateComment(comment.id, text)"
          @delete="handleDeleteComment(comment.id)"
        />

        <div v-if="comments.length === 0" class="text-center py-6 border border-dashed border-gray-150 rounded-xl bg-gray-50/50">
          <p class="text-[11px] text-gray-400">No comments posted yet.</p>
        </div>
      </div>
    </div>
  </div>
</template>
