import { describe, expect, it } from 'vitest';
import { devTestUserPassword, devTestUsers } from './devTestUsers';

describe('devTestUsers', () => {
  it('exposes exactly three personas under Vitest, where import.meta.env.DEV is true', () => {
    expect(devTestUsers).toHaveLength(3);
  });

  it('covers the system-administrator, support-agent, and customer roles, one each', () => {
    const roleKeys = devTestUsers.map((user) => user.roleKey).sort();

    expect(roleKeys).toEqual(['customer', 'support-agent', 'system-administrator']);
  });

  it('uses the dev.*@crm.local emails that prisma/seed.ts creates', () => {
    const emails = devTestUsers.map((user) => user.email);

    expect(emails).toEqual(['dev.admin@crm.local', 'dev.agent@crm.local', 'dev.customer@crm.local']);
  });

  it('contains no password literal', () => {
    // devTestUserPassword is driven entirely by the env var under Vitest,
    // where VITE_DEV_TEST_USER_PASSWORD is unset — never a constant.
    expect(devTestUserPassword).toBe('');
  });
});
