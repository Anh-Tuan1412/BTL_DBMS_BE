import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {
  LoginDto,
  ForgotPasswordDto,
  VerifyEmailDto,
  ResetPasswordDto,
} from './dto/auth-requests.dto';
import { UserRole } from '../../common/enums';
import { OtpService } from './otp.service';
import { ConfigService } from '@nestjs/config';
import { sessionCredential } from './session-credential';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    registerDto.email = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    this.otp.delivery();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    let newUser;
    try {
      newUser = await this.usersService.create({
        email: registerDto.email,
        password: hashedPassword,
        fullName: registerDto.fullName.trim(),
        phoneNumber: registerDto.phoneNumber?.trim() || undefined,
        role: UserRole.CUSTOMER,
        status: 'INACTIVE',
      });
    } catch (error) {
      if (
        error?.code === 'ER_DUP_ENTRY' ||
        error?.driverError?.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('Email hoặc số điện thoại đã được sử dụng');
      }
      throw error;
    }
    await this.otp.issue(newUser.email, 'verify');

    return {
      message: 'Đăng ký tài khoản thành công',
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        status: newUser.status,
      },
      delivery: this.otp.delivery(),
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.usersService.findByEmail(verifyEmailDto.email);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (user.status !== 'INACTIVE')
      throw new BadRequestException('Tài khoản không chờ xác thực');
    await this.otp.consume(user.email, 'verify', verifyEmailDto.otp);
    await this.usersService.update(user.id, { status: 'ACTIVE' });

    return {
      message: 'Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay.',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email, true);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // 1. Kiểm tra trạng thái tài khoản
    if (user.status === 'BANNED') {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa do vi phạm điều khoản',
      );
    }
    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Tài khoản của bạn chưa được kích hoạt');
    }

    // 2. Xác thực mật khẩu băm
    const isPasswordMatch = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // 3. Sinh JWT Token
    const token = this.generateToken(
      user.id,
      user.email,
      user.role,
      user.password,
    );

    return {
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
      accessToken: token,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const email = forgotPasswordDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    await this.otp.issue(email, 'reset', user?.status === 'ACTIVE');
    return {
      message:
        'Nếu email thuộc tài khoản hoạt động, mã khôi phục sẽ được gửi. Mã có hiệu lực 10 phút.',
      delivery: this.otp.delivery(),
    };
  }

  async resendVerification(email: string) {
    email = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    await this.otp.issue(email, 'verify', user?.status === 'INACTIVE');
    return {
      message: 'Nếu tài khoản đang chờ xác thực, mã mới sẽ được gửi.',
      delivery: this.otp.delivery(),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmail(
      dto.email.trim().toLowerCase(),
    );
    if (!user || user.status !== 'ACTIVE')
      throw new BadRequestException(
        'Không thể đặt lại mật khẩu cho tài khoản này',
      );
    await this.otp.consume(user.email, 'reset', dto.otp);
    await this.usersService.update(user.id, {
      password: await bcrypt.hash(dto.newPassword, 10),
    });
    return { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' };
  }

  private generateToken(
    userId: number,
    email: string,
    role: UserRole,
    passwordHash: string,
  ): string {
    const payload = {
      sub: userId,
      email,
      role,
      credential: sessionCredential(
        passwordHash,
        this.config.get<string>(
          'JWT_SECRET',
          'super_secret_jwt_key_movie_booking_2026',
        ),
      ),
    };
    return this.jwtService.sign(payload);
  }
}
