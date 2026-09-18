import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { MovieStatus } from '../../../common/enums';

export class CreateMovieDto {
  @ApiProperty({ example: 'Oppenheimer', description: 'Tên phim' })
  @IsNotEmpty({ message: 'Tên phim không được để trống' })
  title: string;

  @ApiProperty({
    example: 'Phim tiểu sử về J. Robert Oppenheimer...',
    required: false,
  })
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 180, description: 'Thời lượng phim tính bằng phút' })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({
    example: '2026-09-20',
    description: 'Ngày khởi chiếu (YYYY-MM-DD)',
  })
  @IsDateString()
  releaseDate: string;

  @ApiProperty({ example: 'Tiểu sử, Lịch sử, Kịch tính', required: false })
  @IsOptional()
  genre?: string;

  @ApiProperty({ example: 'Christopher Nolan', required: false })
  @IsOptional()
  director?: string;

  @ApiProperty({
    example: 'Cillian Murphy, Emily Blunt, Matt Damon',
    required: false,
  })
  @IsOptional()
  cast?: string;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1',
    required: false,
  })
  @IsOptional()
  posterUrl?: string;

  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    required: false,
  })
  @IsOptional()
  trailerUrl?: string;

  @ApiProperty({
    enum: MovieStatus,
    default: MovieStatus.NOW_SHOWING,
    required: false,
  })
  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @ApiProperty({ example: 8.9, required: false })
  @IsOptional()
  @IsNumber()
  rating?: number;
}

export class UpdateMovieDto {
  @ApiProperty({ required: false })
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  releaseDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  genre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  director?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  cast?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  posterUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  trailerUrl?: string;

  @ApiProperty({ enum: MovieStatus, required: false })
  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  rating?: number;
}
