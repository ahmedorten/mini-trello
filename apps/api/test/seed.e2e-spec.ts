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

  it('creates exactly 16 permissions', async () => {
    const count = await prisma.permission.count();
    expect(count).toBe(16);
  });

  it('contains all six new customer-management permission keys', async () => {
    const keys = await prisma.permission.findMany({
      where: {
        key: {
          in: [
            'customers:read',
            'customers:write',
            'customers:archive',
            'notes:write',
            'attachments:write',
            'interactions:write',
          ],
        },
      },
      select: { key: true },
    });

    expect(keys).toHaveLength(6);
  });

  it('creates exactly 6 roles matching the named slugs', async () => {
    const roles = await prisma.role.findMany({ select: { key: true } });
    const keys = roles.map((role) => role.key).sort();

    expect(keys).toHaveLength(6);
    expect(keys).toEqual(
      [
        'crm-manager',
        'customer',
        'reporting-user',
        'support-agent',
        'support-supervisor',
        'system-administrator',
      ].sort(),
    );
  });

  it('grants the expected number of permissions per role', async () => {
    const [systemAdministrator, customer, supportAgent] = await Promise.all([
      prisma.role.findUniqueOrThrow({
        where: { key: 'system-administrator' },
        include: { _count: { select: { permissions: true } } },
      }),
      prisma.role.findUniqueOrThrow({
        where: { key: 'customer' },
        include: { _count: { select: { permissions: true } } },
      }),
      prisma.role.findUniqueOrThrow({
        where: { key: 'support-agent' },
        include: { _count: { select: { permissions: true } } },
      }),
    ]);

    expect(systemAdministrator._count.permissions).toBe(16);
    expect(customer._count.permissions).toBe(0);
    expect(supportAgent._count.permissions).toBe(7);
  });

  it('holds system-administrator to all 16 permission keys', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'system-administrator' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key).sort();
    const allKeys = (await prisma.permission.findMany({ select: { key: true } }))
      .map((p) => p.key)
      .sort();

    expect(keys).toEqual(allKeys);
  });

  it('grants support-agent the five customer keys without customers:archive', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-agent' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'customers:read',
        'customers:write',
        'notes:write',
        'attachments:write',
        'interactions:write',
      ]),
    );
    expect(keys).not.toContain('customers:archive');
  });

  it('does not grant support-supervisor customers:archive', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-supervisor' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).not.toContain('customers:archive');
  });

  it('still leaves customer holding zero permissions', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'customer' },
      include: { _count: { select: { permissions: true } } },
    });

    expect(role._count.permissions).toBe(0);
  });

  it('creates 2 departments and 1 branch', async () => {
    const [departmentCount, branchCount] = await Promise.all([
      prisma.department.count(),
      prisma.branch.count(),
    ]);

    expect(departmentCount).toBe(2);
    expect(branchCount).toBe(1);
  });

  it('creates an active bootstrap admin holding system-administrator', async () => {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
    const admin = await prisma.user.findUnique({ where: { email } });

    expect(admin).not.toBeNull();
    expect(admin?.isActive).toBe(true);

    const userRole = await prisma.userRole.findFirst({
      where: { userId: admin?.id },
      include: { role: true },
    });

    expect(userRole?.role.key).toBe('system-administrator');
  });

  it('leaves counts and the admin password hash unchanged, and refresh_tokens untouched, on a second run', async () => {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    // refreshTokensBefore, not a hard-coded 0: other e2e suites sharing this
    // database log in and mint refresh tokens of their own. This test only
    // asserts that re-running the seed itself leaves that table untouched.
    const [
      permissionsBefore,
      rolesBefore,
      departmentsBefore,
      branchesBefore,
      usersBefore,
      refreshTokensBefore,
      customersBefore,
    ] = await Promise.all([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.department.count(),
      prisma.branch.count(),
      prisma.user.count(),
      prisma.refreshToken.count(),
      prisma.customer.count(),
    ]);

    await expect(main()).resolves.not.toThrow();

    const after = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(after.passwordHash).toBe(before.passwordHash);
    await expect(prisma.permission.count()).resolves.toBe(permissionsBefore);
    await expect(prisma.role.count()).resolves.toBe(rolesBefore);
    await expect(prisma.department.count()).resolves.toBe(departmentsBefore);
    await expect(prisma.branch.count()).resolves.toBe(branchesBefore);
    await expect(prisma.user.count()).resolves.toBe(usersBefore);
    await expect(prisma.refreshToken.count()).resolves.toBe(refreshTokensBefore);
    // The seed invents no customer rows in any environment (see Product rules).
    await expect(prisma.customer.count()).resolves.toBe(customersBefore);
  });
});
