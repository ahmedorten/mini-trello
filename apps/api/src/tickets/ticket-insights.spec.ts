import { TicketPriority, TicketStatus } from '@prisma/client';
import {
  ACTIVE_TICKET_STATUSES,
  DASHBOARD_LIST_LIMIT,
  OVERDUE_AFTER_HOURS,
  PENDING_TICKET_STATUS,
  overdueCutoffs,
} from './ticket-insights';

describe('ticket-insights', () => {
  it('OVERDUE_AFTER_HOURS has an entry for every TicketPriority value', () => {
    for (const priority of Object.values(TicketPriority)) {
      expect(OVERDUE_AFTER_HOURS[priority]).toEqual(expect.any(Number));
    }
    expect(Object.keys(OVERDUE_AFTER_HOURS)).toHaveLength(Object.values(TicketPriority).length);
  });

  it('ACTIVE_TICKET_STATUSES excludes RESOLVED and CLOSED', () => {
    expect(ACTIVE_TICKET_STATUSES).toContain(TicketStatus.OPEN);
    expect(ACTIVE_TICKET_STATUSES).toContain(TicketStatus.IN_PROGRESS);
    expect(ACTIVE_TICKET_STATUSES).toContain(TicketStatus.ON_HOLD);
    expect(ACTIVE_TICKET_STATUSES).not.toContain(TicketStatus.RESOLVED);
    expect(ACTIVE_TICKET_STATUSES).not.toContain(TicketStatus.CLOSED);
  });

  it('PENDING_TICKET_STATUS is ON_HOLD', () => {
    expect(PENDING_TICKET_STATUS).toBe(TicketStatus.ON_HOLD);
  });

  it('DASHBOARD_LIST_LIMIT is 5', () => {
    expect(DASHBOARD_LIST_LIMIT).toBe(5);
  });

  describe('overdueCutoffs', () => {
    const fixedNow = new Date('2026-01-10T12:00:00.000Z');

    it('returns four entries with the exact expected instants', () => {
      const cutoffs = overdueCutoffs(fixedNow);

      expect(cutoffs).toHaveLength(4);

      const byPriority = new Map(cutoffs.map((c) => [c.priority, c.before]));

      expect(byPriority.get(TicketPriority.URGENT)).toEqual(new Date('2026-01-10T08:00:00.000Z'));
      expect(byPriority.get(TicketPriority.HIGH)).toEqual(new Date('2026-01-10T04:00:00.000Z'));
      expect(byPriority.get(TicketPriority.MEDIUM)).toEqual(new Date('2026-01-09T12:00:00.000Z'));
      expect(byPriority.get(TicketPriority.LOW)).toEqual(new Date('2026-01-07T12:00:00.000Z'));
    });

    it('is derived purely from the passed-in now, not the system clock', () => {
      const otherNow = new Date('2020-06-01T00:00:00.000Z');
      const cutoffs = overdueCutoffs(otherNow);
      const urgent = cutoffs.find((c) => c.priority === TicketPriority.URGENT);

      expect(urgent?.before).toEqual(new Date('2020-05-31T20:00:00.000Z'));
    });
  });
});
