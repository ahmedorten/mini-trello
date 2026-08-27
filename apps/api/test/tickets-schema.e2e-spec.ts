import { PrismaClient } from '@prisma/client';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();

describe('Ticket schema (e2e)', () => {
  let prisma: PrismaClient;
  let adminId: string;
  let customerId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    adminId = admin.id;

    const customer = await prisma.customer.create({ data: { name: 'E2E Ticket Fixture Customer' } });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.$disconnect();
  });

  it('creates a ticket with only customerId/subject/description, defaulting category/priority/status', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E Minimal Ticket', description: 'Minimal ticket description' },
    });

    expect(ticket.category).toBe('GENERAL');
    expect(ticket.priority).toBe('MEDIUM');
    expect(ticket.status).toBe('OPEN');
  });

  it('rejects a ticket referencing an unknown customerId with P2003', async () => {
    await expect(
      prisma.ticket.create({
        data: {
          customerId: '00000000-0000-0000-0000-000000000000',
          subject: 'E2E Bad Customer',
          description: 'Should fail',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('attaches a comment, an attachment, and a history row, and returns them through include', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E With Children', description: 'Ticket with children' },
    });

    await prisma.ticketComment.create({
      data: { ticketId: ticket.id, authorId: adminId, body: 'E2E comment body' },
    });
    await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: adminId,
        fileName: 'e2e-ticket-file.txt',
        storageKey: `e2e-ticket-storage-key-${Date.now()}`,
        mimeType: 'text/plain',
        sizeBytes: 12,
        checksumSha256: 'a'.repeat(64),
      },
    });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: adminId,
        field: 'status',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
      },
    });

    const withChildren = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: { comments: true, attachments: true, history: true },
    });

    expect(withChildren.comments).toHaveLength(1);
    expect(withChildren.attachments).toHaveLength(1);
    expect(withChildren.history).toHaveLength(1);
  });

  it('cascades delete to comments, attachments, and history', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E Cascade Target', description: 'Cascade target' },
    });

    await prisma.ticketComment.create({
      data: { ticketId: ticket.id, authorId: adminId, body: 'E2E cascade comment' },
    });
    await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: adminId,
        fileName: 'e2e-cascade.txt',
        storageKey: `e2e-ticket-cascade-key-${Date.now()}`,
        mimeType: 'text/plain',
        sizeBytes: 5,
        checksumSha256: 'b'.repeat(64),
      },
    });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: adminId,
        field: 'priority',
        oldValue: 'MEDIUM',
        newValue: 'HIGH',
      },
    });

    // No API route ever deletes a ticket (see Product rules) — this exercises
    // the cascade as a database-level guarantee, not a supported operation.
    await prisma.ticket.delete({ where: { id: ticket.id } });

    const [commentCount, attachmentCount, historyCount] = await Promise.all([
      prisma.ticketComment.count({ where: { ticketId: ticket.id } }),
      prisma.ticketAttachment.count({ where: { ticketId: ticket.id } }),
      prisma.ticketHistory.count({ where: { ticketId: ticket.id } }),
    ]);

    expect(commentCount).toBe(0);
    expect(attachmentCount).toBe(0);
    expect(historyCount).toBe(0);
  });

  it('rejects a comment whose authorId is not a user with P2003', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E Bad Author', description: 'Bad author ticket' },
    });

    await expect(
      prisma.ticketComment.create({
        data: { ticketId: ticket.id, authorId: '00000000-0000-0000-0000-000000000000', body: 'orphan' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('orders history newest-first', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId, subject: 'E2E History Order', description: 'History order ticket' },
    });

    const first = await prisma.ticketHistory.create({
      data: { ticketId: ticket.id, changedById: adminId, field: 'status', oldValue: 'OPEN', newValue: 'IN_PROGRESS' },
    });
    const second = await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: adminId,
        field: 'status',
        oldValue: 'IN_PROGRESS',
        newValue: 'RESOLVED',
      },
    });

    const ordered = await prisma.ticketHistory.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(ordered[0]?.id).toBe(second.id);
    expect(ordered[1]?.id).toBe(first.id);
  });

  it('has indexes on created_at and updated_at (Story 25)', async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'tickets'
    `;
    const names = indexes.map((row) => row.indexname);

    expect(names).toEqual(expect.arrayContaining(['tickets_created_at_idx', 'tickets_updated_at_idx']));
  });
});
