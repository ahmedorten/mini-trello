import { PrismaClient } from '@prisma/client';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();

describe('Agent workspace schema (e2e)', () => {
  let prisma: PrismaClient;
  let adminId: string;
  let customerId: string;
  let ticketId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    adminId = admin.id;

    const customer = await prisma.customer.create({ data: { name: 'E2E Agent Workspace Fixture Customer' } });
    customerId = customer.id;

    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E Agent Workspace Fixture Ticket', description: 'Fixture ticket' },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.agentTask.deleteMany({ where: { title: { startsWith: 'E2E ' } } });
    await prisma.quickReply.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
    await prisma.customerInteraction.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.$disconnect();
  });

  it('creates an agent task with only title/assigneeId/createdById, defaulting status to OPEN', async () => {
    const task = await prisma.agentTask.create({
      data: { title: 'E2E Minimal Task', assigneeId: adminId, createdById: adminId },
    });

    expect(task.status).toBe('OPEN');
    expect(task.notes).toBeNull();
    expect(task.dueAt).toBeNull();
    expect(task.remindAt).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.ticketId).toBeNull();
    expect(task.customerId).toBeNull();
  });

  it('creates a quick reply with only key/locale/title/body, defaulting isActive to true', async () => {
    const reply = await prisma.quickReply.create({
      data: { key: 'e2e-minimal', locale: 'en', title: 'E2E Minimal Reply', body: 'E2E body' },
    });

    expect(reply.isActive).toBe(true);
    expect(reply.channel).toBeNull();
    expect(reply.createdById).toBeNull();
  });

  it('rejects a second quick reply with the same (key, locale) with P2002', async () => {
    await prisma.quickReply.create({
      data: { key: 'e2e-dup', locale: 'en', title: 'E2E Dup One', body: 'E2E body one' },
    });

    await expect(
      prisma.quickReply.create({
        data: { key: 'e2e-dup', locale: 'en', title: 'E2E Dup Two', body: 'E2E body two' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same key with a different locale', async () => {
    await prisma.quickReply.create({
      data: { key: 'e2e-multi-locale', locale: 'en', title: 'E2E Multi EN', body: 'E2E body en' },
    });
    const arReply = await prisma.quickReply.create({
      data: { key: 'e2e-multi-locale', locale: 'ar', title: 'E2E Multi AR', body: 'E2E body ar' },
    });

    expect(arReply.locale).toBe('ar');
  });

  it('accepts a customer interaction with ticketId: null', async () => {
    const interaction = await prisma.customerInteraction.create({
      data: {
        customerId,
        createdById: adminId,
        channel: 'PHONE',
        direction: 'OUTBOUND',
        subject: 'E2E Interaction No Ticket',
        occurredAt: new Date(),
        ticketId: null,
      },
    });

    expect(interaction.ticketId).toBeNull();
  });

  it('accepts a customer interaction with a valid ticketId', async () => {
    const interaction = await prisma.customerInteraction.create({
      data: {
        customerId,
        createdById: adminId,
        channel: 'EMAIL',
        direction: 'INBOUND',
        subject: 'E2E Interaction With Ticket',
        occurredAt: new Date(),
        ticketId,
      },
    });

    expect(interaction.ticketId).toBe(ticketId);
  });

  it('rejects a customer interaction with an unknown ticketId with P2003', async () => {
    await expect(
      prisma.customerInteraction.create({
        data: {
          customerId,
          createdById: adminId,
          channel: 'CHAT',
          direction: 'OUTBOUND',
          subject: 'E2E Interaction Bad Ticket',
          occurredAt: new Date(),
          ticketId: '00000000-0000-0000-0000-000000000000',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('accepts all eight InteractionChannel values on a customer interaction insert', async () => {
    const channels = ['PHONE', 'EMAIL', 'CHAT', 'MEETING', 'OTHER', 'WHATSAPP', 'SMS', 'WEB_FORM'] as const;

    for (const channel of channels) {
      const interaction = await prisma.customerInteraction.create({
        data: {
          customerId,
          createdById: adminId,
          channel,
          direction: 'OUTBOUND',
          subject: `E2E Channel ${channel}`,
          occurredAt: new Date(),
        },
      });

      expect(interaction.channel).toBe(channel);
    }
  });

  it('declares the customer_interactions ticket_id foreign key ON DELETE SET NULL', async () => {
    // Asserted via information_schema rather than by deleting a ticket:
    // tickets are never deleted in this project (see Product rule 3 context).
    const rows = await prisma.$queryRaw<{ delete_rule: string }[]>`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      WHERE rc.constraint_name = 'customer_interactions_ticket_id_fkey'
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.delete_rule).toBe('SET NULL');
  });
});
