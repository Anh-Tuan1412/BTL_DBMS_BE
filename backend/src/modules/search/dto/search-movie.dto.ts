import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Matches,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovieStatus } from '../../../common/enums';

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
  @IsInt()
  @Min(1)
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
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Khoảng giá vé tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: MovieStatus })
  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;
}
