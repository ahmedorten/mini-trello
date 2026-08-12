export interface Comment {
  id: string;
  cardId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface CommentResponse {
  id: string;
  cardId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}
