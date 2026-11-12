import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { sessionCredential } from '../session-credential';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  credential: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'super_secret_jwt_key_movie_booking_2026',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService
      .findById(payload.sub, true)
      .catch(() => null);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Người dùng không tồn tại hoặc token không hợp lệ',
      );
    }
    const credential = sessionCredential(
      user.password,
      this.configService.get<string>(
        'JWT_SECRET',
        'super_secret_jwt_key_movie_booking_2026',
      ),
    );
    if (payload.credential !== credential)
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.',
      );
    // The password hash is selected only for verification and must never reach
    // CurrentUser, controllers, response serialization or client storage.
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
