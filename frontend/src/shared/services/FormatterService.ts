import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import { i18n } from '@/plugins/i18n';

// Extend dayjs with relative time plugin
dayjs.extend(relativeTimePlugin);

export class FormatterService {
  /**
   * Formats a raw date using locale-aware Dayjs configurations.
   */
  static formatDate(date: string | Date | number, formatStr = 'DD MMM YYYY'): string {
    const currentLocale = i18n.global.locale.value || 'en';
    return dayjs(date).locale(currentLocale).format(formatStr);
  }

  /**
   * Formats a raw date into relative time (e.g. "2 hours ago" or "قبل ساعتين").
   */
  static relativeTime(date: string | Date | number): string {
    const currentLocale = i18n.global.locale.value || 'en';
    return dayjs(date).locale(currentLocale).fromNow();
  }

  /**
   * Formats a decimal percentage to readable percentage strings (e.g. "45%").
   */
  static formatPercentage(value: number): string {
    const currentLocale = i18n.global.locale.value || 'en';
    return new Intl.NumberFormat(currentLocale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  /**
   * Formats numbers with thousand separators (e.g. "1,250" or "١٬٢٥٠").
   */
  static formatNumber(value: number): string {
    const currentLocale = i18n.global.locale.value || 'en';
    return new Intl.NumberFormat(currentLocale).format(value);
  }
}
export default FormatterService;
