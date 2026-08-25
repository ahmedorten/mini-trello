import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import {
  createUser,
  listDepartments,
  listRoles,
  listUsers,
  resetUserPassword,
  setUserRoles,
  setUserStatus,
  updateUser,
  type CreateUserPayload,
  type ListUsersParams,
  type OrgUnitRef,
  type PaginationMeta,
  type Role,
  type UpdateUserPayload,
  type UserSummary,
} from '@/api/users';
import { toErrorMessage } from '@/api/client';

export const useUsersStore = defineStore('users', () => {
  const items = ref<UserSummary[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const roles = ref<Role[]>([]);
  const departments = ref<OrgUnitRef[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive<Required<Pick<ListUsersParams, 'page' | 'pageSize'>> & Omit<ListUsersParams, 'page' | 'pageSize'>>({
    page: 1,
    pageSize: 20,
    search: '',
    roleKey: '',
    departmentId: '',
    isActive: undefined,
  });

  function currentParams(): ListUsersParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      roleKey: filters.roleKey || undefined,
      departmentId: filters.departmentId || undefined,
      isActive: filters.isActive,
    };
  }

  // Guards against a slow response for an earlier search term overwriting a
  // faster response for a later one (debounced search racing the network).
  let latestRequestId = 0;

  async function load(): Promise<void> {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const result = await listUsers(currentParams());

      if (requestId !== latestRequestId) {
        return;
      }

      items.value = result.items;
      meta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestRequestId) {
        return;
      }

      // A stale list must never sit next to an error message.
      items.value = [];
      meta.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestRequestId) {
        isLoading.value = false;
      }
    }
  }

  async function loadLookups(): Promise<void> {
    try {
      const [roleList, departmentList] = await Promise.all([listRoles(), listDepartments()]);
      roles.value = roleList;
      departments.value = departmentList;
    } catch (caught) {
      // The role/department filters simply stay empty; the user list itself
      // must still be usable.
      error.value = toErrorMessage(caught);
    }
  }

  function setSearch(term: string): void {
    filters.search = term;
    filters.page = 1;
    void load();
  }

  function setRoleFilter(roleKey: string): void {
    filters.roleKey = roleKey;
    filters.page = 1;
    void load();
  }

  function setStatusFilter(isActive: 'true' | 'false' | ''): void {
    filters.isActive = isActive || undefined;
    filters.page = 1;
    void load();
  }

  function setPage(page: number): void {
    filters.page = page;
    void load();
  }

  async function create(payload: CreateUserPayload): Promise<boolean> {
    try {
      await createUser(payload);
      await load();

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function update(id: string, payload: UpdateUserPayload): Promise<boolean> {
    try {
      await updateUser(id, payload);
      await load();

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function setStatus(id: string, isActive: boolean): Promise<boolean> {
    try {
      await setUserStatus(id, isActive);
      await load();

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function setRoles(id: string, roleKeys: string[]): Promise<boolean> {
    try {
      await setUserRoles(id, roleKeys);
      await load();

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function resetPassword(id: string, password: string): Promise<boolean> {
    try {
      await resetUserPassword(id, password);
      await load();

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  return {
    items,
    meta,
    roles,
    departments,
    isLoading,
    error,
    filters,
    load,
    loadLookups,
    setSearch,
    setRoleFilter,
    setStatusFilter,
    setPage,
    create,
    update,
    setStatus,
    setRoles,
    resetPassword,
  };
});
