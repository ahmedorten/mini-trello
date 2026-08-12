import type { CardPriority } from '../models/CardState';

export interface CardResponse {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  priority: CardPriority;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  commentsCount?: number;
  checklistsCount?: number;
  completedItems?: number;
  totalItems?: number;
  progress?: number;
  attachmentsCount?: number;
  labels?: Array<{ id: string; name: string; color: string }>;
}
