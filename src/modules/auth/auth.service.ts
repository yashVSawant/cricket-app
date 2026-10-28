import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role, OrgStatus } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  playerKey?: string | null;
  organizerId?: string | null;
  organizerStatus?: OrgStatus | null;
  playerProfile?: {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
  } | null;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user (Player or Organizer)
   */
  async register(dto: RegisterDto): Promise<{ user: SanitizedUser; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const targetRole = dto.role === Role.ADMIN ? Role.ADMIN : Role.PLAYER;
    const playerKey = targetRole === Role.PLAYER ? `PL-${crypto.randomBytes(3).toString('hex').toUpperCase()}` : null;

    let createdUser;

    if (targetRole === Role.ADMIN) {
      // Create Organizer entity (pending super admin approval) & linked User
      createdUser = await this.prisma.$transaction(async (tx) => {
        const organizer = await tx.organizer.create({
          data: {
            name: dto.organizationName || `${dto.name}'s Organization`,
            contactEmail: dto.email.toLowerCase().trim(),
            phone: dto.phone || null,
            description: dto.organizationDescription || null,
            status: OrgStatus.PENDING,
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase().trim(),
            passwordHash,
            name: dto.name.trim(),
            role: Role.ADMIN,
            organizerId: organizer.id,
          },
          include: {
            organizer: true,
          },
        });

        return user;
      });
    } else {
      // Default: PLAYER registration with player profile
      createdUser = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          name: dto.name.trim(),
          role: Role.PLAYER,
          playerKey,
          playerProfile: {
            create: {
              battingStyle: dto.battingStyle || null,
              bowlingStyle: dto.bowlingStyle || null,
            },
          },
        },
        include: {
          playerProfile: true,
        },
      });
    }

    const tokens = await this.generateTokens(createdUser);
    await this.storeRefreshTokenInRedis(createdUser.id, tokens.refreshToken);

    const sanitized = this.sanitizeUser(createdUser);
    await this.cacheUserSession(sanitized);

    this.logger.log(`User registered successfully: ${sanitized.email} [${sanitized.role}]`);
    return { user: sanitized, tokens };
  }

  /**
   * Log in an existing user
   */
  async login(dto: LoginDto): Promise<{ user: SanitizedUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        playerProfile: true,
        organizer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshTokenInRedis(user.id, tokens.refreshToken);

    const sanitized = this.sanitizeUser(user);
    await this.cacheUserSession(sanitized);

    this.logger.log(`User logged in: ${sanitized.email} [${sanitized.role}]`);
    return { user: sanitized, tokens };
  }

  /**
   * Refresh JWT Access Token using Refresh Token with Redis verification
   */
  async refreshTokens(refreshToken: string): Promise<{ user: SanitizedUser; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: any;
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    const tokenHash = this.hashToken(refreshToken);
    const redisKey = `auth:refresh:${userId}:${tokenHash}`;

    // Verify token exists in Redis whitelist
    const exists = await this.redisService.exists(redisKey);
    if (!exists) {
      this.logger.warn(`Suspicious refresh token attempt or revoked token for user: ${userId}`);
      throw new UnauthorizedException('Session expired or revoked. Please log in again.');
    }

    // Delete old refresh token from Redis (single-use rotation)
    await this.redisService.del(redisKey);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        playerProfile: true,
        organizer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    const newTokens = await this.generateTokens(user);
    await this.storeRefreshTokenInRedis(user.id, newTokens.refreshToken);

    const sanitized = this.sanitizeUser(user);
    await this.cacheUserSession(sanitized);

    return { user: sanitized, tokens: newTokens };
  }

  /**
   * Log out user: revoke refresh token and clear user session in Redis
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.redisService.del(`auth:refresh:${userId}:${tokenHash}`);
    } else {
      // Revoke all active sessions for this user
      await this.redisService.delByPattern(`auth:refresh:${userId}:*`);
    }

    // Evict cached session
    await this.redisService.del(`user:session:${userId}`);
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Get current authenticated user profile (with Redis session caching)
   */
  async getProfile(userId: string): Promise<SanitizedUser> {
    const cached = await this.redisService.get<SanitizedUser>(`user:session:${userId}`);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        playerProfile: true,
        organizer: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const sanitized = this.sanitizeUser(user);
    await this.cacheUserSession(sanitized);
    return sanitized;
  }

  /**
   * Set HTTP-Only Auth Cookies on Express Response
   */
  setAuthCookies(res: Response, tokens: AuthTokens): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieSecure = this.configService.get<string>('COOKIE_SECURE') === 'true' || isProduction;
    const sameSite = (this.configService.get<string>('COOKIE_SAME_SITE', 'lax') as 'lax' | 'strict' | 'none');
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

    // Refresh Token cookie (7 days)
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      domain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Access Token cookie (15 mins)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
  }

  /**
   * Clear HTTP-Only Auth Cookies on Express Response
   */
  clearAuthCookies(res: Response): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieSecure = this.configService.get<string>('COOKIE_SECURE') === 'true' || isProduction;
    const sameSite = (this.configService.get<string>('COOKIE_SAME_SITE', 'lax') as 'lax' | 'strict' | 'none');
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      domain,
      path: '/',
    });

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      domain,
      path: '/',
    });
  }

  // --- Internal Helpers ---

  private async generateTokens(user: any): Promise<AuthTokens> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      playerKey: user.playerKey || null,
      organizerId: user.organizerId || null,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshTokenInRedis(userId: string, token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const key = `auth:refresh:${userId}:${tokenHash}`;
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days
    await this.redisService.set(key, { userId, createdAt: Date.now() }, ttlSeconds);
  }

  private async cacheUserSession(user: SanitizedUser): Promise<void> {
    const key = `user:session:${user.id}`;
    const ttlSeconds = 15 * 60; // 15 mins
    await this.redisService.set(key, user, ttlSeconds);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: any): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      playerKey: user.playerKey || null,
      organizerId: user.organizerId || null,
      organizerStatus: user.organizer?.status || null,
      playerProfile: user.playerProfile
        ? {
            battingStyle: user.playerProfile.battingStyle,
            bowlingStyle: user.playerProfile.bowlingStyle,
          }
        : null,
      createdAt: user.createdAt,
    };
  }
}

