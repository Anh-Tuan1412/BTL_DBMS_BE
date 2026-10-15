import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsString,
  IsObject,
  ArrayUnique,
  Min,
  IsIn,
} from 'class-validator';

export class HoldSeatDto {
  @ApiProperty({ example: 1, description: 'ID suất chiếu' })
  @IsInt()
  @Min(1)
  showtimeId: number;

  @ApiProperty({ example: 5, description: 'ID ghế cần giữ' })
  @IsInt()
  @Min(1)
  seatId: number;
}

export class ReleaseSeatDto {
  @ApiProperty({ example: 1, description: 'ID suất chiếu' })
  @IsInt()
  showtimeId: number;

  @ApiProperty({ example: 5, description: 'ID ghế cần giải phóng' })
  @IsInt()
  seatId: number;

  @ApiProperty({ description: 'Token được trả về khi giữ ghế' })
  @IsString()
  holdToken: string;
}

export class CreateBookingDto {
  @ApiProperty({ example: 1, description: 'ID suất chiếu' })
  @IsInt()
  showtimeId: number;

  @ApiProperty({ example: [5, 6], description: 'Danh sách các ID ghế đặt vé' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 ghế' })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  seatIds: number[];

  @ApiProperty({
    example: { '5': 'userId:uuid', '6': 'userId:uuid' },
    description: 'Map seatId → token giữ ghế',
  })
  @IsObject()
  holdTokens: Record<string, string>;

  @ApiProperty({
    example: 'STRIPE',
    default: 'STRIPE',
    description: 'Phương thức thanh toán',
  })
  @IsOptional()
  @IsString()
  @IsIn(['STRIPE'])
  paymentMethod?: string;
}

export class MockStripePaymentDto {
  @ApiProperty({
    example: 'BK-1726650000-ABC',
    description: 'Mã booking cần thanh toán',
  })
  @IsString()
  bookingCode: string;

  @ApiProperty({
    example: 'tok_visa',
    default: 'tok_visa',
    description: 'Stripe Mock Token',
  })
  @IsOptional()
  @IsString()
  stripeToken?: string;
}
