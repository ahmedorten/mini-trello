import { computed } from 'vue';
import { useStatisticsStore } from '../stores/statistics.store';
import { StatisticsService } from '../services/statistics.service';

export function useStatistics() {
  const store = useStatisticsStore();

  const stats = computed(() => store.stats);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);
  const lastRefreshedAt = computed(() => store.lastRefreshedAt);

  // Expose computed slices for widgets directly
  const overview = computed(() => store.stats?.overview || null);
  const dueDates = computed(() => store.stats?.dueDates || null);
  const priorities = computed(() => store.stats?.priorities || null);
  const checklists = computed(() => store.stats?.checklists || null);
  const comments = computed(() => store.stats?.comments || null);
  const attachments = computed(() => store.stats?.attachments || null);
  const labels = computed(() => store.stats?.labels || null);
  const activity = computed(() => store.stats?.activity || null);

  const loadStatistics = async () => {
    await StatisticsService.fetchDashboard();
  };

  const refresh = async () => {
    await StatisticsService.refresh();
  };

  return {
    stats,
    queryState,
    error,
    lastRefreshedAt,
    overview,
    dueDates,
    priorities,
    checklists,
    comments,
    attachments,
    labels,
    activity,
    loadStatistics,
    refresh,
  };
}

export default useStatistics;
