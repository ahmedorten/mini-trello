import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Comment } from '../types';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useCommentStore = defineStore('comment', () => {
  const comments = ref<Comment[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setComments = (list: Comment[]) => {
    comments.value = list;
  };

  const addComment = (comment: Comment) => {
    comments.value = [comment, ...comments.value];
  };

  const removeComment = (id: string) => {
    comments.value = comments.value.filter(c => c.id !== id);
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    comments.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    comments,
    queryState,
    error,
    setComments,
    addComment,
    removeComment,
    setQueryState,
    setError,
    reset,
  };
});

export default useCommentStore;
