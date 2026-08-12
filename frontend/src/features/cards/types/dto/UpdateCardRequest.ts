import type { CardPriority } from '../models/CardState';

export interface UpdateCardRequest {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: CardPriority;
  isArchived?: boolean;
}
