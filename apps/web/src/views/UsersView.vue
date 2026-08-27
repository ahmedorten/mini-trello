<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useUsersStore } from '@/stores/users';
import type { UserSortField, UserSummary } from '@/api/users';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppPagination from '@/components/AppPagination.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppButton from '@/components/AppButton.vue';
import AppSortHeader from '@/components/AppSortHeader.vue';

const auth = useAuthStore();
const users = useUsersStore();
const { t, d } = useI18n();

const isSystemAdministrator = computed(() => auth.user?.roles.includes('system-administrator') ?? false);

const availableRoles = computed(() =>
  users.roles.filter((role) => role.key !== 'system-administrator' || isSystemAdministrator.value),
);

function roleNames(roleKeys: string[]): string {
  return roleKeys
    .map((key) => users.roles.find((role) => role.key === key)?.name ?? key)
    .join(', ');
}

function isOwnRow(user: UserSummary): boolean {
  return user.id === auth.user?.id;
}

// --- filters -------------------------------------------------------------

const searchTerm = ref(users.filters.search ?? '');
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

watch(searchTerm, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    users.setSearch(value);
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
});

function onRoleFilterChange(event: Event): void {
  users.setRoleFilter((event.target as HTMLSelectElement).value);
}

function onStatusFilterChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as 'true' | 'false' | '';
  users.setStatusFilter(value);
}

function onPageChange(page: number): void {
  users.setPage(page);
}

function onPageSizeChange(pageSize: number): void {
  users.setPageSize(pageSize);
}

// AppSortHeader emits a bare string — the field prop values are typed at each
// call site, but the emit itself cannot carry a per-view union.
function onSort(field: string): void {
  users.setSort(field as UserSortField);
}

// --- create ----------------------------------------------------------------

const showCreateForm = ref(false);
const createForm = reactive({
  email: '',
  fullName: '',
  password: '',
  roleKeys: [] as string[],
  departmentId: '',
});

function openCreate(): void {
  createForm.email = '';
  createForm.fullName = '';
  createForm.password = '';
  createForm.roleKeys = [];
  createForm.departmentId = '';
  showCreateForm.value = true;
}

function cancelCreate(): void {
  showCreateForm.value = false;
}

async function submitCreate(): Promise<void> {
  const ok = await users.create({
    email: createForm.email,
    fullName: createForm.fullName,
    password: createForm.password,
    roleKeys: createForm.roleKeys,
    departmentId: createForm.departmentId || undefined,
  });

  if (ok) {
    showCreateForm.value = false;
  }
}

// --- edit --------------------------------------------------------------

const editingUser = ref<UserSummary | null>(null);
const editForm = reactive({ fullName: '', email: '', departmentId: '' });

function openEdit(user: UserSummary): void {
  editingUser.value = user;
  editForm.fullName = user.fullName;
  editForm.email = user.email;
  editForm.departmentId = user.department?.id ?? '';
}

function cancelEdit(): void {
  editingUser.value = null;
}

async function submitEdit(): Promise<void> {
  if (!editingUser.value) {
    return;
  }

  const ok = await users.update(editingUser.value.id, {
    fullName: editForm.fullName,
    email: editForm.email,
    departmentId: editForm.departmentId || null,
  });

  if (ok) {
    editingUser.value = null;
  }
}

// --- roles ---------------------------------------------------------------

const rolesEditingUser = ref<UserSummary | null>(null);
const rolesForm = ref<string[]>([]);

function openRoles(user: UserSummary): void {
  rolesEditingUser.value = user;
  rolesForm.value = [...user.roles];
}

function cancelRoles(): void {
  rolesEditingUser.value = null;
}

async function submitRoles(): Promise<void> {
  if (!rolesEditingUser.value) {
    return;
  }

  const ok = await users.setRoles(rolesEditingUser.value.id, rolesForm.value);

  if (ok) {
    rolesEditingUser.value = null;
  }
}

// --- reset password ------------------------------------------------------

const resettingUser = ref<UserSummary | null>(null);
const resetForm = reactive({ password: '' });

function openReset(user: UserSummary): void {
  resettingUser.value = user;
  resetForm.password = '';
}

function cancelReset(): void {
  resettingUser.value = null;
}

async function submitReset(): Promise<void> {
  if (!resettingUser.value) {
    return;
  }

  const ok = await users.resetPassword(resettingUser.value.id, resetForm.password);

  if (ok) {
    resettingUser.value = null;
  }
}

// --- status ----------------------------------------------------------------

async function deactivate(user: UserSummary): Promise<void> {
  if (window.confirm(t('user.action.deactivateConfirm', { name: user.fullName }))) {
    await users.setStatus(user.id, false);
  }
}

async function reactivate(user: UserSummary): Promise<void> {
  await users.setStatus(user.id, true);
}

onMounted(() => {
  void users.loadLookups();
  void users.load();
});
</script>

<template>
  <section>
    <header class="users__header">
      <h1>{{ t('user.list.title') }}</h1>
      <AppButton v-if="auth.can('users:write')" variant="primary" icon="plus" @click="openCreate">
        {{ t('user.list.createUser') }}
      </AppButton>
    </header>

    <form class="filter-bar" @submit.prevent>
      <label>
        {{ t('common.search') }}
        <input v-model="searchTerm" type="search" :placeholder="t('user.list.searchPlaceholder')">
      </label>

      <label>
        {{ t('user.field.roles') }}
        <select @change="onRoleFilterChange">
          <option value="">{{ t('user.list.allRoles') }}</option>
          <option v-for="role in users.roles" :key="role.key" :value="role.key">
            {{ role.name }}
          </option>
        </select>
      </label>

      <label>
        {{ t('user.field.status') }}
        <select @change="onStatusFilterChange">
          <option value="">{{ t('user.list.all') }}</option>
          <option value="true">{{ t('user.status.active') }}</option>
          <option value="false">{{ t('user.status.inactive') }}</option>
        </select>
      </label>
    </form>

    <div v-if="showCreateForm" class="users__panel">
      <h2>{{ t('user.form.createTitle') }}</h2>
      <form @submit.prevent="submitCreate">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          {{ t('user.field.email') }}
          <input v-model="createForm.email" type="email" required>
        </label>
        <label>
          {{ t('user.field.fullName') }}
          <input v-model="createForm.fullName" type="text" required>
        </label>
        <label>
          {{ t('user.field.password') }}
          <input v-model="createForm.password" type="password" required>
        </label>
        <label>
          {{ t('user.field.department') }}
          <select v-model="createForm.departmentId">
            <option value="">{{ t('user.form.noDepartment') }}</option>
            <option v-for="department in users.departments" :key="department.id" :value="department.id">
              {{ department.name }}
            </option>
          </select>
        </label>
        <fieldset>
          <legend>{{ t('user.form.rolesLegend') }}</legend>
          <label v-for="role in availableRoles" :key="role.key" class="users__checkbox">
            <input v-model="createForm.roleKeys" type="checkbox" :value="role.key">
            {{ role.name }}
          </label>
        </fieldset>

        <div class="users__panel-actions">
          <button type="submit" :disabled="createForm.roleKeys.length === 0">{{ t('common.save') }}</button>
          <button type="button" @click="cancelCreate">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>

    <AppStateBlock v-if="users.isLoading && !users.items.length" variant="loading" :message="t('user.list.loading')" />

    <AppStateBlock
      v-else-if="users.error && !users.items.length"
      variant="error"
      :message="users.error"
      class="users__error-block"
    />

    <AppStateBlock v-else-if="!users.items.length" variant="empty" :message="t('user.list.empty')" />

    <template v-else>
      <div class="data-table-wrap">
        <table class="data-table">
          <caption class="sr-only">{{ t('user.list.caption') }}</caption>
          <thead>
            <tr>
              <AppSortHeader field="fullName" :label="t('user.field.name')" :active-field="users.filters.sort" :active-order="users.filters.order" @sort="onSort" />
              <AppSortHeader field="email" :label="t('user.field.email')" :active-field="users.filters.sort" :active-order="users.filters.order" @sort="onSort" />
              <th scope="col">{{ t('user.field.roles') }}</th>
              <th scope="col">{{ t('user.field.department') }}</th>
              <AppSortHeader field="isActive" :label="t('user.field.status')" :active-field="users.filters.sort" :active-order="users.filters.order" @sort="onSort" />
              <AppSortHeader field="lastLoginAt" :label="t('user.field.lastLogin')" :active-field="users.filters.sort" :active-order="users.filters.order" @sort="onSort" />
              <th scope="col">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users.items" :key="user.id">
              <td>{{ user.fullName }}</td>
              <td><span dir="ltr">{{ user.email }}</span></td>
              <td>{{ roleNames(user.roles) }}</td>
              <td>{{ user.department?.name ?? '—' }}</td>
              <td>
                <AppBadge :tone="user.isActive ? 'ok' : 'neutral'">
                  {{ user.isActive ? t('user.status.active') : t('user.status.inactive') }}
                </AppBadge>
              </td>
              <td>{{ user.lastLoginAt ? d(new Date(user.lastLoginAt), 'long') : t('user.status.never') }}</td>
              <td class="data-table__actions">
                <button v-if="auth.can('users:write')" type="button" @click="openEdit(user)">{{ t('common.edit') }}</button>
                <button v-if="auth.can('roles:assign')" type="button" @click="openRoles(user)">{{ t('user.action.roles') }}</button>
                <button
                  v-if="auth.can('users:deactivate') && !isOwnRow(user) && user.isActive"
                  type="button"
                  @click="deactivate(user)"
                >
                  {{ t('user.action.deactivate') }}
                </button>
                <button
                  v-if="auth.can('users:deactivate') && !isOwnRow(user) && !user.isActive"
                  type="button"
                  @click="reactivate(user)"
                >
                  {{ t('user.action.reactivate') }}
                </button>
                <button v-if="auth.can('users:write')" type="button" @click="openReset(user)">
                  {{ t('user.action.resetPassword') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="users__pagination">
        <AppPagination
          v-if="users.meta"
          :page="users.meta.page"
          :total-pages="users.meta.totalPages"
          :total="users.meta.total"
          :page-size="users.meta.pageSize"
          @change="onPageChange"
          @page-size-change="onPageSizeChange"
        />
      </div>
    </template>

    <div v-if="editingUser" class="users__panel">
      <h2>{{ t('user.form.editTitle', { name: editingUser.fullName }) }}</h2>
      <form @submit.prevent="submitEdit">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          {{ t('user.field.fullName') }}
          <input v-model="editForm.fullName" type="text" required>
        </label>
        <label>
          {{ t('user.field.email') }}
          <input v-model="editForm.email" type="email" required>
        </label>
        <label>
          {{ t('user.field.department') }}
          <select v-model="editForm.departmentId">
            <option value="">{{ t('user.form.noDepartment') }}</option>
            <option v-for="department in users.departments" :key="department.id" :value="department.id">
              {{ department.name }}
            </option>
          </select>
        </label>

        <div class="users__panel-actions">
          <button type="submit">{{ t('common.save') }}</button>
          <button type="button" @click="cancelEdit">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>

    <div v-if="rolesEditingUser" class="users__panel">
      <h2>{{ t('user.form.rolesTitle', { name: rolesEditingUser.fullName }) }}</h2>
      <form @submit.prevent="submitRoles">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label v-for="role in availableRoles" :key="role.key" class="users__checkbox">
          <input v-model="rolesForm" type="checkbox" :value="role.key">
          {{ role.name }}
        </label>

        <div class="users__panel-actions">
          <button type="submit">{{ t('common.save') }}</button>
          <button type="button" @click="cancelRoles">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>

    <div v-if="resettingUser" class="users__panel">
      <h2>{{ t('user.form.resetTitle', { name: resettingUser.fullName }) }}</h2>
      <p>{{ t('user.form.resetHint', { name: resettingUser.fullName }) }}</p>
      <form @submit.prevent="submitReset">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          {{ t('user.field.newPassword') }}
          <input v-model="resetForm.password" type="password" required>
        </label>

        <div class="users__panel-actions">
          <button type="submit">{{ t('common.save') }}</button>
          <button type="button" @click="cancelReset">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.users__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.users__error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  margin-block-end: var(--space-4);
}

.users__error-block {
  margin-block-end: var(--space-4);
}

.users__panel {
  margin-block-start: var(--space-5);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.users__panel form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.users__panel label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.users__checkbox {
  flex-direction: row !important;
  align-items: center;
  gap: var(--space-2);
}

.users__panel-actions {
  display: flex;
  gap: var(--space-2);
}
</style>
