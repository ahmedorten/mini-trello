import type { CardPriority } from '@/features/cards/types/models/CardState';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export class StatisticsPresenter {
  /**
   * Format file sizes in bytes to human-readable strings (KB, MB, GB).
   */
  public static formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
      return '0 B';
    }
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Format a completion fraction or percentage into a tidy percentage string.
   */
  public static formatPercentage(pct: number | null | undefined): string {
    if (pct === null || pct === undefined || isNaN(pct)) {
      return '0%';
    }
    return `${Math.round(pct)}%`;
  }

  /**
   * Convert an ISO date string to a human-friendly relative date.
   */
  public static formatRelativeDate(isoString: string | null | undefined): string {
    if (!isoString) return 'Never';
    return dayjs(isoString).fromNow();
  }

  /**
   * Get Tailwind color classes for priority indicators.
   */
  public static getPriorityColor(priority: CardPriority): string {
    switch (priority) {
      case 'HIGH':
        return 'text-red-700 bg-red-50 border border-red-150';
      case 'MEDIUM':
        return 'text-amber-700 bg-amber-50 border border-amber-150';
      case 'LOW':
        return 'text-blue-700 bg-blue-50 border border-blue-150';
      default:
        return 'text-gray-700 bg-gray-50 border border-gray-150';
    }
  }

  /**
   * Get Heroicon name mapping for card priorities.
   */
  public static getPriorityIcon(priority: CardPriority): string {
    switch (priority) {
      case 'HIGH':
        return 'ChevronUpIcon';
      case 'MEDIUM':
        return 'ChevronRightIcon';
      case 'LOW':
        return 'ChevronDownIcon';
      default:
        return 'EllipsisHorizontalIcon';
    }
  }

  /**
   * Maps a backend overview statistics key to a clean, presentational title.
   */
  public static getKpiLabel(key: string): string {
    const labels: Record<string, string> = {
      totalBoards: 'Total Boards',
      totalColumns: 'Total Columns',
      totalCards: 'Total Cards',
      activeCards: 'Active Cards',
      archivedCards: 'Archived Cards',
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').trim();
  }
}

export default StatisticsPresenter;
