/**
 * What JwtAuthGuard attaches to request.user. Built from the database on every
 * request, so it is always current — never read identity from the JWT claims.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  departmentId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}
