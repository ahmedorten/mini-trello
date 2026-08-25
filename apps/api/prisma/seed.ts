import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const settings: { key: string; value: string }[] = [
  { key: 'app.name', value: 'Customer Support CRM' },
  { key: 'app.schemaVersion', value: '1' },
  { key: 'app.seededBy', value: 'prisma/seed.ts' },
];

export async function main(): Promise<void> {
  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  const count = await prisma.appSetting.count();
  console.log(`Seed complete. app_settings rows: ${count}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
