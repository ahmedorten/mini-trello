import type { ISearchProvider, SearchProviderResult, SearchResultItem } from '../types';
import type { FilterModel } from '@/features/filters/types';
import { SearchApi } from '../api/search.api';
import { SearchResultMapper } from '../mappers/SearchResultMapper';

export class BoardSearchProvider implements ISearchProvider {
  public readonly entityType = 'board' as const;

  public async search(
    query: string,
    _filters?: FilterModel,
    signal?: AbortSignal
  ): Promise<SearchProviderResult> {
    const result = await SearchApi.searchBoards(
      { q: query, pageSize: 5, sort: 'updatedAt', direction: 'desc' },
      signal
    );

    if (!result.success) {
      return { entityType: this.entityType, items: [], totalCount: 0 };
    }

    const items: SearchResultItem[] = result.data.items.map((dto) =>
      SearchResultMapper.fromBoardResponse(dto)
    );

    return {
      entityType: this.entityType,
      items,
      totalCount: result.data.total,
    };
  }
}

export default BoardSearchProvider;
