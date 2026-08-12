import { ActivityApi } from '../api/activity.api';
import { useActivityStore } from '../stores/activity.store';
import { QueryState } from '@/core/api/contracts/QueryState';

export class ActivityService {
  public static async fetchActivities(cardId: string): Promise<void> {
    const store = useActivityStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await ActivityApi.listActivities(cardId);
    if (result.success) {
      store.setActivities(result.data);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }
}

export default ActivityService;
