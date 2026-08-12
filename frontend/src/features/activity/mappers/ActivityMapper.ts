import type { ActivityResponse } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export interface ActivityViewModel {
  id: string;
  creatorName: string;
  actionText: string;
  relativeTime: string;
  iconName: string;
}

export class ActivityMapper {
  public static toViewModel(dto: ActivityResponse, currentUserId: string | null): ActivityViewModel {
    const creatorName = dto.createdBy === currentUserId ? 'You' : 'Another User';
    
    let actionText = dto.action.toLowerCase().replace(/_/g, ' ');
    let iconName = 'UserIcon';

    // Enhance action text descriptions using details payload if available
    if (dto.details && typeof dto.details === 'object') {
      const details = dto.details as Record<string, any>;
      if (dto.action.includes('COMMENT_CREATED') && details.content) {
        actionText = `added comment: "${details.content.slice(0, 40)}${details.content.length > 40 ? '...' : ''}"`;
      } else if (dto.action.includes('LABEL_ATTACHED') && details.name) {
        actionText = `attached label "${details.name}"`;
      } else if (dto.action.includes('LABEL_DETACHED') && details.name) {
        actionText = `removed label "${details.name}"`;
      } else if (dto.action.includes('CHECKLIST_CREATED') && details.title) {
        actionText = `created checklist "${details.title}"`;
      } else if (dto.action.includes('CHECKLIST_ITEM_CREATED') && details.title) {
        actionText = `added checklist item "${details.title}"`;
      } else if (dto.action.includes('CHECKLIST_ITEM_COMPLETED') && details.title) {
        actionText = `completed item "${details.title}"`;
      } else if (dto.action.includes('ATTACHMENT_ADDED') && details.fileName) {
        actionText = `attached file "${details.fileName}"`;
      }
    }

    if (dto.action.includes('CARD')) {
      iconName = 'ClipboardDocumentIcon';
    } else if (dto.action.includes('COMMENT')) {
      iconName = 'ChatBubbleLeftEllipsisIcon';
    } else if (dto.action.includes('CHECKLIST')) {
      iconName = 'ListBulletIcon';
    } else if (dto.action.includes('ATTACHMENT')) {
      iconName = 'PaperClipIcon';
    }

    return {
      id: dto.id,
      creatorName,
      actionText,
      relativeTime: dayjs(dto.createdAt).fromNow(),
      iconName,
    };
  }

  public static toViewModelList(dtos: ActivityResponse[], currentUserId: string | null): ActivityViewModel[] {
    return dtos.map(dto => this.toViewModel(dto, currentUserId));
  }
}

export default ActivityMapper;
