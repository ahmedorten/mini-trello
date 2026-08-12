import { computed } from 'vue';
import { useActivityStore } from '../stores/activity.store';
import { ActivityService } from '../services/activity.service';
import { ActivityMapper } from '../mappers/ActivityMapper';
import { useAuthStore } from '@/features/auth/stores/auth.store';

export function useActivities() {
  const store = useActivityStore();
  const authStore = useAuthStore();

  const activities = computed(() => store.activities);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const activitiesViewModels = computed(() => {
    return ActivityMapper.toViewModelList(store.activities, authStore.user?.id || null);
  });

  const loadActivities = async (cardId: string) => {
    await ActivityService.fetchActivities(cardId);
  };

  return {
    activities,
    activitiesViewModels,
    queryState,
    error,
    loadActivities,
  };
}

export default useActivities;
