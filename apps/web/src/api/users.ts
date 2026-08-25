import { apiClient } from './client';

/** Mirrors OrgUnitRefDto in apps/api/src/users/dto/user-response.dto.ts */
export interface OrgUnitRef {
  id: string;
  key: string;
  name: string;
}

/** Mirrors UserResponseDto. Note what is absent: no password field of any kind. */
export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  department: OrgUnitRef | null;
  branch: OrgUnitRef | null;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsers {
  items: UserSummary[];
  meta: PaginationMeta;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  roleKey?: string;
  departmentId?: string;
  isActive?: 'true' | 'false';
}

/** Mirrors RoleResponseDto. */
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  userCount: number;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  password: string;
  roleKeys: string[];
  departmentId?: string;
  branchId?: string;
}

export interface UpdateUserPayload {
  email?: string;
  fullName?: string;
  departmentId?: string | null;
  branchId?: string | null;
}

export async function listUsers(params: ListUsersParams): Promise<PaginatedUsers> {
  const response = await apiClient.get<PaginatedUsers>('/users', { params });

  return response.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const response = await apiClient.post<UserSummary>('/users', payload);

  return response.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  const response = await apiClient.patch<UserSummary>(`/users/${id}`, payload);

  return response.data;
}

export async function setUserStatus(id: string, isActive: boolean): Promise<UserSummary> {
  const response = await apiClient.patch<UserSummary>(`/users/${id}/status`, { isActive });

  return response.data;
}

export async function setUserRoles(id: string, roleKeys: string[]): Promise<UserSummary> {
  const response = await apiClient.put<UserSummary>(`/users/${id}/roles`, { roleKeys });

  return response.data;
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  await apiClient.post(`/users/${id}/password`, { password });
}

export async function listRoles(): Promise<Role[]> {
  const response = await apiClient.get<Role[]>('/roles');

  return response.data;
}

// Only departments are exposed here, not branches: the create/edit form offers a
// department dropdown, and adding a branch picker without a branch management
// screen would be scope this story does not ask for.
export async function listDepartments(): Promise<OrgUnitRef[]> {
  const response = await apiClient.get<OrgUnitRef[]>('/departments');

  return response.data;
}
