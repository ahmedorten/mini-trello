/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Development only. The password prefilled by the login test-user picker;
   *  must equal the API's SEED_DEV_USER_PASSWORD. Optional — the picker fills
   *  the email and leaves the password blank when it is absent. */
  readonly VITE_DEV_TEST_USER_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
