import type { BoardResponse } from '@/features/boards/types/dto/BoardResponse';
import type { CardResponse } from '@/features/cards/types/dto/CardResponse';
import type { SearchResultItem, SearchProviderResult, SearchResultSet } from '../types';
import { useColumnStore } from '@/features/columns/stores/column.store';
import { useBoardStore } from '@/features/boards/stores/board.store';

export class SearchResultMapper {
  /**
   * Map BoardResponse DTO to a unified SearchResultItem ViewModel.
   */
  public static fromBoardResponse(dto: BoardResponse): SearchResultItem {
    return {
      id: dto.id,
      entityType: 'board',
      title: dto.name,
      breadcrumb: 'Workspace',
      icon: 'FolderIcon',
      labels: [],
      routeTo: { name: 'BoardDetails', params: { id: dto.id } },
      meta: {
        description: dto.description || '',
        updatedAt: dto.updatedAt,
      },
    };
  }

  /**
   * Map CardResponse DTO to a unified SearchResultItem ViewModel.
   */
  public static fromCardResponse(dto: CardResponse): SearchResultItem {
    // Attempt dynamic lookup of column and board names from active stores
    const columnStore = useColumnStore();
    const boardStore = useBoardStore();

    const column = columnStore.columns.find((c) => c.id === dto.columnId);
    const board = boardStore.boards.find(
      (b) => b.id === (column?.boardId || dto.boardId)
    );

    const breadcrumb = board
      ? `${board.name} > ${column?.name || 'Cards'}`
      : 'Cards';

    return {
      id: dto.id,
      entityType: 'card',
      title: dto.title,
      breadcrumb,
      icon: 'ClipboardDocumentIcon',
      labels: dto.labels ? dto.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })) : [],
      priority: dto.priority,
      dueDate: dto.dueDate,
      routeTo: {
        name: 'CardDetails',
        params: { id: dto.boardId || board?.id || '', cardId: dto.id },
      },
      meta: {
        description: dto.description || '',
        columnId: dto.columnId,
        boardId: dto.boardId,
        commentsCount: dto.commentsCount || 0,
        attachmentsCount: dto.attachmentsCount || 0,
        progress: dto.progress || 0,
      },
    };
  }

  /**
   * Merge and deduplicate results from all search providers into a single SearchResultSet.
   */
  public static fromProviderResults(
    providerResults: SearchProviderResult[],
    query: string
  ): SearchResultSet {
    const seen = new Set<string>();
    const groups: SearchProviderResult[] = [];
    let totalCount = 0;

    for (const group of providerResults) {
      const uniqueItems: SearchResultItem[] = [];

      for (const item of group.items) {
        const key = `${item.entityType}-${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(item);
        }
      }

      if (uniqueItems.length > 0) {
        groups.push({
          entityType: group.entityType,
          items: uniqueItems,
          totalCount: group.totalCount, // preserve provider total count
        });
        totalCount += uniqueItems.length;
      }
    }

    return {
      groups,
      totalCount,
      query,
    };
  }
}

export default SearchResultMapper;
