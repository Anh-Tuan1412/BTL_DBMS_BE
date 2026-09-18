import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsEnum, IsNumber, Min } from 'class-validator';
import { SeatType } from '../../../common/enums';

export class CreateSeatDto {
  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  roomId: number;

  @ApiProperty({ example: 'A', description: 'Hàng ghế (A, B, C...)' })
  @IsNotEmpty()
  row: string;

  @ApiProperty({ example: 1, description: 'Số cột ghế' })
  @IsInt()
  @Min(1)
  column: number;

  @ApiProperty({ example: 'A1', description: 'Mã số ghế hiển thị' })
  @IsNotEmpty()
  seatNumber: string;

  @ApiProperty({ enum: SeatType, default: SeatType.REGULAR })
  @IsEnum(SeatType)
  type: SeatType;

  @ApiProperty({ example: 1.0, default: 1.0, description: 'Hệ số nhân giá vé' })
  @IsNumber()
  priceMultiplier: number;
}

export class GenerateSeatsForRoomDto {
  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  roomId: number;

  @ApiProperty({
    example: ['A', 'B', 'C', 'D', 'E', 'F'],
    description: 'Danh sách các hàng ghế',
  })
  rows: string[];

  @ApiProperty({ example: 10, description: 'Số cột mỗi hàng' })
  @IsInt()
  @Min(1)
  colsPerRow: number;

  @ApiProperty({
    example: ['E', 'F'],
    description: 'Các hàng được xếp là VIP',
    required: false,
  })
  vipRows?: string[];
}
