import type { Card } from '../types/models/Card';
import type { CardResponse } from '../types/dto/CardResponse';
import type { MoveCardResponse } from '../types/dto/MoveCardResponse';

export class CardMapper {
  public static toDomain(dto: CardResponse): Card {
    return {
      id: dto.id,
      columnId: dto.columnId,
      boardId: dto.boardId,
      title: dto.title,
      description: dto.description || null,
      position: dto.position,
      dueDate: dto.dueDate || null,
      priority: dto.priority,
      isArchived: dto.isArchived || false,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      version: dto.version,
      commentsCount: dto.commentsCount || 0,
      checklistsCount: dto.checklistsCount || 0,
      completedItems: dto.completedItems || 0,
      totalItems: dto.totalItems || 0,
      progress: dto.progress || 0,
      attachmentsCount: dto.attachmentsCount || 0,
      labels: dto.labels ? dto.labels.map(l => ({ id: l.id, name: l.name, color: l.color })) : [],
    };
  }

  public static toDomainList(dtos: CardResponse[]): Card[] {
    return dtos.map(this.toDomain);
  }

  public static fromMoveResponse(dto: MoveCardResponse): Card {
    return this.toDomain(dto);
  }
}
