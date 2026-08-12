import dayjs from 'dayjs';

export function formatDate(date: string | Date, formatStr = 'YYYY-MM-DD'): string {
  return dayjs(date).format(formatStr);
}
