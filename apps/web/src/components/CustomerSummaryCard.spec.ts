import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { getCustomer, type Customer } from '@/api/customers';
import CustomerSummaryCard from './CustomerSummaryCard.vue';

function mountCard(props: { customerId: string; ticketId?: string }) {
  return mount(CustomerSummaryCard, { props, global: { stubs: { RouterLink: true } } });
}

vi.mock('@/api/customers', async () => {
  const actual = await vi.importActual<typeof import('@/api/customers')>('@/api/customers');

  return { ...actual, getCustomer: vi.fn() };
});

const mockedGetCustomer = vi.mocked(getCustomer);

const sampleCustomer: Customer = {
  id: 'c-1',
  type: 'COMPANY',
  name: 'Orten Trading',
  companyName: 'Orten Trading LLC',
  email: 'contact@orten.example',
  phone: '+20 100 000 0000',
  alternatePhone: null,
  addressLine1: null,
  addressLine2: null,
  city: 'Cairo',
  country: 'Egypt',
  postalCode: null,
  status: 'ACTIVE',
  assignedAgent: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdBy: null,
  counts: { notes: 2, attachments: 1, interactions: 3 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

describe('CustomerSummaryCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedGetCustomer.mockReset();
  });

  it('renders the customer fields', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);

    const wrapper = mountCard({ customerId: 'c-1' });
    await flushPromises();

    expect(wrapper.text()).toContain('Orten Trading');
    expect(wrapper.text()).toContain('Cairo');
    expect(wrapper.text()).toContain('Nour Hassan');
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('3');
  });

  it('a 403 renders the no-access empty state rather than an error', async () => {
    mockedGetCustomer.mockRejectedValue(new Error('forbidden'));

    const wrapper = mountCard({ customerId: 'c-1' });
    await flushPromises();

    expect(wrapper.text()).toContain("You do not have access to this customer's details.");
  });

  it('wraps the email in dir="ltr"', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);

    const wrapper = mountCard({ customerId: 'c-1' });
    await flushPromises();

    const emailSpan = wrapper.findAll('span[dir="ltr"]').find((span) => span.text() === sampleCustomer.email);
    expect(emailSpan).toBeDefined();
  });

  it('does not embed the communication strip without a ticketId', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);

    const wrapper = mountCard({ customerId: 'c-1' });
    await flushPromises();

    expect(wrapper.findComponent({ name: 'CommunicationTimeline' }).exists()).toBe(false);
  });
});
