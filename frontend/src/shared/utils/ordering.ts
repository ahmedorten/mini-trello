/**
 * Returns a new array with the item reordered from fromIndex to toIndex.
 */
export function reorderArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Moves an item from a source list to a destination list.
 */
export function moveItem<T>(
  sourceList: T[],
  destList: T[],
  fromIndex: number,
  toIndex: number
): { nextSource: T[]; nextDest: T[]; item: T } {
  const nextSource = Array.from(sourceList);
  const nextDest = Array.from(destList);
  const [item] = nextSource.splice(fromIndex, 1);
  nextDest.splice(toIndex, 0, item);
  return { nextSource, nextDest, item };
}

/**
 * Calculates a new position value between two items for custom sorting.
 */
export function calculatePosition(
  targetIndex: number,
  list: Array<{ position: number }>
): number {
  if (list.length === 0) return 1000;
  if (targetIndex <= 0) return list[0].position / 2;
  if (targetIndex >= list.length) return list[list.length - 1].position + 1000;
  return (list[targetIndex - 1].position + list[targetIndex].position) / 2;
}

/**
 * Re-indexes all item positions sequentially (spaced by 1000) to prevent precision issues.
 */
export function normalizePositions<T extends { position: number }>(list: T[]): T[] {
  return list.map((item, index) => ({
    ...item,
    position: (index + 1) * 1000,
  }));
}
