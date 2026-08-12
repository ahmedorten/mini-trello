export interface DashboardResponse {
  overview: {
    totalBoards: number;
    totalColumns: number;
    totalCards: number;
    activeCards: number;
    archivedCards: number;
  };
  dueDates: {
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    dueNextWeek: number;
  };
  priorities: {
    low: number;
    medium: number;
    high: number;
  };
  checklists: {
    totalChecklists: number;
    totalItems: number;
    completedItems: number;
    remainingItems: number;
    completionPercentage: number;
  };
  comments: {
    total: number;
  };
  attachments: {
    total: number;
    totalSize: number;
  };
  labels: {
    total: number;
    topLabels: {
      id: string;
      name: string;
      color: string;
      usage: number;
    }[];
  };
  activity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    recent: {
      id: string;
      action: string;
      createdAt: Date;
      cardId: string;
    }[];
  };
}
