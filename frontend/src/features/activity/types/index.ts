export interface Activity {
  id: string;
  cardId: string;
  action: string;
  details: Record<string, any> | null;
  createdAt: string;
  createdBy: string | null;
}

export interface ActivityResponse {
  id: string;
  cardId: string;
  action: string;
  details: any | null;
  createdAt: string;
  createdBy: string | null;
}
