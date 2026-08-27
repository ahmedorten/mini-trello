/**
 * Development-only sign-in shortcuts for the login screen.
 *
 * Gated on `import.meta.env.DEV`, which Vite replaces with the literal `false`
 * in a production build — so this list, and the markup that renders it, are
 * removed by dead-code elimination rather than merely hidden at runtime
 * (Story 28 Product rule 1). There is deliberately no runtime flag that can
 * switch it back on.
 *
 * The three emails MUST match `devTestUsers` in apps/api/prisma/seed.ts, which
 * creates these accounts behind SEED_DEV_USERS=true. The duplication is
 * deliberate: apps/web cannot import from apps/api (Product rule 7).
 *
 * No password is stored here (Product rule 2). VITE_DEV_TEST_USER_PASSWORD
 * supplies one, and must be set to the same value as the API's
 * SEED_DEV_USER_PASSWORD. With it unset the picker fills the email only.
 */
export interface DevTestUser {
  email: string;
  fullName: string;
  /** A seeded role key. Rendered through the existing `role.<key>` i18n keys,
   *  so it must be one of them (Product rule 6). */
  roleKey: 'system-administrator' | 'support-agent' | 'customer';
}

const DEV_TEST_USERS: DevTestUser[] = [
  { email: 'dev.admin@crm.local', fullName: 'Dev System Administrator', roleKey: 'system-administrator' },
  { email: 'dev.agent@crm.local', fullName: 'Dev Support Agent', roleKey: 'support-agent' },
  { email: 'dev.customer@crm.local', fullName: 'Dev Customer', roleKey: 'customer' },
];

/** Empty in any production build, because the guard is a compile-time constant. */
export const devTestUsers: readonly DevTestUser[] = import.meta.env.DEV ? DEV_TEST_USERS : [];

/** The shared dev password, or '' when the variable is unset — Product rule 3. */
export const devTestUserPassword: string = import.meta.env.DEV
  ? (import.meta.env.VITE_DEV_TEST_USER_PASSWORD ?? '')
  : '';

/**
 * The picker's own UI strings, merged into vue-i18n at runtime (LoginView.vue)
 * rather than living in en.json/ar.json. `createI18n` loads those catalogues
 * whole, eagerly, with no per-key tree-shaking — so a string placed there
 * ships in the production bundle even while the component that renders it is
 * eliminated. Keeping the strings here, behind the same `import.meta.env.DEV`
 * check as the rest of this module, is what makes the Verification Step 5
 * grep for "Development test users" actually find nothing in `dist/`.
 */
export const devTestUserMessages: Record<'en' | 'ar', Record<string, unknown>> = import.meta.env.DEV
  ? {
      en: {
        auth: {
          testUsers: {
            title: 'Development test users',
            hint: 'Select an account to fill the form. You still need to sign in.',
            useThis: 'Use',
            useThisFor: 'Fill the form with {name}',
            passwordMissing: 'Set VITE_DEV_TEST_USER_PASSWORD in apps/web/.env to prefill the password too.',
          },
        },
      },
      ar: {
        auth: {
          testUsers: {
            title: 'مستخدمو الاختبار للتطوير',
            hint: 'اختر حساباً لتعبئة النموذج. لا يزال عليك تسجيل الدخول.',
            useThis: 'استخدام',
            useThisFor: 'تعبئة النموذج بحساب {name}',
            passwordMissing: 'اضبط VITE_DEV_TEST_USER_PASSWORD في apps/web/.env لتعبئة كلمة المرور أيضاً.',
          },
        },
      },
    }
  : { en: {}, ar: {} };
