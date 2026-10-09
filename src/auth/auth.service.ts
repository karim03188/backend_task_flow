import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PasswordService } from '../common/security/password.service';
import { PublicUser, toPublicUser } from '../users/user-response.type';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload.interface';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.usersService.create(dto);
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Same message for unknown user and wrong password to avoid enumeration.
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await this.passwords.verify(
      dto.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  /**
   * Revokes all access tokens issued so far for the user. Stateless JWTs cannot
   * be invalidated on their own, so the server bumps the user's `tokenVersion`;
   * every token carrying an older version is rejected by the JWT guard.
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.incrementTokenVersion(userId);
    return {
      message:
        'Logged out successfully. All previously issued access tokens are now invalid.',
    };
  }

  me(userId: string): Promise<PublicUser> {
    return this.usersService.getProfile(userId);
  }

  private async buildAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: toPublicUser(user),
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d',
    };
  }
}
