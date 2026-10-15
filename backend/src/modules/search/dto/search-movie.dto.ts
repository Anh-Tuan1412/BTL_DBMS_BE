import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchMovieDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên phim' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo thể loại phim (Action, Drama...)',
  })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID rạp chiếu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cinemaId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ngày chiếu (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Khoảng giá vé tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Khoảng giá vé tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;
}
