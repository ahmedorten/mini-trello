<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useUsersStore } from '@/stores/users';
import type { UserSummary } from '@/api/users';

const auth = useAuthStore();
const users = useUsersStore();

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

function previousPage(): void {
  if (users.meta && users.filters.page > 1) {
    users.setPage(users.filters.page - 1);
  }
}

function nextPage(): void {
  if (users.meta && users.filters.page < users.meta.totalPages) {
    users.setPage(users.filters.page + 1);
  }
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
  if (window.confirm(`Deactivate ${user.fullName}? They will be signed out everywhere.`)) {
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
      <h1>Users</h1>
      <button v-if="auth.can('users:write')" type="button" @click="openCreate">Create user</button>
    </header>

    <form class="users__filters" @submit.prevent>
      <label>
        Search
        <input v-model="searchTerm" type="search" placeholder="Name or email">
      </label>

      <label>
        Role
        <select @change="onRoleFilterChange">
          <option value="">All roles</option>
          <option v-for="role in users.roles" :key="role.key" :value="role.key">
            {{ role.name }}
          </option>
        </select>
      </label>

      <label>
        Status
        <select @change="onStatusFilterChange">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
    </form>

    <div v-if="showCreateForm" class="users__panel">
      <h2>Create user</h2>
      <form @submit.prevent="submitCreate">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          Email
          <input v-model="createForm.email" type="email" required>
        </label>
        <label>
          Full name
          <input v-model="createForm.fullName" type="text" required>
        </label>
        <label>
          Password
          <input v-model="createForm.password" type="password" required>
        </label>
        <label>
          Department
          <select v-model="createForm.departmentId">
            <option value="">No department</option>
            <option v-for="department in users.departments" :key="department.id" :value="department.id">
              {{ department.name }}
            </option>
          </select>
        </label>
        <fieldset>
          <legend>Roles</legend>
          <label v-for="role in availableRoles" :key="role.key" class="users__checkbox">
            <input v-model="createForm.roleKeys" type="checkbox" :value="role.key">
            {{ role.name }}
          </label>
        </fieldset>

        <div class="users__panel-actions">
          <button type="submit" :disabled="createForm.roleKeys.length === 0">Save</button>
          <button type="button" @click="cancelCreate">Cancel</button>
        </div>
      </form>
    </div>

    <p v-if="users.isLoading && !users.items.length">Loading users…</p>

    <div v-else-if="users.error && !users.items.length" role="alert" class="users__error">
      {{ users.error }}
    </div>

    <p v-else-if="!users.items.length">No users match these filters.</p>

    <template v-else>
      <div class="users__table-wrap">
        <table class="users__table">
          <caption class="sr-only">User accounts</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Roles</th>
              <th scope="col">Department</th>
              <th scope="col">Status</th>
              <th scope="col">Last login</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users.items" :key="user.id">
              <td>{{ user.fullName }}</td>
              <td>{{ user.email }}</td>
              <td>{{ roleNames(user.roles) }}</td>
              <td>{{ user.department?.name ?? '—' }}</td>
              <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
              <td>{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never' }}</td>
              <td class="users__actions">
                <button v-if="auth.can('users:write')" type="button" @click="openEdit(user)">Edit</button>
                <button v-if="auth.can('roles:assign')" type="button" @click="openRoles(user)">Roles</button>
                <button
                  v-if="auth.can('users:deactivate') && !isOwnRow(user) && user.isActive"
                  type="button"
                  @click="deactivate(user)"
                >
                  Deactivate
                </button>
                <button
                  v-if="auth.can('users:deactivate') && !isOwnRow(user) && !user.isActive"
                  type="button"
                  @click="reactivate(user)"
                >
                  Reactivate
                </button>
                <button v-if="auth.can('users:write')" type="button" @click="openReset(user)">
                  Reset password
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="users__pagination">
        <button type="button" :disabled="!users.meta || users.meta.page <= 1" @click="previousPage">
          Previous
        </button>
        <span v-if="users.meta">
          Page {{ users.meta.page }} of {{ users.meta.totalPages }} — {{ users.meta.total }} total
        </span>
        <button
          type="button"
          :disabled="!users.meta || users.meta.page >= users.meta.totalPages"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </template>

    <div v-if="editingUser" class="users__panel">
      <h2>Edit {{ editingUser.fullName }}</h2>
      <form @submit.prevent="submitEdit">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          Full name
          <input v-model="editForm.fullName" type="text" required>
        </label>
        <label>
          Email
          <input v-model="editForm.email" type="email" required>
        </label>
        <label>
          Department
          <select v-model="editForm.departmentId">
            <option value="">No department</option>
            <option v-for="department in users.departments" :key="department.id" :value="department.id">
              {{ department.name }}
            </option>
          </select>
        </label>

        <div class="users__panel-actions">
          <button type="submit">Save</button>
          <button type="button" @click="cancelEdit">Cancel</button>
        </div>
      </form>
    </div>

    <div v-if="rolesEditingUser" class="users__panel">
      <h2>Roles for {{ rolesEditingUser.fullName }}</h2>
      <form @submit.prevent="submitRoles">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label v-for="role in availableRoles" :key="role.key" class="users__checkbox">
          <input v-model="rolesForm" type="checkbox" :value="role.key">
          {{ role.name }}
        </label>

        <div class="users__panel-actions">
          <button type="submit">Save</button>
          <button type="button" @click="cancelRoles">Cancel</button>
        </div>
      </form>
    </div>

    <div v-if="resettingUser" class="users__panel">
      <h2>Reset password for {{ resettingUser.fullName }}</h2>
      <p>
        {{ resettingUser.fullName }} must change this password at next sign-in, and every existing
        session for that account will be signed out immediately.
      </p>
      <form @submit.prevent="submitReset">
        <div v-if="users.error" role="alert" class="users__error">{{ users.error }}</div>

        <label>
          New password
          <input v-model="resetForm.password" type="password" required>
        </label>

        <div class="users__panel-actions">
          <button type="submit">Save</button>
          <button type="button" @click="cancelReset">Cancel</button>
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
  margin-bottom: 1.5rem;
}

.users__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.users__filters label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.users__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  margin-bottom: 1rem;
}

.users__table-wrap {
  overflow-x: auto;
}

.users__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.users__table th,
.users__table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.users__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.users__pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.users__panel {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.users__panel form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.users__panel label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.users__checkbox {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;
}

.users__panel-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
