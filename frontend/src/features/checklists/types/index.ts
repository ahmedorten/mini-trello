export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ChecklistResponse {
  id: string;
  cardId: string;
  title: string;
  checklistItems?: ChecklistItemResponse[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ChecklistItemResponse {
  id: string;
  checklistId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateChecklistRequest {
  title: string;
}

export interface UpdateChecklistRequest {
  title: string;
}

export interface CreateChecklistItemRequest {
  title: string;
}

export interface UpdateChecklistItemRequest {
  title?: string;
  isCompleted?: boolean;
}
