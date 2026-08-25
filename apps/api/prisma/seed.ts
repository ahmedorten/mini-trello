import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const settings: { key: string; value: string }[] = [
  { key: 'app.name', value: 'Customer Support CRM' },
  { key: 'app.schemaVersion', value: '1' },
  { key: 'app.seededBy', value: 'prisma/seed.ts' },
];

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Duplicated from src/auth/password.service.ts on purpose: prisma/seed.ts runs
 * through ts-node outside the Nest DI container, and importing an @Injectable()
 * would drag reflect-metadata and the module graph into the seed.
 * The digest format MUST stay byte-compatible with PasswordService.verify.
 */
async function hashPassword(plain: string): Promise<string> {
  const params = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain.normalize('NFKC'), salt, 64, params);

  return [
    'scrypt',
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

const permissions: { key: string; description: string }[] = [
  { key: 'users:read', description: 'View user accounts' },
  { key: 'users:write', description: 'Create and update user accounts' },
  { key: 'users:deactivate', description: 'Deactivate and reactivate user accounts' },
  { key: 'roles:read', description: 'View roles and their permissions' },
  { key: 'roles:assign', description: 'Assign and remove roles on a user' },
  { key: 'departments:read', description: 'View departments' },
  { key: 'departments:write', description: 'Create and update departments' },
  { key: 'branches:read', description: 'View branches' },
  { key: 'branches:write', description: 'Create and update branches' },
  { key: 'reports:read', description: 'View reports and dashboards' },
  { key: 'customers:read', description: 'View customers, their notes, attachments, and interactions' },
  { key: 'customers:write', description: 'Create and update customers' },
  { key: 'customers:archive', description: 'Archive and restore customers' },
  { key: 'notes:write', description: 'Add, edit, and delete customer notes' },
  { key: 'attachments:write', description: 'Upload and delete customer attachments' },
  { key: 'interactions:write', description: 'Log customer interactions' },
  { key: 'tickets:read', description: 'View tickets, their comments, attachments, and history' },
  { key: 'tickets:write', description: 'Create and update tickets, including status' },
  { key: 'tickets:manage', description: 'Delete a ticket comment or attachment created by someone else' },
  { key: 'ticket-comments:write', description: 'Add, edit, and delete ticket comments' },
  { key: 'ticket-attachments:write', description: 'Upload and delete ticket attachments' },
];

const roles: { key: string; name: string; description: string; permissions: string[] }[] = [
  {
    key: 'system-administrator',
    name: 'System Administrator',
    description: 'Full control over users, roles, and organisation structure.',
    permissions: permissions.map((permission) => permission.key),
  },
  {
    key: 'crm-manager',
    name: 'CRM Manager',
    description: 'Manages staff accounts, role assignments, and organisation structure.',
    permissions: [
      'users:read',
      'users:write',
      'users:deactivate',
      'roles:read',
      'roles:assign',
      'departments:read',
      'departments:write',
      'branches:read',
      'branches:write',
      'reports:read',
      'customers:read',
      'customers:write',
      'customers:archive',
      'notes:write',
      'attachments:write',
      'interactions:write',
      'tickets:read',
      'tickets:write',
      'tickets:manage',
      'ticket-comments:write',
      'ticket-attachments:write',
    ],
  },
  {
    key: 'support-supervisor',
    name: 'Support Supervisor',
    description: 'Reads staff records and reports; cannot change accounts.',
    permissions: [
      'users:read',
      'roles:read',
      'departments:read',
      'branches:read',
      'reports:read',
      'customers:read',
      'customers:write',
      'notes:write',
      'attachments:write',
      'interactions:write',
      'tickets:read',
      'tickets:write',
      'ticket-comments:write',
      'ticket-attachments:write',
    ],
  },
  {
    key: 'support-agent',
    name: 'Support Agent',
    description: 'Front-line agent. Sees organisation structure only.',
    permissions: [
      'departments:read',
      'branches:read',
      'customers:read',
      'customers:write',
      'notes:write',
      'attachments:write',
      'interactions:write',
      'tickets:read',
      'tickets:write',
      'ticket-comments:write',
      'ticket-attachments:write',
    ],
  },
  {
    key: 'customer',
    name: 'Customer',
    description: 'External account. No administrative permissions.',
    permissions: [],
  },
  {
    key: 'reporting-user',
    name: 'Reporting User',
    description: 'Read-only analytics access.',
    permissions: ['reports:read', 'departments:read', 'branches:read', 'customers:read', 'tickets:read'],
  },
];

const departments: { key: string; name: string }[] = [
  { key: 'customer-support', name: 'Customer Support' },
  { key: 'operations', name: 'Operations' },
];

const branches: { key: string; name: string; city: string }[] = [
  { key: 'head-office', name: 'Head Office', city: 'Cairo' },
];

async function seedBootstrapAdmin(): Promise<void> {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
  const fromEnv = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const generated = fromEnv ? null : randomBytes(18).toString('base64url');
  const password = fromEnv ?? generated!;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Never overwrite a password an administrator may already have rotated.
    // Re-running the seed must not reset live credentials.
    console.log(`Bootstrap admin ${email} already exists; password left unchanged.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        fullName: 'System Administrator',
        passwordHash: await hashPassword(password),
        mustChangePassword: !fromEnv,
      },
    });

    if (generated) {
      console.log(`Bootstrap admin created: ${email}`);
      console.log(`Generated password (shown once): ${generated}`);
    } else {
      console.log(`Bootstrap admin created: ${email} (password from BOOTSTRAP_ADMIN_PASSWORD)`);
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'system-administrator' } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // Idempotent on the composite primary key.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
}

export async function main(): Promise<void> {
  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const department of departments) {
    await prisma.department.upsert({
      where: { key: department.key },
      update: { name: department.name },
      create: department,
    });
  }

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { key: branch.key },
      update: { name: branch.name, city: branch.city },
      create: branch,
    });
  }

  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: { key: role.key, name: role.name, description: role.description },
    });

    const granted = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
      select: { id: true },
    });

    // Replace the grant set so removing a permission from this file actually
    // revokes it. Doing the delete and the re-insert in one transaction keeps
    // the role from being briefly permission-less under a concurrent request.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: record.id } }),
      prisma.rolePermission.createMany({
        data: granted.map((permission) => ({ roleId: record.id, permissionId: permission.id })),
      }),
    ]);
  }

  await seedBootstrapAdmin();

  const [settingCount, permissionCount, roleCount, userCount] = await Promise.all([
    prisma.appSetting.count(),
    prisma.permission.count(),
    prisma.role.count(),
    prisma.user.count(),
  ]);

  console.log(
    `Seed complete. app_settings: ${settingCount}, permissions: ${permissionCount}, ` +
      `roles: ${roleCount}, users: ${userCount}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
