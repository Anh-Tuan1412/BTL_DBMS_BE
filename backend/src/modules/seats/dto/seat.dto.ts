import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsEnum,
  Min,
  Max,
  IsString,
  Matches,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { SeatType } from '../../../common/enums';

export class CreateSeatDto {
  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  @Min(1)
  roomId: number;

  @ApiProperty({ example: 'A', description: 'Hàng ghế (A, B, C...)' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{1,3}$/)
  row: string;

  @ApiProperty({ example: 1, description: 'Số cột ghế' })
  @IsInt()
  @Min(1)
  @Max(100)
  column: number;

  @ApiProperty({ example: 'A1', description: 'Mã số ghế hiển thị' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9-]{1,10}$/)
  seatNumber: string;

  @ApiProperty({ enum: SeatType, default: SeatType.REGULAR })
  @IsEnum(SeatType)
  type: SeatType;
}

export class UpdateSeatDto extends PartialType(
  OmitType(CreateSeatDto, ['roomId'] as const),
) {}

export class GenerateSeatsForRoomDto {
  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  @Min(1)
  roomId: number;

  @ApiProperty({
    example: ['A', 'B', 'C', 'D', 'E', 'F'],
    description: 'Danh sách các hàng ghế',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(26)
  @Matches(/^[A-Z]{1,3}$/, { each: true })
  rows: string[];

  @ApiProperty({ example: 10, description: 'Số cột mỗi hàng' })
  @IsInt()
  @Min(1)
  @Max(100)
  colsPerRow: number;

  @ApiProperty({
    example: ['E', 'F'],
    description: 'Các hàng được xếp là VIP',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Matches(/^[A-Z]{1,3}$/, { each: true })
  vipRows?: string[];
}
