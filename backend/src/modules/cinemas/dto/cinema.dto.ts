import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCinemaDto {
  @ApiProperty({
    example: 'CGV Vincom Landmark 81',
    description: 'Tên rạp chiếu phim',
  })
  @IsNotEmpty({ message: 'Tên rạp không được để trống' })
  name!: string;

  @ApiProperty({
    example: '772 Điện Biên Phủ, Phường 22, Bình Thạnh',
    description: 'Địa chỉ rạp',
  })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address!: string;

  @ApiProperty({ example: 'TP. Hồ Chí Minh', description: 'Thành phố' })
  @IsNotEmpty({ message: 'Thành phố không được để trống' })
  city!: string;

  @ApiProperty({ example: '02838229999', description: 'Số điện thoại rạp', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    description: 'Trạng thái hoạt động của rạp',
    required: false,
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class SeatConfigDto {
  @ApiProperty({ example: 1, description: 'ID loại ghế (từ bảng seat_types)' })
  @IsInt()
  @IsNotEmpty({ message: 'ID loại ghế không được để trống' })
  seatTypeId!: number;

  @ApiProperty({ example: 40, description: 'Số lượng ghế thuộc loại này' })
  @IsInt()
  @Min(1, { message: 'Số lượng ghế phải lớn hơn 0' })
  totalSeats!: number;
}

export class CreateRoomDto {
  @ApiProperty({ example: 'Cinema 01 (IMAX)', description: 'Tên phòng chiếu' })
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  name!: string;

  @ApiProperty({ example: 1, description: 'ID rạp chiếu phim' })
  @IsInt()
  cinemaId!: number;

  @ApiProperty({ example: 60, description: 'Tổng số ghế trong phòng' })
  @IsInt()
  @Min(1, { message: 'Tổng số ghế phải lớn hơn 0' })
  totalSeats!: number;

  @ApiProperty({
    type: [SeatConfigDto],
    description: 'Danh sách cấu hình số lượng theo từng loại ghế (Thường, VIP, Sweetbox...)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatConfigDto)
  seatConfigurations?: SeatConfigDto[];

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    description: 'Trạng thái phòng chiếu',
    required: false,
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdateCinemaDto extends PartialType(CreateCinemaDto) {}
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}