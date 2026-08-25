import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { IssuedTokens, TokenService } from './token.service';
import type { AuthenticatedUser } from './types/authenticated-user';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * A real scrypt digest of a random string, hashed once at module load. Verified
 * against when no user matches, so a wrong email and a wrong password cost the
 * same wall-clock time and cannot be told apart by an attacker.
 */
const DUMMY_HASH_PROMISE = new PasswordService().hash('timing-equaliser-not-a-real-password');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async login(email: string, password: string, userAgent?: string): Promise<IssuedTokens> {
    const normalized = AuthService.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, passwordHash: true, isActive: true, lockedUntil: true },
    });

    if (!user) {
      await this.passwordService.verify(password, await DUMMY_HASH_PROMISE);
      this.logger.warn({ email: normalized }, 'Login failed: no such account');
      throw AuthService.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      this.logger.warn({ userId: user.id }, 'Login rejected: account locked');
      throw AuthService.invalidCredentials();
    }

    if (!user.isActive) {
      await this.passwordService.verify(password, user.passwordHash);
      this.logger.warn({ userId: user.id }, 'Login rejected: account inactive');
      throw AuthService.invalidCredentials();
    }

    const matches = await this.passwordService.verify(password, user.passwordHash);

    if (!matches) {
      await this.registerFailure(user.id);
      this.logger.warn({ userId: user.id }, 'Login failed: wrong password');
      throw AuthService.invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    this.logger.log({ userId: user.id }, 'Login succeeded');

    return this.tokenService.issue(user.id, user.email, userAgent);
  }

  async refresh(rawToken: string, userAgent?: string): Promise<IssuedTokens> {
    const userId = await this.tokenService.consume(rawToken);

    if (!userId) {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });

    return this.tokenService.issue(user.id, user.email, userAgent);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) {
      await this.tokenService.revoke(rawToken);
    }
  }

  /** Loads the full authorization context. Called by JwtAuthGuard per request. */
  async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        mustChangePassword: true,
        departmentId: true,
        branchId: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const permissions = new Set<string>();

    for (const assignment of user.roles) {
      for (const grant of assignment.role.permissions) {
        permissions.add(grant.permission.key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      branchId: user.branchId,
      roles: user.roles.map((assignment) => assignment.role.key).sort(),
      permissions: [...permissions].sort(),
    };
  }

  private async registerFailure(userId: string): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          failedLoginAttempts: 0,
        },
      });
      this.logger.warn({ userId }, `Account locked for ${LOCKOUT_MINUTES} minutes`);
    }
  }

  private static invalidCredentials(): UnauthorizedException {
    // One message for every failure mode — wrong email, wrong password,
    // inactive, locked. Distinguishing them turns login into an account
    // enumeration oracle. The server log above records the real reason.
    return new UnauthorizedException('Invalid email or password.');
  }
}
