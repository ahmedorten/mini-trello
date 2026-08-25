import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  /** SHA-256 of the raw token. The stored form; never store the raw value. */
  static digest(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async issue(userId: string, email: string, userAgent?: string): Promise<IssuedTokens> {
    const ttl = this.configService.get('JWT_ACCESS_TTL', { infer: true });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, jti: randomUUID() } satisfies AccessTokenClaims,
      // `ttl` is validated at boot against /^\d+[smhd]$/ (env.validation.ts), but
      // that shape is narrower than what TypeScript can express as `string` here.
      { expiresIn: ttl as `${number}${'s' | 'm' | 'h' | 'd'}` },
    );

    const days = this.configService.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: TokenService.digest(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return {
      accessToken,
      expiresInSeconds: TokenService.ttlToSeconds(ttl),
      refreshToken,
      refreshExpiresAt,
    };
  }

  /**
   * Consumes a refresh token. Returns the owning user id, or null when the
   * token is unknown, expired, or belongs to an inactive user.
   *
   * Presenting an ALREADY-REVOKED token is treated as theft: every session for
   * that user is revoked and null is returned.
   */
  async consume(rawToken: string): Promise<string | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: TokenService.digest(rawToken) },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!record) {
      return null;
    }

    if (record.revokedAt) {
      this.logger.warn(
        { userId: record.userId },
        'Revoked refresh token replayed; revoking all sessions for this user',
      );
      await this.revokeAllForUser(record.userId);
      return null;
    }

    if (record.expiresAt.getTime() <= Date.now() || !record.user.isActive) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return record.userId;
  }

  /** Revokes one token by its raw value. Silent when it is unknown. */
  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokenService.digest(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);

    if (!match) {
      // Unreachable: validateEnv enforces the format at boot.
      return 900;
    }

    const value = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 1;

    return value * multiplier;
  }
}
