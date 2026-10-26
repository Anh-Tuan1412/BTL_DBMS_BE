import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShowtimeStatus } from '../../../common/enums';

export class CreateShowtimeDto {
  @ApiProperty({ example: 1, description: 'ID phim' })
  @IsInt()
  @Type(() => Number)
  movieId: number;

  @ApiProperty({ example: 1, description: 'ID phòng chiếu' })
  @IsInt()
  @Type(() => Number)
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
  @Type(() => Number)
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
  @Type(() => Number)
  cleanupMinutes?: number;
}

export class UpdateShowtimeDto extends PartialType(CreateShowtimeDto) {}

/**
 * DTO dùng để kiểm tra xung đột lịch chiếu độc lập (trước khi tạo hoặc cập nhật).
 */
export class CheckConflictDto {
  @ApiProperty({ example: 1, description: 'ID phòng chiếu cần kiểm tra' })
  @IsInt()
  @Type(() => Number)
  roomId: number;

  @ApiProperty({
    example: '2026-09-20T19:30:00Z',
    description: 'Thời gian bắt đầu dự kiến (ISO Date)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2026-09-20T22:00:00Z',
    description: 'Thời gian kết thúc dự kiến (ISO Date)',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    example: 15,
    default: 15,
    required: false,
    description: 'Số phút dọn dẹp phòng',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  @Type(() => Number)
  cleanupMinutes?: number;

  @ApiProperty({
    example: 10,
    required: false,
    description: 'ID suất chiếu cần loại trừ (dùng khi kiểm tra để cập nhật suất chiếu hiện tại)',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  excludeShowtimeId?: number;
}

/**
 * DTO lọc danh sách suất chiếu đa tiêu chí.
 */
export class QueryShowtimeDto {
  @ApiProperty({ example: 1, required: false, description: 'Lọc theo ID phim' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  movieId?: number;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Lọc theo ID phòng chiếu',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  roomId?: number;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Lọc theo ID rạp chiếu',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  cinemaId?: number;

  @ApiProperty({
    example: '2026-09-20',
    required: false,
    description: 'Lọc theo ngày chiếu (định dạng YYYY-MM-DD)',
  })
  @IsOptional()
  date?: string;

  @ApiProperty({
    enum: ShowtimeStatus,
    required: false,
    description: 'Lọc theo trạng thái suất chiếu',
  })
  @IsOptional()
  @IsEnum(ShowtimeStatus)
  status?: ShowtimeStatus;
}

