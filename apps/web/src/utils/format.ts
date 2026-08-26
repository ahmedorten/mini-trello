/** A translation-ready byte size: the caller renders `value` through `n()`
 *  and `unitKey` through `t('common.bytes.' + unitKey)`. */
export interface FormattedBytes {
  value: number;
  unitKey: 'b' | 'kb' | 'mb';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Was a duplicated, English-only string builder in CustomerDetailView.vue and
 *  TicketDetailView.vue. Returns a `{ value, unitKey }` pair instead of a
 *  pre-concatenated string so the caller can localise both parts. */
export function formatBytes(bytes: number): FormattedBytes {
  if (bytes < 1024) {
    return { value: bytes, unitKey: 'b' };
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return { value: round1(kilobytes), unitKey: 'kb' };
  }

  return { value: round1(kilobytes / 1024), unitKey: 'mb' };
}

/** Formats a Date as the local, zoneless string an
 *  `<input type="datetime-local">` expects. Was duplicated in
 *  CustomerDetailView.vue. */
export function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
