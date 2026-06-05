import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserTenantRole } from '@prisma/client';
import type { AuthMeResponse, AuthTokens, AuthUser, JwtPayload } from '@yardflow/types';
import {
  CASHIER_PERMISSIONS,
  OWNER_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
} from '@yardflow/types';
import { loginSchema } from '@yardflow/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(body: unknown): Promise<AuthTokens & { user: AuthMeResponse }> {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const { email, phone, password, tenantSlug } = parsed.data;

    const user = await this.prisma.user.findFirst({
      where: email ? { email } : { phone },
      include: {
        userTenants: {
          where: { isActive: true },
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isPlatformAdmin && !tenantSlug) {
      return this.issueTokens(user.id, user.fullName, user.email, {
        isPlatformAdmin: true,
        permissions: [...PLATFORM_ADMIN_PERMISSIONS],
      });
    }

    if (!tenantSlug) {
      throw new BadRequestException('tenantSlug is required for tenant users');
    }

    const membership = user.userTenants.find((ut) => ut.tenant.slug === tenantSlug);
    if (!membership) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const permissions =
      membership.role === UserTenantRole.owner
        ? [...OWNER_PERMISSIONS]
        : [...CASHIER_PERMISSIONS];

    return this.issueTokens(user.id, user.fullName, user.email, {
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
      permissions,
      isPlatformAdmin: false,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            userTenants: {
              where: { isActive: true },
              include: { tenant: true },
            },
          },
        },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = stored.user;
    const activeMembership = user.userTenants[0];

    if (user.isPlatformAdmin && user.userTenants.length === 0) {
      return this.issueTokensOnly(user.id, {
        isPlatformAdmin: true,
        permissions: [...PLATFORM_ADMIN_PERMISSIONS],
      });
    }

    if (!activeMembership) {
      throw new UnauthorizedException('No active tenant membership');
    }

    const permissions =
      activeMembership.role === UserTenantRole.owner
        ? [...OWNER_PERMISSIONS]
        : [...CASHIER_PERMISSIONS];

    return this.issueTokensOnly(user.id, {
      tenantId: activeMembership.tenantId,
      tenantSlug: activeMembership.tenant.slug,
      role: activeMembership.role,
      permissions,
      isPlatformAdmin: false,
    });
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async me(user: AuthUser): Promise<AuthMeResponse> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.userId,
      fullName: dbUser.fullName,
      email: dbUser.email,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      role: user.role,
      permissions: user.permissions,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }

  private async issueTokens(
    userId: string,
    fullName: string,
    email: string | null,
    context: Omit<JwtPayload, 'sub'>,
  ): Promise<AuthTokens & { user: AuthMeResponse }> {
    const tokens = await this.issueTokensOnly(userId, context);
    return {
      ...tokens,
      user: {
        userId,
        fullName,
        email,
        tenantId: context.tenantId,
        tenantSlug: context.tenantSlug,
        role: context.role,
        permissions: context.permissions,
        isPlatformAdmin: context.isPlatformAdmin,
      },
    };
  }

  private async issueTokensOnly(
    userId: string,
    context: Omit<JwtPayload, 'sub'>,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, ...context };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const expiresAt = this.parseExpiry(refreshExpires);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(value: string): Date {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + amount * multipliers[unit]);
  }
}
