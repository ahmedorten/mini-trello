import { PrismaClient } from '@prisma/client';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();

describe('Customer schema (e2e)', () => {
  let prisma: PrismaClient;
  let adminId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.$disconnect();
  });

  it('creates a customer with only name, defaulting status and type', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'E2E Minimal Customer' },
    });

    expect(customer.status).toBe('PROSPECT');
    expect(customer.type).toBe('INDIVIDUAL');
  });

  it('persists two customers with email: null — the nullable-unique proof', async () => {
    const first = await prisma.customer.create({
      data: { name: 'E2E No Email One', email: null },
    });
    const second = await prisma.customer.create({
      data: { name: 'E2E No Email Two', email: null },
    });

    expect(first.id).not.toBe(second.id);
    expect(first.email).toBeNull();
    expect(second.email).toBeNull();
  });

  it('rejects a second customer with the same non-null email with P2002', async () => {
    const email = `e2e-duplicate-${Date.now()}@e2e.local`;
    await prisma.customer.create({ data: { name: 'E2E Duplicate Email One', email } });

    await expect(prisma.customer.create({ data: { name: 'E2E Duplicate Email Two', email } })).rejects.toMatchObject(
      { code: 'P2002' },
    );
  });

  it('attaches a note, an attachment, and an interaction, and returns them through include', async () => {
    const customer = await prisma.customer.create({ data: { name: 'E2E With Children' } });

    await prisma.customerNote.create({
      data: { customerId: customer.id, authorId: adminId, body: 'E2E note body' },
    });
    await prisma.customerAttachment.create({
      data: {
        customerId: customer.id,
        uploadedById: adminId,
        fileName: 'e2e-file.txt',
        storageKey: `e2e-storage-key-${Date.now()}`,
        mimeType: 'text/plain',
        sizeBytes: 12,
        checksumSha256: 'a'.repeat(64),
      },
    });
    await prisma.customerInteraction.create({
      data: {
        customerId: customer.id,
        createdById: adminId,
        channel: 'PHONE',
        direction: 'OUTBOUND',
        subject: 'E2E interaction subject',
        occurredAt: new Date(),
      },
    });

    const withChildren = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { notes: true, attachments: true, interactions: true },
    });

    expect(withChildren.notes).toHaveLength(1);
    expect(withChildren.attachments).toHaveLength(1);
    expect(withChildren.interactions).toHaveLength(1);
  });

  it('cascades delete to notes, attachments, and interactions', async () => {
    const customer = await prisma.customer.create({ data: { name: 'E2E Cascade Target' } });

    await prisma.customerNote.create({
      data: { customerId: customer.id, authorId: adminId, body: 'E2E cascade note' },
    });
    await prisma.customerAttachment.create({
      data: {
        customerId: customer.id,
        uploadedById: adminId,
        fileName: 'e2e-cascade.txt',
        storageKey: `e2e-cascade-key-${Date.now()}`,
        mimeType: 'text/plain',
        sizeBytes: 5,
        checksumSha256: 'b'.repeat(64),
      },
    });
    await prisma.customerInteraction.create({
      data: {
        customerId: customer.id,
        createdById: adminId,
        channel: 'EMAIL',
        direction: 'INBOUND',
        subject: 'E2E cascade interaction',
        occurredAt: new Date(),
      },
    });

    // The application itself never issues customer.delete (ARCHIVED is the
    // terminal status) — this exercises the cascade as a database-level
    // guarantee against manual cleanup, not a supported product operation.
    await prisma.customer.delete({ where: { id: customer.id } });

    const [noteCount, attachmentCount, interactionCount] = await Promise.all([
      prisma.customerNote.count({ where: { customerId: customer.id } }),
      prisma.customerAttachment.count({ where: { customerId: customer.id } }),
      prisma.customerInteraction.count({ where: { customerId: customer.id } }),
    ]);

    expect(noteCount).toBe(0);
    expect(attachmentCount).toBe(0);
    expect(interactionCount).toBe(0);
  });

  it('rejects a note whose authorId is not a user with P2003', async () => {
    const customer = await prisma.customer.create({ data: { name: 'E2E Bad Author' } });

    await expect(
      prisma.customerNote.create({
        data: { customerId: customer.id, authorId: '00000000-0000-0000-0000-000000000000', body: 'orphan' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('orders interactions by occurredAt, independent of createdAt', async () => {
    const customer = await prisma.customer.create({ data: { name: 'E2E Interaction Order' } });

    const earlierOccurredLaterCreated = await prisma.customerInteraction.create({
      data: {
        customerId: customer.id,
        createdById: adminId,
        channel: 'CHAT',
        direction: 'INBOUND',
        subject: 'E2E occurred earlier, created later',
        occurredAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });
    const laterOccurredEarlierCreated = await prisma.customerInteraction.create({
      data: {
        customerId: customer.id,
        createdById: adminId,
        channel: 'MEETING',
        direction: 'OUTBOUND',
        subject: 'E2E occurred later, logged after the fact',
        occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    });

    const ordered = await prisma.customerInteraction.findMany({
      where: { customerId: customer.id },
      orderBy: { occurredAt: 'desc' },
    });

    expect(ordered[0]?.id).toBe(laterOccurredEarlierCreated.id);
    expect(ordered[1]?.id).toBe(earlierOccurredLaterCreated.id);
  });
});
