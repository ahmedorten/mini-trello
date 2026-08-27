import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  setTaskStatus,
  updateTask,
  type AgentTask,
  type CreateAgentTaskPayload,
  type ListAgentTasksParams,
  type UpdateAgentTaskPayload,
} from './tasks';
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

const sampleTask: AgentTask = {
  id: 'task-1',
  title: 'Call back re: refund status',
  notes: null,
  status: 'OPEN',
  dueAt: null,
  remindAt: null,
  completedAt: null,
  assignee: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  ticket: null,
  customer: null,
  isOverdue: false,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

describe('tasks api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTasks forwards its params object through untouched', async () => {
    const params: ListAgentTasksParams = { page: 2, pageSize: 10, scope: 'all' };
    mockedApiClient.get.mockResolvedValue({
      data: { items: [], meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 } },
    });

    await listTasks(params);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tasks', { params });
  });

  it('getTask requests /tasks/:id', async () => {
    mockedApiClient.get.mockResolvedValue({ data: sampleTask });

    await getTask('task-1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tasks/task-1');
  });

  it('createTask posts the payload verbatim', async () => {
    mockedApiClient.post.mockResolvedValue({ data: sampleTask });
    const payload: CreateAgentTaskPayload = { title: 'Call back' };

    await createTask(payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/tasks', payload);
  });

  it('updateTask patches the payload verbatim', async () => {
    mockedApiClient.patch.mockResolvedValue({ data: sampleTask });
    const payload: UpdateAgentTaskPayload = { notes: null, dueAt: null };

    await updateTask('task-1', payload);

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/tasks/task-1', payload);
  });

  it('setTaskStatus patches /tasks/:id/status with { status }', async () => {
    mockedApiClient.patch.mockResolvedValue({ data: sampleTask });

    await setTaskStatus('task-1', 'DONE');

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/tasks/task-1/status', { status: 'DONE' });
  });

  it('deleteTask issues a DELETE', async () => {
    mockedApiClient.delete.mockResolvedValue({ data: undefined });

    await deleteTask('task-1');

    expect(mockedApiClient.delete).toHaveBeenCalledWith('/tasks/task-1');
  });
});
