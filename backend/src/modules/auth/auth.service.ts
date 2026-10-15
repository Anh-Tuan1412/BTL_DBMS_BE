import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, ForgotPasswordDto } from './dto/auth-requests.dto';
import { UserRole } from '../../common/enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    const newUser = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      fullName: registerDto.fullName,
      phoneNumber: registerDto.phoneNumber,
      role: registerDto.role || UserRole.CUSTOMER,
    });

    const token = this.generateToken(newUser.id, newUser.email, newUser.role);

    return {
      message: 'Đăng ký tài khoản thành công',
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        status: newUser.status,
      },
      accessToken: token,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email, true);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // 1. Kiểm tra trạng thái tài khoản (Chống tài khoản bị BANNED/INACTIVE đăng nhập)
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa do vi phạm điều khoản');
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
    const token = this.generateToken(user.id, user.email, user.role);

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
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này');
    }

    return {
      message: `Đã gửi mã khôi phục mật khẩu tới email ${forgotPasswordDto.email} (Chế độ mô phỏng)`,
      resetTokenStub: `mock-reset-token-${Date.now()}`,
    };
  }

  private generateToken(userId: number, email: string, role: UserRole): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}