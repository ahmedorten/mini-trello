import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import TicketDetailView from './TicketDetailView.vue';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import CommunicationTimeline from '@/components/CommunicationTimeline.vue';
import ReassignControl from '@/components/ReassignControl.vue';
import type { Ticket, TicketComment } from '@/api/tickets';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tickets', () => ({ useTicketsStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTicketsStore = vi.mocked(useTicketsStore);

const sampleTicket: Ticket = {
  id: 't-1',
  customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
  subject: 'Cannot log in',
  description: 'After password reset,\nlogin fails.',
  category: 'TECHNICAL',
  priority: 'HIGH',
  status: 'OPEN',
  assignedAgent: null,
  createdBy: null,
  counts: { comments: 0, attachments: 0, history: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function mockAuth(permissions: string[], currentUserId = 'u-1') {
  const store = reactive({
    user: { id: currentUserId },
    can: (permission: string) => permissions.includes(permission),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

function mockTickets(overrides: {
  current?: Ticket | null;
  comments?: TicketComment[];
  attachments?: unknown[];
  history?: unknown[];
  agents?: { id: string; fullName: string; email: string }[];
  error?: string | null;
} = {}) {
  const store = reactive({
    current: 'current' in overrides ? overrides.current : sampleTicket,
    comments: overrides.comments ?? [],
    attachments: overrides.attachments ?? [],
    history: overrides.history ?? [],
    agents: overrides.agents ?? [],
    error: overrides.error ?? null,
    loadDetail: vi.fn(async () => {}),
    loadAgents: vi.fn(async () => {}),
    clearDetail: vi.fn(),
    setStatus: vi.fn(async () => true),
    addComment: vi.fn(async () => true),
    editComment: vi.fn(async () => true),
    removeComment: vi.fn(async () => true),
    uploadFile: vi.fn(async () => true),
    downloadFile: vi.fn(async () => true),
    removeAttachment: vi.fn(async () => true),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTicketsStore.mockReturnValue(store as any);

  return store;
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets/:id', name: 'ticket-detail', component: TicketDetailView },
      { path: '/tickets/:id/edit', name: 'ticket-edit', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });

  router.push('/tickets/t-1');
  await router.isReady();

  const wrapper = mount(TicketDetailView, {
    global: {
      plugins: [router, createPinia()],
      // CommunicationTimeline and ReassignControl get their own dedicated specs;
      // stubbing them here keeps this view's tests from also exercising the
      // dashboard store and the live interaction/assignment API calls.
      stubs: { CommunicationTimeline: true, ReassignControl: true },
    },
  });
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('TicketDetailView', () => {
  it('renders the subject, description with preserved line breaks, and overview fields', async () => {
    mockAuth(['tickets:read']);
    mockTickets();
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Cannot log in');
    const description = wrapper.find('.ticket-detail__description');
    expect(description.exists()).toBe(true);
    expect(description.text()).toContain('After password reset');
    expect(wrapper.text()).toContain('Technical');
    expect(wrapper.text()).toContain('High');
  });

  it('renders only the error block when error is set and current is null', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: null, error: 'No such ticket.' });
    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toBe('No such ticket.');
    expect(wrapper.find('.ticket-detail__tabs').exists()).toBe(false);
  });

  it('switches tabs across comments, attachments, communication, and history so only the active panel is in the DOM', async () => {
    mockAuth(['tickets:read']);
    mockTickets();
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No comments yet.');

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger('click');
    expect(wrapper.text()).toContain('No attachments yet.');
    expect(wrapper.text()).not.toContain('No comments yet.');

    await tabs[2].trigger('click');
    expect(wrapper.findComponent(CommunicationTimeline).exists()).toBe(true);
    expect(wrapper.text()).not.toContain('No attachments yet.');

    await tabs[3].trigger('click');
    expect(wrapper.text()).toContain('No history yet.');
  });

  it('has a fourth Communication tab between Files and History', async () => {
    mockAuth(['tickets:read']);
    mockTickets();
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(['Comments (0)', 'Attachments (0)', 'Communication', 'History']);
  });

  it('renders ReassignControl beside the status select', async () => {
    mockAuth(['tickets:read', 'tickets:write']);
    mockTickets();
    const wrapper = await mountView();

    expect(wrapper.findComponent(ReassignControl).exists()).toBe(true);
  });

  it('omits the comment form without ticket-comments:write', async () => {
    mockAuth(['tickets:read']);
    mockTickets();
    const wrapper = await mountView();

    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('shows the comment form with ticket-comments:write', async () => {
    mockAuth(['tickets:read', 'ticket-comments:write']);
    mockTickets();
    const wrapper = await mountView();

    expect(wrapper.find('textarea').exists()).toBe(true);
  });

  it('gates comment Edit on isOwnComment only, Delete on isOwnComment or tickets:manage', async () => {
    mockAuth(['tickets:read', 'ticket-comments:write'], 'u-1');
    const ownComment: TicketComment = {
      id: 'cm-1',
      ticketId: 't-1',
      author: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
      body: 'Mine',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    const othersComment: TicketComment = {
      id: 'cm-2',
      ticketId: 't-1',
      author: { id: 'u-2', fullName: 'Someone else', email: 'other@crm.local' },
      body: 'Theirs',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    mockTickets({ comments: [ownComment, othersComment] });
    const wrapper = await mountView();

    const items = wrapper.findAll('.ticket-detail__comment');
    expect(items[0].findAll('button').map((b) => b.text())).toEqual(['Edit', 'Delete']);
    // Not tickets:manage, not own: no controls at all.
    expect(items[1].findAll('button')).toHaveLength(0);
  });

  it('a tickets:manage holder sees Delete (not Edit) on someone else\'s comment', async () => {
    mockAuth(['tickets:read', 'tickets:manage'], 'manager-1');
    const othersComment: TicketComment = {
      id: 'cm-2',
      ticketId: 't-1',
      author: { id: 'u-2', fullName: 'Someone else', email: 'other@crm.local' },
      body: 'Theirs',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    mockTickets({ comments: [othersComment] });
    const wrapper = await mountView();

    const item = wrapper.find('.ticket-detail__comment');
    expect(item.findAll('button').map((b) => b.text())).toEqual(['Delete']);
  });

  it('deletes a comment only after the confirm dialog is confirmed', async () => {
    mockAuth(['tickets:read', 'ticket-comments:write'], 'u-1');
    const ownComment: TicketComment = {
      id: 'cm-1',
      ticketId: 't-1',
      author: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
      body: 'Mine',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    const store = mockTickets({ comments: [ownComment] });
    const wrapper = await mountView();

    const deleteButton = wrapper.findAll('.ticket-detail__comment button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');
    expect(store.removeComment).not.toHaveBeenCalled();

    const confirmButton = wrapper.find('.form-actions').findAll('button')[1];
    await confirmButton.trigger('click');
    expect(store.removeComment).toHaveBeenCalledWith('t-1', 'cm-1');
  });

  it('omits the upload control without ticket-attachments:write, and routes attachment delete through the confirm dialog', async () => {
    mockAuth(['tickets:read'], 'u-1');
    const store = mockTickets({
      attachments: [
        {
          id: 'a-1',
          ticketId: 't-1',
          fileName: 'screenshot.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          checksumSha256: 'abc',
          uploadedBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
          createdAt: '2026-08-25T00:00:00.000Z',
        },
      ],
    });
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger('click');

    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
    const buttons = wrapper.findAll('.ticket-detail__attachment button');
    expect(buttons.map((b) => b.text())).toEqual(['Download', 'Delete']);

    await buttons[1].trigger('click');
    expect(store.removeAttachment).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('screenshot.png');

    const confirmButton = wrapper.find('.form-actions').findAll('button')[1];
    await confirmButton.trigger('click');
    expect(store.removeAttachment).toHaveBeenCalledWith('t-1', 'a-1');
  });

  it('the discriminated pending state routes comment vs attachment deletes to the correct message key', async () => {
    mockAuth(['tickets:read', 'ticket-comments:write', 'tickets:manage'], 'u-1');
    const comment: TicketComment = {
      id: 'cm-1',
      ticketId: 't-1',
      author: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
      body: 'Mine',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    mockTickets({
      comments: [comment],
      attachments: [
        {
          id: 'a-1',
          ticketId: 't-1',
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 512,
          checksumSha256: 'abc',
          uploadedBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
          createdAt: '2026-08-25T00:00:00.000Z',
        },
      ],
    });
    const wrapper = await mountView();

    const commentDelete = wrapper.findAll('.ticket-detail__comment button').find((b) => b.text() === 'Delete')!;
    await commentDelete.trigger('click');
    expect(wrapper.text()).not.toContain('report.pdf');
    await wrapper.find('.form-actions').findAll('button')[0].trigger('click');

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger('click');
    const attachmentDelete = wrapper.findAll('.ticket-detail__attachment button').find((b) => b.text() === 'Delete')!;
    await attachmentDelete.trigger('click');
    expect(wrapper.text()).toContain('report.pdf');
  });

  it('the History tab has no form element at all', async () => {
    mockAuth(['tickets:read', 'tickets:write']);
    mockTickets({ history: [] });
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[3].trigger('click');

    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('resolves an assignedAgentId history value to a name when it matches a loaded agent, else falls back to the raw UUID', async () => {
    mockAuth(['tickets:read']);
    mockTickets({
      agents: [{ id: 'agent-1', fullName: 'Nour Hassan', email: 'nour@crm.local' }],
      history: [
        {
          id: 'h-1',
          ticketId: 't-1',
          field: 'assignedAgentId',
          oldValue: null,
          newValue: 'agent-1',
          changedBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
          createdAt: '2026-08-25T00:00:00.000Z',
        },
        {
          id: 'h-2',
          ticketId: 't-1',
          field: 'assignedAgentId',
          oldValue: 'agent-1',
          newValue: 'deactivated-unknown-id',
          changedBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
          createdAt: '2026-08-25T00:00:01.000Z',
        },
      ],
    });
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[3].trigger('click');

    const entries = wrapper.findAll('.ticket-detail__history-entry');
    expect(entries[0].text()).toContain('Nour Hassan');
    expect(entries[1].text()).toContain('deactivated-unknown-id');
  });

  it('the status select always offers all five statuses regardless of extra permissions', async () => {
    mockAuth(['tickets:read', 'tickets:write']);
    mockTickets();
    const wrapper = await mountView();

    const options = wrapper.find('.ticket-detail__controls select').findAll('option').map((o) => o.text());
    expect(options).toEqual(['Open', 'In progress', 'On hold', 'Resolved', 'Closed']);
  });

  it('calls tickets.clearDetail on unmount', async () => {
    mockAuth(['tickets:read']);
    const store = mockTickets();
    const wrapper = await mountView();

    wrapper.unmount();

    expect(store.clearDetail).toHaveBeenCalledTimes(1);
  });
});
