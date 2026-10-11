import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, Min } from 'class-validator';

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
  @Min(1)
  totalSeats!: number;
}

export class UpdateCinemaDto extends PartialType(CreateCinemaDto) {}
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
