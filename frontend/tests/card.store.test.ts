import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCardStore } from '../src/features/cards/stores/card.store';
import type { Card } from '../src/features/cards/types/models/Card';

describe('Frontend Card Store - Pinia Unit Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockCard1: Card = {
    id: 'card-1',
    columnId: 'col-1',
    boardId: 'board-1',
    title: 'Design Wireframes',
    description: 'Initial UI drafts',
    position: 1000,
    priority: 'HIGH',
    isArchived: false,
    dueDate: null,
    commentsCount: 0,
    attachmentsCount: 0,
    checklistsCount: 0,
    completedItems: 0,
    totalItems: 0,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    labels: [],
  };

  const mockCard2: Card = {
    id: 'card-2',
    columnId: 'col-1',
    boardId: 'board-1',
    title: 'Setup Database',
    description: 'Prisma schema configuration',
    position: 2000,
    priority: 'MEDIUM',
    isArchived: false,
    dueDate: null,
    commentsCount: 1,
    attachmentsCount: 0,
    checklistsCount: 0,
    completedItems: 0,
    totalItems: 0,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    labels: [],
  };

  it('should initialize with empty card lists and default drawer state', () => {
    const cardStore = useCardStore();
    expect(cardStore.cardsByColumn).toEqual({});
    expect(cardStore.currentCard).toBeNull();
    expect(cardStore.drawerState.isOpen).toBe(false);
  });

  it('should set cards for a column correctly', () => {
    const cardStore = useCardStore();
    cardStore.setCardsForColumn('col-1', [mockCard1, mockCard2]);

    expect(cardStore.cardsByColumn['col-1']).toHaveLength(2);
    expect(cardStore.cardsByColumn['col-1'][0].title).toBe('Design Wireframes');
  });

  it('should update current active card and drawer state', () => {
    const cardStore = useCardStore();
    cardStore.setCurrentCard(mockCard1);
    cardStore.setDrawerState({ isOpen: true, selectedCardId: mockCard1.id, mode: 'view' });

    expect(cardStore.currentCard?.id).toBe('card-1');
    expect(cardStore.drawerState.isOpen).toBe(true);
    expect(cardStore.drawerState.selectedCardId).toBe('card-1');
  });

  it('should simulate cross-column card drag and drop state update', () => {
    const cardStore = useCardStore();
    cardStore.setCardsForColumn('col-1', [mockCard1, mockCard2]);
    cardStore.setCardsForColumn('col-2', []);

    // Simulate moving mockCard1 from col-1 to col-2
    const remainingCol1 = cardStore.cardsByColumn['col-1'].filter((c) => c.id !== mockCard1.id);
    const movedCard = { ...mockCard1, columnId: 'col-2' };
    cardStore.setCardsForColumn('col-1', remainingCol1);
    cardStore.setCardsForColumn('col-2', [movedCard]);

    expect(cardStore.cardsByColumn['col-1']).toHaveLength(1);
    expect(cardStore.cardsByColumn['col-2']).toHaveLength(1);
    expect(cardStore.cardsByColumn['col-2'][0].columnId).toBe('col-2');
  });

  it('should reset store state back to initial values', () => {
    const cardStore = useCardStore();
    cardStore.setCardsForColumn('col-1', [mockCard1]);
    cardStore.setCurrentCard(mockCard1);
    cardStore.reset();

    expect(cardStore.cardsByColumn).toEqual({});
    expect(cardStore.currentCard).toBeNull();
  });
});
