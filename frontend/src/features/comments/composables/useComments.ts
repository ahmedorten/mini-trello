import { computed } from 'vue';
import { useCommentStore } from '../stores/comment.store';
import { CommentService } from '../services/comment.service';
import type { CreateCommentRequest, UpdateCommentRequest } from '../types';

export function useComments() {
  const store = useCommentStore();

  const comments = computed(() => store.comments);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadComments = async (cardId: string) => {
    await CommentService.fetchComments(cardId);
  };

  const createComment = async (cardId: string, data: CreateCommentRequest) => {
    await CommentService.createComment(cardId, data);
  };

  const editComment = async (cardId: string, id: string, data: UpdateCommentRequest) => {
    await CommentService.updateComment(cardId, id, data);
  };

  const deleteComment = async (cardId: string, id: string) => {
    await CommentService.deleteComment(cardId, id);
  };

  return {
    comments,
    queryState,
    error,
    loadComments,
    createComment,
    editComment,
    deleteComment,
  };
}

export default useComments;
