import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  Max,
} from 'class-validator';

export class CreateShowtimeDto {
  @ApiProperty({ example: 1, description: 'ID phim' })
  @IsInt()
  movieId: number;

  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  roomId: number;

  @ApiProperty({
    example: '2026-09-20T19:30:00Z',
    description: 'Thời gian bắt đầu (ISO Date)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2026-09-20T22:00:00Z',
    description: 'Thời gian kết thúc (ISO Date)',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({ example: 95000, description: 'Giá vé cơ bản (VNĐ)' })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    default: 15,
    required: false,
    description: 'Số phút dọn phòng sau suất chiếu',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  cleanupMinutes?: number;
}

export class UpdateShowtimeDto extends PartialType(CreateShowtimeDto) {}
