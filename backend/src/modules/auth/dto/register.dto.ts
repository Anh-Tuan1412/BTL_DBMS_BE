import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Địa chỉ email người dùng',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Mật khẩu từ 8 đến 72 ký tự',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    example: '0987654321',
    required: false,
    description: 'Số điện thoại liên hệ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
}
