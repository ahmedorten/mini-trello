import { Role, RolePermissions } from './Role';
import { Permission } from './Permission';

export class PermissionGuard {
  /**
   * Check if a specific role possesses a given permission.
   */
  public static hasPermission(role: Role | string | undefined | null, permission: Permission): boolean {
    if (!role) {
      return false;
    }
    
    // Normalize role string to enum
    const normalizedRole = typeof role === 'string' ? role.toLowerCase() as Role : role;
    const permissions = RolePermissions[normalizedRole];
    
    if (!permissions) {
      return false;
    }
    
    return permissions.includes(permission);
  }

  /**
   * Check if user is board owner.
   */
  public static canAccessBoard(userId: string, ownerId: string): boolean {
    return userId === ownerId;
  }
}

export default PermissionGuard;
