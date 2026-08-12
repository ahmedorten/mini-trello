import type { FilterModel } from '../types';

// ─── Filter Preset Interface ───────────────────────────────────────────────────

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterModel;
  createdAt: string;
}

// ─── Filter Preset Static Class ───────────────────────────────────────────────

export class FilterPreset {
  /**
   * Serialize a preset to a JSON string for storage.
   */
  public static serialize(preset: FilterPreset): string {
    return JSON.stringify(preset);
  }

  /**
   * Safely deserialize a JSON string back into a FilterPreset.
   * Returns null if the string is invalid or missing required fields.
   */
  public static deserialize(raw: string): FilterPreset | null {
    try {
      const parsed = JSON.parse(raw) as Partial<FilterPreset>;
      if (
        typeof parsed.id === 'string' &&
        typeof parsed.name === 'string' &&
        typeof parsed.filters === 'object' &&
        typeof parsed.createdAt === 'string'
      ) {
        return parsed as FilterPreset;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new FilterPreset from a FilterModel.
   * The ID is generated from a simple timestamp + random string.
   */
  public static fromFilterModel(name: string, model: FilterModel): FilterPreset {
    return {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      filters: { ...model },
      createdAt: new Date().toISOString(),
    };
  }
}

export default FilterPreset;
