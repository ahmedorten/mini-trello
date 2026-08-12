import { BoardApi } from '../api/board.api';
import { useBoardStore } from '../stores/board.store';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateBoardRequest } from '../types/dto/CreateBoardRequest';
import type { UpdateBoardRequest } from '../types/dto/UpdateBoardRequest';
import type { Board } from '../types/models/Board';

export class BoardService {
  public static async fetchBoards(params?: any): Promise<void> {
    const store = useBoardStore();
    const isInitial = store.boards.length === 0;
    store.setQueryState(isInitial ? QueryState.Loading : QueryState.Refreshing);
    store.setError(null);

    const mergedParams = { ...store.filters, ...params };
    const result = await BoardApi.listBoards(mergedParams);
    
    if (result.success) {
      store.setBoards(result.data.items);
      store.setPagination({
        total: result.data.total,
        totalPages: result.data.totalPages,
      });
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async fetchBoardDetails(id: string): Promise<void> {
    const store = useBoardStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await BoardApi.getBoard(id);
    if (result.success) {
      store.setCurrentBoard(result.data);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createBoard(data: CreateBoardRequest): Promise<Board> {
    const store = useBoardStore();
    
    // Optimistic UI update: push a temporary board
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempBoard: Board = {
      id: tempId,
      name: data.name,
      description: data.description || null,
      ownerId: 'current-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    
    const previousBoards = [...store.boards];
    store.setBoards([tempBoard, ...store.boards]);

    const result = await BoardApi.createBoard(data);
    if (result.success) {
      // Swap temp board with actual board details
      store.setBoards(store.boards.map(b => b.id === tempId ? result.data : b));
      return result.data;
    } else {
      // Rollback
      store.setBoards(previousBoards);
      throw result.error;
    }
  }

  public static async updateBoard(id: string, data: UpdateBoardRequest): Promise<void> {
    const store = useBoardStore();
    
    // Optimistic UI update: Backup previous states
    const previousBoards = [...store.boards];
    const previousCurrentBoard = store.currentBoard ? { ...store.currentBoard } : null;

    // Apply updates locally
    store.setBoards(store.boards.map(b => b.id === id ? { ...b, ...data } : b));
    if (store.currentBoard && store.currentBoard.id === id) {
      store.setCurrentBoard({ ...store.currentBoard, ...data });
    }

    const result = await BoardApi.updateBoard(id, data);
    if (!result.success) {
      // Rollback on failure
      store.setBoards(previousBoards);
      store.setCurrentBoard(previousCurrentBoard);
      throw result.error;
    }
  }

  public static async deleteBoard(id: string): Promise<void> {
    const store = useBoardStore();

    // Optimistic UI update: Backup previous states and index
    const previousBoards = [...store.boards];
    const previousCurrentBoard = store.currentBoard ? { ...store.currentBoard } : null;
    
    store.setBoards(store.boards.filter(b => b.id !== id));
    if (store.currentBoard?.id === id) {
      store.setCurrentBoard(null);
    }

    const result = await BoardApi.deleteBoard(id);
    if (!result.success) {
      // Rollback on failure
      store.setBoards(previousBoards);
      if (previousCurrentBoard && previousCurrentBoard.id === id) {
        store.setCurrentBoard(previousCurrentBoard);
      }
      throw result.error;
    }
  }
}

export default BoardService;
