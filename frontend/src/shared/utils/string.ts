export function truncate(str: string, length = 30): string {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
}
