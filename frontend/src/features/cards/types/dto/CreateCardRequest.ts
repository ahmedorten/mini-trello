import type { CardPriority } from '../models/CardState';

export interface CreateCardRequest {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: CardPriority;
}
