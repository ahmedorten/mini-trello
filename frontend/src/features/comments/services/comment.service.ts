import { CommentApi } from '../api/comment.api';
import { useCommentStore } from '../stores/comment.store';
import { CardRefreshService } from '@/features/cards/services/CardRefreshService';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateCommentRequest, UpdateCommentRequest } from '../types';

export class CommentService {
  public static async fetchComments(cardId: string): Promise<void> {
    const store = useCommentStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await CommentApi.listComments(cardId);
    if (result.success) {
      // Sort comments by creation date descending (newest first)
      const list = result.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      store.setComments(list);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createComment(cardId: string, data: CreateCommentRequest): Promise<void> {
    const store = useCommentStore();
    const result = await CommentApi.createComment(cardId, data);
    if (result.success) {
      store.addComment(result.data);
      // Refresh board counters asynchronously to synchronize commentsCount
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async updateComment(cardId: string, id: string, data: UpdateCommentRequest): Promise<void> {
    const result = await CommentApi.updateComment(id, data);
    if (result.success) {
      await this.fetchComments(cardId);
    } else {
      throw result.error;
    }
  }

  public static async deleteComment(cardId: string, id: string): Promise<void> {
    const store = useCommentStore();
    const result = await CommentApi.deleteComment(id);
    if (result.success) {
      store.removeComment(id);
      // Refresh board counters asynchronously to synchronize commentsCount
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }
}

export default CommentService;
