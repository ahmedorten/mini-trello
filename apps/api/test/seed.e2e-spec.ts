import { PrismaClient } from '@prisma/client';
import { main } from '../prisma/seed';

describe('Seed (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs seed successfully', async () => {
    await expect(main()).resolves.not.toThrow();
  });

  it('creates exactly 3 app_settings rows', async () => {
    const count = await prisma.appSetting.count();
    expect(count).toBe(3);
  });

  it('contains expected app.name setting', async () => {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'app.name' },
    });

    expect(setting).toBeDefined();
    expect(setting?.value).toBe('Customer Support CRM');
  });

  it('is idempotent on second run', async () => {
    const countBefore = await prisma.appSetting.count();

    await expect(main()).resolves.not.toThrow();

    const countAfter = await prisma.appSetting.count();
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(3);
  });
});
