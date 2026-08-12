export type CardPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CardFilters {
  search?: string;
  priority?: CardPriority;
  dueDate?: string | null;
  archived?: boolean;
}

export interface DrawerState {
  selectedCardId: string | null;
  isOpen: boolean;
  mode: 'view' | 'edit';
}

