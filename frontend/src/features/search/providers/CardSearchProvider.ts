import type { ISearchProvider, SearchProviderResult, SearchResultItem } from '../types';
import type { FilterModel } from '@/features/filters/types';
import { SearchApi } from '../api/search.api';
import { FilterService } from '@/features/filters/services/filter.service';
import { SearchResultMapper } from '../mappers/SearchResultMapper';

export class CardSearchProvider implements ISearchProvider {
  public readonly entityType = 'card' as const;

  public async search(
    query: string,
    filters?: FilterModel,
    signal?: AbortSignal
  ): Promise<SearchProviderResult> {
    // Merge filter state into card search params
    const filterParams = filters ? FilterService.toSearchParams(filters) : {};

    const result = await SearchApi.searchCards(
      {
        q: query,
        pageSize: 20,
        sort: 'updatedAt',
        direction: 'desc',
        ...filterParams,
      },
      signal
    );

    if (!result.success) {
      return { entityType: this.entityType, items: [], totalCount: 0 };
    }

    const items: SearchResultItem[] = result.data.items.map((dto) =>
      SearchResultMapper.fromCardResponse(dto)
    );

    return {
      entityType: this.entityType,
      items,
      totalCount: result.data.total,
    };
  }
}

export default CardSearchProvider;
