import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
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
