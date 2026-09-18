import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeatsService } from './seats.service';
import { CreateSeatDto, GenerateSeatsForRoomDto } from './dto/seat.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { UserRole } from '../../common/enums';
import { User } from '../../database/entities/user.entity';

@ApiTags('Seats - Quản lý ghế & Sơ đồ ghế (UC3: Quang, UC6: Vân)')
@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Public()
  @Get('room/:roomId')
  @ApiOperation({ summary: 'Lấy danh sách ghế của phòng chiếu' })
  findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.seatsService.findByRoom(roomId);
  }

  @Public()
  @Get('matrix/showtime/:showtimeId')
  @ApiOperation({
    summary:
      'UC6: Xem sơ đồ và trạng thái ghế thời gian thực (kết hợp MySQL & Redis)',
    description:
      'Trả về trạng thái: AVAILABLE (ghế trống), HOLDING (đang giữ 5p kèm TTL), BOOKED (đã đặt)',
  })
  getSeatMatrix(
    @Param('showtimeId', ParseIntPipe) showtimeId: number,
    @CurrentUser() user?: User,
  ) {
    return this.seatsService.getSeatMatrixForShowtime(showtimeId, user?.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Thêm một ghế đơn lẻ vào phòng (Chỉ dành cho ADMIN)',
  })
  createSeat(@Body() dto: CreateSeatDto) {
    return this.seatsService.createSeat(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('generate-grid')
  @ApiOperation({
    summary:
      'Tự động tạo ma trận ghế theo hàng/cột cho phòng chiếu (Chỉ dành cho ADMIN)',
  })
  generateGrid(@Body() dto: GenerateSeatsForRoomDto) {
    return this.seatsService.generateSeatsGrid(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa ghế (Chỉ dành cho ADMIN)' })
  deleteSeat(@Param('id', ParseIntPipe) id: number) {
    return this.seatsService.deleteSeat(id);
  }
}
