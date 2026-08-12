import prisma from '../../shared/database/prisma';
import { DashboardResponse } from './dashboard.types';
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfNextWeek,
  endOfNextWeek,
  startOfMonth,
} from '../../shared/utils/date-boundaries';

export class DashboardService {
  public async getDashboard(userId: string): Promise<DashboardResponse> {
    // Dashboard is a read-only endpoint.
    // It must never generate Activity Timeline records or modify database state.

    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();
    const nextWeekStart = startOfNextWeek();
    const nextWeekEnd = endOfNextWeek();
    const monthStart = startOfMonth();
    const now = new Date();

    const baseCardWhere = {
      isDeleted: false,
      isArchived: false,
      column: {
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    };

    const checklistCardWhere = {
      card: {
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      isDeleted: false,
    };

    const checklistItemWhere = {
      checklist: {
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
        isDeleted: false,
      },
      isDeleted: false,
    };

    const attachmentCardWhere = {
      card: {
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      isDeleted: false,
    };

    const commentCardWhere = {
      card: {
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      isDeleted: false,
    };

    const activityBaseWhere = {
      card: {
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
    };

    // Execute independent database operations concurrently
    const [
      totalBoards,
      totalColumns,
      cardArchivedGroup,
      overdueCount,
      dueTodayCount,
      dueThisWeekCount,
      dueNextWeekCount,
      priorityGroup,
      totalChecklists,
      totalChecklistItems,
      completedChecklistItems,
      attachmentAggregate,
      totalComments,
      totalLabels,
      topLabelsGroup,
      activitiesToday,
      activitiesThisWeek,
      activitiesThisMonth,
      recentActivities,
    ] = await Promise.all([
      // Overview
      prisma.board.count({
        where: {
          ownerId: userId,
          isDeleted: false,
        },
      }),
      prisma.column.count({
        where: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      }),
      prisma.card.groupBy({
        by: ['isArchived'],
        where: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
        _count: true,
      }),

      // Due Dates
      prisma.card.count({
        where: {
          ...baseCardWhere,
          dueDate: {
            lt: now,
          },
        },
      }),
      prisma.card.count({
        where: {
          ...baseCardWhere,
          dueDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      prisma.card.count({
        where: {
          ...baseCardWhere,
          dueDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      }),
      prisma.card.count({
        where: {
          ...baseCardWhere,
          dueDate: {
            gte: nextWeekStart,
            lte: nextWeekEnd,
          },
        },
      }),

      // Priorities
      prisma.card.groupBy({
        by: ['priority'],
        where: baseCardWhere,
        _count: true,
      }),

      // Checklists
      prisma.checklist.count({
        where: checklistCardWhere,
      }),
      prisma.checklistItem.count({
        where: checklistItemWhere,
      }),
      prisma.checklistItem.count({
        where: {
          ...checklistItemWhere,
          isCompleted: true,
        },
      }),

      // Attachments
      prisma.attachment.aggregate({
        where: attachmentCardWhere,
        _count: {
          id: true,
        },
        _sum: {
          fileSize: true,
        },
      }),

      // Comments
      prisma.comment.count({
        where: commentCardWhere,
      }),

      // Labels
      prisma.label.count({
        where: {
          board: {
            ownerId: userId,
            isDeleted: false,
          },
          isDeleted: false,
        },
      }),
      prisma.cardLabel.groupBy({
        by: ['labelId'],
        where: {
          card: {
            isDeleted: false,
            column: {
              isDeleted: false,
              board: {
                ownerId: userId,
                isDeleted: false,
              },
            },
          },
          label: {
            isDeleted: false,
          },
        },
        _count: {
          cardId: true,
        },
        orderBy: {
          _count: {
            cardId: 'desc',
          },
        },
        take: 5,
      }),

      // Activities
      prisma.activity.count({
        where: {
          ...activityBaseWhere,
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.activity.count({
        where: {
          ...activityBaseWhere,
          createdAt: {
            gte: weekStart,
          },
        },
      }),
      prisma.activity.count({
        where: {
          ...activityBaseWhere,
          createdAt: {
            gte: monthStart,
          },
        },
      }),
      prisma.activity.findMany({
        where: activityBaseWhere,
        select: {
          id: true,
          action: true,
          createdAt: true,
          cardId: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
    ]);

    // Format Overview Cards
    let activeCards = 0;
    let archivedCards = 0;
    for (const group of cardArchivedGroup) {
      if (group.isArchived) {
        archivedCards = group._count;
      } else {
        activeCards = group._count;
      }
    }
    const totalCards = activeCards + archivedCards;

    // Format Priorities
    let low = 0;
    let medium = 0;
    let high = 0;
    for (const group of priorityGroup) {
      if (group.priority === 'LOW') {
        low = group._count;
      } else if (group.priority === 'MEDIUM') {
        medium = group._count;
      } else if (group.priority === 'HIGH') {
        high = group._count;
      }
    }

    // Format Checklists
    const completionPercentage =
      totalChecklistItems === 0
        ? 0
        : Math.round((completedChecklistItems / totalChecklistItems) * 100);

    // Format Top Labels
    const topLabelIds = topLabelsGroup.map((g) => g.labelId);
    const labelDetails = await prisma.label.findMany({
      where: {
        id: {
          in: topLabelIds,
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    const topLabels = topLabelsGroup
      .map((g) => {
        const detail = labelDetails.find((d) => d.id === g.labelId);
        return {
          id: g.labelId,
          name: detail?.name || '',
          color: detail?.color || '',
          usage: g._count.cardId,
        };
      })
      .filter((l) => l.name !== '');

    return {
      overview: {
        totalBoards,
        totalColumns,
        totalCards,
        activeCards,
        archivedCards,
      },
      dueDates: {
        overdue: overdueCount,
        dueToday: dueTodayCount,
        dueThisWeek: dueThisWeekCount,
        dueNextWeek: dueNextWeekCount,
      },
      priorities: {
        low,
        medium,
        high,
      },
      checklists: {
        totalChecklists,
        totalItems: totalChecklistItems,
        completedItems: completedChecklistItems,
        remainingItems: totalChecklistItems - completedChecklistItems,
        completionPercentage,
      },
      comments: {
        total: totalComments,
      },
      attachments: {
        total: attachmentAggregate._count.id,
        totalSize: attachmentAggregate._sum.fileSize || 0,
      },
      labels: {
        total: totalLabels,
        topLabels,
      },
      activity: {
        today: activitiesToday,
        thisWeek: activitiesThisWeek,
        thisMonth: activitiesThisMonth,
        recent: recentActivities,
      },
    };
  }
}
