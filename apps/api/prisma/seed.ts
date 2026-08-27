import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const settings: { key: string; value: string }[] = [
  { key: 'app.name', value: 'Customer Support CRM' },
  { key: 'app.schemaVersion', value: '2' },
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
  { key: 'dashboard:read', description: 'View the agent dashboard and its ticket insights' },
  { key: 'tasks:read', description: 'View agent tasks and reminders' },
  { key: 'tasks:write', description: 'Create, update, and delete your own agent tasks' },
  { key: 'tasks:manage', description: 'Update or delete an agent task assigned to someone else' },
  { key: 'quick-replies:read', description: 'View the quick-reply catalogue' },
  { key: 'quick-replies:write', description: 'Create, update, and delete quick replies' },
  { key: 'tickets:assign', description: 'Assign a ticket to a user other than yourself' },
  { key: 'communication:send', description: 'Send a message through a communication channel' },
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
      'dashboard:read',
      'tasks:read',
      'tasks:write',
      'tasks:manage',
      'quick-replies:read',
      'quick-replies:write',
      'tickets:assign',
      'communication:send',
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
      'dashboard:read',
      'tasks:read',
      'tasks:write',
      'tasks:manage',
      'quick-replies:read',
      'tickets:assign',
      'communication:send',
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
      'dashboard:read',
      'tasks:read',
      'tasks:write',
      'quick-replies:read',
      'communication:send',
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
    permissions: [
      'reports:read',
      'departments:read',
      'branches:read',
      'customers:read',
      'tickets:read',
      'dashboard:read',
    ],
  },
];

const departments: { key: string; name: string }[] = [
  { key: 'customer-support', name: 'Customer Support' },
  { key: 'operations', name: 'Operations' },
];

const branches: { key: string; name: string; city: string }[] = [
  { key: 'head-office', name: 'Head Office', city: 'Cairo' },
];

const quickReplies: {
  key: string;
  locale: string;
  title: string;
  body: string;
  channel: string | null;
}[] = [
  { key: 'greeting', locale: 'en', title: 'Greeting', body: 'Hello, thank you for contacting Customer Support. How can I help you today?', channel: null },
  { key: 'greeting', locale: 'ar', title: 'ترحيب', body: 'مرحباً، شكراً لتواصلك مع خدمة العملاء. كيف يمكنني مساعدتك؟', channel: null },
  { key: 'investigating', locale: 'en', title: 'Investigating', body: 'Thank you for the details. I am looking into this now and will update you shortly.', channel: null },
  { key: 'investigating', locale: 'ar', title: 'جاري الفحص', body: 'شكراً على التفاصيل. أقوم بمراجعة الأمر الآن وسأوافيك بالتحديث قريباً.', channel: null },
  { key: 'need-more-info', locale: 'en', title: 'Need more information', body: 'Could you please share a screenshot and the exact time the issue happened?', channel: null },
  { key: 'need-more-info', locale: 'ar', title: 'نحتاج معلومات إضافية', body: 'هل يمكنك إرسال صورة للشاشة والوقت الذي حدثت فيه المشكلة؟', channel: null },
  { key: 'resolved', locale: 'en', title: 'Resolved', body: 'This has now been resolved. Please let us know if anything else comes up.', channel: null },
  { key: 'resolved', locale: 'ar', title: 'تم الحل', body: 'تم حل المشكلة. برجاء إخبارنا إذا واجهت أي أمر آخر.', channel: null },
  { key: 'sms-ack', locale: 'en', title: 'SMS acknowledgement', body: 'We received your message and a support agent will reply shortly.', channel: 'SMS' },
  { key: 'sms-ack', locale: 'ar', title: 'إشعار استلام SMS', body: 'تم استلام رسالتك وسيقوم أحد موظفي الدعم بالرد قريباً.', channel: 'SMS' },
];

/** Development/testing accounts, one per persona, seeded only behind
 *  SEED_DEV_USERS — Story 25 Product rules 8–11. Story 28's login picker reads
 *  the same three emails from its own frontend-side list; keep them in step.
 *  Passwords are never stored here: SEED_DEV_USER_PASSWORD supplies one. */
const devTestUsers: { email: string; fullName: string; roleKey: string }[] = [
  { email: 'dev.admin@crm.local', fullName: 'Dev System Administrator', roleKey: 'system-administrator' },
  { email: 'dev.agent@crm.local', fullName: 'Dev Support Agent', roleKey: 'support-agent' },
  { email: 'dev.customer@crm.local', fullName: 'Dev Customer', roleKey: 'customer' },
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

async function seedDevTestUsers(): Promise<void> {
  if (process.env.SEED_DEV_USERS !== 'true') {
    return;
  }

  // Product rule 8: the flag and a production NODE_ENV are a contradiction, and
  // the safe reading of a contradiction is to refuse, not to guess.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_DEV_USERS=true is refused with NODE_ENV=production. These accounts have known passwords.',
    );
  }

  // Product rule 9: no default. An account whose password ships in the
  // repository is worse than no account.
  const password = process.env.SEED_DEV_USER_PASSWORD;

  if (!password) {
    throw new Error('SEED_DEV_USERS=true requires SEED_DEV_USER_PASSWORD to be set.');
  }

  for (const persona of devTestUsers) {
    const email = persona.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Product rule 11 — the same decision seedBootstrapAdmin made at line 224.
      console.log(`Dev test user ${email} already exists; password left unchanged.`);
    } else {
      await prisma.user.create({
        data: {
          email,
          fullName: persona.fullName,
          passwordHash: await hashPassword(password),
          // Product rule 10: the mustChangePassword banner would open every one
          // of these sessions, and there is no screen to resolve it.
          mustChangePassword: false,
        },
      });
      console.log(`Dev test user created: ${email} (${persona.roleKey})`);
    }

    const role = await prisma.role.findUniqueOrThrow({ where: { key: persona.roleKey } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
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

  for (const reply of quickReplies) {
    await prisma.quickReply.upsert({
      where: { key_locale: { key: reply.key, locale: reply.locale } },
      update: { title: reply.title, body: reply.body, channel: reply.channel as never },
      create: { ...reply, channel: reply.channel as never },
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
  await seedDevTestUsers();

  const [settingCount, permissionCount, roleCount, userCount, quickReplyCount] = await Promise.all([
    prisma.appSetting.count(),
    prisma.permission.count(),
    prisma.role.count(),
    prisma.user.count(),
    prisma.quickReply.count(),
  ]);

  console.log(
    `Seed complete. app_settings: ${settingCount}, permissions: ${permissionCount}, ` +
      `roles: ${roleCount}, users: ${userCount}, quick_replies: ${quickReplyCount}`,
  );
}

// Guarded so importing `main` (as the e2e suite does) does not ALSO trigger
// this self-invocation — two concurrent runs of main() race on every
// check-then-create path (seedBootstrapAdmin, seedDevTestUsers) and can throw
// a unique-constraint violation against each other.
if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
