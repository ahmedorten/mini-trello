import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentDashboard, type AgentDashboard } from './dashboard';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient, true);

const sampleDashboard: AgentDashboard = {
  counts: { assigned: 1, open: 1, pending: 0, overdue: 0, unassigned: 0, resolvedLast7Days: 0 },
  byStatus: [],
  byPriority: [],
  byCategory: [],
  focusTickets: [],
  overdueTickets: [],
  unassignedTickets: [],
  tasksDueSoon: [],
  listLimit: 5,
  generatedAt: '2026-08-27T00:00:00.000Z',
};

describe('dashboard api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAgentDashboard sends no params when scope is omitted', async () => {
    mockedApiClient.get.mockResolvedValue({ data: sampleDashboard });

    const result = await getAgentDashboard();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/dashboard/agent', { params: undefined });
    expect(result).toEqual(sampleDashboard);
  });

  it('getAgentDashboard sends { scope } when given', async () => {
    mockedApiClient.get.mockResolvedValue({ data: sampleDashboard });

    await getAgentDashboard('workable');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/dashboard/agent', { params: { scope: 'workable' } });
  });
});
