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

  it('creates exactly 29 permissions', async () => {
    const count = await prisma.permission.count();
    expect(count).toBe(29);
  });

  it('contains the communication:send permission key', async () => {
    const key = await prisma.permission.findUnique({
      where: { key: 'communication:send' },
      select: { key: true },
    });

    expect(key).not.toBeNull();
  });

  it('grants communication:send to the four staff roles and no others', async () => {
    const roles = await prisma.role.findMany({
      where: { permissions: { some: { permission: { key: 'communication:send' } } } },
      select: { key: true },
    });

    expect(roles.map((role) => role.key).sort()).toEqual(
      ['crm-manager', 'support-agent', 'support-supervisor', 'system-administrator'].sort(),
    );
  });

  it('contains all six customer-management permission keys', async () => {
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

  it('contains all five new ticket-management permission keys', async () => {
    const keys = await prisma.permission.findMany({
      where: {
        key: {
          in: ['tickets:read', 'tickets:write', 'tickets:manage', 'ticket-comments:write', 'ticket-attachments:write'],
        },
      },
      select: { key: true },
    });

    expect(keys).toHaveLength(5);
  });

  it('contains all seven new agent-workspace permission keys', async () => {
    const keys = await prisma.permission.findMany({
      where: {
        key: {
          in: [
            'dashboard:read',
            'tasks:read',
            'tasks:write',
            'tasks:manage',
            'quick-replies:read',
            'quick-replies:write',
            'tickets:assign',
          ],
        },
      },
      select: { key: true },
    });

    expect(keys).toHaveLength(7);
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

    expect(systemAdministrator._count.permissions).toBe(29);
    expect(customer._count.permissions).toBe(0);
    expect(supportAgent._count.permissions).toBe(16);
  });

  it("holds system-administrator's grant count equal to the total permission count", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'system-administrator' },
      include: { _count: { select: { permissions: true } } },
    });
    const permissionCount = await prisma.permission.count();

    expect(role._count.permissions).toBe(permissionCount);
  });

  it('holds system-administrator to all permission keys', async () => {
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

  it('grants support-agent and support-supervisor the four ticket keys but not tickets:manage', async () => {
    const [supportAgent, supportSupervisor] = await Promise.all([
      prisma.role.findUniqueOrThrow({
        where: { key: 'support-agent' },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      }),
      prisma.role.findUniqueOrThrow({
        where: { key: 'support-supervisor' },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      }),
    ]);

    for (const role of [supportAgent, supportSupervisor]) {
      const keys = role.permissions.map((rp) => rp.permission.key);

      expect(keys).toEqual(
        expect.arrayContaining(['tickets:read', 'tickets:write', 'ticket-comments:write', 'ticket-attachments:write']),
      );
      expect(keys).not.toContain('tickets:manage');
    }
  });

  it('holds reporting-user to tickets:read only, not tickets:write', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'reporting-user' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).toContain('tickets:read');
    expect(keys).not.toContain('tickets:write');
  });

  it('grants crm-manager all seven new agent-workspace permission keys', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'crm-manager' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'dashboard:read',
        'tasks:read',
        'tasks:write',
        'tasks:manage',
        'quick-replies:read',
        'quick-replies:write',
        'tickets:assign',
      ]),
    );
  });

  it('grants support-supervisor the new keys but not quick-replies:write', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-supervisor' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'dashboard:read',
        'tasks:read',
        'tasks:write',
        'tasks:manage',
        'quick-replies:read',
        'tickets:assign',
      ]),
    );
    expect(keys).not.toContain('quick-replies:write');
  });

  it('grants support-agent exactly dashboard:read, tasks:read, tasks:write, quick-replies:read from the new set', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-agent' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);
    const newKeys = [
      'dashboard:read',
      'tasks:read',
      'tasks:write',
      'tasks:manage',
      'quick-replies:read',
      'quick-replies:write',
      'tickets:assign',
    ];
    const grantedNewKeys = newKeys.filter((key) => keys.includes(key)).sort();

    expect(grantedNewKeys).toEqual(['dashboard:read', 'quick-replies:read', 'tasks:read', 'tasks:write'].sort());
    expect(keys).not.toContain('tasks:manage');
    expect(keys).not.toContain('tickets:assign');
    expect(keys).not.toContain('quick-replies:write');
  });

  it('holds reporting-user to dashboard:read and no other new agent-workspace key', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'reporting-user' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });

    const keys = role.permissions.map((rp) => rp.permission.key);

    expect(keys).toContain('dashboard:read');
    expect(keys).not.toContain('tasks:read');
    expect(keys).not.toContain('tasks:write');
    expect(keys).not.toContain('tasks:manage');
    expect(keys).not.toContain('quick-replies:read');
    expect(keys).not.toContain('quick-replies:write');
    expect(keys).not.toContain('tickets:assign');
  });

  it('still grants customer none of the new agent-workspace keys', async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: 'customer' },
      include: { _count: { select: { permissions: true } } },
    });

    expect(role._count.permissions).toBe(0);
  });

  it('seeds at least ten quick replies, every key present in both en and ar', async () => {
    const replies = await prisma.quickReply.findMany({ select: { key: true, locale: true } });

    expect(replies.length).toBeGreaterThanOrEqual(10);

    const keys = [...new Set(replies.map((reply) => reply.key))];
    for (const key of keys) {
      const locales = replies.filter((reply) => reply.key === key).map((reply) => reply.locale);
      expect(locales).toEqual(expect.arrayContaining(['en', 'ar']));
    }
  });

  it("sets app.schemaVersion to '2'", async () => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'app.schemaVersion' } });

    expect(setting?.value).toBe('2');
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
      quickRepliesBefore,
    ] = await Promise.all([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.department.count(),
      prisma.branch.count(),
      prisma.user.count(),
      prisma.refreshToken.count(),
      prisma.customer.count(),
      prisma.quickReply.count(),
    ]);

    const supportAgentBefore = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-agent' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    const supportAgentKeysBefore = supportAgentBefore.permissions.map((rp) => rp.permission.key).sort();

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
    // Re-running the seed re-syncs quick-reply bodies but must not duplicate rows.
    await expect(prisma.quickReply.count()).resolves.toBe(quickRepliesBefore);

    const supportAgentAfter = await prisma.role.findUniqueOrThrow({
      where: { key: 'support-agent' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    const supportAgentKeysAfter = supportAgentAfter.permissions.map((rp) => rp.permission.key).sort();

    expect(supportAgentKeysAfter).toEqual(supportAgentKeysBefore);
  });

  describe('dev test users (Story 25)', () => {
    const DEV_EMAILS = ['dev.admin@crm.local', 'dev.agent@crm.local', 'dev.customer@crm.local'];
    let originalSeedDevUsers: string | undefined;
    let originalSeedDevPassword: string | undefined;
    let originalNodeEnv: string | undefined;

    beforeEach(async () => {
      originalSeedDevUsers = process.env.SEED_DEV_USERS;
      originalSeedDevPassword = process.env.SEED_DEV_USER_PASSWORD;
      originalNodeEnv = process.env.NODE_ENV;

      // Establish a known-clean starting state: another test in this file (or
      // a developer's own `npm run prisma:seed`) may already have created
      // these accounts. Each guard test asserts against its OWN effect, not
      // against whatever the database happened to hold beforehand.
      await prisma.user.deleteMany({ where: { email: { in: DEV_EMAILS } } });
    });

    afterEach(async () => {
      if (originalSeedDevUsers === undefined) delete process.env.SEED_DEV_USERS;
      else process.env.SEED_DEV_USERS = originalSeedDevUsers;

      if (originalSeedDevPassword === undefined) delete process.env.SEED_DEV_USER_PASSWORD;
      else process.env.SEED_DEV_USER_PASSWORD = originalSeedDevPassword;

      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;

      await prisma.user.deleteMany({ where: { email: { in: DEV_EMAILS } } });
    });

    it('with SEED_DEV_USERS unset creates no dev.*@crm.local user', async () => {
      delete process.env.SEED_DEV_USERS;

      await expect(main()).resolves.not.toThrow();

      const count = await prisma.user.count({ where: { email: { in: DEV_EMAILS } } });
      expect(count).toBe(0);
    });

    it('SEED_DEV_USERS=true with NODE_ENV=production throws and creates no dev user', async () => {
      process.env.SEED_DEV_USERS = 'true';
      process.env.SEED_DEV_USER_PASSWORD = 'Passw0rd1234';
      process.env.NODE_ENV = 'production';

      await expect(main()).rejects.toThrow(/NODE_ENV=production/);

      const count = await prisma.user.count({ where: { email: { in: DEV_EMAILS } } });
      expect(count).toBe(0);
    });

    it('SEED_DEV_USERS=true with no SEED_DEV_USER_PASSWORD throws and creates no dev user', async () => {
      process.env.SEED_DEV_USERS = 'true';
      delete process.env.SEED_DEV_USER_PASSWORD;
      process.env.NODE_ENV = 'development';

      await expect(main()).rejects.toThrow(/SEED_DEV_USER_PASSWORD/);

      const count = await prisma.user.count({ where: { email: { in: DEV_EMAILS } } });
      expect(count).toBe(0);
    });
  });
});
